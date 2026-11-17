import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Search, ShieldCheck, X } from 'lucide-react';
import { useLocale } from '../../i18n';
import { useIntelligentSearch } from '../../hooks/useIntelligentSearch';
import { SearchResults } from './SearchResults';
import { setSearchDraft } from '../../services/searchDraft';

export function GlobalSearch() {
  const { l } = useLocale();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const container = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const location = useLocation();
  const result = useIntelligentSearch(query);
  useEffect(() => {
    const shortcut = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && !event.shiftKey && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        input.current?.focus();
        setOpen(true);
      }
    };
    const outside = (event: PointerEvent) => {
      if (!container.current?.contains(event.target as Node)) setOpen(false);
    };
    window.addEventListener('keydown', shortcut);
    window.addEventListener('pointerdown', outside);
    return () => {
      window.removeEventListener('keydown', shortcut);
      window.removeEventListener('pointerdown', outside);
    };
  }, []);
  useEffect(() => {
    setOpen(false);
  }, [location.key]);
  const remember = () => {
    setOpen(false);
  };
  return (
    <div
      className="global-search-wrap"
      ref={container}
      onBlur={(e) => {
        if (e.relatedTarget && !e.currentTarget.contains(e.relatedTarget as Node)) setOpen(false);
      }}
    >
      <form
        className="global-search"
        role="search"
        onSubmit={(event) => {
          event.preventDefault();
          if (query.trim()) {
            remember();
            setSearchDraft(query);
            navigate('/search');
          }
        }}
      >
        <Search size={17} />
        <input
          ref={input}
          type="search"
          autoComplete="off"
          value={query}
          maxLength={300}
          aria-label={l('البحث الشامل في مسار', 'Recherche globale MASAR')}
          aria-expanded={open && Boolean(query.trim())}
          aria-controls="global-search-suggestions"
          onFocus={() => setOpen(true)}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
          }}
          onKeyDown={(event) => {
            if (event.key === 'Escape') setOpen(false);
            if (event.key === 'ArrowDown') {
              event.preventDefault();
              container.current?.querySelector<HTMLAnchorElement>('.search-result')?.focus();
            }
          }}
          placeholder={l('ابحث في الملفات والموارد…', 'Dossiers, activités, ressources…')}
        />
        {query ? (
          <button
            type="button"
            aria-label={l('مسح البحث', 'Effacer la recherche')}
            onClick={() => {
              setQuery('');
              input.current?.focus();
            }}
          >
            <X size={14} />
          </button>
        ) : (
          <kbd>Ctrl K</kbd>
        )}
      </form>
      {open && query.trim() && (
        <div
          className="instant-search-popover"
          id="global-search-suggestions"
          aria-label={l('اقتراحات البحث', 'Suggestions de recherche')}
        >
          <div className="instant-search-status" role="status">
            <ShieldCheck size={14} />
            {result.pending
              ? l('جارٍ البحث…', 'Recherche…')
              : `${result.results.length} ${l('نتيجة مصرح بها', 'résultats autorisés')}`}
          </div>
          {!result.pending &&
            (result.results.length ? (
              <SearchResults results={result.results} query={query} compact onOpen={remember} />
            ) : (
              <p className="instant-search-empty">
                {l('لا توجد نتائج ضمن نطاقك.', 'Aucun résultat dans votre périmètre.')}
              </p>
            ))}
          <Link
            className="instant-search-all"
            to="/search"
            onClick={() => {
              setSearchDraft(query);
              remember();
            }}
          >
            {l(
              'عرض كل النتائج في المتصفح الذكي',
              'Voir tous les résultats dans Intelligent Browser',
            )}
          </Link>
        </div>
      )}
    </div>
  );
}
