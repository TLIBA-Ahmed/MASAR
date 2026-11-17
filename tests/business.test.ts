import { beforeEach, describe, expect, it } from 'vitest';
import { createSeed } from '../src/data/seed';
import {
  createCase,
  completeSession,
  decide,
  saveSubmission,
  scheduleRecommendation,
} from '../src/services/actions';
import { authorizedCases, createDemoSession } from '../src/services/auth';
import { forms, getForm } from '../src/data/form-definitions';
import { prefillForm, validateForm } from '../src/services/forms';
import { centralRecommendationEngine } from '../src/legacy/recommendations';
import { normalize, searchProvider } from '../src/services/search';
import { aggregateNational } from '../src/services/analytics';
import { IndexedDbRepository, dataSchema } from '../src/db/repository';
import type { AppData, Case, RecommendationConstraints } from '../src/types';
const social = createDemoSession('p1', createSeed());
const admin = createDemoSession('p4', createSeed());
const educator = createDemoSession('p3', createSeed());
const recommend = (data: AppData, c: Case, constraints: RecommendationConstraints) =>
  centralRecommendationEngine.generate(data, educator, 'workshops', { caseId: c.id, constraints });
const constraints = {
  maxDuration: 60,
  format: 'individual' as const,
  materials: ['cards', 'paper', 'pencils', 'none'],
  participants: 1,
};
let data: AppData;
beforeEach(() => {
  data = createSeed();
});
describe('Dataset et portée de démonstration', () => {
  it('contient 40 dossiers, 30 activités, 15 schémas et les cinq étapes', () => {
    expect(data.cases).toHaveLength(40);
    expect(data.activities).toHaveLength(30);
    expect(forms.map((f) => f.id)).toHaveLength(15);
    expect(new Set(data.cases.map((c) => c.stage)).size).toBe(5);
    expect(data.cases.some((c) => c.id === 'CDIS-024')).toBe(true);
  });
  it('ne renvoie que les dossiers affectés du centre courant', () => {
    const cases = authorizedCases(data, social);
    expect(cases).toHaveLength(32);
    expect(cases.every((c) => c.centerId === 'siliana')).toBe(true);
    data.assignments = data.assignments.filter(
      (a) => a.caseId !== 'CDIS-024' || a.professionalId !== 'p1',
    );
    expect(authorizedCases(data, social).some((c) => c.id === 'CDIS-024')).toBe(false);
  });
  it('lie explicitement deux enfants à une famille sans inférence', () => {
    const ch = data.children.find((c) => c.id === data.cases[23].childId)!;
    expect(data.children.filter((c) => c.familyId === ch.familyId)).toHaveLength(2);
  });
  it('produit des agrégats nationaux sans noms ou identifiants individuels', () => {
    const national = aggregateNational(data);
    expect(national.total).toBe(40);
    expect(national.centers.reduce((sum, c) => sum + c.total, 0)).toBe(40);
    expect(national.stages.reduce((a, b) => a + b, 0)).toBe(40);
    expect(JSON.stringify(national)).not.toContain('CDIS-024');
    expect(JSON.stringify(national)).not.toContain('Adam');
    expect(aggregateNational(data, { centerId: 'siliana' }).total).toBe(32);
  });
});
describe('Source centrale et documents historiques', () => {
  it('crée un dossier social et préremplit les formulaires suivants', () => {
    const id = createCase(data, social, {
      name: { ar: 'اسم اصطناعي', fr: 'Nom fictif' },
      birthDate: '2013-04-10',
      gender: 'male',
      address: 'عنوان اصطناعي',
      father: '',
      mother: '',
      source: 'École fictive',
    });
    const c = data.cases.find((c) => c.id === id)!;
    expect(prefillForm(getForm('F01')!, data, c, 'ar').childName).toBe('اسم اصطناعي');
    expect(prefillForm(getForm('F11')!, data, c, 'ar').address).toBe('عنوان اصطناعي');
    expect(data.events.filter((e) => e.caseId === id)).toHaveLength(1);
  });
  it('réserve l’ouverture au travailleur social et refuse les adultes', () => {
    const input = {
      name: { ar: 'تجربة', fr: 'Démo' },
      birthDate: '1990-01-01',
      gender: 'male' as const,
      address: '',
      father: '',
      mother: '',
      source: '',
    };
    expect(() => createCase(data, admin, input)).toThrow('SOCIAL_ONLY');
    expect(() => createCase(data, social, input)).toThrow('VALIDATION');
  });
  it('conserve les versions validées lors d’une modification canonique', () => {
    const c = data.cases[23];
    const form = getForm('F01')!;
    const before = structuredClone(
      data.submissions.filter((s) => s.caseId === c.id && s.formId === form.id),
    );
    const values = prefillForm(form, data, c, 'ar');
    values.address = 'عنوان اصطناعي جديد';
    saveSubmission(data, social, c.id, form, values, 'validated', 'ar');
    expect(data.children.find((ch) => ch.id === c.childId)!.address).toBe('عنوان اصطناعي جديد');
    expect(data.submissions.filter((s) => before.some((p) => p.id === s.id))).toEqual(before);
    expect(data.submissions.filter((s) => s.caseId === c.id && s.formId === form.id)).toHaveLength(
      before.length + 1,
    );
  });
  it('met à jour un brouillon sans modifier le profil courant', () => {
    const c = data.cases[0];
    const form = getForm('F01')!;
    const v = prefillForm(form, data, c, 'ar');
    v.address = 'adresse de brouillon';
    saveSubmission(data, social, c.id, form, v, 'draft', 'ar');
    saveSubmission(data, social, c.id, form, { ...v, notes: 'Suite' }, 'draft', 'ar');
    expect(data.submissions.filter((s) => s.caseId === c.id && s.formId === 'F01')).toHaveLength(1);
    expect(data.children[0].address).not.toBe(v.address);
  });
  it('valide les champs conditionnels et les identifiants fictifs', () => {
    const form = getForm('F15')!;
    const values = prefillForm(form, data, data.cases[0], 'ar');
    values.demoIdentity = '12345678';
    expect(validateForm(form, values, data.demoDate).demoIdentity).toBe('demo');
    values.demoIdentity = 'DEMO-001';
    expect(validateForm(form, values, data.demoDate).demoIdentity).toBeUndefined();
  });
  it('préremplit une convocation depuis le rendez-vous associé', () => {
    const c = data.cases[23];
    const values = prefillForm(getForm('F03')!, data, c, 'ar');
    expect(values.appointmentDate).toBe(data.appointments.find((a) => a.caseId === c.id)!.date);
  });
  it('ne réimporte pas les interventions existantes lors des versions successives F05', () => {
    const c = data.cases[23];
    const form = getForm('F05')!;
    const before = data.events.filter((e) => e.caseId === c.id && e.type === 'observation').length;
    const values = prefillForm(form, data, c, 'ar');
    saveSubmission(data, social, c.id, form, values, 'validated', 'ar');
    expect(data.events.filter((e) => e.caseId === c.id && e.type === 'observation')).toHaveLength(
      before,
    );
    const next = prefillForm(form, data, c, 'ar');
    (next.interventions as Record<string, string>[]).push({
      date: data.demoDate,
      intervention: 'Intervention fictive nouvelle',
      notes: 'Observation',
    });
    const id = saveSubmission(data, social, c.id, form, next, 'validated', 'ar');
    expect(data.events.filter((e) => e.caseId === c.id && e.type === 'observation')).toHaveLength(
      before + 1,
    );
    saveSubmission(
      data,
      social,
      c.id,
      form,
      data.submissions.find((s) => s.id === id)!.values,
      'validated',
      'ar',
    );
    expect(data.events.filter((e) => e.caseId === c.id && e.type === 'observation')).toHaveLength(
      before + 1,
    );
  });
});
describe('Workflow humain et continuité', () => {
  it('exige un motif et conserve l’historique après une prolongation', () => {
    const c = data.cases[23];
    decide(data, social, c.id, 'advance', 'Commission préparée');
    expect(c.stage).toBe(4);
    const prior = structuredClone(data.submissions);
    const events = data.events.length;
    expect(() => decide(data, admin, c.id, 'extend', '')).toThrow('REASON');
    decide(data, admin, c.id, 'extend', 'Nouveau cycle décidé par la commission fictive');
    expect(c.stage).toBe(3);
    expect(c.cycle).toBe(2);
    expect(c.supervised).toBe(false);
    expect(data.submissions).toEqual(prior);
    expect(data.events.length).toBe(events + 1);
  });
  it('ne transforme pas une orientation en clôture et exige un résultat ou N/A motivé', () => {
    const c = data.cases.find((c) => c.stage === 5 && c.status === 'active')!;
    expect(c.status).toBe('active');
    expect(() => decide(data, admin, c.id, 'close', 'Clôture sans résultat')).toThrow(
      'INTEGRATION_REQUIRED',
    );
    decide(
      data,
      admin,
      c.id,
      'close',
      '[N/A] Orientation non applicable, justification professionnelle de démonstration',
    );
    expect(c.status).toBe('closed');
  });
  it('refuse les mutations sur un dossier hors périmètre', () => {
    const c = data.cases.find((c) => c.centerId === 'gabes')!;
    expect(() => decide(data, social, c.id, 'advance', 'Démo')).toThrow('ACCESS');
  });
});
describe('Recommandations explicables et séances', () => {
  it('est déterministe et utilise uniquement les objectifs confirmés', () => {
    const c = data.cases[23];
    expect(recommend(data, c, constraints)).toEqual(recommend(data, c, constraints));
    c.goals.forEach((g) => {
      g.confirmed = false;
    });
    expect(recommend(data, c, constraints)).toHaveLength(0);
  });
  it('filtre durée, âge, matériel et format avant classement', () => {
    const c = data.cases[23];
    const recs = recommend(data, c, {
      ...constraints,
      maxDuration: 25,
      materials: ['none'],
    });
    for (const rec of recs) {
      const a = data.activities.find((a) => a.id === rec.activityId)!;
      expect(a.duration).toBeLessThanOrEqual(25);
      expect(a.format).toBe('individual');
      expect(a.materials.every((m) => m === 'none')).toBe(true);
    }
    expect(recommend(data, c, { ...constraints, maxDuration: 1 })).toHaveLength(0);
  });
  it('ignore les classifications sensibles et ne calcule aucun score de l’enfant', () => {
    const c = data.cases[23];
    const before = recommend(data, c, constraints);
    data.submissions
      .filter((s) => s.caseId === c.id)
      .forEach((s) => {
        s.values.classification = '1';
        s.values.facts = ['0'];
        s.values.difficulties = 'Donnée différente';
      });
    expect(recommend(data, c, constraints)).toEqual(before);
    expect(
      before.every(
        (r) =>
          r.reasons.length >= 2 &&
          r.goalIds.every((id) => c.goals.some((g) => g.id === id && g.confirmed)),
      ),
    ).toBe(true);
  });
  it('programme une seule fois et alimente dossier, projet et registre après réalisation', () => {
    const c = data.cases[23];
    const rec = recommend(data, c, constraints)[0];
    const count = data.sessions.length;
    const sessionId = scheduleRecommendation(
      data,
      educator,
      rec,
      data.demoDate,
      '10:00',
      [],
      'Adaptation professionnelle',
    );
    expect(
      scheduleRecommendation(
        data,
        educator,
        rec,
        data.demoDate,
        '10:00',
        [],
        'Validation professionnelle fictive',
      ),
    ).toBe(sessionId);
    expect(data.sessions).toHaveLength(count + 1);
    const s = data.sessions.find((s) => s.id === sessionId)!;
    completeSession(
      data,
      educator,
      sessionId,
      s.participants.map((p) => ({
        ...p,
        observations: 'Participation observée',
        progress: 'Exprime une idée',
      })),
      '',
    );
    expect(s.status).toBe('completed');
    expect(
      data.events.some(
        (e) =>
          e.caseId === c.id &&
          e.sourceId === sessionId &&
          e.note.includes('Participation observée'),
      ),
    ).toBe(true);
    expect(JSON.stringify(prefillForm(getForm('F05')!, data, c, 'ar'))).toContain(
      'Participation observée',
    );
    expect(JSON.stringify(prefillForm(getForm('F06')!, data, c, 'ar'))).toContain(
      'Participation observée',
    );
    expect(JSON.stringify(prefillForm(getForm('F13')!, data, c, 'ar'))).toContain(
      data.activities.find((a) => a.id === rec.activityId)!.title.ar,
    );
  });
  it('exige une supervision, le bon effectif et une observation de présence', () => {
    const c = data.cases[23];
    const rec = recommend(data, c, constraints)[0];
    c.supervised = false;
    expect(() =>
      scheduleRecommendation(
        data,
        educator,
        rec,
        data.demoDate,
        '10:00',
        [],
        'Validation professionnelle fictive',
      ),
    ).toThrow('SUPERVISION');
    c.supervised = true;
    const sessionId = scheduleRecommendation(
      data,
      educator,
      rec,
      data.demoDate,
      '10:00',
      [],
      'Validation professionnelle fictive',
    );
    const s = data.sessions.find((s) => s.id === sessionId)!;
    expect(() => completeSession(data, educator, sessionId, s.participants, '')).toThrow(
      'OBSERVATION',
    );
    const group = recommend(data, c, {
      ...constraints,
      format: 'group',
      participants: 3,
    })[0];
    expect(() =>
      scheduleRecommendation(
        data,
        educator,
        group,
        data.demoDate,
        '10:00',
        [],
        'Validation professionnelle fictive',
      ),
    ).toThrow('PARTICIPANTS');
  });
});
describe('Recherche et persistance', () => {
  it('normalise accents, diacritiques et variantes arabes', () => {
    expect(normalize('ÉVALUATION')).toBe('evaluation');
    expect(normalize('إِدْمَاج')).toBe(normalize('ادماج'));
  });
  it('reconnaît les intentions françaises et arabes sans sortir du périmètre', () => {
    for (const query of [
      'اعرض الملفات التي تحتاج إلى تقييم أولي',
      'dossiers nécessitant une évaluation initiale',
      'التقييمات المبرمجة هذا الشهر',
    ]) {
      const result = searchProvider.search(query, data, social);
      expect(result.intent).not.toBeNull();
      expect(
        result.results.every((r) => authorizedCases(data, social).some((c) => c.id === r.caseId)),
      ).toBe(true);
    }
    expect(
      searchProvider.search('CDIS-024', data, social).results.some((r) => r.caseId === 'CDIS-024'),
    ).toBe(true);
    expect(searchProvider.search('CDIS-035', data, social).results).toHaveLength(0);
    expect(searchProvider.search('zzzinconnu', data, social).results).toHaveLength(0);
  });
  it('refuse un stockage corrompu au lieu de le présenter comme un dossier valide', () => {
    expect(() => dataSchema.parse({ schemaVersion: 99 })).toThrow();
  });
  it('conserve la dernière mutation après plusieurs écritures ordonnées et réouverture', async () => {
    const repo = new IndexedDbRepository();
    const first = structuredClone(data);
    first.children[0].address = 'v1';
    const second = structuredClone(first);
    second.children[0].address = 'v2';
    await Promise.all([repo.save(first), repo.save(second)]);
    await repo.flush();
    const reloaded = await new IndexedDbRepository().load();
    expect(reloaded!.children[0].address).toBe('v2');
    expect(reloaded!.cases).toHaveLength(40);
  });
});
