"""Local operational metadata only; no case contents, identities or credentials."""
import json,sys,os
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
import httpx
from backend.ai_client import gateway,LocalModelError
from backend.db import transaction,one
def main():
    report={}
    try:
        response=httpx.get(f"http://127.0.0.1:{int(os.getenv('MASAR_API_PORT','8000'))}/api/v1/health",timeout=5,trust_env=False);report['api']=response.json()
    except httpx.HTTPError:report['api']={'status':'unavailable'}
    try:report['cpu_gateway']=gateway.request('/internal/models/status')
    except LocalModelError:report['cpu_gateway']={'status':'unavailable'}
    try:
        with transaction() as c:role=one(c,'SELECT current_user AS principal,rolsuper,rolbypassrls FROM pg_roles WHERE rolname=current_user');report['database']={'status':'reachable','restricted_app_role':not(role['rolsuper'] or role['rolbypassrls'])}
    except Exception:report['database']={'status':'unavailable'}
    print(json.dumps(report,indent=2,ensure_ascii=False))
if __name__=='__main__':main()
