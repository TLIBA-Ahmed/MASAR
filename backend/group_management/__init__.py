from fastapi import HTTPException
from sqlalchemy import text
from ..db import rows,one
from ..authorization import AuthorizationService
from ..events import audit,publish


def assigned_groups(c,employee):
    return [dict(r) for r in rows(c,"""SELECT g.id AS group_id,g.name AS group_name,g.group_code,g.centre_id,ct.payload AS centre,a.role_id AS role,a.assignment_status,
      (SELECT count(*) FROM child_group_memberships m WHERE m.group_id=g.id AND m.membership_status='ACTIVE' AND m.valid_from<=now() AND (m.valid_to IS NULL OR m.valid_to>now())) AS active_child_count
      FROM child_groups g JOIN group_assignments a ON a.group_id=g.id JOIN centres ct ON ct.id=g.centre_id
      WHERE a.employee_id=:employee AND a.assignment_status='ACTIVE' AND a.valid_from<=now() AND (a.valid_to IS NULL OR a.valid_to>now()) AND authz.group_allowed(g.id) ORDER BY g.group_code""",employee=employee.employee_id)]


def roster(c,employee,group_id):
    AuthorizationService(c,employee).require_group(group_id)
    group=one(c,'SELECT id,name,group_code,centre_id FROM child_groups WHERE id=:id',id=group_id)
    children=rows(c,"""SELECT ca.id AS case_id,ch.child_code,ch.payload->'name' AS name,ca.payload->'stage' AS stage,ca.payload->>'status' AS status
      FROM child_group_memberships m JOIN cases ca ON ca.id=m.case_id JOIN children ch ON ch.id=ca.child_id
      WHERE m.group_id=:id AND m.membership_status='ACTIVE' AND m.valid_from<=now() AND (m.valid_to IS NULL OR m.valid_to>now()) ORDER BY ca.id""",id=group_id)
    return {'group':dict(group),'children':[dict(r) for r in children],'count':len(children)}


def revoke_assignment(c,employee,assignment_id,reason):
    policy=AuthorizationService(c,employee)
    if not policy.capability('assignments.manage'): policy.deny('assignment')
    row=one(c,"UPDATE group_assignments SET assignment_status='REVOKED',valid_to=now() WHERE id=:id AND assignment_status='ACTIVE' RETURNING employee_id,group_id",id=assignment_id)
    if not row: policy.deny('assignment')
    c.execute(text('INSERT INTO access_review_events(employee_id,actor_id,action,resource_id,reason) VALUES(:target,:actor,\'GROUP_ASSIGNMENT_REVOKED\',:id,:reason)'),{'target':row['employee_id'],'actor':employee.employee_id,'id':assignment_id,'reason':reason})
    publish(c,employee.employee_id,'GROUP_ASSIGNMENT_REVOKED',assignment_id)
    audit(c,employee.employee_id,'assignment.revoke','group_assignment',assignment_id)


def end_membership(c,employee,group_id,case_id,reason):
    policy=AuthorizationService(c,employee)
    if not policy.capability('assignments.manage'): policy.deny('membership')
    row=one(c,"UPDATE child_group_memberships SET membership_status='ENDED',valid_to=now(),removed_by=:employee WHERE group_id=:group_id AND case_id=:case_id AND membership_status='ACTIVE' RETURNING id",employee=employee.employee_id,group_id=group_id,case_id=case_id)
    if not row: policy.deny('membership')
    publish(c,employee.employee_id,'GROUP_MEMBERSHIP_ENDED',case_id,group_id=group_id)
    c.execute(text("INSERT INTO access_review_events(employee_id,actor_id,action,resource_id,reason) VALUES(:employee,:employee,'GROUP_MEMBERSHIP_ENDED',:id,:reason)"),{'employee':employee.employee_id,'id':str(row['id']),'reason':reason})
    audit(c,employee.employee_id,'membership.end','group',group_id)

def enroll(c,e,group_id,case_id,reason):
    policy=AuthorizationService(c,e);policy.require_group(group_id)
    if not policy.capability('assignments.manage'):policy.deny('membership')
    result=one(c,'SELECT authz.enroll_member(:group,:case) AS id',group=group_id,case=case_id)
    c.execute(text("INSERT INTO access_review_events(employee_id,actor_id,action,resource_id,reason) VALUES(:employee,:employee,'GROUP_MEMBER_ADDED',:id,:reason)"),{'employee':e.employee_id,'id':str(result['id']),'reason':reason})
    audit(c,e.employee_id,'membership.add','group',group_id);publish(c,e.employee_id,'GROUP_MEMBER_ADDED',case_id,group_id=group_id)
    return {'id':str(result['id'])}
