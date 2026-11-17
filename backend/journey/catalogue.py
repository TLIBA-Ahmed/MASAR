"""Presentation catalogue; existing workflow keys and official records stay intact."""
def bi(ar, fr):
    return {'ar': ar, 'fr': fr}


def step(key, ar, fr, category='general', legacy=None, form=None, evidence=None):
    return dict(key=key, title=bi(ar, fr), category=category, legacy=legacy, form=form, evidence=evidence)


STAGES = [
    dict(id=1, title=bi('التسجيل', 'Enregistrement'), short=bi('التسجيل', 'Enregistrement'),
         description=bi('تحديد الهوية وفتح ملف رقمي مركزي واحد.', 'Identifier l’enfant et ouvrir un dossier numérique central unique.'),
         substeps=[step('identity', 'تحديد هوية الطفل', 'Identification de l’enfant', legacy='1-0'),
                   step('folder', 'إنشاء الملف الرقمي', 'Création du dossier numérique', evidence='registration'),
                   step('interview', 'المحادثة الفردية', 'Entretien individuel', 'social', '1-2', 'F01'),
                   step('social-folder', 'فتح الملف الاجتماعي', 'Ouverture du dossier social', 'social', '1-3')]),
    dict(id=2, title=bi('التشخيص والترسيم بالمركز', 'Diagnostic et inscription au centre'), short=bi('التشخيص والترسيم', 'Inscription au centre'),
         description=bi('ملاحظة وتقييم متعدد الاختصاصات وتصنيف بشري موثق.', 'Observation, évaluations pluridisciplinaires et classification documentée par les professionnels.'),
         substeps=[step('observation', 'فترة الملاحظة', 'Période d’observation', 'general', '2-1'),
                   step('social-assessment', 'التقييم الاجتماعي', 'Évaluation sociale', 'social', '2-0'),
                   step('psychological-assessment', 'التقييم النفسي', 'Évaluation psychologique', 'psychological', form='F12'),
                   step('educational-assessment', 'التقييم التربوي', 'Évaluation éducative', 'assessment', '2-2', 'F02'),
                   step('multidisciplinary', 'التقييم متعدد الاختصاصات', 'Évaluation pluridisciplinaire', 'assessment', '2-3', 'F08'),
                   step('classification', 'التصنيف من قبل المهنيين', 'Classification par les professionnels', 'assessment', '2-4'),
                   step('group', 'الإلحاق بمجموعة', 'Affectation à un groupe', evidence='group')]),
    dict(id=3, title=bi('التأهيل والمرافقة', 'Réhabilitation et accompagnement'), short=bi('التأهيل والمرافقة', 'Réhabilitation'),
         description=bi('خطة مشتركة ومشاريع فردية وأنشطة ومتابعة موثقة.', 'Plan partagé, projets individualisés, activités et suivi documenté.'),
         substeps=[step('plan', 'إعداد خطة التأهيل المشتركة', 'Plan de réhabilitation collaboratif', 'roadmap', '3-0'),
                   step('education-project', 'المشروع التربوي الفردي', 'Projet éducatif individualisé', 'roadmap', form='F13'),
                   step('training-project', 'المشروع الفردي للتكوين', 'Projet individuel de formation', 'roadmap', form='F14'),
                   step('supervision', 'الإشراف الإداري', 'Supervision administrative', 'administrative', '3-2'),
                   step('activities', 'الأنشطة التربوية', 'Activités éducatives', 'educational', evidence='activity'),
                   step('workshops', 'الورشات', 'Ateliers', 'educational', evidence='workshop'),
                   step('interventions', 'التدخلات', 'Interventions', 'educational', evidence='intervention'),
                   step('attendance', 'متابعة الحضور', 'Suivi des présences', 'educational', evidence='attendance'),
                   step('observations', 'الملاحظات', 'Observations', 'educational', evidence='observation'),
                   step('intermediate', 'التقييمات الوسيطة', 'Évaluations intermédiaires', 'assessment', evidence='intermediate')]),
    dict(id=4, title=bi('تقييم المسار', 'Évaluation du parcours'), short=bi('تقييم المسار', 'Évaluation'),
         description=bi('حوصلة ومراجعة التقدم وقرار بشري للجنة المركز.', 'Synthèse, examen des progrès documentés et décision humaine de la commission.'),
         substeps=[step('synthesis', 'حوصلة التدخلات', 'Synthèse des interventions', 'educational', '4-0'),
                   step('progress', 'تحليل التقدم الموثق', 'Analyse des progrès documentés', 'assessment', '4-1'),
                   step('final-assessment', 'التقييم النهائي', 'Évaluation finale', 'assessment', evidence='final'),
                   step('commission', 'تقييم لجنة المركز', 'Évaluation par la commission', 'administrative', '4-2'),
                   step('decision', 'القرار المهني', 'Décision professionnelle', 'administrative', '4-3')]),
    dict(id=5, title=bi('التوجيه والإدماج', 'Orientation et intégration'), short=bi('التوجيه والإدماج', 'Intégration'),
         description=bi('توجيه ومتابعة ونتائج موثقة؛ الختم قرار بشري مستقل.', 'Orientation, suivi et résultats documentés ; la clôture reste une décision humaine distincte.'),
         substeps=[step('orientation', 'التوجيه نحو هيكل شريك', 'Orientation vers une structure partenaire', 'administrative', '5-0'),
                   step('integration', 'الإدماج المدرسي أو العائلي أو المهني', 'Intégration scolaire, familiale ou professionnelle', 'administrative', '5-1'),
                   step('follow-up', 'المتابعة بعد الإدماج', 'Suivi après intégration', 'administrative', '5-2'),
                   step('results', 'النتائج الموثقة', 'Résultats documentés', 'administrative', evidence='results'),
                   step('closure', 'الختم عند الاقتضاء', 'Clôture éventuelle', 'administrative', '5-3')]),
]
