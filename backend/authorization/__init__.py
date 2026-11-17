from dataclasses import dataclass
from enum import StrEnum
from fastapi import HTTPException
from ..db import one,rows


class Purpose(StrEnum):
    CASE_READ='case.read'
    CASE_WRITE='case.write'
    GROUP_READ='group.read'
    GROUP_MANAGE='group.manage'
    FORM_READ='forms.read'
    FORM_WRITE='forms.write'
    BROWSER='browser.read'
    RECOMMENDATION='recommendation.generate'
    FEEDBACK='feedback.write'
    ROADMAP='roadmap.write'
    FORUM_READ='forum.read'
    FORUM_WRITE='forum.write'


@dataclass(frozen=True)
class AuthenticatedEmployee:
    employee_id: str
    session_id: str


class AuthorizationService:
    """Policy source is PostgreSQL, never browser claims or index metadata."""
    def __init__(self,connection,employee): self.db=connection; self.employee=employee
    def capability(self,code): return bool(one(self.db,'SELECT authz.capability(:code) AS allowed',code=code)['allowed'])
    def can_access_group(self,group_id): return bool(one(self.db,'SELECT authz.group_allowed(:id) AS allowed',id=group_id)['allowed'])
    def can_access_case(self,case_id,category='general',action='read'): return bool(one(self.db,'SELECT authz.case_allowed(:id,:cat,:action) AS allowed',id=case_id,cat=category,action=action)['allowed'])
    def can_access_document(self,document_id,action='read'): return bool(one(self.db,'SELECT authz.document_allowed(:id,:action) AS allowed',id=document_id,action=action)['allowed'])
    def can_access_record(self,record,action='read'): return bool(one(self.db,'SELECT authz.record_allowed(:id,:cat,:sensitivity,:resource,:action) AS allowed',id=record['case_id'],cat=record['category'],sensitivity=record['sensitivity'],resource=record['id'],action=action)['allowed'])
    def require_case(self,case_id,category='general',action='read'):
        if not self.can_access_case(case_id,category,action): self.deny('case',case_id)
    def require_group(self,group_id):
        if not self.can_access_group(group_id): self.deny('group',group_id)
    def deny(self,kind,resource_id=None):
        raise HTTPException(404,detail={'code':'RESOURCE_UNAVAILABLE','resource_type':kind})
    def require_active_session(self):
        if not one(self.db,'SELECT authz.session_active(CAST(:session AS uuid),:employee) AS active',session=self.employee.session_id,employee=self.employee.employee_id)['active']:raise HTTPException(401,detail={'code':'SESSION_EXPIRED'})
    def get_authorized_retrieval_scope(self,purpose: Purpose):
        if not isinstance(purpose,Purpose): raise ValueError('Purpose must originate from a controlled operation')
        return [r['id'] for r in rows(self.db,'SELECT id FROM cases ORDER BY id')]
    def can_use_recommendation_template(self,case_id,template):
        if not self.can_access_case(case_id): return False
        case=one(self.db,'SELECT payload FROM cases WHERE id=:id',id=case_id)
        return case and case['payload']['status'] in template['allowed_case_statuses'] and all(self.can_access_case(case_id,*scope.rsplit('.',1)) for scope in template['required_scopes'])
