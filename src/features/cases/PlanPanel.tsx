import { useState } from 'react';
import { CalendarPlus } from 'lucide-react';
import { useWorkspace } from '../../hooks/useWorkspace';
import { useLocale } from '../../i18n';
import { api } from '../../services/api';
import { Button, Field, Info, useToast } from '../../components/ui';
import type { Case } from '../../types';
export function PlanPanel({ c }: { c: Case }) {
  const { data, refresh } = useWorkspace();
  const { l, b } = useLocale();
  const toast = useToast();
  const [activityId, setActivity] = useState(''),
    [date, setDate] = useState(new Date().toISOString().slice(0, 10)),
    [reason, setReason] = useState(''),
    [confirmed, setConfirmed] = useState(false),
    [busy, setBusy] = useState(false),
    [key, setKey] = useState(crypto.randomUUID());
  const activity = data.activities.find((a) => a.id === activityId);
  const goals = c.goals.filter((g) => g.confirmed && activity?.skills.includes(g.skill));
  const canPlan =
    data.backend?.access[c.id]?.categories.educational?.write &&
    data.backend?.access[c.id]?.categories.roadmap?.write;
  if (!canPlan) return null;
  return (
    <details className="roadmap-plan">
      <summary>
        <CalendarPlus size={17} />{' '}
        {l(
          'تخطيط تدخل بقرار مهني مستقل',
          'Planifier une intervention par décision professionnelle distincte',
        )}
      </summary>
      <Info>
        {l(
          'هذا إجراء رسمي مستقل عن قبول أي توصية. سيُحفظ إصدار جديد من الخطة مع المبرر.',
          'Cette action officielle est indépendante de l’acceptation d’une recommandation. Elle crée une version du plan avec votre motif.',
        )}
      </Info>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setBusy(true);
          void api(`/cases/${c.id}/planned-interventions`, {
            intervention_id: activityId,
            goal_ids: goals.map((g) => g.id),
            date,
            reason,
            idempotency_key: key,
            prerequisites_confirmed: confirmed,
          })
            .then(async () => {
              await refresh();
              setReason('');
              setConfirmed(false);
              setKey(crypto.randomUUID());
              toast(
                l(
                  'حُفظ التدخل المخطط في الملف والخطة.',
                  'L’intervention planifiée est enregistrée dans le dossier et le plan.',
                ),
              );
            })
            .catch(() =>
              toast(
                l(
                  'تعذّرت البرمجة. تحقق من الأهداف والأهلية والصلاحيات.',
                  'La planification a échoué. Vérifiez les objectifs, l’éligibilité et les accès.',
                ),
                true,
              ),
            )
            .finally(() => setBusy(false));
        }}
      >
        <Field label={l('النشاط', 'Activité')}>
          <select
            required
            value={activityId}
            onChange={(e) => {
              setActivity(e.target.value);
              setConfirmed(false);
            }}
          >
            <option value="">{l('اختر نشاطاً', 'Choisir une activité')}</option>
            {data.activities.map((a) => (
              <option key={a.id} value={a.id}>
                {b(a.title)}
              </option>
            ))}
          </select>
        </Field>
        <p className="backend-status">
          {l('الأهداف المتوافقة المؤكدة', 'Objectifs confirmés compatibles')} :{' '}
          {goals.map((g) => b(g.description)).join(' · ') || '—'}
        </p>
        <Field label={l('التاريخ', 'Date')}>
          <input
            type="date"
            required
            min={new Date().toISOString().slice(0, 10)}
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </Field>
        <Field label={l('مبرر القرار المهني', 'Motif de la décision professionnelle')}>
          <textarea
            required
            minLength={3}
            maxLength={1000}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </Field>
        <label className="studio-goal">
          <input
            required
            type="checkbox"
            checked={confirmed}
            onChange={(e) => setConfirmed(e.target.checked)}
          />
          {l(
            'راجعت المتطلبات والمواد والقيود مع الفريق.',
            'J’ai vérifié les prérequis, le matériel et les restrictions avec l’équipe.',
          )}
        </label>
        <Button type="submit" disabled={busy || !activity || !goals.length}>
          {l('تأكيد التخطيط المهني', 'Confirmer la planification professionnelle')}
        </Button>
      </form>
    </details>
  );
}
