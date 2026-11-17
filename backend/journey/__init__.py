from ..privacy import ChildPrivacyService,ChildJourneyDTO
from dataclasses import asdict
"""Read-only projections of the central case, always under the existing live RLS.

No child coordinates, separate journey database, inferred clinical score or workflow
mutation is provided. Every count derives from the same authorized rows as its list.
"""
from datetime import date
from ..authorization import AuthorizationService
from ..db import one, rows
from ..events import audit
from ..group_management import assigned_groups
from ..retrieval import normalize
from .catalogue import STAGES, bi

ASSESSMENT_FORMS = {'F02', 'F08', 'F09', 'F12'}
COMPLETE = {'completed', 'validated', 'notApplicable'}


def open_document(c, employee, case_id, version_id):
    policy = AuthorizationService(c, employee)
    policy.require_active_session()
    policy.require_case(case_id)
    row = one(c, 'SELECT id,document_id,form_id FROM document_versions WHERE id=:id AND case_id=:case', id=version_id, case=case_id)
    if not row or not policy.can_access_document(row['document_id']):
        policy.deny('document')
    audit(c, employee.employee_id, 'journey.document.open', 'document_version', version_id)
    return {'path': f"/documents/{case_id}/{row['form_id']}?version={row['id']}" if row['form_id'] else f"/api/v1/document-versions/{row['id']}/original"}


def overview(c, employee, query='', group_id=None):
    policy = AuthorizationService(c, employee)
    policy.require_active_session()
    groups = assigned_groups(c, employee)
    if group_id:
        policy.require_group(group_id)
    memberships = rows(c, '''SELECT m.case_id,m.group_id FROM child_group_memberships m
        WHERE m.membership_status='ACTIVE' AND m.valid_from<=now()
          AND (m.valid_to IS NULL OR m.valid_to>now()) ORDER BY m.group_id''')
    children = []
    for row in rows(c, """SELECT ca.id,ca.payload,ch.child_code,ch.payload->'name' AS name
            FROM cases ca JOIN children ch ON ch.id=ca.child_id ORDER BY ca.id"""):
        group_ids = [m['group_id'] for m in memberships if m['case_id'] == row['id']]
        if group_id and group_id not in group_ids:
            continue
        if normalize(query) not in normalize(row['id']+' '+row['name']['ar']+' '+row['name']['fr']):
            continue
        p = row['payload']
        children.append(dict(id=row['id'],child_code=row['child_code'], name=row['name'], stage=p['stage'], status=p['status'],
                             cycle=p.get('cycle', 1), nextDue=p.get('nextDue'), groupIds=group_ids))
    checkpoints = [dict(id=s['id'], title=s['title'], short=s['short'], description=s['description'],
                        status='notStarted', current=False, future=s['id'] >= 4,
                        childCount=sum(ch['stage'] == s['id'] for ch in children),
                        startedAt=None, endedAt=None, completedSubsteps=0, totalSubsteps=0,
                        documentCount=0, pendingCount=0) for s in STAGES]
    audit(c, employee.employee_id, 'journey.overview.read', 'journey')
    return dict(children=children, groups=groups, checkpoints=checkpoints, count=len(children))


def _event(key, stage, kind, when, title, note='', author=None, path=None, source=None):
    return dict(id=key, stage=stage, type=kind, date=str(when), title=title, note=note,
                professionalId=author, path=path, sourceId=source)


