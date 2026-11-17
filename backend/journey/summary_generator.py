"""Bounded extractive Qwen3 selection through the existing private CPU gateway."""
from ..config import settings
from ..ai_client import gateway,LocalModelError
from ..browser import unsafe


class StageSummaryGenerator:
    def generate_preview(self,context):
        value=self.deterministic(context)
        return dict(summary_ar=value['ar'],summary_fr=value['fr'],generation_method='deterministic',model_version=None)

    def deterministic(self,context):
        sections=context['sections']
        items=[]
        for key in ('situation','observations','actions','progress','decisions','objectives','next_actions'):
            if sections[key]:items.append(sections[key][0]['text'])
        empty={'ar':'هذه المرحلة لم تبدأ؛ المعلومات والإجراءات القادمة في الانتظار.' if not context['started'] else 'لا توجد معلومات موثقة متاحة لهذه المرحلة ضمن نطاقك الحالي.',
               'fr':'Étape non commencée ; informations et prochaines actions en attente.' if not context['started'] else 'Aucune information documentée disponible pour cette étape dans votre périmètre actuel.'}
        return {lang:'\n'.join(t[lang] for t in items[:3]) if items else empty[lang] for lang in ('ar','fr')}

    def generate(self,context,manual=None):
        summary=self.deterministic(context)
        if manual:return dict(summary_ar=manual['ar'],summary_fr=manual['fr'],generation_method='manual',model_version=None)
        method='deterministic_demo' if settings.ai_mode=='demo' else 'deterministic'
        model=None
        if settings.ai_mode=='local' and context['started'] and context['source_references']:
            try:
                selected={}
                for lang in ('ar','fr'):
                    options=[]
                    for values in context['sections'].values():
                        for item in values:
                            if len(options)>=8:break
                            if unsafe(item['text'][lang]):continue
                            options.append({'source_id':'S'+str(len(options)+1),'text':item['text'][lang][:280]})
                    if not options:raise LocalModelError('NO_RELIABLE_EXTRACT')
                    envelope=gateway.request('/internal/models/slm/generate',dict(task='Select one documented stage-specific excerpt. No inference, diagnosis or decision.',
                        context='\n'.join('['+o['source_id']+'] '+o['text'] for o in options),language=lang,source_ids=[o['source_id'] for o in options],evidence_options=options))
                    output=envelope['result']
                    if not any(output.get('answer')==o['text'] and output.get('source_ids')==[o['source_id']] for o in options):
                        return dict(summary_ar=summary['ar'],summary_fr=summary['fr'],generation_method='deterministic_invalid_output',model_version=None)
                    selected[lang]=output['answer'];model=envelope.get('model_revision')
                summary=selected;method='ai'
            except (LocalModelError,KeyError,TypeError):method='deterministic_unavailable'
        return dict(summary_ar=summary['ar'],summary_fr=summary['fr'],generation_method=method,model_version=model if method=='ai' else None)
