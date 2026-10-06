import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(() => localStorage.getItem('medibridge_token') || null);
  const [authMechanism, setAuthMechanism] = useState(() => localStorage.getItem('medibridge_auth_mech') || 'OAUTH2_AUTHORIZATION_CODE (GOOGLE)');
  const [demoAccounts, setDemoAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback((title, message, type = 'info') => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [{ id, title, message, type }, ...prev.slice(0, 4)]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 5500);
  }, []);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const authFetch = useCallback(
    async (url, options = {}) => {
      const headers = {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(options.headers || {})
      };
      const res = await fetch(url, { ...options, headers });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const err = new Error(data.message || data.error || 'Request failed');
        err.status = res.status;
        err.data = data;
        throw err;
      }
      return data;
    },
    [token]
  );

  // Load demo accounts & auto-authenticate default account if none active
  useEffect(() => {
    let mounted = true;
    async function initAuth() {
      try {
        const accRes = await fetch('/api/auth/demo-accounts');
        const accData = await accRes.json();
        if (mounted && accData.accounts) {
          setDemoAccounts(accData.accounts);
        }

        if (token) {
          const meRes = await fetch('/api/auth/me', {
            headers: { Authorization: `Bearer ${token}` }
          });
          if (meRes.ok) {
            const meData = await meRes.json();
            if (mounted) {
              setUser(meData.user);
              setLoading(false);
              return;
            }
          }
        }

        // Default auto-login via OAuth2 Authorization Code exchange as Doctor or Patient so UI is ready immediately
        const authRes = await fetch('/api/auth/oauth/authorize', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            provider: 'google-oauth2',
            email: 'aline.patient@medibridge.rw'
          })
        });
        const authCodeData = await authRes.json();
        const tokenRes = await fetch('/api/auth/oauth/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            grantType: 'authorization_code',
            code: authCodeData.authorizationCode,
            provider: 'google-oauth2'
          })
        });
        const tokenData = await tokenRes.json();
        if (mounted && tokenData.token) {
          localStorage.setItem('medibridge_token', tokenData.token);
          localStorage.setItem('medibridge_auth_mech', tokenData.authMechanism);
          setToken(tokenData.token);
          setAuthMechanism(tokenData.authMechanism);
          setUser(tokenData.user);
        }
      } catch (err) {
        console.error('Auth initialization error:', err);
      } finally {
        if (mounted) setLoading(false);
      }
    }
    initAuth();
    return () => {
      mounted = false;
    };
  }, []);

  const loginWithPassword = async (email, password) => {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Login failed');

    localStorage.setItem('medibridge_token', data.token);
    localStorage.setItem('medibridge_auth_mech', data.authMechanism);
    setToken(data.token);
    setAuthMechanism(data.authMechanism);
    setUser(data.user);
    addToast(
      `Signed in as ${data.user.fullName}`,
      `RBAC Role: ${data.user.role} (${data.authMechanism})`,
      'success'
    );
    return data;
  };

  const loginWithOAuth2Flow = async (email, provider = 'google-oauth2') => {
    // Step 1: Request RFC 6749 Authorization Code
    const step1 = await fetch('/api/auth/oauth/authorize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        provider,
        email,
        clientId: 'medibridge-web-client-rw',
        scope: 'openid profile email clinical.role'
      })
    });
    const codeData = await step1.json();
    if (!step1.ok) throw new Error(codeData.error || 'OAuth2 authorize step failed');

    // Step 2: Exchange Authorization Code for Access Token & ID Token
    const step2 = await fetch('/api/auth/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grantType: 'authorization_code',
        code: codeData.authorizationCode,
        provider
      })
    });
    const tokenData = await step2.json();
    if (!step2.ok) throw new Error(tokenData.error || 'OAuth2 token exchange failed');

    localStorage.setItem('medibridge_token', tokenData.token);
    localStorage.setItem('medibridge_auth_mech', tokenData.authMechanism);
    setToken(tokenData.token);
    setAuthMechanism(tokenData.authMechanism);
    setUser(tokenData.user);
    addToast(
      `OAuth 2.0 Handshake Complete`,
      `Authenticated ${tokenData.user.fullName} [${tokenData.user.role}] via ${provider}`,
      'success'
    );
    return { codeData, tokenData };
  };

  const registerAccount = async (payload) => {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Registration failed');

    localStorage.setItem('medibridge_token', data.token);
    localStorage.setItem('medibridge_auth_mech', data.authMechanism);
    setToken(data.token);
    setAuthMechanism(data.authMechanism);
    setUser(data.user);
    addToast('Account Created!', `Welcome ${data.user.fullName} (${data.user.role})`, 'success');
    return data;
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        authMechanism,
        demoAccounts,
        loading,
        authFetch,
        loginWithPassword,
        loginWithOAuth2Flow,
        registerAccount,
        toasts,
        addToast,
        removeToast
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
