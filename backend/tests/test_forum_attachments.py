import hashlib,json,uuid
import tarfile
from types import SimpleNamespace
from io import BytesIO
from zipfile import ZipFile,ZIP_DEFLATED
from dataclasses import replace
import pytest
from sqlalchemy import text
from sqlalchemy.exc import DBAPIError
from pypdf import PdfWriter
from pypdf.generic import DictionaryObject,NameObject,DecodedStreamObject,ArrayObject,TextStringObject,FloatObject
from backend.db import transaction,rows,one,engine
from backend.config import settings
from backend.documents import private_file
from backend.forum.attachments import MAX_BYTES
from .conftest import login

DOCX='application/vnd.openxmlformats-officedocument.wordprocessingml.document'
POST='/api/v1/forum/posts/attachments'
TEXT=b'Ressource generale pour un atelier collectif.\nSans information individuelle.'

def upload(client,path=POST,body='Partage de ressources professionnelles.',files=None):
    return client.post(path,data={'body':body},files=files or [('files',('atelier.txt',TEXT,'text/plain'))])

def pdf(value='Ressource pour atelier collectif.'):
    writer=PdfWriter();page=writer.add_blank_page(width=400,height=400)
    font=DictionaryObject({NameObject('/Type'):NameObject('/Font'),NameObject('/Subtype'):NameObject('/Type1'),NameObject('/BaseFont'):NameObject('/Helvetica')})
    page[NameObject('/Resources')]=DictionaryObject({NameObject('/Font'):DictionaryObject({NameObject('/F1'):font})})
    content=DecodedStreamObject();content.set_data(('BT /F1 12 Tf 20 200 Td ('+value+') Tj ET').encode('latin-1'))
    page[NameObject('/Contents')]=writer._add_object(content);buffer=BytesIO();writer.write(buffer);return buffer.getvalue()

def docx(value='Ressource pour atelier collectif.'):
    buffer=BytesIO()
    with ZipFile(buffer,'w',ZIP_DEFLATED) as archive:
        archive.writestr('[Content_Types].xml','<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/></Types>')
        archive.writestr('word/document.xml','<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>'+value+'</w:t></w:r></w:p></w:body></w:document>')
    return buffer.getvalue()


def test_upload_list_and_download_original_after_authorization(client):
    login(client)
    result=upload(client)
    assert result.status_code==200,result.text
    value=result.json();key=value['attachment_ids'][0]
    post=next(p for p in client.get('/api/v1/forum').json()['posts'] if p['id']==value['id'])
    assert post['attachments']==[{'id':key,'name':'atelier.txt','mediaType':'text/plain','size':len(TEXT)}]
    assert 'storage_reference' not in json.dumps(post) and 'sha256' not in json.dumps(post)
    original=client.get('/api/v1/forum/attachments/'+key+'/download')
    assert original.status_code==200 and original.content==TEXT
    assert 'attachment;' in original.headers['content-disposition'] and original.headers['cache-control']=='no-store'
    with transaction(principal='admin') as c:
        record=one(c,'SELECT * FROM forum_attachments WHERE id=:id',id=key)
        assert record['author_id']=='p3' and record['centre_id']=='siliana'
        assert record['sha256']==hashlib.sha256(TEXT).hexdigest()
        assert private_file(record['storage_reference']).read_bytes()==TEXT
        events=rows(c,"SELECT metadata FROM audit_events WHERE resource_id=:id",id=key)
        assert events and all('atelier.txt' not in json.dumps(r['metadata']) and 'Ressource' not in json.dumps(r['metadata']) for r in events)


def test_comments_messages_and_attachment_only_posts(client):
    login(client)
    post=upload(client,body='').json()['id']
    comment=upload(client,f'/api/v1/forum/posts/{post}/comments/attachments',body='')
    assert comment.status_code==200,comment.text
    source=next(p for p in client.get('/api/v1/forum').json()['posts'] if p['id']==post)
    assert source['body']=='' and source['comments'][-1]['attachments']
    message=upload(client,'/api/v1/forum/conversations/conv-1/messages/attachments',body='')
    assert message.status_code==200,message.text
    key=message.json()['attachment_ids'][0]
    login(client,'p2')
    conversation=client.get('/api/v1/forum').json()['conversations'][0]
    assert any(a['id']==key for m in conversation['messages'] for a in m.get('attachments',[]))
    assert client.get('/api/v1/forum/attachments/'+key+'/download').status_code==200
    login(client,'p6')
    assert client.get('/api/v1/forum/attachments/'+key+'/download').status_code==404
    assert upload(client,'/api/v1/forum/conversations/conv-1/messages/attachments').status_code==404


