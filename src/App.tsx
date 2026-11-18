import React, { useState } from 'react';
import {
  Award,
  Calculator,
  FileUp,
  History,
  LayoutDashboard,
  LogOut,
  Megaphone,
  Menu,
  PlusCircle,
  ShieldCheck,
  Sliders,
  TrendingUp,
  UserCog,
  X,
  Zap,
} from 'lucide-react';
import { ErrorBoundary } from './components/ErrorBoundary';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ToastProvider } from './contexts/ToastContext';
import { AuthPortal } from './pages/AuthPortal';
import { GovDashboardPage } from './pages/admin/GovDashboardPage';
import { PolicyAdvisoryPage } from './pages/admin/PolicyAdvisoryPage';
import { TariffPolicyManagerPage } from './pages/admin/TariffPolicyManagerPage';
import { BillUploadPage } from './pages/consumer/BillUploadPage';
import { CarbonRewardsPage } from './pages/consumer/CarbonRewardsPage';
import { DashboardPage } from './pages/consumer/DashboardPage';
import { ForecastingPage } from './pages/consumer/ForecastingPage';
import { HistoryPage } from './pages/consumer/HistoryPage';
import { ManualEntryPage } from './pages/consumer/ManualEntryPage';
import { ProfilePage } from './pages/consumer/ProfilePage';
import { TariffSimulatorPage } from './pages/consumer/TariffSimulatorPage';

