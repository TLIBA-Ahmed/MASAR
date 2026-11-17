import { bi } from '../../types';
import type { PartnerStructure, Professional, ProfessionalResource } from '../../types';

const goals = [
  'communication',
  'emotions',
  'cooperation',
  'autonomy',
  'vocational',
  'social',
  'responsibility',
];
export function createProfessionalResources(): ProfessionalResource[] {
  const resources: Omit<ProfessionalResource, 'validatedBy' | 'validatedAt'>[] = [
    {
      id: 'RES-EDU',
      title: bi('دليل أنشطة التعبير والتعاون', 'Guide d’expression et de coopération'),
      description: bi(
        'موارد تربوية مرتبطة بأهداف أكدها المهني.',
        'Supports pédagogiques liés aux objectifs confirmés.',
      ),
      domains: ['education', 'training', 'support'],
      skills: goals,
      content: [
        bi(
          'اختيار تمرين يناسب الهدف المصادق عليه ثم توثيق ملاحظات المشاركة.',
          'Choisir un exercice lié à l’objectif confirmé puis documenter la participation.',
        ),
      ],
      source: bi('مكتبة مسار الاصطناعية', 'Bibliothèque synthétique MASAR'),
    },
    {
      id: 'RES-SOCIAL',
      title: bi('إعداد مقابلة متابعة اجتماعية', 'Préparer un entretien de suivi social'),
      description: bi(
        'خطة تجريبية لمراجعة الأهداف مع المهني والأسرة.',
        'Trame fictive de revue des objectifs avec le professionnel et la famille.',
      ),
      domains: ['social', 'family', 'coordination'],
      skills: goals,
      content: [
        bi(
          'مراجعة الهدف المتفق عليه، جمع رأي الأسرة وتوثيق الخطوة التي يختارها المهني.',
          'Revoir l’objectif convenu, recueillir la parole familiale et documenter l’étape choisie par le professionnel.',
        ),
      ],
      source: bi('مثال مهني محلي', 'Exemple professionnel local'),
    },
    {
      id: 'RES-ORIENTATION',
      title: bi('قائمة تحضير اجتماع الإدماج', 'Préparer une réunion d’intégration'),
      description: bi(
        'دعم تحضير الاجتماع دون اتخاذ قرار توجيه.',
        'Support de préparation sans décision d’orientation.',
      ),
      domains: ['orientation', 'training'],
      skills: goals,
      content: [
        bi(
          'تجميع الأهداف المؤكدة والأسئلة للشركاء؛ يبقى أي توجيه قراراً بشرياً موثقاً.',
          'Réunir les objectifs confirmés et les questions aux partenaires ; toute orientation reste une décision humaine motivée.',
        ),
      ],
      source: bi('مثال تنسيق اصطناعي', 'Exemple synthétique de coordination'),
    },
    {
      id: 'RES-PSY',
      title: bi(
        'دعم التعبير وفق الأهداف المهنية',
        'Soutenir l’expression selon les objectifs professionnels',
      ),
      description: bi(
        'مورد مهني تجريبي لا يقدم تشخيصاً.',
        'Ressource professionnelle fictive sans diagnostic.',
      ),
      domains: ['psychology', 'support'],
      skills: goals,
      content: [
        bi(
          'مراجعة ملاءمة الوسيلة مع الأهداف التي أكدها الأخصائي واحترام رغبة الطفل.',
          'Examiner la pertinence du support au regard des objectifs confirmés et respecter la parole de l’enfant.',
        ),
      ],
      source: bi('مثال خضع لمراجعة مهنية محاكية', 'Exemple avec revue professionnelle simulée'),
      access: {
        allowedRoles: ['psychologist'],
        requiredPermissions: ['psychology.read'],
        attributeConditions: [{ attribute: 'psychologyAuthorized', equals: true }],
      },
    },
    {
      id: 'RES-ADMIN',
      title: bi('قائمة مراجعة التنسيق والوثائق', 'Checklist de coordination documentaire'),
      description: bi(
        'مراجعة المواعيد ومصادر الوثائق دون قرار تلقائي.',
        'Revue des échéances et sources documentaires sans décision automatique.',
      ),
      domains: ['administration', 'coordination'],
      skills: [],
      content: [
        bi(
          'التحقق من الوثيقة المطلوبة والموعد والمسؤول؛ لا تعديل على الوثائق المصادق عليها.',
          'Vérifier la pièce attendue, l’échéance et le responsable ; préserver les versions validées.',
        ),
      ],
      source: bi('قائمة تجريبية محلية', 'Checklist locale de démonstration'),
    },
  ];
  return resources.map((r) => ({
    ...r,
    validatedBy: r.id === 'RES-PSY' ? 'p2' : 'p4',
    validatedAt: '2026-11-14',
  }));
}
export function createPartnerStructures(): PartnerStructure[] {
  return [
    {
      id: 'PART-SCHOOL',
      name: bi('مدرسة الأفق — شريك تجريبي', 'École Horizon — partenaire fictif'),
      description: bi(
        'هيكل اصطناعي للتنسيق المدرسي.',
        'Structure synthétique de coordination scolaire.',
      ),
      services: [bi('تنسيق العودة المدرسية', 'Coordination du retour scolaire')],
      access: { cdisId: 'siliana' },
    },
    {
      id: 'PART-TRAINING',
      name: bi('ورشة التكوين — شريك تجريبي', 'Atelier de formation — partenaire fictif'),
      description: bi(
        'هيكل اصطناعي لدعم التكوين.',
        'Structure synthétique de soutien à la formation.',
      ),
      services: [bi('إعداد لقاء مع المهني', 'Préparation d’un échange professionnel')],
      access: { cdisId: 'gabes' },
    },
  ];
}
export const restrictedDemoProfessional: Professional = {
  id: 'p6',
  name: bi('مربي بمهام محدودة — تجريبي', 'Éducateur à accès limité — démo'),
  role: 'educator',
  specialty: bi('موارد تربوية ضمن تكليف محدود', 'Ressources avec affectation limitée'),
  centerId: 'siliana',
  email: 'limited@example.test',
  availability: '09:00–12:00',
};