@pytest.mark.parametrize('extension,mime,raw',[('pdf','application/pdf',pdf()),('docx',DOCX,docx())])
def test_pdf_and_word_documents_remain_downloadable(client,extension,mime,raw):
    login(client)
    response=upload(client,files=[('files',('atelier.'+extension,raw,mime))])
    assert response.status_code==200,response.text
    key=response.json()['attachment_ids'][0]
    assert client.get('/api/v1/forum/attachments/'+key+'/download').content==raw


def test_format_size_scan_and_payload_metadata_are_validated(client):
    login(client)
    for name,raw,mime in [('script.html',b'<html>','text/html'),('fake.pdf',TEXT,'application/pdf'),('atelier.txt',b'\x00\x01','text/plain'),('atelier.docx',TEXT,DOCX)]:
        assert upload(client,files=[('files',(name,raw,mime))]).status_code==422
    writer=PdfWriter();writer.add_blank_page(width=100,height=100);buffer=BytesIO();writer.write(buffer)
    assert upload(client,files=[('files',('scan.pdf',buffer.getvalue(),'application/pdf'))]).json()['detail']['code']=='FORUM_ATTACHMENT_TEXT_REQUIRED'
    assert upload(client,files=[('files',(str(i)+'.txt',TEXT,'text/plain')) for i in range(4)]).status_code==422
    assert upload(client,files=[('files',('large.txt',b'x'*(MAX_BYTES+1),'text/plain'))]).status_code==413
    assert client.post(POST,data={'body':'Ressource','author_id':'p4'},files=[('files',('atelier.txt',TEXT,'text/plain'))]).status_code==422


def test_known_identifiers_in_body_or_filename_are_refused_without_publication(client):
    login(client)
    with transaction(principal='admin') as c:
        name=one(c,"SELECT personal_information->'name'->>'fr' AS name FROM child_identities WHERE child_id=(SELECT child_id FROM cases WHERE id='CDIS-024')")['name']
        before=one(c,'SELECT count(*) AS n FROM forum_posts')['n']
    for filename,body in [(name.replace(' ','_')+'.txt',TEXT),('atelier.txt',('Suivi de '+name).encode())]:
        result=upload(client,files=[('files',(filename,body,'text/plain'))])
        assert result.status_code==422 and result.json()['detail']['code']=='FORUM_ATTACHMENT_PRIVACY'
    with transaction(principal='admin') as c:assert one(c,'SELECT count(*) AS n FROM forum_posts')['n']==before


def test_cross_centre_revocation_and_feature_flag_apply_to_download(client,monkeypatch):
    login(client)
    key=upload(client).json()['attachment_ids'][0];url='/api/v1/forum/attachments/'+key+'/download'
    login(client,'p5');assert client.get(url).status_code==404
    login(client)
    with transaction(principal='admin') as c:c.execute(text("UPDATE group_assignments SET assignment_status='REVOKED' WHERE id='p3-group-a'"))
    try:
        assert client.get(url).status_code==404
        assert upload(client).status_code==404
    finally:
        with transaction(principal='admin') as c:c.execute(text("UPDATE group_assignments SET assignment_status='ACTIVE' WHERE id='p3-group-a'"))
    import backend.forum as forum
    monkeypatch.setattr(forum,'settings',replace(forum.settings,professional_network=False))
    assert client.get(url).status_code==404 and upload(client).status_code==404


def test_database_forces_scope_and_immutable_attachment_metadata(client):
    login(client);key=upload(client).json()['attachment_ids'][0]
    with transaction('p3','case.read') as c:assert not rows(c,'SELECT id FROM forum_attachments')
    with transaction('p5','forum.read') as c:assert not rows(c,'SELECT id FROM forum_attachments WHERE id=:id',id=key)
    with transaction('p3','forum.read') as c:
        assert one(c,"SELECT relforcerowsecurity FROM pg_class WHERE relname='forum_attachments'")['relforcerowsecurity']
    with pytest.raises(DBAPIError):
        with transaction('p3','forum.write') as c:c.execute(text("UPDATE forum_attachments SET author_id='p2' WHERE id=:id"),{'id':key})


def test_rollback_removes_only_newly_written_files(client,monkeypatch):
    from backend.forum import attachments
    login(client)
    original=attachments.audit
    def fail(c,e,action,*args,**kwargs):
        if action=='forum.attachment.upload':raise ValueError('TEST_ABORT')
        return original(c,e,action,*args,**kwargs)
    monkeypatch.setattr(attachments,'audit',fail)
    folder=settings.private_path/'forum';before=set(folder.glob('*')) if folder.exists() else set()
    assert upload(client).status_code==422
    assert set(folder.glob('*'))==before


