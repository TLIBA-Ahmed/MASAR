"""One additive, explicitly synthetic historical extension example; no live workflow."""
import json
from datetime import datetime, timezone, timedelta
from sqlalchemy import text
from ..config import settings
from ..db import engine, one
from ..seed import record


def preserve_historical_integrations():
    """Preserve the original synthetic orientations as authorized historical events."""
    if settings.identity_mode != 'demo':
        return
    from ..config import ROOT
    data = json.loads((ROOT/'database/seed_data/demo.json').read_text(encoding='utf-8'))['data']
    with engine('admin').begin() as c:
        for original in data['integrations']:
            case_id = original['caseId']
            if not one(c, 'SELECT id FROM cases WHERE id=:id', id=case_id):
                continue
            payload = {**original, 'integrationType': original['type'], 'type': 'integration',
                       'stage': 5, 'historicalDemo': True, 'note': original['notes'],
                       'title': {'ar': 'توجيه موثق — سجل تاريخي اصطناعي', 'fr': 'Orientation documentée — historique synthétique'}}
            # Original identifiers, narratives, results and author are preserved.
            # No case stage/status is changed, including for already-closed examples.
            record(c, 'intervention_events', original['id'], case_id, payload, 'administrative',
                   original['professionalId'], created_at=original['date'])


def prepare_journey_demo():
    if settings.identity_mode != 'demo':
        return
    case_id = 'CDIS-014'
    marker = 'journey-demo-extension-'+case_id
    with engine('admin').begin() as c:
        if one(c, 'SELECT id FROM case_status_history WHERE id=:id', id=marker):
            return
        case = one(c, 'SELECT payload FROM cases WHERE id=:id FOR UPDATE', id=case_id)
        roadmap = one(c, 'SELECT id,version,payload FROM roadmaps WHERE case_id=:id FOR UPDATE', id=case_id)
        # Never overwrite a plan/case that has already been edited or extended.
        if not case or not roadmap or roadmap['version'] != 1 or case['payload'].get('cycle', 1) != 1 or case['payload']['stage'] != 3:
            return
        now = datetime.now(timezone.utc)
        evaluation = {'id': 'journey-demo-evaluation-'+case_id, 'caseId': case_id, 'type': 'assessment',
                      'stage': 4, 'date': (now-timedelta(minutes=5)).isoformat(), 'professionalId': 'p4',
                      'phase': 'final', 'historicalDemo': True,
                      'title': {'ar': 'حوصلة دورة أولى — مثال اصطناعي', 'fr': 'Bilan du cycle initial — exemple synthétique'},
                      'note': 'Exemple synthétique historique : participation aux ateliers documentée. La commission fictive propose de poursuivre les objectifs de coopération ; aucun score individuel n’est produit.'}
        record(c, 'initial_assessments', evaluation['id'], case_id, evaluation, 'assessment', 'p4', created_at=evaluation['date'])
        decision = {'id': marker, 'caseId': case_id, 'kind': 'extend', 'from': 4, 'to': 3, 'stage': 4,
                    'cycle': 2, 'date': now.isoformat(), 'professionalId': 'p4', 'historicalDemo': True,
                    'title': {'ar': 'تمديد أول للتأهيل — قرار تاريخي اصطناعي', 'fr': 'Première prolongation — décision historique synthétique'},
                    'reason': 'Décision humaine fictive et motivée : prolonger le travail de coopération dans un deuxième cycle. L’évaluation initiale et la première version du plan sont conservées. Aucune orientation ni clôture n’est décidée.'}
        record(c, 'case_status_history', marker, case_id, decision, 'administrative', 'p4', created_at=now)
        c.execute(text("UPDATE cases SET payload=jsonb_set(payload,'{cycle}','2'::jsonb) WHERE id=:id"), {'id': case_id})
        goals = [r[0] for r in c.execute(text('SELECT payload FROM roadmap_objectives WHERE case_id=:id ORDER BY id'), {'id': case_id})]
        record(c, 'roadmap_versions', 'journey-demo-cycle2-'+case_id, case_id,
               {**roadmap['payload'], 'goals': goals, 'cycle': 2, 'historicalDemo': True}, 'roadmap', 'p4',
               status='APPROVED', version=2, roadmap_id=roadmap['id'], created_at=now)
        c.execute(text('UPDATE roadmaps SET version=2 WHERE id=:id'), {'id': roadmap['id']})
        print('Synthetic historical second rehabilitation cycle prepared for '+case_id+'.')
