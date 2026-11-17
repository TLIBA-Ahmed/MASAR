"""Explicit, public-artifact installation. Never reads or transmits business data."""
import hashlib,json,os,sys,time,zipfile
from pathlib import Path
import requests
ROOT=Path(__file__).resolve().parents[1]
TARGET=ROOT/'infrastructure/model_artifacts'
MODELS={
 'system-one':dict(repo='convaiinnovations/laya-multilingual',revision='92d22143468d8af669dc1a5a0480a2b21b4fe56e',licence='Apache-2.0',runtime='pytorch-cpu',quantization='FP32',capabilities=['resource-relevance','query-routing','evidence-sufficiency'],files=['rl_agent_config.json','config.json','model.safetensors','encoder/config.json','tokenizer/tokenizer.json','tokenizer/tokenizer_config.json','tokenizer/special_tokens_map.json','README.md']),
 'embeddings':dict(repo='intfloat/multilingual-e5-small',revision='614241f622f53c4eeff9890bdc4f31cfecc418b3',licence='MIT',runtime='onnx-cpu',quantization='INT8-AVX512-VNNI',dimension=384,capabilities=['query-embedding','passage-embedding'],files=['onnx/model_qint8_avx512_vnni.onnx','onnx/config.json','onnx/tokenizer.json','onnx/tokenizer_config.json','README.md']),
 'slm':dict(repo='unsloth/Qwen3-0.6B-GGUF',upstream='Qwen/Qwen3-0.6B',revision='50968a4468ef4233ed78cd7c3de230dd1d61a56b',licence='Apache-2.0',runtime='llama.cpp-cpu',quantization='Q4_K_M',capabilities=['grounded-explanation-ar','grounded-explanation-fr'],files=['Qwen3-0.6B-Q4_K_M.gguf','README.md']),
}
def digest(path):
 h=hashlib.sha256()
 with path.open('rb') as f:
  for chunk in iter(lambda:f.read(1024*1024),b''):h.update(chunk)
 return h.hexdigest()
def download(url,path,expected=None):
 if path.exists() and (not expected or digest(path)==expected):return digest(path)
 path.parent.mkdir(parents=True,exist_ok=True);part=path.with_suffix(path.suffix+'.part')
 for attempt in range(4):
  try:
   with requests.get(url,stream=True,timeout=(20,180)) as response:
    if response.status_code==404:return None
    response.raise_for_status()
    with part.open('wb') as f:
     for chunk in response.iter_content(1024*1024):f.write(chunk)
   actual=digest(part)
   if expected and actual!=expected:raise ValueError('ARTIFACT_CHECKSUM_MISMATCH')
   part.replace(path);return actual
  except (requests.RequestException,OSError):
   if attempt==3:raise
   time.sleep(2)
def main():
 TARGET.mkdir(parents=True,exist_ok=True);manifest={}
 for key,definition in MODELS.items():
  print('Installing pinned public artifact:',key,flush=True)
  tree=requests.get(f"https://huggingface.co/api/models/{definition['repo']}/tree/{definition['revision']}?recursive=true",timeout=60);tree.raise_for_status()
  entries={i['path']:i for i in tree.json()};hashes={}
  for file in definition['files']:
   entry=entries.get(file)
   if entry is None:continue
   expected=entry.get('lfs',{}).get('oid')
   result=download(f"https://huggingface.co/{definition['repo']}/resolve/{definition['revision']}/{file}",TARGET/key/file,expected)
   if result:hashes[file]={'sha256':result,'upstream_sha256':expected}
  manifest[key]={**definition,'path':str(Path(key)),'status':'installed-unverified-runtime','files':hashes,'installed_at':time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime())}
  (TARGET/'registry.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding='utf-8')
 # Exact release asset, GitHub digest when provided, no shell execution from model files.
 release=requests.get('https://api.github.com/repos/ggml-org/llama.cpp/releases/tags/b12444',timeout=60);release.raise_for_status();release=release.json()
 assets=[a for a in release['assets'] if a['name'].endswith('.zip') and 'bin-win-cpu-x64' in a['name']]
 if not assets:raise RuntimeError('LLAMA_CPU_RELEASE_ASSET_MISSING')
 asset=assets[0];expected=(asset.get('digest') or '').removeprefix('sha256:') or None
 archive=TARGET/'runtime'/asset['name'];sha=download(asset['browser_download_url'],archive,expected)
 with zipfile.ZipFile(archive) as z:
  for member in z.infolist():
   destination=(archive.parent/member.filename).resolve()
   if not destination.is_relative_to(archive.parent.resolve()):raise ValueError('UNSAFE_ARCHIVE')
  z.extractall(archive.parent)
 runtime_files={str(p.relative_to(archive.parent)).replace('\\','/'):{'sha256':digest(p)} for p in archive.parent.rglob('*') if p.is_file() and p.suffix.lower() in ('.exe','.dll')}
 manifest['llama.cpp']={'name':'ggml-org/llama.cpp','revision':release['tag_name'],'licence':'MIT','runtime':'native-cpu','status':'installed-unverified-runtime','asset':asset['name'],'sha256':sha,'upstream_sha256':expected,'path':'runtime','files':runtime_files}
 (TARGET/'registry.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding='utf-8')
 print('Public models downloaded and hashed. Run CPU benchmarks to validate runtimes.',flush=True)
if __name__=='__main__':main()
