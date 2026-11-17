import { Component, lazy, Suspense, useEffect } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { useAppStore } from '../stores/app';
import { useLocale } from '../i18n';
import { ToastProvider } from '../components/ui';
import { Shell } from '../components/layout/Shell';
import { Login } from '../features/authentication/Login';
import { GovernorateWelcomePage } from '../features/authentication/GovernorateWelcomePage';
import {
  EntryLanding,
  RequireCaseAccess,
  RequireSession,
  SessionCentrePicker,
} from '../features/authentication/AuthGuards';
import { features } from '../config/features';
const AssignedChildren = lazy(() =>
  import('../features/assigned-children/AssignedChildren').then((m) => ({
    default: m.AssignedChildren,
  })),
);
const Deferred = () => (
  <div className="panel ai-answer">
    ميزة مؤجلة بعد النموذج التجريبي / Fonction reportée après le PoC.
  </div>
);
const ChildJourneyPage = lazy(() =>
  import('../features/child-journey/ChildJourneyPage').then((m) => ({
    default: m.ChildJourneyPage,
  })),
);
const Dashboard = lazy(() =>
  import('../features/dashboard/Dashboard').then((m) => ({ default: m.Dashboard })),
);
const CaseList = lazy(() =>
  import('../features/cases/CaseList').then((m) => ({ default: m.CaseList })),
);
const CaseDetail = lazy(() =>
  import('../features/cases/CaseDetail').then((m) => ({ default: m.CaseDetail })),
);
const Documents = lazy(() =>
  import('../features/documents/Documents').then((m) => ({ default: m.Documents })),
);
const FormPage = lazy(() =>
  import('../features/documents/Documents').then((m) => ({ default: m.FormPage })),
);
const Integration = lazy(() =>
  import('../features/integration/Integration').then((m) => ({ default: m.Integration })),
);
const Library = lazy(() =>
  import('../features/activity-library/Library').then((m) => ({ default: m.Library })),
);
const Recommendations = lazy(() =>
  import('../features/recommendations/Recommendations').then((m) => ({
    default: m.Recommendations,
  })),
);
const Sessions = lazy(() =>
  import('../features/activities/Sessions').then((m) => ({ default: m.Sessions })),
);
const IntelligentSearch = lazy(() =>
  import('../features/intelligent-browser/Search').then((m) => ({ default: m.IntelligentSearch })),
);
const ProfessionalNetwork = lazy(() =>
  import('../features/professional-network/Network').then((m) => ({
    default: m.ProfessionalNetwork,
  })),
);
const Calendar = lazy(() =>
  import('../features/calendar/Calendar').then((m) => ({ default: m.Calendar })),
);
const Tasks = lazy(() =>
  import('../features/calendar/Calendar').then((m) => ({ default: m.Tasks })),
);
const Journey = lazy(() =>
  import('../features/journey/Journey').then((m) => ({ default: m.Journey })),
);
const Supervision = lazy(() =>
  import('../features/journey/Journey').then((m) => ({ default: m.Supervision })),
);
const NationalDashboard = lazy(() =>
  import('../features/national-dashboard/National').then((m) => ({ default: m.NationalDashboard })),
);
const Professionals = lazy(() =>
  import('../features/professionals/Professionals').then((m) => ({ default: m.Professionals })),
);
const Settings = lazy(() =>
  import('../features/settings/Settings').then((m) => ({ default: m.Settings })),
);
const Interventions = lazy(() =>
  import('../features/interventions/Interventions').then((m) => ({ default: m.Interventions })),
);
class ErrorBoundary extends Component<{ children: ReactNode }, { error: boolean }> {
  state = { error: false };
  static getDerivedStateFromError() {
    return { error: true };
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('MASAR UI error', error.message, info.componentStack);
  }
  render() {
    return this.state.error ? (
      <div className="fatal-error">
        <img src="/masar.svg" alt="MASAR" />
        <h1>تعذّر عرض الصفحة / Impossible d’afficher la page</h1>
        <p>البيانات المحفوظة باقية في المتصفح. / Les données enregistrées sont conservées.</p>
        <button className="button primary" onClick={() => window.location.reload()}>
          إعادة المحاولة / Réessayer
        </button>
      </div>
    ) : (
      this.props.children
    );
  }
}
export function App() {
  const { initialize, ready, session, refresh } = useAppStore();
  const { t } = useLocale();
  useEffect(() => {
    void initialize();
  }, [initialize]);
  useEffect(() => {
    if (!session) return;
    const timer = window.setInterval(() => {
      if (!document.hidden) void refresh();
    }, 5000);
    const focus = () => void refresh();
    window.addEventListener('focus', focus);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', focus);
    };
  }, [session, refresh]);
  const loader = (
    <div className="app-loader">
      <img src="/masar.svg" alt="MASAR" />
      <div className="loading-line" />
      <p>{t('loading')}</p>
    </div>
  );
  return (
    <ErrorBoundary>
      <ToastProvider>
        {!ready ? (
          loader
        ) : (
          <BrowserRouter>
            <Suspense fallback={loader}>
              <Routes>
                <Route path="/" element={session ? <EntryLanding /> : <GovernorateWelcomePage />} />
                <Route path="/login" element={session ? <EntryLanding afterLogin /> : <Login />} />
                <Route element={<RequireSession />}>
                  <Route path="/select-centre" element={<SessionCentrePicker />} />
                  <Route element={<Shell />}>
                    <Route path="assigned-children" element={<AssignedChildren />} />
                    <Route path="child-journey" element={<ChildJourneyPage />} />
                    <Route element={<RequireCaseAccess />}>
                      <Route path="child-journey/:caseId" element={<ChildJourneyPage />} />
                      <Route path="cases/:caseId" element={<CaseDetail />} />
                      <Route path="documents/:caseId/:formId" element={<FormPage />} />
                    </Route>
                    <Route path="dashboard" element={<Dashboard />} />
                    <Route path="cases" element={<CaseList />} />
                    <Route path="documents" element={<Documents />} />
                    <Route path="interviews" element={<Documents filter="interviews" />} />
                    <Route path="assessments" element={<Documents filter="assessments" />} />
                    <Route path="projects" element={<Documents filter="projects" />} />
                    <Route
                      path="integration"
                      element={features.laterLifecycle ? <Integration /> : <Deferred />}
                    />
                    <Route path="library" element={<Library />} />
                    <Route path="recommendations" element={<Recommendations />} />
                    <Route path="sessions" element={<Sessions />} />
                    <Route path="attendance" element={<Sessions attendance />} />
                    <Route path="search" element={<IntelligentSearch />} />
                    <Route
                      path="network"
                      element={
                        features.professionalNetwork ? <ProfessionalNetwork /> : <Deferred />
                      }
                    />
                    <Route path="calendar" element={<Calendar />} />
                    <Route path="tasks" element={<Tasks />} />
                    <Route path="journey" element={<Journey />} />
                    <Route path="supervision" element={<Supervision />} />
                    <Route
                      path="national"
                      element={features.laterLifecycle ? <NationalDashboard /> : <Deferred />}
                    />
                    <Route path="reports" element={<NationalDashboard local />} />
                    <Route path="professionals" element={<Professionals />} />
                    <Route path="settings" element={<Settings />} />
                    <Route path="interventions" element={<Interventions />} />
                    <Route path="*" element={<Navigate to="/dashboard" replace />} />
                  </Route>
                </Route>
              </Routes>
            </Suspense>
          </BrowserRouter>
        )}
      </ToastProvider>
    </ErrorBoundary>
  );
}
