import React, { useState } from 'react';
import { ShieldCheck, Zap, ArrowRight, KeyRound, MailCheck } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { ProfileForm, type ProfileFormValues } from '../components/ProfileForm';

interface AuthPortalProps {
  portalMode: 'consumer' | 'government';
  onSwitchPortal: (mode: 'consumer' | 'government') => void;
}

export function AuthPortal({ portalMode, onSwitchPortal }: AuthPortalProps) {
  const {
    firebaseUser,
    profile,
    isAdmin,
    loginWithGoogle,
    loginWithEmail,
    registerWithEmail,
    resetPassword,
    resendVerification,
    refreshUserVerification,
    saveProfile,
    logout,
  } = useAuth();
  const { showToast } = useToast();

  const [authTab, setAuthTab] = useState<'login' | 'register' | 'reset'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [authError, setAuthError] = useState('');

  // Pending profile setup after Google login or verified email login
  const needsOnboarding = Boolean(firebaseUser && firebaseUser.emailVerified && !profile);
  const needsEmailVerification = Boolean(firebaseUser && !firebaseUser.emailVerified);

  const handleGoogleSignIn = async () => {
    setAuthError('');
    setBusy(true);
    try {
      await loginWithGoogle();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Google Sign-In failed.';
      setAuthError(msg);
    } finally {
      setBusy(false);
    }
  };

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setBusy(true);
    try {
      await loginWithEmail(email, password);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Sign-in failed.';
      if (msg.includes('operation-not-allowed')) {
        setAuthError(
          'Email/Password provider is not enabled yet in your Firebase Console. Use Google Sign-In above for instant access, or enable Email/Password under Firebase Console > Authentication > Sign-in method.'
        );
      } else {
        setAuthError(msg);
      }
    } finally {
      setBusy(false);
    }
  };

  const handleRegisterSubmit = async (values: ProfileFormValues) => {
    setAuthError('');
    if (!email || password.length < 6) {
      setAuthError('Enter a valid email and a password of at least 6 characters.');
      return;
    }
    setBusy(true);
    try {
      await registerWithEmail(email, password, values);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Registration failed.';
      if (msg.includes('operation-not-allowed')) {
        setAuthError(
          'Email/Password registration requires enabling the Email/Password sign-in provider in Firebase Console. Use Google Sign-In for instant onboarding.'
        );
      } else {
        setAuthError(msg);
      }
    } finally {
      setBusy(false);
    }
  };

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setBusy(true);
    try {
      await resetPassword(email);
      showToast('Password reset sent', `Check ${email} for reset instructions.`, 'success');
      setAuthTab('login');
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Unable to send reset email.');
    } finally {
      setBusy(false);
    }
  };

  const handleOnboardingSave = async (values: ProfileFormValues) => {
    await saveProfile(values);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col lg:flex-row">
      {/* Left Architectural Brand & Context Panel */}
      <div className="relative lg:w-[46%] min-h-[280px] lg:min-h-screen overflow-hidden bg-slate-900 flex flex-col justify-between p-8 lg:p-12 text-white">
        <img
          src="/src/assets/images/hero_clean_grid_1795005597344.jpg"
          alt="Rooftop solar arrays and clean energy grid infrastructure"
          referrerPolicy="no-referrer"
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-gradient-to-t from-slate-950/95 via-slate-950/70 to-slate-900/50"
        />

        <div className="relative z-10 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-emerald-700 flex items-center justify-center">
              <Zap className="w-5 h-5 text-white" />
            </div>
            <span className="font-display text-xl font-bold tracking-tight whitespace-nowrap">
              EcoGrid
            </span>
          </div>
          <span className="text-xs font-mono text-slate-300">DL-SJBIT-HK26-GOVP001</span>
        </div>

        <div className="relative z-10 my-8 lg:my-0 max-w-xl">
          <p className="text-xs font-medium text-emerald-300 tracking-wide mb-3">
            Intelligent Energy Ecosystem · Dynamic Taxation Platform
          </p>
          <h1 className="font-display text-3xl lg:text-4xl font-bold leading-tight text-balance mb-4">
            Software-first electricity analytics, dynamic tariffs, and carbon accountability.
          </h1>
          <p className="text-sm text-slate-200 leading-relaxed mb-6">
            Upload utility bills for Gemini multimodal extraction, simulate 10-factor Time-of-Day and carbon taxation policies, forecast demand transparently without IoT hardware, and redeem green conservation offsets.
          </p>
          <div className="grid grid-cols-2 gap-4 pt-5 border-t border-white/15 text-xs text-slate-200">
            <div>
              <p className="font-semibold text-white">Consumer Portal</p>
              <p className="text-slate-300 mt-0.5">Domestic · Commercial · Industrial</p>
            </div>
            <div>
              <p className="font-semibold text-white">Government Portal</p>
              <p className="text-slate-300 mt-0.5">Tariff Policy · Carbon Tax · Advisories</p>
            </div>
          </div>
        </div>

        <div className="relative z-10 text-xs text-slate-300">
          Zero physical sensors required · Verified utility bills &amp; historical ledger analytics
        </div>
      </div>

      {/* Right Authentication / Onboarding Workspace */}
      <div className="flex-1 flex flex-col justify-center p-6 sm:p-10 lg:p-14 overflow-y-auto">
        <div className="max-w-2xl w-full mx-auto">
          {/* Separate Portal Switcher */}
          <div className="flex items-center justify-between gap-4 pb-6 mb-6 border-b border-slate-200">
            <div>
              <h2 className="font-display text-xl font-bold text-slate-900">
                {portalMode === 'consumer'
                  ? 'Consumer Energy Portal'
                  : 'Government & Regulatory Portal'}
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                {portalMode === 'consumer'
                  ? 'Analyze consumption, upload bills, forecast demand, and redeem carbon offsets.'
                  : 'Restricted to authorized government_admin policy administrators.'}
              </p>
            </div>
            <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg shrink-0">
              <button
                type="button"
                onClick={() => onSwitchPortal('consumer')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                  portalMode === 'consumer'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Consumer
              </button>
              <button
                type="button"
                onClick={() => onSwitchPortal('government')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                  portalMode === 'government'
                    ? 'bg-emerald-900 text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Government Admin
              </button>
            </div>
          </div>

          {/* Email Verification Gate */}
          {needsEmailVerification && firebaseUser && (
            <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
              <div className="flex items-center gap-3 text-emerald-800">
                <MailCheck className="w-6 h-6" />
                <h3 className="text-base font-semibold text-slate-900">
                  Verify Your Email Address
                </h3>
              </div>
              <p className="text-sm text-slate-600 leading-relaxed">
                A verification link was sent to <span className="font-medium text-slate-900">{firebaseUser.email}</span>.
                Please confirm your email before saving records to Cloud Firestore.
              </p>
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={async () => {
                    const verified = await refreshUserVerification();
                    if (!verified) {
                      showToast('Not verified yet', 'Click the link in your inbox, then retry.', 'info');
                    }
                  }}
                  className="px-4 py-2 bg-emerald-800 text-white text-sm font-medium rounded-lg hover:bg-emerald-900 cursor-pointer"
                >
                  I have verified my email
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    await resendVerification();
                    showToast('Email resent', 'Check your inbox or spam folder.', 'info');
                  }}
                  className="px-4 py-2 bg-white border border-slate-300 text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-50 cursor-pointer"
                >
                  Resend verification link
                </button>
                <button
                  type="button"
                  onClick={logout}
                  className="px-3 py-2 text-sm text-slate-500 hover:text-slate-800 cursor-pointer"
                >
                  Sign out
                </button>
              </div>
            </div>
          )}

          {/* Post-login Onboarding Form */}
          {needsOnboarding && firebaseUser && (
            <div className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8">
              <div className="flex items-center justify-between gap-4 mb-6">
                <div>
                  <h3 className="font-display text-lg font-bold text-slate-900">
                    Complete Your Energy Consumer Profile
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Signed in as {firebaseUser.email} · Select your category and energy profile to initialize your workspace.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={logout}
                  className="text-xs text-slate-500 hover:text-slate-800 underline cursor-pointer shrink-0"
                >
                  Sign out
                </button>
              </div>
              <ProfileForm
                initialEmail={firebaseUser.email || ''}
                initialName={firebaseUser.displayName || ''}
                submitLabel="Create Profile & Enter Dashboard"
                onSubmit={handleOnboardingSave}
              />
            </div>
          )}

          {/* Authenticated Non-Admin trying to enter Government Portal */}
          {firebaseUser && firebaseUser.emailVerified && portalMode === 'government' && !isAdmin && (
            <div className="bg-white border border-rose-200 rounded-xl p-6 space-y-4">
              <div className="flex items-center gap-3 text-rose-700">
                <ShieldCheck className="w-6 h-6" />
                <h3 className="text-base font-semibold text-slate-900">
                  Government Admin Authorization Required
                </h3>
              </div>
              <p className="text-sm text-slate-600 leading-relaxed">
                Your account (<span className="font-mono text-xs">{firebaseUser.email}</span>) has standard consumer access and cannot access Government/Regulatory administration tools. Role escalation is disabled on the client and enforced by Firestore security rules.
              </p>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => onSwitchPortal('consumer')}
                  className="px-4 py-2 bg-emerald-800 text-white text-sm font-medium rounded-lg hover:bg-emerald-900 cursor-pointer"
                >
                  Go to Consumer Portal
                </button>
                <button
                  type="button"
                  onClick={logout}
                  className="px-4 py-2 border border-slate-300 text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-50 cursor-pointer"
                >
                  Sign Out
                </button>
              </div>
            </div>
          )}

          {/* Unauthenticated Sign-In / Registration UI */}
          {!firebaseUser && (
            <div className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8 space-y-6">
              {portalMode === 'government' ? (
                <div className="space-y-5">
                  <div className="flex items-start gap-3 p-4 bg-slate-50 border border-slate-200 rounded-lg">
                    <ShieldCheck className="w-5 h-5 text-emerald-800 shrink-0 mt-0.5" />
                    <div className="text-xs text-slate-600 leading-relaxed">
                      <p className="font-semibold text-slate-900 mb-1">
                        Authorized Regulatory Access Only
                      </p>
                      Sign in with an authorized government administrator account to configure dynamic electricity tariffs, carbon taxation thresholds, and grid policy advisories.
                    </div>
                  </div>

                  {authError && (
                    <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800">
                      {authError}
                    </div>
                  )}

                  <button
                    type="button"
                    disabled={busy}
                    onClick={handleGoogleSignIn}
                    className="w-full flex items-center justify-center gap-2.5 px-4 py-3 bg-emerald-900 text-white text-sm font-medium rounded-lg hover:bg-emerald-950 disabled:opacity-50 transition-colors cursor-pointer"
                  >
                    <ShieldCheck className="w-4 h-4" />
                    {busy ? 'Authenticating...' : 'Sign In as Government Admin with Google'}
                  </button>

                  <form onSubmit={handleEmailLogin} className="space-y-3 pt-4 border-t border-slate-200">
                    <p className="text-xs font-medium text-slate-700">Or sign in with admin credentials</p>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="Official email address"
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                    />
                    <input
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Password"
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                    />
                    <button
                      type="submit"
                      disabled={busy}
                      className="w-full px-4 py-2.5 bg-slate-900 text-white text-sm font-medium rounded-lg hover:bg-slate-800 cursor-pointer"
                    >
                      Sign In to Regulatory Portal
                    </button>
                  </form>
                </div>
              ) : (
                <>
                  {/* Consumer Auth Mode Tabs */}
                  <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg w-fit">
                    {[
                      { id: 'login' as const, label: 'Sign In' },
                      { id: 'register' as const, label: 'Create Consumer Account' },
                      { id: 'reset' as const, label: 'Reset Password' },
                    ].map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => {
                          setAuthTab(t.id);
                          setAuthError('');
                        }}
                        className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                          authTab === t.id
                            ? 'bg-white text-slate-900 shadow-sm'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>

                  {authError && (
                    <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800 leading-relaxed">
                      {authError}
                    </div>
                  )}

                  {authTab !== 'reset' && (
                    <div>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={handleGoogleSignIn}
                        className="w-full flex items-center justify-center gap-2.5 px-4 py-2.5 bg-emerald-800 text-white text-sm font-medium rounded-lg hover:bg-emerald-900 disabled:opacity-50 transition-colors cursor-pointer"
                      >
                        <span>Continue with Google (Recommended)</span>
                        <ArrowRight className="w-4 h-4" />
                      </button>
                      <div className="relative flex items-center justify-center my-5">
                        <div className="border-t border-slate-200 w-full" />
                        <span className="bg-white px-3 text-xs text-slate-400 whitespace-nowrap">
                          or continue with email
                        </span>
                        <div className="border-t border-slate-200 w-full" />
                      </div>
                    </div>
                  )}

                  {authTab === 'login' && (
                    <form onSubmit={handleEmailLogin} className="space-y-4">
                      <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1">
                          Email Address
                        </label>
                        <input
                          type="email"
                          required
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="you@domain.com"
                          className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-700"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1">
                          Password
                        </label>
                        <input
                          type="password"
                          required
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="••••••••"
                          className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-700"
                        />
                      </div>
                      <button
                        type="submit"
                        disabled={busy}
                        className="w-full px-4 py-2.5 bg-slate-900 text-white text-sm font-medium rounded-lg hover:bg-slate-800 disabled:opacity-50 transition-colors cursor-pointer"
                      >
                        {busy ? 'Signing in...' : 'Sign In to Consumer Portal'}
                      </button>
                    </form>
                  )}

                  {authTab === 'register' && (
                    <div className="space-y-5">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 bg-slate-50 border border-slate-200 rounded-lg">
                        <div>
                          <label className="block text-xs font-medium text-slate-700 mb-1">
                            Registration Email *
                          </label>
                          <input
                            type="email"
                            required
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="consumer@example.com"
                            className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-slate-700 mb-1">
                            Password (min 6 chars) *
                          </label>
                          <input
                            type="password"
                            required
                            minLength={6}
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="Create password"
                            className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg"
                          />
                        </div>
                      </div>

                      <ProfileForm
                        initialEmail={email}
                        submitLabel="Register Consumer Account"
                        onSubmit={handleRegisterSubmit}
                      />
                    </div>
                  )}

                  {authTab === 'reset' && (
                    <form onSubmit={handlePasswordReset} className="space-y-4">
                      <div className="flex items-center gap-2 text-slate-800">
                        <KeyRound className="w-4 h-4 text-emerald-700" />
                        <p className="text-sm font-medium">Reset your account password</p>
                      </div>
                      <input
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="Enter your registered email"
                        className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                      />
                      <button
                        type="submit"
                        disabled={busy}
                        className="w-full px-4 py-2.5 bg-emerald-800 text-white text-sm font-medium rounded-lg hover:bg-emerald-900 cursor-pointer"
                      >
                        Send Password Reset Link
                      </button>
                    </form>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
