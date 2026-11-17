import gc,json,os,re,subprocess,math
from pathlib import Path
from abc import ABC,abstractmethod
from .prompts import grounded_system_prompt

ROOT=Path(__file__).resolve().parents[2]
ARTIFACTS=Path(os.getenv('MASAR_MODELS_PATH',ROOT/'infrastructure/model_artifacts'))

class ModelUnavailable(RuntimeError):pass
def manifest(model):
    registry=ARTIFACTS/'registry.json'
    if not registry.exists():raise ModelUnavailable('MODEL_NOT_INSTALLED')
    entry=json.loads(registry.read_text(encoding='utf-8')).get(model)
    if not entry or entry.get('status')=='disabled':raise ModelUnavailable('MODEL_DISABLED_OR_MISSING')
    return entry,ARTIFACTS/entry['path']

class EmbeddingProvider(ABC):
    dimension=384
    @abstractmethod
    def encode(self,texts,kind):...
    def encode_query(self,text):return self.encode([text],'query')[0]
    def encode_passage(self,text):return self.encode([text],'passage')[0]

class LocalEmbeddingProvider(EmbeddingProvider):
    def __init__(self):
        import onnxruntime as ort
        from tokenizers import Tokenizer
        self.entry,path=manifest('embeddings')
        options=ort.SessionOptions();options.intra_op_num_threads=int(os.getenv('MODEL_THREADS','4'));options.inter_op_num_threads=1
        # CPUExecutionProvider only. The model's AVX512 VNNI export remains an INT8 graph;
        # ONNX Runtime may use alternative supported CPU kernels on this i5.
        self.session=ort.InferenceSession(str(path/'onnx/model_qint8_avx512_vnni.onnx'),sess_options=options,providers=['CPUExecutionProvider'])
        self.tokenizer=Tokenizer.from_file(str(path/'onnx/tokenizer.json'));self.tokenizer.enable_truncation(max_length=384);self.tokenizer.enable_padding()
    def encode(self,texts,kind):
        import numpy as np
        encoded=self.tokenizer.encode_batch([('query: ' if kind=='query' else 'passage: ')+t for t in texts])
        ids=np.array([e.ids for e in encoded],dtype=np.int64);mask=np.array([e.attention_mask for e in encoded],dtype=np.int64)
        available={x.name for x in self.session.get_inputs()};inputs={'input_ids':ids,'attention_mask':mask}
        if 'token_type_ids' in available:inputs['token_type_ids']=np.zeros_like(ids)
        result=self.session.run(None,inputs)[0]
        if result.ndim==3:result=(result*mask[:,:,None]).sum(1)/np.maximum(mask.sum(1,keepdims=True),1)
        result=result/np.maximum(np.linalg.norm(result,axis=1,keepdims=True),1e-12)
        if result.shape!=(len(texts),384) or not np.isfinite(result).all():raise ValueError('INVALID_EMBEDDING')
        return result.tolist()

class SystemOneProvider(ABC):
    @abstractmethod
    def score_candidates(self,context,candidates):...
    @abstractmethod
    def route_query(self,query,allowed_routes):...
    @abstractmethod
    def assess_evidence(self,query,evidence):...

class LocalSystemOneProvider(SystemOneProvider):
    def __init__(self):
        import torch,laya
        torch.set_num_threads(int(os.getenv('MODEL_THREADS','4')));torch.set_num_interop_threads(1)
        self.entry,path=manifest('system-one')
        self.agent=laya.Agent(str(path),device='cpu',fast=False)
    def score_candidates(self,context,candidates):
        questions={item['id']:{'type':'score','instructions':'Rate only the relevance of this educational resource to the professionally validated objectives. Never evaluate or classify a child. Resource: '+item['text'],'criteria':['unrelated','weak match','partial match','relevant','direct match']} for item in candidates}
        result=self.agent.system_one(context,questions)
        scores=[]
        for item in candidates:
            answer=result['answers'][item['id']]
            value=answer.get('value',answer.get('score'))
            # Laya returns the expected ordinal level 0..4 for these five criteria.
            if not isinstance(value,(int,float)) or not math.isfinite(value):raise ValueError('INVALID_SYSTEM_ONE_SCORE')
            scores.append({'id':item['id'],'score':max(0,min(100,float(value)*25)),'uncalibrated':True})
        return scores
    def route_query(self,query,allowed_routes):
        result=self.agent.system_one(query,{'route':{'type':'choice','instructions':'Choose the retrieval route for this question, not a decision about a person.','criteria':{r:r for r in allowed_routes}}})
        return result['answers']['route']
    def assess_evidence(self,query,evidence):
        return self.agent.system_one({'query':query,'evidence':evidence},{'sufficient':{'type':'noul','instructions':'Do these reference excerpts explicitly support answering the question?','criteria':{'true':'Directly supported by these references','false':'Evidence is insufficient'}}})['answers']['sufficient']

