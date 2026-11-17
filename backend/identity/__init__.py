from abc import ABC,abstractmethod
import hashlib,secrets
from fastapi import HTTPException,Request
from ..config import settings
from ..db import transaction,one,rows
from ..authorization import AuthenticatedEmployee


def token_hash(token): return hashlib.sha256(token.encode()).hexdigest()


class IdentityProvider(ABC):
    @abstractmethod
    def establish_session(self,identity): ...


class DemoIdentityProvider(IdentityProvider):
    def establish_session(self,identity,governorate_id=None,centre_id=None):
        if settings.identity_mode!='demo': raise HTTPException(403,detail={'code':'DEMO_DISABLED'})
        from .entry import authorized_centres
        with transaction(identity,'identity') as c:
            candidates=rows(c,'SELECT * FROM authz.demo_identities()')
            if not any(p['id']==identity for p in candidates): raise HTTPException(401,detail={'code':'INVALID_IDENTITY'})
            centres=authorized_centres(c,identity)
            allowed=[p for p in centres if p['isDemo'] and (centre_id is None or p['id']==centre_id) and (governorate_id is None or p['governorateId']==governorate_id)]
            if not allowed or bool(centre_id)!=bool(governorate_id):raise HTTPException(403,detail={'code':'WORKPLACE_MISMATCH'})
            selected=next((p for p in allowed if p['id']==next(p for p in candidates if p['id']==identity)['payload']['centerId']),allowed[0])
            token=secrets.token_urlsafe(48)
            session=one(c,'SELECT authz.create_demo_session(:id,:hash) AS id',id=identity,hash=token_hash(token))['id']
            if not one(c,'SELECT authz.set_entry_centre(:session,:employee,:centre,:governorate) AS ok',session=session,employee=identity,centre=selected['id'],governorate=selected['governorateId'])['ok']:
                raise HTTPException(403,detail={'code':'WORKPLACE_MISMATCH'})
        return token


class EHouwiyaIdentityProvider(IdentityProvider):
    def establish_session(self,identity):
        raise HTTPException(501,detail={'code':'EHOUWIYA_NOT_CONFIGURED','message':'No operational government integration or real identity is collected.'})


def resolve_employee(request: Request):
    token=request.cookies.get('masar_session','')
    with transaction() as c:
        resolved=one(c,'SELECT * FROM authz.resolve_session(:hash)',hash=token_hash(token)) if token else None
    if not resolved: raise HTTPException(401,detail={'code':'SESSION_REQUIRED'})
    return AuthenticatedEmployee(resolved['employee_id'],str(resolved['session_id']))
