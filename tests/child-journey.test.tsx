import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import i18n from '../src/i18n';
import { TunisiaMap3D } from '../src/features/child-journey/TunisiaMap3D';
import { stages } from '../src/config/workflow';
import { polygons, points, silhouettePath } from '../src/features/child-journey/mapGeometry';
import type { Stage } from '../src/types';
import type { JourneyCheckpointData } from '../src/features/child-journey/types';

vi.mock('../src/features/child-journey/TunisiaWebGL', async () => {
  const { useEffect } = await import('react');
  return {
    default: function Unavailable({ onFailure }: { onFailure: () => void }) {
      useEffect(onFailure, [onFailure]);
      return null;
    },
  };
});

const checkpoints: JourneyCheckpointData[] = stages.map((s) => ({
  id: s.id,
  title: s.title,
  short: s.short,
  description: s.description,
  status: s.id < 3 ? 'completed' : s.id === 3 ? 'current' : 'future',
  current: s.id === 3,
  future: s.id >= 4,
  startedAt: s.id === 1 ? '2026-05-20' : null,
  endedAt: null,
  completedSubsteps: s.id < 3 ? 2 : 0,
  totalSubsteps: 4,
  documentCount: 1,
  pendingCount: 0,
}));

beforeEach(async () => {
  await i18n.changeLanguage('fr');
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
    width: 900,
    height: 625,
    x: 0,
    y: 0,
    top: 0,
    left: 0,
    bottom: 625,
    right: 900,
    toJSON: () => ({}),
  });
  vi.stubGlobal(
    'ResizeObserver',
    class {
      constructor(private callback: () => void) {}
      observe() {
        this.callback();
      }
      disconnect() {}
      unobserve() {}
    },
  );
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('Carte du parcours de l’enfant', () => {
  it('bascule automatiquement sur une vraie carte 2D interactive si WebGL est indisponible', async () => {
    const select = vi.fn();
    const { container } = render(
      <TunisiaMap3D checkpoints={checkpoints} selected={3} onSelect={select} />,
    );
    await screen.findByText(/La carte interactive 2D est activée/);
    expect(container.querySelector('.tunisia-map-viewport')?.getAttribute('data-mode')).toBe('2d');
    expect(container.querySelector('.tunisia-svg path')?.getAttribute('d')).toBe(silhouettePath);
    fireEvent.click(
      await screen.findByRole('button', { name: 'Étape 4 — Évaluation du parcours' }),
    );
    expect(select).toHaveBeenCalledWith(4);
    expect(screen.getAllByRole('button', { name: /Étape [1-5] —/ })).toHaveLength(5);
  });

  it('conserve la sélection et la géométrie non inversée lors du passage en RTL', async () => {
    function Map() {
      const [selected, setSelected] = useState<Stage>(3);
      return <TunisiaMap3D checkpoints={checkpoints} selected={selected} onSelect={setSelected} />;
    }
    const { container } = render(<Map />);
    await screen.findByText(/La carte interactive 2D est activée/);
    fireEvent.click(
      screen.getByRole('button', { name: 'Étape 2 — Diagnostic et inscription au centre' }),
    );
    const path = container.querySelector('.tunisia-svg path')?.getAttribute('d');
    await act(async () => {
      await i18n.changeLanguage('ar');
    });
    expect(document.documentElement.dir).toBe('rtl');
    expect(container.querySelector('.tunisia-map-viewport')?.getAttribute('dir')).toBe('ltr');
    expect(container.querySelector('.tunisia-svg path')?.getAttribute('d')).toBe(path);
    expect(
      screen
        .getByRole('button', { name: 'المرحلة 2 — التشخيص والترسيم بالمركز' })
        .getAttribute('aria-pressed'),
    ).toBe('true');
  });

  it('rend dates inconnues, statuts et compteurs accessibles au clavier', async () => {
    render(<TunisiaMap3D checkpoints={checkpoints} selected={3} onSelect={() => undefined} />);
    await screen.findByText(/La carte interactive 2D est activée/);
    fireEvent.focus(
      screen.getByRole('button', { name: 'Étape 3 — Réhabilitation et accompagnement' }),
    );
    await waitFor(() => expect(screen.getByRole('tooltip').textContent).toContain('Non documenté'));
    expect(screen.getByRole('tooltip').textContent).toContain('0/4');
    expect(screen.getByRole('tooltip').textContent).toContain('Étape actuelle');
  });

  it('affiche un retour 4 vers 3 uniquement pour une prolongation documentée', async () => {
    const { rerender } = render(
      <TunisiaMap3D checkpoints={checkpoints} selected={3} onSelect={() => undefined} />,
    );
    await screen.findByText(/La carte interactive 2D est activée/);
    expect(screen.queryByTestId('rehabilitation-loop-2d')).toBeNull();
    rerender(
      <TunisiaMap3D
        checkpoints={checkpoints}
        selected={3}
        onSelect={() => undefined}
        hasExtension
      />,
    );
    expect(screen.getByTestId('rehabilitation-loop-2d')).toBeTruthy();
  });

  it('place les cinq points symboliques dans la géométrie tunisienne locale', () => {
    const inside = ([x, y]: readonly number[], ring: number[][]) => {
      let contained = false;
      for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        const [xi, yi] = ring[i],
          [xj, yj] = ring[j];
        if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi)
          contained = !contained;
      }
      return contained;
    };
    expect(
      Object.values(points).every((p) => polygons.some((polygon) => inside(p, polygon[0]))),
    ).toBe(true);
    expect(polygons.length).toBeGreaterThan(1); // Mainland and islands are kept.
  });
});
