import { afterEach, describe, expect, it } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import i18n, { useLocale } from '../src/i18n';
import { DynamicField } from '../src/components/forms/DynamicField';
import { bi } from '../src/types';
function Draft() {
  const { t } = useLocale();
  const [value, setValue] = useState('ملاحظة أصلية');
  return (
    <>
      <span>{t('save')}</span>
      <DynamicField
        field={{ key: 'notes', type: 'textarea', label: bi('ملاحظات', 'Observations') }}
        value={value}
        onChange={(value) => setValue(String(value))}
      />
    </>
  );
}
afterEach(() => cleanup());
describe('Bilinguisme et saisie', () => {
  it('change RTL vers LTR sans perdre la narration en cours', async () => {
    await act(async () => {
      await i18n.changeLanguage('ar');
    });
    render(<Draft />);
    expect(document.documentElement.dir).toBe('rtl');
    const field = screen.getByRole('textbox');
    fireEvent.change(field, { target: { value: 'نص محفوظ أثناء تغيير اللغة' } });
    await act(async () => {
      await i18n.changeLanguage('fr');
    });
    expect(document.documentElement.dir).toBe('ltr');
    expect(screen.getByText('Enregistrer')).toBeTruthy();
    expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toBe(
      'نص محفوظ أثناء تغيير اللغة',
    );
  });
});
