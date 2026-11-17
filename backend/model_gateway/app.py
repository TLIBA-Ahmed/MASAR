import asyncio,hmac,json,logging,os,sys,time
from fastapi import FastAPI,Header,HTTPException
from pydantic import BaseModel,ConfigDict,Field
from typing import Literal
from ..config import settings,ROOT
from .providers import manifest,ModelUnavailable
from .integrity import verify
from .prompts import GROUNDING_PROMPT_VERSION
app=FastAPI(title='MASAR private CPU model gateway',docs_url=None,redoc_url=None,openapi_url=None)
inference_log=logging.getLogger('masar.cpu')
inference_log.setLevel(logging.INFO);inference_log.propagate=False
if not inference_log.handlers:inference_log.addHandler(logging.StreamHandler())
gate=asyncio.Semaphore(1)
class Strict(BaseModel):model_config=ConfigDict(extra='forbid')
class Candidate(Strict):
    id:str=Field(max_length=100)
    text:str=Field(max_length=700)
class Score(Strict):
    context:str=Field(max_length=3000)
    candidates:list[Candidate]=Field(min_length=1,max_length=8)
class Generate(Strict):
    task:str=Field(max_length=1000)
    context:str=Field(max_length=6000)
    language:Literal['ar','fr']
    source_ids:list[str]=Field(min_length=1,max_length=8)
    evidence_options:list[dict[str,str]]=Field(default_factory=list,max_length=8)
class Embed(Strict):
    texts:list[str]=Field(min_length=1,max_length=16)
    kind:Literal['query','passage']
def authenticate(key):
    if not settings.gateway_token or not hmac.compare_digest(key or '',settings.gateway_token):raise HTTPException(403,'PRIVATE_SERVICE_ONLY')
async def infer(kind,body,key):
    authenticate(key)
    if kind=='embeddings' and (any(len(t)>4000 for t in body['texts']) or sum(map(len,body['texts']))>20000):raise HTTPException(422,'CONTEXT_TOO_LARGE')
    if kind=='slm' and any(set(o)!={'source_id','text'} or o['source_id'] not in body['source_ids'] or len(o['text'])>300 for o in body['evidence_options']):raise HTTPException(422,'INVALID_EVIDENCE_OPTIONS')
    try:
        await asyncio.to_thread(verify,kind)
        if kind=='slm':await asyncio.to_thread(verify,'llama.cpp')
    except ModelUnavailable as error:raise HTTPException(503,{'code':str(error)}) from None
    try:await asyncio.wait_for(gate.acquire(),timeout=2)
    except TimeoutError:raise HTTPException(429,'CPU_WORKER_BUSY')
    process=None;started=time.perf_counter();outcome='failed';revision=None
    try:
        revision=manifest(kind)[0]['revision']
        # Positive environment allowlist keeps PostgreSQL and session secrets out of inference workers.
        env={k:v for k,v in os.environ.items() if k.upper() in {'PATH','SYSTEMROOT','WINDIR','COMSPEC','PATHEXT','TEMP','TMP','USERPROFILE','LOCALAPPDATA','APPDATA','PROGRAMFILES','PROGRAMFILES(X86)'}}
        env.update(MASAR_MODELS_PATH=str(settings.models_path),MODEL_THREADS=os.getenv('MODEL_THREADS','4'),PYTHONUTF8='1',OMP_NUM_THREADS=os.getenv('MODEL_THREADS','4'))
        process=await asyncio.create_subprocess_exec(sys.executable,'-m','backend.model_gateway.worker',stdin=asyncio.subprocess.PIPE,stdout=asyncio.subprocess.PIPE,stderr=asyncio.subprocess.DEVNULL,cwd=ROOT,env=env)
        out,_=await asyncio.wait_for(process.communicate(json.dumps({'kind':kind,'body':body},ensure_ascii=False).encode()),timeout=120)
        result=json.loads(out)
        if result['status']!='completed':raise HTTPException(503,{'code':'LOCAL_MODEL_UNAVAILABLE','model':kind,'reason':result.get('error_code')})
        if kind=='slm':
            value=result.get('result',{})
            if set(value)!=set(('answer','source_ids')) or not isinstance(value['answer'],str) or len(value['answer'])>1200 or not isinstance(value['source_ids'],list) or not value['source_ids'] or any(s not in body['source_ids'] for s in value['source_ids']):raise HTTPException(503,'INVALID_MODEL_OUTPUT')
            if body['evidence_options'] and not any(value['answer']==o['text'] and value['source_ids']==[o['source_id']] for o in body['evidence_options']):raise HTTPException(503,'UNGROUNDED_MODEL_OUTPUT')
        result['model_revision']=revision
        if kind=='slm':result['prompt_version']=GROUNDING_PROMPT_VERSION
        outcome='completed'
        return result
    except ModelUnavailable as error:raise HTTPException(503,{'code':str(error)}) from None
    except TimeoutError:
        if process:
            import psutil
            try:
                for child in psutil.Process(process.pid).children(recursive=True):child.kill()
                process.kill();await process.wait()
            except psutil.Error:pass
        raise HTTPException(504,'LOCAL_CPU_TIMEOUT')
    finally:
        inference_log.info(json.dumps({'event':'cpu.inference','model':kind,'revision':revision,'prompt_version':GROUNDING_PROMPT_VERSION if kind=='slm' else None,'status':outcome,'elapsed_ms':round((time.perf_counter()-started)*1000)}))
        gate.release()
@app.post('/internal/models/embeddings')
async def embeddings(body:Embed,x_model_key:str|None=Header(default=None)):return await infer('embeddings',body.model_dump(),x_model_key)
@app.post('/internal/models/system-one/score')
async def score(body:Score,x_model_key:str|None=Header(default=None)):return await infer('system-one',body.model_dump(),x_model_key)
@app.post('/internal/models/slm/generate')
async def generate(body:Generate,x_model_key:str|None=Header(default=None)):return await infer('slm',body.model_dump(),x_model_key)
@app.post('/internal/models/reranker/score')
async def rerank(body:Score,x_model_key:str|None=Header(default=None)):
    authenticate(x_model_key);raise HTTPException(503,{'code':'OPTIONAL_RERANKER_DEFERRED'})
@app.get('/internal/models/status')
def status(x_model_key:str|None=Header(default=None)):
    authenticate(x_model_key);models={}
    for key in ['system-one','slm','embeddings','llama.cpp']:
        try:
            entry=verify(key);models[key]={k:entry[k] for k in ['revision','status','runtime','quantization'] if k in entry}
        except ModelUnavailable as error:models[key]={'status':'unavailable','reason':str(error)}
    return {'models':models,'device':'CPU','concurrency':1,'external_fallback':False}
