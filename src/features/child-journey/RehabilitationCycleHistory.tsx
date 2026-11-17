import { Repeat2, Layers3, ArrowLeft } from 'lucide-react';
import { useLocale } from '../../i18n';
import { Badge, Panel, SectionHeading } from '../../components/ui';
import type { ChildJourney } from './types';

export function RehabilitationCycleHistory({ journey }: { journey: ChildJourney }) {
  const { l, date } = useLocale();
  return (
    <Panel className="journey-cycle-history">
      <SectionHeading
        title={l('دورات التأهيل ونسخ الخطة', 'Cycles de réhabilitation et versions du plan')}
        subtitle={l(
          'كل دورة تحفظ ما سبقها. التوجيه والختم قراران مستقلان.',
          'Chaque cycle conserve les précédents. Orientation et clôture restent des décisions distinctes.',
        )}
        actions={<Repeat2 size={21} />}
      />
      <div className="journey-cycles">
        {journey.cycles.map((cycle) => (
          <article
            key={cycle.number}
            className={cycle.number === journey.cycle ? 'active-cycle' : ''}
          >
            <span className="journey-cycle-number">0{cycle.number}</span>
            <div>
              <h3>
                {cycle.number === 1
                  ? l('الدورة الأولى', 'Cycle initial')
                  : cycle.number === 2
                    ? l('التمديد الأول', 'Première prolongation')
                    : cycle.number === 3
                      ? l('التمديد الثاني', 'Deuxième prolongation')
                      : `${l('التمديد', 'Prolongation')} ${cycle.number - 1}`}
              </h3>
              {cycle.decisions.map((d) => (
                <div key={d.id}>
                  <p>
                    <Badge tone="orange">
                      04 <ArrowLeft size={12} /> 03
                    </Badge>{' '}
                    {date(d.date)} · {d.professionalId}
                  </p>
                  <p className="narrative">{d.reason}</p>
                  {d.historicalDemo && (
                    <small>
                      {l('سجل تاريخي اصطناعي للعرض', 'Historique synthétique de démonstration')}
                    </small>
                  )}
                </div>
              ))}
              {!cycle.decisions.length && (
                <p className="muted">
                  {cycle.number === 1
                    ? l(
                        'بداية المرافقة من الملف المركزي.',
                        'Début de l’accompagnement dans le dossier central.',
                      )
                    : l(
                        'قرار الدورة غير موثق ضمن نطاق الوصول الحالي.',
                        'Décision du cycle non documentée dans le périmètre d’accès actuel.',
                      )}
                </p>
              )}
            </div>
            {cycle.number === journey.cycle && <Badge tone="blue">{l('الحالية', 'Actuel')}</Badge>}
          </article>
        ))}
      </div>
      <div className="journey-plan-versions">
        {journey.versions.map((v) => (
          <details key={v.id}>
            <summary>
              <Layers3 size={16} />
              <strong>
                {l('نسخة الخطة', 'Version du plan')} {v.version}
              </strong>
              <time>{date(v.date)}</time>
              {v.cycle && (
                <Badge>
                  {l('الدورة', 'Cycle')} {v.cycle}
                </Badge>
              )}
            </summary>
            <p className="narrative">
              {v.notes || l('لا ملاحظات في هذه النسخة.', 'Aucune note dans cette version.')}
            </p>
            <small>{v.professionalId}</small>
          </details>
        ))}
      </div>
    </Panel>
  );
}
