import React, { useState, useEffect } from 'react';
import axios from 'axios';
import SignUpModal from './SignUpModal';
import AdminDashboard from '../adminPages/AdminDashboard';
import EmployeeList from '../adminPages/employeeList';
import ClientDashboard from '../clientPage/clientDashboard';
import {
  Button,
  Input,
  Label,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '../components/ui/shadcn-ui.jsx';

export default function App() {
  const [showPassword, setShowPassword] = useState(false);
  const [openSignUp, setOpenSignUp] = useState(false);
  const [openReset, setOpenReset] = useState(false);
  const [route, setRoute] = useState(window.location.hash || '#/');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const onHash = () => setRoute(window.location.hash || '#/');
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 20);
    return () => clearTimeout(t);
  }, []);

  const [authError, setAuthError] = useState('');
  const [loading, setLoading] = useState(false);
  const [resetError, setResetError] = useState('');
  const [resetSuccess, setResetSuccess] = useState('');
  const [resetSubmitting, setResetSubmitting] = useState(false);
  const [resetStep, setResetStep] = useState(1); // 1=request code, 2=verify
  const [resetToken, setResetToken] = useState(() => sessionStorage.getItem('rp_token') || '');
  const [resetExpiresAt, setResetExpiresAt] = useState(null); // unix seconds
  const [expRemaining, setExpRemaining] = useState(0); // seconds
  const [resendCooldown, setResendCooldown] = useState(0); // seconds

  // Helpers for decoding token expiry and formatting timers
  const getExpFromToken = (tok) => {
    try {
      const [p] = String(tok || '').split('.');
      if (!p) return null;
      const pad = '='.repeat((4 - (p.length % 4)) % 4);
      const json = atob(p.replace(/-/g, '+').replace(/_/g, '/') + pad);
      const obj = JSON.parse(json);
      if (obj && (typeof obj.exp === 'number' || typeof obj.exp === 'string')) {
        return Number(obj.exp);
      }
    } catch (e) {}
    return null;
  };
  const formatMMSS = (secs) => {
    const s = Math.max(0, secs | 0);
    const m = Math.floor(s / 60);
    const r = s % 60;
    return `${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`;
  };

  // Countdown for token expiry
  useEffect(() => {
    if (resetExpiresAt) {
      const update = () => {
        const now = Math.floor(Date.now() / 1000);
        setExpRemaining(Math.max(0, resetExpiresAt - now));
      };
      update();
      const iv = setInterval(update, 1000);
      return () => clearInterval(iv);
    } else {
      setExpRemaining(0);
    }
  }, [resetExpiresAt]);

  // Cooldown for resending code
  useEffect(() => {
    if (resendCooldown > 0) {
      const iv = setInterval(() => {
        setResendCooldown((s) => (s > 0 ? s - 1 : 0));
      }, 1000);
      return () => clearInterval(iv);
    }
  }, [resendCooldown]);

  const [user, setUser] = useState(() => {
    // Load user from localStorage on mount
    const stored = localStorage.getItem('user');
    return stored ? JSON.parse(stored) : null;
  });

  useEffect(() => {
    // Require auth for protected routes
    const isProtected = route.startsWith('#/admin') || route.startsWith('#/client');
    if (isProtected && !user) {
      window.location.hash = '#/'
      return;
    }
    // Enforce role-based route
    if (user) {
      const isAdmin = Number(user.role_id) === 1;
      if (!isAdmin && route.startsWith('#/admin')) {
        window.location.hash = '#/client';
      } else if (isAdmin && route.startsWith('#/client')) {
        window.location.hash = '#/admin';
      }
    }
  }, [route, user]);

  // Capture reset token from URL and open reset modal if present
  useEffect(() => {
    const hash = window.location.hash || '';
    // Matches #/reset-password?token=...
    const match = hash.match(/#\/reset-password(?:\?([^#]*))?/);
    if (match) {
      const params = new URLSearchParams(match[1] || '');
      const t = params.get('token');
      if (t) {
        const tok = decodeURIComponent(t);
        setResetToken(tok);
        setResetExpiresAt(getExpFromToken(tok));
        try { sessionStorage.setItem('rp_token', tok); } catch (e) {}
        setOpenReset(true);
        setResetStep(2);
        // Focus the code input after modal opens
        setTimeout(() => {
          const el = document.getElementById('rp_code');
          if (el) el.focus();
        }, 0);
      }
    }
  }, [route]);

  const handleSignOut = () => {
    localStorage.removeItem('user');
    setUser(null);
    window.location.hash = '#/'
  };

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setAuthError('');
    setLoading(true);

    const form = e.currentTarget;
    const email = form.email.value.trim();
    const password = form.password.value;

    try {
      // Determine the correct base URL (avoid duplicating /Accounting in path)
      const origin = window.location.origin;
      const isLocal = origin.includes('localhost') || origin.includes('127.0.0.1');
      const base = isLocal ? 'http://localhost/Accounting' : origin + '/Accounting';
      const apiUrl = `${base}/accounting/api/login.php`;
      console.log('Login attempt - API URL:', apiUrl);
      console.log('Login attempt - Origin:', origin);
      console.log('Login attempt - Base:', base);
      console.log('Login attempt - Email:', email);
      const res = await axios.post(apiUrl, { email, password }, {
        headers: { 'Content-Type': 'application/json' }
      });
      const data = res.data;
      console.log('Login response:', data);
      if (!data.ok) {
        throw new Error(data.message || 'Login failed');
      }
      // Store user data in localStorage
      if (data.user) {
        localStorage.setItem('user', JSON.stringify(data.user));
        setUser(data.user);
      }
      const destination = Number(data.user?.role_id) === 1 ? '#/admin' : '#/client';
      window.location.hash = destination;
    } catch (err) {
      console.error('Login error:', err);
      console.error('Error response:', err.response);
      setAuthError(err.response?.data?.message || err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleResetSubmit = async (e) => {
    e.preventDefault();
    setResetError('');
    setResetSuccess('');
    setResetSubmitting(true);
    const form = e.currentTarget;
    const email = form.email.value.trim();

    try {
      const origin = window.location.origin;
      const isLocal = origin.includes('localhost') || origin.includes('127.0.0.1');
      const base = isLocal ? 'http://localhost/Accounting' : origin + '/Accounting';
      if (resetStep === 1) {
        // Request a reset code via email
        const reqUrl = `${base}/accounting/api/request-reset.php`;
        const res = await axios.post(reqUrl, { email }, { headers: { 'Content-Type': 'application/json' } });
        if (!res.data?.ok) {
          throw new Error(res.data?.message || 'Failed to send code');
        }
        // Store the stateless reset token returned by the API
        if (res.data?.token) {
          setResetToken(res.data.token);
          setResetExpiresAt(getExpFromToken(res.data.token));
          try { sessionStorage.setItem('rp_token', res.data.token); } catch (e) {}
        }
        setResendCooldown(60);
        // Advance to step 2 first, then show success
        setResetStep(2);
        // Focus the code input to ensure visibility
        setTimeout(() => {
          const el = document.getElementById('rp_code');
          if (el) el.focus();
        }, 0);
        setResetSuccess(res.data?.message || 'A verification code has been sent to your email.');
      } else {
        // Verify code and set new password
        const code = form.code.value.trim();
        const password = form.password.value;
        const confirm = form.confirm.value;
        if (!code) {
          setResetError('Verification code is required.');
          setResetSubmitting(false);
          return;
        }
        if (!password) {
          setResetError('New password is required.');
          setResetSubmitting(false);
          return;
        }
        if (password !== confirm) {
          setResetError('Passwords do not match.');
          setResetSubmitting(false);
          return;
        }
        if (!resetToken) {
          setResetError('Reset token missing. Please click "Send code" again to request a new code.');
          setResetSubmitting(false);
          return;
        }
        if (resetExpiresAt && Math.floor(Date.now() / 1000) >= resetExpiresAt) {
          setResetError('Verification code has expired. Please click "Resend code" to get a new code.');
          setResetSubmitting(false);
          return;
        }
        const finUrl = `${base}/accounting/api/reset-password.php`;
        const res = await axios.post(finUrl, { email, code, password, token: resetToken }, { headers: { 'Content-Type': 'application/json' } });
        if (!res.data?.ok) {
          throw new Error(res.data?.message || 'Password reset failed');
        }
        setResetSuccess('Password updated. You can sign in with your new password.');
        setTimeout(() => { setOpenReset(false); setResetSuccess(''); setResetStep(1); }, 1200);
        form.reset();
      }
    } catch (err) {
      setResetError(err.response?.data?.message || err.message || 'Request failed');
    } finally {
      setResetSubmitting(false);
    }
  };
  
  // Allow resending the verification code with a cooldown
  const handleResetResend = async () => {
    if (resendCooldown > 0) return;
    const emailInput = document.getElementById('rp_email');
    const email = (emailInput?.value || '').trim();
    if (!email) {
      setResetError('Email is required to resend the code.');
      return;
    }
    try {
      setResetError('');
      setResetSuccess('');
      const origin = window.location.origin;
      const isLocal = origin.includes('localhost') || origin.includes('127.0.0.1');
      const base = isLocal ? 'http://localhost/Accounting' : origin + '/Accounting';
      const reqUrl = `${base}/accounting/api/request-reset.php`;
      const res = await axios.post(reqUrl, { email }, { headers: { 'Content-Type': 'application/json' } });
      if (!res.data?.ok) {
        throw new Error(res.data?.message || 'Failed to resend code');
      }
      if (res.data?.token) {
        setResetToken(res.data.token);
        setResetExpiresAt(getExpFromToken(res.data.token));
        try { sessionStorage.setItem('rp_token', res.data.token); } catch (e) {}
      }
      setResendCooldown(60);
      setResetSuccess('A new verification code has been sent.');
    } catch (err) {
      setResetError(err.response?.data?.message || err.message || 'Failed to resend code');
    }
  };

  // Render based on route - check specific routes first
  if (route.startsWith('#/admin/employees')) {
    if (!user) {
      return null; // Will redirect in useEffect
    }
    return <EmployeeList user={user} onSignOut={handleSignOut} />;
  }

  if (route.startsWith('#/client')) {
    if (!user) {
      return null; // Will redirect in useEffect
    }
    return <ClientDashboard user={user} onSignOut={handleSignOut} />;
  }

  if (route.startsWith('#/admin')) {
    if (!user) {
      return null; // Will redirect in useEffect
    }
    return <AdminDashboard user={user} onSignOut={handleSignOut} />;
  }

  return (
    <main className="h-screen overflow-hidden bg-slate-50 text-slate-900">
      <div className="mx-auto max-w-7xl h-full px-4 py-4 md:py-0 grid grid-cols-1 md:grid-cols-12 gap-6 md:gap-8 items-center">
        {/* Left: Brand / Description */}
        <section className={`order-1 md:order-none md:col-span-7 flex flex-col items-center text-center transform md:translate-x-5 lg:translate-x-6 transition-all duration-500 ease-out ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'}`}>
          <div className="relative">
            <div className="mx-auto h-20 w-20 rounded-full ring-4 ring-yellow-300 bg-white shadow-card flex items-center justify-center select-none">
              <img src={process.env.PUBLIC_URL + '/logo192.png'} alt="Company Logo" className="h-16 w-16 rounded-full object-cover" />
            </div>
          </div>

          <h1 className="mt-6 text-2xl md:text-3xl font-semibold tracking-tight text-slate-800">Accounting</h1>
          <p className="mt-2 max-w-2xl mx-auto text-xs text-slate-600 leading-relaxed">
            2nd Floor, Ipil Street, Carmen, Cagayan de Oro City, Misamis Oriental, Philippines 9000
          </p>
        </section>

        {/* Right: Sign In Card */}
        <section className="md:col-span-4">
          <Card className={`max-w-sm mx-auto transform md:translate-x-3 lg:translate-x-4 transition-all duration-500 ease-out ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3'}`}>
            <CardHeader>
              <CardTitle>Sign In</CardTitle>
              <div className={`mt-1.5 h-0.5 w-12 bg-primary/80 rounded origin-left transform transition-transform duration-700 ${mounted ? 'scale-x-100' : 'scale-x-0'}`} />
            </CardHeader>
            <CardContent>
              <form action="#" method="POST" className="space-y-4" onSubmit={handleLoginSubmit}>
                {/* Email */}
                <div>
                  <Label htmlFor="email">Email</Label>
                  <div className="relative mt-1">
                    <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-2.5 text-slate-400">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                        <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
                        <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
                      </svg>
                    </span>
                    <Input
                      type="email"
                      id="email"
                      name="email"
                      autoComplete="email"
                      required
                      className="pl-8"
                      placeholder="you@example.com"
                    />
                  </div>
                </div>

                {/* Password with toggle */}
                <div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password">Password</Label>
                  </div>
                  <div className="relative mt-1">
                    <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-2.5 text-slate-400">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M5 8a5 5 0 1110 0v2h1a1 1 0 011 1v7a1 1 0 01-1 1H4a1 1 0 01-1-1v-7a1 1 0 011-1h1V8zm2 0v2h6V8a3 3 0 00-6 0z" clipRule="evenodd" />
                      </svg>
                    </span>
                    <Input
                      type={showPassword ? 'text' : 'password'}
                      id="password"
                      name="password"
                      autoComplete="current-password"
                      required
                      className="pl-8 pr-10"
                      placeholder="••••••••"
                    />
                    <button
                      type="button"
                      aria-label="Toggle password visibility"
                      className="absolute inset-y-0 right-0 mr-1 inline-flex items-center justify-center rounded-md p-1.5 text-slate-500 hover:text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary/40"
                      onClick={() => setShowPassword((v) => !v)}
                    >
                      {showPassword ? (
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.477 0-8.268-2.943-9.542-7a10.042 10.042 0 012.347-3.742M6.634 6.634A9.956 9.956 0 0112 5c4.477 0 8.268 2.943 9.542 7a10.05 10.05 0 01-4.132 5.411M15 12a3 3 0 00-3-3m0 0a3 3 0 013 3m-3-3L3 21" />
                        </svg>
                      ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.477 0 8.268 2.943 9.542 7-1.274 4.057-5.065 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>

                {/* Note: Captcha intentionally omitted */}

                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2">
                    <input id="remember" name="remember" type="checkbox" className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary/30" />
                    <span className="text-xs text-slate-700">Remember me</span>
                  </label>
                  <Button type="button" variant="ghost" size="sm" onClick={() => setOpenReset(true)} className="text-xs font-medium text-primary hover:text-primary-dark">Forgot Password?</Button>
                </div>

                {authError && (
                  <div className="rounded-lg bg-red-50 text-red-700 px-3 py-2 text-xs">
                    {authError}
                  </div>
                )}

                <Button type="submit" disabled={loading} className="w-full">
                  {loading ? 'Signing in…' : 'Login'}
                </Button>
              </form>
            </CardContent>
          </Card>
          <p className="mt-3 max-w-sm mx-auto transform md:translate-x-3 lg:translate-x-4 text-center text-xs text-slate-600">
            Don't have an account?{' '}
            <Button type="button" variant="ghost" size="sm" onClick={() => setOpenSignUp(true)} className="text-primary hover:text-primary-dark px-1">Sign up</Button>
          </p>
        </section>
      </div>

      {/* Reset Password Modal - shadcn-like dialog */}
      <Dialog open={openReset} onOpenChange={setOpenReset}>
        <DialogContent>
          <div className="flex max-h-[85vh] flex-col p-6 sm:p-8">
            <DialogHeader className="p-0">
              <DialogTitle>Reset password</DialogTitle>
              <DialogDescription>
                {resetStep === 1 ? 'Enter your email to receive a verification code.' : 'Enter the code sent to your email and your new password.'}
              </DialogDescription>
            </DialogHeader>

            <form className="mt-6 space-y-4 flex-1 min-h-0 flex flex-col" onSubmit={handleResetSubmit}>
              <div className="flex-1 overflow-y-auto pr-1">
                {resetError && <div className="rounded-lg bg-red-50 text-red-700 px-3 py-2 text-sm">{resetError}</div>}
                {resetSuccess && (
                  <div className="rounded-lg bg-green-50 text-green-700 px-3 py-2 text-sm flex items-start justify-between gap-3">
                    <span>{resetSuccess}</span>
                  </div>
                )}
                <div>
                  <Label htmlFor="rp_email">Email</Label>
                  <Input id="rp_email" name="email" type="email" autoComplete="email" required className="mt-1" placeholder="you@example.com" />
                </div>
                {resetStep === 2 && (
                  <>
                    <div>
                      <Label htmlFor="rp_code">Verification code</Label>
                      <Input id="rp_code" name="code" type="text" inputMode="numeric" pattern="[0-9]*" className="mt-1" placeholder="6-digit code" />
                      <div className="mt-1 flex items-center justify-between">
                        <div className={expRemaining > 0 ? 'text-xs text-slate-600' : 'text-xs text-red-600'}>{expRemaining > 0 ? `Code expires in ${formatMMSS(expRemaining)}` : 'Code expired'}</div>
                        <Button type="button" variant="ghost" size="sm" onClick={handleResetResend} disabled={resendCooldown > 0} className="text-primary hover:text-primary-dark disabled:opacity-50">
                          {resendCooldown > 0 ? `Resend in ${formatMMSS(resendCooldown)}` : 'Resend code'}
                        </Button>
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="rp_password">New password</Label>
                      <Input id="rp_password" name="password" type="password" autoComplete="new-password" className="mt-1" placeholder="••••••••" />
                    </div>
                    <div>
                      <Label htmlFor="rp_confirm">Confirm new password</Label>
                      <Input id="rp_confirm" name="confirm" type="password" autoComplete="new-password" className="mt-1" placeholder="••••••••" />
                    </div>
                  </>
                )}
              </div>
              <DialogFooter className="p-0 mt-3 pt-3 border-t border-slate-200">
                {resetStep === 1 ? (
                  <Button type="submit" disabled={resetSubmitting} className="w-full">
                    {resetSubmitting ? 'Sending…' : 'Send code'}
                  </Button>
                ) : (
                  <div className="flex items-center justify-between w-full">
                    <Button type="button" variant="ghost" onClick={() => { setResetStep(1); setResetSuccess(''); }}>
                      Back
                    </Button>
                    <Button type="submit" disabled={resetSubmitting || expRemaining <= 0}>
                      {resetSubmitting ? 'Updating…' : 'Update password'}
                    </Button>
                  </div>
                )}
              </DialogFooter>
            </form>
          </div>
        </DialogContent>
      </Dialog>

      <SignUpModal open={openSignUp} onClose={() => setOpenSignUp(false)} />
    </main>
  );
}