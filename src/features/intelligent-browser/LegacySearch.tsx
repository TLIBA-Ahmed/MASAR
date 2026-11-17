import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, History, Search, ShieldCheck, Sparkles } from 'lucide-react';
import { useWorkspace } from '../../hooks/useWorkspace';
import { useIntelligentSearch } from '../../hooks/useIntelligentSearch';
import { useLocale } from '../../i18n';
import { rememberSearch, searchCategories } from '../../services/search';
import { Button, Empty, Info, PageHeading, Panel } from '../../components/ui';
import { SearchResults } from '../../components/search/SearchResults';
const suggestions = [
  [
    'اعرض الملفات التي تحتاج إلى تقييم أولي',
    'Afficher les dossiers nécessitant une évaluation initiale',
  ],
  ['ما هي التقييمات المبرمجة هذا الشهر؟', 'Quelles évaluations sont programmées ce mois ?'],
  ['اعرض المشاريع التربوية غير المكتملة', 'Afficher les projets éducatifs incomplets'],
  [
    'ما هي الأنشطة المنجزة خلال الأسبوع الحالي؟',
    'Quelles activités sont réalisées cette semaine ?',
  ],
  [
    'اعرض آخر التدخلات المسجلة في الملف CDIS-024',
    'Afficher les dernières interventions du dossier CDIS-024',
  ],
];
export function IntelligentSearch() {
  const { l, b, t, lang } = useLocale();
  const { data, mutate } = useWorkspace();
  const [params, setParams] = useSearchParams();
  const query = params.get('q') ?? '';
  const [filter, setFilter] = useState('all');
  const result = useIntelligentSearch(query, filter);
  const history = data.searchHistories[result.scopeKey] ?? [];
  const submit = (value: string) => {
    if (!value.trim()) return;
    setParams({ q: value });
    mutate((d, user) => rememberSearch(d, user, value));
  };
  return (
    <>
      <PageHeading
        eyebrow={l(
          'المكوّن الذكي 01 / الوصول إلى المعلومة',
          'MODULE INTELLIGENT 01 / ACCÈS À L’INFORMATION',
        )}
        title={t('search')}
        description={l(
          'بحث شامل وفوري، ومصادر متاحة ضمن تكليفك المهني.',
          'Une recherche transversale et instantanée dans votre périmètre professionnel.',
        )}
      />
      <Panel className="smart-search-hero">
        <span className="smart-search-icon">
          <Sparkles size={25} />
        </span>
        <h2>{l('كيف يمكنني مساعدتك اليوم؟', 'Comment puis-je vous aider aujourd’hui ?')}</h2>
        <p>
          {l(
            'ملفات، استمارات، أنشطة، مواعيد وموارد — نتائج مصرح بها فقط.',
            'Dossiers, formulaires, activités, rendez-vous et ressources — uniquement vos résultats autorisés.',
          )}
        </p>
        <form
          className="smart-search-box"
          role="search"
          onSubmit={(event) => {
            event.preventDefault();
            submit(query);
          }}
        >
          <Search size={20} />
          <input
            aria-label={l('اكتب سؤالك', 'Saisissez votre question')}
            value={query}
            type="search"
            maxLength={300}
            onChange={(event) =>
              setParams(event.target.value ? { q: event.target.value } : {}, { replace: true })
            }
            placeholder={l(
              'اسم، هدف، رقم ملف أو سؤال…',
              'Un nom, un objectif, un numéro de dossier ou une question…',
            )}
          />
          <Button type="submit">
            {lang === 'ar' ? <ArrowLeft size={20} /> : <ArrowRight size={20} />}
            <span className="sr-only">{l('بحث', 'Rechercher')}</span>
          </Button>
        </form>
        <div className="search-suggestions">
          {suggestions.slice(0, 3).map(([ar, fr]) => (
            <button key={fr} onClick={() => submit(l(ar, fr))}>
              {l(ar, fr)}
            </button>
          ))}
        </div>
      </Panel>
      <Info>
        <ShieldCheck size={15} />
        {l(
          'بحث نصي محلي بالعربية والفرنسية، بعد تطبيق الصلاحيات. هذه المحاكاة في المتصفح لا تحمي بيانات حقيقية؛ يلزم التحكم بالخادم في النسخة المستقبلية.',
          'Recherche textuelle locale en arabe et en français après contrôle des accès. Cette simulation frontend ne protège pas des données réelles ; les contrôles devront être appliqués côté serveur.',
        )}
      </Info>
      {query.trim() ? (
        <>
          <div className="search-result-toolbar">
            <h2>
              {l('نتائج البحث', 'Résultats de recherche')}{' '}
              <span role="status">{result.pending ? '…' : result.results.length}</span>
            </h2>
            <select
              aria-label={l('فئة النتائج', 'Catégorie de résultats')}
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
            >
              <option value="all">{t('all')}</option>
              {Object.entries(searchCategories).map(([kind, label]) => (
                <option key={kind} value={kind}>
                  {b(label)}
                </option>
              ))}
            </select>
          </div>
          {result.intent && (
            <div className="search-understanding">
              <Sparkles size={15} />
              {b(result.intent)}
            </div>
          )}
          <Panel>
            {result.pending ? (
              <p className="instant-search-empty" role="status">
                {l('جارٍ البحث…', 'Recherche…')}
              </p>
            ) : result.results.length ? (
              <SearchResults results={result.results} query={query} onOpen={() => submit(query)} />
            ) : (
              <Empty
                title={l('لا توجد نتائج ضمن نطاقك', 'Aucun résultat dans votre périmètre')}
                description={l(
                  'جرّب رقم ملف أو كلمات قصيرة أو أحد الاقتراحات.',
                  'Essayez un numéro de dossier, quelques mots ou une suggestion.',
                )}
              />
            )}
          </Panel>
        </>
      ) : (
        <div className="search-explore">
          <Panel>
            <h2>{l('جرّب سؤالاً', 'Essayez une question')}</h2>
            {suggestions.slice(3).map(([ar, fr]) => (
              <button key={fr} onClick={() => submit(l(ar, fr))}>
                <Search size={15} />
                {l(ar, fr)}
              </button>
            ))}
          </Panel>
          <Panel>
            <h2>
              <History size={17} />
              {l('عمليات البحث الأخيرة لهذا الملف المهني', 'Recherches récentes de ce profil')}
            </h2>
            {history.length ? (
              history.map((value) => (
                <button key={value} onClick={() => submit(value)}>
                  {value}
                </button>
              ))
            ) : (
              <p>{l('ستظهر استفساراتك هنا.', 'Vos recherches apparaîtront ici.')}</p>
            )}
          </Panel>
        </div>
      )}
    </>
  );
}
