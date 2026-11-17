import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';
import { cleanup, render, screen, fireEvent } from '@testing-library/react';
import i18n from '../src/i18n';
import { JourneySummaryCard } from '../src/features/child-journey/JourneySummaryCard';
import { stages } from '../src/config/workflow';
import type { StageSummaryCardData } from '../src/features/child-journey/summaryTypes';
import type { JourneyCheckpointData } from '../src/features/child-journey/types';

const card: StageSummaryCardData = {
  stage_id: 3,
  cycle_id: 2,
  status: 'current',
  period: { start: null, end: null },
  latest_draft: null,
  update_available: false,
  history_count: 2,
  summary: {
    id: 'JS-test',
    case_id: 'CDIS-024',
    stage_id: 3,
    cycle_id: 2,
    version: 2,
    summary_ar: 'مشاركة موثقة في الورشة.',
    summary_fr: 'Participation à l’atelier documentée.',
    generation_method: 'deterministic_unavailable',
    model_version: null,
    validation_status: 'approved',
    validated_by: 'p3',
    validated_at: '2026-11-17',
    period: { start: null, end: null },
    sections: {
      situation: [],
      observations: [
        {
          text: { ar: 'ملاحظة مهنية محفوظة', fr: 'Observation professionnelle conservée' },
          source_ids: ['observation:1'],
          nature: 'professional_interpretation',
        },
      ],
      actions: [],
      progress: [],
      objectives: [
        {
          text: { ar: 'هدف التعاون قيد العمل', fr: 'Objectif de coopération à travailler' },
          source_ids: ['goal:1'],
          nature: 'documented_fact',
        },
      ],
      next_actions: [],
      difficulties: [],
      decisions: [],
    },
    source_references: [],
  },
};
const checkpoint: JourneyCheckpointData = {
  ...stages[2],
  status: 'current',
  current: true,
  future: false,
  startedAt: null,
  endedAt: null,
  completedSubsteps: 1,
  totalSubsteps: 10,
  documentCount: 0,
  pendingCount: 0,
};
beforeEach(async () => {
  await i18n.changeLanguage('fr');
});
afterEach(cleanup);
describe('Cartes de synthèse sourcées', () => {
  it('distingue approbation professionnelle, indisponibilité IA et absence de date', () => {
    render(
      <JourneySummaryCard
        data={card}
        checkpoint={checkpoint}
        selected
        onDetails={vi.fn()}
        onSources={vi.fn()}
        onHistory={vi.fn()}
        onReview={vi.fn()}
      />,
    );
    expect(screen.getByText('Validée professionnellement')).toBeTruthy();
    expect(screen.getByText('Déterministe · modèle indisponible')).toBeTruthy();
    expect(screen.getByText('Début non documenté')).toBeTruthy();
    expect(screen.getByText('Objectif de coopération à travailler')).toBeTruthy();
    expect(screen.queryByText(/objectif atteint/i)).toBeNull();
  });
  it('conserve les observations et actions distinctes dans les deux langues, avec commandes explicites', async () => {
    const sources = vi.fn(),
      details = vi.fn();
    render(
      <JourneySummaryCard
        data={card}
        checkpoint={checkpoint}
        selected={false}
        onDetails={details}
        onSources={sources}
        onHistory={vi.fn()}
        onReview={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /Sources/ }));
    expect(sources).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole('button', { name: 'Détails' }));
    expect(details).toHaveBeenCalledWith(3);
    const expand = screen.getByRole('button', { expanded: false });
    fireEvent.click(expand);
    expect(expand.getAttribute('aria-expanded')).toBe('true');
    await i18n.changeLanguage('ar');
    expect(screen.getByText('مشاركة موثقة في الورشة.')).toBeTruthy();
    expect(document.querySelector('[data-summary-stage="3"]')?.getAttribute('dir')).toBe('rtl');
  });
});
