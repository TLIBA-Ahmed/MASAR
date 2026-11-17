"""Local synthetic API measurements; no feedback, planning or protected text in reports."""
import json,sys,time
from pathlib import Path
import httpx
ROOT=Path(__file__).resolve().parents[1]
def main():
    measurements=[]
    with httpx.Client(base_url='http://127.0.0.1:8000/api/v1',timeout=150,trust_env=False) as client:
        client.headers['X-Masar-CSRF']=client.get('/bootstrap').json()['csrf_token']
        login=client.post('/auth/demo/login',json={'employee_id':'p3'});login.raise_for_status()
        client.headers['X-Masar-CSRF']=login.json()['csrf_token']
        status=client.get('/ai/status').json()
        if status['mode']!='local':raise RuntimeError('LOCAL_MODE_REQUIRED')
        data=client.get('/workspace').json()
        case=next(c for c in data['cases'] if c['id']=='CDIS-024')
        goal_ids=[g['id'] for g in case['goals'] if g['confirmed']]
        materials=sorted({m for a in data['activities'] for m in a['materials']})
        for language,question in [('fr','Quelles ressources aident la communication et la coopération ?'),('ar','ما الموارد التي تساعد على التواصل والتعاون؟')]:
            for pipeline,path,body in [
                ('rag','/browser/ask',{'question':question,'language':language}),
                ('recommendation','/recommendations/generate',{'caseId':'CDIS-024','contextId':'workshops','language':language,'goalIds':goal_ids,'constraints':{'maxDuration':120,'format':'group','participants':6,'materials':materials}}),
            ]:
                started=time.perf_counter();result=client.post(path,json=body);elapsed=round((time.perf_counter()-started)*1000)
                value=result.json()
                record={'pipeline':pipeline,'language':language,'wall_ms':elapsed,'http_status':result.status_code,'status':value.get('status'),'source_count':len(value.get('sources',[])),'candidate_count':len(value.get('recommendations',[])),'limitations':value.get('limitations',[])}
                measurements.append(record);print(json.dumps(record,ensure_ascii=False),flush=True)
        client.post('/auth/logout',json={}).raise_for_status()
    report={'measured_at':time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime()),'cpu_only':True,'mode':'local','method':'One serial synthetic request per language and pipeline, including API, retrieval, CPU worker startup/loading and output validation. No clinical quality certification.','measurements':measurements}
    (ROOT/'benchmarks/pipeline-results.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
    if any(m['http_status']!=200 or m['status']!='completed' for m in measurements):raise RuntimeError('PIPELINE_SMOKE_FAILED')
if __name__=='__main__':main()
