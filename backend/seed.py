import json
from sqlalchemy import text
from .config import ROOT
from .db import engine,one
from .model_gateway.prompts import GROUNDING_PROMPT_VERSION

CATEGORIES={'F01':'social','F04':'psychological','F12':'psychological','F18':'psychological','F19':'psychological','F20':'psychological','F21':'psychological','F22':'psychological','F15':'social','F13':'roadmap','F14':'roadmap','F08':'assessment','F09':'assessment','F03':'administrative','F07':'administrative','F10':'administrative'}
def form_category(form_id): return CATEGORIES.get(form_id,'educational')
def j(value): return json.dumps(value,ensure_ascii=False)
def insert(conn,table,values,ignore_conflicts=True):
    # All identifiers originate in this module, never in an HTTP request.
    arrays={'required_roles','required_scopes','allowed_case_statuses'}
    cols=','.join(values); binds=','.join(f'CAST(:{key} AS jsonb)' if isinstance(value,(dict,list)) and key not in arrays else f':{key}' for key,value in values.items())
    conflict=' ON CONFLICT DO NOTHING' if ignore_conflicts else ''
    conn.execute(text(f'INSERT INTO {table}({cols}) VALUES({binds})'+conflict),{key:j(value) if isinstance(value,(dict,list)) and key not in arrays else value for key,value in values.items()})
def record(conn,table,key,case_id,payload,category='educational',author='p3',status='ACTIVE',version=1,source=None,sensitivity=1,**extra):
    insert(conn,table,dict(id=key,case_id=case_id,author_id=author,category=category,sensitivity=sensitivity,status=status,version=version,source_id=source,payload=payload,**extra))

def preserve_families(c,data):
    for family in data['families']:
        related=[case for case in data['cases'] if next(ch for ch in data['children'] if ch['id']==case['childId'])['familyId']==family['id']]
        if related:insert(c,'families',{'id':family['id'],'centre_id':related[0]['centerId'],'author_id':'p1','payload':family})
    for case in data['cases']:
        family_id=next(ch for ch in data['children'] if ch['id']==case['childId'])['familyId']
        if one(c,'SELECT id FROM families WHERE id=:id',id=family_id):insert(c,'case_family_links',{'case_id':case['id'],'family_id':family_id,'confirmed_by':'p1'})


