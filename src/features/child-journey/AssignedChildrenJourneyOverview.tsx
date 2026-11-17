import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowUpRight, Compass, Search, Users } from 'lucide-react';
import { useLocale } from '../../i18n';
import { Badge, Button, Empty, Field, Panel, SectionHeading } from '../../components/ui';
import { TunisiaMap3D } from './TunisiaMap3D';
import { useJourneyResource } from './useJourneyResource';
import type { JourneyOverview } from './types';
import type { Stage } from '../../types';
import { normalize } from '../../services/search';

export function AssignedChildrenJourneyOverview() {
  const { l, b, date, t } = useLocale();
  const [params, setParams] = useSearchParams();
  const [query, setQuery] = useState('');
  const group = params.get('group') ?? '';
  const stage = Number(params.get('stage'));
  const selected = stage >= 1 && stage <= 5 ? (stage as Stage) : null;
  const search = new URLSearchParams();
  if (group) search.set('group_id', group);
  const {
    data: source,
    error,
    retry,
  } = useJourneyResource<JourneyOverview>(`/journeys/assigned?${search}`);
  const matches =
    source?.children.filter((c) =>
      normalize(`${c.id} ${c.name.ar} ${c.name.fr}`).includes(normalize(query)),
    ) ?? [];
  const data = source
    ? {
        ...source,
        children: matches,
        count: matches.length,
        checkpoints: source.checkpoints.map((s) => ({
          ...s,
          childCount: matches.filter((c) => c.stage === s.id).length,
        })),
      }
    : null;
  function filter(key: string, value: string) {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next);
  }
  const children = data?.children.filter((c) => !selected || c.stage === selected) ?? [];
  if (error)
    return (
      <Empty
        title={l('المسارات غير متاحة ضمن هذا النطاق', 'Parcours indisponibles dans ce périmètre')}
        action={<Button onClick={retry}>{l('إعادة المحاولة', 'Réessayer')}</Button>}
      />
    );
  return (
    <>
      <div className="journey-overview-intro">
        <div>
          <span className="eyebrow">MASAR / {l('رؤية مشتركة', 'UNE VISION PARTAGÉE')}</span>
          <h2>
            {l(
              'مسارات مختلفة. مرافقة متواصلة.',
              'Des parcours singuliers. Un accompagnement continu.',
            )}
          </h2>
          <p>
            {l(
              'خمس محطات تربط كل تقدم موثق بملف الطفل.',
              'Cinq étapes pour relier chaque avancée documentée au dossier de l’enfant.',
            )}
          </p>
        </div>
        <Compass size={72} strokeWidth={0.8} aria-hidden="true" />
        <div className="journey-overview-total">
          <strong>{data?.count ?? '—'}</strong>
          <span>{l('أطفال في نطاق المتابعة', 'enfants dans le périmètre')}</span>
        </div>
      </div>
      <div className="journey-overview-filters">
        <div className="search-input">
          <Search size={17} />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label={l('البحث في مسارات الأطفال', 'Rechercher un parcours d’enfant')}
            placeholder={l(
              'رمز الطفل أو معرف الملف…',
              'Code enfant ou identifiant du dossier…',
            )}
          />
        </div>
        <Field label={l('المجموعة المصرح بها', 'Groupe autorisé')}>
          <select value={group} onChange={(e) => filter('group', e.target.value)}>
            <option value="">
              {l('كل المجموعات والملفات الفردية', 'Tous les groupes et dossiers individuels')}
            </option>
            {data?.groups.map((g) => (
              <option key={g.group_id} value={g.group_id}>
                {b(g.group_name)} · {g.active_child_count}
              </option>
            ))}
          </select>
        </Field>
        <Field label={l('مرحلة المسار', 'Étape du parcours')}>
          <select value={selected ?? ''} onChange={(e) => filter('stage', e.target.value)}>
            <option value="">{l('المراحل الخمس', 'Les cinq étapes')}</option>
            {data?.checkpoints.map((s) => (
              <option key={s.id} value={s.id}>
                {s.id}. {b(s.short)}
              </option>
            ))}
          </select>
        </Field>
      </div>
      {!data ? (
        <Panel>
          <p role="status">{t('loading')}</p>
        </Panel>
      ) : (
        <div className="journey-overview-grid">
          <TunisiaMap3D
            overview
            checkpoints={data.checkpoints}
            selected={selected}
            onSelect={(n) => filter('stage', String(n))}
          />
          <Panel className="journey-roster">
            <SectionHeading
              title={
                selected
                  ? b(data.checkpoints[selected - 1].short)
                  : l('الأطفال المصرح بمتابعتهم', 'Enfants dans votre périmètre')
              }
              subtitle={l(
                'اختر محطة لتصفية القائمة، ثم افتح مساراً فردياً.',
                'Choisissez une étape pour filtrer la liste, puis ouvrez un parcours individuel.',
              )}
              actions={<Badge>{children.length}</Badge>}
            />
            {selected && (
              <button type="button" className="text-link" onClick={() => filter('stage', '')}>
                {l('عرض كل المراحل', 'Afficher toutes les étapes')}
              </button>
            )}
            {children.length ? (
              <div className="journey-child-list">
                {children.map((c) => (
                  <Link key={c.id} to={`/child-journey/${c.id}`} className="journey-child-card">
                    <span className="journey-child-stage">0{c.stage}</span>
                    <div>
                      <span className="mono">{c.id}</span>
                      <strong>{b(c.name)}</strong>
                      <small>
                        {c.nextDue ? `${l('الأجل', 'Échéance')} · ${date(c.nextDue)}` : t(c.status)}
                      </small>
                      {c.cycle > 1 && (
                        <Badge tone="orange">
                          {l('الدورة', 'Cycle')} {c.cycle}
                        </Badge>
                      )}
                    </div>
                    <ArrowUpRight size={18} />
                  </Link>
                ))}
              </div>
            ) : (
              <Empty title={l('لا أطفال يطابقون المرشحات', 'Aucun enfant pour ces filtres')} />
            )}
            <div className="journey-roster-note">
              <Users size={16} />
              {l(
                'القائمة والعدادات من نفس الملفات المصرح بها.',
                'Listes et compteurs proviennent des mêmes dossiers autorisés.',
              )}
            </div>
          </Panel>
        </div>
      )}
    </>
  );
}
