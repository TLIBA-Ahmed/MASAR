import { bi } from '../types';
import type { Bi, Stage } from '../types';
export const stages: {
  id: Stage;
  title: Bi;
  short: Bi;
  description: Bi;
  color: string;
  subStages: Bi[];
}[] = [
  {
    id: 1,
    title: bi('التسجيل', 'Enregistrement'),
    short: bi('التسجيل', 'Enregistrement'),
    description: bi(
      'إنشاء الملف، تحديد مصدر الإحالة والمحادثة الاجتماعية.',
      'Création du dossier, source d’orientation et entretien social.',
    ),
    color: '#419e85',
    subStages: [
      bi('تحديد هوية الطفل وإنشاء الملف الرقمي', 'Identification et création du dossier'),
      bi(
        'جمع البيانات الإدارية ومصدر الإحالة',
        'Informations administratives et source d’orientation',
      ),
      bi('المحادثة الفردية مع الأخصائي الاجتماعي', 'Entretien avec le travailleur social'),
      bi('فتح الملف الاجتماعي والاستدعاء عند الاقتضاء', 'Dossier social et convocation éventuelle'),
    ],
  },
  {
    id: 2,
    title: bi('التشخيص والترسيم بالمركز', 'Diagnostic et inscription au centre'),
    short: bi('التشخيص والترسيم', 'Diagnostic et inscription'),
    description: bi(
      'ملاحظة لمدة شهر وتقييم متعدد الاختصاصات بإشراف المهنيين.',
      'Observation d’un mois et évaluation pluridisciplinaire par les professionnels.',
    ),
    color: '#df963d',
    subStages: [
      bi('الترسيم وتحليل الوضعية الاجتماعية', 'Inscription et analyse sociale'),
      bi('فترة الملاحظة لمدة شهر', 'Observation d’un mois'),
      bi('التقييم الاجتماعي والنفسي والتربوي', 'Évaluations sociale, psychologique et éducative'),
      bi('التقييم الأولي متعدد الاختصاصات', 'Évaluation initiale pluridisciplinaire'),
      bi(
        'التصنيف المهني والتوجيه لمصلحة الإحاطة',
        'Classification humaine et orientation vers le service',
      ),
    ],
  },
  {
    id: 3,
    title: bi('التأهيل والمرافقة', 'Réhabilitation et accompagnement'),
    short: bi('التأهيل والمرافقة', 'Réhabilitation'),
    description: bi(
      'مشروع فردي مشترك، إشراف إداري وأنشطة تربوية مكيّفة.',
      'Projet partagé, supervision administrative et activités adaptées.',
    ),
    color: '#5483c5',
    subStages: [
      bi(
        'خطة إعادة الإدماج المشتركة: اجتماعي، نفسي وتربوي',
        'Feuille de route commune : social, psychologie et éducation',
      ),
      bi(
        'المشروع التربوي والتكويني الفردي عند الاقتضاء',
        'Projets éducatif et de formation individualisés',
      ),
      bi('الإشراف الإداري قبل التدخلات', 'Supervision administrative avant les interventions'),
      bi('الأهداف المصادق عليها واختيار الأنشطة', 'Objectifs confirmés et choix des activités'),
      bi('التدخلات والورشات والحضور', 'Interventions, ateliers et présences'),
      bi(
        'متابعة المشاركة والمهارات والتقييم الوسيط',
        'Participation, compétences et évaluations intermédiaires',
      ),
    ],
  },
  {
    id: 4,
    title: bi('تقييم المسار', 'Évaluation du parcours'),
    short: bi('تقييم المسار', 'Évaluation'),
    description: bi(
      'حوصلة التدخلات، مقارنة التقييمات وقرار لجنة المركز.',
      'Synthèse des interventions, comparaison et décision de la commission.',
    ),
    color: '#33a1af',
    subStages: [
      bi('حوصلة التدخلات والأنشطة المنجزة', 'Synthèse des interventions et activités'),
      bi('مقارنة التقييمات والتقييم النهائي', 'Comparaison des évaluations et évaluation finale'),
      bi('إعداد الملف وعرضه على لجنة المركز', 'Préparation et commission du centre'),
      bi(
        'قرار مهني: التمديد أو مواصلة الإدماج',
        'Décision humaine : prolonger ou poursuivre l’intégration',
      ),
    ],
  },
  {
    id: 5,
    title: bi('التوجيه والإدماج', 'Orientation et intégration'),
    short: bi('التوجيه والإدماج', 'Intégration'),
    description: bi(
      'توجيه موثّق، متابعة الإدماج وقرار مستقل بختم الملف.',
      'Orientation documentée, suivi d’intégration et décision distincte de clôture.',
    ),
    color: '#9678bd',
    subStages: [
      bi('التوجيه للشركاء وبرنامج الفرصة الثانية', 'Orientation partenaires et deuxième chance'),
      bi(
        'الإدماج العائلي أو المدرسي أو التكويني أو المهني',
        'Intégration familiale, scolaire, en formation ou professionnelle',
      ),
      bi('المتابعة بعد الإدماج وتوثيق النتائج', 'Suivi après intégration et résultats'),
      bi('قرار ختم الملف عند الاقتضاء', 'Décision de clôture éventuelle'),
    ],
  },
];
// Proposition de démonstration ; les exigences institutionnelles restent à confirmer.
export const workflowRules = {
  requireReason: true,
  requireSupervisionBeforeInterventions: true,
  requireIntegrationOrJustificationToClose: true,
  observationMonths: 1,
  suggestedRehabilitationMonths: 6,
};
export const skills = {
  communication: bi('التواصل', 'Communication'),
  emotions: bi('التعبير عن المشاعر', 'Expression des émotions'),
  cooperation: bi('التعاون', 'Coopération'),
  confidence: bi('الثقة بالنفس', 'Confiance en soi'),
  autonomy: bi('الاستقلالية', 'Autonomie'),
  creativity: bi('الإبداع', 'Créativité'),
  literacy: bi('المكتسبات المدرسية', 'Acquis scolaires'),
  sport: bi('الأنشطة الرياضية', 'Activités sportives'),
  vocational: bi('التكوين المهني', 'Formation professionnelle'),
  problems: bi('حل المشكلات', 'Résolution de problèmes'),
  responsibility: bi('المسؤولية', 'Responsabilité'),
  social: bi('المهارات الاجتماعية', 'Compétences sociales'),
  regulation: bi('إدارة الانفعالات', 'Gestion des émotions'),
} satisfies Record<string, Bi>;
export const materialLabels: Record<string, Bi> = {
  cards: bi('بطاقات', 'Cartes'),
  paper: bi('ورق', 'Papier'),
  pencils: bi('أقلام', 'Crayons'),
  ball: bi('كرة', 'Ballon'),
  garden: bi('أدوات بستنة', 'Outils de jardinage'),
  books: bi('كتب', 'Livres'),
  tools: bi('أدوات ورشة', 'Outils d’atelier'),
  none: bi('دون تجهيزات', 'Sans matériel'),
};