def _collect(c, employee, case_id):
    policy = AuthorizationService(c, employee)
    policy.require_active_session()
    policy.require_case(case_id)
    row = one(c, """SELECT ca.id,ca.payload,ch.child_code,ch.payload->'name' AS name FROM cases ca
        JOIN children ch ON ch.id=ca.child_id WHERE ca.id=:id""", id=case_id)
    case = row['payload']
    # Fixed table identifiers only. Unauthorized records never enter this projection.
    records = []
    for table in ('observations', 'professional_notes', 'initial_assessments', 'intervention_events', 'case_status_history'):
        for record in rows(c, f'SELECT id,category,author_id,source_id,created_at,payload FROM {table} WHERE case_id=:id', id=case_id):
            records.append(dict(record, table=table))
    definitions = {r['id']: dict(r) for r in rows(c, 'SELECT id,category,payload FROM form_definitions')}
    versions = rows(c, '''SELECT v.id,v.form_id,v.version,v.status,v.author_id,v.created_at,v.payload,
        d.title,d.id AS document_id FROM document_versions v JOIN documents d ON d.id=v.document_id
        WHERE v.case_id=:id ORDER BY v.created_at,v.version''', id=case_id)
    form_versions = [v for v in versions if v['form_id'] in definitions]
    goals = [r['payload'] for r in rows(c, 'SELECT payload FROM roadmap_objectives WHERE case_id=:id ORDER BY id', id=case_id)]
    roadmap_versions = rows(c, 'SELECT id,version,author_id,created_at,payload FROM roadmap_versions WHERE case_id=:id ORDER BY version', id=case_id)
    plans = rows(c, 'SELECT id,payload,author_id,created_at FROM planned_interventions WHERE case_id=:id ORDER BY created_at', id=case_id)
    sessions = rows(c, '''SELECT s.id,s.payload,p.payload AS participation FROM activity_sessions s
        JOIN session_participants p ON p.session_id=s.id WHERE p.case_id=:id ORDER BY s.id''', id=case_id)
    memberships = rows(c, '''SELECT m.id,m.group_id,m.valid_from,m.valid_to,m.membership_status,g.name
        FROM child_group_memberships m JOIN child_groups g ON g.id=m.group_id
        WHERE m.case_id=:id ORDER BY m.valid_from''', id=case_id)
    appointments = [r['payload'] for r in rows(c, 'SELECT payload FROM appointments WHERE case_id=:id', id=case_id)]
    tasks = [r['payload'] for r in rows(c, 'SELECT payload FROM tasks WHERE case_id=:id', id=case_id)]
    # A readable event must not reveal a forbidden source through its narrative or counts.
    # Resolve only already-authorized sources; unknown/cyclic references are omitted.
    known = {case_id} | {v['id'] for v in versions} | {v['document_id'] for v in versions}
    known |= {g['id'] for g in goals} | {v['id'] for v in roadmap_versions} | {p['id'] for p in plans}
    known |= {s['id'] for s in sessions} | {a['id'] for a in appointments} | {t['id'] for t in tasks}
    known |= {r['id'] for r in rows(c, 'SELECT id FROM interventions')}
    accepted, pending = [], records
    while pending:
        remaining = []
        for record in pending:
            sources = {s for s in (record['source_id'], record['payload'].get('sourceId')) if s}
            if sources.issubset(known):
                accepted.append(record)
                known.add(record['id'])
            else:
                remaining.append(record)
        if len(remaining) == len(pending):
            break
        pending = remaining
    records = accepted
    return dict(policy=policy, case=case,child_code=row['child_code'], name=row['name'], records=records, definitions=definitions,
                documents=form_versions, goals=goals, versions=roadmap_versions, plans=plans,
                sessions=sessions, groups=memberships, appointments=appointments, tasks=tasks)


