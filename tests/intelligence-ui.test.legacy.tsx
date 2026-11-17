import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import i18n from '../src/i18n';
import { createSeed } from '../src/data/seed';
import { createDemoSession } from '../src/services/auth';
import { useAppStore } from '../src/stores/app';
import { Shell } from '../src/components/layout/Shell';
import { ToastProvider } from '../src/components/ui';
import { IntelligentSearch } from '../src/features/intelligent-browser/Search';
import { Recommendations } from '../src/features/recommendations/Recommendations';
import { searchProvider } from '../src/services/search';
import { repository } from '../src/db/repository';
import { defaultRecommendationContexts } from '../src/config/recommendationContexts';

beforeEach(async () => {
  sessionStorage.clear();
  const data = createSeed();
  useAppStore.setState({
    data,
    session: createDemoSession('p3', data),
    ready: true,
    revision: 0,
    storage: 'saved',
    error: null,
  });
  await act(async () => {
    await i18n.changeLanguage('fr');
  });
});
afterEach(async () => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
  await repository.flush();
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
const advance = (ms: number) =>
  act(() => {
    vi.advanceTimersByTime(ms);
  });

describe('Recherche instantanée et accès depuis la Topbar', () => {
  it('attend 300 ms après la dernière frappe, regroupe, surligne et ouvre la source', () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const search = vi.spyOn(searchProvider, 'search');
    const view = workspace();
    const input = screen.getByRole('searchbox', { name: 'Recherche globale MASAR' });
    fireEvent.change(input, { target: { value: 'CDIS-02' } });
    advance(200);
    fireEvent.change(input, { target: { value: 'CDIS-024' } });
    advance(299);
    expect(view.container.querySelectorAll('.search-result')).toHaveLength(0);
    expect(search).not.toHaveBeenCalled();
    advance(1);
    expect(search).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('region', { name: 'Dossiers des enfants' })).toBeTruthy();
    expect(view.container.querySelectorAll('mark').length).toBeGreaterThan(0);
    const first = view.container.querySelector<HTMLAnchorElement>('.search-result')!;
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    expect(document.activeElement).toBe(first);
    fireEvent.click(first);
    expect(screen.getByRole('heading', { name: 'Dossier source' })).toBeTruthy();
    expect(view.container.querySelector('.instant-search-popover')).toBeNull();
  });
  it('partage le moteur avec Intelligent Browser et retire immédiatement les anciens résultats', () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const search = vi.spyOn(searchProvider, 'search');
    const view = workspace('/search?q=RES-EDU');
    advance(300);
    const pageResponse = search.mock.results.at(-1)!.value;
    const global = screen.getByRole('searchbox', { name: 'Recherche globale MASAR' });
    fireEvent.change(global, { target: { value: 'RES-EDU' } });
    advance(300);
    expect(search.mock.results.at(-1)!.value).toEqual(pageResponse);
    fireEvent.change(global, { target: { value: 'CDIS-035' } });
    expect(view.container.querySelector('.instant-result-groups')).toBeNull();
    advance(300);
    const suggestions = screen.getByLabelText('Suggestions de recherche');
    expect(suggestions.textContent).toContain('0 résultats autorisés');
    expect(suggestions.querySelectorAll('.search-result')).toHaveLength(0);
    fireEvent.keyDown(global, { key: 'Escape' });
    expect(view.container.querySelector('.instant-search-popover')).toBeNull();
  });
  it('efface le texte, les suggestions et les résultats lors du changement de profil', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const view = workspace('/search?q=CDIS-024');
    const global = screen.getByRole('searchbox', { name: 'Recherche globale MASAR' });
    fireEvent.change(global, { target: { value: 'CDIS-024' } });
    advance(300);
    expect(view.container.querySelectorAll('.search-result').length).toBeGreaterThan(0);
    await act(async () => {
      fireEvent.change(
        screen.getByRole('combobox', { name: 'Sélection du profil de démonstration' }),
        { target: { value: 'p5' } },
      );
    });
    expect(
      (screen.getByRole('searchbox', { name: 'Recherche globale MASAR' }) as HTMLInputElement)
        .value,
    ).toBe('');
    expect(view.container.querySelectorAll('.search-result')).toHaveLength(0);
    advance(300);
    expect(view.container.querySelectorAll('.search-result')).toHaveLength(0);
  });
  it('recherche en arabe RTL et en français LTR avec le même champ persistant', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const view = workspace();
    await act(async () => {
      await i18n.changeLanguage('ar');
    });
    expect(document.documentElement.dir).toBe('rtl');
    const input = screen.getByRole('searchbox', { name: 'البحث الشامل في مسار' });
    fireEvent.change(input, { target: { value: 'إِدْمَاج' } });
    advance(300);
    expect(view.container.querySelectorAll('.search-result').length).toBeGreaterThan(0);
    await act(async () => {
      await i18n.changeLanguage('fr');
    });
    expect(document.documentElement.dir).toBe('ltr');
    expect(
      (screen.getByRole('searchbox', { name: 'Recherche globale MASAR' }) as HTMLInputElement)
        .value,
    ).toBe('إِدْمَاج');
    fireEvent.change(input, { target: { value: 'évaluation' } });
    advance(300);
    expect(
      [...view.container.querySelectorAll('mark')].some((mark) =>
        mark.textContent?.toLowerCase().includes('évaluation'),
      ),
    ).toBe(true);
  });
});

