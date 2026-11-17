"""Bounded private Forum resources, never a route to a child's private documents."""
import hashlib
import unicodedata
import uuid
from dataclasses import dataclass
from io import BytesIO
from pathlib import PurePosixPath
from urllib.parse import urlsplit
from xml.etree import ElementTree
from zipfile import ZipFile,BadZipFile
from fastapi import HTTPException
from sqlalchemy import text
from ..authorization import AuthorizationService
from ..config import settings
from ..db import one,transaction
from ..documents import private_file
from ..events import audit
from ..privacy import ChildPrivacyService
from . import require_access,require_enabled,create_post,change_post,send_message

MAX_BYTES=8*1024*1024
MAX_FILES=3
FORMATS={'.pdf':'application/pdf','.txt':'text/plain','.docx':'application/vnd.openxmlformats-officedocument.wordprocessingml.document'}

def reject(code='FORUM_ATTACHMENT_INVALID',status=422):
    raise HTTPException(status,detail={'code':code})

@dataclass(frozen=True)
class IncomingAttachment:
    filename:str
    media_type:str
    raw:bytes

def document_text(raw,extension):
    if extension=='.txt':
        value=raw.decode('utf-8-sig')
        if '\x00' in value:reject()
        return value
    if extension=='.pdf':
        from pypdf import PdfReader
        if not raw.startswith(b'%PDF-'):reject()
        reader=PdfReader(BytesIO(raw),strict=True)
        if reader.is_encrypted or not 1<=len(reader.pages)<=200:reject()
        root=reader.trailer['/Root']
        names=root.get('/Names',{})
        if hasattr(names,'get_object'):names=names.get_object()
        opening=root.get('/OpenAction')
        if hasattr(opening,'get_object'):opening=opening.get_object()
        form=root.get('/AcroForm',{})
        if hasattr(form,'get_object'):form=form.get_object()
        if '/AA' in root or '/EmbeddedFiles' in names or '/JavaScript' in names or '/XFA' in form:reject()
        if isinstance(opening,dict) and opening.get('/S') not in (None,'/GoTo'):reject()
        pages=[];metadata=[]
        xmp=root.get('/Metadata')
        if xmp:
            parsed=ElementTree.fromstring(xmp.get_object().get_data())
            metadata.append(' '.join(parsed.itertext()))
        for page in reader.pages:
            if '/AA' in page:reject()
            for annotation in page.get('/Annots',[]):
                item=annotation.get_object()
                if item.get('/Subtype') in ('/FileAttachment','/RichMedia','/Screen','/Movie','/Sound','/3D'):reject()
                action=item.get('/A',{})
                if hasattr(action,'get_object'):action=action.get_object()
                if '/AA' in item or action.get('/S') in ('/JavaScript','/Launch','/SubmitForm','/ImportData'):reject()
                metadata.extend(str(item.get(key,'')) for key in ('/Contents','/T','/Subj'))
                metadata.append(str(action.get('/URI','')))
            pages.append(page.extract_text() or '')
        value='\n'.join(pages)
        if not value.strip():reject('FORUM_ATTACHMENT_TEXT_REQUIRED')
        return value+'\n'+str(reader.metadata or {})+'\n'+str(reader.get_fields() or {})+'\n'+'\n'.join(metadata)
    with ZipFile(BytesIO(raw)) as archive:
        entries=archive.infolist()
        if len(entries)>500 or sum(item.file_size for item in entries)>20*1024*1024:reject()
        if 'word/document.xml' not in archive.namelist() or '[Content_Types].xml' not in archive.namelist():reject()
        values=[]
        for item in entries:
            path=PurePosixPath(item.filename)
            if item.flag_bits&1 or '..' in path.parts or path.is_absolute() or item.filename.lower().endswith('.bin'):reject()
            values.append(item.filename.replace('_',' ').replace('-',' '))
            if not item.filename.endswith(('.xml','.rels')):continue
            xml=ElementTree.fromstring(archive.read(item))
            if item.filename.endswith('.rels'):
                for relation in xml:
                    target=relation.get('Target','')
                    values.append(target)
                    if relation.get('TargetMode')=='External' and (not relation.get('Type','').endswith('/hyperlink') or urlsplit(target).scheme not in ('http','https','mailto')):reject()
            harmless_fields={'PAGE','NUMPAGES','DATE','TIME','CREATEDATE','SAVEDATE','PRINTDATE','TITLE','AUTHOR','TOC','SEQ','PAGEREF','REF','HYPERLINK'}
            for tag in xml.iter():
                if tag.tag.endswith(('}altChunk','}object')):reject()
                instruction=tag.text if tag.tag.endswith('}instrText') else tag.get('{http://schemas.openxmlformats.org/wordprocessingml/2006/main}instr') if tag.tag.endswith('}fldSimple') else None
                if instruction and instruction.strip():
                    values.append(instruction)
                    if instruction.strip().split()[0].upper() not in harmless_fields:reject()
            # Join fragmented runs so a name split by formatting is still checked.
            paragraphs=[p for p in xml.iter() if p.tag.endswith('}p')]
            values.extend(''.join(t.text or '' for t in p.iter() if t.tag.endswith('}t')) for p in paragraphs)
            values.extend(t.text or '' for t in xml.iter() if t.text and not t.tag.endswith('}t'))
        value='\n'.join(values)
        if not value.strip():reject('FORUM_ATTACHMENT_TEXT_REQUIRED')
        return value