def _project(c, employee, case_id, data):
    policy, case, records = data['policy'], data['case'], data['records']
    base_path = '/cases/'+case_id
    events = [_event('registration-'+case_id, 1, 'registration', case['openedAt'],
                     bi('فتح الملف الرقمي', 'Ouverture du dossier numérique'), path=base_path)]
    decisions = []
    for r in records:
        p = r['payload']
        stage = p.get('stage', p.get('from', 3))
        if stage not in range(1, 6):
            stage = 3
        kind = p.get('type', 'assessment' if r['table'] == 'initial_assessments' else 'observation')
        if r['table'] == 'case_status_history':
            kind = 'supervision' if p.get('kind') == 'supervise' else 'decision'
            decisions.append({**p, 'id': r['id']})
        events.append(_event(r['id'], stage, kind, p.get('date', r['created_at'].isoformat()),
                             p.get('title', bi('مساهمة مهنية', 'Contribution professionnelle')),
                             p.get('note', p.get('reason', '')), r['author_id'], base_path+'?tab=history&event='+r['id'], p.get('sourceId')))
    documents = []
    comparisons = []
    for v in data['documents']:
        definition = data['definitions'][v['form_id']]['payload']
        source_event = next((e for e in events if e['sourceId'] == v['id']), None)
        stage = source_event['stage'] if source_event else definition['stages'][0]
        p = v['payload']
        when = p.get('date', v['created_at'].isoformat())
        path = f"/documents/{case_id}/{v['form_id']}?version={v['id']}"
        documents.append(dict(id=v['id'], documentId=v['document_id'], formId=v['form_id'],
                              title=v['title'], version=v['version'], status=v['status'], date=when,
                              stage=stage, professionalId=v['author_id'], path=path))
        kind = 'assessment' if v['form_id'] in ASSESSMENT_FORMS else 'interview' if v['form_id'] == 'F01' else 'document'
        if not source_event:
            events.append(_event('document-'+v['id'], stage, kind, when, v['title'], author=v['author_id'], path=path, source=v['id']))
        if v['form_id'] in ASSESSMENT_FORMS:
            values = p.get('values', {})
            labels = {'notes': bi('ملاحظات', 'Observations'), 'strengths': bi('نقاط القوة', 'Points d’appui'),
                      'difficulties': bi('صعوبات موثقة', 'Difficultés documentées'),
                      'recommendations': bi('مقترحات المهني', 'Propositions professionnelles'), 'summary': bi('حوصلة', 'Synthèse')}
            fields = [dict(label=label, value=values[key]) for key, label in labels.items() if isinstance(values.get(key), str) and values[key]]
            comparisons.append(dict(id=v['id'], formId=v['form_id'], title=v['title'], version=v['version'],
                                    date=when, phase=p.get('phase') if p.get('phase') in ('initial', 'intermediate', 'final') else None,
                                    fields=fields, path=path))
    activities = {r['id']: r['payload'] for r in rows(c, 'SELECT id,payload FROM interventions')}
    for s in data['sessions']:
        p = s['payload']
        activity = activities.get(p.get('activityId'), {})
        events.append(_event('session-'+s['id'], 3, 'activity', p['date'],
                             activity.get('title', bi('نشاط موثق', 'Activité documentée')),
                             s['participation'].get('notes', ''), p.get('educatorId'), '/sessions?session='+s['id']))
    for g in data['groups']:
        events.append(_event('membership-'+str(g['id']), 2, 'group', g['valid_from'].isoformat(),
                             g['name'], path=base_path))
    for v in data['versions']:
        events.append(_event('roadmap-'+v['id'], 3, 'project', v['created_at'].isoformat(),
                             bi('نسخة من خطة التأهيل', 'Version du plan de réhabilitation'),
                             v['payload'].get('notes', ''), v['author_id'], base_path+'?tab=project'))
    for p in data['plans']:
        item = p['payload']
        events.append(_event(p['id'], 3, 'intervention', item.get('date', p['created_at'].isoformat()),
                             activities.get(item.get('intervention_id'), {}).get('title', bi('تدخل مبرمج', 'Intervention planifiée')),
                             item.get('reason', ''), p['author_id'], base_path+'?tab=interventions'))
    for r in rows(c, '''SELECT f.id,f.created_at,f.employee_id,f.reason,rc.id AS candidate_id
        FROM recommendation_feedback f JOIN recommendation_candidates rc ON rc.id=f.candidate_id
        JOIN recommendation_runs run ON run.id=rc.run_id WHERE run.case_id=:id ORDER BY f.created_at''', id=case_id):
        events.append(_event(str(r['id']), 3, 'recommendation', r['created_at'].isoformat(),
                             bi('مراجعة اقتراح من قبل المهني', 'Recommandation examinée'), r['reason'],
                             r['employee_id'], base_path+'?tab=recommendations'))
    for a in data['appointments']:
        if a.get('completed'):
            events.append(_event('appointment-'+a['id'], min(case['stage'], 3),
                                 'interview' if a.get('type') == 'interview' else 'appointment', a['date'],
                                 a['title'], a.get('notes', ''), a.get('professionalId'), '/calendar'))
    events.sort(key=lambda e: (e['date'], e['id']), reverse=True)
    if sum(e['type'] == 'registration' for e in events) > 1:
        events = [e for e in events if e['id'] != 'registration-'+case_id]

    checkpoints = []
    for stage in STAGES:
        n = stage['id']
        stage_events = [e for e in events if e['stage'] == n]
        stage_documents = [d for d in documents if n in data['definitions'][d['formId']]['payload']['stages']]
        substeps = []
        for definition in stage['substeps']:
            allowed = policy.can_access_case(case_id, definition['category'])
            status = 'notStarted'
            if not allowed:
                status = 'unavailable'
            elif definition['form']:
                versions = [d for d in documents if d['formId'] == definition['form']]
                if versions:
                    status = 'completed' if any(d['status'] == 'validated' for d in versions) else 'pending'
            elif definition['legacy']:
                status = case.get('subStages', {}).get(definition['legacy'], 'notStarted')
            elif definition['evidence']:
                evidence = definition['evidence']
                if evidence == 'registration':
                    status = 'completed'
                elif evidence == 'group' and any(g['membership_status'] == 'ACTIVE' for g in data['groups']):
                    status = 'completed'
                elif evidence in ('activity', 'workshop', 'attendance') and data['sessions']:
                    relevant = [s for s in data['sessions'] if evidence != 'workshop' or activities.get(s['payload'].get('activityId'), {}).get('format') == 'group']
                    if evidence == 'attendance':
                        documented = [s for s in relevant if s['payload'].get('status') == 'completed' and s['participation'].get('attendance') in ('present', 'absent', 'excused')]
                        status = 'completed' if documented else 'inProgress'
                    elif relevant:
                        status = 'completed' if any(s['payload'].get('status') == 'completed' for s in relevant) else 'inProgress'
                elif evidence == 'intervention' and data['plans']:
                    status = 'inProgress'  # Planning is not evidence that an intervention took place.
                elif evidence == 'observation' and any(e['type'] == 'observation' and e['stage'] == 3 for e in events):
                    status = 'completed'
                elif evidence in ('intermediate', 'final') and any(v['phase'] == evidence for v in comparisons):
                    status = 'completed'
            if allowed and definition['key'] == 'supervision' and case.get('supervised'):
                status = 'validated'
            substeps.append(dict(key=definition['key'], title=definition['title'], status=status,
                                 path=base_path+'?tab='+('documents' if definition['form'] else 'project' if definition['category'] == 'roadmap' else 'history')))
        completed = sum(s['status'] in COMPLETE for s in substeps)
        total = sum(s['status'] != 'unavailable' for s in substeps)
        pending = sum(s['status'] == 'pending' for s in substeps)
        current = case['stage'] == n
        future = n >= 4
        status = 'completed' if n < case['stage'] else 'current' if current else 'future' if future else 'notStarted'
        if current and pending:
            status = 'pending'
        # Only dates explicitly recorded for entry/exit are displayed, never inferred from version creation.
        starts = [d['date'] for d in decisions if d.get('to') == n and d.get('kind') in ('advance', 'extend') and d.get('date')]
        ends = [d['date'] for d in decisions if d.get('from') == n and d.get('kind') in ('advance', 'extend') and d.get('date')]
        checkpoints.append(dict(id=n, title=stage['title'], short=stage['short'], description=stage['description'],
                                status=status, current=current, future=future,
                                startedAt=case['openedAt'] if n == 1 else min(starts) if starts else None,
                                endedAt=max(ends) if ends else None, completedSubsteps=completed, totalSubsteps=total,
                                pendingCount=pending, documentCount=len({d['documentId'] for d in stage_documents}), substeps=substeps,
                                events=stage_events, documents=stage_documents))
    achieved_known = any('status' in g for g in data['goals'])
    goals = [dict(id=g['id'], description=g['description'], skill=g['skill'], confirmed=g.get('confirmed', False),
                  status=g.get('status'), dueDate=g.get('dueDate')) for g in data['goals']]
    deadlines = [dict(id=a['id'], title=a['title'], date=a['date'], path='/calendar') for a in data['appointments'] if not a.get('completed')]
    deadlines += [dict(id=t['id'], title=t['title'], date=t['dueDate'], path='/tasks') for t in data['tasks'] if not t.get('completed')]
    deadlines += [dict(id=p['id'], title=bi('تدخل مبرمج', 'Intervention planifiée'), date=p['payload']['date'],
                       path=base_path+'?tab=interventions') for p in data['plans'] if p['payload'].get('date')]
    deadlines.sort(key=lambda d: d['date'])
    completed_sessions = [s for s in data['sessions'] if s['payload'].get('status') == 'completed']
    metrics = dict(days=max(0, (date.today()-date.fromisoformat(case['openedAt'][:10])).days),
                   interviews=sum(e['type'] == 'interview' for e in events),
                   interventions=sum(e['type'] == 'intervention' for e in events),
                   scheduledActivities=sum(s['payload'].get('status') in ('planned', 'inProgress') for s in data['sessions']),
                   completedActivities=len(completed_sessions),
                   present=sum(s['participation'].get('attendance') == 'present' for s in completed_sessions),
                   absent=sum(s['participation'].get('attendance') == 'absent' for s in completed_sessions),
                   assessments=len({v['id'] for v in comparisons} | {e['sourceId'] or e['id'] for e in events if e['type'] == 'assessment'}), goalsTotal=len(goals), goalsConfirmed=sum(g['confirmed'] for g in goals),
                   goalsAchieved=sum(g['status'] in ('achieved', 'completed') for g in goals) if achieved_known else None,
                   goalsInProgress=sum(g['status'] == 'inProgress' for g in goals) if achieved_known else None)
    cycles = [dict(number=i, decisions=[d for d in decisions if d.get('cycle') == i]) for i in range(1, case.get('cycle', 1)+1)]
    versions = [dict(id=v['id'], version=v['version'], date=v['created_at'].isoformat(), professionalId=v['author_id'],
                     notes=v['payload'].get('notes', ''), cycle=v['payload'].get('cycle')) for v in data['versions']]
    return dict(caseId=case_id, child=dict(name=data['name']), stage=case['stage'], cycle=case.get('cycle', 1),
                caseStatus=case['status'], openedAt=case['openedAt'], nextDue=case.get('nextDue'),
                checkpoints=checkpoints, metrics=metrics, goals=goals, deadlines=deadlines,
                versions=versions, cycles=cycles, comparisons=comparisons, events=events,
                groups=[dict(id=g['group_id'], name=g['name'], status=g['membership_status']) for g in data['groups']])


