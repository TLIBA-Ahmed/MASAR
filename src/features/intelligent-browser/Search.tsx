import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { takeSearchDraft, subscribeSearchDraft } from '../../services/searchDraft';
import { Search, Sparkles, ShieldCheck, ArrowUpRight } from 'lucide-react';
import { useLocale } from '../../i18n';
import { useWorkspace } from '../../hooks/useWorkspace';
import { useIntelligentSearch } from '../../hooks/useIntelligentSearch';
import { api } from '../../services/api';
import { aiMessage } from '../../services/aiMessages';
import { searchCategories } from '../../services/search';
import { SearchResults } from '../../components/search/SearchResults';
import { Badge, Button, Empty, Field, Info, PageHeading, Panel } from '../../components/ui';
import type { Bi } from '../../types';
import type { AssignedGroup } from '../assigned-children/AssignedChildren';
interface Answer {
  status: string;
  answer: string;
  limitations: string[];
  mode?: string;
  sources: { source_id: string; title: Bi; page: number | null; version: number; path: string }[];
}
export function IntelligentSearch() {
  const { l, b, t, lang } = useLocale();
  const { data, session } = useWorkspace();
  const [params, setParams] = useSearchParams();
  const [query, setQuery] = useState(
    () =>
      takeSearchDraft() ||
      (/^(CDIS-\d{3,8}|CH-[A-F0-9]{24})$/.test(params.get('q') ?? '') ? params.get('q')! : ''),
  );
  useEffect(() => subscribeSearchDraft(setQuery), []);
  useEffect(() => {
    if (params.has('q')) setParams({}, { replace: true });
  }, [params, setParams]);
  const [filter, setFilter] = useState('all'),
    [caseId, setCaseId] = useState(''),
    [group, setGroup] = useState(''),
    [operation, setOperation] = useState(''),
    [groups, setGroups] = useState<AssignedGroup[]>([]);
  const [answer, setAnswer] = useState<{ key: string; value: Answer } | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(false);
  const controller = useRef<AbortController | null>(null);
  const accessKey = `${session?.sessionId}:${data.backend?.fingerprint}`;
  const key = JSON.stringify([accessKey, lang, query, caseId, group, operation]);
  const result = useIntelligentSearch(query, filter);
  const current = answer?.key === key ? answer.value : null;
  useEffect(() => {
    const abort = new AbortController();
    void api<{ groups: AssignedGroup[] }>('/me/assigned-groups', undefined, {
      signal: abort.signal,
    })
      .then((r) => setGroups(r.groups))
      .catch(() => undefined);
    return () => {
      abort.abort();
      controller.current?.abort();
    };
  }, [accessKey]);
  const ask = async () => {
    controller.current?.abort();
    const abort = new AbortController();
    controller.current = abort;
    setBusy(true);
    setError(false);
    setAnswer(null);
    try {
      const value = await api<Answer>(
        '/browser/ask',
        {
          question: query || l('احسب العدد ضمن النطاق المسموح', 'Calculer le nombre autorisé'),
          language: lang,
          ...(caseId ? { case_id: caseId } : {}),
          ...(group ? { group_id: group } : {}),
          ...(operation ? { operation } : {}),
        },
        { signal: abort.signal },
      );
      setAnswer({ key, value });
    } catch {
      if (!abort.signal.aborted) setError(true);
    } finally {
      if (!abort.signal.aborted) setBusy(false);
    }
  };
  return (
    <>
      <PageHeading
        eyebrow={l(
          'الوصول إلى المعلومة / مصادر مأذونة',
          'ACCÈS À L’INFORMATION / SOURCES AUTORISÉES',
        )}
        title={t('search')}
        description={l(
          'ابحث فورياً أو أرسل سؤالاً صريحاً لصياغة إجابة موثقة.',
          'Recherchez instantanément ou soumettez une question pour une réponse documentée.',
        )}
      />
      <Panel className="smart-search-hero">
        <span className="smart-search-icon">
          <Sparkles size={26} />
        </span>
        <h2>
          {l('معلومة موثقة، في نطاق تكليفك.', 'Une information sourcée, dans votre périmètre.')}
        </h2>
        <p>
          {l(
            'الاقتراحات فورية. لا تُطلب صياغة الإجابة إلا عند الإرسال.',
            'Les suggestions sont instantanées. La rédaction démarre uniquement à votre demande.',
          )}
        </p>
        <form
          className="smart-search-box"
          role="search"
          onSubmit={(e) => {
            e.preventDefault();
            void ask();
          }}
        >
          <Search size={20} />
          <input
            type="search"
            aria-label={l('اكتب سؤالك', 'Saisissez votre question')}
            value={query}
            maxLength={300}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={l('رقم ملف، مورد أو سؤال…', 'Un dossier, une ressource ou une question…')}
          />
          <Button type="submit" disabled={busy || (!query.trim() && !operation)}>
            <Sparkles size={16} />
            {busy ? l('جارٍ التحضير…', 'Préparation…') : l('إرسال السؤال', 'Poser la question')}
          </Button>
        </form>
        <div className="ai-control-row">
          <Field label={l('الملف، اختياري', 'Dossier, facultatif')}>
            <select value={caseId} onChange={(e) => setCaseId(e.target.value)}>
              <option value="">{l('كل النطاق المسموح', 'Tout le périmètre autorisé')}</option>
              {data.cases.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.id}
                </option>
              ))}
            </select>
          </Field>
          <Field label={l('نوع الإجابة', 'Type de réponse')}>
            <select value={operation} onChange={(e) => setOperation(e.target.value)}>
              <option value="">{l('إجابة من المصادر', 'Réponse à partir des sources')}</option>
              <option value="group_count">
                {l('عدد أطفال مجموعة', 'Nombre d’enfants du groupe')}
              </option>
              <option value="pending_objectives">
                {l('الأهداف غير المؤكدة', 'Objectifs à confirmer')}
              </option>
              <option value="assessment_count">{l('عدد التقييمات', 'Nombre d’évaluations')}</option>
              <option value="intervention_count">
                {l('عدد التدخلات المخططة', 'Nombre d’interventions planifiées')}
              </option>
            </select>
          </Field>
          {operation === 'group_count' && (
            <Field label={l('المجموعة', 'Groupe')}>
              <select value={group} onChange={(e) => setGroup(e.target.value)}>
                <option value="">{l('اختر مجموعة', 'Choisir un groupe')}</option>
                {groups.map((g) => (
                  <option key={g.group_id} value={g.group_id}>
                    {b(g.group_name)}
                  </option>
                ))}
              </select>
            </Field>
          )}
        </div>
      </Panel>
      <Info>
        <ShieldCheck size={16} />
        {l(
          'قراءة فقط. تُحسب الأعداد من السجلات المسموح بها، وتُراجع صلاحيات المصادر قبل صياغة الإجابة وبعدها.',
          'Lecture seule. Les calculs portent sur les enregistrements autorisés et les sources sont contrôlées avant et après la rédaction.',
        )}
      </Info>
      {error && (
        <div className="api-error" role="alert">
          {l(
            'تعذّر تنفيذ الطلب. تحقق من الوصول والخدمات المحلية.',
            'La demande a échoué. Vérifiez les accès et les services locaux.',
          )}
        </div>
      )}
      {current && (
        <Panel className="ai-answer">
          <Badge tone={current.status === 'completed' ? 'green' : 'orange'}>
            {current.status === 'completed'
              ? l('إجابة موثقة', 'Réponse documentée')
              : l('توضيح مطلوب', 'Clarification nécessaire')}
          </Badge>
          <div>{current.answer}</div>
          {current.limitations.map((code) => (
            <p className="backend-status" key={code}>
              {aiMessage(code, lang)}
            </p>
          ))}
          <div className="ai-source-list">
            {current.sources.map((s) =>
              s.path.startsWith('/api/') ? (
                <a key={s.source_id} href={s.path} target="_blank" rel="noreferrer">
                  {b(s.title)} · v{s.version}
                  <ArrowUpRight size={12} />
                </a>
              ) : (
                <Link key={s.source_id} to={s.path}>
                  {b(s.title)} · v{s.version}
                  {s.page ? ` · ${l('صفحة', 'p.')} ${s.page}` : ''}
                  <ArrowUpRight size={12} />
                </Link>
              ),
            )}
          </div>
        </Panel>
      )}
      {query.trim() && (
        <>
          <div className="search-result-toolbar">
            <h2>
              {l('نتائج فورية', 'Résultats instantanés')}{' '}
              <span role="status">{result.pending ? '…' : result.results.length}</span>
            </h2>
            <select
              aria-label={l('فئة النتائج', 'Catégorie de résultats')}
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            >
              <option value="all">{t('all')}</option>
              {Object.entries(searchCategories).map(([kind, label]) => (
                <option key={kind} value={kind}>
                  {b(label)}
                </option>
              ))}
            </select>
          </div>
          <Panel>
            {result.pending ? (
              <p className="instant-search-empty" role="status">
                {t('loading')}
              </p>
            ) : result.results.length ? (
              <SearchResults results={result.results} query={query} />
            ) : (
              <Empty title={l('لا توجد نتائج ضمن نطاقك', 'Aucun résultat dans votre périmètre')} />
            )}
          </Panel>
        </>
      )}
    </>
  );
}
