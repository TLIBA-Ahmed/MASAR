import { bi } from '../../types';
import type { FieldDefinition, FieldType, FormDefinition, FormSection, Role, Stage } from '../../types';

/**
 * Additive catalogue sourced from the new CDIS Siliana document pack (November 2026).
 * Existing F01–F15 stay untouched. All observations and psychological conclusions
 * are entered by an authorized professional; no automated classification or score.
 */
const field = (
  key: string,
  ar: string,
  fr: string,
  type: FieldType = 'text',
  extra: Partial<FieldDefinition> = {},
): FieldDefinition => ({ key, label: bi(ar, fr), type, ...extra });

const area = (key: string, ar: string, fr: string) => field(key, ar, fr, 'textarea');
const date = (key: string, ar: string, fr: string) => field(key, ar, fr, 'date');
const num = (key: string, ar: string, fr: string) => field(key, ar, fr, 'number', { min: 0 });
const choose = (
  key: string, ar: string, fr: string,
  options: [string, string][],
  type: 'select' | 'multi' | 'radio' = 'select',
) => field(key, ar, fr, type, {
  options: options.map(([a, f], index) => ({ value: String(index), label: bi(a, f) })),
});
const grid = (
  key: string, ar: string, fr: string,
  columns: [string, string, string][],
) => field(key, ar, fr, 'table', {
  columns: columns.map(([k, a, f]) => ({ key: k, label: bi(a, f) })),
});
const section = (id: string, ar: string, fr: string, fields: FieldDefinition[]): FormSection =>
  ({ id, title: bi(ar, fr), fields });
const identity = (): FieldDefinition[] => [
  field('caseCode', 'رمز الملف', 'Code du dossier', 'text', { shared: 'caseId' }),
  field('childName', 'الاسم واللقب داخل الملف المحمي', 'Nom dans le dossier protégé', 'text', { shared: 'name' }),
  date('birthDate', 'تاريخ الولادة', 'Date de naissance'),
];
const define = (
  id: string, ar: string, fr: string, stages: Stage[],
  role: Role, sections: FormSection[], references: string[],
): FormDefinition => ({
  id: 'F' + id, title: bi(ar, fr), stages, role,
  sections, version: 1, reference: references,
});

const fourLevels: [string, string][] = [
  ['غير متحقق', 'Non atteint'], ['جزئيا', 'Partiellement atteint'],
  ['إلى حد كبير', 'Largement atteint'], ['متحقق', 'Atteint'],
];

