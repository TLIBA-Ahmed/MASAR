import { Fragment } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpLeft, FileSearch } from 'lucide-react';
import { matchRanges, searchCategories } from '../../services/search';
import type { SearchResult } from '../../services/search';
import type { ResourceKind } from '../../types';
import { useLocale } from '../../i18n';
import { Badge } from '../ui';

export function Highlight({ text, query }: { text: string; query: string }) {
  const ranges = matchRanges(text, query);
  return (
    <>
      {ranges.map((range, i) => {
        const prefix = text.slice(ranges[i - 1]?.end ?? 0, range.start);
        return (
          <Fragment key={i}>
            {prefix}
            <mark>{text.slice(range.start, range.end)}</mark>
          </Fragment>
        );
      })}
      {text.slice(ranges.at(-1)?.end ?? 0)}
    </>
  );
}
export function SearchResults({
  results,
  query,
  compact = false,
  onOpen,
}: {
  results: SearchResult[];
  query: string;
  compact?: boolean;
  onOpen?: () => void;
}) {
  const { l, b, date } = useLocale();
  const categories = Object.keys(searchCategories) as ResourceKind[];
  return (
    <div className={compact ? 'instant-result-groups' : 'search-result-groups'}>
      {categories.map((kind) => {
        const group = results.filter((r) => r.type === kind);
        if (!group.length) return null;
        return (
          <section key={kind} aria-label={b(searchCategories[kind])}>
            <h3 className="search-category-heading">
              {b(searchCategories[kind])}
              <span>{group.length}</span>
            </h3>
            {(compact ? group.slice(0, 3) : group).map((r) => (
              <Fragment key={`${r.type}-${r.id}`}>
                <Link
                  to={r.path}
                  key={`${r.type}-${r.id}`}
                  className="search-result"
                  onClick={onOpen}
                >
                  <span className="soft-icon">
                    <FileSearch size={compact ? 16 : 20} />
                  </span>
                  <div>
                    <div>
                      <h4>
                        <Highlight text={b(r.title)} query={query} />
                      </h4>
                      {r.caseId && <Badge>{r.caseId}</Badge>}
                    </div>
                    <p className="narrative">
                      <Highlight text={b(r.excerpt)} query={query} />
                    </p>
                    {!compact && (
                      <small>
                        {l('المصدر', 'Source')} · {r.id}
                        {r.date ? ` · ${date(r.date)}` : ''}
                      </small>
                    )}
                  </div>
                  <ArrowUpLeft className="direction-arrow" size={16} />
                </Link>
                {!compact && r.caseId && (
                  <Link
                    className="search-result-journey text-link"
                    to={`/child-journey/${encodeURIComponent(r.caseId)}`}
                    onClick={onOpen}
                  >
                    {l('متابعة مسار الطفل', "Suivi du parcours de l'enfant")}
                    <ArrowUpLeft size={13} />
                  </Link>
                )}
              </Fragment>
            ))}
          </section>
        );
      })}
    </div>
  );
}
