import { beforeEach, describe, expect, it } from 'vitest';
import { createSeed } from '../src/data/seed';
import { createDemoSession, authorizedCases } from '../src/services/auth';
import { accessPolicyService } from '../src/services/accessPolicy';
import {
  LocalSearchProvider,
  matchRanges,
  normalize,
  rememberSearch,
  searchCategories,
  searchProvider,
} from '../src/services/search';
import type { SearchDocument } from '../src/services/search';
import {
  centralRecommendationEngine,
  CentralRecommendationEngine,
} from '../src/legacy/recommendations';
import {
  RecommendationContextRegistry,
  recommendationContextRegistry,
} from '../src/services/recommendationContextRegistry';
import { reviewRecommendation, scheduleRecommendation } from '../src/services/actions';
import { IndexedDbRepository, dataSchema, migrateLocalData } from '../src/db/repository';
import { forms } from '../src/data/form-definitions';
import type { AppData, RecommendationInput, SessionContext } from '../src/types';

let data: AppData;
let educator: SessionContext;
const activityInput: RecommendationInput = {
  caseId: 'CDIS-024',
  constraints: {
    format: 'individual',
    participants: 1,
    maxDuration: 60,
    materials: ['cards', 'paper', 'pencils', 'none'],
  },
};
beforeEach(() => {
  data = createSeed();
  educator = createDemoSession('p3', data);
});

describe('Politique hybride partagée', () => {
  it('croise identité, métier, centre, affectation, permissions et attributs', () => {
    expect(authorizedCases(data, educator)).toHaveLength(32);
    expect(authorizedCases(data, createDemoSession('p6', data)).map((c) => c.id)).toEqual([
      'CDIS-024',
    ]);
    expect(authorizedCases(data, { ...educator, assignedCaseIds: [] })).toHaveLength(0);
    expect(authorizedCases(data, { ...educator, permissions: [] })).toHaveLength(0);
    expect(
      authorizedCases(data, { ...educator, attributes: { ...educator.attributes, active: false } }),
    ).toHaveLength(0);
    expect(authorizedCases(data, { ...educator, cdisId: 'gabes' })).toHaveLength(0);
    data.assignments = data.assignments.filter((a) => a.professionalId !== educator.userId);
    expect(authorizedCases(data, educator)).toHaveLength(0);
    const admin = createDemoSession('p4', data);
    expect(authorizedCases(data, admin)).toHaveLength(32);
    expect(
      authorizedCases(data, {
        ...admin,
        permissions: admin.permissions.filter((p) => p !== 'case.read.center'),
      }),
    ).toHaveLength(0);
  });
  it('applique les caractéristiques de la ressource et refuse par défaut', () => {
    const c = data.cases[23];
    c.access = {
      allowedRoles: ['educator'],
      attributeConditions: [{ attribute: 'specialMandate', equals: true }],
    };
    expect(authorizedCases(data, educator).some((r) => r.id === c.id)).toBe(false);
    expect(
      authorizedCases(data, {
        ...educator,
        attributes: { ...educator.attributes, specialMandate: true },
      }).some((r) => r.id === c.id),
    ).toBe(true);
    expect(accessPolicyService.canRead(data, null, { kind: 'activity' })).toBe(false);
    expect(accessPolicyService.canRead(data, educator, { kind: 'case' })).toBe(false);
    expect(accessPolicyService.canRead(data, educator, { kind: 'task', ownerId: 'p2' })).toBe(
      false,
    );
  });
});

