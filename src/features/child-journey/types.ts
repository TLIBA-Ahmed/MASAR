import type { Bi, Stage } from '../../types';

export type CheckpointStatus = 'completed' | 'current' | 'pending' | 'notStarted' | 'future';
export interface JourneyEvent {
  id: string;
  stage: Stage;
  type: string;
  date: string;
  title: Bi;
  note: string;
  professionalId: string | null;
  path: string | null;
  sourceId: string | null;
}
export interface JourneyDocument {
  id: string;
  documentId: string;
  formId: string;
  title: Bi;
  version: number;
  status: string;
  date: string;
  stage: Stage;
  professionalId: string;
  path: string;
}
export interface JourneyCheckpointData {
  id: Stage;
  title: Bi;
  short: Bi;
  description: Bi;
  status: CheckpointStatus;
  current: boolean;
  future: boolean;
  childCount?: number;
  startedAt: string | null;
  endedAt: string | null;
  completedSubsteps: number;
  totalSubsteps: number;
  documentCount: number;
  pendingCount: number;
}
export interface JourneyChild {
  id: string;
  child_code?: string;
  name: Bi;
  stage: Stage;
  status: string;
  cycle: number;
  nextDue: string | null;
  groupIds: string[];
}
export interface JourneyOverview {
  children: JourneyChild[];
  count: number;
  checkpoints: JourneyCheckpointData[];
  groups: { group_id: string; group_name: Bi; group_code: string; active_child_count: number }[];
}
export interface JourneyGoal {
  id: string;
  description: Bi;
  skill: string;
  confirmed: boolean;
  status: string | null;
  dueDate: string | null;
}
export interface JourneyDeadline {
  id: string;
  title: Bi;
  date: string;
  path: string;
}
export interface JourneyComparison {
  id: string;
  formId: string;
  title: Bi;
  version: number;
  date: string;
  phase: 'initial' | 'intermediate' | 'final' | null;
  fields: { label: Bi; value: string }[];
  path: string;
}
export interface JourneyDecision {
  id: string;
  kind: string;
  from: Stage;
  to: Stage;
  cycle: number;
  date: string;
  professionalId: string;
  reason: string;
  historicalDemo?: boolean;
}
export interface ChildJourney {
  caseId: string;
  child_code?: string;
  child: { name: Bi };
  stage: Stage;
  cycle: number;
  caseStatus: string;
  openedAt: string;
  nextDue: string | null;
  checkpoints: JourneyCheckpointData[];
  metrics: {
    days: number;
    interviews: number;
    interventions: number;
    scheduledActivities: number;
    completedActivities: number;
    present: number;
    absent: number;
    assessments: number;
    goalsTotal: number;
    goalsConfirmed: number;
    goalsAchieved: number | null;
    goalsInProgress: number | null;
  };
  goals: JourneyGoal[];
  deadlines: JourneyDeadline[];
  comparisons: JourneyComparison[];
  versions: {
    id: string;
    version: number;
    date: string;
    professionalId: string;
    notes: string;
    cycle: number | null;
  }[];
  cycles: { number: number; decisions: JourneyDecision[] }[];
  events: JourneyEvent[];
  groups: { id: string; name: Bi; status: string }[];
}
export interface JourneyStageDetails {
  results: { id: string; text: string; date: string }[];
  caseId: string;
  checkpoint: JourneyCheckpointData & {
    substeps: { key: string; title: Bi; status: string; path: string }[];
    events: JourneyEvent[];
    documents: JourneyDocument[];
  };
  professionals: { id: string; name: Bi; role: string }[];
  forms: { id: string; title: Bi; path: string }[];
  deadlines: JourneyDeadline[];
  goals: JourneyGoal[];
}
