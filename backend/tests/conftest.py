"""Tests use a new database, never reset the demonstration database."""
import os,uuid
from pathlib import Path
import pytest,psycopg
from psycopg import sql

for line in (Path(__file__).resolve().parents[2]/'.env').read_text(encoding='utf-8-sig').splitlines():
    if '=' in line and not line.startswith('#'):
        key,value=line.split('=',1);os.environ.setdefault(key,value)
_database='masar_test_'+uuid.uuid4().hex[:12]
os.environ['POSTGRES_DB']=_database
os.environ['AI_MODE']='demo'
_private=Path(__file__).resolve().parents[2]/'.tmp'/('masar-test-private-'+uuid.uuid4().hex)
os.environ['MASAR_PRIVATE_PATH']=str(_private)
_credentials=dict(host=os.environ['POSTGRES_HOST'],port=os.environ['POSTGRES_PORT'],user=os.environ['POSTGRES_USER'],password=os.environ['POSTGRES_PASSWORD'],dbname='postgres',autocommit=True)
with psycopg.connect(**_credentials) as c:
    c.execute(sql.SQL('CREATE DATABASE {}').format(sql.Identifier(_database)))
from backend.bootstrap import bootstrap
bootstrap()

@pytest.fixture(scope='session',autouse=True)
def isolated_database():
    yield
    from backend.db import engine
    for principal in ('app','worker','admin'):engine(principal).dispose()
    assert _database.startswith('masar_test_') and len(_database)==23
    with psycopg.connect(**_credentials) as c:
        c.execute(sql.SQL('DROP DATABASE {} WITH (FORCE)').format(sql.Identifier(_database)))
    if _private.exists():
        import shutil
        assert _private.resolve().is_relative_to((Path(__file__).resolve().parents[2]/'.tmp').resolve()) and _private.name.startswith('masar-test-private-')
        shutil.rmtree(_private)

@pytest.fixture
def client():
    from fastapi.testclient import TestClient
    from backend.api.app import app
    with TestClient(app) as c:
        csrf=c.get('/api/v1/bootstrap').json()['csrf_token'];c.headers['X-Masar-CSRF']=csrf
        yield c

def login(client,employee='p3'):
    response=client.post('/api/v1/auth/demo/login',json={'employee_id':employee})
    assert response.status_code==200,response.text
    client.headers['X-Masar-CSRF']=response.json()['csrf_token']
    return client
