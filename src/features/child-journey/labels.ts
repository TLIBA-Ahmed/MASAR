import { bi } from '../../types';
export const statusLabels = {
  completed: bi('مكتملة', 'Terminée'),
  validated: bi('مصادق عليها', 'Validée'),
  current: bi('المرحلة الحالية', 'Étape actuelle'),
  pending: bi('في انتظار المصادقة', 'Validation en attente'),
  notStarted: bi('لم تبدأ', 'Non commencée'),
  future: bi('مرحلة مستقبلية', 'Étape future'),
  inProgress: bi('قيد الإنجاز', 'En cours'),
  unavailable: bi('خارج نطاق الوصول', 'Hors du périmètre d’accès'),
  notApplicable: bi('غير منطبقة وموثقة', 'Non applicable, documenté'),
  draft: bi('مسودة', 'Brouillon'),
} as const;
export const eventLabels: Record<string, ReturnType<typeof bi>> = {
  registration: bi('التسجيل', 'Enregistrement'),
  interview: bi('محادثة', 'Entretien'),
  observation: bi('ملاحظة', 'Observation'),
  assessment: bi('تقييم', 'Évaluation'),
  group: bi('مجموعة', 'Affectation'),
  project: bi('خطة فردية', 'Projet individualisé'),
  supervision: bi('إشراف', 'Supervision'),
  activity: bi('نشاط', 'Activité'),
  intervention: bi('تدخل', 'Intervention'),
  recommendation: bi('مراجعة اقتراح', 'Recommandation examinée'),
  decision: bi('قرار مهني', 'Décision professionnelle'),
  integration: bi('إدماج', 'Orientation / intégration'),
  document: bi('وثيقة', 'Document'),
  appointment: bi('موعد', 'Rendez-vous'),
  goal: bi('هدف', 'Objectif'),
  transfer: bi('تحويل', 'Transfert'),
};
export const phaseLabels = {
  initial: bi('تقييم أولي', 'Évaluation initiale'),
  intermediate: bi('تقييم وسيط', 'Évaluation intermédiaire'),
  final: bi('تقييم نهائي', 'Évaluation finale'),
};