/** Newly provided sources that are not equivalent to one of F01–F15. */
export const additionalForms: FormDefinition[] = [
  define('16', 'التفكير في مشروع حياة', 'Réflexion sur un projet de vie', [3, 5], 'educator', [
    section('context', 'معلومات عامة', 'Informations générales', [
      ...identity(),
      num('ageAtInterview', 'السن عند المقابلة', 'Âge lors de l’entretien'),
      field('schoolLevel', 'المستوى التعليمي', 'Niveau scolaire', 'text', { shared: 'education' }),
      date('schoolDropout', 'تاريخ الانقطاع', 'Date de sortie de l’école'),
      date('admissionDate', 'تاريخ الالتحاق بالمركز', 'Date d’admission'),
    ]),
    section('self', 'التقييم الذاتي', 'Auto-évaluation et expression du jeune', [
      area('positiveBehaviors', 'السلوكات الإيجابية حسب رأي الطفل', 'Comportements positifs selon le jeune'),
      area('difficulties', 'السلوكات السلبية حسب رأي الطفل', 'Difficultés décrites par le jeune'),
      area('hobbies', 'الهوايات', 'Centres d’intérêt'),
      area('achievements', 'المكتسبات خلال الدورات والورشات بالمركز', 'Acquis des cycles et ateliers'),
      area('vocationalSkills', 'المهارات والقدرات المهنية والتجارب السابقة', 'Compétences et expériences professionnelles'),
    ]),
    section('future', 'الميولات والاختيارات المستقبلية', 'Choix exprimés pour l’avenir', [
      choose('preferences', 'الميولات والخيارات المستقبلية', 'Orientations envisagées', [
        ['تدريب مهني', 'Stage professionnel'], ['تكوين مهني', 'Formation professionnelle'],
        ['تشغيل', 'Emploi'], ['العودة إلى مقاعد الدراسة', 'Retour à l’école'],
      ], 'multi'),
      area('preferredSpecialty', 'الاختصاص أو مجال الاهتمام', 'Spécialité ou domaine souhaité'),
      area('familySupport', 'مساعدة العائلة والهيكل على الإدماج', 'Accompagnement familial et institutionnel'),
      area('teamOpinion', 'رأي الفريق متعدد الاختصاصات', 'Avis documenté de l’équipe pluridisciplinaire'),
      field('youngPersonVisa', 'إمضاء الطفل (محاكاة)', 'Visa du jeune (simulation)'),
      field('guardianVisa', 'إمضاء الولي (محاكاة)', 'Visa du représentant légal (simulation)'),
    ]),
  ], ['12_التفكير في مشروع حياة.pdf']),

  define('17', 'جدول ملاحظة', 'Grille d’observation longitudinale', [2, 3, 4], 'educator', [
    section('context', 'بيانات الملاحظة', 'Contexte de l’observation', [
      ...identity(),
      field('cycle', 'الدورة التأهيلية', 'Cycle de réhabilitation'),
      date('observationDate', 'تاريخ الملاحظة', 'Date de l’observation'),
      field('observer', 'المختص المكلف', 'Professionnel observateur', 'text', { shared: 'referent' }),
    ]),
    section('measure', 'مستوى المكتسبات', 'Observation descriptive des acquis', [
      grid('observationLines', 'جدول المجالات والقدرات', 'Domaines et compétences observées', [
        ['domain', 'المجال', 'Domaine'],
        ['skill', 'القدرة أو المؤشر', 'Compétence ou indicateur'],
        ['previous', 'المستوى السابق', 'Niveau précédent'],
        ['current', 'المستوى الحالي', 'Niveau actuel'],
        ['examples', 'أمثلة وملاحظات', 'Exemples et observations'],
      ]),
      area('summary', 'الملاحظات العامة', 'Observations générales du professionnel'),
    ]),
  ], ['16_جدول ملاحظة.pdf']),

  define('18', 'الملف النفسي', 'Dossier psychologique détaillé', [2, 3, 4], 'psychologist', [
    section('context', 'البيانات العامة', 'Identification protégée et contexte clinique', [
      ...identity(),
      choose('caseType', 'تصنيف الحالة المدوّن من المختص', 'Catégorie déjà documentée par le professionnel', [
        ['طفل مهدد', 'Enfant en danger'], ['طفل جانح', 'Enfant en conflit avec la loi'],
        ['غير متكيف', 'Difficultés d’adaptation'],
      ]),
      area('referralReason', 'مصدر الإحالة وسببها', 'Origine et motif de l’orientation'),
      area('request', 'دافع وطلب المقابلة', 'Motif et demande de consultation'),
    ]),
    section('family', 'التاريخ العائلي والصحي', 'Histoire familiale et santé', [
      area('familyComposition', 'تركيبة العائلة', 'Composition familiale'),
      area('familyHistory', 'الأحداث الهامة في التاريخ العائلي', 'Événements familiaux significatifs'),
      area('healthHistory', 'التاريخ الصحي', 'Antécédents de santé'),
      area('otherProfessionals', 'معاينات أطراف أخرى', 'Constats d’autres intervenants'),
    ]),
    section('development', 'التاريخ الشخصي والنمو', 'Anamnèse et développement', [
      area('pregnancyHistory', 'فترة الحمل والولادة', 'Grossesse et naissance'),
      area('psychomotor', 'النمو النفسي الحركي', 'Développement psychomoteur'),
      area('language', 'النمو اللغوي', 'Développement du langage'),
      area('functionalAutonomy', 'الاستقلالية الوظيفية', 'Autonomie fonctionnelle'),
      area('affectiveDevelopment', 'النمو النفسي العاطفي', 'Développement affectif'),
      area('schoolHistory', 'المسار الدراسي', 'Parcours scolaire'),
    ]),
    section('observations', 'الملاحظات الإكلينيكية', 'Observations cliniques du spécialiste', [
      area('cognitive', 'السمات الذهنية والمعرفية', 'Fonctions cognitives observées'),
      area('emotional', 'السمات الوجدانية والانفعالية', 'Expression affective et émotionnelle'),
      area('social', 'العلاقات الأسرية والاجتماعية', 'Relations familiales et sociales'),
      area('dailyLife', 'النوم والأكل واللعب والاستقلالية', 'Vie quotidienne, sommeil, repas, jeu'),
      area('interviews', 'الحضور والمشاركة أثناء المقابلات', 'Observation en entretien'),
      area('assessments', 'الروائز والاختبارات المستعملة', 'Épreuves et tests utilisés'),
    ]),
    section('professional', 'التقييم والتدخل المهني', 'Conclusion et plan du professionnel', [
      area('issues', 'الإشكالية', 'Problématique documentée'),
      area('clinicalInterpretation', 'التقييم المهني', 'Appréciation du spécialiste'),
      area('interventionProposal', 'التوصيات وبرنامج التدخل', 'Recommandations et programme'),
      date('completedAt', 'التاريخ', 'Date'),
      field('professionalVisa', 'إمضاء المختص (محاكاة)', 'Visa du spécialiste (simulation)'),
    ]),
  ], ['18_الملف النفسي.docx']),

  define('19', 'الوضع النفسي', 'État psychologique — observations', [2, 3, 4], 'psychologist', [
    section('context', 'بيانات التقييم', 'Référence de l’évaluation', [
      ...identity(), field('cycle', 'الدورة التأهيلية', 'Cycle'),
      field('psychologist', 'الأخصائي النفساني', 'Psychologue'), date('assessmentDate', 'التاريخ', 'Date'),
    ]),
    section('findings', 'المستويات الملاحظة', 'Dimensions observées', [
      area('behavioral', 'المستوى السلوكي', 'Dimension comportementale'),
      area('affective', 'المستوى العاطفي الوجداني', 'Dimension affective et émotionnelle'),
      area('relational', 'المستوى العلائقي', 'Dimension relationnelle'),
      area('initialIssues', 'الإشكاليات الأولية', 'Difficultés initialement relevées'),
      area('interventions', 'التدخلات', 'Interventions réalisées'),
      area('proposals', 'الاقتراحات', 'Propositions du professionnel'),
      field('visa', 'الإمضاء والختم (محاكاة)', 'Visa et cachet (simulation)'),
    ]),
  ], ['19_الوضع النفسي.docx']),

  define('20', 'المشروع الإفرادي النفسي', 'Projet individuel psychologique', [3, 4], 'psychologist', [
    section('issues', 'الإشكاليات', 'Difficultés documentées', [
      ...identity(), area('principal', 'الإشكاليات الرئيسية', 'Problématiques principales'),
      area('secondary', 'الإشكاليات الفرعية', 'Problématiques secondaires'),
    ]),
    section('program', 'أهداف التدخل ومنهجيته', 'Objectifs et méthodologie', [
      grid('plan', 'المشروع الإفرادي النفسي', 'Objectifs du projet', [
        ['date', 'التاريخ', 'Date'], ['goal', 'أهداف التدخل', 'Objectifs'],
        ['method', 'منهجية التدخل', 'Méthodologie'], ['resources', 'وسائل التدخل', 'Moyens'],
        ['duration', 'مدة التدخل', 'Durée'], ['difficulties', 'الصعوبات المعترضة', 'Difficultés rencontrées'],
      ]),
    ]),
  ], ['20_المشروع الإفرادي النفسي.docx']),

  define('21', 'البرنامج الإفرادي النفسي', 'Programme individuel psychologique', [3, 4], 'psychologist', [
    section('issues', 'الإشكاليات', 'Problématiques professionnelles', [
      ...identity(), area('principal', 'الإشكاليات الرئيسية', 'Problématiques principales'),
      area('secondary', 'الإشكاليات الفرعية', 'Problématiques secondaires'),
    ]),
    section('activities', 'برنامج التدخل', 'Programme des interventions', [
      grid('interventionSchedule', 'البرنامج الإفرادي النفسي', 'Plan des séances', [
        ['date', 'التاريخ', 'Date'], ['goal', 'أهداف التدخل', 'Objectif'],
        ['means', 'وسائل التدخل', 'Moyens'], ['duration', 'مدة التدخل', 'Durée'],
        ['obstacles', 'الصعوبات المعترضة', 'Obstacles relevés'],
      ]),
    ]),
  ], ['21_البرنامج الإفرادي النفسي.docx']),

  define('22', 'خطة التعهد النفسي وتعديل السلوك', 'Plan d’accompagnement psychologique et comportemental', [2, 3, 4], 'psychologist', [
    section('identification', 'البيانات الشخصية المحمية', 'Identification protégée', [
      ...identity(), field('educationLevel', 'المستوى التعليمي', 'Niveau scolaire', 'text', { shared: 'education' }),
      area('familyContext', 'الوضعية العائلية', 'Situation familiale'),
      date('admissionDate', 'تاريخ الالتحاق بالمركز', 'Date d’admission'),
      field('psychologist', 'اسم الأخصائي النفساني', 'Psychologue'),
      date('interviewDate', 'تاريخ إجراء المقابلة', 'Date de l’entretien'),
    ]),
    section('context', 'المعطيات النفسية والاجتماعية', 'Contexte documenté par le spécialiste', [
      area('familySituation', 'الوضعية الأسرية', 'Situation familiale'),
      area('socialRelationships', 'العلاقات الاجتماعية', 'Relations sociales'),
      area('emotionalState', 'الحالة النفسية والانفعالية', 'État émotionnel observé'),
    ]),
    section('abc', 'التحليل الوظيفي للسلوك ABC', 'Analyse fonctionnelle ABC — saisie humaine', [
      grid('abcEvents', 'السوابق والسلوك والنتائج', 'Événements ABC', [
        ['date', 'التاريخ', 'Date'], ['antecedent', 'A - السوابق', 'A — Antécédents'],
        ['behavior', 'B - السلوك', 'B — Comportement observé'],
        ['consequence', 'C - النتائج', 'C — Conséquences observées'],
        ['notes', 'ملاحظات', 'Notes du professionnel'],
      ]),
      area('priorities', 'السلوكات المستهدفة والأولويات', 'Priorités définies par le psychologue'),
    ]),
    section('plan', 'خطة التدخل', 'Plan d’intervention', [
      grid('interventions', 'التدخلات المبرمجة', 'Interventions planifiées', [
        ['behavior', 'السلوك المستهدف', 'Comportement ciblé'],
        ['alternative', 'الهدف السلوكي البديل', 'Objectif alternatif'],
        ['technique', 'أسلوب وتقنية التدخل', 'Approche professionnelle'],
        ['indicator', 'المؤشر القابل للقياس', 'Indicateur suivi'],
        ['duration', 'المدة الزمنية', 'Durée'],
      ]),
      grid('sessions', 'البرنامج الزمني للحصص', 'Séances planifiées', [
        ['date', 'التاريخ', 'Date'], ['session', 'الجلسة', 'Séance'],
        ['notes', 'ملاحظات', 'Observations'],
      ]),
    ]),
    section('monthly', 'بطاقة المتابعة الشهرية', 'Suivi mensuel longitudinal', [
      grid('indicators', 'المؤشرات الكمية للتطور السلوكي', 'Indicateurs suivis par le professionnel', [
        ['indicator', 'المؤشر السلوكي', 'Indicateur'],
        ['baseline', 'بداية المتابعة', 'Situation initiale'],
        ['middle', 'خلال الشهر', 'Mesure intermédiaire'],
        ['final', 'نهاية الشهر', 'Mesure finale'],
        ['target', 'الهدف المتحقق', 'Objectif documenté'],
      ]),
      grid('observations', 'سجل الملاحظات', 'Journal des observations', [
        ['date', 'التاريخ', 'Date'], ['behavior', 'السلوك الملاحظ', 'Observation factuelle'],
        ['environment', 'الظروف والأماكن', 'Contexte'],
        ['action', 'التدخل الفوري', 'Action professionnelle'],
        ['outcome', 'النتائج والتطور', 'Résultats observés'],
      ]),
    ]),
    section('final', 'شبكة التقييم النهائي', 'Évaluation finale par le professionnel', [
      grid('goals', 'مدى تحقق الأهداف', 'État des objectifs', [
        ['goal', 'الهدف السلوكي أو المهارة', 'Objectif ou compétence'],
        ['level', 'تقييم المختص', 'Appréciation du professionnel'],
        ['evidence', 'أدلة وملاحظات', 'Éléments observés'],
      ]),
      choose('conclusion', 'القرار النهائي للأخصائي', 'Conclusion du spécialiste', [
        ['تحسن إيجابي واضح مع متابعة دورية', 'Amélioration observée et suivi'],
        ['تحسن نسبي مع تعديل الخطة', 'Amélioration partielle, adaptation du plan'],
        ['لا تغيير ملحوظ أو تراجع مع إعادة التقييم', 'Stabilité ou recul, réévaluation'],
      ]),
      area('recommendations', 'توصيات الأخصائي النفساني', 'Recommandations du spécialiste'),
      date('finalDate', 'تاريخ التقييم النهائي', 'Date de l’évaluation finale'),
      field('visa', 'اسم وإمضاء الأخصائي (محاكاة)', 'Identité et visa du psychologue (simulation)'),
    ]),
  ], ['22_خطة التعهد النفسي وتعديل السلوك.docx']),
];

/** Source scales are descriptive. This module does not aggregate them into a child score. */
export const observationScale = fourLevels;
