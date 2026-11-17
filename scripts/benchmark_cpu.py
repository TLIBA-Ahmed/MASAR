"""Measured, synthetic bilingual smoke benchmark, including process-tree RSS."""
import json,os,platform,subprocess,sys,time,statistics,hashlib
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
import psutil
ROOT=Path(__file__).resolve().parents[1];ARTIFACTS=ROOT/'infrastructure/model_artifacts'
TESTS=[]
for lang in ['fr','ar']:
    objective='Expression des émotions et coopération.' if lang=='fr' else 'التعبير عن المشاعر والتعاون.'
    relevant='Dessiner ensemble pour exprimer les émotions.' if lang=='fr' else 'الرسم الجماعي للتعبير عن المشاعر.'
    unrelated='Guide de classement des factures administratives.' if lang=='fr' else 'دليل ترتيب الفواتير الإدارية.'
    TESTS.extend([
      (lang,'embeddings',{'texts':[objective,relevant,unrelated],'kind':'query'}),
      (lang,'system-one',{'context':objective,'candidates':[{'id':'relevant','text':relevant},{'id':'unrelated','text':unrelated}]}),
      (lang,'slm',{'task':'Résumez cette ressource.' if lang=='fr' else 'لخّص هذا المورد.','context':'[guide-1] '+relevant,'language':lang,'source_ids':['guide-1']}),
    ])
def main():
    measurements=[]
    for language,kind,body in TESTS:
        env={k:v for k,v in os.environ.items() if k.upper() in {'PATH','SYSTEMROOT','WINDIR','COMSPEC','PATHEXT','TEMP','TMP','USERPROFILE','LOCALAPPDATA','APPDATA','PROGRAMFILES','PROGRAMFILES(X86)'}}
        env.update(MODEL_THREADS='4',PYTHONUTF8='1',MASAR_MODELS_PATH=str(ARTIFACTS))
        start=time.perf_counter();peak=0
        p=subprocess.Popen([sys.executable,'-m','backend.model_gateway.worker'],stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.DEVNULL,cwd=ROOT,env=env)
        p.stdin.write(json.dumps({'kind':kind,'body':body},ensure_ascii=False).encode());p.stdin.close();p.stdin=None
        pool=ThreadPoolExecutor(1);future=pool.submit(p.communicate)
        process=psutil.Process(p.pid)
        while p.poll() is None:
            try:peak=max(peak,sum(q.memory_info().rss for q in [process]+process.children(recursive=True) if q.is_running()))
            except psutil.Error:pass
            if time.perf_counter()-start>125:
                for child in process.children(recursive=True):child.kill()
                p.kill();break
            time.sleep(.05)
        out,_=future.result(timeout=5);pool.shutdown();raw=out.decode('utf-8');elapsed=round((time.perf_counter()-start)*1000)
        try:result=json.loads(raw)
        except ValueError:result={'status':'failed','error_code':'INVALID_WORKER_OUTPUT'}
        if kind=='embeddings' and result.get('status')=='completed':
            vectors=result.pop('result');result['dimension']=len(vectors[0]);result['norms']=[round(sum(v*v for v in vector)**.5,6) for vector in vectors]
            result['relevant_similarity']=round(sum(a*b for a,b in zip(vectors[0],vectors[1])),5);result['unrelated_similarity']=round(sum(a*b for a,b in zip(vectors[0],vectors[2])),5)
        if kind=='slm' and result.get('status')=='completed':
            result['grounded_exact_excerpt']=result['result']=={'answer':body['context'].split('] ',1)[1],'source_ids':body['source_ids']}
            if not result['grounded_exact_excerpt']:result['status']='ungrounded-output'
        measurement=dict(language=language,model=kind,wall_ms=elapsed,peak_process_tree_rss_mib=round(peak/1048576,1),**result)
        measurements.append(measurement);print(kind,language,result['status'],elapsed,'ms',measurement['peak_process_tree_rss_mib'],'MiB',flush=True)
    report={'measured_at':time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime()),'platform':platform.platform(),'cpu':'Intel Core i5-12500H','logical_threads':psutil.cpu_count(),'physical_cores':psutil.cpu_count(logical=False),'total_ram_gib':round(psutil.virtual_memory().total/1073741824,2),'threads_per_model':4,'concurrency':1,'context_tokens':2048,'method':'Fresh worker per request, local filesystem cache may be warm; includes imports/model load; sampled process-tree RSS every 50 ms. Synthetic prompts, no professional quality certification.','measurements':measurements}
    output=ROOT/'benchmarks';output.mkdir(exist_ok=True);(output/'cpu-results.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
    registry_path=ARTIFACTS/'registry.json';registry=json.loads(registry_path.read_text(encoding='utf-8'))
    for kind in ['system-one','slm','embeddings']:
        selected=[m for m in measurements if m['model']==kind];registry[kind]['status']='tested-cpu' if all(m['status']=='completed' for m in selected) else 'runtime-failed';registry[kind]['benchmark']='benchmarks/cpu-results.json'
    registry['llama.cpp']['status']=registry['slm']['status']
    # Laya's documented tokenizer compatibility normalization is a derived config, not changed weights.
    cfg=ARTIFACTS/'system-one/tokenizer/tokenizer_config.json';entry=registry['system-one']['files']['tokenizer/tokenizer_config.json'];actual=hashlib.sha256(cfg.read_bytes()).hexdigest()
    if actual!=entry['sha256']:entry['runtime_sha256']=actual;entry['transform']='laya 0.3.9 _fix_tokenizer_config: tokenizer class / extra_special_tokens compatibility only'
    registry_path.write_text(json.dumps(registry,ensure_ascii=False,indent=2),encoding='utf-8')
    print('Measured report saved: benchmarks/cpu-results.json',flush=True)
if __name__=='__main__':main()