function WorkspaceShell() {
  const { authReady, firebaseUser, profile, profileLoading, isAdmin, logout } = useAuth();

  const [portalMode, setPortalMode] = useState<'consumer' | 'government'>('consumer');
  const [consumerPage, setConsumerPage] = useState<string>('dashboard');
  const [adminPage, setAdminPage] = useState<string>('gov-dashboard');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  if (!authReady || (firebaseUser && profileLoading)) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="w-full max-w-md bg-white border border-slate-200 rounded-xl p-8 space-y-4 animate-pulse">
          <div className="h-5 bg-slate-200 rounded w-1/2" />
          <div className="h-4 bg-slate-100 rounded w-3/4" />
          <div className="h-24 bg-slate-100 rounded" />
        </div>
      </div>
    );
  }

  // Gate: require signed-in + verified email + completed profile (unless admin in gov portal)
  const isAuthorizedGov = Boolean(firebaseUser && firebaseUser.emailVerified && isAdmin);
  const canEnterConsumer = Boolean(firebaseUser && firebaseUser.emailVerified && profile);

  if (
    !firebaseUser ||
    !firebaseUser.emailVerified ||
    (portalMode === 'consumer' && !canEnterConsumer) ||
    (portalMode === 'government' && !isAuthorizedGov)
  ) {
    return <AuthPortal portalMode={portalMode} onSwitchPortal={setPortalMode} />;
  }

  const consumerNav = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'bill-upload', label: 'Bill Upload (AI)', icon: FileUp },
    { id: 'manual-entry', label: 'Log Consumption', icon: PlusCircle },
    { id: 'history', label: 'History Ledger', icon: History },
    { id: 'forecasting', label: 'Demand Forecast', icon: TrendingUp },
    { id: 'tariff-engine', label: 'Tariff Engine', icon: Calculator },
    { id: 'carbon-rewards', label: 'Carbon & Offsets', icon: Award },
    { id: 'profile', label: 'Energy Profile', icon: UserCog },
  ];

  const adminNav = [
    { id: 'gov-dashboard', label: 'Grid Overview', icon: ShieldCheck },
    { id: 'tariff-policies', label: 'Tariff & Tax Rules', icon: Sliders },
    { id: 'advisories', label: 'Policy Advisories', icon: Megaphone },
  ];

  const activeNav = portalMode === 'government' ? adminNav : consumerNav;
  const activePageId = portalMode === 'government' ? adminPage : consumerPage;
  const activeNavLabel = activeNav.find((n) => n.id === activePageId)?.label || 'Overview';

  const handleSelectNav = (id: string) => {
    if (portalMode === 'government') setAdminPage(id);
    else setConsumerPage(id);
    setMobileMenuOpen(false);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex lg:w-64 lg:flex-col lg:fixed lg:inset-y-0 bg-white border-r border-slate-200">
        <div className="h-16 px-5 flex items-center gap-2.5 border-b border-slate-200">
          <div className="w-8 h-8 rounded-lg bg-emerald-800 flex items-center justify-center shrink-0">
            <Zap className="w-4 h-4 text-white" />
          </div>
          <span className="font-display text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap">
            EcoGrid
          </span>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {activeNav.map((item) => {
            const Icon = item.icon;
            const active = activePageId === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleSelectNav(item.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                  active
                    ? 'bg-emerald-900 text-white'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-200 space-y-3">
          {isAdmin && (
            <button
              type="button"
              onClick={() => {
                const next = portalMode === 'government' ? 'consumer' : 'government';
                if (next === 'consumer' && !profile) {
                  setPortalMode('consumer');
                } else {
                  setPortalMode(next);
                }
              }}
              className="w-full px-3 py-2 text-xs font-medium bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg transition-colors cursor-pointer text-left"
            >
              {portalMode === 'government'
                ? 'Switch to Consumer Portal'
                : 'Open Government Admin Portal'}
            </button>
          )}
          <div className="text-xs">
            <p className="font-semibold text-slate-900 truncate">
              {profile?.fullName || firebaseUser.displayName || 'Administrator'}
            </p>
            <p className="text-slate-500 truncate">
              {portalMode === 'government'
                ? 'government_admin'
                : `${profile?.category || 'consumer'} · ${profile?.discom || ''}`}
            </p>
          </div>
          <button
            type="button"
            onClick={logout}
            className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-slate-600 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-slate-950/40"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div className="relative w-72 max-w-[85vw] bg-white h-full flex flex-col border-r border-slate-200 z-10">
            <div className="h-14 px-4 flex items-center justify-between border-b border-slate-200">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-emerald-800 flex items-center justify-center">
                  <Zap className="w-4 h-4 text-white" />
                </div>
                <span className="font-display text-base font-bold text-slate-900">EcoGrid</span>
              </div>
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                aria-label="Close navigation menu"
                className="p-2 text-slate-500 hover:text-slate-900"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
              {activeNav.map((item) => {
                const Icon = item.icon;
                const active = activePageId === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleSelectNav(item.id)}
                    className={`w-full flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium ${
                      active ? 'bg-emerald-900 text-white' : 'text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </nav>
            <div className="p-4 border-t border-slate-200 space-y-2">
              {isAdmin && (
                <button
                  type="button"
                  onClick={() => {
                    setPortalMode(portalMode === 'government' ? 'consumer' : 'government');
                    setMobileMenuOpen(false);
                  }}
                  className="w-full px-3 py-2 text-xs font-medium bg-slate-100 text-slate-800 rounded-lg text-left"
                >
                  {portalMode === 'government'
                    ? 'Switch to Consumer Portal'
                    : 'Open Government Admin Portal'}
                </button>
              )}
              <button
                type="button"
                onClick={logout}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-rose-700 bg-rose-50 rounded-lg"
              >
                <LogOut className="w-4 h-4" />
                <span>Sign Out</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content Viewport */}
      <div className="flex-1 lg:pl-64 flex flex-col min-w-0">
        <header className="h-14 lg:h-16 bg-white border-b border-slate-200 px-4 sm:px-6 flex items-center justify-between gap-4 sticky top-0 z-30">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Open navigation menu"
              className="lg:hidden p-2 -ml-2 text-slate-600 hover:text-slate-900 rounded-lg"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="text-xs text-slate-500 truncate">
              <span>{portalMode === 'government' ? 'Government Portal' : 'Consumer Portal'}</span>
              <span className="mx-1.5" aria-hidden="true">/</span>
              <span className="font-semibold text-slate-900">{activeNavLabel}</span>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {portalMode === 'consumer' ? (
              <button
                type="button"
                onClick={() => setConsumerPage('manual-entry')}
                className="px-3.5 py-2 bg-emerald-800 text-white text-xs font-medium rounded-lg hover:bg-emerald-900 transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                Log Energy
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setAdminPage('tariff-policies')}
                className="px-3.5 py-2 bg-emerald-800 text-white text-xs font-medium rounded-lg hover:bg-emerald-900 transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                Edit Tariff Rules
              </button>
            )}
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          {portalMode === 'consumer' && (
            <>
              {consumerPage === 'dashboard' && <DashboardPage onNavigate={setConsumerPage} />}
              {consumerPage === 'bill-upload' && <BillUploadPage />}
              {consumerPage === 'manual-entry' && <ManualEntryPage />}
              {consumerPage === 'history' && <HistoryPage />}
              {consumerPage === 'forecasting' && <ForecastingPage />}
              {consumerPage === 'tariff-engine' && <TariffSimulatorPage />}
              {consumerPage === 'carbon-rewards' && <CarbonRewardsPage />}
              {consumerPage === 'profile' && <ProfilePage />}
            </>
          )}

          {portalMode === 'government' && isAdmin && (
            <>
              {adminPage === 'gov-dashboard' && <GovDashboardPage />}
              {adminPage === 'tariff-policies' && <TariffPolicyManagerPage />}
              {adminPage === 'advisories' && <PolicyAdvisoryPage />}
            </>
          )}
        </main>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <ToastProvider>
        <AuthProvider>
          <WorkspaceShell />
        </AuthProvider>
      </ToastProvider>
    </ErrorBoundary>
  );
}
