export type Language = 'ar' | 'fr';
export type Bi = { ar: string; fr: string };
export const bi = (ar: string, fr: string): Bi => ({ ar, fr });
export type Stage = 1 | 2 | 3 | 4 | 5;
export type Role = 'social' | 'psychologist' | 'educator' | 'administration';
export type ResourceKind =
  | 'case'
  | 'form'
  | 'document'
  | 'observation'
  | 'evaluation'
  | 'project'
  | 'activity'
  | 'workshop'
  | 'intervention'
  | 'resource'
  | 'appointment'
  | 'task'
  | 'partner';
export type Permission =
  | `${ResourceKind}.read`
  | 'case.read.center'
  | 'search.use'
  | 'recommendation.use'
  | 'recommendation.validate'
  | 'workshop.plan'
  | 'psychology.read'
  | 'aggregate.read';
export type AccessAttributes = Record<string, string | boolean | number | string[]>;
export interface AttributeCondition {
  attribute: string;
  equals: string | boolean | number;
}
export interface ResourcePolicy {
  cdisId?: string;
  allowedRoles?: Role[];
  requiredPermissions?: Permission[];
  attributeConditions?: AttributeCondition[];
  sensitivity?: 'team' | 'psychological';
}
export interface Child {
  id: string;
  child_code?: string;
  name: Bi;
  birthDate: string;
  birthplace: string;
  gender: 'female' | 'male' | '';
  address: string;
  phone: string;
  school: string;
  education: string;
  father: string;
  mother: string;
  familyId: string;
  preferences: string[];
}
export interface Family {
  id: string;
  label: Bi;
  members: { name: string; relationship: string }[];
  notes: string;
}
export interface Center {
  id: string;
  name: Bi;
  region: Bi;
}
export interface Professional {
  id: string;
  name: Bi;
  role: Role;
  specialty: Bi;
  centerId: string;
  email: string;
  availability: string;
}
export interface CaseAssignment {
  caseId: string;
  professionalId: string;
}
export interface EducationalGoal {
  id: string;
  skill: string;
  description: Bi;
  confirmed: boolean;
  confirmedBy?: string;
  confirmedAt?: string;
  dueDate: string;
}
export interface Decision {
  id: string;
  kind: 'advance' | 'extend' | 'close' | 'supervise' | 'archive';
  from: Stage;
  to: Stage;
  date: string;
  professionalId: string;
  reason: string;
  cycle: number;
}
export type SubStageStatus =
  'notStarted' | 'inProgress' | 'completed' | 'pending' | 'validated' | 'notApplicable';
export interface Case {
  roadmapVersion?: number;
  id: string;
  childId: string;
  centerId: string;
  referentId: string;
  openedAt: string;
  stage: Stage;
  status: 'active' | 'closed' | 'archived';
  nextDue: string;
  source: string;
  cycle: number;
  goals: EducationalGoal[];
  decisions: Decision[];
  subStages: Record<string, SubStageStatus>;
  supervised: boolean;
  projectNotes: string;
  access?: ResourcePolicy;
}
export interface JourneyEvent {
  id: string;
  caseId: string;
  date: string;
  type:
    | 'registration'
    | 'observation'
    | 'assessment'
    | 'document'
    | 'activity'
    | 'decision'
    | 'integration'
    | 'transfer'
    | 'goal'
    | 'recommendation';
  title: Bi;
  note: string;
  professionalId: string;
  stage: Stage;
  sourceId?: string;
}
export type FormId = `F${string}`;
export type FieldType =
  | 'text'
  | 'textarea'
  | 'number'
  | 'date'
  | 'time'
  | 'select'
  | 'radio'
  | 'checkbox'
  | 'multi'
  | 'table'
  | 'matrix';
export type FormValue =
  string | number | boolean | string[] | Record<string, string>[] | Record<string, string>;
