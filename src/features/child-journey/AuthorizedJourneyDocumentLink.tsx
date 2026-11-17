import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../services/api';
import { useAction } from '../../components/ui';
import { useLocale } from '../../i18n';

export function AuthorizedJourneyDocumentLink({
  caseId,
  versionId,
  path,
  children,
}: {
  caseId: string;
  versionId: string;
  path: string;
  children: ReactNode;
}) {
  const navigate = useNavigate();
  const run = useAction();
  const { l } = useLocale();
  return (
    <a
      href={path}
      className="text-link"
      onClick={(e) => {
        e.preventDefault();
        void run(
          async () => {
            const result = await api<{ path: string }>(
              `/cases/${encodeURIComponent(caseId)}/journey/documents/${encodeURIComponent(versionId)}/open`,
            );
            if (result.path.startsWith('/api/')) window.location.assign(result.path);
            else navigate(result.path);
          },
          l('تم التحقق من الوصول إلى الوثيقة.', 'Accès au document vérifié.'),
        );
      }}
    >
      {children}
    </a>
  );
}