describe('Recherche autorisée avant indexation', () => {
  it('couvre les treize catégories et ouvre des sources précises', () => {
    for (const [kind, label] of Object.entries(searchCategories)) {
      const result = searchProvider.search(label.fr, data, educator, kind);
      expect(result.results.length, kind).toBeGreaterThan(0);
      expect(result.results.every((r) => r.type === kind && r.path.startsWith('/'))).toBe(true);
    }
    expect(
      searchProvider
        .search('F08', data, educator)
        .results.some((r) => r.path.includes('?version=')),
    ).toBe(true);
    expect(
      searchProvider
        .search('session-demo', data, educator)
        .results.some((r) => r.path === '/sessions?session=session-demo'),
    ).toBe(true);
    expect(searchProvider.search('RES-EDU', data, educator).results[0].path).toBe(
      '/library?resource=RES-EDU',
    );
    expect(searchProvider.search('CDIS-035', data, educator).results).toEqual([]);
  });
  it('ne transmet aucun texte interdit au backend, ni aux aperçus ni aux compteurs', () => {
    const forbidden = data.cases[34];
    data.children.find((ch) => ch.id === forbidden.childId)!.name.fr = 'INACCESSIBLE-CHILD';
    const psych = data.submissions.find((s) => s.caseId === 'CDIS-024' && s.formId === 'F12')!;
    psych.values.notes = 'INACCESSIBLE-PSYCHOLOGY';
    data.tasks.push({
      id: 'INACCESSIBLE-TASK',
      title: { ar: 'مهمة', fr: 'INACCESSIBLE-OWNER' },
      dueDate: data.demoDate,
      professionalId: 'p2',
      completed: false,
    });
    data.sessions.push({
      ...structuredClone(data.sessions[0]),
      id: 'INACCESSIBLE-WORKSHOP',
      group: 'INACCESSIBLE-GROUP',
      participants: [
        data.sessions[0].participants[0],
        {
          caseId: forbidden.id,
          attendance: 'present',
          engagement: 'active',
          observations: 'INACCESSIBLE-OBSERVATION',
          progress: '',
        },
      ],
    });
    data.events.push({
      ...data.events[0],
      id: 'restricted-group-event',
      caseId: 'CDIS-024',
      type: 'activity',
      sourceId: 'INACCESSIBLE-WORKSHOP',
      note: 'INACCESSIBLE-GROUP-EVENT',
    });
    let indexed: readonly SearchDocument[] = [];
    const search = new LocalSearchProvider({
      search: (_q, documents) => {
        indexed = documents;
        return [...documents];
      },
    });
    const output = search.search('inaccessible', data, educator);
    expect(JSON.stringify(indexed)).not.toContain('INACCESSIBLE');
    expect(JSON.stringify(output)).not.toContain('INACCESSIBLE');
    expect(indexed.some((r) => r.id === psych.id)).toBe(false);
    expect(
      searchProvider
        .search('INACCESSIBLE-PSYCHOLOGY', data, createDemoSession('p2', data))
        .results.some((r) => r.id === psych.id),
    ).toBe(true);
    expect(JSON.stringify(accessPolicyService.authorizedData(data, educator))).not.toContain(
      'INACCESSIBLE',
    );
  });
  it('réévalue les permissions et isole l’historique par contexte d’accès', () => {
    rememberSearch(data, educator, 'Mot privé du profil');
    const key = accessPolicyService.contextKey(data, educator);
    expect(accessPolicyService.authorizedData(data, educator).searchHistories[key]).toEqual([
      'Mot privé du profil',
    ]);
    const limited = createDemoSession('p6', data);
    expect(
      JSON.stringify(accessPolicyService.authorizedData(data, limited).searchHistories),
    ).not.toContain('Mot privé');
    expect(searchProvider.search('CDIS-024', data, educator).results.length).toBeGreaterThan(0);
    const reduced = { ...educator, attributes: { ...educator.attributes, caseAccess: false } };
    expect(searchProvider.search('CDIS-024', data, reduced).results).toEqual([]);
    expect(
      JSON.stringify(accessPolicyService.authorizedData(data, reduced).searchHistories),
    ).not.toContain('Mot privé');
    expect(
      searchProvider.search('activité', data, {
        ...educator,
        permissions: educator.permissions.filter((p) => p !== 'search.use'),
      }).results,
    ).toEqual([]);
  });
  it('propage les restrictions des documents et activités aux événements et recommandations historiques', () => {
    const e = data.events.find((e) => e.caseId === 'CDIS-024' && e.type === 'assessment')!;
    e.note = 'SOURCE-DOCUMENT-EXCLUSIVE';
    const noDocuments = {
      ...educator,
      permissions: educator.permissions.filter((p) => p !== 'document.read'),
    };
    expect(searchProvider.search('SOURCE-DOCUMENT-EXCLUSIVE', data, noDocuments).results).toEqual(
      [],
    );
    const activity = data.activities.find((a) => a.id === 'ACT-002')!;
    activity.access = { allowedRoles: ['psychologist'] };
    data.events.push({
      ...e,
      id: 'restricted-activity-event',
      type: 'activity',
      sourceId: 'session-demo',
      note: 'SOURCE-ACTIVITY-EXCLUSIVE',
    });
    expect(searchProvider.search('SOURCE-ACTIVITY-EXCLUSIVE', data, educator).results).toEqual([]);
    data.recommendations.push({
      id: 'legacy',
      caseId: 'CDIS-024',
      activityId: 'ACT-002',
      goalIds: [],
      score: 0,
      reasons: [],
      status: 'accepted',
      date: data.demoDate,
    });
    expect(accessPolicyService.authorizedData(data, educator).recommendations).toEqual([]);
  });
  it('normalise et surligne sans altérer la narration française ou arabe', () => {
    expect(normalize('Évaluation / œuvre')).toBe('evaluation oeuvre');
    expect(normalize('إِدْمَاج')).toBe(normalize('ادماج'));
    const french = 'Une ÉVALUATION à revoir';
    const ar = 'نشاط إِدْمَاج';
    expect(matchRanges(french, 'evaluation').map((r) => french.slice(r.start, r.end))).toEqual([
      'ÉVALUATION',
    ]);
    expect(matchRanges(ar, 'ادماج').map((r) => ar.slice(r.start, r.end))).toEqual(['إِدْمَاج']);
  });
});

