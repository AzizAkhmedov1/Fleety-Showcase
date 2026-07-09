'use client';
import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import axios from 'axios';
import { signIn } from 'next-auth/react';
import { AlertTriangle, ArrowRight, Eye, EyeOff, Loader2, Lock, Mail, } from 'lucide-react';
import AuthSplitLayout from '@/components/auth/AuthSplitLayout';
import ThemeToggle from '@/components/ThemeToggle';
import { authCardClass, authDividerClass, authDividerLineClass, authDividerTextClass, authFooterLinkAccentClass, authInputClass, authInputIconClass, authLabelClass, authPrimaryButtonStandaloneClass, authSocialGridClass, authSubtitleClass, authTitleClass, } from '@/components/auth/authFormStyles';
import { SOCIAL_AUTH_BUTTON_CLASS } from '@/components/auth/socialAuthStyles';
import { applyAxiosCredentialsDefaults, AUTH_COLD_START_FAILED_MESSAGE, AUTH_COLD_START_RETRY_MESSAGE, AUTH_NETWORK_TIMEOUT_MS, completeLoginSession, formatApiError, hasLocalSessionHint, isColdStartRetriableError, isRequestTimeoutError, purgeClientSessionLocally, readPersistedTmsToken, resolveInactiveLogoutNotice, scheduleStaleSessionEviction, setAuthenticating, subscribeColdStartRetry, type ColdStartRetryState, validateTmsSessionWithTimeout, } from '@/lib/api-client';
function LoginPageContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [showInactiveNotice, setShowInactiveNotice] = useState(false);
    const [authForm, setAuthForm] = useState({ email: '', password: '' });
    const [showPassword, setShowPassword] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');
    const [coldStartRetry, setColdStartRetry] = useState<ColdStartRetryState>({
        active: false,
        attempt: 0,
        maxAttempts: 5,
    });
    useEffect(() => {
        return subscribeColdStartRetry(setColdStartRetry);
    }, []);
    useEffect(() => {
        applyAxiosCredentialsDefaults();
        let cancelled = false;
        const inactiveNotice = resolveInactiveLogoutNotice(searchParams.get('reason'));
        if (inactiveNotice) {
            setShowInactiveNotice(true);
            scheduleStaleSessionEviction();
            return;
        }
        setShowInactiveNotice(false);
        if (!hasLocalSessionHint()) {
            return;
        }
        void (async () => {
            const sessionValid = await validateTmsSessionWithTimeout(2500);
            if (cancelled)
                return;
            if (sessionValid && readPersistedTmsToken()) {
                router.replace('/');
                return;
            }
            scheduleStaleSessionEviction();
        })();
        return () => {
            cancelled = true;
        };
    }, [router, searchParams]);
    const handleAuth = async (event: React.FormEvent) => {
        event.preventDefault();
        if (isSubmitting)
            return;
        setErrorMessage('');
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
        try {
            setIsSubmitting(true);
            purgeClientSessionLocally();
            setAuthenticating(true);
            const formData = new URLSearchParams();
            formData.append('username', authForm.email);
            formData.append('password', authForm.password);
            const loginRes = await axios.post(`${apiUrl}/api/login`, formData, {
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                withCredentials: true,
                timeout: AUTH_NETWORK_TIMEOUT_MS,
            });
            const sessionOk = await completeLoginSession(loginRes.data);
            if (!sessionOk) {
                setErrorMessage('Signed in but failed to load workspace profile. Please try again.');
                return;
            }
            router.replace('/');
        }
        catch (err: unknown) {
            if (isColdStartRetriableError(err) || isRequestTimeoutError(err)) {
                setErrorMessage(AUTH_COLD_START_FAILED_MESSAGE);
            }
            else {
                setErrorMessage(formatApiError(err, 'Authentication error. Check credentials.'));
            }
        }
        finally {
            setAuthenticating(false);
            setIsSubmitting(false);
        }
    };
    const showColdStartBanner = coldStartRetry.active && isSubmitting;
    return (<AuthSplitLayout topRight={<ThemeToggle />}>
      <div className={authCardClass}>
        {showInactiveNotice ? (<div className="mb-4 p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-center gap-2 text-amber-500 text-xs font-medium w-full animate-in fade-in zoom-in-95 duration-150">
            <AlertTriangle className="w-4 h-4 shrink-0" aria-hidden="true"/>
            <span>Logged out due to 12 hours of inactivity.</span>
          </div>) : null}
        {showColdStartBanner ? (<div className="mb-4 p-3 bg-sky-500/10 border border-sky-500/20 rounded-xl flex items-center gap-2 text-sky-600 dark:text-sky-400 text-xs font-medium w-full animate-in fade-in zoom-in-95 duration-150">
            <Loader2 className="w-4 h-4 shrink-0 animate-spin" aria-hidden="true"/>
            <span>{AUTH_COLD_START_RETRY_MESSAGE}</span>
          </div>) : errorMessage ? (<div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center gap-2 text-red-500 text-xs font-medium w-full animate-in fade-in zoom-in-95 duration-150">
            <AlertTriangle className="w-4 h-4 shrink-0" aria-hidden="true"/>
            <span>{errorMessage}</span>
          </div>) : null}
        <h1 className={authTitleClass}>Access workspace</h1>
        <p className={authSubtitleClass}>
          Sign in to manage your fleet, loads, and dispatch operations.
        </p>

        <form onSubmit={handleAuth} className="space-y-4">
          <div>
            <label className={authLabelClass}>Admin email</label>
            <div className="relative">
              <Mail size={16} className={authInputIconClass}/>
              <input required type="email" placeholder="Enter your work email" className={authInputClass()} value={authForm.email} disabled={isSubmitting} onChange={(event) => setAuthForm({ ...authForm, email: event.target.value })}/>
            </div>
          </div>
          <div>
            <label className={authLabelClass}>Password</label>
            <div className="relative">
              <Lock size={16} className={authInputIconClass}/>
              <input required type={showPassword ? 'text' : 'password'} placeholder="Enter your password" className={`${authInputClass()} pr-10`} value={authForm.password} disabled={isSubmitting} onChange={(event) => setAuthForm({ ...authForm, password: event.target.value })}/>
              <button type="button" onClick={() => setShowPassword((prev) => !prev)} className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-zinc-400 hover:text-zinc-600 transition-colors" aria-label={showPassword ? 'Hide password' : 'Show password'}>
                {showPassword ? <EyeOff size={16}/> : <Eye size={16}/>}
              </button>
            </div>
          </div>

          <button type="submit" disabled={isSubmitting} className={authPrimaryButtonStandaloneClass}>
            {isSubmitting ? (<>
                <Loader2 size={16} className="animate-spin" aria-hidden/>
                {showColdStartBanner ? 'Waking up server...' : 'Signing in...'}
              </>) : (<>
                Access workspace
                <ArrowRight size={16} aria-hidden="true"/>
              </>)}
          </button>
        </form>

        <div className={authDividerClass}>
          <div className={authDividerLineClass}/>
          <span className={authDividerTextClass}>or sign in with</span>
          <div className={authDividerLineClass}/>
        </div>

        <div className={authSocialGridClass}>
          <button type="button" onClick={() => signIn('google', { callbackUrl: '/' })} className={SOCIAL_AUTH_BUTTON_CLASS}>
            <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            <span className="truncate">Continue with Google</span>
          </button>
        </div>

        <p className="mt-8 text-center text-sm text-zinc-500 dark:text-zinc-500 antialiased [color-scheme:light]">
          New carrier?{' '}
          <a href="/" className={authFooterLinkAccentClass}>
            Register company
          </a>
        </p>
      </div>
    </AuthSplitLayout>);
}
export default function LoginPage() {
    return (<Suspense fallback={<div className="flex h-screen w-screen items-center justify-center bg-[#121212] text-zinc-500">
          <Loader2 className="animate-spin mr-2" size={20} aria-hidden/>
          Loading...
        </div>}>
      <LoginPageContent />
    </Suspense>);
}