describe('Contexte dynamique et revue professionnelle', () => {
  it('adapte aussi les cibles d’un contexte ajouté uniquement au registre configurable', () => {
    defaultRecommendationContexts.push({
      ...defaultRecommendationContexts[0],
      contextId: 'configured-workshop',
      labelFr: 'Contexte configurable',
    });
    try {
      const view = workspace('/recommendations?context=configured-workshop');
      fireEvent.change(screen.getByRole('combobox', { name: 'Cible de l’activité' }), {
        target: { value: 'group' },
      });
      fireEvent.change(screen.getByRole('combobox', { name: /^Groupe/ }), {
        target: { value: 'مجموعة الأفق' },
      });
      fireEvent.click(screen.getByRole('button', { name: 'Générer les recommandations' }));
      expect(view.container.querySelectorAll('.recommendation-card').length).toBeGreaterThan(0);
    } finally {
      defaultRecommendationContexts.pop();
    }
  });
  it('change les champs selon le domaine et préserve la narration au changement de langue', async () => {
    const view = workspace('/recommendations?context=workshops&case=CDIS-024&activity=ACT-001');
    expect(screen.getByRole('combobox', { name: 'Cible de l’activité' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Générer les recommandations' }));
    expect(view.container.querySelectorAll('.recommendation-card')).toHaveLength(1);
    fireEvent.click(
      screen.getByRole('button', { name: 'Projet éducatif individualisé', exact: true }),
    );
    expect(view.container.querySelectorAll('.recommendation-card')).toHaveLength(0);
    expect(screen.queryByRole('combobox', { name: 'Cible de l’activité' })).toBeNull();
    expect(screen.getByRole('combobox', { name: 'Projet existant' })).toBeTruthy();
    fireEvent.change(screen.getByRole('textbox', { name: 'Demande complémentaire (facultatif)' }), {
      target: { value: 'نص مهني أصلي' },
    });
    await act(async () => {
      await i18n.changeLanguage('ar');
    });
    expect(
      (screen.getByRole('textbox', { name: 'طلب مكمل (اختياري)' }) as HTMLTextAreaElement).value,
    ).toBe('نص مهني أصلي');
    expect(document.documentElement.dir).toBe('rtl');
  });
  it('désélectionne un contexte révoqué, ferme les dialogues et efface toutes les propositions', async () => {
    const view = workspace('/recommendations?context=workshops&case=CDIS-024&activity=ACT-001');
    fireEvent.click(screen.getByRole('button', { name: 'Générer les recommandations' }));
    fireEvent.click(screen.getByRole('button', { name: 'Accepter et programmer', exact: true }));
    expect(screen.getByRole('dialog')).toBeTruthy();
    await act(async () => {
      await useAppStore.getState().signIn('p6');
    });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(view.container.querySelectorAll('.recommendation-card')).toHaveLength(0);
    expect(view.container.querySelectorAll('.context-choice[aria-pressed=true]')).toHaveLength(0);
    expect(screen.queryByRole('button', { name: 'Ateliers et activités', exact: true })).toBeNull();
    expect(
      screen.getByText(
        'Le contexte précédent n’est pas accessible à ce profil. Les résultats précédents ont été effacés.',
      ),
    ).toBeTruthy();
  });
  it('enregistre une ressource adaptée dans le dossier uniquement après une revue motivée', () => {
    workspace('/recommendations?context=educational-resources&case=CDIS-024');
    fireEvent.click(screen.getByRole('button', { name: 'Générer les recommandations' }));
    expect(useAppStore.getState().data.recommendations).toHaveLength(0);
    fireEvent.click(screen.getByRole('button', { name: 'Adapter', exact: true }));
    const dialog = screen.getByRole('dialog');
    fireEvent.change(within(dialog).getByRole('textbox', { name: /Adaptation et motif/ }), {
      target: { value: 'Support visuel fictif à examiner en séance.' },
    });
    fireEvent.submit(dialog.querySelector('form')!);
    const rec = useAppStore.getState().data.recommendations[0];
    expect(rec).toMatchObject({
      contextId: 'educational-resources',
      status: 'accepted',
      humanDecision: 'adapted',
      reviewedBy: 'p3',
    });
    expect(useAppStore.getState().data.events.at(-1)).toMatchObject({
      caseId: 'CDIS-024',
      sourceId: rec.id,
    });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByText('Ajoutée au dossier après votre revue')).toBeTruthy();
  });
  it('ferme un détail d’activité ouvert si la ressource devient interdite', () => {
    workspace('/recommendations?context=workshops&case=CDIS-024&activity=ACT-001');
    fireEvent.click(screen.getByRole('button', { name: 'Générer les recommandations' }));
    fireEvent.click(screen.getByRole('button', { name: 'Voir le détail', exact: true }));
    expect(screen.getByRole('dialog')).toBeTruthy();
    act(() => {
      const state = useAppStore.getState();
      const data = structuredClone(state.data);
      data.activities.find((a) => a.id === 'ACT-001')!.access = { allowedRoles: ['psychologist'] };
      useAppStore.setState({ data, revision: state.revision + 1 });
    });
    expect(screen.queryByRole('dialog')).toBeNull();
  });
  it('retire une revue ouverte quand l’autorisation de la ressource est révoquée', () => {
    workspace('/recommendations?context=educational-resources&case=CDIS-024');
    fireEvent.click(screen.getByRole('button', { name: 'Générer les recommandations' }));
    fireEvent.click(screen.getByRole('button', { name: 'Adapter', exact: true }));
    expect(screen.getByRole('dialog')).toBeTruthy();
    act(() => {
      const state = useAppStore.getState();
      const data = structuredClone(state.data);
      data.resources.find((r) => r.id === 'RES-EDU')!.access = { allowedRoles: ['social'] };
      useAppStore.setState({ data, revision: state.revision + 1 });
    });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(useAppStore.getState().data.recommendations).toHaveLength(0);
  });
});
