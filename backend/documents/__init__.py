"""Private original storage and provenance, outside all public frontend paths."""
import hashlib,json,uuid
from pathlib import Path
from fastapi import HTTPException
from ..config import settings
from ..db import rows,one
from ..seed import insert
from ..authorization import AuthorizationService
from ..events import audit,publish
from ..case_management import uid,bi

def private_file(reference):
    root=settings.private_path.resolve();path=(root/reference).resolve()
    if not path.is_relative_to(root) or not path.is_file():raise HTTPException(404,detail={'code':'ORIGINAL_UNAVAILABLE'})
    return path


def pseudonymous_source(c,source):
    """A readable derived view; original bytes/checksum remain private and immutable."""
    from ..privacy import ChildPrivacyService
    from ..retrieval import plain
    raw=private_file(source['storage_reference']).read_bytes()
    if source['content_type']=='application/pdf':
        from pypdf import PdfReader
        from io import BytesIO
        value='\n'.join(p.extract_text() or '' for p in PdfReader(BytesIO(raw)).pages)
    elif source['content_type']=='application/json':
        value=plain(ChildPrivacyService(c).project(json.loads(raw)))
    else:value=raw.decode('utf-8')
    return ChildPrivacyService(c).text(value)

def register_upload(c,e,case_id,category,title,language,raw,content_type):
    policy=AuthorizationService(c,e);policy.require_case(case_id,category,'write')
    if content_type not in ('application/pdf','text/plain') or len(raw)>8*1024*1024 or not raw:raise HTTPException(422,detail={'code':'UNSUPPORTED_DOCUMENT'})
    if content_type=='application/pdf' and not raw.startswith(b'%PDF-'):raise HTTPException(422,detail={'code':'INVALID_PDF'})
    if content_type=='text/plain':raw.decode('utf-8',errors='strict')
    did=uid('DOC');vid=uid('VER');reference=uuid.uuid4().hex+('.pdf' if content_type=='application/pdf' else '.txt')
    settings.private_path.mkdir(parents=True,exist_ok=True);(settings.private_path/reference).write_bytes(raw);sha=hashlib.sha256(raw).hexdigest()
    centre=one(c,'SELECT centre_id FROM cases WHERE id=:id',id=case_id)['centre_id']
    insert(c,'documents',{'id':did,'case_id':case_id,'centre_id':centre,'category':category,'sensitivity':3 if category=='psychological' else 1,'title':bi(title,title),'approval_status':'DRAFT','created_by':e.employee_id,'language':language})
    insert(c,'document_versions',{'id':vid,'document_id':did,'case_id':case_id,'version':1,'language':language,'status':'draft','author_id':e.employee_id,'payload':{'title':title},'storage_reference':reference,'sha256':sha})
    insert(c,'protected_originals',{'version_id':vid,'storage_reference':reference,'sha256':sha,'content_type':content_type})
    audit(c,e.employee_id,'document.upload','document',did)
    return {'document_id':did,'version_id':vid,'status':'draft'}

def approve(c,e,version_id,reason):
    policy=AuthorizationService(c,e)
    version=one(c,'SELECT * FROM document_versions WHERE id=:id',id=version_id)
    if not version or not policy.can_access_document(version['document_id'],'write'):policy.deny('document')
    if version['status']!='draft':raise HTTPException(409,detail={'code':'IMMUTABLE_VERSION'})
    from sqlalchemy import text
    c.execute(text("UPDATE document_versions SET status='validated',payload=payload||jsonb_build_object('approvalReason',CAST(:reason AS text)) WHERE id=:id"),{'id':version_id,'reason':reason})
    c.execute(text('SELECT authz.mark_document_approved(:id)'),{'id':version['document_id']})
    publish(c,e.employee_id,'DOCUMENT_VERSION_CREATED',version_id,version['version']);audit(c,e.employee_id,'document.approve','document_version',version_id)
    return {'version_id':version_id,'status':'validated'}
