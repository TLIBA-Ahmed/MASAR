import { useEffect, useState } from 'react';
import { useLocale } from '../../i18n';
import { useWorkspace } from '../../hooks/useWorkspace';
import { api } from '../../services/api';
import { Badge, Button, Field, Info, Modal, useToast } from '../../components/ui';
import type { Bi } from '../../types';
interface Assignment {
  id: string;
  employee_id: string;
  role_id: string;
  assignment_status: string;
  name: Bi;
}
export function GroupAccessPanel({ groupId }: { groupId: string }) {
  const { session, data, refresh } = useWorkspace();
  const { l, b, t } = useLocale();
  const toast = useToast();
  const [assignments, setAssignments] = useState<Assignment[]>([]),
    [action, setAction] = useState<{ kind: 'add' | 'end' | 'revoke'; id: string } | null>(null),
    [caseId, setCase] = useState(''),
    [reason, setReason] = useState('');
  const canManage = session?.capabilities?.includes('assignments.manage');
  useEffect(() => {
    if (!canManage) return;
    const controller = new AbortController();
    void api<{ assignments: Assignment[] }>(`/groups/${groupId}/assignments`, undefined, {
      signal: controller.signal,
    })
      .then((r) => setAssignments(r.assignments))
      .catch(() => setAssignments([]));
    return () => controller.abort();
  }, [groupId, canManage, data.backend?.fingerprint]);
  if (!canManage) return null;
  return (
    <details className="roadmap-plan">
      <summary>
        {l('إدارة تكليفات المجموعة — عرض تجريبي', 'Affectations du groupe — démonstration')}
      </summary>
      <Info>
        {l(
          'كل تعديل بشري مبرر ومحفوظ في التاريخ. لا يمنح التكليف وصولاً تلقائياً إلى السجلات السرية.',
          'Chaque modification humaine est motivée et historisée. Une affectation ne donne pas automatiquement accès aux notes confidentielles.',
        )}
      </Info>
      <Button
        variant="secondary"
        onClick={() => {
          setReason('');
          setAction({ kind: 'add', id: '' });
        }}
      >
        {l('إضافة طفل للمجموعة', 'Ajouter un enfant au groupe')}
      </Button>
      <Button
        variant="secondary"
        onClick={() => {
          setReason('');
          setAction({ kind: 'end', id: '' });
        }}
      >
        {l('إنهاء عضوية طفل', 'Terminer une appartenance')}
      </Button>
      {assignments.map((a) => (
        <div className="group-card-footer" key={a.id}>
          <span>
            {b(a.name)} · {t(a.role_id)}{' '}
            <Badge tone={a.assignment_status === 'ACTIVE' ? 'green' : 'neutral'}>
              {a.assignment_status === 'ACTIVE' ? l('نشط', 'Actif') : l('منتهٍ', 'Terminé')}
            </Badge>
          </span>
          {a.assignment_status === 'ACTIVE' && a.employee_id !== session?.userId && (
            <Button
              variant="secondary"
              onClick={() => {
                setReason('');
                setAction({ kind: 'revoke', id: a.id });
              }}
            >
              {l('سحب التكليف', 'Révoquer l’affectation')}
            </Button>
          )}
        </div>
      ))}
      <Modal
        open={Boolean(action)}
        onClose={() => setAction(null)}
        title={l('توثيق تعديل التكليف', 'Documenter la modification d’affectation')}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!action) return;
            const path =
              action.kind === 'revoke'
                ? `/group-assignments/${action.id}/revoke`
                : action.kind === 'add'
                  ? `/groups/${groupId}/members`
                  : `/groups/${groupId}/children/${caseId}/end`;
            void api(path, { reason, ...(action.kind === 'add' ? { case_id: caseId } : {}) })
              .then(async () => {
                setAction(null);
                setReason('');
                setCase('');
                await refresh();
                toast(
                  l(
                    'حُفظ التعديل وأُعيد تقييم الوصول.',
                    'Modification enregistrée et accès réévalués.',
                  ),
                );
              })
              .catch(() =>
                toast(
                  l(
                    'العملية غير مسموح بها أو العضوية غير صالحة.',
                    'Opération refusée ou appartenance invalide.',
                  ),
                  true,
                ),
              );
          }}
        >
          {action?.kind !== 'revoke' && (
            <Field
              label={l('رقم الملف الاصطناعي في المركز', 'Numéro du dossier synthétique du centre')}
            >
              <input
                required
                pattern="CDIS-[0-9]{3,8}"
                placeholder="CDIS-041"
                value={caseId}
                onChange={(e) => setCase(e.target.value)}
              />
            </Field>
          )}
          <Field label={l('المبرر المهني', 'Motif professionnel')}>
            <textarea
              required
              minLength={3}
              maxLength={1000}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </Field>
          <Button type="submit">{l('تأكيد التعديل', 'Confirmer la modification')}</Button>
        </form>
      </Modal>
    </details>
  );
}
