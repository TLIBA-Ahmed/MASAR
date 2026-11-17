"""One short-lived CPU process per inference; no credentials, DB or network clients."""
import json,sys,os,time,contextlib
def main():
    os.environ.update(HF_HUB_OFFLINE='1',TRANSFORMERS_OFFLINE='1',TOKENIZERS_PARALLELISM='false',CUDA_VISIBLE_DEVICES='',HF_HUB_DISABLE_TELEMETRY='1')
    from pathlib import Path
    os.environ['USER']='masar-cpu'
    os.environ['TORCHINDUCTOR_CACHE_DIR']=str(Path(__file__).resolve().parents[2]/'.cache/torchinductor')
    request=json.loads(sys.stdin.read(131072));started=time.perf_counter()
    try:
        with contextlib.redirect_stdout(sys.stderr):
            from .providers import LocalEmbeddingProvider,LocalSystemOneProvider,LocalSLMProvider,RerankerProvider
            kind=request['kind'];body=request['body']
            load_started=time.perf_counter()
            provider={'embeddings':LocalEmbeddingProvider,'system-one':LocalSystemOneProvider,'slm':LocalSLMProvider}.get(kind,RerankerProvider)()
            initialized=time.perf_counter()
            if kind=='embeddings':result=provider.encode(body['texts'],body['kind'])
            elif kind=='system-one':result=provider.score_candidates(body['context'],body['candidates'])
            elif kind=='slm':result=provider.generate(**body)
            else:result=provider.score(body)
        timings={'provider_init_ms':round((initialized-load_started)*1000),'inference_call_ms':round((time.perf_counter()-initialized)*1000),**getattr(provider,'last_metrics',{})}
        response={'status':'completed','result':result,'elapsed_ms':round((time.perf_counter()-started)*1000),'timings':timings}
    except Exception as exc:
        response={'status':'unavailable','error_code':str(exc) if str(exc).isupper() and len(str(exc))<80 else type(exc).__name__,'elapsed_ms':round((time.perf_counter()-started)*1000)}
    sys.stdout.write(json.dumps(response,ensure_ascii=False));sys.stdout.flush()
if __name__=='__main__':main()