describe('Registre et moteur central unique', () => {
  it('adapte les contextes au rôle, aux attributs et aux permissions', () => {
    const ids = (user: SessionContext) =>
      recommendationContextRegistry.available(data, user).map((c) => c.contextId);
    expect(ids(educator)).toEqual(
      expect.arrayContaining(['workshops', 'educational-project', 'educational-resources']),
    );
    expect(ids(createDemoSession('p6', data))).toEqual(['educational-resources']);
    expect(ids(createDemoSession('p1', data))).toContain('family-support');
    expect(ids(createDemoSession('p2', data))).toContain('support-activities');
    expect(ids(createDemoSession('p4', data))).toContain('deadlines');
    expect(
      ids({ ...educator, attributes: { ...educator.attributes, educationQualified: false } }),
    ).not.toContain('workshops');
    expect(
      ids({ ...educator, permissions: educator.permissions.filter((p) => p !== 'resource.read') }),
    ).not.toContain('educational-resources');
    expect(() =>
      centralRecommendationEngine.generate(
        data,
        createDemoSession('p1', data),
        'workshops',
        activityInput,
      ),
    ).toThrow('ACCESS');
  });
  it('utilise des stratégies internes configurables et des sorties propres au contexte', () => {
    const workshops = centralRecommendationEngine.generate(
      data,
      educator,
      'workshops',
      activityInput,
    );
    expect(workshops.length).toBeGreaterThan(0);
    expect(
      workshops.every(
        (r) => r.kind === 'activity' && r.contextId === 'workshops' && r.sources!.length >= 2,
      ),
    ).toBe(true);
    expect(workshops).toEqual(
      centralRecommendationEngine.generate(data, educator, 'workshops', activityInput),
    );
    const project = centralRecommendationEngine.generate(data, educator, 'educational-project', {
      ...activityInput,
      projectId: data.submissions.find((s) => s.caseId === 'CDIS-024' && s.formId === 'F13')!.id,
    });
    expect(project.some((r) => r.kind === 'activity' && r.program?.length)).toBe(true);
    expect(project.some((r) => r.kind === 'resource')).toBe(true);
    const social = centralRecommendationEngine.generate(
      data,
      createDemoSession('p1', data),
      'family-support',
      { caseId: 'CDIS-024' },
    );
    expect(social[0].resourceId).toBe('RES-SOCIAL');
    expect(social.every((r) => !r.activityId)).toBe(true);
    const admin = centralRecommendationEngine.generate(
      data,
      createDemoSession('p4', data),
      'deadlines',
      {},
    );
    expect(admin.length).toBeGreaterThan(0);
    expect(
      admin.every(
        (r) =>
          r.kind === 'followUp' && r.sources?.some((s) => ['task', 'appointment'].includes(s.kind)),
      ),
    ).toBe(true);
    expect(
      centralRecommendationEngine
        .generate(data, createDemoSession('p4', data), 'administrative-coordination', {})
        .some((r) => r.resourceId === 'RES-SOCIAL'),
    ).toBe(false);
    const custom = {
      ...recommendationContextRegistry.get('educational-resources')!,
      contextId: 'custom-resource',
      requiredInputs: ['caseId', 'goalIds'] as const,
    };
    const registry = new RecommendationContextRegistry([
      { ...custom, requiredInputs: [...custom.requiredInputs] },
    ]);
    expect(
      new CentralRecommendationEngine(registry).generate(data, educator, 'custom-resource', {
        caseId: 'CDIS-024',
      })[0].contextId,
    ).toBe('custom-resource');
  });
  it('ne prend que les objectifs confirmés et ignore les classifications sensibles', () => {
    const before = centralRecommendationEngine.generate(data, educator, 'workshops', activityInput);
    data.submissions.forEach((s) => {
      s.values.classification = 'Texte de classification';
      s.values.diagnosis = 'Texte clinique';
    });
    data.events.forEach((e) => {
      e.note = 'Observation modifiée';
    });
    expect(
      centralRecommendationEngine.generate(data, educator, 'workshops', activityInput),
    ).toEqual(before);
    data.cases[23].goals.forEach((g) => {
      g.confirmed = false;
    });
    expect(
      centralRecommendationEngine.generate(data, educator, 'workshops', activityInput),
    ).toEqual([]);
    expect(() =>
      centralRecommendationEngine.generate(data, educator, 'workshops', {
        ...activityInput,
        goalIds: ['unconfirmed'],
      }),
    ).toThrow('GOALS');
  });
  it('exige une validation préalable des activités de soutien et protège les groupes entiers', () => {
    const psychologist = createDemoSession('p2', data);
    const support = centralRecommendationEngine.generate(
      data,
      psychologist,
      'support-activities',
      activityInput,
    );
    expect(support.length).toBeGreaterThan(0);
    expect(
      support.every(
        (r) => data.activities.find((a) => a.id === r.activityId)?.professionalValidation,
      ),
    ).toBe(true);
    data.activities.forEach((a) => {
      delete a.professionalValidation;
    });
    expect(
      centralRecommendationEngine.generate(data, psychologist, 'support-activities', activityInput),
    ).toEqual([]);
    data.sessions
      .find((s) => s.id === 'session-demo')!
      .participants.push({
        caseId: 'CDIS-035',
        attendance: 'present',
        engagement: 'active',
        observations: '',
        progress: '',
      });
    expect(() =>
      centralRecommendationEngine.generate(data, educator, 'workshops', {
        workshopId: 'session-demo',
      }),
    ).toThrow('ACCESS');
    expect(() =>
      centralRecommendationEngine.generate(data, educator, 'educational-project', {
        caseId: 'CDIS-035',
      }),
    ).toThrow('ACCESS');
  });
});

