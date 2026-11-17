import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { readFileSync } from 'node:fs';
import i18n from '../src/i18n';
import { api } from '../src/services/api';
import { useAppStore } from '../src/stores/app';
import { ToastProvider } from '../src/components/ui';
import { GovernorateWelcomePage } from '../src/features/authentication/GovernorateWelcomePage';
import { Login } from '../src/features/authentication/Login';
import { RequireSession } from '../src/features/authentication/AuthGuards';
import {
  governorates,
  normalizeEntrySearch,
  readWorkplace,
  returnPath,
  safeReturnPath,
  saveReturnPath,
  saveWorkplace,
} from '../src/features/authentication/entryContext';

vi.mock('../src/services/api', () => ({
  api: vi.fn(),
  ApiError: class extends Error {
    status = 500;
  },
}));
const request = vi.mocked(api);
const geography = JSON.parse(readFileSync('public/geography/tunisia-governorates.geojson', 'utf8'));
const centre = {
  id: 'siliana',
  name: { ar: 'مركز تجريبي بسليانة', fr: 'CDIS de Siliana' },
  region: { ar: 'سليانة', fr: 'Siliana' },
  governorateId: 'TN-34',
  isDemo: true,
};
const profiles = [
  {
    id: 'p1',
    name: { ar: 'مهنية تجريبية', fr: 'Professionnelle fictive' },
    role: 'social',
    specialty: { ar: 'اجتماعي', fr: 'Social' },
    centerId: 'siliana',
  },
  {
    id: 'p3',
    name: { ar: 'مرب تجريبي', fr: 'Éducateur fictif' },
    role: 'educator',
    specialty: { ar: 'تربية', fr: 'Éducation' },
    centerId: 'siliana',
  },
];
let original: ReturnType<typeof useAppStore.getState>;
beforeEach(async () => {
  original = useAppStore.getState();
  sessionStorage.clear();
  await i18n.changeLanguage('fr');
  useAppStore.setState({ session: null, identityMode: 'demo', error: null });
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => geography }));
  request.mockImplementation(async (path) =>
    path === '/entry/governorates'
      ? governorates
      : path.includes('/centres')
        ? path.includes('TN-34')
          ? [centre]
          : []
        : profiles,
  );
});
afterEach(() => {
  cleanup();
  useAppStore.setState(original);
  vi.resetAllMocks();
  vi.unstubAllGlobals();
});
function entry() {
  return render(
    <ToastProvider>
      <MemoryRouter>
        <Routes>
          <Route path="/" element={<GovernorateWelcomePage />} />
          <Route path="/login" element={<Login />} />
        </Routes>
      </MemoryRouter>
    </ToastProvider>,
  );
}
function list() {
  return within(screen.getByRole('list', { name: 'Les 24 gouvernorats' }));
}

