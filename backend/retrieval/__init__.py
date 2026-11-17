"""Shared authorization-first retrieval for autocomplete, Browser and recommendations."""
import json,re,unicodedata
from ..db import rows,one
from ..authorization import AuthorizationService,Purpose
from ..ai_client import gateway
from ..config import settings
from ..privacy import ChildPrivacyService

def normalize(text):
    text=unicodedata.normalize('NFD',text.lower()).translate(str.maketrans('أإآٱىة','اااايه'))
    return ' '.join(re.sub(r'[^\wء-ي-]+',' ',''.join(ch for ch in text if not unicodedata.combining(ch) and ch!='ـ')).replace('œ','oe').replace('æ','ae').split())
def plain(value):
    if isinstance(value,dict):return ' '.join(plain(v) for k,v in value.items() if k not in ['access','professionalValidation'])
    if isinstance(value,list):return ' '.join(plain(v) for v in value)
    return str(value) if value is not None else ''
def bilingual(value):return value if isinstance(value,dict) and 'ar' in value else {'ar':str(value),'fr':str(value)}
def document(key,kind,title,content,path,**extra):return {'id':key,'type':kind,'title':bilingual(title),'excerpt':bilingual(content),'path':path,**extra}

class AuthorizedRetrievalService:
    def __init__(self,c,e):self.db=c;self.employee=e;self.policy=AuthorizationService(c,e)
    def corpus(self):
        scope=self.policy.get_authorized_retrieval_scope(Purpose.BROWSER)
        result=[]
        for case in rows(self.db,'SELECT c.id,c.payload,ch.payload AS child FROM cases c JOIN children ch ON ch.id=c.child_id ORDER BY c.id'):
            title={k:case['id']+' — '+case['child']['name'][k] for k in ['ar','fr']}
            result.append(document(case['id'],'case',title,case['id'],f"/cases/{case['id']}",caseId=case['id']))
            for form in rows(self.db,'SELECT id,category,payload FROM form_definitions ORDER BY id'):
                did=case['id']+'-'+form['id']
                if one(self.db,"SELECT authz.record_allowed(:id,:cat,:s,:did,'read') AS ok",id=case['id'],cat=form['category'],s=3 if form['category']=='psychological' else 1,did=did)['ok']:
                    result.append(document('form-'+did,'form',form['payload']['title'],case['id']+' '+form['id'],f"/documents/{case['id']}/{form['id']}",caseId=case['id']))
        for row in rows(self.db,'SELECT v.id,v.case_id,v.form_id,v.payload,d.title FROM document_versions v JOIN documents d ON d.id=v.document_id ORDER BY v.id'):
            result.append(document(row['id'],'document',row['title'],plain(row['payload'].get('values',{}))[:240],f"/documents/{row['case_id']}/{row['form_id']}?version={row['id']}",caseId=row['case_id']))
        for table,kind in [('observations','observation'),('professional_notes','observation'),('initial_assessments','evaluation'),('roadmaps','project'),('planned_interventions','intervention'),('appointments','appointment'),('tasks','task')]:
            for row in rows(self.db,f'SELECT id,case_id,payload FROM {table} ORDER BY id'):
                p=row['payload'];result.append(document(row['id'],kind,p.get('title',p.get('name',row['id'])),plain(p)[:500],f"/cases/{row['case_id']}?tab={'project' if kind=='project' else 'history'}",caseId=row['case_id']))
        for row in rows(self.db,'SELECT id,kind,payload FROM interventions ORDER BY id'):
            p=row['payload'];result.append(document(row['id'],row['kind'],p['title'],p['description'],'/library?activity='+row['id'] if row['kind']=='activity' else '/search?resource='+row['id']))
        for row in rows(self.db,'SELECT id,payload FROM activity_sessions ORDER BY id'):
            p=row['payload'];result.append(document(row['id'],'workshop',p.get('group',row['id']),p['date'],'/sessions?session='+row['id']))
        for row in rows(self.db,'SELECT id,payload FROM partner_structures ORDER BY id'):
            p=row['payload'];result.append(document(row['id'],'partner',p['name'],p['description'],'/search?resource='+row['id']))
        return ChildPrivacyService(self.db).project(result)
    def text_search(self,query,category='all'):
        if ChildPrivacyService(self.db).text(query)!=query:return {'intent':None,'results':[],'counts':{}}
        terms=normalize(query).split()
        if not terms:return {'intent':None,'results':[],'counts':{}}
        authorized=self.corpus() # No unauthorized input reaches matching/ranking.
        results=[]
        for item in authorized:
            if category!='all' and item['type']!=category:continue
            text=normalize(plain(item))
            if all(term in text for term in terms):
                score=sum(4 if term in normalize(plain(item['title'])) else 1 for term in terms)
                results.append((score,item))
        results.sort(key=lambda x:(-x[0],x[1]['id']))
        counts={}
        for _,item in results:counts[item['type']]=counts.get(item['type'],0)+1
        return {'intent':None,'results':[r[1] for r in results[:80]],'counts':counts}
    def evidence(self,query,case_id=None,query_embedding=None):
        self.policy.get_authorized_retrieval_scope(Purpose.BROWSER)
        if case_id:self.policy.require_case(case_id)
        # RLS evaluates live source policy, never copied chunk policy labels alone.
        parameters={'query':normalize(query),'case':case_id}
        vector="NULL AS distance"
        if query_embedding is not None:
            parameters['vector']=json.dumps(query_embedding);vector='embedding <=> CAST(:vector AS vector) AS distance'
        candidates=rows(self.db,f"""SELECT id,document_id,document_version_id,knowledge_id,case_id,chunk_text,page_number,section_title,source_version,language,
          ts_rank(search_vector,websearch_to_tsquery('simple',:query)) AS text_rank,{vector}
          FROM document_chunks WHERE (CAST(:case AS text) IS NULL OR case_id=:case OR case_id IS NULL)
          AND ((document_id IS NOT NULL AND authz.document_allowed(document_id)) OR knowledge_id IS NOT NULL)
          ORDER BY id LIMIT 1000""",**parameters)
        stopwords=set('le la les de des du un une et en pour dans qui que quels quelles comment est au aux ce ces ما هي هو من في علي الي و عن هل كيف'.split())
        terms=set(normalize(query).split())-stopwords;ranked=[]
        for r in candidates:
            overlap=len(terms&set(normalize(r['chunk_text']).split()))
            semantic=(1-float(r['distance'])) if r['distance'] is not None else 0
            score=float(r['text_rank'])+overlap+semantic
            if overlap or semantic>.9:ranked.append((score,dict(r)))
        ranked.sort(key=lambda r:(-r[0],r[1]['id']))
        return ChildPrivacyService(self.db).project([r[1] for r in ranked[:settings.max_passages]])
    def reauthorize_evidence(self,evidence):
        if not evidence:return []
        ids=[r['id'] for r in evidence]
        allowed={r['id'] for r in rows(self.db,'SELECT id FROM document_chunks WHERE id=ANY(:ids)',ids=ids)}
        return [r for r in evidence if r['id'] in allowed and (not r['document_id'] or self.policy.can_access_document(r['document_id']))]
    def sources(self,evidence):
        result=[]
        for r in evidence:
            if r['document_id']:
                doc=one(self.db,'SELECT title FROM documents WHERE id=:id',id=r['document_id']);version=one(self.db,'SELECT form_id FROM document_versions WHERE id=:id',id=r['document_version_id'])
                if not doc or not version:continue
                path=f"/documents/{r['case_id']}/{version['form_id']}?version={r['document_version_id']}" if version['form_id'] else '/api/v1/document-versions/'+r['document_version_id']+'/original'
                title=doc['title']
            else:
                k=one(self.db,'SELECT payload FROM knowledge_items WHERE id=:id',id=r['knowledge_id'])
                if not k:continue
                title=k['payload'].get('title',bilingual(r['knowledge_id']));path='/library?activity='+r['knowledge_id']
            result.append({'source_id':r['id'],'document_id':r['document_id'] or r['knowledge_id'],'title':title,'page':r['page_number'],'section':r['section_title'],'version':r['source_version'],'path':path})
        return result
