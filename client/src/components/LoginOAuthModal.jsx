import React, { useState } from 'react';
import {
  X,
  KeyRound,
  ShieldCheck,
  Lock,
  UserPlus,
  CheckCircle2,
  ArrowRight
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';

export default function LoginOAuthModal({ isOpen, onClose }) {
  const { demoAccounts, loginWithPassword, loginWithOAuth2Flow, registerAccount } = useAuth();
  const [mode, setMode] = useState('oauth2'); // 'oauth2' | 'login' | 'register'
  const [selectedEmail, setSelectedEmail] = useState('dr.mugisha@medibridge.rw');
  const [selectedProvider, setSelectedProvider] = useState('google-oauth2');
  const [oauthStepLog, setOauthStepLog] = useState(null);
  const [emailInput, setEmailInput] = useState('aline.patient@medibridge.rw');
  const [passwordInput, setPasswordInput] = useState('Password123!');
  const [regForm, setRegForm] = useState({
    fullName: '',
    email: '',
    phone: '+250 788 ',
    password: 'Password123!',
    role: 'PATIENT',
    organization: 'RSSB Member'
  });
  const [errorMsg, setErrorMsg] = useState('');
  const [busy, setBusy] = useState(false);

  if (!isOpen) return null;

  const handleOAuthExecute = async () => {
    setErrorMsg('');
    setBusy(true);
    try {
      const result = await loginWithOAuth2Flow(selectedEmail, selectedProvider);
      setOauthStepLog(result);
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setBusy(false);
    }
  };

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setBusy(true);
    try {
      await loginWithPassword(emailInput, passwordInput);
      onClose();
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setBusy(false);
    }
  };

  const handleRegisterSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setBusy(true);
    try {
      await registerAccount(regForm);
      onClose();
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-2xl w-full overflow-hidden">
        <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <KeyRound className="w-5 h-5 text-teal-400" />
            <div>
              <h2 className="font-bold text-base">
                Authentication & OAuth 2.0 Security Studio (Req 6 & 8)
              </h2>
              <p className="text-xs text-slate-400">
                RFC 6749 OAuth2 Authorization Code + PKCE Flow & Bcrypt/JWT Bearer Authentication
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-slate-800 text-slate-300 hover:text-white cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Mode Tabs */}
        <div className="grid grid-cols-3 border-b border-slate-200 bg-slate-50 text-xs font-bold">
          <button
            onClick={() => { setMode('oauth2'); setErrorMsg(''); }}
            className={`py-3 flex items-center justify-center gap-1.5 border-b-2 transition cursor-pointer ${
              mode === 'oauth2'
                ? 'border-teal-600 text-teal-700 bg-white'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            OAuth 2.0 Code Flow
          </button>
          <button
            onClick={() => { setMode('login'); setErrorMsg(''); }}
            className={`py-3 flex items-center justify-center gap-1.5 border-b-2 transition cursor-pointer ${
              mode === 'login'
                ? 'border-teal-600 text-teal-700 bg-white'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <Lock className="w-4 h-4" />
            Email & Password (JWT)
          </button>
          <button
            onClick={() => { setMode('register'); setErrorMsg(''); }}
            className={`py-3 flex items-center justify-center gap-1.5 border-b-2 transition cursor-pointer ${
              mode === 'register'
                ? 'border-teal-600 text-teal-700 bg-white'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <UserPlus className="w-4 h-4" />
            Register Account
          </button>
        </div>

        <div className="p-6 space-y-4">
          {errorMsg && (
            <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium">
              {errorMsg}
            </div>
          )}

          {mode === 'oauth2' && (
            <div className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Select Identity Provider (IdP)
                  </label>
                  <select
                    value={selectedProvider}
                    onChange={(e) => setSelectedProvider(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white"
                  >
                    <option value="google-oauth2">Google OAuth 2.0 (OpenID Connect)</option>
                    <option value="github-oauth2">GitHub Enterprise OAuth 2.0</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Select Demo User Identity & RBAC Role
                  </label>
                  <select
                    value={selectedEmail}
                    onChange={(e) => setSelectedEmail(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white"
                  >
                    {demoAccounts.map((acc) => (
                      <option key={acc.id} value={acc.email}>
                        [{acc.role_name}] {acc.full_name} ({acc.email})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <button
                onClick={handleOAuthExecute}
                disabled={busy}
                className="w-full py-2.5 px-4 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-sm flex items-center justify-center gap-2 shadow cursor-pointer"
              >
                <span>
                  {busy
                    ? 'Executing OAuth2 Handshake...'
                    : `Execute OAuth 2.0 Authorization Code Exchange (${selectedProvider})`}
                </span>
                <ArrowRight className="w-4 h-4" />
              </button>

              {oauthStepLog && (
                <div className="bg-slate-900 text-slate-100 rounded-xl p-4 space-y-2.5 text-xs font-mono border border-slate-800">
                  <div className="flex items-center justify-between text-teal-400 font-sans font-bold">
                    <span className="flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4" />
                      OAuth 2.0 Handshake Completed Successfully
                    </span>
                    <button
                      onClick={onClose}
                      className="px-2.5 py-1 rounded bg-teal-500 text-slate-950 text-xs font-bold cursor-pointer"
                    >
                      Continue to App
                    </button>
                  </div>
                  <div className="p-2.5 rounded bg-slate-950 border border-slate-800 space-y-1">
                    <div className="text-amber-300 font-semibold">
                      Step 1: POST /api/auth/oauth/authorize
                    </div>
                    <div className="text-slate-300 break-all">
                      authorization_code: <span className="text-emerald-400">{oauthStepLog.codeData.authorizationCode}</span>
                    </div>
                    <div className="text-slate-400">
                      scope: "{oauthStepLog.codeData.scope}" | state: "{oauthStepLog.codeData.state}"
                    </div>
                  </div>
                  <div className="p-2.5 rounded bg-slate-950 border border-slate-800 space-y-1">
                    <div className="text-sky-300 font-semibold">
                      Step 2: POST /api/auth/oauth/token (Grant: authorization_code)
                    </div>
                    <div className="text-slate-300 break-all">
                      id_token.iss: "{oauthStepLog.tokenData.id_token_claims.iss}"
                    </div>
                    <div className="text-slate-300">
                      id_token.sub: "{oauthStepLog.tokenData.id_token_claims.sub}" | role: "{oauthStepLog.tokenData.user.role}"
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {mode === 'login' && (
            <form onSubmit={handlePasswordSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Email Address</label>
                <input
                  type="email"
                  required
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Password (Demo accounts use: <code className="text-teal-700">Password123!</code>)
                </label>
                <input
                  type="password"
                  required
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {demoAccounts.map((acc) => (
                  <button
                    type="button"
                    key={acc.id}
                    onClick={() => {
                      setEmailInput(acc.email);
                      setPasswordInput('Password123!');
                    }}
                    className="text-[11px] px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium cursor-pointer"
                  >
                    Fill {acc.role_name} ({acc.full_name.split(' ')[0]})
                  </button>
                ))}
              </div>
              <button
                type="submit"
                disabled={busy}
                className="w-full py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-sm cursor-pointer"
              >
                {busy ? 'Signing in...' : 'Sign In with JWT Bearer Token'}
              </button>
            </form>
          )}

          {mode === 'register' && (
            <form onSubmit={handleRegisterSubmit} className="space-y-3">
              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Full Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Diane Uwimana"
                    value={regForm.fullName}
                    onChange={(e) => setRegForm({ ...regForm, fullName: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Email</label>
                  <input
                    type="email"
                    required
                    placeholder="diane@example.rw"
                    value={regForm.email}
                    onChange={(e) => setRegForm({ ...regForm, email: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
              </div>
              <div className="grid sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Phone (SMS Alerts)</label>
                  <input
                    type="text"
                    required
                    value={regForm.phone}
                    onChange={(e) => setRegForm({ ...regForm, phone: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">RBAC Role</label>
                  <select
                    value={regForm.role}
                    onChange={(e) => setRegForm({ ...regForm, role: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white"
                  >
                    <option value="PATIENT">PATIENT</option>
                    <option value="DOCTOR">DOCTOR</option>
                    <option value="PHARMACIST">PHARMACIST</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Password</label>
                  <input
                    type="password"
                    required
                    value={regForm.password}
                    onChange={(e) => setRegForm({ ...regForm, password: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={busy}
                className="w-full py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-sm cursor-pointer"
              >
                {busy ? 'Creating Account...' : 'Create Account & Dispatch RabbitMQ Welcome Email'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
