import { additionalForms } from './additional';
import { bi } from '../../types';
import type {
  Bi,
  FieldDefinition as Field,
  FieldType,
  FormDefinition,
  FormSection,
  Stage,
} from '../../types';
const opts = (items: [string, string][]) =>
  items.map(([ar, fr], i) => ({ value: String(i), label: bi(ar, fr) }));
export const yesNo = opts([
  ['نعم', 'Oui'],
  ['لا', 'Non'],
  ['لا ينطبق', 'Non applicable'],
]);
export const yesSometimes = opts([
  ['نعم', 'Oui'],
  ['لا', 'Non'],
  ['أحياناً', 'Parfois'],
]);
const levels = opts([
  ['ضعيف', 'Faible'],
  ['دون المتوسط', 'Sous la moyenne'],
  ['متوسط', 'Moyen'],
  ['فوق المتوسط', 'Au-dessus de la moyenne'],
  ['جيد', 'Bon'],
]);
const f = (
  key: string,
  ar: string,
  fr: string,
  type: FieldType = 'text',
  extra: Partial<Field> = {},
): Field => ({ key, label: bi(ar, fr), type, ...extra });
const select = (
  key: string,
  ar: string,
  fr: string,
  items: [string, string][],
  type: FieldType = 'select',
) => f(key, ar, fr, type, { options: opts(items) });
const yn = (key: string, ar: string, fr: string) => f(key, ar, fr, 'radio', { options: yesNo });
const n = (key: string, ar: string, fr: string) => f(key, ar, fr, 'number', { min: 0 });
const area = (key: string, ar: string, fr: string) => f(key, ar, fr, 'textarea');
const date = (key: string, ar: string, fr: string) => f(key, ar, fr, 'date');
const table = (key: string, ar: string, fr: string, cols: [string, string, string][]) =>
  f(key, ar, fr, 'table', { columns: cols.map(([key, ar, fr]) => ({ key, label: bi(ar, fr) })) });
const section = (id: string, ar: string, fr: string, fields: Field[], note?: Bi): FormSection => ({
  id,
  title: bi(ar, fr),
  fields,
  note,
});
const identity = (): Field[] => [
  f('childName', 'الاسم واللقب', 'Nom et prénom', 'text', { shared: 'name', required: true }),
  f('birthDate', 'تاريخ الولادة', 'Date de naissance', 'date', {
    shared: 'birthDate',
    required: true,
  }),
  f('birthplace', 'مكان الولادة', 'Lieu de naissance', 'text', { shared: 'birthplace' }),
  f('address', 'العنوان', 'Adresse', 'text', { shared: 'address' }),
  f('phone', 'رقم الهاتف التجريبي', 'Téléphone fictif', 'text', { shared: 'phone' }),
];
const education = () =>
  f('education', 'المستوى التعليمي', 'Niveau scolaire', 'text', { shared: 'education' });
const professional = () => [
  f('professional', 'الاسم والصفة', 'Nom et qualité', 'text', { shared: 'referent' }),
  date('date', 'التاريخ', 'Date'),
  f('signature', 'الإمضاء التجريبي', 'Visa simulé'),
];
const form = (
  id: string,
  ar: string,
  fr: string,
  stages: Stage[],
  sections: FormSection[],
  role: FormDefinition['role'] = 'educator',
  reference: string[] = [],
): FormDefinition => ({
  id: `F${id}`,
  title: bi(ar, fr),
  stages,
  sections,
  role,
  version: 1,
  reference,
});
const multiCriteria: [string, string][] = [
  ['الانضباط', 'Discipline'],
  ['المعارف الأساسية', 'Acquis fondamentaux'],
  ['الثقة في النفس وتقدير الذات', 'Confiance et estime de soi'],
  ['التعبير عن المشاعر بطريقة مناسبة', 'Expression adaptée des émotions'],
  ['التحكم في الانفعالات وإدارة الغضب', 'Régulation émotionnelle et colère'],
  ['اتخاذ القرار وحل المشكلات', 'Décision et résolution de problèmes'],
  ['التواصل مع المجموعة', 'Communication avec le groupe'],
  ['قابلية التعلم والمشاركة', 'Apprentissage et participation'],
  ['الاستقلالية في العناية بالنفس', 'Autonomie dans les soins personnels'],
  ['علاقة إيجابية مع الأسرة', 'Relation positive avec la famille'],
  ['أسرة متعاونة', 'Coopération de la famille'],
];
const behavior: [string, string][] = [
  ['يعتني بمظهره', 'Prend soin de son apparence'],
  ['عنيف لفظياً', 'Violence verbale observée'],
  ['عنيف جسدياً', 'Violence physique observée'],
  ['كثير الحركة', 'Activité motrice importante'],
  ['يحترم الآخر', 'Respecte autrui'],
  ['له أخطاء ذهنية (في بعدها المفهومي) — للتثبت', 'Libellé conceptuel à confirmer'],
  ['مواظب', 'Assidu'],
  ['منضبط', 'Discipliné'],
  ['مهتم', 'Intéressé'],
  ['مستفز — للتثبت', 'Provocateur — à confirmer'],
  ['له روح المسؤولية', 'Sens des responsabilités'],
  ['له ثقة بنفسه', 'Confiance en soi'],
  ['منسجم', 'À l’aise dans le groupe'],
  ['متعاون', 'Coopératif'],
  ['مبادر', 'Prend des initiatives'],
];
const aptitudes: [string, string][] = [
  ['قادر على التعبير بتوظيف الجسد', 'Expression corporelle'],
  ['مسرح', 'Théâtre'],
  ['رسم', 'Dessin'],
  ['قادر على التواصل', 'Communication'],
  ['قادر على الانتباه', 'Attention'],
  ['قادر على التركيز', 'Concentration'],
  ['الذاكرة', 'Mémoire'],
  ['قادر على القراءة', 'Lecture'],
  ['قادر على الكتابة', 'Écriture'],
  ['قادر على التحليل', 'Analyse'],
  ['قادر على الاستنتاج', 'Déduction'],
  ['قادر على الابتكار', 'Créativité'],
  ['لديه حس فني', 'Sens artistique'],
  ['قادر على إنجاز مشروع', 'Réalisation de projet'],
  ['قادر على إنهاء مشروع', 'Achèvement de projet'],
];
const matrix = (
  key: string,
  ar: string,
  fr: string,
  rows: [string, string][],
  columns: [string, string][],
  options = yesSometimes,
) =>
  f(key, ar, fr, 'matrix', {
    rows: rows.map(([a, b]) => bi(a, b)),
    columns: columns.map(([a, b], i) => ({ key: String(i), label: bi(a, b) })),
    options,
  });