describe('Validation humaine, dossier et persistance', () => {
  it('ne modifie rien à la génération et trace l’adaptation dans le dossier sans modifier le parcours', async () => {
    const immutable = structuredClone(data.submissions);
    const initial = structuredClone(data.cases[23]);
    const snapshot = structuredClone(data);
    const rec = centralRecommendationEngine.generate(data, educator, 'educational-resources', {
      caseId: initial.id,
    })[0];
    expect(data).toEqual(snapshot);
    expect(() => reviewRecommendation(data, educator, rec, 'accepted', '')).toThrow('REASON');
    reviewRecommendation(
      data,
      educator,
      rec,
      'adapted',
      'Adaptation fictive : séance courte et support visuel.',
    );
    expect(data.recommendations.find((r) => r.id === rec.id)).toMatchObject({
      status: 'accepted',
      humanDecision: 'adapted',
      reviewedBy: educator.userId,
    });
    expect(
      data.events.some(
        (e) =>
          e.caseId === initial.id && e.sourceId === rec.id && e.note.includes('support visuel'),
      ),
    ).toBe(true);
    expect(
      accessPolicyService
        .authorizedData(data, educator)
        .events.some((e) => e.sourceId === rec.id && e.type === 'recommendation'),
    ).toBe(true);
    expect(data.cases[23]).toEqual(initial);
    expect(data.submissions).toEqual(immutable);
    const repo = new IndexedDbRepository();
    await repo.save(data);
    expect((await repo.load())?.recommendations.find((r) => r.id === rec.id)?.feedback).toContain(
      'support visuel',
    );
  });
  it('enregistre refus et report sans intervention automatique', () => {
    const rec = centralRecommendationEngine.generate(data, educator, 'workshops', activityInput)[0];
    const count = data.sessions.length;
    reviewRecommendation(data, educator, rec, 'rejected', 'Matériel indisponible pour ce créneau.');
    expect(data.sessions.length).toBe(count);
    expect(data.events.at(-1)?.sourceId).toBe(rec.id);
    reviewRecommendation(data, educator, rec, 'deferred', 'Réexaminer à la prochaine réunion.');
    expect(data.events.filter((e) => e.sourceId === rec.id)).toHaveLength(2);
    expect(
      data.events.filter((e) => e.sourceId === rec.id).every((e) => e.type === 'recommendation'),
    ).toBe(true);
  });
  it('rend la validation de ressource visible au professionnel limité autorisé sur le dossier', () => {
    const limited = createDemoSession('p6', data);
    const rec = centralRecommendationEngine.generate(data, limited, 'educational-resources', {
      caseId: 'CDIS-024',
    })[0];
    reviewRecommendation(data, limited, rec, 'adapted', 'Adaptation professionnelle fictive.');
    expect(
      accessPolicyService.authorizedData(data, limited).events.some((e) => e.sourceId === rec.id),
    ).toBe(true);
  });
  it('refuse une ancienne proposition après changement de profil, révocation ou falsification', () => {
    const rec = centralRecommendationEngine.generate(data, educator, 'workshops', activityInput)[0];
    const unchanged = structuredClone(data);
    expect(() =>
      scheduleRecommendation(
        data,
        createDemoSession('p6', data),
        rec,
        data.demoDate,
        '10:00',
        [],
        'Motif',
      ),
    ).toThrow('ACCESS');
    expect(data).toEqual(unchanged);
    expect(() =>
      centralRecommendationEngine.validateProposal(data, educator, {
        ...rec,
        goalIds: ['falsified'],
      }),
    ).toThrow('STALE_RECOMMENDATION');
    data.cases[23].goals.forEach((g) => {
      g.confirmed = false;
    });
    expect(() =>
      scheduleRecommendation(data, educator, rec, data.demoDate, '10:00', [], 'Motif'),
    ).toThrow();
  });
  it('migre les anciennes données sans perdre les cinq étapes, les quinze formulaires et les narrations', () => {
    const legacy = structuredClone(data) as unknown as Record<string, unknown>;
    delete legacy.resources;
    delete legacy.partners;
    delete legacy.searchHistories;
    const migrated = dataSchema.parse(migrateLocalData(legacy));
    expect(migrated.submissions).toEqual(data.submissions);
    expect(migrated.children).toEqual(data.children);
    expect(migrated.resources.length).toBeGreaterThan(0);
    expect(migrated.cases).toHaveLength(40);
    expect(forms).toHaveLength(15);
    expect(new Set(migrated.cases.map((c) => c.stage)).size).toBe(5);
  });
});