class SLMProvider(ABC):
    @abstractmethod
    def generate(self,task,context,language,source_ids,evidence_options=None):...

class LocalSLMProvider(SLMProvider):
    def generate(self,task,context,language,source_ids,evidence_options=None):
        entry,path=manifest('slm');runtime,runtime_path=manifest('llama.cpp')
        executables=list(runtime_path.rglob('llama-completion.exe')) if os.name=='nt' else list(runtime_path.rglob('llama-completion'))
        if os.name!='nt' and Path('/usr/local/bin/llama-completion').is_file():executables=[Path('/usr/local/bin/llama-completion')]
        if not executables:raise ModelUnavailable('LLAMA_CPP_EXECUTABLE_MISSING')
        system=grounded_system_prompt(language)
        options=evidence_options or [{'source_id':source_ids[min(i,len(source_ids)-1)],'text':re.sub(r'^\[[^]]+\]\s*','',line).strip()[:220]} for i,line in enumerate(context.splitlines()) if line.strip()][:8]
        options=[o for o in options if o['source_id'] in source_ids and o['text'].strip()]
        if not options:raise ValueError('NO_GROUNDED_OUTPUT_OPTIONS')
        user=json.dumps({'task':task[:300],'context':context[:400],'verified_excerpts':options},ensure_ascii=False)
        # Constrained extractive generation: the small model cannot invent a factual clause.
        schema=json.dumps({'oneOf':[{'type':'object','properties':{'answer':{'const':o['text']},'source_ids':{'type':'array','items':{'const':o['source_id']},'minItems':1,'maxItems':1}},'required':['answer','source_ids'],'additionalProperties':False} for o in options]})
        prompt=f'<|im_start|>system\n{system}<|im_end|>\n<|im_start|>user\n{user}<|im_end|>\n<|im_start|>assistant\n<think>\n\n</think>\n'
        command=[str(executables[0]),'-m',str(path/'Qwen3-0.6B-Q4_K_M.gguf'),'-p',prompt,'-t',os.getenv('MODEL_THREADS','4'),'-c','2048','-n','256','-ngl','0','--temp','0','--seed','42','--no-display-prompt','--simple-io','--no-warmup','--no-conversation','--json-schema',schema]
        result=subprocess.run(command,capture_output=True,text=True,encoding='utf-8',errors='replace',timeout=100,creationflags=subprocess.CREATE_NO_WINDOW if os.name=='nt' else 0)
        if result.returncode:raise ModelUnavailable('LLAMA_CPP_INFERENCE_FAILED')
        self.last_metrics={}
        for label,key in [('load time','model_load_ms'),('prompt eval time','prompt_eval_ms'),('eval time','generation_ms')]:
            match=re.search(r':\s+'+label+r'\s*=\s*([\d.]+) ms',result.stderr)
            if match:self.last_metrics[key]=float(match.group(1))
        throughput=re.search(r':\s+eval time\s*=[^\r\n]*?([\d.]+) tokens per second',result.stderr)
        if throughput:self.last_metrics['generation_tokens_per_second']=float(throughput.group(1))
        output=re.sub(r'<think>.*?</think>','',result.stdout,flags=re.S)
        decoder=json.JSONDecoder()
        for match in re.finditer(r'\{',output):
            try:
                value,_=decoder.raw_decode(output[match.start():])
                if isinstance(value,dict) and set(value)=={'answer','source_ids'}:
                    if not any(value['answer']==o['text'] and value['source_ids']==[o['source_id']] for o in options):raise ValueError('UNGROUNDED_MODEL_OUTPUT')
                    return value
            except json.JSONDecodeError:continue
        raise ValueError('INVALID_SLM_JSON')

class RerankerProvider:
    """Optional reranker intentionally disabled on the measured RAM budget."""
    def score(self,*args):raise ModelUnavailable('OPTIONAL_RERANKER_DEFERRED')
