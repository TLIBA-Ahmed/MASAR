import { describe, expect, it } from 'vitest';
import { forms, getForm } from '../src/data/form-definitions';

describe('CDIS official document integration', () => {
  it('preserves the 15 original form IDs and registers only 7 additions', () => {
    expect(forms.map((f) => f.id)).toEqual(
      Array.from({ length: 22 }, (_, i) => 'F' + String(i + 1).padStart(2, '0')),
    );
    expect(new Set(forms.map((f) => f.id)).size).toBe(22);
  });

  it('keeps new psychological forms restricted to the psychologist context', () => {
    for (const id of ['F18', 'F19', 'F20', 'F21', 'F22']) {
      const form = getForm(id);
      expect(form?.role).toBe('psychologist');
      expect(form?.sections.length).toBeGreaterThan(0);
      expect(form?.reference.length).toBeGreaterThan(0);
    }
  });

  it('keeps existing initial evaluation and the original social form unchanged', () => {
    expect(getForm('F12')?.title.ar).toBe('جذاذة التقييم النفسي');
    expect(getForm('F15')?.title.ar).toBe('ملف حالة اجتماعية');
  });

  it('provides an editable observation grid, professional plan and life project', () => {
    expect(getForm('F16')?.sections.some((s) => s.id === 'future')).toBe(true);
    expect(getForm('F17')?.sections.some((s) => s.fields.some((f) => f.type === 'table'))).toBe(true);
    expect(getForm('F22')?.sections.some((s) => s.id === 'abc')).toBe(true);
    expect(getForm('F22')?.sections.some((s) => s.id === 'monthly')).toBe(true);
  });

  it('retains source references and professional review rather than automatic scoring', () => {
    for (const form of forms.filter((f) => Number(f.id.slice(1)) >= 16)) {
      expect(form.reference.length).toBeGreaterThan(0);
      expect(form.sections.flatMap((s) => s.fields).some((f) => f.key === 'autoDiagnosis')).toBe(false);
      expect(form.sections.flatMap((s) => s.fields).some((f) => f.key === 'riskScore')).toBe(false);
    }
  });
});
