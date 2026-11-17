import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../services/api';
import { useAction } from '../../components/ui';

export function AuthorizedCaseLink({
  caseId,
  children,
  className,
}: {
  caseId: string;
  children: ReactNode;
  className?: string;
}) {
  const navigate = useNavigate(),
    run = useAction();
  return (
    <a
      className={className}
      href={`/cases/${caseId}`}
      onClick={(e) => {
        e.preventDefault();
        void run(async () => {
          await api(`/cases/${encodeURIComponent(caseId)}/access`);
          navigate(`/cases/${caseId}`);
        });
      }}
    >
      {children}
    </a>
  );
}
