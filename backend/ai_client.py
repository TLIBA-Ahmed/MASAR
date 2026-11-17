"""Only internal backend-to-gateway HTTP is permitted; no cloud provider exists."""
import httpx
from urllib.parse import urlparse
from .config import settings
class LocalModelError(RuntimeError):pass
class ModelGatewayClient:
    def request(self,path,body=None):
        destination=urlparse(settings.gateway_url)
        if destination.scheme not in ('http','https') or destination.hostname not in ('127.0.0.1','localhost','model-gateway'):raise LocalModelError('NONLOCAL_MODEL_ENDPOINT_REFUSED')
        try:
            with httpx.Client(base_url=settings.gateway_url,headers={'X-Model-Key':settings.gateway_token},timeout=125,trust_env=False) as c:
                r=c.get(path) if body is None else c.post(path,json=body)
                if r.status_code!=200:raise LocalModelError('LOCAL_MODEL_UNAVAILABLE')
                return r.json()
        except (httpx.HTTPError,ValueError):raise LocalModelError('LOCAL_MODEL_UNAVAILABLE') from None
    def embeddings(self,texts,kind):return self.request('/internal/models/embeddings',{'texts':texts,'kind':kind})['result']
    def score(self,context,candidates):return self.request('/internal/models/system-one/score',{'context':context,'candidates':candidates})['result']
    def generate(self,task,context,language,source_ids,evidence_options=None):return self.request('/internal/models/slm/generate',dict(task=task,context=context,language=language,source_ids=source_ids,evidence_options=evidence_options or []))['result']
gateway=ModelGatewayClient()
