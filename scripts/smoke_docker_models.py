import subprocess,json
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
program=r'''
import httpx,os,time,json
client=httpx.Client(base_url='http://127.0.0.1:8001',headers={'X-Model-Key':os.environ['MODEL_GATEWAY_TOKEN']},timeout=125,trust_env=False)
results=[]
for language,text in [('fr','Communication et coopération.'),('ar','التواصل والتعاون.')]:
 for kind,path,body in [
  ('embeddings','embeddings',{'texts':[text],'kind':'query'}),
  ('system-one','system-one/score',{'context':text,'candidates':[{'id':'guide','text':text+' Activité éducative / نشاط تربوي'}]}),
  ('slm','slm/generate',{'task':'Résumez cette source.' if language=='fr' else 'لخّص هذا المصدر.','context':'[S1] '+text,'language':language,'source_ids':['S1']})]:
  start=time.monotonic();r=client.post('/internal/models/'+path,json=body);value=r.json()
  record={'model':kind,'language':language,'http_status':r.status_code,'elapsed_ms':round((time.monotonic()-start)*1000)}
  if r.status_code==200:
   record['status']=value['status']
   if kind=='embeddings':record['dimension']=len(value['result'][0])
   if kind=='slm':record['cites_only_supplied_sources']=value['result']['source_ids']==['S1'];record['answer']=value['result']['answer'];record['grounded_exact_excerpt']=value['result']['answer']==text
  else:record['error']=value
  results.append(record);print(json.dumps(record,ensure_ascii=False),flush=True)
print('REPORT='+json.dumps({'platform':'Docker Linux / Python 3.13','cpu_only':True,'generation_mode':'grounded-extractive-v2','measurements':results},ensure_ascii=False))
'''
result=subprocess.run(['docker','compose','--profile','fullstack','exec','-T','model-gateway','python','-'],input=program.encode('utf-8'),stdout=subprocess.PIPE,stderr=subprocess.PIPE,check=True,cwd=ROOT)
text=result.stdout.decode('utf-8');print(text,flush=True)
report=json.loads(text.split('REPORT=',1)[1]);(ROOT/'benchmarks/docker-cpu-smoke.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
if any(r['http_status']!=200 or r.get('status')!='completed' or r.get('grounded_exact_excerpt',True) is not True for r in report['measurements']):raise RuntimeError('DOCKER_CPU_SMOKE_FAILED')