def test_upload_and_download_require_session_and_csrf(client):
    assert upload(client).status_code==401
    login(client);key=upload(client).json()['attachment_ids'][0]
    csrf=client.headers.pop('X-Masar-CSRF')
    assert upload(client).status_code==403
    client.headers['X-Masar-CSRF']=csrf
    client.post('/api/v1/auth/logout')
    assert client.get('/api/v1/forum/attachments/'+key+'/download').status_code==401


def test_word_page_numbers_and_manual_links_work_but_external_fields_do_not(client):
    login(client)
    def with_field(instruction):
        raw=docx();buffer=BytesIO()
        with ZipFile(BytesIO(raw)) as original,ZipFile(buffer,'w',ZIP_DEFLATED) as output:
            for filename in original.namelist():
                value=original.read(filename)
                if filename=='word/document.xml':value=value.replace(b'</w:body>',('<w:p><w:fldSimple w:instr="'+instruction+'"><w:r><w:t>1</w:t></w:r></w:fldSimple></w:p></w:body>').encode())
                output.writestr(filename,value)
        return buffer.getvalue()
    assert upload(client,files=[('files',('guide.docx',with_field('PAGE'),DOCX))]).status_code==200
    assert upload(client,files=[('files',('guide.docx',with_field('DDEAUTO command'),DOCX))]).status_code==422


def test_backup_manifest_includes_forum_files_and_integrity(client,monkeypatch):
    import scripts.backup_demo as backup
    login(client);key=upload(client).json()['attachment_ids'][0]
    with transaction(principal='admin') as c:reference=one(c,'SELECT storage_reference FROM forum_attachments WHERE id=:id',id=key)['storage_reference']
    monkeypatch.setattr(backup,'run',lambda *a,**k:SimpleNamespace(stdout=b'isolated-dump-placeholder'))
    with tarfile.open(fileobj=BytesIO(backup.archive()),mode='r:gz') as archive:
        manifest=json.loads(archive.extractfile('manifest.json').read())
        assert manifest['counts']['forum_attachments']>=1
        assert archive.extractfile('private/'+reference).read()==TEXT
        assert manifest['sha256']['private/'+reference]==hashlib.sha256(TEXT).hexdigest()


def test_documents_are_checked_again_after_a_new_identity_is_registered(client):
    login(client)
    name='Fictive'+uuid.uuid4().hex
    result=upload(client,files=[('files',('guide.txt',('Support '+name).encode(),'text/plain'))])
    assert result.status_code==200
    key=result.json()['attachment_ids'][0]
    login(client,'p1')
    created=client.post('/api/v1/cases',json={'name':{'ar':'هوية اصطناعية للاختبار','fr':name},'birthDate':'2013-05-01','gender':'female'})
    assert created.status_code==200,created.text
    login(client)
    response=client.get('/api/v1/forum/attachments/'+key+'/download')
    assert response.status_code==422 and response.json()['detail']['code']=='FORUM_ATTACHMENT_PRIVACY'


def test_revocation_during_document_check_never_streams_the_file(client,monkeypatch):
    from backend.forum import attachments
    login(client);key=upload(client).json()['attachment_ids'][0]
    original=attachments.validate_attachment
    def revoke(c,item):
        result=original(c,item)
        with transaction(principal='admin') as admin:admin.execute(text("UPDATE group_assignments SET assignment_status='REVOKED' WHERE id='p3-group-a'"))
        return result
    monkeypatch.setattr(attachments,'validate_attachment',revoke)
    try:assert client.get('/api/v1/forum/attachments/'+key+'/download').status_code==404
    finally:
        with transaction(principal='admin') as admin:admin.execute(text("UPDATE group_assignments SET assignment_status='ACTIVE' WHERE id='p3-group-a'"))


def test_pdf_annotation_metadata_cannot_hide_known_child_names(client):
    login(client)
    with transaction(principal='admin') as c:name=one(c,"SELECT personal_information->'name'->>'fr' AS name FROM child_identities WHERE child_id=(SELECT child_id FROM cases WHERE id='CDIS-024')")['name']
    writer=PdfWriter();writer.append(BytesIO(pdf()))
    annotation=DictionaryObject({NameObject('/Type'):NameObject('/Annot'),NameObject('/Subtype'):NameObject('/Text'),NameObject('/Rect'):ArrayObject([FloatObject(0),FloatObject(0),FloatObject(20),FloatObject(20)]),NameObject('/Contents'):TextStringObject(name)})
    writer.pages[0][NameObject('/Annots')]=ArrayObject([writer._add_object(annotation)])
    buffer=BytesIO();writer.write(buffer)
    response=upload(client,files=[('files',('guide.pdf',buffer.getvalue(),'application/pdf'))])
    assert response.status_code==422 and response.json()['detail']['code']=='FORUM_ATTACHMENT_PRIVACY'
