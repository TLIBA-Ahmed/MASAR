"""Privacy projections; confidential originals never become a browser cache or AI context."""
import json
import logging
from collections.abc import Mapping
from dataclasses import dataclass,asdict
from datetime import date
from sqlalchemy import text
from fastapi import HTTPException
from ..db import one
from ..authorization import AuthorizationService
from ..events import audit,publish


class PrivacyAccessLogFilter(logging.Filter):
    """HTTP access logs contain method/status, never free text from URLs or queries."""
    def filter(self,record):
        if isinstance(record.args,tuple) and len(record.args)==5:
            client,method,_path,protocol,status=record.args
            record.args=(client,method,'[api]',protocol,status)
        return True

logging.getLogger('uvicorn.access').addFilter(PrivacyAccessLogFilter())


@dataclass(frozen=True)
class ChildSummaryDTO:
    id: str
    child_code: str


@dataclass(frozen=True)
class ChildIdentityDTO:
    child_id: str
    child_code: str
    first_name: dict | None
    last_name: dict | None
    birth_date: str | None
    personal_information: dict
    version: int


@dataclass(frozen=True)
class ChildJourneyDTO:
    child_code: str
    caseId: str
    cycle: int
    checkpoints: list


class ChildPrivacyService:
    def __init__(self,c):self.db=c
    def project(self,value):
        return one(self.db,'SELECT privacy.project(CAST(:value AS jsonb)) AS value',value=json.dumps(value,ensure_ascii=False,default=lambda item:dict(item) if isinstance(item,Mapping) else item.isoformat() if hasattr(item,'isoformat') else str(item)))['value']
    def text(self,value):return self.project(str(value))


class ChildPseudonymizationService:
    @staticmethod
    def new_code(c):return one(c,'SELECT privacy.new_child_code() AS code')['code']
    @staticmethod
    def summary(c,child_id):
        row=one(c,'SELECT id,child_code FROM children WHERE id=:id',id=child_id)
        return asdict(ChildSummaryDTO(**dict(row))) if row else None


class ChildIdentityService:
    def __init__(self,c,e):self.db=c;self.employee=e;self.policy=AuthorizationService(c,e)
    def require(self,case_id,operation='read'):
        self.policy.require_active_session()
        if not one(self.db,'SELECT authz.identity_allowed(:case,:op) AS ok',case=case_id,op=operation)['ok']:self.policy.deny('child_identity')
    def read(self,case_id):
        self.require(case_id)
        r=one(self.db,'SELECT i.*,ch.child_code FROM child_identities i JOIN children ch ON ch.id=i.child_id JOIN cases c ON c.child_id=ch.id WHERE c.id=:id',id=case_id)
        if not r:self.policy.deny('child_identity')
        audit(self.db,self.employee.employee_id,'identity.consult','case',case_id)
        return asdict(ChildIdentityDTO(r['child_id'],r['child_code'],r['first_name'],r['last_name'],r['birth_date'].isoformat() if r['birth_date'] else None,r['personal_information'],r['version']))
    def update(self,case_id,changes):
        self.require(case_id,'write')
        permitted={'name','birthDate','birthplace','gender','address','phone','father','mother','school','education','preferences','first_name','last_name'}
        if set(changes)-permitted:raise HTTPException(422,detail={'code':'IMMUTABLE_IDENTITY_RELATION'})
        row=one(self.db,'SELECT i.* FROM child_identities i JOIN cases c ON c.child_id=i.child_id WHERE c.id=:id FOR UPDATE OF i',id=case_id)
        if not row:self.policy.deny('child_identity')
        born=date.fromisoformat(changes['birthDate']) if changes.get('birthDate') else row['birth_date']
        if born and (born>date.today() or (date.today()-born).days>18*366):raise HTTPException(422,detail={'code':'INVALID_CHILD_AGE'})
        info={**row['personal_information'],**changes}
        first=changes.get('first_name',row['first_name']);last=changes.get('last_name',row['last_name'])
        self.db.execute(text('UPDATE child_identities SET personal_information=CAST(:p AS jsonb),birth_date=:born,first_name=CAST(:first AS jsonb),last_name=CAST(:last AS jsonb),version=version+1,updated_at=now() WHERE child_id=:id'),dict(p=json.dumps(info),born=born,first=json.dumps(first) if first else None,last=json.dumps(last) if last else None,id=row['child_id']))
        audit(self.db,self.employee.employee_id,'identity.update','case',case_id,fields=sorted(changes))
        publish(self.db,self.employee.employee_id,'CHILD_IDENTITY_UPDATED',row['child_id'])
        return {'id':case_id}
