import type { AccessAttributes, Permission, ResourceKind, Role } from '../types';

// Provisional demonstration policies, subject to institutional validation.
const shared: ResourceKind[] = [
  'case',
  'form',
  'document',
  'observation',
  'evaluation',
  'project',
  'activity',
  'workshop',
  'intervention',
  'resource',
  'appointment',
  'task',
  'partner',
];
const readerPermissions: Permission[] = [
  ...shared.map((kind): Permission => `${kind}.read`),
  'aggregate.read',
];
export const demoRolePermissions: Record<Role, Permission[]> = {
  educator: [
    ...readerPermissions,
    'search.use',
    'recommendation.use',
    'recommendation.validate',
    'workshop.plan',
  ],
  social: [
    ...readerPermissions,
    'search.use',
    'recommendation.use',
    'recommendation.validate',
    'workshop.plan',
  ],
  psychologist: [
    ...readerPermissions,
    'search.use',
    'recommendation.use',
    'recommendation.validate',
    'workshop.plan',
    'psychology.read',
  ],
  administration: [
    ...readerPermissions,
    'search.use',
    'recommendation.use',
    'recommendation.validate',
    'case.read.center',
  ],
};
export const demoRoleAttributes: Record<Role, AccessAttributes> = {
  educator: {
    active: true,
    caseScope: 'assigned',
    canRecommend: true,
    educationQualified: true,
    trainingQualified: true,
    psychologyAuthorized: false,
  },
  social: {
    active: true,
    caseScope: 'assigned',
    canRecommend: true,
    socialQualified: true,
    trainingQualified: true,
    psychologyAuthorized: false,
  },
  psychologist: {
    active: true,
    caseScope: 'assigned',
    canRecommend: true,
    psychologyAuthorized: true,
    supportApproved: true,
  },
  administration: {
    active: true,
    caseScope: 'center',
    canRecommend: true,
    administrativeQualified: true,
    psychologyAuthorized: false,
  },
};
export const demoProfileOverrides: Record<
  string,
  { permissions?: Permission[]; attributes: AccessAttributes }
> = {
  // Same profession as p3; reduced assignment, permissions and attributes.
  p6: {
    permissions: [
      'case.read',
      'form.read',
      'document.read',
      'project.read',
      'resource.read',
      'search.use',
      'recommendation.use',
      'recommendation.validate',
    ],
    attributes: {
      educationQualified: false,
      trainingQualified: false,
      caseScope: 'assigned',
      nationalAggregates: false,
    },
  },
};
export const accessPolicyVersion = 'demo-rbac-abac-v1';