def validate_attachment(c,item):
    name=unicodedata.normalize('NFKC',item.filename or '').replace('\\','/').rsplit('/',1)[-1]
    extension=PurePosixPath(name).suffix.lower()
    if extension not in FORMATS or item.media_type not in (FORMATS[extension],'application/octet-stream'):reject('FORUM_ATTACHMENT_FORMAT')
    if not 1<=len(name)<=150 or any(ord(ch)<32 or ord(ch)==127 for ch in name):reject()
    if not item.raw or len(item.raw)>MAX_BYTES:reject('FORUM_ATTACHMENT_SIZE',413)
    try:value=document_text(item.raw,extension)
    except HTTPException:raise
    except (ValueError,UnicodeError,BadZipFile,ElementTree.ParseError,KeyError,TypeError,AttributeError):reject()
    except Exception:reject() # Parser errors are never reflected with document contents.
    if len(value)>20*1024*1024:reject('FORUM_ATTACHMENT_SIZE',413)
    privacy=ChildPrivacyService(c)
    search_name=name.replace('_',' ').replace('-',' ')
    if privacy.text(search_name)!=search_name or privacy.text(value)!=value:reject('FORUM_ATTACHMENT_PRIVACY')
    return name,extension,FORMATS[extension]

def publish(employee,kind,parent_id,body,files):
    if not files or len(files)>MAX_FILES:reject('FORUM_ATTACHMENT_COUNT')
    if sum(len(item.raw) for item in files)>MAX_BYTES:reject('FORUM_ATTACHMENT_SIZE',413)
    written=[]
    try:
        with transaction(employee.employee_id,'forum.write') as c:
            centre=require_access(c,employee,operation='write')
            # Check the target before parsing a file and never accept client-owned parent metadata.
            if kind=='message':
                parent=one(c,'SELECT centre_id FROM forum_conversations WHERE id=:id',id=parent_id)
            elif kind=='comment':
                parent=one(c,'SELECT centre_id FROM forum_posts WHERE id=:id',id=parent_id)
            elif kind=='post':parent={'centre_id':centre}
            else:raise ValueError('Unsupported internal Forum operation')
            if not parent:AuthorizationService(c,employee).deny('forum')
            centre=require_access(c,employee,parent['centre_id'],'write')
            validated=[validate_attachment(c,item) for item in files]
            if kind=='post':result=create_post(c,employee,body,True);entry_id=result['id'];post_id=result['id'];conversation_id=None
            elif kind=='comment':result=change_post(c,employee,parent_id,'comment',body=body,has_attachments=True);entry_id=result['entry_id'];post_id=parent_id;conversation_id=None
            else:result=send_message(c,employee,parent_id,body,True);entry_id=result['entry_id'];post_id=None;conversation_id=parent_id
            folder=settings.private_path/'forum'
            folder.mkdir(parents=True,exist_ok=True)
            ids=[]
            for item,(name,extension,media_type) in zip(files,validated):
                key='FA-'+uuid.uuid4().hex;reference='forum/'+uuid.uuid4().hex+extension
                path=settings.private_path/reference
                with path.open('xb') as handle:handle.write(item.raw)
                written.append(path)
                c.execute(text('''INSERT INTO forum_attachments(id,post_id,conversation_id,entry_id,kind,centre_id,author_id,filename,media_type,byte_size,storage_reference,sha256)
                 VALUES(:id,:post,:conversation,:entry,:kind,:centre,:author,:filename,:media,:size,:ref,:sha)'''),dict(id=key,post=post_id,conversation=conversation_id,entry=entry_id,kind=kind,centre=centre,author=employee.employee_id,filename=name,media=media_type,size=len(item.raw),ref=reference,sha=hashlib.sha256(item.raw).hexdigest()))
                audit(c,employee.employee_id,'forum.attachment.upload','forum_attachment',key,byte_size=len(item.raw),media_type=media_type)
                ids.append(key)
            return {**result,'attachment_ids':ids}
    except BaseException:
        # Only files created by this request are removed on rollback, never user paths.
        for path in written:
            if path.resolve().is_relative_to((settings.private_path/'forum').resolve()):path.unlink(missing_ok=True)
        raise

def download(c,employee,key):
    require_enabled();AuthorizationService(c,employee).require_active_session()
    row=one(c,'SELECT * FROM forum_attachments WHERE id=:id',id=key)
    if not row:AuthorizationService(c,employee).deny('forum_attachment')
    require_access(c,employee,row['centre_id'])
    path=private_file(row['storage_reference'])
    raw=path.read_bytes()
    if hashlib.sha256(raw).hexdigest()!=row['sha256']:reject('FORUM_ATTACHMENT_UNAVAILABLE',409)
    # A formerly safe resource may contain an identity registered since its upload.
    validate_attachment(c,IncomingAttachment(row['filename'],row['media_type'],raw))
    AuthorizationService(c,employee).require_active_session()
    require_access(c,employee,row['centre_id'])
    if not one(c,'SELECT id FROM forum_attachments WHERE id=:id',id=key):AuthorizationService(c,employee).deny('forum_attachment')
    audit(c,employee.employee_id,'forum.attachment.download','forum_attachment',key)
    return path,row['filename'],row['media_type']