describe('Entrée géographique et identité professionnelle', () => {
  it('conserve 24 frontières locales, sélection synchronisée, clavier et géométrie inchangée en RTL', async () => {
    entry();
    const region = await screen.findByRole('button', { name: 'Siliana', pressed: false });
    // Map and list are separate keyboard-operable controls with the same selection.
    expect(document.querySelectorAll('.governorate-territories [role="button"]').length).toBe(24);
    const path = document.querySelector<SVGPathElement>('[data-governorate="TN-34"]')!;
    const d = path.getAttribute('d');
    fireEvent.keyDown(path, { key: 'Enter' });
    await waitFor(() =>
      expect(list().getByRole('button', { name: 'Siliana' }).getAttribute('aria-pressed')).toBe(
        'true',
      ),
    );
    expect(region).toBeTruthy();
    await act(async () => {
      await i18n.changeLanguage('ar');
    });
    expect(document.documentElement.dir).toBe('rtl');
    expect(path.getAttribute('d')).toBe(d);
    expect(document.querySelector('.governorate-map')?.getAttribute('dir')).toBe('ltr');
    expect(path.getAttribute('aria-pressed')).toBe('true');
    expect(readWorkplace()?.governorateId).toBe('TN-34');
  });
  it('recherche sans accents et affiche un état vide sans inventer de centre', async () => {
    entry();
    fireEvent.change(screen.getByRole('searchbox', { name: 'Rechercher un gouvernorat' }), {
      target: { value: 'Kebili' },
    });
    await waitFor(() => expect(list().getAllByRole('button').length).toBe(1));
    fireEvent.click(list().getByRole('button', { name: 'Kébili' }));
    await screen.findByText(/Aucun centre de démonstration configuré/);
    expect(
      (screen.getByRole('button', { name: 'Continuer vers la connexion' }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    expect(normalizeEntrySearch('أريانة')).toBe(normalizeEntrySearch('اريانة'));
  });
  it('transmet seulement le profil et le lieu vérifiés au login existant à cinq étapes', async () => {
    const signIn = vi.fn().mockResolvedValue(undefined);
    useAppStore.setState({ signIn });
    entry();
    fireEvent.click(list().getByRole('button', { name: 'Siliana' }));
    const next = screen.getByRole('button', {
      name: 'Continuer vers la connexion',
    }) as HTMLButtonElement;
    await waitFor(() => expect(next.disabled).toBe(false));
    fireEvent.click(next);
    await screen.findByText('Gouvernorat sélectionné');
    expect(document.querySelectorAll('.login-art .art-stage').length).toBe(5);
    expect(screen.getByRole('link', { name: 'Changer de gouvernorat' })).toBeTruthy();
    expect(screen.queryByRole('searchbox')).toBeNull();
    await waitFor(() => expect(screen.getAllByRole('option').length).toBe(2));
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'p3' } });
    fireEvent.click(screen.getByRole('button', { name: 'S’identifier avec e-Houwiya' }));
    await waitFor(() =>
      expect(signIn).toHaveBeenCalledWith('p3', { governorateId: 'TN-34', centreId: 'siliana' }),
    );
  });
  it('n’accepte aucune destination externe et borne la durée du contexte temporaire', () => {
    for (const value of [
      'https://evil.example',
      '//evil.example',
      '/\\evil',
      '/login',
      '/cases/../login',
      '/%2f%2fevil',
      '/child-journey/CDIS-024#secret',
      '/dashboard\nLocation: evil',
    ])
      expect(safeReturnPath(value)).toBeNull();
    expect(safeReturnPath('/child-journey/CDIS-024?stage=3')).toBe(
      '/child-journey/CDIS-024?stage=3',
    );
    expect(safeReturnPath('/search?q=private')).toBe('/search');
    expect(safeReturnPath('/network?tab=messages')).toBe('/network?tab=messages');
    expect(safeReturnPath('/cases/CDIS-024?tab=identity')).toBe('/cases/CDIS-024?tab=identity');
    expect(safeReturnPath('/cases/CDIS-024?tab=identity&secret=private')).toBe('/cases/CDIS-024');
    saveReturnPath('/child-journey/CDIS-024?stage=3');
    saveReturnPath('//evil.example');
    expect(returnPath()).toBe('/child-journey/CDIS-024?stage=3');
    saveWorkplace({ governorateId: 'TN-34', centreId: 'siliana' });
    expect(readWorkplace()?.centreId).toBe('siliana');
    vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 31 * 60 * 1000);
    expect(readWorkplace()).toBeNull();
    expect(returnPath()).toBe('/assigned-children');
    vi.restoreAllMocks();
  });
  it('un registre indisponible garde la continuation bloquée et propose de réessayer', async () => {
    const retry = vi.fn().mockResolvedValue(undefined);
    useAppStore.setState({ identityMode: 'unavailable', retry });
    request.mockRejectedValue(new Error('unavailable'));
    entry();
    fireEvent.click(list().getByRole('button', { name: 'Siliana' }));
    await screen.findByRole('alert');
    expect(
      (screen.getByRole('button', { name: 'Continuer vers la connexion' }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    expect(screen.getByRole('button', { name: 'Réessayer' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Réessayer' }));
    expect(retry).toHaveBeenCalledOnce();
  });
  it('garde la route pendant une identification en cours sans monter le contenu privé', async () => {
    useAppStore.setState({ session: null, authenticating: true });
    render(
      <MemoryRouter initialEntries={['/network?tab=messages']}>
        <Routes>
          <Route path="/" element={<p>Accueil public</p>} />
          <Route element={<RequireSession />}>
            <Route path="/network" element={<p>Contenu privé</p>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByRole('status').textContent).toBe(
      'Vérification de l’identité professionnelle…',
    );
    expect(screen.queryByText('Contenu privé')).toBeNull();
    expect(screen.queryByText('Accueil public')).toBeNull();
    await act(async () => {
      useAppStore.setState({ authenticating: false });
    });
    expect(await screen.findByText('Accueil public')).toBeTruthy();
    expect(screen.queryByText('Contenu privé')).toBeNull();
  });
});
