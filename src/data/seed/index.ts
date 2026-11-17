import { bi } from '../../types';
import type { AppData, Case, Child, FormSubmission, JourneyEvent, Stage } from '../../types';
import { brand } from '../../config/brand';
import { skills, stages } from '../../config/workflow';
import { addDays } from '../../utils/date';
import { createActivities } from './activities';
import {
  createPartnerStructures,
  createProfessionalResources,
  restrictedDemoProfessional,
} from './intelligence';
const first = [
  ['آدم', 'Adam'],
  ['مريم', 'Mariem'],
  ['يوسف', 'Youssef'],
  ['آية', 'Aya'],
  ['عزيز', 'Aziz'],
  ['سارة', 'Sarra'],
  ['إياد', 'Iyed'],
  ['نور', 'Nour'],
  ['أمين', 'Amine'],
  ['ياسمين', 'Yasmine'],
  ['مالك', 'Malek'],
  ['رانية', 'Rania'],
  ['سليم', 'Slim'],
  ['إسراء', 'Isra'],
  ['ريان', 'Rayen'],
  ['لينا', 'Lina'],
  ['حمزة', 'Hamza'],
  ['إيمان', 'Imen'],
  ['فارس', 'Fares'],
  ['سلمى', 'Salma'],
];
const last = [
  ['بن سالم', 'Ben Salem'],
  ['الهمامي', 'Hammami'],
  ['المنصوري', 'Mansouri'],
  ['الطرابلسي', 'Trabelsi'],
  ['العياري', 'Ayari'],
  ['الجبالي', 'Jebali'],
  ['الفرشيشي', 'Ferchichi'],
  ['السالمي', 'Salmi'],
];
export function createSeed(): AppData {
  const demoDate = brand.demoDate;
  const children: Child[] = [];
  const cases: Case[] = [];
  const events: JourneyEvent[] = [];
  const submissions: FormSubmission[] = [];
  for (let i = 0; i < 40; i++) {
    const id = `CDIS-${String(i + 1).padStart(3, '0')}`;
    const fn = first[i % 20],
      ln = last[Math.floor(i / 5) % 8];
    const centerId = i < 32 ? 'siliana' : i < 36 ? 'gabes' : 'kairouan';
    const stage: Stage = i === 23 ? 3 : ([1, 2, 3, 3, 4, 5, 2, 3, 5, 1][i % 10] as Stage);
    const openedAt =
      stage === 1
        ? addDays(demoDate, -(i % 12))
        : stage === 2
          ? addDays(demoDate, -(15 + (i % 14)))
          : addDays(demoDate, -(140 + i * 3));
    const name =
      i === 23 ? bi('آدم بن سالم', 'Adam Ben Salem') : bi(`${fn[0]} ${ln[0]}`, `${fn[1]} ${ln[1]}`);
    const child: Child = {
      id: `child-${i + 1}`,
      name,
      birthDate:
        i === 23
          ? '2012-05-12'
          : `${2010 + (i % 6)}-${String((i % 12) + 1).padStart(2, '0')}-${String((i % 25) + 1).padStart(2, '0')}`,
      birthplace: 'سليانة — موقع تجريبي',
      gender: i === 23 ? 'male' : i % 2 ? 'female' : 'male',
      address: 'حي الأمل — عنوان اصطناعي',
      phone: 'DEMO-PHONE',
      school: 'مدرسة الأفق — مؤسسة تجريبية',
      education: i % 3 ? 'السنة السابعة أساسي' : 'السنة السادسة أساسي',
      father: 'محمد — اسم اصطناعي',
      mother: 'فاطمة — اسم اصطناعي',
      familyId: `fam-${i === 24 ? 24 : i + 1}`,
      preferences: ['creativity', 'sport'],
    };
    children.push(child);
    const c: Case = {
      id,
      childId: child.id,
      centerId,
      referentId: 'p1',
      openedAt,
      stage,
      status: i === 8 || i === 18 ? 'closed' : 'active',
      nextDue: addDays(demoDate, (i % 12) - 2),
      source: 'إحالة تجريبية من مؤسسة تربوية',
      cycle: 1,
      goals:
        stage >= 3
          ? ['communication', 'emotions', 'cooperation'].map((skill, j) => ({
              id: `goal-${i + 1}-${j}`,
              skill,
              description: skills[skill as keyof typeof skills],
              confirmed: true,
              confirmedBy: 'p3',
              confirmedAt: addDays(openedAt, 34),
              dueDate: addDays(demoDate, 45),
            }))
          : [],
      decisions: [],
      subStages: {},
      supervised: stage >= 3,
      projectNotes:
        stage >= 3 ? 'مشروع تربوي تجريبي: دعم التعبير والتواصل والمشاركة الجماعية.' : '',
    };
    for (const s of stages)
      for (let j = 0; j < s.subStages.length; j++)
        c.subStages[`${s.id}-${j}`] =
          s.id < stage ? 'validated' : s.id === stage && j < 2 ? 'completed' : 'notStarted';
    cases.push(c);
    events.push({
      id: `ev-reg-${i}`,
      caseId: id,
      date: `${openedAt}T09:00:00`,
      type: 'registration',
      title: bi('فتح الملف الرقمي المركزي', 'Ouverture du dossier central'),
      note: 'بيانات اصطناعية لأغراض العرض فقط.',
      professionalId: 'p1',
      stage: 1,
    });
    if (stage >= 2)
      events.push({
        id: `ev-obs-${i}`,
        caseId: id,
        date: `${addDays(openedAt, 4)}T10:00:00`,
        type: 'observation',
        title: bi('محادثة اجتماعية أولية', 'Premier entretien social'),
        note: 'عبّر الطفل عن رغبته في المشاركة في الأنشطة الفنية.',
        professionalId: 'p1',
        stage: 2,
      });
    if (stage >= 3) {
      events.push({
        id: `ev-eval-${i}`,
        caseId: id,
        date: `${addDays(openedAt, 30)}T10:00:00`,
        type: 'assessment',
        title: bi('التقييم الأولي متعدد الاختصاصات', 'Évaluation pluridisciplinaire initiale'),
        note: 'تقييم اصطناعي سابق لإظهار استمرارية المتابعة.',
        professionalId: 'p2',
        stage: 2,
        sourceId: `sub-${i}-F08`,
      });
      events.push({
        id: `ev-super-${i}`,
        caseId: id,
        date: `${addDays(openedAt, 35)}T11:00:00`,
        type: 'decision',
        title: bi('مراجعة إدارية للمشروع', 'Revue administrative du projet'),
        note: 'محاكاة موافقة الإشراف على برنامج التدخل.',
        professionalId: 'p4',
        stage: 3,
      });
      for (const formId of ['F01', 'F08', 'F12', 'F13'] as const) {
        const values: FormSubmission['values'] = {
          childName: name.ar,
          birthDate: child.birthDate,
          address: child.address,
          education: child.education,
          date: addDays(openedAt, 30),
          professional: 'فريق سليانة — بيانات اصطناعية',
          notes: 'ملاحظات مهنية اصطناعية للعرض.',
          strengths: 'يتفاعل مع الرسم ويشارك في مجموعات صغيرة.',
          difficulties: 'يحتاج إلى وقت إضافي للتعبير أمام المجموعة.',
          recommendations: 'مواصلة أنشطة التعبير مع احترام وتيرة الطفل.',
          initialSynthesis: 'تقييم يدوي تجريبي من الفريق متعدد الاختصاصات.',
          goals: 'دعم التواصل والتعبير عن المشاعر والتعاون.',
          months: 6,
        };
        if (formId === 'F08')
          values.assessment = Object.fromEntries(
            Array.from({ length: 33 }, (_, k) => [`${Math.floor(k / 3)}-${k % 3}`, String(k % 3)]),
          );
        submissions.push({
          id: `sub-${i}-${formId}`,
          caseId: id,
          formId,
          values,
          status: 'validated',
          date: `${addDays(openedAt, formId === 'F13' ? 34 : 30)}T10:00:00`,
          authorId: formId === 'F12' ? 'p2' : 'p3',
          version: 1,
          definitionVersion: 1,
        });
      }
    }
  }
  const data: AppData = {
    schemaVersion: 1,
    demoDate,
    children,
    cases,
    events,
    submissions,
    centers: [
      {
        id: 'siliana',
        name: bi('مركز الدفاع والإدماج الاجتماعي بسليانة', 'CDIS de Siliana'),
        region: bi('سليانة', 'Siliana'),
      },
      {
        id: 'gabes',
        name: bi('مركز قابس — عرض تجريبي', 'Centre de Gabès — démo'),
        region: bi('قابس', 'Gabès'),
      },
      {
        id: 'kairouan',
        name: bi('مركز القيروان — عرض تجريبي', 'Centre de Kairouan — démo'),
        region: bi('القيروان', 'Kairouan'),
      },
    ],
    professionals: [
      {
        id: 'p1',
        name: bi('أمينة العياري', 'Amina Ayari'),
        role: 'social',
        specialty: bi('المرافقة الاجتماعية', 'Accompagnement social'),
        centerId: 'siliana',
        email: 'amina@example.test',
        availability: '09:00–16:00',
      },
      {
        id: 'p2',
        name: bi('نادية بن عمر', 'Nadia Ben Amor'),
        role: 'psychologist',
        specialty: bi('علم نفس الطفل', 'Psychologie de l’enfant'),
        centerId: 'siliana',
        email: 'nadia@example.test',
        availability: '09:00–15:00',
      },
      {
        id: 'p3',
        name: bi('خالد الجبالي', 'Khaled Jebali'),
        role: 'educator',
        specialty: bi('التربية المختصة', 'Éducation spécialisée'),
        centerId: 'siliana',
        email: 'khaled@example.test',
        availability: '08:30–16:00',
      },
      {
        id: 'p4',
        name: bi('سناء الهمامي', 'Sana Hammami'),
        role: 'administration',
        specialty: bi('الإشراف الإداري', 'Supervision administrative'),
        centerId: 'siliana',
        email: 'sana@example.test',
        availability: '09:00–17:00',
      },
      {
        id: 'p5',
        name: bi('سامي المنصوري', 'Sami Mansouri'),
        role: 'educator',
        specialty: bi('التنشيط التربوي', 'Animation éducative'),
        centerId: 'gabes',
        email: 'sami@example.test',
        availability: '09:00–16:00',
      },
    ],
    families: children
      .filter((_, i) => i !== 24)
      .map((ch) => ({
        id: ch.familyId,
        label: bi(
          `أسرة تجريبية ${ch.familyId.slice(4)}`,
          `Famille fictive ${ch.familyId.slice(4)}`,
        ),
        members: [
          { name: ch.father, relationship: 'father' },
          { name: ch.mother, relationship: 'mother' },
        ],
        notes: 'ارتباط عائلي صريح في بيانات العرض.',
      })),
    assignments: cases.flatMap((c) =>
      (c.centerId === 'siliana' ? ['p1', 'p2', 'p3', 'p4'] : ['p5']).map((professionalId) => ({
        caseId: c.id,
        professionalId,
      })),
    ),
    activities: createActivities(),
    resources: createProfessionalResources(),
    partners: createPartnerStructures(),
    sessions: [],
    recommendations: [],
    appointments: [],
    tasks: [],
    integrations: [],
    transfers: [],
    posts: [
      {
        id: 'post-1',
        authorId: 'p3',
        date: '2026-11-14T10:00:00',
        body: 'جرّبنا اليوم الرسم الجماعي كوسيلة لتعزيز التعاون. تقسيم الأدوار الصغيرة وإتاحة الاختيار يساعدان المجموعة على المشاركة. ما التكييفات التي تستعملونها؟',
        category: bi('ممارسة تربوية', 'Pratique éducative'),
        likes: ['p1', 'p2'],
        favorite: false,
        comments: [
          {
            id: 'comment-1',
            authorId: 'p2',
            body: 'يمكن تخصيص وقت قصير في النهاية للتعبير عن الانطباعات، مع احترام رغبة من يفضل عدم الكلام.',
            date: '2026-11-14T11:00:00',
          },
        ],
      },
      {
        id: 'post-2',
        authorId: 'p2',
        date: '2026-11-13T09:00:00',
        body: 'تذكير مهني: تُشارك هنا الموارد والممارسات العامة فقط. تبقى الملاحظات الفردية في الملفات المخصصة ضمن نطاق الفريق المعني.',
        category: bi('موارد الفريق', 'Ressources de l’équipe'),
        likes: ['p4'],
        favorite: true,
        comments: [],
      },
    ],
    conversations: [
      {
        id: 'conv-1',
        title: bi('الفريق متعدد الاختصاصات', 'Équipe pluridisciplinaire'),
        members: ['p1', 'p2', 'p3', 'p4'],
        messages: [
          {
            id: 'msg-1',
            authorId: 'p4',
            body: 'صباح الخير، اجتماع التنسيق الأسبوعي يوم الاثنين على الساعة العاشرة.',
            date: '2026-11-14T09:30:00',
          },
          {
            id: 'msg-2',
            authorId: 'p3',
            body: 'سأشارك موارد الأنشطة في مكتبة الفريق قبل الاجتماع.',
            date: '2026-11-14T09:35:00',
          },
        ],
      },
      {
        id: 'conv-2',
        title: bi('نادية بن عمر', 'Nadia Ben Amor'),
        members: ['p1', 'p2'],
        messages: [
          {
            id: 'msg-3',
            authorId: 'p2',
            body: 'هل يمكن تنسيق موعد الورشة القادمة غداً؟',
            date: '2026-11-14T12:00:00',
          },
        ],
      },
    ],
    searchHistory: [],
    searchHistories: {},
  };
  data.professionals.push(structuredClone(restrictedDemoProfessional));
  data.assignments.push({ caseId: 'CDIS-024', professionalId: 'p6' });
  data.activities
    .filter((a) => a.skills.includes('emotions'))
    .forEach((a) => {
      a.professionalValidation = { professionalId: 'p2', date: '2026-11-14' };
    });
  for (let i = 0; i < 20; i++) {
    const c = cases[(i + 10) % 32];
    if (c.stage < 3) continue;
    const session = {
      id: `session-${i}`,
      activityId: `ACT-${String((i % 10) + 1).padStart(3, '0')}`,
      date: addDays(demoDate, -((i % 10) + 1)),
      time: '10:00',
      educatorId: 'p3',
      group: i % 2 ? 'مجموعة الأفق' : 'مجموعة الأمل',
      participants: [
        {
          caseId: c.id,
          attendance: (i % 7 === 0 ? 'absent' : 'present') as 'absent' | 'present',
          engagement: 'active' as const,
          observations: 'شارك في التمرين مع دعم المربي.',
          progress: 'عبّر عن رأيه وانتظر دوره.',
        },
      ],
      status: 'completed' as const,
      adaptations: '',
      goalIds: c.goals.map((g) => g.id),
    };
    data.sessions.push(session);
    data.events.push({
      id: `ev-session-${i}`,
      caseId: c.id,
      date: `${session.date}T10:00:00`,
      type: 'activity',
      title: bi('إنجاز حصة تربوية', 'Séance éducative réalisée'),
      note: session.participants[0].observations,
      professionalId: 'p3',
      stage: 3,
      sourceId: session.id,
    });
  }
  data.sessions.push({
    id: 'session-demo',
    activityId: 'ACT-002',
    date: addDays(demoDate, 1),
    time: '10:00',
    educatorId: 'p3',
    group: 'مجموعة الأفق',
    participants: ['CDIS-024', 'CDIS-003', 'CDIS-004'].map((caseId) => ({
      caseId,
      attendance: 'present',
      engagement: 'active',
      observations: '',
      progress: '',
    })),
    status: 'planned',
    adaptations: '',
    goalIds: cases[23].goals.map((g) => g.id),
  });
  for (let i = 0; i < 8; i++)
    data.appointments.push({
      id: `appt-${i}`,
      caseId: i === 0 ? 'CDIS-024' : cases[i * 3].id,
      title:
        i % 2
          ? bi('تقييم متعدد الاختصاصات', 'Évaluation pluridisciplinaire')
          : bi('محادثة ومتابعة اجتماعية', 'Entretien de suivi social'),
      type: i % 2 ? 'evaluation' : 'interview',
      date: addDays(demoDate, i),
      time: `${String(9 + (i % 4)).padStart(2, '0')}:00`,
      professionalId: i % 2 ? 'p2' : 'p1',
      completed: false,
      notes: '',
    });
  for (let i = 0; i < 6; i++)
    data.tasks.push({
      id: `task-${i}`,
      title:
        i % 2
          ? bi('استكمال المشروع التربوي الفردي', 'Compléter le projet éducatif')
          : bi('مراجعة وثائق التقييم الأولي', 'Revoir l’évaluation initiale'),
      caseId: i === 0 ? 'CDIS-024' : cases[i * 2].id,
      dueDate: addDays(demoDate, i - 1),
      completed: i === 5,
      professionalId: 'p1',
    });
  for (const c of cases.filter((c) => c.stage === 5))
    data.integrations.push({
      id: `int-${c.id}`,
      caseId: c.id,
      partner: 'مدرسة الأفق — شريك تجريبي',
      type: 'school',
      date: addDays(demoDate, -14),
      objectives: 'مرافقة العودة التدريجية إلى الدراسة.',
      notes: 'توجيه مهني تجريبي، لا يغلق الملف تلقائياً.',
      status: c.status === 'closed' ? 'completed' : 'followUp',
      result: c.status === 'closed' ? 'تم توثيق المتابعة والنتائج في سيناريو العرض.' : '',
      followUpDate: addDays(demoDate, 7),
      professionalId: 'p1',
    });
  const previous = data.submissions.find((s) => s.caseId === 'CDIS-024' && s.formId === 'F08')!;
  data.submissions.push({
    ...structuredClone(previous),
    id: 'sub-demo-F08-v2',
    version: 2,
    date: '2026-11-10T10:00:00',
    values: {
      ...structuredClone(previous.values),
      summary:
        'ملاحظات اصطناعية في التقييم الوسيط: تحسن تبادل الأدوار، مع مواصلة دعم التعبير عن المشاعر.',
      assessment: Object.fromEntries(
        Array.from({ length: 33 }, (_, i) => [
          `${Math.floor(i / 3)}-${i % 3}`,
          i % 4 === 0 ? '2' : '0',
        ]),
      ),
    },
  });
  data.events.push({
    id: 'event-demo-interim',
    caseId: 'CDIS-024',
    date: '2026-11-10T10:00:00',
    type: 'assessment',
    title: bi('تقييم وسيط — نسخة مستقلة', 'Évaluation intermédiaire — version distincte'),
    note: 'مثال اصطناعي سابق للعرض، دون ادعاء متابعة زمنية حقيقية.',
    professionalId: 'p3',
    stage: 3,
    sourceId: 'sub-demo-F08-v2',
  });
  return data;
}
