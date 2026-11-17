import type { Bi, Stage } from '../../types';
export type SummarySection =
  | 'situation'
  | 'observations'
  | 'actions'
  | 'progress'
  | 'objectives'
  | 'next_actions'
  | 'difficulties'
  | 'decisions';
export interface StageEvidence {
  id: string;
  kind: string;
  reference_id: string;
  title: Bi;
  date: string;
  version: number;
  excerpt: Bi;
  content_hash: string;
}
export interface JourneyStageSummary {
  id: string | null;
  case_id: string;
  stage_id: Stage;
  cycle_id: number;
  version: number;
  summary_ar: string;
  summary_fr: string;
  generation_method: string;
  model_version: string | null;
  validation_status: 'preview' | 'draft' | 'approved' | 'rejected';
  validated_by: string | null;
  validated_at: string | null;
  generated_at?: string;
  review_reason?: string;
  outdated?: boolean;
  sections: Record<SummarySection, { text: Bi; source_ids: string[]; nature: string }[]>;
  period: { start: string | null; end: string | null };
  source_references: StageEvidence[];
}
export interface StageSummaryCardData {
  stage_id: Stage;
  cycle_id: number;
  status: 'completed' | 'current' | 'pending' | 'notStarted' | 'future';
  period: { start: string | null; end: string | null };
  summary: JourneyStageSummary;
  latest_draft: JourneyStageSummary | null;
  update_available: boolean;
  history_count: number;
}
export interface JourneySummaries {
  case_id: string;
  child_code: string;
  stages: StageSummaryCardData[];
  permissions: { generate: boolean; review: boolean };
}
export const summarySections: Record<SummarySection, Bi> = {
  situation: { ar: 'الوضعية الموثقة', fr: 'Situation documentée' },
  observations: { ar: 'ملاحظات مهنية', fr: 'Observations professionnelles' },
  actions: { ar: 'ما تم إنجازه', fr: 'Actions réalisées' },
  progress: { ar: 'تقدم موثق', fr: 'Progrès documentés' },
  objectives: { ar: 'أهداف قيد العمل', fr: 'Objectifs à travailler' },
  next_actions: { ar: 'الإجراءات القادمة', fr: 'Prochaines actions' },
  difficulties: { ar: 'صعوبات موثقة', fr: 'Difficultés documentées' },
  decisions: { ar: 'قرارات موثقة', fr: 'Décisions documentées' },
};
export function generationLabel(method: string, ar: boolean) {
  if (method === 'ai') return ar ? 'اختيار مقتطفات بالذكاء المحلي' : 'Sélection par IA locale';
  if (method === 'manual') return ar ? 'تحرير مهني يدوي' : 'Rédaction professionnelle';
  if (method === 'deterministic_unavailable')
    return ar ? 'حتمي · النموذج غير متاح' : 'Déterministe · modèle indisponible';
  if (method === 'deterministic_invalid_output')
    return ar ? 'حتمي · مخرجات النموذج مرفوضة' : 'Déterministe · sortie IA refusée';
  if (method === 'deterministic_demo') return ar ? 'حتمي · وضع تجريبي' : 'Déterministe · mode démo';
  return ar ? 'سرد حتمي موثق' : 'Synthèse déterministe sourcée';
}