export type FormValues = Record<string, FormValue>;
export interface FieldDefinition {
  key: string;
  label: Bi;
  type: FieldType;
  required?: boolean;
  options?: { value: string; label: Bi }[];
  shared?: keyof Child | 'caseId' | 'openedAt' | 'referent' | 'center';
  columns?: { key: string; label: Bi; type?: FieldType }[];
  rows?: Bi[];
  condition?: { field: string; value: string };
  help?: Bi;
  min?: number;
  max?: number;
}
export interface FormSection {
  id: string;
  title: Bi;
  fields: FieldDefinition[];
  note?: Bi;
}
export interface FormDefinition {
  id: FormId;
  title: Bi;
  stages: Stage[];
  sections: FormSection[];
  role: Role;
  version: number;
  reference: string[];
}
export interface FormSubmission {
  id: string;
  caseId: string;
  formId: FormId;
  values: FormValues;
  status: 'draft' | 'completed' | 'validated';
  date: string;
  authorId: string;
  version: number;
  definitionVersion: number;
}
export interface ActivityTemplate {
  id: string;
  title: Bi;
  description: Bi;
  category: string;
  skills: string[];
  minAge: number;
  maxAge: number;
  duration: number;
  minParticipants: number;
  maxParticipants: number;
  format: 'individual' | 'group';
  materials: string[];
  instructions: Bi[];
  adaptations: Bi;
  evaluation: Bi;
  conditions: Bi;
  source: Bi;
  validation: 'example';
  favorite: boolean;
  createdAt: string;
  professionalValidation?: { professionalId: string; date: string };
  access?: ResourcePolicy;
}
export interface ProfessionalResource {
  id: string;
  title: Bi;
  description: Bi;
  skills: string[];
  domains: string[];
  content: Bi[];
  source: Bi;
  validatedBy: string;
  validatedAt: string;
  access?: ResourcePolicy;
}
export interface PartnerStructure {
  id: string;
  name: Bi;
  description: Bi;
  services: Bi[];
  access: ResourcePolicy;
}
export interface ActivityParticipation {
  caseId: string;
  attendance: 'present' | 'absent' | 'excused';
  engagement: 'active' | 'partial' | 'observing';
  observations: string;
  progress: string;
}
export interface ActivitySession {
  id: string;
  activityId: string;
  date: string;
  time: string;
  educatorId: string;
  group: string;
  participants: ActivityParticipation[];
  status: 'planned' | 'inProgress' | 'completed' | 'postponed' | 'cancelled';
  adaptations: string;
  goalIds: string[];
  recommendationId?: string;
}
export interface Recommendation {
  runId?: string;
  modelExplanation?: string | null;
  id: string;
  caseId: string;
  activityId: string;
  goalIds: string[];
  score: number;
  reasons: Bi[];
  status: 'suggested' | 'accepted' | 'rejected' | 'deferred';
  date: string;
  sessionId?: string;
  feedback?: string;
  contextId?: string;
  kind?: 'activity' | 'resource' | 'program' | 'followUp';
  title?: Bi;
  summary?: Bi;
  sources?: { id: string; kind: ResourceKind; label: Bi; path: string }[];
  program?: Bi[];
  resourceId?: string;
  targetCaseIds?: string[];
  targetGoalIds?: Record<string, string[]>;
  projectId?: string;
  generatedFor?: string;
  inputs?: RecommendationInput;
  reviewedBy?: string;
  reviewedAt?: string;
  humanDecision?: 'accepted' | 'adapted' | 'rejected' | 'deferred';
}
export interface Appointment {
  id: string;
  caseId?: string;
  title: Bi;
  type: 'interview' | 'evaluation' | 'meeting' | 'followUp';
  date: string;
  time: string;
  professionalId: string;
  completed: boolean;
  notes: string;
}
export interface Task {
  id: string;
  title: Bi;
  caseId?: string;
  dueDate: string;
  completed: boolean;
  professionalId: string;
}
export interface IntegrationRecord {
  id: string;
  caseId: string;
  partner: string;
  type: 'school' | 'family' | 'training' | 'secondChance' | 'other';
  date: string;
  objectives: string;
  notes: string;
  status: 'proposed' | 'confirmed' | 'followUp' | 'completed';
  result: string;
  followUpDate: string;
  professionalId: string;
}
export interface CaseTransfer {
  id: string;
  caseId: string;
  fromCenter: string;
  toCenter: string;
  date: string;
  reason: string;
  status: 'requested' | 'confirmed';
  professionalId: string;
}
export interface ForumAttachment {
  id: string;
  name: string;
  mediaType: string;
  size: number;
}
export interface ForumEntry {
  id: string;
  authorId: string;
  body: string;
  date: string;
  attachments?: ForumAttachment[];
}
export interface ProfessionalPost {
  id: string;
  authorId: string;
  date: string;
  body: string;
  category: Bi;
  likes: string[];
  favorite: boolean;
  attachments?: ForumAttachment[];
  comments: ForumEntry[];
}
export interface Conversation {
  id: string;
  title: Bi;
  members: string[];
  messages: ForumEntry[];
}
export interface AppData {
  backend?: {
    authority: 'server';
    roadmapHistory?: {
      id: string;
      caseId: string;
      version: number;
      date: string;
      authorId: string;
    }[];
    plannedInterventions?: {
      id: string;
      caseId: string;
      intervention_id: string;
      date: string;
      reason: string;
    }[];
    fingerprint: string;
    access: Record<
      string,
      {
        categories: Record<string, { read: boolean; write: boolean }>;
        forms: Record<string, boolean>;
        identity?: { read: boolean; write: boolean };
      }
    >;
    templates: Record<string, RecommendationContext[]>;
    documentMetadata: {
      id: string;
      case_id: string;
      title: Bi;
      category: string;
      approval_status: string;
      versions: number;
    }[];
  };
  schemaVersion: 1;
  demoDate: string;
  children: Child[];
  families: Family[];
  centers: Center[];
  professionals: Professional[];
  assignments: CaseAssignment[];
  cases: Case[];
  events: JourneyEvent[];
  submissions: FormSubmission[];
  activities: ActivityTemplate[];
  resources: ProfessionalResource[];
  partners: PartnerStructure[];
  sessions: ActivitySession[];
  recommendations: Recommendation[];
  appointments: Appointment[];
  tasks: Task[];
  integrations: IntegrationRecord[];
  transfers: CaseTransfer[];
  posts: ProfessionalPost[];
  conversations: Conversation[];
  searchHistory: string[];
  searchHistories: Record<string, string[]>;
}
export interface SessionContext {
  authority?: 'server';
  sessionId?: string;
  capabilities?: string[];
  authorizedCentreIds?: string[];
  userId: string;
  professionalRole: Role;
  cdisId: string;
  assignedCaseIds: string[];
  permissions: Permission[];
  attributes: AccessAttributes;
  // Compatibility aliases for the original business modules. Policy checks their consistency.
  professionalId: string;
  centerId: string;
  role: Role;
  simulation: true;
}
export type RecommendationInputKey =
  | 'caseId'
  | 'projectId'
  | 'groupId'
  | 'workshopId'
  | 'goalIds'
  | 'skills'
  | 'maxDuration'
  | 'materials'
  | 'format'
  | 'participants'
  | 'request'
  | 'constraints';
export type RecommendationStrategy =
  | 'activities'
  | 'project'
  | 'training'
  | 'resources'
  | 'social'
  | 'family'
  | 'orientation'
  | 'documents'
  | 'deadlines'
  | 'coordination'
  | 'support';
export interface RecommendationContext {
  contextId: string;
  labelAr: string;
  labelFr: string;
  description: Bi;
  icon: string;
  allowedRoles: Role[];
  requiredPermissions: Permission[];
  attributeConditions: AttributeCondition[];
  requiredInputs: RecommendationInputKey[];
  optionalInputs: RecommendationInputKey[];
  authorizedDataSources: ResourceKind[];
  recommendationStrategy: RecommendationStrategy;
  outputSchema:
    'activity-proposals' | 'resource-proposals' | 'program-outline' | 'follow-up-proposals';
}
export interface RecommendationInput {
  caseId?: string;
  projectId?: string;
  groupId?: string;
  workshopId?: string;
  goalIds?: string[];
  skills?: string[];
  constraints?: Partial<RecommendationConstraints>;
  additionalConstraints?: string;
  request?: string;
  activityId?: string;
}
export interface RecommendationConstraints {
  maxDuration: number;
  format: 'any' | 'individual' | 'group';
  materials: string[];
  participants: number;
}
