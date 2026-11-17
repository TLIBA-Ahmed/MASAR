"""Encrypted local PostgreSQL + referenced originals backup and isolated restore drill."""
import argparse,base64,getpass,hashlib,io,json,os,secrets,subprocess,sys,tarfile,time,uuid
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1];sys.path.insert(0,str(ROOT))
from backend.config import settings
from backend.db import engine,rows,one
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
from cryptography.hazmat.primitives import hashes
import psycopg
from psycopg import sql
def derive(password,salt):return PBKDF2HMAC(algorithm=hashes.SHA256(),length=32,salt=salt,iterations=600000).derive(password.encode())
def run(command,**kwargs):return subprocess.run(command,check=True,capture_output=True,**kwargs)
def archive():
    dump=run(['docker','compose','exec','-T','db','pg_dump','-U',os.getenv('POSTGRES_USER','masar_migrator'),'-d',settings.db_name,'-Fc']).stdout
    entries={'database.dump':dump}
    with engine('admin').connect() as c:
        sources=rows(c,'SELECT storage_reference,sha256 FROM protected_originals UNION SELECT storage_reference,sha256 FROM document_versions WHERE storage_reference IS NOT NULL')
        counts={t:one(c,f'SELECT count(*) AS n FROM {t}')['n'] for t in ['cases','children','form_definitions','document_versions','roadmap_versions']}
        if one(c,"SELECT to_regclass('public.forum_attachments') AS name")['name']:
            sources+=rows(c,'SELECT storage_reference,sha256 FROM forum_attachments')
            counts['forum_attachments']=one(c,'SELECT count(*) AS n FROM forum_attachments')['n']
    for source in sources:
        p=(settings.private_path/source['storage_reference']).resolve()
        if not p.is_relative_to(settings.private_path.resolve()):raise ValueError('INVALID_PRIVATE_PATH')
        raw=p.read_bytes()
        if source['sha256'] and hashlib.sha256(raw).hexdigest()!=source['sha256']:raise ValueError('ORIGINAL_CHECKSUM_MISMATCH')
        entries['private/'+source['storage_reference']]=raw
    metadata={'schema':'masar-backup-v1','counts':counts,'sha256':{k:hashlib.sha256(v).hexdigest() for k,v in entries.items()}}
    entries['manifest.json']=json.dumps(metadata).encode();buffer=io.BytesIO()
    with tarfile.open(fileobj=buffer,mode='w:gz') as tar:
        for name,raw in entries.items():
            info=tarfile.TarInfo(name);info.size=len(raw);tar.addfile(info,io.BytesIO(raw))
    return buffer.getvalue()
def restore_drill(payload):
    with tarfile.open(fileobj=io.BytesIO(payload),mode='r:gz') as tar:
        entries={m.name:tar.extractfile(m).read() for m in tar.getmembers() if m.isfile()}
    metadata=json.loads(entries['manifest.json'])
    if any(hashlib.sha256(entries[k]).hexdigest()!=v for k,v in metadata['sha256'].items()):raise ValueError('BACKUP_CHECKSUM_MISMATCH')
    database='masar_restore_test_'+uuid.uuid4().hex[:12]
    credentials=dict(host=os.environ['POSTGRES_HOST'],port=os.environ['POSTGRES_PORT'],user=os.environ['POSTGRES_USER'],password=os.environ['POSTGRES_PASSWORD'],dbname='postgres',autocommit=True)
    with psycopg.connect(**credentials) as c:c.execute(sql.SQL('CREATE DATABASE {}').format(sql.Identifier(database)))
    try:
        run(['docker','compose','exec','-T','db','pg_restore','-U',os.environ['POSTGRES_USER'],'-d',database,'--exit-on-error'],input=entries['database.dump'])
        with psycopg.connect(**{**credentials,'dbname':database}) as c:
            for table,expected in metadata['counts'].items():
                if table not in ['cases','children','form_definitions','document_versions','roadmap_versions','forum_attachments']:raise ValueError('INVALID_MANIFEST_TABLE')
                actual=c.execute(sql.SQL('SELECT count(*) FROM {}').format(sql.Identifier(table))).fetchone()[0]
                if actual!=expected:raise ValueError('RESTORE_COUNT_MISMATCH')
        return {'status':'passed','tables_checked':list(metadata['counts']),'private_files_checked':sum(k.startswith('private/') for k in entries),'source_database_unchanged':True}
    finally:
        assert database.startswith('masar_restore_test_') and len(database)==31
        with psycopg.connect(**credentials) as c:c.execute(sql.SQL('DROP DATABASE {} WITH (FORCE)').format(sql.Identifier(database)))
def main():
    p=argparse.ArgumentParser();p.add_argument('--restore-test',action='store_true');args=p.parse_args()
    password=os.getenv('MASAR_BACKUP_PASSPHRASE') or getpass.getpass('Local backup passphrase (not stored): ')
    if len(password)<16:raise ValueError('Use at least 16 characters for the backup passphrase')
    payload=archive();salt=secrets.token_bytes(16);nonce=secrets.token_bytes(12);encrypted=b'MASAR1'+salt+nonce+AESGCM(derive(password,salt)).encrypt(nonce,payload,b'MASAR1')
    target=ROOT/'.local-data/backups';target.mkdir(parents=True,exist_ok=True);file=target/(time.strftime('%Y%m%d-%H%M%S')+'.masar.enc');file.write_bytes(encrypted)
    if args.restore_test:
        restored=AESGCM(derive(password,encrypted[6:22])).decrypt(encrypted[22:34],encrypted[34:],b'MASAR1');report=restore_drill(restored)
        output=ROOT/'benchmarks/restore-drill.json';output.write_text(json.dumps(report,indent=2),encoding='utf-8');print('Encrypted backup and isolated PostgreSQL restore drill passed.')
    else:print('Encrypted local backup created; keep its passphrase separately.')
if __name__=='__main__':main()
