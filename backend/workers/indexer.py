"""Idempotent transactional-outbox consumer. Derived indexes never grant access."""
import argparse,hashlib,json,time,uuid
from datetime import datetime,timezone,timedelta
from sqlalchemy import text
from ..db import transaction,one,rows
from ..config import settings
from ..documents import private_file
from ..retrieval import plain,normalize
from ..seed import insert
from ..ai_client import gateway,LocalModelError
from ..privacy import ChildPrivacyService

def chunks(text,max_chars=1100):
    # Paragraph/sentence boundaries, bounded multilingual chunks, no narrative rewriting.
    output=[];current=''
    for paragraph in text.splitlines():
        while len(paragraph)>max_chars:
            output.append(paragraph[:max_chars]);paragraph=paragraph[max_chars:]
        if len(current)+len(paragraph)>max_chars:
            if current.strip():output.append(current.strip())
            current=''
        current+='\n'+paragraph
    if current.strip():output.append(current.strip())
    return output

def source(c,event):
    key=event['aggregate_id']
    if event['event_type']=='KNOWLEDGE_UPDATED':
        k=one(c,'SELECT * FROM knowledge_items WHERE id=:id',id=key)
        if not k or k['approval_status'] not in ('APPROVED','DEMO_APPROVED'):return []
        return ChildPrivacyService(c).project([dict(knowledge_id=k['id'],document_id=None,document_version_id=None,case_id=None,centre_id=k['centre_id'],category=k['category'],sensitivity=1,language=lang,source_version=k['version'],page_number=None,section_title='Catalogue synthétique / مكتبة تجريبية',chunk_text=plain({field:(value.get(lang,'') if isinstance(value,dict) and lang in value else value) for field,value in k['payload'].items() if field in ['title','description','content','instructions','skills','materials','conditions','source']}),access_policy_reference='knowledge:'+k['id']) for lang in ['ar','fr']])
    if event['event_type']!='DOCUMENT_VERSION_CREATED':return []
    version=one(c,'SELECT v.*,d.category,d.sensitivity,d.centre_id FROM document_versions v JOIN documents d ON d.id=v.document_id WHERE v.id=:id',id=key)
    if not version or version['status'] not in ('completed','validated','APPROVED'):return []
    original=one(c,'SELECT * FROM protected_originals WHERE version_id=:id',id=key)
    if not original:
        raw=json.dumps(version['payload'],ensure_ascii=False,sort_keys=True).encode();reference=version['storage_reference'] or uuid.uuid4().hex+'.json'
        settings.private_path.mkdir(parents=True,exist_ok=True);path=settings.private_path/reference
        if not path.exists():path.write_bytes(raw)
        raw=path.read_bytes();insert(c,'protected_originals',{'version_id':key,'storage_reference':reference,'sha256':hashlib.sha256(raw).hexdigest(),'content_type':'application/json'})
        original=one(c,'SELECT * FROM protected_originals WHERE version_id=:id',id=key)
    path=private_file(original['storage_reference']);raw=path.read_bytes()
    if hashlib.sha256(raw).hexdigest()!=original['sha256']:raise ValueError('ORIGINAL_CHECKSUM_MISMATCH')
    if original['content_type']=='application/pdf':
        from pypdf import PdfReader
        from io import BytesIO
        pages=[(n+1,p.extract_text() or '') for n,p in enumerate(PdfReader(BytesIO(raw)).pages)]
    elif original['content_type']=='application/json':pages=[(None,plain(ChildPrivacyService(c).project(json.loads(raw))))]
    else:pages=[(None,raw.decode('utf-8'))]
    if original['content_type']!='application/json':pages=ChildPrivacyService(c).project(pages)
    return [dict(document_id=version['document_id'],document_version_id=key,knowledge_id=None,case_id=version['case_id'],centre_id=version['centre_id'],category=version['category'],sensitivity=version['sensitivity'],language=version['language'],source_version=version['version'],page_number=page,section_title=version['form_id'] or 'Document',chunk_text=part,access_policy_reference='document:'+version['document_id']) for page,content in pages for part in chunks(content)]

def process_one():
    with transaction(principal='worker') as c:
        item=one(c,'SELECT * FROM outbox_events WHERE processed_at IS NULL AND attempts<5 AND next_attempt_at<=now() ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT 1')
        if not item:return False
        savepoint=c.begin_nested()
        try:
            passages=source(c,item) # Already pseudonymized once, before chunking or model calls.
            vectors=[]
            if passages and settings.ai_mode=='local':
                for start in range(0,len(passages),8):vectors.extend(gateway.embeddings([p['chunk_text'] for p in passages[start:start+8]],'passage'))
            for n,p in enumerate(passages):
                key=hashlib.sha256(f"{p.get('document_version_id') or p['knowledge_id']}:{p['source_version']}:{p['language']}:{n}".encode()).hexdigest()
                values=dict(id=key,**p,normalized_text=normalize(p['chunk_text']),chunk_order=n)
                if vectors:values.update(embedding=json.dumps(vectors[n]),embedding_model_version='multilingual-e5-small@614241f6')
                cols=','.join(values);binds=','.join(f'CAST(:{k} AS vector)' if k=='embedding' else ':'+k for k in values)
                c.execute(text(f'INSERT INTO document_chunks({cols}) VALUES({binds}) ON CONFLICT(id) DO UPDATE SET chunk_text=EXCLUDED.chunk_text,normalized_text=EXCLUDED.normalized_text,embedding=EXCLUDED.embedding,embedding_model_version=EXCLUDED.embedding_model_version'),values)
            c.execute(text('UPDATE outbox_events SET processed_at=now(),last_error_code=NULL,attempts=attempts+1 WHERE id=:id'),{'id':item['id']})
            savepoint.commit()
        except Exception:
            savepoint.rollback()
            c.execute(text("UPDATE outbox_events SET attempts=attempts+1,last_error_code=CASE WHEN attempts>=4 THEN 'INDEXING_FAILED_REVIEW' ELSE 'INDEXING_RETRY_REQUIRED' END,next_attempt_at=now()+interval '30 seconds' WHERE id=:id"),{'id':item['id']})
    return True
def main():
    parser=argparse.ArgumentParser();parser.add_argument('--once',action='store_true');args=parser.parse_args();count=0
    while True:
        processed=process_one()
        if processed:count+=1
        elif args.once:break
        else:time.sleep(2)
    print(f'Outbox consumed: {count} events; source records preserved.')
if __name__=='__main__':main()
