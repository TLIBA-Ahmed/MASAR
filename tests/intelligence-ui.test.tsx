import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import i18n from '../src/i18n';
import { createSeed } from '../src/data/seed';
import { createDemoSession } from '../src/services/auth';
import { useAppStore } from '../src/stores/app';
import { Shell } from '../src/components/layout/Shell';
import { ToastProvider } from '../src/components/ui';
import { Recommendations } from '../src/features/recommendations/Recommendations';
import { IntelligentSearch } from '../src/features/intelligent-browser/Search';
import { api } from '../src/services/api';
import { defaultRecommendationContexts } from '../src/config/recommendationContexts';
import type { Recommendation } from '../src/types';
vi.mock('../src/services/api', () => ({
  api: vi.fn(),
  ApiError: class extends Error {
    status = 500;
  },
}));
const request = vi.mocked(api);
function fixture() {
  const data = createSeed();
  data.cases = data.cases.filter((c) => c.id === 'CDIS-024');
  data.children = data.children.filter((c) => c.id === data.cases[0].childId);
  data.submissions = [];
  data.events = [];
  data.sessions = [];
  data.recommendations = [];
  data.tasks = [];
  data.appointments = [];
  const categories = Object.fromEntries(
    ['general', 'educational', 'roadmap'].map((k) => [k, { read: true, write: true }]),
  );
  data.backend = {
    authority: 'server',
    fingerprint: 'scope-1',
    access: { 'CDIS-024': { categories, forms: { F02: true, F13: true } } },
    templates: {
      'CDIS-024': defaultRecommendationContexts.filter((c) => c.allowedRoles.includes('educator')),
    },
    documentMetadata: [],
  };
  return data;
}
const proposal: Recommendation = {
  id: 'REC-resource-1',
  caseId: 'CDIS-024',
  activityId: '',
  resourceId: 'RES-EDU',
  kind: 'resource',
  title: { ar: 'مورد تعليمي تجريبي', fr: 'Ressource pédagogique fictive' },
  summary: { ar: 'مورد مرتبط بالأهداف', fr: 'Support lié aux objectifs' },
  goalIds: [],
  score: 80,
  reasons: [{ ar: 'أهداف مؤكدة', fr: 'Objectifs confirmés' }],
  status: 'suggested',
  date: '2026-11-16',
  contextId: 'educational-resources',
  sources: [],
};
beforeEach(async () => {
  const data = fixture();
  const session = {
    ...createDemoSession('p3', data),
    authority: 'server' as const,
    sessionId: 'session-1',
  };
  useAppStore.setState({
    data,
    session,
    ready: true,
    revision: 0,
    storage: 'saved',
    error: null,
    refresh: vi.fn().mockResolvedValue(undefined),
  });
  request.mockReset();
  request.mockImplementation(async (path, body) => {
    if (path === '/search') {
      const q = (body as { q: string }).q;
      return {
        intent: null,
        results:
          q === 'CDIS-035'
            ? []
            : [
                {
                  id: 'CDIS-024',
                  type: 'case',
                  title: { ar: 'آدم — تعاون', fr: 'Adam — coopération' },
                  excerpt: { ar: 'أنشطة تعليمية', fr: 'Évaluation éducative' },
                  path: '/cases/CDIS-024',
                },
              ],
      } as never;
    }
    if (path === '/me/assigned-groups') return { groups: [] } as never;
    if (path === '/recommendations/generate')
      return {
        status: 'completed',
        recommendations: [structuredClone(proposal)],
        limitations: ['DETERMINISTIC_DEMO_NO_MODEL_INFERENCE'],
      } as never;
    if (path.includes('/feedback'))
      return { status: 'ACCEPTED', official_plan_changed: false } as never;
    return {} as never;
  });
  await act(async () => {
    await i18n.changeLanguage('fr');
  });
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});
function workspace(path = '/dashboard') {
  return render(
    <ToastProvider>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route element={<Shell />}>
            <Route path="dashboard" element={<h1>Accueil</h1>} />
            <Route path="search" element={<IntelligentSearch />} />
            <Route path="recommendations" element={<Recommendations />} />
            <Route path="cases/:id" element={<h1>Dossier source</h1>} />
          </Route>
        </Routes>
      </MemoryRouter>
    </ToastProvider>,
  );
}
const advance = async (ms: number) => {
  await act(async () => {
    vi.advanceTimersByTime(ms);
    await Promise.resolve();
  });
};
describe('Recherche instantanée autorisée par API', () => {
  it('attend 300 ms, annule la requête précédente, surligne et ouvre une ressource', async () => {
    vi.useFakeTimers();
    const view = workspace();
    const input = screen.getByRole('searchbox', { name: 'Recherche globale MASAR' });
    fireEvent.change(input, { target: { value: 'Adam' } });
    await advance(299);
    expect(request).not.toHaveBeenCalled();
    await advance(1);
    expect(request).toHaveBeenCalledTimes(1);
    const signal = request.mock.calls[0][2]?.signal as AbortSignal;
    expect(view.container.querySelectorAll('mark').length).toBeGreaterThan(0);
    fireEvent.change(input, { target: { value: 'coopération' } });
    expect(signal.aborted).toBe(true);
    expect(view.container.querySelectorAll('.search-result')).toHaveLength(0);
    await advance(300);
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    expect(document.activeElement?.classList.contains('search-result')).toBe(true);
    fireEvent.click(view.container.querySelector('.search-result')!);
    expect(screen.getByRole('heading', { name: 'Dossier source' })).toBeTruthy();
  });
  it('Topbar et Browser utilisent la même route et ne lancent aucun SLM pendant la frappe', async () => {
    vi.useFakeTimers();
    workspace('/search?q=CDIS-024');
    await advance(300);
    const route = request.mock.calls.find((c) => c[0] === '/search')![0];
    fireEvent.change(screen.getByRole('searchbox', { name: 'Recherche globale MASAR' }), {
      target: { value: 'Adam' },
    });
    await advance(300);
    expect(request.mock.calls.filter((c) => c[0] === route)).toHaveLength(2);
    expect(request.mock.calls.some((c) => c[0] === '/browser/ask')).toBe(false);
  });
  it('efface immédiatement les résultats au changement du périmètre serveur', async () => {
    vi.useFakeTimers();
    const view = workspace();
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'Adam' } });
    await advance(300);
    expect(view.container.querySelector('.search-result')).toBeTruthy();
    act(() => {
      const data = structuredClone(useAppStore.getState().data);
      data.backend!.fingerprint = 'scope-revoked';
      data.cases = [];
      useAppStore.setState({ data, revision: 1 });
    });
    expect(view.container.querySelector('.search-result')).toBeNull();
    expect((screen.getByRole('searchbox') as HTMLInputElement).value).toBe('');
  });
  it('fonctionne en arabe RTL et français LTR sans modifier le texte saisi', async () => {
    vi.useFakeTimers();
    workspace();
    await act(async () => {
      await i18n.changeLanguage('ar');
    });
    expect(document.documentElement.dir).toBe('rtl');
    expect(i18n.t('assignedChildren')).toBe('الأطفال المتعهد بهم');
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'تعاون' } });
    await advance(300);
    expect(screen.getByText('تعاون', { selector: 'mark' })).toBeTruthy();
    await act(async () => {
      await i18n.changeLanguage('fr');
    });
    expect(document.documentElement.dir).toBe('ltr');
    expect((screen.getByRole('searchbox') as HTMLInputElement).value).toBe('تعاون');
  });
});
describe('Moteur central et validation humaine', () => {
  it('ignore une génération devenue obsolète et permet une nouvelle demande', async () => {
    const view = workspace('/recommendations?context=educational-resources&case=CDIS-024');
    let resolve!: (value: unknown) => void;
    request.mockImplementationOnce(
      () =>
        new Promise((done) => {
          resolve = done;
        }) as never,
    );
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: 'Générer les recommandations' }));
    });
    expect(screen.getByRole('status').textContent).toContain('Préparation des propositions…');
    fireEvent.click(screen.getAllByRole('checkbox')[0]);
    await act(async () => {
      resolve({ status: 'completed', recommendations: [proposal], limitations: [] });
    });
    expect(view.container.querySelector('.proposal-card')).toBeNull();
    expect(
      (screen.getByRole('button', { name: 'Générer les recommandations' }) as HTMLButtonElement)
        .disabled,
    ).toBe(false);
  });
  it('adapte les champs et efface les propositions lors du changement de contexte', async () => {
    const view = workspace('/recommendations?context=educational-resources&case=CDIS-024');
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Générer les recommandations' }));
    });
    expect(view.container.querySelector('.proposal-card')).toBeTruthy();
    fireEvent.click(
      screen.getByRole('button', { name: 'Projet éducatif individualisé', exact: true }),
    );
    expect(view.container.querySelector('.proposal-card')).toBeNull();
    expect(screen.getByLabelText('Projet existant, facultatif')).toBeTruthy();
  });
  it('la révocation désélectionne le contexte et ferme la revue', async () => {
    const view = workspace('/recommendations?context=educational-resources&case=CDIS-024');
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Générer les recommandations' }));
    });
    fireEvent.click(screen.getByRole('button', { name: 'Accepter', exact: true }));
    expect(screen.getByRole('dialog')).toBeTruthy();
    act(() => {
      const data = structuredClone(useAppStore.getState().data);
      data.backend!.templates['CDIS-024'] = [];
      data.backend!.fingerprint = 'revoked';
      useAppStore.setState({ data, revision: 1 });
    });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(view.container.querySelector('.proposal-card')).toBeNull();
    expect(view.container.querySelector('[aria-pressed=true]')).toBeNull();
  });
  it('accepter appelle uniquement le feedback, sans modifier ni planifier le dossier', async () => {
    workspace('/recommendations?context=educational-resources&case=CDIS-024');
    const before = JSON.stringify(useAppStore.getState().data.cases);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Générer les recommandations' }));
    });
    fireEvent.click(screen.getByRole('button', { name: 'Accepter', exact: true }));
    fireEvent.change(within(screen.getByRole('dialog')).getByRole('textbox'), {
      target: { value: 'Avis professionnel fictif et motivé.' },
    });
    await act(async () => {
      fireEvent.submit(screen.getByRole('dialog').querySelector('form')!);
    });
    expect(request).toHaveBeenCalledWith('/recommendations/REC-resource-1/feedback', {
      status: 'ACCEPTED',
      reason: 'Avis professionnel fictif et motivé.',
    });
    expect(request.mock.calls.some((c) => c[0].includes('planned-interventions'))).toBe(false);
    expect(JSON.stringify(useAppStore.getState().data.cases)).toBe(before);
  });
  it('préserve la narration lorsque la langue change', async () => {
    workspace('/recommendations?context=educational-resources&case=CDIS-024');
    const input = screen.getByLabelText('Demande complémentaire, facultative');
    fireEvent.change(input, { target: { value: 'نص مهني أصلي' } });
    await act(async () => {
      await i18n.changeLanguage('ar');
    });
    expect((screen.getByLabelText('طلب إضافي، اختياري') as HTMLTextAreaElement).value).toBe(
      'نص مهني أصلي',
    );
  });
});