const relations = opts([
  ['جيدة', 'Bonne'],
  ['عادية', 'Ordinaire'],
  ['متوترة', 'Tendue'],
  ['عدائية', 'Hostile'],
  ['قطيعة', 'Rupture'],
]);
export const forms: FormDefinition[] = [
  form(
    '01',
    'دليل المحادثة الفردية',
    'Guide de l’entretien individuel',
    [1, 2],
    [
      section('identity', 'التعريف بالطفل', 'Identification', [
        ...identity(),
        select('environment', 'الوسط', 'Milieu', [
          ['بلدي', 'Communal'],
          ['غير بلدي', 'Non communal'],
        ]),
        education(),
        f('father', 'اسم الأب', 'Nom du père', 'text', { shared: 'father' }),
        f('fatherJob', 'مهنة الأب', 'Profession du père'),
        f('fatherEducation', 'المستوى التعليمي للأب', 'Niveau scolaire du père'),
        f('mother', 'اسم الأم', 'Nom de la mère', 'text', { shared: 'mother' }),
        f('motherJob', 'مهنة الأم', 'Profession de la mère'),
        f('motherEducation', 'المستوى التعليمي للأم', 'Niveau scolaire de la mère'),
        n('siblings', 'عدد الإخوة', 'Nombre de frères et sœurs'),
        n('boys', 'عدد الذكور', 'Garçons'),
        n('girls', 'عدد الإناث', 'Filles'),
        n('siblingRank', 'ترتيب الطفل بين إخوته', 'Rang dans la fratrie'),
        f('referral', 'مصدر الإحالة', 'Source d’orientation'),
        select(
          'contactMode',
          'طريقة الاتصال بالمعني بالأمر',
          'Modalité de contact',
          [
            ['بمفرده', 'Seul'],
            ['صحبة الولي', 'Avec le représentant légal'],
            ['صحبة أفراد أخرى', 'Avec d’autres personnes'],
          ],
          'radio',
        ),
      ]),
      section('school', 'الوضعية المدرسية', 'Situation scolaire', [
        area('situation', 'لمحة عن وضعية الطفل', 'Aperçu de la situation'),
        f('school', 'المدرسة التي زاول بها تعليمه', 'Établissement fréquenté', 'text', {
          shared: 'school',
        }),
        date('dropoutDate', 'تاريخ الانقطاع عن الدراسة', 'Date d’interruption scolaire'),
        n('schoolYears', 'السنوات التي قضاها بالتعليم', 'Années de scolarité'),
        n('repeatedYears', 'سنوات الرسوب', 'Redoublements'),
        select(
          'dropoutReasons',
          'أسباب الانقطاع',
          'Motifs d’interruption',
          [
            ['تلقائي', 'Spontané'],
            ['تجاوز السن القانوني', 'Dépassement de l’âge prévu'],
            ['طرد إثر قرار مجلس التربية', 'Exclusion par le conseil'],
            ['صعوبات التواصل مع الإطار التربوي', 'Difficultés de communication avec l’équipe'],
            ['عدم التكيف الاجتماعي', 'Difficultés d’adaptation sociale'],
            ['ظروف عائلية', 'Contexte familial'],
            ['الانحراف', 'Libellé du document : déviance'],
          ],
          'multi',
        ),
        select(
          'feelings',
          'إحساس الطفل نتيجة انقطاعه عن التعليم',
          'Ressenti après l’interruption',
          [
            ['الندم', 'Regret'],
            ['الحزن', 'Tristesse'],
            ['الارتياح', 'Soulagement'],
            ['اللامبالاة', 'Indifférence'],
          ],
          'multi',
        ),
      ]),
      section('training', 'التدريب المهني', 'Formation professionnelle', [
        yn('hadTraining', 'هل تلقى الطفل تدريباً مهنياً؟', 'Une formation a-t-elle été suivie ?'),
        {
          ...table('trainings', 'التدريبات السابقة', 'Formations antérieures', [
            ['specialty', 'مجال التدريب', 'Domaine'],
            ['duration', 'المدة', 'Durée'],
            ['reason', 'أسباب الانقطاع', 'Motif d’interruption'],
          ]),
          condition: { field: 'hadTraining', value: '0' },
        },
      ]),
      section('leisure', 'الهوايات والمحيط', 'Loisirs et environnement', [
        select(
          'hobbies',
          'الهوايات',
          'Loisirs',
          [
            ['رياضة', 'Sport'],
            ['موسيقى', 'Musique'],
            ['رسم', 'Dessin'],
            ['مطالعة', 'Lecture'],
            ['شعر', 'Poésie'],
            ['صيد', 'Pêche'],
            ['براعات يدوية أخرى', 'Autres activités manuelles'],
          ],
          'multi',
        ),
        yn('practicesHobby', 'هل يمارس هوايته؟', 'Pratique-t-il ses loisirs ?'),
        select(
          'freeTime',
          'أين يقضي الطفل أوقات فراغه؟',
          'Lieux de temps libre',
          [
            ['قاعة ألعاب', 'Salle de jeux'],
            ['المقهى', 'Café'],
            ['الشارع', 'Rue'],
            ['المنزل', 'Domicile'],
            ['أماكن أخرى', 'Autres lieux'],
          ],
          'multi',
        ),
        f(
          'outsideTime',
          'المدة خارج المنزل: ساعات أو كامل اليوم',
          'Temps hors domicile : heures ou journée',
        ),
        select('responsible', 'الشخص الذي يعتبره مسؤولاً عنه', 'Personne perçue comme responsable', [
          ['الأب', 'Père'],
          ['الأم', 'Mère'],
          ['الأخ', 'Frère'],
          ['الأخت', 'Sœur'],
          ['أحد الأقرباء', 'Parent proche'],
          ['أشخاص خارج الأسرة', 'Personnes hors famille'],
          ['مسؤول عن نفسه', 'Lui-même'],
        ]),
        select(
          'familyNeeds',
          'هل توفر العائلة متطلبات الطفل؟',
          'Besoins couverts par la famille',
          [
            ['الأكل', 'Alimentation'],
            ['اللباس', 'Vêtements'],
            ['العلاج', 'Soins'],
            ['الترفيه', 'Loisirs'],
            ['طلبات أخرى', 'Autres'],
          ],
          'multi',
        ),
      ]),
      section(
        'expectations',
        'الانتظارات من المركز',
        'Attentes envers le centre',
        [
          yn(
            'knowsCenter',
            'هل لديك فكرة عن نشاط المركز؟',
            'Connaissance des activités du centre ?',
          ),
          select(
            'services',
            'الخدمات التي تنتظرها من المركز',
            'Services attendus',
            [
              ['تعليم', 'Enseignement'],
              ['تأهيل تربوي', 'Réhabilitation éducative'],
              ['تكوين مهني منظّر', 'Formation professionnelle reconnue'],
              ['شغل', 'Emploi'],
              ['أخرى', 'Autres'],
            ],
            'multi',
          ),
        ],
        bi(
          'التعريف بمهام المركز والخدمات المتاحة وطرح الأسئلة حول رغبة الطفل في الالتحاق.',
          'Présenter les missions et services du centre et recueillir le souhait de l’enfant d’y participer.',
        ),
      ),
      section('observations', 'الملاحظات المهنية', 'Observations professionnelles', [
        select('appearance', 'الهندام', 'Tenue', [
          ['لائق', 'Adaptée'],
          ['رث', 'Usée'],
        ]),
        select('hygiene', 'الجسم', 'Hygiène observée', [
          ['نظيف', 'Propre'],
          ['غير نظيف', 'À accompagner'],
        ]),
        yn(
          'injuries',
          'هل تبدو عليه مظاهر عنف أو آثار جروح؟',
          'Traces visibles de violence ou de blessures ?',
        ),
        select('communication', 'مدى قدرة الطفل على التواصل', 'Communication', [
          ['جيدة', 'Bonne'],
          ['متوسطة', 'Moyenne'],
          ['محدودة', 'Limitée'],
        ]),
        select('interaction', 'مدى تفاعله مع سير المحادثة', 'Interaction durant l’entretien', [
          ['انتباه', 'Attention'],
          ['لا مبالاة', 'Indifférence'],
          ['شرود ذهني', 'Distraction'],
        ]),
        select('motivation', 'مدى الرغبة في المشاركة في البرامج', 'Souhait de participer', [
          ['متحمس', 'Enthousiaste'],
          ['متردد', 'Hésitant'],
          ['حيادي', 'Neutre'],
          ['سلبي', 'Réservé'],
        ]),
        area('notes', 'الملاحظات', 'Observations'),
        ...professional(),
      ]),
    ],
    'social',
    ['IMG_1001.JPG', 'IMG_1002.JPG', 'IMG_1003.JPG', 'IMG_1004.JPG'],
  ),
  form(
    '02',
    'التدخل التربوي التأهيلي',
    'Intervention éducative et réadaptation',
    [2, 3, 4],
    [
      section('initial', 'البيانات الأولية', 'Informations initiales', [
        date('joined', 'تاريخ الالتحاق بالبرنامج التربوي', 'Entrée dans le programme'),
        education(),
        date('dropoutDate', 'تاريخ الانقطاع عن الدراسة', 'Interruption scolaire'),
        select(
          'reason',
          'سبب الانقطاع',
          'Motif',
          [
            ['ضعف النتائج', 'Résultats insuffisants'],
            ['تجاوز السن القانونية', 'Âge dépassé'],
            ['عدم إمكانية التثليث', 'Troisième inscription impossible'],
            ['رفت نهائي', 'Exclusion définitive'],
            ['ضعف الإمكانيات المادية', 'Difficultés matérielles'],
            ['غياب الرعاية العائلية', 'Absence d’accompagnement familial'],
            ['أخرى', 'Autre'],
          ],
          'multi',
        ),
        select(
          'sinceDropout',
          'الأنشطة منذ الانقطاع',
          'Activités depuis l’interruption',
          [
            ['تدريب مهني', 'Apprentissage'],
            ['تكوين مهني', 'Formation'],
            ['شغل', 'Travail'],
            ['لا شيء', 'Aucune'],
          ],
          'multi',
        ),
        f('leisure', 'كيفية استغلال أوقات الفراغ', 'Occupation du temps libre'),
        f('hobbies', 'الهوايات', 'Loisirs'),
        area('expectations', 'الانتظارات من البرنامج التربوي', 'Attentes du programme'),
        f('educator', 'المربي المرجعي', 'Éducateur référent', 'text', { shared: 'referent' }),
        date('from', 'الملاحظة الأولية: من', 'Observation initiale : du'),
        date('to', 'إلى', 'Au'),
      ]),
      section(
        'observation',
        'شبكة الملاحظة السلوكية',
        'Grille d’observation',
        [
          matrix(
            'initialBehavior',
            'الملاحظة الأولية',
            'Observation initiale',
            [
              ...behavior.slice(0, 4),
              ['مندمج', 'Intégré'],
              ['متعاون', 'Coopératif'],
              ['القيادي', 'Leadership'],
              ['مبادر', 'Initiative'],
              ['طريف', 'Humour'],
              ['مواظب', 'Assiduité'],
              ['منضبط', 'Discipline'],
              ['مدمن', 'Libellé original : dépendance'],
            ],
            [['الملاحظة', 'Observation']],
            opts([
              ['دون دلالة', 'Sans indication'],
              ['له دلالة', 'Avec indication'],
              ['هجين — للتثبت', 'Troisième modalité à confirmer'],
            ]),
          ),
          matrix(
            'initialAptitudes',
            'القدرات الأولية',
            'Aptitudes initiales',
            [
              ['معرفية', 'Cognitives'],
              ['يدوية', 'Manuelles'],
              ['تعبيرية', 'Expressives'],
            ],
            [['المستوى', 'Niveau']],
            levels,
          ),
          area('initialResult', 'نتيجة الملاحظة الأولية', 'Résultat de l’observation'),
        ],
        bi(
          'السلم قابل للتعديل. لا يُحتسب أي مجموع سلوكي. بعض العبارات تتطلب التثبت.',
          'Échelle configurable. Aucun score comportemental global. Certains libellés restent à confirmer.',
        ),
      ),
      section('evaluations', 'التقييمات المتتالية', 'Évaluations successives', [
        matrix('behavior', 'المعايير السلوكية', 'Critères comportementaux', behavior, [
          ['تقييم أولي', 'Initiale'],
          ['تقييم ثاني', 'Deuxième'],
          ['تقييم نهائي', 'Finale'],
        ]),
        matrix(
          'aptitudes',
          'القدرات التعبيرية والمعرفية واليدوية',
          'Aptitudes expressives, cognitives et manuelles',
          aptitudes,
          [
            ['تقييم أولي', 'Initiale'],
            ['تقييم ثاني', 'Deuxième'],
            ['تقييم نهائي', 'Finale'],
          ],
          levels,
        ),
        select('familySupport', 'مساهمة العائلة في المشروع التربوي', 'Contribution familiale', [
          ['متابعة مستمرة', 'Suivi continu'],
          ['متابعة ظرفية', 'Suivi ponctuel'],
          ['لامبالاة', 'Indifférence'],
          ['استقالة', 'Désengagement'],
        ]),
      ]),
      section('results', 'النتائج والتدخلات', 'Résultats et interventions', [
        area('initialSummary', 'نتائج التقييم الأولي', 'Résultats initiaux'),
        area(
          'nextInterventions',
          'التدخلات المقترحة للثلاثية القادمة',
          'Interventions proposées pour le prochain trimestre',
        ),
        area('secondSummary', 'نتائج التقييم الثاني', 'Résultats de la deuxième évaluation'),
        area(
          'secondInterventions',
          'التدخلات المقترحة للثلاثية القادمة',
          'Prochaines interventions',
        ),
        area('finalSummary', 'نتائج التقييم النهائي', 'Résultats finaux'),
        ...professional(),
      ]),
    ],
    'educator',
    ['IMG_1006.JPG', 'IMG_1007.JPG', 'IMG_1008.JPG', 'IMG_1009.JPG'],
  ),
  form(
    '03',
    'استدعاء',
    'Convocation',
    [1],
    [
      section('convocation', 'بيانات الاستدعاء', 'Informations de convocation', [
        date('date', 'تاريخ الاستدعاء', 'Date de convocation'),
        f('recipient', 'السيد(ة)', 'Destinataire'),
        f('address', 'القاطن(ة) بـ', 'Adresse', 'text', { shared: 'address' }),
        f('contact', 'المسؤول المطلوب الاتصال به', 'Professionnel à contacter', 'text', {
          shared: 'referent',
        }),
        date('appointmentDate', 'يوم الموعد', 'Jour du rendez-vous'),
        f('time', 'الساعة', 'Heure', 'time'),
        f('head', 'رئيس مصلحة الوقاية', 'Chef du service de prévention'),
        f('signature', 'الإمضاء', 'Visa simulé'),
      ]),
    ],
    'social',
    ['IMG_1022.JPG'],
  ),
  form(
    '04',
    'بطاقة اتصال',
    'Fiche de contact psychologique',
    [2],
    [
      section(
        'contact',
        'بيانات الاتصال',
        'Contact',
        [
          date('date', 'التاريخ', 'Date'),
          f('recipient', 'إلى السيد', 'À l’attention de'),
          ...identity(),
        ],
        bi(
          'الرجاء التفضل بمساعدتنا على التعهد النفسي لفائدة المعني مع مراجعتنا للمتابعة.',
          'Merci de contribuer à la prise en charge psychologique de la personne concernée et de revenir vers nous pour le suivi.',
        ),
      ),
    ],
    'psychologist',
    ['IMG_1023.JPG'],
  ),
  form(
    '05',
    'بطاقة متابعة تربوية',
    'Fiche de suivi éducatif',
    [3],
    [
      section('identity', 'البيانات العامة', 'Informations générales', [
        f('year', 'السنة التربوية التأهيلية', 'Année éducative'),
        ...identity().slice(0, 2),
        f('educator', 'المربي', 'Éducateur', 'text', { shared: 'referent' }),
      ]),
      section('followup', 'التدخلات والمتابعة', 'Interventions et suivi', [
        table('interventions', 'التدخلات المسجلة', 'Interventions enregistrées', [
          ['date', 'التاريخ', 'Date'],
          ['intervention', 'التدخلات والمتابعة', 'Interventions et suivi'],
          ['notes', 'الملاحظات', 'Observations'],
        ]),
      ]),
    ],
    'educator',
    ['IMG_1024.JPG'],
  ),
  form(
    '06',
    'كراس النشاط اليومي الخاص بالمربي المختص',
    'Registre des activités quotidiennes',
    [3],
    [
      section(
        'daily',
        'النشاط اليومي',
        'Activités quotidiennes',
        [
          date('date', 'التاريخ', 'Date'),
          n('present', 'عدد الأطفال الحاضرين', 'Enfants présents'),
          n('absent', 'عدد الغائبين', 'Enfants absents'),
          table('activities', 'الأنشطة', 'Activités', [
            ['time', 'التوقيت', 'Horaire'],
            ['group', 'المجموعة', 'Groupe'],
            ['activity', 'النشاط', 'Activité'],
            ['goals', 'الأهداف', 'Objectifs'],
            ['materials', 'الوسائل', 'Matériel'],
            ['notes', 'الملاحظات', 'Observations'],
          ]),
          n('engaged', 'أطفال متفاعلين في هذه الحصة', 'Participants actifs à cette séance'),
          n(
            'observing',
            'أطفال غير متفاعلين في هذه الحصة',
            'Participants en observation à cette séance',
          ),
        ],
        bi(
          'تصف المشاركة هذه الحصة فقط ولا تمثل صفة دائمة للطفل.',
          'La participation décrit cette séance uniquement, jamais une étiquette permanente.',
        ),
      ),
    ],
    'educator',
    ['IMG_1025.JPG'],
  ),
  form(
    '07',
    'بطاقة دخول',
    'Fiche d’entrée après absence ou retard',
    [3],
    [
      section('entry', 'بيانات الدخول', 'Entrée', [
        f('childName', 'الاسم واللقب', 'Nom et prénom', 'text', { shared: 'name' }),
        f('group', 'الفوج', 'Groupe'),
        area('reason', 'سبب التأخر أو الغياب', 'Motif du retard ou de l’absence'),
        date('date', 'تاريخ القبول', 'Date d’admission'),
        f('time', 'ساعة القبول', 'Heure d’admission', 'time'),
      ]),
    ],
    'educator',
    ['IMG_1026.JPG'],
  ),
  form(
    '08',
    'بطاقة التقييم الأولي',
    'Évaluation initiale pluridisciplinaire',
    [2],
    [
      section(
        'assessment',
        'التقييم متعدد الاختصاصات',
        'Évaluation pluridisciplinaire',
        [
          ...identity().slice(0, 2),
          matrix('assessment', 'شبكة التقييم', 'Matrice d’évaluation', multiCriteria, [
            ['الجانب التربوي', 'Éducatif'],
            ['الجانب النفسي', 'Psychologique'],
            ['الجانب الاجتماعي', 'Social'],
          ]),
          area('summary', 'الحوصلة المهنية', 'Synthèse professionnelle'),
          ...professional(),
        ],
        bi(
          'تقييم يدوي: نعم، لا، أحياناً. تُحفظ كل نسخة بشكل مستقل.',
          'Évaluation humaine : oui, non, parfois. Chaque version est conservée séparément.',
        ),
      ),
    ],
    'social',
    ['IMG_1027.JPG'],
  ),
  form(
    '09',
    'جدول التقييم النهائي',
    'Tableau d’évaluation finale',
    [4],
    [
      section('final', 'التقييم النهائي', 'Évaluation finale', [
        f('center', 'اسم المركز', 'Centre', 'text', { shared: 'center' }),
        date('from', 'الفترة من', 'Période du'),
        date('to', 'إلى', 'Au'),
        f('group', 'المجموعة', 'Groupe'),
        table('children', 'جدول التقييم', 'Évaluations', [
          ['number', 'الرقم', 'N°'],
          ['name', 'اسم الطفل', 'Enfant'],
          ['attendance', 'المواظبة والانضباط', 'Assiduité et discipline'],
          ['participation', 'المشاركة في الأنشطة', 'Participation'],
          ['skills', 'المهارات المكتسبة', 'Compétences acquises'],
          ['social', 'السلوك الاجتماعي', 'Comportement social'],
          ['progress', 'التقدم الفردي', 'Progrès individuels'],
          ['notes', 'الملاحظات', 'Observations'],
        ]),
        f('signature', 'إمضاء المؤطر', 'Visa simulé de l’encadrant'),
      ]),
    ],
    'educator',
    ['IMG_1028.JPG'],
  ),
  form(
    '10',
    'سجل الهدايا والجوائز',
    'Registre des cadeaux et récompenses',
    [3],
    [
      section('rewards', 'الهدايا والجوائز', 'Cadeaux et récompenses', [
        f('occasion', 'المناسبة', 'Occasion'),
        date('date', 'التاريخ', 'Date'),
        f('place', 'المكان', 'Lieu'),
        table('rewards', 'التوزيع', 'Distribution', [
          ['number', 'الرقم', 'N°'],
          ['name', 'اسم المستفيد', 'Bénéficiaire'],
          ['reward', 'نوع الجائزة / الهدية', 'Cadeau ou récompense'],
          ['value', 'القيمة التقديرية (د.ت)', 'Valeur estimée (TND)'],
          ['notes', 'الملاحظات', 'Observations'],
        ]),
        f(
          'committee',
          'لجنة التنظيم / المسؤول على التوزيع',
          'Comité / responsable de distribution',
        ),
      ]),
    ],
    'administration',
    ['IMG_1029.JPG'],
  ),
  form(
    '11',
    'بطاقة إحالة',
    'Fiche d’orientation interne',
    [2],
    [
      section('referral', 'بيانات الإحالة', 'Orientation interne', [
        ...identity(),
        f('father', 'اسم الأب', 'Père', 'text', { shared: 'father' }),
        f('mother', 'اسم الأم', 'Mère', 'text', { shared: 'mother' }),
        f('healthCoverage', 'التغطية الصحية', 'Couverture santé'),
        education(),
        f('year', 'السنة التربوية', 'Année éducative'),
        area('social', 'الوضعية الاجتماعية', 'Situation sociale'),
        area('psychological', 'الجانب النفسي', 'Dimension psychologique'),
        area('educational', 'الجانب التربوي', 'Dimension éducative'),
        date('referralDate', 'يحال إلى مصلحة الإحاطة بتاريخ', 'Orientation vers le service le'),
      ]),
    ],
    'social',
    ['IMG_1030.JPG'],
  ),
  form(
    '12',
    'جذاذة التقييم النفسي',
    'Fiche d’évaluation psychologique',
    [2, 4],
    [
      section('general', 'البيانات العامة', 'Informations générales', [
        ...identity().slice(0, 2),
        date('date', 'التاريخ', 'Date'),
        f('professional', 'المؤطر / الأخصائي', 'Encadrant / psychologue', 'text', {
          shared: 'referent',
        }),
        area('familySituation', 'الوضعية العائلية', 'Situation familiale'),
        education(),
        area('healthHistory', 'السجل الصحي', 'Historique de santé'),
      ]),
      section(
        'emotional',
        'البعد السلوكي والانفعالي',
        'Dimension comportementale et émotionnelle',
        [
          select('stability', 'الاستقرار الانفعالي', 'Stabilité émotionnelle', [
            ['هادئ', 'Calme'],
            ['متوتر', 'Tendu'],
            ['قلق', 'Anxieux'],
          ]),
          select('socialInteraction', 'التفاعل الاجتماعي', 'Interaction sociale', [
            ['منعزل', 'Isolé'],
            ['مندمج', 'Intégré'],
          ]),
          select('selfControl', 'ضبط النفس', 'Maîtrise de soi', [
            ['متحكم', 'Maîtrisée'],
            ['غير متحكم', 'À accompagner'],
          ]),
          select('rules', 'احترام القواعد', 'Respect des règles', [
            ['مطيع', 'Respecte les règles'],
            ['متمرد', 'En opposition'],
          ]),
          select('selfImage', 'صورة الذات', 'Image de soi', [
            ['واثق', 'Confiant'],
            ['متردد', 'Hésitant'],
            ['فاقد الثقة', 'Confiance à soutenir'],
          ]),
        ],
      ),
      section('cognitive', 'البعد المعرفي', 'Dimension cognitive', [
        matrix(
          'cognition',
          'الملاحظة المعرفية',
          'Observation cognitive',
          [
            ['الانتباه والتركيز', 'Attention et concentration'],
            ['الذاكرة', 'Mémoire'],
            ['المشكلات — المعنى للتثبت', 'Problèmes — sens à confirmer'],
            ['القدرة على التعلم', 'Capacité d’apprentissage'],
          ],
          [['التقدير', 'Appréciation']],
          opts([
            ['ضعيف', 'Faible'],
            ['متوسط', 'Moyen'],
            ['جيد', 'Bon'],
          ]),
        ),
      ]),
      section('social', 'البعد الاجتماعي', 'Dimension sociale', [
        area('peers', 'العلاقة مع الأقران', 'Relations avec les pairs'),
        area('adults', 'العلاقة مع الكبار', 'Relations avec les adultes'),
        area('group', 'السلوك في المجموعة', 'Comportement en groupe'),
      ]),
      section(
        'synthesis',
        'الحوصلة',
        'Synthèse',
        [
          area('strengths', 'نقاط القوة', 'Points forts'),
          area('difficulties', 'النقائص / الصعوبات', 'Difficultés'),
          area('recommendations', 'التوصيات', 'Recommandations professionnelles'),
        ],
        bi(
          'تُحرر الاستنتاجات من قبل الأخصائي. لا يوجد تشخيص آلي.',
          'Conclusions rédigées par un psychologue. Aucun diagnostic automatisé.',
        ),
      ),
    ],
    'psychologist',
    ['IMG_1031.JPG'],
  ),
  form(
    '13',
    'المشروع التربوي الإفرادي',
    'Projet éducatif individualisé',
    [3, 4],
    [
      section('project', 'المشروع التربوي', 'Projet éducatif', [
        ...identity().slice(0, 2),
        f('admission', 'تاريخ القبول بالمؤسسة', 'Admission au centre', 'date', {
          shared: 'openedAt',
        }),
        date('projectDate', 'تاريخ صياغة المشروع التربوي الإفرادي', 'Date du projet'),
        f('year', 'السنة التربوية', 'Année éducative'),
        area(
          'initialSynthesis',
          'حوصلة تأليفية لنتائج التقييم الأولي',
          'Synthèse des évaluations initiales',
        ),
        area('goals', 'الأهداف التربوية الإفرادية', 'Objectifs éducatifs individualisés'),
        table('programs', 'برنامج التدخل بأهدافه التربوية', 'Programme d’intervention', [
          ['goal', 'الهدف', 'Objectif'],
          ['activity', 'النشاط', 'Activité'],
          ['due', 'الأجل', 'Échéance'],
          ['professional', 'المتدخل', 'Professionnel'],
        ]),
        n('months', 'المدة المحددة (بالأشهر، مثال: 6)', 'Durée proposée (mois, exemple : 6)'),
        area(
          'finalSynthesis',
          'حوصلة تأليفية لنتائج التقييمات النهائية',
          'Synthèse des évaluations finales',
        ),
        area(
          'proposals',
          'المقترحات والتوصيات وضبطها وتعليلها',
          'Propositions, recommandations et motifs',
        ),
        f('signature', 'الإمضاء', 'Visa simulé'),
      ]),
    ],
    'educator',
    ['IMG_1032.JPG', 'IMG_1033.JPG', 'IMG_1034.JPG', 'IMG_1035.JPG', 'IMG_1036.JPG'],
  ),
  form(
    '14',
    'المشروع التكويني الإفرادي',
    'Projet individuel de formation',
    [3],
    [
      section('training', 'المشروع التكويني', 'Projet de formation', [
        ...identity().slice(0, 3),
        f('admission', 'تاريخ القبول بالمؤسسة', 'Admission', 'date', { shared: 'openedAt' }),
        date('projectDate', 'تاريخ صياغة المشروع التكويني', 'Date du projet de formation'),
        f('year', 'السنة التربوية', 'Année éducative'),
        f('trainer', 'اسم ولقب المكون', 'Formateur'),
        f('specialty', 'الاختصاص', 'Spécialité'),
        area('initialSynthesis', 'حوصلة تأليفية لنتائج التقييم الأولي', 'Synthèse initiale'),
        area('goals', 'الأهداف التكوينية الإفرادية', 'Objectifs de formation'),
        table('programs', 'برامج التدخل حسب الاختصاص', 'Programmes par spécialité', [
          ['program', 'برنامج التدخل', 'Intervention'],
          ['activities', 'مجموعة الأنشطة حسب اختصاص الورشة', 'Activités de l’atelier'],
          ['available', 'الوسائل المتوفرة', 'Moyens disponibles'],
          ['needed', 'الوسائل المستوجب توفيرها', 'Moyens à fournir'],
          ['duration', 'المدة', 'Durée'],
        ]),
      ]),
    ],
    'educator',
    ['IMG_1037.JPG', 'IMG_1038.JPG', 'IMG_1039.JPG', 'IMG_1040.JPG'],
  ),
  form(
    '15',
    'ملف حالة اجتماعية',
    'Dossier de situation sociale',
    [1, 2, 5],
    [
      section('identification', 'أ. التعريف', 'A. Identification', [
        f('caseId', 'عدد الملف', 'Numéro du dossier', 'text', { shared: 'caseId' }),
        f('openedAt', 'تاريخ فتح الملف', 'Ouverture', 'date', { shared: 'openedAt' }),
        ...identity(),
        select('gender', 'الجنس', 'Sexe', [
          ['أنثى', 'Féminin'],
          ['ذكر', 'Masculin'],
        ]),
        f(
          'demoIdentity',
          'معرّف تجريبي فقط (DEMO-)',
          'Identifiant fictif uniquement (DEMO-)',
          'text',
          {
            help: bi(
              'لا تُدخل رقم بطاقة تعريف وطنية حقيقياً.',
              'Ne saisir aucun numéro national réel.',
            ),
          },
        ),
        select('ageGroup', 'الشريحة العمرية: أطفال فقط', 'Tranche d’âge : enfants uniquement', [
          ['أقل من 12 سنة', 'Moins de 12 ans'],
          ['من 12 إلى 17 سنة', '12 à 17 ans'],
        ]),
        select('environment', 'الوسط', 'Milieu', [
          ['بلدي', 'Communal'],
          ['غير بلدي', 'Non communal'],
        ]),
      ]),
      section('source', 'ب. مصدر الإحالة', 'B. Source d’orientation', [
        select('source', 'مصدر الإحالة', 'Source d’orientation', [
          ['اتصال تلقائي', 'Contact spontané'],
          ['مندوب حماية الطفولة', 'Délégué à la protection de l’enfance'],
          ['حالة مكتشفة', 'Situation repérée'],
          ['مؤسسة صحية', 'Établissement de santé'],
          ['مؤسسة اجتماعية', 'Établissement social'],
          ['الإدارة العامة للسجون والإصلاح', 'Administration des prisons et de la rééducation'],
          ['مؤسسة تربوية', 'Établissement scolaire'],
          ['هيكل قضائي', 'Structure judiciaire'],
          ['هيكل آخر', 'Autre structure'],
        ]),
        area('requestedService', 'الخدمة المطلوبة كما وردت في الإحالة', 'Service demandé'),
        area('problem', 'المشكل المطروح', 'Situation présentée'),
      ]),
      section(
        'classification',
        'ج. تصنيف الوضعية من قبل المهني',
        'C. Classification par le professionnel',
        [
          select('classification', 'التصنيف المهني اليدوي', 'Classification manuelle', [
            ['طفل مهدد', 'Enfant en situation de menace'],
            ['طفل جانح', 'Enfant en conflit avec la loi'],
            ['طفل غير متكيف', 'Enfant en difficulté d’adaptation'],
          ]),
          {
            ...select(
              'threats',
              'أوضاع التهديد المصرح بها',
              'Situations de menace déclarées',
              [
                [
                  'فقدان الطفل لوالديه وبقاؤه دون سند عائلي',
                  'Perte des parents sans soutien familial',
                ],
                ['التعرض للإهمال والتشرد', 'Négligence ou errance'],
                ['استغلال الطفل في الإجرام المنظم', 'Exploitation dans la criminalité organisée'],
                ['عجز الأبوين عن الإحاطة والتربية', 'Difficultés parentales d’accompagnement'],
                ['اعتياد سوء معاملة الطفل', 'Maltraitance habituelle'],
                ['استغلال الطفل جنسياً', 'Exploitation sexuelle'],
                [
                  'التقصير البين والمتواصل في التربية والرعاية',
                  'Carence persistante de soins et d’éducation',
                ],
                ['تعريض الطفل للتسول أو استغلاله اقتصادياً', 'Mendicité ou exploitation économique'],
                ['أخرى', 'Autre'],
              ],
              'multi',
            ),
            condition: { field: 'classification', value: '0' },
          },
          {
            ...select('legalStage', 'الطور', 'Stade de la procédure', [
              ['في طور ما قبل الحكم', 'Avant jugement'],
              ['في طور الحكم', 'Jugement'],
              ['في طور الإصلاح', 'Rééducation'],
              ['في طور المتابعة بالوسط العائلي', 'Suivi familial'],
              ['مسرح من مركز إصلاح تربوي', 'Sortie d’un centre de rééducation'],
              ['وضعية أخرى', 'Autre'],
            ]),
            condition: { field: 'classification', value: '1' },
          },
          {
            ...select(
              'facts',
              'الفعلة المصرح بها',
              'Faits déclarés',
              [
                ['سرقة', 'Vol'],
                ['عنف', 'Violence'],
                ['عقوق', 'Libellé original : désobéissance familiale'],
                ['انحرافات جنسية', 'Libellé original : infractions sexuelles'],
                ['استهلاك أو ترويج مادة مخدرة', 'Consommation ou trafic de substances'],
                ['أخرى', 'Autre'],
              ],
              'multi',
            ),
            condition: { field: 'classification', value: '1' },
          },
          {
            ...select('factMode', 'القيام بالفعل', 'Modalité déclarée', [
              ['بصفة فردية', 'Seul'],
              ['مع مجموعة', 'En groupe'],
            ]),
            condition: { field: 'classification', value: '1' },
          },
          {
            ...yn('repeat', 'العود المصرح به', 'Récidive déclarée'),
            condition: { field: 'classification', value: '1' },
          },
          {
            ...n('repeatCount', 'عدد المرات', 'Nombre d’occurrences'),
            condition: { field: 'repeat', value: '0' },
          },
          {
            ...select(
              'judgments',
              'القرارات الصادرة',
              'Décisions prononcées',
              [
                ['عدم سماع الدعوى', 'Non-lieu'],
                ['إيقاف المحاكمة بموجب الوساطة', 'Médiation'],
                ['خطية مالية', 'Amende'],
                ['إدانته وتسليمه للولي', 'Remise au représentant légal'],
                ['إيداع بمركز إصلاح تربوي', 'Centre de rééducation'],
                ['إيداع بمؤسسة رعاية اجتماعية', 'Institution de protection sociale'],
                ['سجن', 'Détention'],
              ],
              'multi',
            ),
            condition: { field: 'classification', value: '1' },
          },
          {
            ...table(
              'legalDetails',
              'المدة والتكوين والمؤسسة',
              'Durée, formation et établissement',
              [
                ['duration', 'المدة', 'Durée'],
                ['training', 'التكوين', 'Formation'],
                ['institution', 'المؤسسة', 'Établissement'],
              ],
            ),
            condition: { field: 'classification', value: '1' },
          },
          {
            ...select(
              'declaredFactors',
              'العوامل المصرح بها',
              'Facteurs déclarés',
              [
                ['الفقر والاحتياج', 'Précarité'],
                ['مخالطة رفقاء السوء', 'Influence des pairs déclarée'],
                ['سبب آخر', 'Autre'],
              ],
              'multi',
            ),
            condition: { field: 'classification', value: '1' },
          },
          {
            ...select('familyPosition', 'موقف العائلة من الفعلة', 'Position de la famille', [
              ['لا مبالاة', 'Indifférence'],
              ['شعور بالتقصير', 'Sentiment de responsabilité'],
              ['موقف آخر', 'Autre'],
            ]),
            condition: { field: 'classification', value: '1' },
          },
          {
            ...select('childPosition', 'موقف الطفل من الفعلة', 'Position de l’enfant', [
              ['لا مبالاة', 'Indifférence'],
              ['شعور بالندم', 'Regret'],
              ['نكران', 'Contestation'],
              ['افتخار', 'Fierté exprimée'],
              ['موقف آخر', 'Autre'],
            ]),
            condition: { field: 'classification', value: '1' },
          },
          {
            ...select('externalPosition', 'موقف المحيط الخارجي', 'Position de l’entourage', [
              ['تقبل', 'Acceptation'],
              ['لا مبالاة', 'Indifférence'],
              ['إقصاء', 'Exclusion'],
            ]),
            condition: { field: 'classification', value: '1' },
          },
          {
            ...select('schoolPosition', 'موقف الوسط المدرسي', 'Position du milieu scolaire', [
              ['تقبل', 'Acceptation'],
              ['لا مبالاة', 'Indifférence'],
              ['إقصاء', 'Exclusion'],
            ]),
            condition: { field: 'classification', value: '1' },
          },
          {
            ...select(
              'adaptation',
              'صعوبات التكيف المصرح بها',
              'Difficultés d’adaptation déclarées',
              [
                ['طفل بالشارع', 'Enfant dans la rue'],
                ['يعيش صعوبات توافق عائلي', 'Difficultés d’entente familiale'],
                ['يعيش اضطرابات نفسية', 'Difficultés psychologiques déclarées'],
                ['في وضعية عدم تكيف مدرسي', 'Difficultés d’adaptation scolaire'],
                ['منقطع عن التعليم', 'Interruption scolaire'],
                ['وضعية إدمان', 'Situation de dépendance déclarée'],
              ],
              'multi',
            ),
            condition: { field: 'classification', value: '2' },
          },
        ],
        bi(
          'تُدخل التصنيفات يدوياً ولا تستخدم في أي تنبؤ أو تصنيف آلي.',
          'Classification exclusivement humaine, exclue du moteur de recommandation et de toute prédiction.',
        ),
      ),
      section('school', 'د. المسار الدراسي', 'D. Parcours scolaire', [
        f('schoolSituation', 'الوضعية الدراسية', 'Situation scolaire'),
        education(),
        f('school', 'المؤسسة التربوية', 'Établissement', 'text', { shared: 'school' }),
        select('performance', 'الأداء الحالي', 'Appréciation actuelle', [
          ['ضعيف', 'Faible'],
          ['متوسط', 'Moyen'],
          ['جيد', 'Bon'],
        ]),
        date('dropoutDate', 'تاريخ الانقطاع', 'Date d’interruption'),
        area('dropoutReason', 'سبب الانقطاع', 'Motif d’interruption'),
        yn('illiterate', 'أمي', 'Non alphabétisé'),
        yn('adultClasses', 'تابع دروس تعليم الكبار', 'Cours d’alphabétisation suivis'),
        f('diplomas', 'الشهادات المتحصل عليها', 'Diplômes'),
      ]),
      section('vocational', 'هـ. المسار المهني', 'E. Parcours professionnel', [
        yn('inTraining', 'يتابع تكويناً مهنياً', 'Suit une formation professionnelle'),
        f('trainingYear', 'السنة والاختصاص', 'Année et spécialité'),
        yn('apprentice', 'يتابع تدريباً مهنياً', 'Suit un apprentissage'),
        f('specialty', 'الاختصاص', 'Spécialité'),
        f('professionalDiplomas', 'الشهادات المهنية', 'Diplômes professionnels'),
        yn('working', 'يعمل', 'Exerce une activité'),
        select('sector', 'قطاع العمل', 'Secteur', [
          ['عمومي', 'Public'],
          ['خاص', 'Privé'],
          ['للحساب الخاص', 'Indépendant'],
        ]),
      ]),
      section('health', 'و. الوضعية الصحية', 'F. Santé', [
        select('health', 'الوضعية الصحية', 'Situation de santé', [
          ['جيدة', 'Bonne'],
          ['مرض عادي', 'Maladie courante'],
          ['مرض مزمن', 'Maladie chronique'],
          ['إعاقة', 'Handicap'],
        ]),
        {
          ...select('disability', 'درجة الإعاقة', 'Degré de handicap', [
            ['خفيفة', 'Léger'],
            ['متوسطة', 'Modéré'],
            ['عميقة', 'Profond'],
          ]),
          condition: { field: 'health', value: '3' },
        },
      ]),
      section('parents', 'ز. معلومات الوالدين', 'G. Informations sur les parents', [
        ...(['father', 'mother'] as const).flatMap((p) => [
          f(
            p,
            p === 'father' ? 'اسم الأب' : 'اسم الأم',
            p === 'father' ? 'Nom du père' : 'Nom de la mère',
            'text',
            { shared: p },
          ),
          f(`${p}Surname`, 'اللقب', 'Nom de famille'),
          f(`${p}Origin`, 'جهة الأصل', 'Région d’origine'),
          f(`${p}Birthplace`, 'مكان الولادة', 'Lieu de naissance'),
          f(`${p}DemoId`, 'معرّف تجريبي فقط (DEMO-)', 'Identifiant fictif (DEMO-)'),
          f(`${p}Address`, 'عنوان السكن الحالي', 'Adresse actuelle'),
          date(`${p}ResidenceDate`, 'تاريخ الإقامة به', 'Date d’installation'),
          f(`${p}Phone`, 'الهاتف التجريبي', 'Téléphone fictif'),
          select(`${p}Environment`, 'الوسط', 'Milieu', [
            ['بلدي', 'Communal'],
            ['غير بلدي', 'Non communal'],
          ]),
          area(`${p}Notes`, 'ملاحظات أخرى', 'Autres observations'),
        ]),
      ]),
      section('family', 'ح. تركيبة الأسرة', 'H. Composition familiale', [
        table('family', 'أفراد الأسرة', 'Membres de la famille', [
          ['name', 'الاسم', 'Nom'],
          ['birth', 'تاريخ الولادة', 'Naissance'],
          ['education', 'المستوى التعليمي', 'Études'],
          ['civil', 'الحالة المدنية', 'Situation matrimoniale'],
          ['job', 'المهنة', 'Profession'],
          ['income', 'الدخل الشهري (د.ت)', 'Revenu mensuel (TND)'],
          ['health', 'الوضع الصحي', 'Santé'],
          ['legal', 'السوابق العدلية المصرح بها', 'Antécédents déclarés'],
          ['coverage', 'التغطية الاجتماعية', 'Couverture sociale'],
          ['support', 'المساعدات الاجتماعية', 'Aides'],
          ['notes', 'ملاحظات', 'Observations'],
        ]),
      ]),
      section('housing', 'ط. السكن', 'I. Logement', [
        select('housingType', 'نوع السكن', 'Type de logement', [
          ['فيلا', 'Villa'],
          ['دار عربي', 'Maison traditionnelle'],
          ['شقة', 'Appartement'],
          ['كوخ', 'Habitat précaire'],
        ]),
        n('rooms', 'عدد الغرف', 'Pièces'),
        select('tenure', 'الصيغة', 'Occupation', [
          ['ملك', 'Propriété'],
          ['كراء', 'Location'],
          ['على وجه الفضل', 'Hébergement gratuit'],
          ['سكن مشترك', 'Logement partagé'],
        ]),
        n('rent', 'معلوم الكراء (د.ت)', 'Loyer (TND)'),
        yn('utilities', 'المرافق الأساسية متوفرة', 'Services de base disponibles'),
        yn('sanitation', 'المرافق الصحية متوفرة', 'Sanitaires disponibles'),
        select(
          'equipment',
          'التجهيزات',
          'Équipements',
          [
            ['أسرة', 'Lits'],
            ['خزانات', 'Armoires'],
            ['طاولة', 'Table'],
            ['كراسي', 'Chaises'],
          ],
          'multi',
        ),
        f('otherFacilities', 'مرافق أخرى', 'Autres équipements'),
      ]),
      section('finances', 'ي. الوضع المالي', 'J. Situation financière', [
        select('finances', 'وضعية الأسرة', 'Situation familiale', [
          ['معوزة', 'Précaire'],
          ['ذات دخل محدود', 'Revenus limités'],
          ['من الطبقة المتوسطة', 'Revenus moyens'],
          ['ثرية', 'Revenus élevés'],
        ]),
        select(
          'incomeType',
          'نوع الدخل',
          'Type de revenus',
          [
            ['قار', 'Réguliers'],
            ['غير قار', 'Irréguliers'],
            ['مداخيل أخرى', 'Autres revenus'],
            ['إعانات ظرفية', 'Aides ponctuelles'],
          ],
          'multi',
        ),
        n('income', 'الدخل الشهري (د.ت)', 'Revenu mensuel (TND)'),
        n('expenses', 'المصاريف القارة (د.ت)', 'Charges fixes (TND)'),
        select('coverage', 'التغطية الاجتماعية', 'Couverture sociale', [
          ['الصندوق الوطني للضمان الاجتماعي', 'CNSS'],
          ['الصندوق الوطني للتقاعد والحيطة الاجتماعية', 'CNRPS'],
          ['دون تغطية اجتماعية', 'Sans couverture'],
          ['علاج مجاني', 'Soins gratuits'],
          ['علاج بالتعريفة المنخفضة', 'Soins à tarif réduit'],
        ]),
        f('demoMembership', 'رقم الانخراط التجريبي (DEMO-)', 'Affiliation fictive (DEMO-)'),
        f('demoHealthCard', 'رقم بطاقة العلاج التجريبي (DEMO-)', 'Carte de soins fictive (DEMO-)'),
      ]),
      section('relations', 'ك. العلاقات الأسرية', 'K. Relations familiales', [
        select('familyType', 'نوع الأسرة', 'Structure familiale', [
          ['ذات تركيبة عادية', 'Famille nucléaire'],
          ['ذات ولي واحد: وفاة الأب', 'Monoparentale : décès du père'],
          ['ذات ولي واحد: وفاة الأم', 'Monoparentale : décès de la mère'],
          ['أم عزباء', 'Mère célibataire'],
          ['مفككة: طلاق أو فراق', 'Séparation ou divorce'],
          ['غياب أحد الوالدين: هجرة أو سجن', 'Absence d’un parent : migration ou détention'],
          ['دون سند: وفاة الوالدين أو غيره', 'Sans soutien parental'],
          ['ذات تركيبة متجددة', 'Recomposée'],
          ['بأسرة موسعة', 'Famille élargie'],
          ['بعائلة استقبال', 'Accueil familial'],
          ['حالة أخرى', 'Autre'],
        ]),
        ...(
          [
            ['parentRelation', 'العلاقة بين الأبوين', 'Relations entre parents'],
            ['fatherRelation', 'علاقة الأبناء بالأب', 'Relations avec le père'],
            ['motherRelation', 'علاقة الأبناء بالأم', 'Relations avec la mère'],
            ['siblingsRelation', 'علاقة الأبناء ببعضهم', 'Relations dans la fratrie'],
            ['childFamilyRelation', 'علاقة المعني بأسرته', 'Relation de l’enfant à sa famille'],
          ] as [string, string, string][]
        ).map(([key, a, b]) => f(key, a, b, 'select', { options: relations })),
        area('initialConclusions', 'الاستنتاجات الأولية', 'Conclusions initiales'),
      ]),
      section('care', 'ل. أساليب التعهد', 'L. Modalités de prise en charge', [
        select(
          'care',
          'أساليب التعهد',
          'Modalités',
          [
            ['تأهيل وعمل تربوي داخل المركز', 'Réhabilitation éducative au centre'],
            ['تعهد نفسي', 'Accompagnement psychologique'],
            ['مصاحبة بالوسط المفتوح', 'Accompagnement en milieu ouvert'],
            ['إدماج', 'Intégration'],
            ['توفير مساعدات', 'Aides'],
            ['أخرى', 'Autre'],
          ],
          'multi',
        ),
        select(
          'familyIntegration',
          'الإدماج العائلي',
          'Intégration familiale',
          [
            ['مصالحة مع الأسرة', 'Médiation familiale'],
            ['إدماج في العائلة الموسعة', 'Famille élargie'],
            ['إدماج لدى عائلة استقبال', 'Famille d’accueil'],
          ],
          'multi',
        ),
        select(
          'schoolIntegration',
          'الإدماج المدرسي',
          'Intégration scolaire',
          [
            ['مؤسسة تعليم خاص', 'École privée'],
            ['مؤسسة تعليم عام', 'École publique'],
            ['مؤسسة تعليم مهني', 'Formation professionnelle'],
            ['مركز تربية مختصة', 'Centre d’éducation spécialisée'],
          ],
          'multi',
        ),
        select(
          'professionalIntegration',
          'الإدماج المهني',
          'Intégration professionnelle',
          [
            ['تشغيل', 'Emploi'],
            ['بعث مشروع', 'Création de projet'],
            ['تدريب مهني بالقطاع الخاص', 'Apprentissage privé'],
            ['تدريب مهني بالقطاع العام', 'Apprentissage public'],
            ['تكوين مهني بالقطاع الخاص', 'Formation privée'],
            ['تكوين مهني بالقطاع العام', 'Formation publique'],
          ],
          'multi',
        ),
        select(
          'aids',
          'المساعدات',
          'Aides',
          [
            ['عينية', 'En nature'],
            ['مالية', 'Financières'],
            ['صحية', 'Santé'],
            ['التنسيق مع مؤسسة صحية', 'Coordination médicale'],
            ['أخرى', 'Autre'],
          ],
          'multi',
        ),
      ]),
      section('integration', 'م. تواريخ ومتابعة الإدماج', 'M. Dates et suivi d’intégration', [
        date(
          'educationalIntegrationDate',
          'تاريخ الإدماج بالبرنامج التربوي التأهيلي',
          'Entrée dans le programme éducatif',
        ),
        date('familyIntegrationDate', 'تاريخ الإدماج العائلي', 'Intégration familiale'),
        date('schoolIntegrationDate', 'تاريخ الإدماج المدرسي', 'Intégration scolaire'),
        date('vocationalIntegrationDate', 'تاريخ الإدماج المهني', 'Intégration professionnelle'),
        yn('followUp', 'المتابعة إثر الإدماج', 'Suivi après intégration'),
        n('followUpMonths', 'مدة المتابعة بالأشهر', 'Durée du suivi (mois)'),
        yn(
          'successfulIntegration',
          'نجاح عملية الإدماج',
          'Intégration réussie selon le professionnel',
        ),
      ]),
      section('familyServices', 'ن. خدمات الأسرة', 'N. Services à la famille', [
        select(
          'familyServices',
          'الخدمات الموجهة للأسرة',
          'Services destinés à la famille',
          [
            ['وساطة ومصالحة عائلية', 'Médiation familiale'],
            ['تأطير وإرشاد', 'Conseil et accompagnement'],
            ['إدماج مهني', 'Intégration professionnelle'],
            ['توفير مساعدات', 'Aides'],
            ['إدماج مدرسي للإخوة', 'Scolarisation de la fratrie'],
            ['تدخلات أخرى', 'Autres interventions'],
          ],
          'multi',
        ),
        area('notes', 'ملاحظات مهنية', 'Observations professionnelles'),
      ]),
    ],
    'social',
    [
      'IMG_1041.JPG',
      'IMG_1042.JPG',
      'IMG_1043.JPG',
      'IMG_1044.JPG',
      'IMG_1045.JPG',
      'IMG_1046.JPG',
    ],
  ),
];
// Only novel documents are registered here; F01–F15 remain stable and versioned.
forms.push(...additionalForms);
export const getForm = (id: string) => forms.find((form) => form.id === id);