def read_journey(c, employee, case_id, stage_id=None):
    data = _collect(c, employee, case_id)
    projection = _project(c, employee, case_id, data)
    audit(c, employee.employee_id, 'journey.stage.read' if stage_id else 'journey.case.read', 'case', case_id, stage=stage_id)
    if stage_id is None:
        # Stage records are fetched again on opening the details drawer.
        projection['checkpoints'] = [{k: v for k, v in s.items() if k not in ('substeps', 'events', 'documents')} for s in projection['checkpoints']]
        projection.update(asdict(ChildJourneyDTO(data['child_code'],case_id,projection['cycle'],projection['checkpoints'])))
        return ChildPrivacyService(c).project(projection)
    checkpoint = projection['checkpoints'][stage_id-1]
    professional_ids = {e['professionalId'] for e in checkpoint['events'] if e.get('professionalId')}
    professional_ids.update(d['professionalId'] for d in checkpoint['documents'])
    professionals = [dict(id=r['id'], name=r['payload']['name'], role=r['payload']['role'])
                     for r in rows(c, 'SELECT id,payload FROM employees WHERE id=ANY(:ids) ORDER BY id', ids=list(professional_ids))]
    forms = []
    for form_id, definition in data['definitions'].items():
        if stage_id in definition['payload']['stages'] and data['policy'].can_access_record(
            dict(id=case_id+'-'+form_id, case_id=case_id, category=definition['category'], sensitivity=3 if definition['category'] == 'psychological' else 1)):
            forms.append(dict(id=form_id, title=definition['payload']['title'], path=f'/documents/{case_id}/{form_id}'))
    results = [dict(id=r['id'], text=r['payload']['result'], date=r['payload'].get('date', r['created_at'].isoformat()))
               for r in data['records'] if r['payload'].get('stage') == stage_id and isinstance(r['payload'].get('result'), str) and r['payload']['result']]
    return ChildPrivacyService(c).project(dict(caseId=case_id, checkpoint=checkpoint, professionals=professionals, forms=forms,
                deadlines=projection['deadlines'], goals=projection['goals'] if stage_id == 3 else [], results=results))
