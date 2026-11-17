import { Plus, Trash2 } from 'lucide-react';
import type { FieldDefinition, FormValue } from '../../types';
import { useLocale } from '../../i18n';
import { Button, Field, IconButton } from '../ui';
export function DynamicField({
  field,
  value,
  onChange,
  disabled = false,
  error,
}: {
  field: FieldDefinition;
  value: FormValue | undefined;
  onChange: (value: FormValue) => void;
  disabled?: boolean;
  error?: string;
}) {
  const { l, b } = useLocale();
  const errors: Record<string, string> = {
    required: l('هذا الحقل مطلوب.', 'Ce champ est requis.'),
    number: l('يرجى إدخال عدد صحيح ضمن المجال.', 'Saisissez un nombre dans l’intervalle prévu.'),
    age: l(
      'يجب أن يكون العمر أقل من 18 سنة وتاريخ الولادة صحيحاً.',
      'La date doit correspondre à un enfant de moins de 18 ans.',
    ),
    demo: l(
      'استعمل معرّفاً يبدأ بـ DEMO- فقط.',
      'Utilisez uniquement un identifiant commençant par DEMO-.',
    ),
  };
  if (field.type === 'table') {
    const rows = Array.isArray(value) ? (value as Record<string, string>[]) : [];
    return (
      <div className="dynamic-table-field full-span">
        <div className="field-table-header">
          <h3>{b(field.label)}</h3>
          {!disabled && (
            <Button
              type="button"
              variant="secondary"
              onClick={() =>
                onChange([...rows, Object.fromEntries(field.columns!.map((c) => [c.key, '']))])
              }
            >
              <Plus size={14} />
              {l('إضافة سطر', 'Ajouter une ligne')}
            </Button>
          )}
        </div>
        {!rows.length ? (
          <p className="table-empty">
            {l(
              'لا توجد أسطر بعد. أضف سطراً عند الحاجة.',
              'Aucune ligne. Ajoutez-en une si nécessaire.',
            )}
          </p>
        ) : (
          <div className="table-scroll">
            <table className="data-table input-table">
              <thead>
                <tr>
                  {field.columns?.map((c) => (
                    <th key={c.key}>{b(c.label)}</th>
                  ))}
                  {!disabled && <th />}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr key={i}>
                    {field.columns?.map((c) => (
                      <td key={c.key}>
                        {disabled ? (
                          <span>{row[c.key] || '—'}</span>
                        ) : (
                          <input
                            aria-label={`${b(c.label)} ${i + 1}`}
                            value={row[c.key] ?? ''}
                            onChange={(e) =>
                              onChange(
                                rows.map((r, j) =>
                                  i === j ? { ...r, [c.key]: e.target.value } : r,
                                ),
                              )
                            }
                          />
                        )}
                      </td>
                    ))}
                    {!disabled && (
                      <td>
                        <IconButton
                          label={l('حذف السطر', 'Supprimer la ligne')}
                          onClick={() => onChange(rows.filter((_, j) => j !== i))}
                        >
                          <Trash2 size={15} />
                        </IconButton>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  }
  if (field.type === 'matrix') {
    const values =
      typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, string>) : {};
    return (
      <div className="matrix-field full-span">
        <h3>{b(field.label)}</h3>
        <div className="table-scroll">
          <table className="data-table matrix-table">
            <thead>
              <tr>
                <th>{l('المعيار', 'Critère')}</th>
                {field.columns?.map((c) => (
                  <th key={c.key}>{b(c.label)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {field.rows?.map((row, i) => (
                <tr key={i}>
                  <td>{b(row)}</td>
                  {field.columns?.map((c) => (
                    <td key={c.key}>
                      <select
                        disabled={disabled}
                        aria-label={`${b(row)} — ${b(c.label)}`}
                        value={values[`${i}-${c.key}`] ?? ''}
                        onChange={(e) => onChange({ ...values, [`${i}-${c.key}`]: e.target.value })}
                      >
                        <option value="">{l('غير معلوم', 'Non renseigné')}</option>
                        {field.options?.map((o) => (
                          <option value={o.value} key={o.value}>
                            {b(o.label)}
                          </option>
                        ))}
                      </select>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }
  if (field.type === 'multi' || field.type === 'radio') {
    const values = Array.isArray(value) ? (value as string[]) : [];
    return (
      <fieldset
        className={`choice-field ${field.type === 'multi' ? 'full-span' : ''}`}
        disabled={disabled}
      >
        <legend>{b(field.label)}</legend>
        <div className="choice-options">
          {field.options?.map((option) => (
            <label key={option.value}>
              <input
                type={field.type === 'multi' ? 'checkbox' : 'radio'}
                name={field.key}
                checked={
                  field.type === 'multi' ? values.includes(option.value) : value === option.value
                }
                onChange={() =>
                  onChange(
                    field.type === 'multi'
                      ? values.includes(option.value)
                        ? values.filter((v) => v !== option.value)
                        : [...values, option.value]
                      : option.value,
                  )
                }
              />
              {b(option.label)}
            </label>
          ))}
        </div>
        {error && <small className="error-text">{errors[error]}</small>}
      </fieldset>
    );
  }
  if (field.type === 'checkbox')
    return (
      <label className="checkbox-label">
        <input
          type="checkbox"
          checked={Boolean(value)}
          disabled={disabled}
          onChange={(e) => onChange(e.target.checked)}
        />
        {b(field.label)}
      </label>
    );
  return (
    <div className={field.type === 'textarea' ? 'full-span' : ''}>
      <Field
        label={b(field.label)}
        required={field.required}
        error={error ? errors[error] : undefined}
      >
        {field.type === 'textarea' ? (
          <textarea
            rows={3}
            disabled={disabled}
            value={String(value ?? '')}
            onChange={(e) => onChange(e.target.value)}
          />
        ) : field.type === 'select' ? (
          <select
            disabled={disabled}
            value={String(value ?? '')}
            onChange={(e) => onChange(e.target.value)}
          >
            <option value="">{l('غير معلوم', 'Non renseigné')}</option>
            {field.options?.map((o) => (
              <option key={o.value} value={o.value}>
                {b(o.label)}
              </option>
            ))}
          </select>
        ) : (
          <input
            disabled={disabled}
            type={field.type}
            value={String(value ?? '')}
            min={field.min}
            max={field.max}
            onChange={(e) =>
              onChange(
                field.type === 'number' && e.target.value !== ''
                  ? Number(e.target.value)
                  : e.target.value,
              )
            }
          />
        )}
      </Field>
      {field.shared && (
        <small className="shared-field-hint">
          {l('مرتبط بالملف المركزي', 'Lié au dossier central')}
        </small>
      )}
      {field.help && <small className="field-help">{b(field.help)}</small>}
    </div>
  );
}
