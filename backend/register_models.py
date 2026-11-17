"""Administrative, local-only manifest registration; no inference or training."""
import json
from sqlalchemy import text
from .config import settings
from .db import engine
from .model_gateway.prompts import GROUNDING_PROMPT_VERSION,grounded_system_prompt
def main():
    registry=json.loads((settings.models_path/'registry.json').read_text(encoding='utf-8'))
    with engine('admin').begin() as c:
        for key,item in registry.items():
            c.execute(text('INSERT INTO model_versions(id,name,revision,licence,runtime,quantization,local_path,status,capabilities,manifest) VALUES(:id,:name,:revision,:licence,:runtime,:quantization,:path,:status,CAST(:cap AS jsonb),CAST(:manifest AS jsonb)) ON CONFLICT(id) DO UPDATE SET revision=EXCLUDED.revision,status=EXCLUDED.status,manifest=EXCLUDED.manifest'),{'id':key,'name':item.get('repo',item.get('name',key)),'revision':item['revision'],'licence':item['licence'],'runtime':item['runtime'],'quantization':item.get('quantization'),'path':item['path'],'status':item['status'],'cap':json.dumps(item.get('capabilities',[])),'manifest':json.dumps(item)})
        for language in ['ar','fr']:
            c.execute(text("INSERT INTO prompt_versions(id,purpose,language,version,content) VALUES(:id,'grounded-extractive-readonly',:language,2,:content) ON CONFLICT DO NOTHING"),{'id':GROUNDING_PROMPT_VERSION+'-'+language,'language':language,'content':grounded_system_prompt(language)})
        c.execute(text('UPDATE recommendation_templates SET slm_prompt_version=:version,version=version+1 WHERE slm_prompt_version<>:version'),{'version':GROUNDING_PROMPT_VERSION})
    print('Pinned local model and prompt versions registered in PostgreSQL.')
if __name__=='__main__':main()
