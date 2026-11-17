"""Disable or restore a pinned manifest. Never downloads or deletes weights."""
import argparse,json,shutil,time,sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1];registry=ROOT/'infrastructure/model_artifacts/registry.json'
def main():
 p=argparse.ArgumentParser();p.add_argument('action',choices=['disable','enable','rollback']);p.add_argument('model',choices=['system-one','slm','embeddings']);p.add_argument('--manifest',type=Path);args=p.parse_args()
 current=json.loads(registry.read_text(encoding='utf-8'));history=registry.parent/'history';history.mkdir(exist_ok=True);shutil.copy2(registry,history/(time.strftime('%Y%m%d-%H%M%S')+'.json'))
 if args.action=='disable':current[args.model]['status']='disabled'
 elif args.action=='enable':current[args.model]['status']='installed-unverified-runtime'
 else:
  if not args.manifest or not args.manifest.resolve().is_relative_to(history.resolve()):raise ValueError('Select an existing manifest inside model_artifacts/history')
  previous=json.loads(args.manifest.read_text(encoding='utf-8'));current[args.model]=previous[args.model]
 registry.write_text(json.dumps(current,ensure_ascii=False,indent=2),encoding='utf-8')
 print('Manifest updated. Gateway rechecks hashes; benchmark and register the selected version before use.')
if __name__=='__main__':main()