def seed():
    source=ROOT/'database/seed_data/demo.json'
    if not source.exists(): raise RuntimeError('Run node scripts/export-seed.mjs first')
    bundle=json.loads(source.read_text(encoding='utf-8')); data=bundle['data']
    with engine('admin').begin() as c:
        if one(c,'SELECT id FROM centres LIMIT 1'):
            for partner in data['partners']:insert(c,'partner_structures',{'id':partner['id'],'centre_id':partner['access']['cdisId'],'payload':partner})
            preserve_families(c,data)
            return
        for centre in data['centers']:
            governorate=one(c,"SELECT id FROM governorates WHERE authz.normalize_text(name->>'fr')=authz.normalize_text(:region)",region=centre['region']['fr'])
            if not governorate:raise ValueError('Synthetic centre needs a configured governorate')
            insert(c,'centres',{'id':centre['id'],'payload':centre,'governorate_id':governorate['id'],'is_demo':True})
        all_categories=['general','social','psychological','educational','assessment','roadmap','administrative']
        all_read=[f'{k}.read' for k in all_categories]
        common=all_read+['knowledge.read','recommendation.use','groups.read','forum.read','forum.write']
        for role in ['social','psychologist','educator','administration']:
            insert(c,'roles',{'id':role})
            permissions=common+[f'{k}.write' for k in all_categories]+['interventions.plan']
            if role=='social': permissions+=['cases.create']
            if role=='administration': permissions=['general.read','administrative.read','administrative.write','knowledge.read','roadmap.read','recommendation.use','groups.read','groups.manage','assignments.manage','audit.read','forum.read','forum.write']
            if role in ('social','administration'):permissions+=['child.identity.read']
            if role=='social':permissions+=['child.identity.write']
            permissions+=['journey.summary.generate','journey.summary.review']
            for p in permissions: insert(c,'role_permissions',{'role_id':role,'permission':p})
        for employee in data['professionals']:
            insert(c,'employees',{'id':employee['id'],'payload':employee,'is_demo_identity':True})
            insert(c,'employee_roles',{'employee_id':employee['id'],'role_id':employee['role']})
            insert(c,'employee_centres',{'employee_id':employee['id'],'centre_id':employee['centerId']})
        for form in bundle['forms']: insert(c,'form_definitions',{'id':form['id'],'version':form['version'],'category':form_category(form['id']),'payload':form})
        for child in data['children']:
            insert(c,'children',{'id':child['id'],'child_code':next(x['id'] for x in data['cases'] if x['childId']==child['id']),'payload':child})
        for case in data['cases']:
            public={k:v for k,v in case.items() if k not in ['goals','projectNotes','decisions']}
            insert(c,'cases',{'id':case['id'],'child_id':case['childId'],'centre_id':case['centerId'],'payload':public})
            child=next(x for x in data['children'] if x['id']==case['childId'])
            record(c,'case_profiles','social-'+case['id'],case['id'],{k:child[k] for k in ['address','phone','father','mother','familyId']},'social','p1')
            record(c,'case_profiles','education-'+case['id'],case['id'],{k:child[k] for k in ['school','education','preferences']})
            roadmap='roadmap-'+case['id']
            record(c,'roadmaps',roadmap,case['id'],{'notes':case['projectNotes']},'roadmap')
            record(c,'roadmap_versions',roadmap+'-v1',case['id'],{'notes':case['projectNotes'],'goals':case['goals']},'roadmap',status='APPROVED',roadmap_id=roadmap)
            for goal in case['goals']: record(c,'roadmap_objectives',goal['id'],case['id'],goal,'roadmap',roadmap_id=roadmap)
        preserve_families(c,data)
        groups=[('group-a','siliana','A',[3,4,24,25,11,14]),('group-b','siliana','B',[5,6,8,16]),('group-c','siliana','C',[1,2]),('group-d','gabes','D',[33,34,35,36])]
        for gid,centre,code,members in groups:
            insert(c,'child_groups',{'id':gid,'centre_id':centre,'group_code':'DEMO-'+code,'name':{'ar':'مجموعة '+code+' — تجريبية','fr':'Groupe '+code+' — fictif'},'status':'ACTIVE'})
            for number in members:
                c.execute(text("INSERT INTO child_group_memberships(group_id,case_id,valid_from,membership_status,added_by) VALUES(:g,:c,'2020-01-01','ACTIVE','p4')"),{'g':gid,'c':f'CDIS-{number:03}'})
        scopes={
            'educator':['general.read','general.write','educational.read','educational.write','assessment.read','assessment.write','roadmap.read','roadmap.write','administrative.read'],
            'psychologist':['general.read','psychological.read','psychological.write','confidential.read','confidential.write','educational.read','assessment.read','assessment.write','roadmap.read','roadmap.write','administrative.read'],
            'social':['general.read','general.write','social.read','social.write','educational.read','assessment.read','assessment.write','roadmap.read','roadmap.write','administrative.read'],
            'administration':['general.read','administrative.read','administrative.write','roadmap.metadata','documents.metadata','assessment.metadata'],
            'limited':['general.read','roadmap.read'],
        }
        assignments=[('p3','group-a','educator','ACTIVE'),('p2','group-a','psychologist','ACTIVE'),('p2','group-b','psychologist','ACTIVE'),('p1','group-c','social','ACTIVE'),('p4','group-a','administration','ACTIVE'),('p4','group-b','administration','ACTIVE'),('p4','group-c','administration','ACTIVE'),('p5','group-d','educator','ACTIVE'),('p6','group-a','limited','ACTIVE'),('p3','group-b','educator','REVOKED'),('p3','group-c','educator','EXPIRED')]
        scopes['social']+=['child.identity.read','child.identity.write']
        scopes['administration']+=['child.identity.read']
        for scope in scopes.values():
            if 'roadmap.write' in scope:scope+=['journey.summary.generate','journey.summary.review']
        for emp,gid,scope_name,status in assignments:
            aid=f'{emp}-{gid}'; role='educator' if scope_name=='limited' else scope_name
            insert(c,'group_assignments',{'id':aid,'group_id':gid,'employee_id':emp,'role_id':role,'assignment_status':status,'valid_from':'2020-01-01','valid_to':'2021-01-01' if status=='EXPIRED' else None,'assigned_by':'p4'})
            for scope in scopes[scope_name]: insert(c,'group_assignment_scopes',{'group_assignment_id':aid,'scope_code':scope,'granted_by':'p4'})
        for emp,ids,scope_name in [('p1',[24,25],'social'),('p4',range(1,33),'administration')]:
            for number in ids:
                aid=f'{emp}-CDIS-{number:03}'; case_id=f'CDIS-{number:03}'
                insert(c,'case_assignments',{'id':aid,'case_id':case_id,'employee_id':emp,'role_id':scope_name,'assignment_status':'ACTIVE','valid_from':'2020-01-01','assigned_by':'p4'})
                for scope in scopes[scope_name]: insert(c,'assignment_scopes',{'case_assignment_id':aid,'scope_code':scope,'granted_by':'p4'})
        c.execute(text("INSERT INTO child_group_memberships(group_id,case_id,membership_status,valid_from,valid_to,added_by,removed_by) VALUES('group-b','CDIS-024','TRANSFERRED','2019-01-01','2020-01-01','p4','p4')"))
        for event in data['events']:
            category='assessment' if event['type']=='assessment' else 'social' if event['type']=='observation' else 'educational' if event['type']=='activity' else 'administrative' if event['type']=='decision' else 'general'
            table='initial_assessments' if event['type']=='assessment' else 'observations' if event['type']=='observation' else 'intervention_events'
            record(c,table,event['id'],event['caseId'],event,category,event['professionalId'],source=event.get('sourceId'))
        for submission in data['submissions']:
            category=form_category(submission['formId']); did=submission['caseId']+'-'+submission['formId']
            title=next(f['title'] for f in bundle['forms'] if f['id']==submission['formId'])
            centre=next(x['centerId'] for x in data['cases'] if x['id']==submission['caseId'])
            insert(c,'documents',{'id':did,'case_id':submission['caseId'],'centre_id':centre,'category':category,'sensitivity':3 if category=='psychological' else 1,'title':title,'approval_status':'DEMO_APPROVED','created_by':submission['authorId']})
            insert(c,'document_versions',{'id':submission['id'],'document_id':did,'case_id':submission['caseId'],'form_id':submission['formId'],'version':submission['version'],'language':'ar','status':submission['status'],'author_id':submission['authorId'],'payload':submission,'created_at':submission['date']})
            insert(c,'outbox_events',{'event_type':'DOCUMENT_VERSION_CREATED','aggregate_id':submission['id'],'source_version':submission['version'],'payload':{}})
        for item in data['activities']+data['resources']:
            kind='activity' if 'duration' in item else 'resource'
            required=item.get('access',{}).get('allowedRoles',[])
            insert(c,'interventions',{'id':item['id'],'kind':kind,'category':'educational' if kind=='activity' else 'knowledge','approval_status':'DEMO_APPROVED','required_roles':required,'payload':item})
            insert(c,'knowledge_items',{'id':item['id'],'kind':'intervention','category':'educational','approval_status':'DEMO_APPROVED','required_roles':required,'payload':item})
            insert(c,'outbox_events',{'event_type':'KNOWLEDGE_UPDATED','aggregate_id':item['id'],'payload':{}})
        for partner in data['partners']:insert(c,'partner_structures',{'id':partner['id'],'centre_id':partner['access']['cdisId'],'payload':partner})
        for session in data['sessions']:
            centre=next(x['centerId'] for x in data['cases'] if x['id']==session['participants'][0]['caseId'])
            insert(c,'activity_sessions',{'id':session['id'],'centre_id':centre,'activity_id':session['activityId'],'author_id':session['educatorId'],'status':session['status'],'payload':{k:v for k,v in session.items() if k!='participants'}})
            for p in session['participants']: insert(c,'session_participants',{'session_id':session['id'],'case_id':p['caseId'],'payload':p})
        for table in ['appointments','tasks']:
            for item in data[table]: record(c,table,item['id'],item['caseId'],item,'administrative',item['professionalId'])
        for template in bundle['contexts']:
            administrative='administration' in template['allowedRoles']
            required=['general.read']+([] if administrative else ['roadmap.read'])+(['educational.read'] if template['recommendationStrategy'] in ['activities','project','training','resources','support'] else [])
            insert(c,'recommendation_templates',{'id':template['contextId'],'code':template['contextId'],'required_scopes':required,'approved_by':'p4','input_schema':{'required':template['requiredInputs'],'optional':template['optionalInputs']},'output_schema':{'kind':template['outputSchema']},'system_one_config_id':'resource-relevance-v1','slm_prompt_version':GROUNDING_PROMPT_VERSION,'payload':template})
            for role in template['allowedRoles']: insert(c,'template_roles',{'template_id':template['contextId'],'role_id':role})
