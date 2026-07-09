'use client';
import React, { useState, useEffect, useLayoutEffect, useRef, useMemo, useCallback } from 'react';
import dynamic from 'next/dynamic';
import axios from 'axios';
import { UploadCloud, FileText, MapPin, DollarSign, Navigation, Activity, CheckCircle, Clock, Trash2, Users, Truck, Link, BarChart3, FolderOpen, X, Plus, UserCircle, Edit3, Save, LogOut, Calculator, Droplet, LayoutList, Calendar, Package, Sun, Moon, Building2, Mail, AlertTriangle, Phone, Paperclip, Radio, Plug, Wallet, Eye, EyeOff, Loader2, Settings, Lock, ArrowRight, Wrench, ChevronDown, Menu, RefreshCw } from 'lucide-react';
const LOAD_ENTRY_FIELDSET_CLASS = 'border-0 p-0 m-0 min-w-0 disabled:opacity-100 [&_input:disabled]:cursor-not-allowed [&_input:disabled]:opacity-90 [&_input:disabled]:bg-zinc-50/50 dark:[&_input:disabled]:bg-zinc-900/30 [&_select:disabled]:cursor-not-allowed [&_select:disabled]:opacity-90 [&_select:disabled]:bg-zinc-50/50 dark:[&_select:disabled]:bg-zinc-900/30 [&_textarea:disabled]:cursor-not-allowed [&_textarea:disabled]:opacity-90 [&_textarea:disabled]:bg-zinc-50/50 dark:[&_textarea:disabled]:bg-zinc-900/30';
const US_STATES = ["AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA", "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD", "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ", "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC", "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY"];
import toast, { Toaster } from 'react-hot-toast';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { DashboardContext } from '@/contexts/DashboardContext';
import type { LoadStatusFilter } from '@/components/dashboard/load-management-types';
import { DASHBOARD_ROUTES, getDashboardPageTitle, isDashboardPath, isFleetPath, } from '@/lib/dashboard-routes';
const LOAD_STATUS_QUERY_MAP: Record<string, LoadStatusFilter> = {
    all: 'all',
    active: 'in_transit',
    unassigned: 'unassigned',
    booked: 'booked',
    in_transit: 'in_transit',
    delivered: 'delivered',
    delayed: 'delayed',
};
import { useTMSStore } from '@/store/useTMSStore';
import { useLoadTimeFilterStore } from '@/store/useLoadTimeFilterStore';
import { useLoadTimeFilterHydrated } from '@/hooks/useLoadTimeFilterHydrated';
import { filterPowerUnits } from '@/lib/trailer-metadata';
import { extractCleanDate } from '@/lib/load-dates';
import { isRateLimitError } from '@/lib/api-errors';
import { LoadCrmBrokerLink, LoadDispatcherCommissionFields, } from '@/components/operations/NewLoadModal';
import { FORM_LABEL_CLASS, PANEL_TITLE_CLASS, formatTitleCaseLabel } from '@/lib/display-labels';
import { getPlanningWeekWindow } from '@/lib/planning-timeline';
import { detectFleetWindowPreset, FLEET_FINANCIALS_WINDOW_PRESETS, FLEET_WINDOW_PRESETS, getPresetRange, LOAD_MANAGEMENT_DATE_PRESETS, type FleetWindowPreset, type LoadManagementDatePreset, } from '@/lib/fleet-financial-metrics';
import DateFilterDropdown, { resolveDateFilterButtonLabel, } from '@/components/ui/DateFilterDropdown';
import Sidebar, { MobileNavDrawer } from '@/components/layout/Sidebar';
import FleetyIcon from '@/components/icons/FleetyIcon';
import ProfileDrawerShell from '@/components/ui/ProfileDrawerShell';
import GlobalSearchDropdown from '@/components/GlobalSearchDropdown';
import ThemeToggle from '@/components/ThemeToggle';
import type { RegisterWizardPayload } from '@/components/auth/RegisterWizard';
import { authCardClass, authTitleClass, authSubtitleClass, authLabelClass, authInputClass, authInputIconClass, authPrimaryButtonStandaloneClass, authDividerClass, authDividerLineClass, authDividerTextClass, authSocialGridClass, authFooterLinkAccentClass, } from '@/components/auth/authFormStyles';
import { SOCIAL_AUTH_BUTTON_CLASS } from '@/components/auth/socialAuthStyles';
import { useSession, signIn, signOut } from "next-auth/react";
import { useTMSData } from '@/hooks/useTMSData';
import { setUnauthorizedHandler, hasValidTmsToken, hasLocalSessionHint, readPersistedTmsToken, completeLoginSession, persistTmsSession, clearTmsToken, validateTmsSessionWithTimeout, applyAxiosCredentialsDefaults, performTmsLogout, TMS_TOKEN_UPDATED_EVENT, getTmsSessionRoles, formatApiError, purgeClientSessionLocally, setAuthenticating, AUTH_NETWORK_TIMEOUT_MS, AUTH_COLD_START_MESSAGE, isRequestTimeoutError } from '@/lib/api-client';
import { canViewLoadNetProfit, canViewLoadOperationalFinancials } from '@/lib/rbac';
import { getUserId } from '@/lib/auth';
import type { TeamDispatcher, TruckRecord, LoadRecord, LoadDocumentRecord } from '@/lib/tms-api';
import { createEmptyStagedLoad, mapLoadRecordToStagedLoad, buildLoadCreatePayload, inferInitialStatusFromPickupDate, type LoadInitialStatus, } from '@/lib/load-entry-form';
import { compileAppointmentWindowFromStop } from '@/lib/load-appointment-window';
import { loadDocumentDisplayName, resolveLoadDocumentUrl } from '@/lib/load-documents';
import { matchesLoadSearchQuery, matchesTruckSearchQuery, } from '@/lib/global-search';
import { normalizeTruckStatus, } from '@/lib/fleet-truck-status';
import { type UpdateTruckPayload } from '@/components/fleet/TrailerStatusBoard';
import { getExpirationDisplay, isExpirationFieldLabel } from '@/lib/document-expiration';
const PULSE_PANEL_CLASS = 'animate-pulse bg-zinc-100 dark:bg-zinc-800 rounded-xl';
const SettleModal = dynamic(() => import('@/components/modals/SettleModal'), { ssr: false });
const UploadRevisionModal = dynamic(() => import('@/components/UploadRevisionModal'), { ssr: false });
const OnboardDriverModal = dynamic(() => import('@/components/modals/OnboardDriverModal'), { ssr: false });
const RegisterEquipmentModal = dynamic(() => import('@/components/modals/RegisterEquipmentModal'), {
    ssr: false,
});
const DriverDetailModal = dynamic(() => import('@/components/modals/DriverDetailModal'), { ssr: false });
const TruckDetailModal = dynamic(() => import('@/components/modals/TruckDetailModal'), { ssr: false });
const RegisterWizard = dynamic(() => import('@/components/auth/RegisterWizard'), {
    ssr: false,
    loading: () => <div className={`${PULSE_PANEL_CLASS} h-[420px] w-full max-w-md mx-auto`}/>,
});
const AuthSplitLayout = dynamic(() => import('@/components/auth/AuthSplitLayout'), {
    ssr: false,
    loading: () => <div className="min-h-screen w-full animate-pulse bg-zinc-100 dark:bg-zinc-900"/>,
});
function FleetCustomFieldValue({ label, value }: {
    label: string;
    value: string;
}) {
    if (isExpirationFieldLabel(label)) {
        const display = getExpirationDisplay(value);
        if (display.urgency !== 'unknown') {
            return (<span className={`inline-flex items-center justify-end rounded px-2 py-0.5 text-xs font-bold ml-auto ${display.badgeClass}`}>
          {display.formattedDate ?? value}
        </span>);
        }
    }
    return <p className="font-bold text-zinc-900 dark:text-white text-right">{String(value)}</p>;
}
export default function DashboardLayout({ children }: {
    children: React.ReactNode;
}) {
    const { data: session, status } = useSession();
    const [token, setToken] = useState<string | null>(null);
    const [isAuthInitializing, setIsAuthInitializing] = useState(true);
    const [tokenSyncing, setTokenSyncing] = useState(false);
    const [isOnboarded, setIsOnboarded] = useState(false);
    const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
    const [authForm, setAuthForm] = useState({ email: '', password: '' });
    const [showPassword, setShowPassword] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [errorMessage, setErrorMessage] = useState("");
    useLayoutEffect(() => {
        applyAxiosCredentialsDefaults();
        let cancelled = false;
        void (async () => {
            if (typeof window !== 'undefined' && !hasLocalSessionHint()) {
                if (!cancelled) {
                    setIsAuthInitializing(false);
                }
                return;
            }
            try {
                const ok = await validateTmsSessionWithTimeout(3000);
                if (!cancelled && ok) {
                    setToken(readPersistedTmsToken());
                }
            }
            catch {
                console.warn('Auth verification timed out or server cold-starting. Diverting to login.');
                clearTmsToken();
            }
            finally {
                if (!cancelled) {
                    setIsAuthInitializing(false);
                }
            }
        })();
        return () => {
            cancelled = true;
        };
    }, []);
    useEffect(() => {
        const syncSession = () => {
            if (!hasValidTmsToken()) {
                setToken(null);
                return;
            }
            setToken(readPersistedTmsToken());
        };
        window.addEventListener(TMS_TOKEN_UPDATED_EVENT, syncSession);
        return () => window.removeEventListener(TMS_TOKEN_UPDATED_EVENT, syncSession);
    }, []);
    useEffect(() => {
        const email = session?.user?.email;
        if (email && localStorage.getItem(`fleety_onboarded_${email}`) === 'true') {
            setIsOnboarded(true);
        }
    }, [session?.user?.email]);
    useEffect(() => {
        let cancelled = false;
        async function syncBackendToken() {
            if (status === 'loading')
                return;
            if (hasValidTmsToken(token))
                return;
            const stored = readPersistedTmsToken();
            if (stored) {
                setToken(stored);
                return;
            }
            const email = session?.user?.email;
            if (status !== 'authenticated' || !email)
                return;
            const onboarded = localStorage.getItem(`fleety_onboarded_${email}`) === 'true';
            if (!onboarded)
                return;
            const oauthSecret = localStorage.getItem(`fleety_oauth_secret_${email}`);
            if (!oauthSecret)
                return;
            setTokenSyncing(true);
            try {
                const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
                const formData = new URLSearchParams();
                formData.append('username', email);
                formData.append('password', oauthSecret);
                const res = await axios.post(`${API_URL}/api/login`, formData, {
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                    withCredentials: true,
                });
                if (cancelled)
                    return;
                await completeLoginSession(res.data);
                setToken(readPersistedTmsToken());
            }
            catch (err) {
                console.error('Backend token sync failed for Google session:', err);
            }
            finally {
                if (!cancelled)
                    setTokenSyncing(false);
            }
        }
        void syncBackendToken();
        return () => {
            cancelled = true;
        };
    }, [status, session?.user?.email, token]);
    const generateOAuthPassword = () => {
        const base = crypto.randomUUID().replace(/-/g, '');
        return `${base.slice(0, 10)}!A1`;
    };
    const loginWithCredentials = async (email: string, password: string) => {
        const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
        const formData = new URLSearchParams();
        formData.append('username', email);
        formData.append('password', password);
        const loginRes = await axios.post(`${API_URL}/api/login`, formData, {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            withCredentials: true,
        });
        await completeLoginSession(loginRes.data);
        setToken(readPersistedTmsToken());
    };
    const splitSessionName = (fullName?: string | null) => {
        if (!fullName?.trim())
            return { firstName: '', lastName: '' };
        const parts = fullName.trim().split(/\s+/);
        return {
            firstName: parts[0] ?? '',
            lastName: parts.slice(1).join(' '),
        };
    };
    const sessionName = splitSessionName(session?.user?.name);
    const handleAuth = async (e: React.FormEvent) => {
        e.preventDefault();
        if (isSubmitting)
            return;
        setErrorMessage("");
        const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
        try {
            setIsSubmitting(true);
            purgeClientSessionLocally();
            setAuthenticating(true);
            const formData = new URLSearchParams();
            formData.append('username', authForm.email);
            formData.append('password', authForm.password);
            const loginRes = await axios.post(`${API_URL}/api/login`, formData, {
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                withCredentials: true,
                timeout: AUTH_NETWORK_TIMEOUT_MS,
            });
            const sessionOk = await completeLoginSession(loginRes.data);
            if (!sessionOk) {
                setErrorMessage('Signed in but failed to load workspace profile. Please try again.');
                return;
            }
            setToken(readPersistedTmsToken());
            setIsOnboarded(true);
            toast.success("Welcome back!");
        }
        catch (err: unknown) {
            if (isRequestTimeoutError(err)) {
                setErrorMessage(AUTH_COLD_START_MESSAGE);
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
    const handleRegisterComplete = async (payload: RegisterWizardPayload) => {
        setErrorMessage("");
        const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
        try {
            const registerRes = await axios.post(`${API_URL}/api/register`, {
                company_name: payload.companyName,
                admin_email: payload.email,
                password: payload.password,
                dot_number: payload.mcNumber,
            }, { withCredentials: true });
            const sessionOk = await completeLoginSession(registerRes.data);
            if (!sessionOk) {
                setErrorMessage('Registered but failed to load workspace profile. Please try again.');
                return;
            }
            setToken(readPersistedTmsToken());
            setIsOnboarded(true);
            toast.success("Workspace registered successfully!");
        }
        catch (err: any) {
            const detail = err.response?.data?.detail || "Registration failed. Please try again.";
            setErrorMessage(typeof detail === 'string' ? detail : JSON.stringify(detail));
            throw err;
        }
    };
    const handleGoogleOnboardingComplete = async (payload: RegisterWizardPayload) => {
        setErrorMessage("");
        const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
        const email = session?.user?.email || payload.email;
        if (!email) {
            setErrorMessage("Google account email is missing. Please sign in again.");
            throw new Error("Missing Google account email");
        }
        const oauthPassword = generateOAuthPassword();
        try {
            await axios.post(`${API_URL}/api/register`, {
                company_name: payload.companyName,
                admin_email: email,
                password: oauthPassword,
                dot_number: payload.mcNumber,
            }, { withCredentials: true });
            await loginWithCredentials(email, oauthPassword);
            localStorage.setItem(`fleety_oauth_secret_${email}`, oauthPassword);
            localStorage.setItem(`fleety_onboarded_${email}`, 'true');
            setIsOnboarded(true);
            toast.success("Carrier profile saved. Welcome to Fleety!");
        }
        catch (err: any) {
            const detail = err.response?.data?.detail || "Failed to complete carrier onboarding.";
            setErrorMessage(typeof detail === 'string' ? detail : JSON.stringify(detail));
            throw err;
        }
    };
    const isSessionAuthenticated = status === "authenticated" && Boolean(session?.user?.email);
    const hasBackendToken = hasValidTmsToken(token);
    const needsCarrierOnboarding = isSessionAuthenticated && !hasBackendToken && !isOnboarded;
    const canAccessDashboard = hasBackendToken;
    const shouldWaitForNextAuth = status === 'loading' && hasLocalSessionHint() && !hasBackendToken;
    if (isAuthInitializing || tokenSyncing || shouldWaitForNextAuth) {
        return (<div className="flex h-screen w-screen items-center justify-center bg-[#121212] text-zinc-500">
        <Loader2 className="animate-spin mr-2" size={20}/>
        Loading...
      </div>);
    }
    if (needsCarrierOnboarding) {
        return (<AuthSplitLayout topRight={<ThemeToggle />}>
        <RegisterWizard profileOnly defaultEmail={session?.user?.email ?? ""} defaultFirstName={sessionName.firstName} defaultLastName={sessionName.lastName} registrationError={errorMessage} onComplete={handleGoogleOnboardingComplete}/>
      </AuthSplitLayout>);
    }
    if (!isSessionAuthenticated && !hasBackendToken) {
        return (<AuthSplitLayout topRight={<ThemeToggle />}>
        {authMode === 'register' ? (<RegisterWizard registrationError={errorMessage} onBackToLogin={() => {
                    setAuthMode('login');
                    setErrorMessage('');
                }} onComplete={handleRegisterComplete}/>) : (<div className={authCardClass}>
            {errorMessage && (<div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center gap-2 text-red-500 text-xs font-medium w-full animate-in fade-in zoom-in-95 duration-150">
                <AlertTriangle className="w-4 h-4 shrink-0" aria-hidden="true"/>
                <span>{errorMessage}</span>
              </div>)}
            <h1 className={authTitleClass}>Access workspace</h1>
            <p className={authSubtitleClass}>
              Sign in to manage your fleet, loads, and dispatch operations.
            </p>

            <form onSubmit={handleAuth} className="space-y-4">
              <div>
                <label className={authLabelClass}>Admin email</label>
                <div className="relative">
                  <Mail size={16} className={authInputIconClass}/>
                  <input required type="email" placeholder="Enter your work email" className={authInputClass()} value={authForm.email} disabled={isSubmitting} onChange={(e) => setAuthForm({ ...authForm, email: e.target.value })}/>
                </div>
              </div>
              <div>
                <label className={authLabelClass}>Password</label>
                <div className="relative">
                  <Lock size={16} className={authInputIconClass}/>
                  <input required type={showPassword ? 'text' : 'password'} placeholder="Enter your password" className={`${authInputClass()} pr-10`} value={authForm.password} disabled={isSubmitting} onChange={(e) => setAuthForm({ ...authForm, password: e.target.value })}/>
                  <button type="button" onClick={() => setShowPassword((prev) => !prev)} className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-zinc-400 hover:text-zinc-600 transition-colors" aria-label={showPassword ? 'Hide password' : 'Show password'}>
                    {showPassword ? <EyeOff size={16}/> : <Eye size={16}/>}
                  </button>
                </div>
              </div>

              <button type="submit" disabled={isSubmitting} className={authPrimaryButtonStandaloneClass}>
                {isSubmitting ? (<>
                    <Loader2 size={16} className="animate-spin" aria-hidden/>
                    Signing in...
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
              <button type="button" onClick={() => signIn("google", { callbackUrl: "/" })} className={SOCIAL_AUTH_BUTTON_CLASS}>
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
              <button type="button" onClick={() => {
                    setAuthMode('register');
                    setErrorMessage('');
                    setShowPassword(false);
                }} className={authFooterLinkAccentClass}>
                Register company
              </button>
            </p>
          </div>)}
      </AuthSplitLayout>);
    }
    if (!canAccessDashboard) {
        if (isAuthInitializing || tokenSyncing || shouldWaitForNextAuth) {
            return (<div className="flex h-screen w-screen items-center justify-center bg-[#121212] text-zinc-500">
          <Loader2 className="animate-spin mr-2" size={20}/>
          Loading...
        </div>);
        }
        return (<div className="min-h-screen bg-zinc-50 dark:bg-[#0B0B0B] flex items-center justify-center p-6 text-center">
        <div className="max-w-md">
          <p className="font-semibold text-zinc-800 dark:text-zinc-200 mb-2">Backend session not available</p>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-6">
            Sign out and sign back in to restore your workspace token.
          </p>
          <button type="button" onClick={() => void performTmsLogout()} className="px-5 py-3 rounded-xl bg-zinc-900 dark:bg-white text-white dark:text-black font-bold text-sm">
            Sign out
          </button>
        </div>
      </div>);
    }
    return (<>
      <Toaster position="top-right"/>
      <DispatchDashboard token={token} setToken={setToken}>{children}</DispatchDashboard>
    </>);
}
function DispatchDashboard({ token, setToken, children, }: {
    token: string | null;
    setToken: (t: string | null) => void;
    children: React.ReactNode;
}) {
    const pathname = usePathname();
    const router = useRouter();
    const searchParams = useSearchParams();
    const isLoadManagementRoute = pathname === DASHBOARD_ROUTES.loadManagement;
    const isLiveOperationsRoute = pathname === DASHBOARD_ROUTES.liveOperations;
    const isFleetAssetsRoute = pathname === DASHBOARD_ROUTES.fleetAssets;
    const isFleetFinancialsRoute = pathname === DASHBOARD_ROUTES.fleetFinancials;
    const isPlanningRoute = pathname === DASHBOARD_ROUTES.fleetPlanning;
    const [cachedViews, setCachedViews] = useState<Record<string, React.ReactNode>>({});
    useEffect(() => {
        if (isDashboardPath(pathname)) {
            setCachedViews((prev) => ({ ...prev, [pathname]: children }));
        }
    }, [pathname, children]);
    const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
    useEffect(() => {
        applyAxiosCredentialsDefaults();
    }, []);
    const [isDarkMode, setIsDarkMode] = useState(false);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    useEffect(() => {
        const onResize = () => {
            if (window.innerWidth >= 768) {
                setIsMobileMenuOpen(false);
            }
        };
        window.addEventListener('resize', onResize);
        return () => window.removeEventListener('resize', onResize);
    }, []);
    const [customers, setCustomers] = useState<any[]>([]);
    const [facilities, setFacilities] = useState<any[]>([]);
    useEffect(() => {
        const fetchCRMData = async () => {
            try {
                const custRes = await axios.get(`${API_URL}/api/customers`);
                setCustomers(custRes.data);
                const facRes = await axios.get(`${API_URL}/api/facilities`);
                setFacilities(facRes.data);
            }
            catch (err) {
                console.error("Failed to load CRM data", err);
            }
        };
        fetchCRMData();
    }, [API_URL]);
    useEffect(() => {
        if (localStorage.getItem('tms-theme') === 'dark') {
            document.documentElement.classList.add('dark');
            setIsDarkMode(true);
        }
    }, []);
    const toggleTheme = () => {
        console.log("Toggle clicked! Current state:", isDarkMode);
        if (isDarkMode) {
            document.documentElement.classList.remove('dark');
            localStorage.setItem('tms-theme', 'light');
            setIsDarkMode(false);
            console.log("Switched to Light Mode");
        }
        else {
            document.documentElement.classList.add('dark');
            localStorage.setItem('tms-theme', 'dark');
            setIsDarkMode(true);
            console.log("Switched to Dark Mode");
        }
    };
    const { searchQuery, setSearchQuery, userRoles, setUserRoles, isLoadModalOpen, setIsLoadModalOpen, stagedLoad, setStagedLoad, activeVaultLoad, setActiveVaultLoad, settleModalId, setSettleModalId, requestBillingRefresh, activeAssetProfile, setActiveAssetProfile, isEditingProfile, setIsEditingProfile, activeFuelVault, setActiveFuelVault, activeDriverVault, setActiveDriverVault } = useTMSStore();
    const showFleetDateFilter = isFleetPath(pathname);
    const [eldProvider, setEldProvider] = useState('Samsara');
    const [eldApiToken, setEldApiToken] = useState('');
    const [eldConnected, setEldConnected] = useState(false);
    const [eldSaving, setEldSaving] = useState(false);
    const loadDatePreset = useLoadTimeFilterStore((state) => state.preset);
    const loadDateFrom = useLoadTimeFilterStore((state) => state.dateFrom);
    const loadDateTo = useLoadTimeFilterStore((state) => state.dateTo);
    const applyLoadTimeFilterPreset = useLoadTimeFilterStore((state) => state.applyPreset);
    const applyLoadTimeFilterCustomDate = useLoadTimeFilterStore((state) => state.applyCustomDate);
    const timeFilterHydrated = useLoadTimeFilterHydrated();
    const [isLoadDateMenuOpen, setIsLoadDateMenuOpen] = useState(false);
    const loadDateFilterMenuRef = useRef<HTMLDivElement>(null);
    const timeRange: '30d' | 'all' | null = !timeFilterHydrated
        ? null
        : loadDatePreset === 'all'
            ? 'all'
            : loadDatePreset === 'mtd'
                ? '30d'
                : 'all';
    const [loadManagementView, setLoadManagementView] = useState<'active' | 'trash'>('active');
    const [activeDrawerLoadId, setActiveDrawerLoadId] = useState<number | null>(null);
    const [isDateMenuOpen, setIsDateMenuOpen] = useState(false);
    const fleetDateFilterMenuRef = useRef<HTMLDivElement>(null);
    const [loadStatusFilter, setLoadStatusFilter] = useState<LoadStatusFilter>('all');
    const [planningBoardRefreshKey, setPlanningBoardRefreshKey] = useState(0);
    useEffect(() => {
        if (!isLoadManagementRoute)
            return;
        const tab = searchParams.get('tab');
        if (tab === 'deleted' || tab === 'trash') {
            setLoadManagementView('trash');
        }
        else if (tab === 'active') {
            setLoadManagementView('active');
        }
        const status = searchParams.get('status');
        if (status) {
            const mappedStatus = LOAD_STATUS_QUERY_MAP[status];
            if (mappedStatus) {
                setLoadStatusFilter(mappedStatus);
            }
        }
    }, [isLoadManagementRoute, searchParams]);
    const [updatingTruckStatusId, setUpdatingTruckStatusId] = useState<number | null>(null);
    const [showOnboardDriverModal, setShowOnboardDriverModal] = useState(false);
    const [showRegisterEquipmentModal, setShowRegisterEquipmentModal] = useState(false);
    const [selectedDriverProfileId, setSelectedDriverProfileId] = useState<number | null>(null);
    const [teamDispatchers, setTeamDispatchers] = useState<TeamDispatcher[]>([]);
    const [teamDispatchersLoading, setTeamDispatchersLoading] = useState(false);
    const [isRevisionModalOpen, setIsRevisionModalOpen] = useState(false);
    const [selectedLoadIdForRevision, setSelectedLoadIdForRevision] = useState<number | null>(null);
    const handleOpenRevisionModal = useCallback((loadId: number) => {
        setSelectedLoadIdForRevision(loadId);
        setIsRevisionModalOpen(true);
    }, []);
    const handleCloseRevisionModal = useCallback(() => {
        setIsRevisionModalOpen(false);
        setSelectedLoadIdForRevision(null);
    }, []);
    const currentUserId = useMemo(() => getUserId(token), [token]);
    const canViewOperationalFinancials = useMemo(() => canViewLoadOperationalFinancials(userRoles), [userRoles]);
    const canViewNetProfit = useMemo(() => canViewLoadNetProfit(userRoles), [userRoles]);
    useEffect(() => {
        if (!isLoadDateMenuOpen)
            return;
        const handlePointerDown = (event: MouseEvent) => {
            if (loadDateFilterMenuRef.current?.contains(event.target as Node))
                return;
            setIsLoadDateMenuOpen(false);
        };
        document.addEventListener('mousedown', handlePointerDown);
        return () => document.removeEventListener('mousedown', handlePointerDown);
    }, [isLoadDateMenuOpen]);
    useEffect(() => {
        if (!isDateMenuOpen)
            return;
        const handlePointerDown = (event: MouseEvent) => {
            if (fleetDateFilterMenuRef.current?.contains(event.target as Node))
                return;
            setIsDateMenuOpen(false);
        };
        document.addEventListener('mousedown', handlePointerDown);
        return () => document.removeEventListener('mousedown', handlePointerDown);
    }, [isDateMenuOpen]);
    useEffect(() => {
        if (!token) {
            setUserRoles([]);
            return;
        }
        setUserRoles(getTmsSessionRoles());
    }, [token, setUserRoles]);
    const { api: tmsApi, activeLoads, drivers, trucks, fuelHistory, iftaData, analytics, etaBoard, setEtaBoard, refresh: fetchData, refreshActiveLoads, refreshFuel, patchTruck, } = useTMSData(token, timeRange);
    const [loadsPage, setLoadsPage] = useState(1);
    const [loadsLimit, setLoadsLimit] = useState(10);
    const [loadsPagination, setLoadsPagination] = useState({ total_count: 0, total_pages: 1 });
    const [boardLoads, setBoardLoads] = useState<LoadRecord[]>([]);
    const [boardLoadsLoading, setBoardLoadsLoading] = useState(false);
    const [pipelineCounts, setPipelineCounts] = useState({
        all: 0,
        unassigned: 0,
        booked: 0,
        in_transit: 0,
        delivered: 0,
        delayed: 0,
    });
    const loadDateListParams = useMemo(() => ({
        timeframe: loadDatePreset,
        ...(loadDatePreset === 'custom'
            ? {
                ...(loadDateFrom ? { date_from: loadDateFrom } : {}),
                ...(loadDateTo ? { date_to: loadDateTo } : {}),
            }
            : {}),
    }), [loadDatePreset, loadDateFrom, loadDateTo]);
    const fetchBoardLoads = useCallback(async () => {
        if (!hasValidTmsToken(token)) {
            setBoardLoads([]);
            setLoadsPagination({ total_count: 0, total_pages: 1 });
            return;
        }
        setBoardLoadsLoading(true);
        try {
            const response = await tmsApi.loads.list({
                page: loadsPage,
                limit: loadsLimit,
                status: loadStatusFilter === 'all' ? undefined : loadStatusFilter,
                search: searchQuery.trim() || undefined,
                ...loadDateListParams,
            });
            setBoardLoads(response.data);
            setLoadsPagination({
                total_count: response.total_count,
                total_pages: response.total_pages,
            });
        }
        catch {
            setBoardLoads([]);
            setLoadsPagination({ total_count: 0, total_pages: 1 });
        }
        finally {
            setBoardLoadsLoading(false);
        }
    }, [
        token,
        tmsApi,
        loadsPage,
        loadsLimit,
        loadStatusFilter,
        searchQuery,
        loadDateListParams,
    ]);
    const fetchPipelineCounts = useCallback(async () => {
        if (!hasValidTmsToken(token)) {
            setPipelineCounts({
                all: 0,
                unassigned: 0,
                booked: 0,
                in_transit: 0,
                delivered: 0,
                delayed: 0,
            });
            return;
        }
        try {
            const countParams = { page: 1, limit: 1, ...loadDateListParams } as const;
            const [allRes, unassignedRes, bookedRes, inTransitRes, deliveredRes, delayedRes] = await Promise.all([
                tmsApi.loads.list(countParams),
                tmsApi.loads.list({ ...countParams, status: 'unassigned' }),
                tmsApi.loads.list({ ...countParams, status: 'booked' }),
                tmsApi.loads.list({ ...countParams, status: 'in_transit' }),
                tmsApi.loads.list({ ...countParams, status: 'delivered' }),
                tmsApi.loads.list({ ...countParams, status: 'delayed' }),
            ]);
            setPipelineCounts({
                all: allRes.total_count,
                unassigned: unassignedRes.total_count,
                booked: bookedRes.total_count,
                in_transit: inTransitRes.total_count,
                delivered: deliveredRes.total_count,
                delayed: delayedRes.total_count,
            });
        }
        catch {
            setPipelineCounts({
                all: 0,
                unassigned: 0,
                booked: 0,
                in_transit: 0,
                delivered: 0,
                delayed: 0,
            });
        }
    }, [token, tmsApi, loadDateListParams]);
    const refreshDashboard = useCallback(async () => {
        await fetchData();
        await Promise.all([fetchBoardLoads(), fetchPipelineCounts()]);
    }, [fetchData, fetchBoardLoads, fetchPipelineCounts]);
    useEffect(() => {
        setLoadsPage(1);
    }, [loadStatusFilter, searchQuery, loadDatePreset, loadDateFrom, loadDateTo]);
    useEffect(() => {
        if (!isLoadManagementRoute || loadManagementView !== 'active' || !token || !timeFilterHydrated) {
            return;
        }
        void fetchBoardLoads();
    }, [isLoadManagementRoute, loadManagementView, token, timeFilterHydrated, fetchBoardLoads]);
    useEffect(() => {
        if (!isLoadManagementRoute || loadManagementView !== 'active' || !token || !timeFilterHydrated) {
            return;
        }
        void fetchPipelineCounts();
    }, [isLoadManagementRoute, loadManagementView, token, timeFilterHydrated, fetchPipelineCounts]);
    const [equipmentModalTruck, setEquipmentModalTruck] = useState<TruckRecord | null>(null);
    const [selectedTruckProfileId, setSelectedTruckProfileId] = useState<number | null>(null);
    const [fleetProfilePresentation, setFleetProfilePresentation] = useState<'modal' | 'drawer'>('modal');
    const [activeBrokerViewId, setActiveBrokerViewId] = useState<number | null>(null);
    const [activeDriverViewId, setActiveDriverViewId] = useState<number | null>(null);
    const [activeTruckViewId, setActiveTruckViewId] = useState<number | null>(null);
    const truckForProfile = useMemo(() => selectedTruckProfileId
        ? trucks.find((truck) => truck.id === selectedTruckProfileId) ?? null
        : null, [selectedTruckProfileId, trucks]);
    const closeFleetProfile = useCallback(() => {
        setSelectedDriverProfileId(null);
        setSelectedTruckProfileId(null);
        setFleetProfilePresentation('modal');
    }, []);
    const closeBrokerProfile = useCallback(() => {
        setActiveBrokerViewId(null);
    }, []);
    const closeDriverProfile = useCallback(() => {
        setActiveDriverViewId(null);
    }, []);
    const closeTruckProfile = useCallback(() => {
        setActiveTruckViewId(null);
    }, []);
    const openDriverProfileFromLoads = useCallback((driverId: number) => {
        setActiveDrawerLoadId(null);
        setActiveBrokerViewId(null);
        setSelectedDriverProfileId(null);
        setSelectedTruckProfileId(null);
        setActiveTruckViewId(null);
        setActiveDriverViewId(driverId);
    }, []);
    const openTruckProfileFromLoads = useCallback((truckId: number) => {
        setActiveDrawerLoadId(null);
        setActiveBrokerViewId(null);
        setActiveDriverViewId(null);
        setSelectedDriverProfileId(null);
        setSelectedTruckProfileId(null);
        setFleetProfilePresentation('modal');
        setActiveTruckViewId(truckId);
    }, []);
    const openTrailerProfileFromLoads = useCallback((truckId: number) => {
        openTruckProfileFromLoads(truckId);
    }, [openTruckProfileFromLoads]);
    const brokerProfileCustomer = useMemo(() => customers.find((customer) => customer.id === activeBrokerViewId) ?? null, [customers, activeBrokerViewId]);
    const openBrokerWorkspaceFromLoads = useCallback((customerId: number) => {
        setActiveDrawerLoadId(null);
        setActiveBrokerViewId(customerId);
        setActiveDriverViewId(null);
        setActiveTruckViewId(null);
    }, []);
    useEffect(() => {
        if (activeDrawerLoadId != null) {
            setActiveBrokerViewId(null);
            setActiveDriverViewId(null);
            setActiveTruckViewId(null);
        }
    }, [activeDrawerLoadId]);
    const fleetTrucks = useMemo(() => filterPowerUnits(trucks), [trucks]);
    const filteredFleetTrucks = useMemo(() => {
        if (!searchQuery.trim())
            return fleetTrucks;
        return fleetTrucks.filter((truck) => matchesTruckSearchQuery(truck, drivers, searchQuery));
    }, [fleetTrucks, drivers, searchQuery]);
    const fleetInitialWindow = useMemo(() => getPresetRange('mtd'), []);
    const planningInitialWindow = useMemo(() => getPlanningWeekWindow(), []);
    const [fleetWindowStart, setFleetWindowStart] = useState(fleetInitialWindow.start);
    const [fleetWindowEnd, setFleetWindowEnd] = useState(fleetInitialWindow.end);
    const [planningWindowStart, setPlanningWindowStart] = useState(planningInitialWindow.start);
    const [planningWindowEnd, setPlanningWindowEnd] = useState(planningInitialWindow.end);
    const [fleetWindowPreset, setFleetWindowPreset] = useState<FleetWindowPreset>('mtd');
    const [planningWindowPreset, setPlanningWindowPreset] = useState<FleetWindowPreset>(() => detectFleetWindowPreset(planningInitialWindow.start, planningInitialWindow.end));
    useEffect(() => {
        setFleetWindowPreset(detectFleetWindowPreset(fleetWindowStart, fleetWindowEnd));
    }, [fleetWindowStart, fleetWindowEnd]);
    useEffect(() => {
        setPlanningWindowPreset(detectFleetWindowPreset(planningWindowStart, planningWindowEnd));
    }, [planningWindowStart, planningWindowEnd]);
    const activePlanningWindowStart = isPlanningRoute ? planningWindowStart : fleetWindowStart;
    const activePlanningWindowEnd = isPlanningRoute ? planningWindowEnd : fleetWindowEnd;
    const activeWindowPreset = isPlanningRoute ? planningWindowPreset : fleetWindowPreset;
    const activeFleetDatePresets = isFleetFinancialsRoute ? FLEET_FINANCIALS_WINDOW_PRESETS : FLEET_WINDOW_PRESETS;
    const fleetDateFilterButtonLabel = useMemo(() => resolveDateFilterButtonLabel(activeFleetDatePresets, activeWindowPreset, activePlanningWindowStart, activePlanningWindowEnd), [activeFleetDatePresets, activeWindowPreset, activePlanningWindowStart, activePlanningWindowEnd]);
    const loadDateFilterButtonLabel = useMemo(() => resolveDateFilterButtonLabel(LOAD_MANAGEMENT_DATE_PRESETS, loadDatePreset, loadDateFrom, loadDateTo), [loadDatePreset, loadDateFrom, loadDateTo]);
    const handlePlanningWindowChange = useCallback((start: string, end: string) => {
        setPlanningWindowStart(start);
        setPlanningWindowEnd(end);
        setPlanningWindowPreset('custom');
    }, []);
    const applyFleetWindowPreset = useCallback(async (preset: FleetWindowPreset) => {
        if (isPlanningRoute) {
            setPlanningWindowPreset(preset);
            if (preset === 'custom') {
                return;
            }
            if (preset === 'all') {
                setPlanningWindowStart('');
                setPlanningWindowEnd('');
                setIsDateMenuOpen(false);
                return;
            }
            const range = getPresetRange(preset);
            setPlanningWindowStart(range.start);
            setPlanningWindowEnd(range.end);
            setIsDateMenuOpen(false);
            return;
        }
        setFleetWindowPreset(preset);
        if (preset === 'custom') {
            return;
        }
        if (preset === 'all') {
            setFleetWindowStart('');
            setFleetWindowEnd('');
            setIsDateMenuOpen(false);
            try {
                await fetchData();
            }
            catch {
            }
            return;
        }
        const range = getPresetRange(preset);
        setFleetWindowStart(range.start);
        setFleetWindowEnd(range.end);
        setIsDateMenuOpen(false);
        try {
            await fetchData();
        }
        catch {
        }
    }, [isPlanningRoute, fetchData]);
    const handleFleetCustomDateChange = useCallback(async (field: 'start' | 'end', value: string) => {
        if (isPlanningRoute) {
            setPlanningWindowPreset('custom');
            if (field === 'start') {
                setPlanningWindowStart(value);
            }
            else {
                setPlanningWindowEnd(value);
            }
            return;
        }
        setFleetWindowPreset('custom');
        if (field === 'start') {
            setFleetWindowStart(value);
        }
        else {
            setFleetWindowEnd(value);
        }
        try {
            await fetchData();
        }
        catch {
        }
    }, [isPlanningRoute, fetchData]);
    const applyLoadDatePreset = useCallback((preset: LoadManagementDatePreset) => {
        setLoadsPage(1);
        applyLoadTimeFilterPreset(preset);
        if (preset !== 'custom') {
            setIsLoadDateMenuOpen(false);
        }
    }, [applyLoadTimeFilterPreset]);
    const handleLoadCustomDateChange = useCallback((field: 'start' | 'end', value: string) => {
        setLoadsPage(1);
        applyLoadTimeFilterCustomDate(field, value);
    }, [applyLoadTimeFilterCustomDate]);
    const fleetMetrics = useMemo(() => {
        let activeVehicles = 0;
        let inTransit = 0;
        let maintenanceDue = 0;
        let outOfService = 0;
        fleetTrucks.forEach((truck) => {
            const status = normalizeTruckStatus(truck.status);
            if (status === 'LOADED') {
                inTransit += 1;
                activeVehicles += 1;
            }
            else if (status === 'AVAILABLE') {
                activeVehicles += 1;
            }
            else if (status === 'MAINTENANCE') {
                maintenanceDue += 1;
            }
            else if (status === 'OUT OF SERVICE') {
                outOfService += 1;
            }
        });
        return {
            totalVehicles: fleetTrucks.length,
            activeVehicles,
            inTransit,
            maintenanceDue,
            outOfService,
        };
    }, [fleetTrucks]);
    const handleManualInputChange = (field: string, value: any) => {
        setStagedLoad((prev: any) => ({
            ...(prev || {}),
            [field]: value
        }));
    };
    const [rateConParsing, setRateConParsing] = useState(false);
    const [rateConParseFailed, setRateConParseFailed] = useState(false);
    const [isLoadEntryViewMode, setIsLoadEntryViewMode] = useState(false);
    const [viewLoadDocuments, setViewLoadDocuments] = useState<LoadDocumentRecord[]>([]);
    const [viewLoadDocumentsLoading, setViewLoadDocumentsLoading] = useState(false);
    const [rateConQuotaRetryCountdown, setRateConQuotaRetryCountdown] = useState(0);
    const rateConPollRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const rateConPollAttempts = useRef(0);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [savingLoad, setSavingLoad] = useState(false);
    const [editDriverData, setEditDriverData] = useState<any>(null);
    const [editTruckData, setEditTruckData] = useState<any>(null);
    const [vaultDocs, setVaultDocs] = useState<any[]>([]);
    const [fuelDocs, setFuelDocs] = useState<any[]>([]);
    const [driverDocs, setDriverDocs] = useState<any[]>([]);
    const [selectedFuelDocs, setSelectedFuelDocs] = useState<number[]>([]);
    const [uploadingDoc, setUploadingDoc] = useState(false);
    const [file, setFile] = useState<File | null>(null);
    const fetchEtaBoard = async () => {
        if (!hasValidTmsToken(token))
            return;
        try {
            const res = await tmsApi.telemetry.etaBoard();
            setEtaBoard(res.rows || []);
        }
        catch (err) {
            console.error('ETA board fetch failed:', err);
            setEtaBoard([]);
        }
    };
    useEffect(() => {
        setUnauthorizedHandler(() => {
            setToken(null);
        });
        return () => setUnauthorizedHandler(null);
    }, [setToken]);
    const saveEldConnection = async () => {
        if (!eldApiToken.trim()) {
            toast.error('API token is required to connect ELD provider.');
            return;
        }
        setEldSaving(true);
        try {
            await axios.post(`${API_URL}/api/company/eld-config`, {
                eld_provider: eldProvider,
                eld_api_token: eldApiToken,
            });
            setEldConnected(true);
            toast.success('ELD Pipeline Connected and Synchronized!');
            await fetchEtaBoard();
        }
        catch (err: any) {
            toast.error(err.response?.data?.detail || 'Failed to save ELD configuration.');
        }
        finally {
            setEldSaving(false);
        }
    };
    const REEFER_MODE_OPTIONS = ['Continuous', 'Start/Stop (On/Off)', 'N/A (Dry Van)'] as const;
    const inferReeferFromExtracted = (extracted: Record<string, any>) => {
        let reefer_temperature = String(extracted.reefer_temperature ?? '').trim();
        let reefer_mode = String(extracted.reefer_mode ?? '').trim();
        const textBuckets = [
            extracted.load_notes,
            extracted.requirements?.special_instructions,
            ...(Array.isArray(extracted.commodities) ? extracted.commodities.map((c: any) => c.note) : []),
        ]
            .filter(Boolean)
            .join(' ');
        if (!reefer_temperature && textBuckets) {
            const tempMatch = textBuckets.match(/([+-]?\d+(?:\.\d+)?)\s*°?\s*([CFcf])\b/);
            if (tempMatch) {
                reefer_temperature = `${tempMatch[1]}°${tempMatch[2].toUpperCase()}`;
            }
        }
        if (!reefer_mode && textBuckets) {
            const lower = textBuckets.toLowerCase();
            if (/continuous|constant|always\s*run/.test(lower)) {
                reefer_mode = 'Continuous';
            }
            else if (/start\s*\/\s*stop|on\s*\/\s*off|\bcycle\b/.test(lower)) {
                reefer_mode = 'Start/Stop (On/Off)';
            }
        }
        if (!reefer_mode) {
            reefer_mode = reefer_temperature ? 'Continuous' : 'N/A (Dry Van)';
        }
        return { reefer_temperature, reefer_mode };
    };
    const emptyStagedLoad = createEmptyStagedLoad;
    useEffect(() => {
        if (isLoadModalOpen && !stagedLoad && !isLoadEntryViewMode) {
            setStagedLoad(emptyStagedLoad(currentUserId));
        }
    }, [isLoadModalOpen, stagedLoad, setStagedLoad, currentUserId, isLoadEntryViewMode]);
    useEffect(() => {
        if (!token) {
            setTeamDispatchers([]);
            setTeamDispatchersLoading(false);
            return;
        }
        let cancelled = false;
        setTeamDispatchersLoading(true);
        tmsApi.users
            .dispatchers()
            .then((res) => {
            if (!cancelled)
                setTeamDispatchers(res.dispatchers || []);
        })
            .catch(() => {
            if (!cancelled)
                setTeamDispatchers([]);
        })
            .finally(() => {
            if (!cancelled)
                setTeamDispatchersLoading(false);
        });
        return () => {
            cancelled = true;
        };
    }, [token, tmsApi]);
    useEffect(() => {
        if (!isLoadModalOpen || !currentUserId || isLoadEntryViewMode)
            return;
        setStagedLoad((prev: any) => {
            if (!prev || prev.dispatcher_id)
                return prev;
            return { ...prev, dispatcher_id: currentUserId };
        });
    }, [isLoadModalOpen, currentUserId, setStagedLoad, isLoadEntryViewMode]);
    useEffect(() => {
        if (!isLoadModalOpen) {
            setRateConParsing(false);
            setRateConParseFailed(false);
            setRateConQuotaRetryCountdown(0);
            setIsLoadEntryViewMode(false);
            setViewLoadDocuments([]);
            setViewLoadDocumentsLoading(false);
            if (rateConPollRef.current) {
                clearTimeout(rateConPollRef.current);
                rateConPollRef.current = null;
            }
            rateConPollAttempts.current = 0;
        }
    }, [isLoadModalOpen]);
    useEffect(() => {
        if (!isLiveOperationsRoute || !token) {
            return;
        }
        fetchEtaBoard();
        refreshActiveLoads();
        const interval = setInterval(() => {
            refreshActiveLoads();
        }, 30000);
        return () => clearInterval(interval);
    }, [isLiveOperationsRoute, token, refreshActiveLoads]);
    const etaAlertCount = etaBoard.filter((row) => row.status === 'Delayed' || row.status === 'Out of Route').length;
    const knownLoads = useMemo(() => {
        const byId = new Map<number, LoadRecord>();
        for (const load of [...activeLoads, ...boardLoads]) {
            byId.set(load.id, load);
        }
        return Array.from(byId.values());
    }, [activeLoads, boardLoads]);
    const totalLoadsCount = pipelineCounts.all;
    const unassignedLoadsCount = pipelineCounts.unassigned;
    const bookedLoadsCount = pipelineCounts.booked;
    const inTransitCount = pipelineCounts.in_transit;
    const deliveredCount = pipelineCounts.delivered;
    const delayedCount = pipelineCounts.delayed;
    const drawerLoad = useMemo(() => activeDrawerLoadId != null
        ? boardLoads.find((load) => load.id === activeDrawerLoadId)
            ?? activeLoads.find((load) => load.id === activeDrawerLoadId)
            ?? null
        : null, [activeDrawerLoadId, boardLoads, activeLoads]);
    useEffect(() => {
        if (activeDrawerLoadId != null &&
            !boardLoads.some((load) => load.id === activeDrawerLoadId) &&
            !activeLoads.some((load) => load.id === activeDrawerLoadId)) {
            setActiveDrawerLoadId(null);
        }
    }, [boardLoads, activeLoads, activeDrawerLoadId]);
    const RATE_CON_PARSE_TIMEOUT_ATTEMPTS = 60;
    const RATE_CON_QUOTA_RETRY_SECONDS = 20;
    const finishRateConParsing = () => {
        setRateConParsing(false);
        if (rateConPollRef.current) {
            clearTimeout(rateConPollRef.current);
            rateConPollRef.current = null;
        }
        rateConPollAttempts.current = 0;
    };
    const isRateConTaskComplete = (status: unknown) => {
        const normalized = String(status ?? '').toLowerCase();
        return normalized === 'completed' || normalized === 'success' || normalized === 'done';
    };
    const isRateConTaskFailed = (status: unknown) => {
        const normalized = String(status ?? '').toLowerCase();
        return normalized === 'failed' || normalized === 'error' || normalized === 'failure';
    };
    const revertToManualRateConEntry = (message?: string) => {
        finishRateConParsing();
        setRateConParseFailed(true);
        toast.error(message || 'AI could not parse this format completely. Reverting to manual entry.');
    };
    const clearRateConAttachment = () => {
        setFile(null);
        setRateConParseFailed(false);
        setRateConQuotaRetryCountdown(0);
    };
    const closeLoadEntryModal = () => {
        setIsLoadModalOpen(false);
        setStagedLoad(null);
        clearRateConAttachment();
        setRateConParsing(false);
        setIsLoadEntryViewMode(false);
        setViewLoadDocuments([]);
        setViewLoadDocumentsLoading(false);
    };
    const openLoadEntryView = useCallback(async (load: LoadRecord) => {
        setIsLoadEntryViewMode(true);
        setStagedLoad(mapLoadRecordToStagedLoad(load, currentUserId));
        clearRateConAttachment();
        setRateConParsing(false);
        setViewLoadDocuments([]);
        setViewLoadDocumentsLoading(true);
        setIsLoadModalOpen(true);
        try {
            const docs = await tmsApi.loads.documents(load.id);
            setViewLoadDocuments(docs);
        }
        catch {
            setViewLoadDocuments([]);
        }
        finally {
            setViewLoadDocumentsLoading(false);
        }
    }, [currentUserId, tmsApi]);
    const openLoadDocumentFromView = (event: React.MouseEvent, href: string) => {
        event.preventDefault();
        event.stopPropagation();
        window.open(href, '_blank', 'noopener,noreferrer');
    };
    const markRateConParseFailed = () => {
        finishRateConParsing();
        setRateConParseFailed(true);
    };
    useEffect(() => {
        if (rateConQuotaRetryCountdown <= 0)
            return;
        const timer = setTimeout(() => {
            setRateConQuotaRetryCountdown((prev) => Math.max(0, prev - 1));
        }, 1000);
        return () => clearTimeout(timer);
    }, [rateConQuotaRetryCountdown]);
    const applyExtractedRateCon = (extracted: Record<string, any>, metrics: Record<string, any>) => {
        const reefer = inferReeferFromExtracted(extracted);
        const parsedNotes = String(extracted.parsed_notes ?? extracted.load_notes ?? extracted.comments ?? '').trim();
        const data = {
            broker_name: extracted.broker_name ?? '',
            broker_address: extracted.broker_address ?? '',
            broker_email: extracted.broker_email ?? '',
            broker_phone: extracted.broker_phone ?? '',
            broker_load_id: extracted.broker_load_id ?? '',
            origin: extracted.origin ?? '',
            destination: extracted.destination ?? '',
            rate: extracted.rate ?? '',
            fuel_surcharge: extracted.fuel_surcharge ?? 0,
            accessorial_charge: extracted.accessorial_charge ?? 0,
            total_miles: metrics.total_miles ?? extracted.listed_miles ?? 0,
            rpm: metrics.rate_per_mile ?? 0,
            stops: extracted.stops ?? [],
            commodities: extracted.commodities ?? [],
            requirements: extracted.requirements ?? {},
            load_notes: parsedNotes,
            notes: parsedNotes,
            pickup_number: extracted.pickup_number ?? '',
            reefer_temperature: reefer.reefer_temperature,
            reefer_mode: reefer.reefer_mode,
        };
        console.log('AI Parsed Data:', data);
        const pickupStop = (extracted.stops ?? []).find((stop: {
            stop_type?: string;
        }) => String(stop.stop_type || '').toLowerCase() === 'pickup') ?? (extracted.stops ?? [])[0];
        const inferredPickupDate = extractCleanDate(pickupStop?.date_time || pickupStop?.date) ||
            extractCleanDate(extracted.pickup_date);
        setStagedLoad((prev: any) => ({
            ...(prev || emptyStagedLoad()),
            ...data,
            comments: prev?.comments ?? '',
            customer_id: extracted.customer_id ?? prev?.customer_id ?? null,
            initial_status: (prev?.initial_status as LoadInitialStatus | undefined) ??
                inferInitialStatusFromPickupDate(inferredPickupDate),
            temp_file_path: null,
        }));
        setRateConParseFailed(false);
        if (extracted.customer_id && extracted.matched_customer_name) {
            toast.success(`Linked to CRM broker: ${extracted.matched_customer_name}`);
        }
    };
    const handleRateConUpload = async (uploadedFile: File) => {
        const isValidRateCon = /\.(pdf|png|jpe?g)$/i.test(uploadedFile.name) ||
            ['application/pdf', 'image/png', 'image/jpeg'].includes(uploadedFile.type);
        if (!isValidRateCon) {
            toast.error('Please upload a PDF, PNG, or JPG rate confirmation.');
            return;
        }
        if (rateConQuotaRetryCountdown > 0) {
            toast.error(`Please wait ${rateConQuotaRetryCountdown}s before retrying the AI parser.`, {
                id: 'rate-con-quota-wait',
            });
            return;
        }
        if (rateConPollRef.current) {
            clearTimeout(rateConPollRef.current);
            rateConPollRef.current = null;
        }
        rateConPollAttempts.current = 0;
        setFile(uploadedFile);
        setRateConParseFailed(false);
        setRateConParsing(true);
        const formData = new FormData();
        formData.append('file', uploadedFile);
        try {
            const response = await axios.post(`${API_URL}/api/upload-bol`, formData);
            const taskId = response.data.task_id;
            const checkTaskStatus = async () => {
                rateConPollAttempts.current += 1;
                if (rateConPollAttempts.current > RATE_CON_PARSE_TIMEOUT_ATTEMPTS) {
                    revertToManualRateConEntry();
                    return;
                }
                try {
                    const statusRes = await axios.get(`${API_URL}/api/tasks/${taskId}`);
                    const task = statusRes.data;
                    const extracted = task.extracted_data ?? task.data?.extracted_data ?? task.result ?? {};
                    const metrics = task.calculated_metrics ?? task.data?.calculated_metrics ?? {};
                    if (isRateConTaskComplete(task.status)) {
                        console.log('AI Parsed Data:', { extracted, metrics, task });
                        applyExtractedRateCon(extracted, metrics);
                        finishRateConParsing();
                        toast.success('Rate confirmation parsed — review the fields and save.');
                        return;
                    }
                    if (isRateConTaskFailed(task.status)) {
                        console.error('Rate con parse task failed:', task.error);
                        const errorText = String(task.error ?? '');
                        const isOverloadError = errorText.includes('503') ||
                            errorText.includes('429') ||
                            errorText.toLowerCase().includes('high demand') ||
                            errorText.toLowerCase().includes('overloaded');
                        if (isOverloadError) {
                            toast.error('The AI parsing server is currently overloaded. Please try again in 30 seconds.');
                            markRateConParseFailed();
                        }
                        else if (isRateLimitError(task.error)) {
                            toast.error('AI Request limit reached (20/day limit on Free Tier). Please wait 20 seconds and click parse again or fill manually.', {
                                duration: 6000,
                                id: 'rate-con-quota-error',
                            });
                            markRateConParseFailed();
                            setRateConQuotaRetryCountdown(RATE_CON_QUOTA_RETRY_SECONDS);
                        }
                        else {
                            toast.error('Failed to parse rate confirmation file.');
                            markRateConParseFailed();
                        }
                        return;
                    }
                    rateConPollRef.current = setTimeout(checkTaskStatus, 2000);
                }
                catch (err) {
                    console.error('Rate con parse poll failed:', err);
                    revertToManualRateConEntry();
                }
            };
            checkTaskStatus();
        }
        catch (err: any) {
            console.error('Rate con upload failed:', err.response?.data || err);
            const status = err.response?.status;
            const detail = String(err.response?.data?.detail ?? '');
            if (status === 503 || detail.toLowerCase().includes('overloaded')) {
                toast.error('The AI parsing server is currently overloaded. Please try again in 30 seconds.');
            }
            else if (status === 429 || isRateLimitError(detail)) {
                toast.error('AI Request limit reached (20/day limit on Free Tier). Please wait 20 seconds and click parse again or fill manually.', {
                    duration: 6000,
                    id: 'rate-con-quota-error',
                });
                setRateConQuotaRetryCountdown(RATE_CON_QUOTA_RETRY_SECONDS);
            }
            else {
                toast.error('Failed to upload rate confirmation for parsing.');
            }
            markRateConParseFailed();
        }
    };
    const handleRateConRetry = () => {
        if (!file || rateConParsing || rateConQuotaRetryCountdown > 0)
            return;
        void handleRateConUpload(file);
    };
    const finalizeLoad = async () => {
        if (!stagedLoad) {
            toast.error('Cannot save: no load data found.');
            return;
        }
        const origin = (stagedLoad.origin || '').trim();
        const destination = (stagedLoad.destination || '').trim();
        const grossPay = parseFloat(String(stagedLoad.rate ?? ''));
        if (!origin) {
            toast.error('Origin is required.');
            return;
        }
        if (!destination) {
            toast.error('Destination is required.');
            return;
        }
        if (!stagedLoad.rate || Number.isNaN(grossPay) || grossPay <= 0) {
            toast.error('Gross pay (linehaul rate) must be greater than $0.');
            return;
        }
        const toastId = toast.loading('Creating load...');
        setSavingLoad(true);
        try {
            const rawStops = stagedLoad.stops || [];
            const cleanedStops = rawStops.map((stop: any) => {
                const cleanedDate = extractCleanDate(stop.date || stop.date_time);
                return {
                    ...stop,
                    date_time: String(stop.date_time ?? '').trim() || cleanedDate,
                    ...(stop.date != null ? { date: cleanedDate } : {}),
                };
            });
            const pickupStop = cleanedStops.find((s: any) => String(s.stop_type || '').toLowerCase() === 'pickup') ||
                cleanedStops[0];
            const deliveryCandidates = cleanedStops.filter((s: any) => String(s.stop_type || '').toLowerCase() === 'delivery');
            const deliveryStop = deliveryCandidates[deliveryCandidates.length - 1] ||
                cleanedStops[cleanedStops.length - 1];
            const payload = buildLoadCreatePayload(stagedLoad, {
                dispatcherId: currentUserId,
                cleanedStops,
                pickupDate: extractCleanDate(stagedLoad.pickup_date || stagedLoad.pickup_date_time) ||
                    extractCleanDate(pickupStop?.date_time || pickupStop?.date),
                deliveryDate: extractCleanDate(stagedLoad.delivery_date || stagedLoad.delivery_date_time) ||
                    extractCleanDate(deliveryStop?.date_time || deliveryStop?.date),
                grossPay,
            });
            const loadResponse = stagedLoad.ingest_load_id
                ? await tmsApi.loads.confirm(stagedLoad.ingest_load_id, payload)
                : await tmsApi.loads.create(payload);
            const newLoadId = stagedLoad.ingest_load_id || loadResponse.id;
            if (file && newLoadId) {
                toast.loading('Attaching document...', { id: toastId });
                try {
                    await tmsApi.loads.attachDocument(newLoadId, file);
                    toast.success('Load created and document attached.', { id: toastId });
                }
                catch (docErr) {
                    console.error('Document upload failed:', docErr);
                    toast.error('Load created, but document upload failed.', { id: toastId });
                }
            }
            else {
                toast.success('Load created successfully.', { id: toastId });
            }
            await refreshDashboard();
            setLoadsPage(1);
            setIsLoadModalOpen(false);
            setStagedLoad(null);
            setFile(null);
        }
        catch (err: any) {
            const detail = err.response?.data?.detail;
            const errorMessage = typeof detail === 'string' ? detail : 'Error saving load to database.';
            toast.error(errorMessage, { id: toastId });
            console.error('Backend Error:', err.response?.data);
        }
        finally {
            setSavingLoad(false);
        }
    };
    const fetchVaultDocs = async (loadId: number) => {
        try {
            const res = await axios.get(`${API_URL}/api/loads/${loadId}/documents`);
            setVaultDocs(res.data);
        }
        catch (err) {
            console.error(err);
        }
    };
    const fetchFuelDocs = async (fuelId: number) => {
        try {
            const res = await axios.get(`${API_URL}/api/fuel/${fuelId}/documents`);
            setFuelDocs(res.data);
        }
        catch (err) {
            console.error(err);
        }
    };
    const fetchDriverDocs = async (driverId: number) => {
        try {
            const docs = await tmsApi.fleet.driverDocuments(driverId);
            setDriverDocs(docs);
        }
        catch (err) {
            console.error(err);
        }
    };
    useEffect(() => {
        if (activeVaultLoad)
            fetchVaultDocs(activeVaultLoad);
        else
            setVaultDocs([]);
    }, [activeVaultLoad]);
    useEffect(() => {
        if (activeFuelVault) {
            fetchFuelDocs(activeFuelVault);
            setSelectedFuelDocs([]);
        }
        else {
            setFuelDocs([]);
        }
    }, [activeFuelVault]);
    useEffect(() => {
        if (activeDriverVault)
            fetchDriverDocs(activeDriverVault);
        else
            setDriverDocs([]);
    }, [activeDriverVault]);
    const uploadLoadDocument = async (loadId: number, uploadedFile: File, docType: string = 'POD') => {
        setUploadingDoc(true);
        const toastId = toast.loading('Uploading document...');
        const formData = new FormData();
        formData.append('file', uploadedFile);
        formData.append('document_type', docType);
        try {
            await axios.post(`${API_URL}/api/loads/${loadId}/documents`, formData);
            toast.success('POD Received. Invoice Settled and Capital Released!', { id: toastId });
            setActiveVaultLoad(null);
            await fetchData();
        }
        catch (err: any) {
            console.error(err);
            toast.error(err.response?.data?.detail || 'Error uploading document.', { id: toastId });
        }
        finally {
            setUploadingDoc(false);
        }
    };
    const handleUploadToVault = async (e: React.ChangeEvent<HTMLInputElement>, loadId: number) => {
        if (!e.target.files || e.target.files.length === 0)
            return;
        const uploadedFile = e.target.files[0];
        const selectEl = document.getElementById(`doc-type-${loadId}`) as HTMLSelectElement;
        const docType = selectEl ? selectEl.value : 'POD';
        await uploadLoadDocument(loadId, uploadedFile, docType);
        e.target.value = '';
    };
    const handleVaultDrop = async (e: React.DragEvent<HTMLDivElement>, loadId: number) => {
        e.preventDefault();
        e.stopPropagation();
        if (uploadingDoc)
            return;
        const droppedFile = e.dataTransfer.files?.[0];
        if (!droppedFile)
            return;
        const selectEl = document.getElementById(`doc-type-${loadId}`) as HTMLSelectElement;
        const docType = selectEl ? selectEl.value : 'POD';
        await uploadLoadDocument(loadId, droppedFile, docType);
    };
    const handleUploadFuelDoc = async (e: React.ChangeEvent<HTMLInputElement>, fuelId: number) => {
        if (!e.target.files || e.target.files.length === 0)
            return;
        setUploadingDoc(true);
        const formData = new FormData();
        formData.append("file", e.target.files[0]);
        try {
            await axios.post(`${API_URL}/api/fuel/${fuelId}/documents`, formData);
            fetchFuelDocs(fuelId);
        }
        catch (err) {
            alert("Error uploading fuel receipt.");
        }
        finally {
            setUploadingDoc(false);
            e.target.value = '';
        }
    };
    const handleDeleteSelectedFuelDocs = async () => {
        try {
            for (const docId of selectedFuelDocs) {
                await axios.delete(`${API_URL}/api/fuel/documents/${docId}`);
            }
            if (activeFuelVault)
                fetchFuelDocs(activeFuelVault);
            setSelectedFuelDocs([]);
        }
        catch (err) {
            alert("Error deleting selected documents.");
        }
    };
    const uploadDriverDocument = async (driverId: number, uploadedFile: File, docType: string) => {
        setUploadingDoc(true);
        const toastId = toast.loading('Uploading driver document...');
        try {
            const result = await tmsApi.fleet.uploadDriverDocument(driverId, uploadedFile, docType);
            if (result.scan) {
                toast.success(`${result.scan.document_type} uploaded — expiration detected`, { id: toastId });
            }
            else {
                toast.success('Document uploaded successfully.', { id: toastId });
            }
            if (activeDriverVault === driverId)
                fetchDriverDocs(driverId);
            setPlanningBoardRefreshKey((key) => key + 1);
        }
        catch (err: any) {
            toast.error(err.response?.data?.detail || 'Error uploading document.', { id: toastId });
        }
        finally {
            setUploadingDoc(false);
        }
    };
    const handleUploadDriverDoc = async (e: React.ChangeEvent<HTMLInputElement>, driverId: number) => {
        if (!e.target.files || e.target.files.length === 0)
            return;
        const uploadedFile = e.target.files[0];
        const selectEl = document.getElementById(`driver-doc-type-${driverId}`) as HTMLSelectElement;
        const docType = selectEl ? selectEl.value : 'Driver Document';
        await uploadDriverDocument(driverId, uploadedFile, docType);
        e.target.value = '';
    };
    const handleDriverVaultDrop = async (e: React.DragEvent<HTMLDivElement>, driverId: number) => {
        e.preventDefault();
        e.stopPropagation();
        if (uploadingDoc)
            return;
        const droppedFile = e.dataTransfer.files?.[0];
        if (!droppedFile)
            return;
        const selectEl = document.getElementById(`driver-doc-type-${driverId}`) as HTMLSelectElement;
        const docType = selectEl ? selectEl.value : 'Driver Document';
        await uploadDriverDocument(driverId, droppedFile, docType);
    };
    const handleFleetOnboardingSuccess = async () => {
        await fetchData();
        setPlanningBoardRefreshKey((key) => key + 1);
    };
    const openRegisterEquipmentModal = (truck?: (typeof trucks)[number] | null) => {
        setEquipmentModalTruck(truck ?? null);
        setShowRegisterEquipmentModal(true);
    };
    const closeRegisterEquipmentModal = () => {
        setShowRegisterEquipmentModal(false);
        setEquipmentModalTruck(null);
    };
    const handleAssetProfileClick = (truck: (typeof trucks)[number]) => {
        setFleetProfilePresentation('modal');
        setSelectedTruckProfileId(truck.id);
    };
    const updateTruck = async (truckId: number, payload: UpdateTruckPayload) => {
        const updatedTruck = await tmsApi.fleet.updateTruck(truckId, payload);
        patchTruck(updatedTruck);
        await fetchData();
    };
    const handleTruckStatusChange = async (truckId: number, nextStatus: string) => {
        const previous = trucks.find((truck) => truck.id === truckId);
        setUpdatingTruckStatusId(truckId);
        const toastId = toast.loading('Updating truck status...');
        try {
            await tmsApi.fleet.updateTruckStatus(truckId, nextStatus);
            await fetchData();
            toast.success('Truck status updated.', { id: toastId });
        }
        catch (err: unknown) {
            const detail = err && typeof err === 'object' && 'response' in err
                ? (err as {
                    response?: {
                        data?: {
                            detail?: string;
                        };
                    };
                }).response?.data?.detail
                : null;
            toast.error(typeof detail === 'string' ? detail : 'Failed to update truck status.', { id: toastId });
            if (previous) {
                console.error('Truck status rollback reference:', previous.status);
            }
        }
        finally {
            setUpdatingTruckStatusId(null);
        }
    };
    const startEditingProfile = (truckObj: any, driverObj: any) => {
        const customFields = { ...(truckObj.custom_fields || {}) };
        const samsaraVehicleId = String(customFields.samsara_vehicle_id || customFields.samsaraVehicleId || '').trim();
        delete customFields.samsara_vehicle_id;
        delete customFields.samsaraVehicleId;
        setEditTruckData({ ...truckObj, custom_fields: customFields, samsara_vehicle_id: samsaraVehicleId });
        setEditDriverData(driverObj ? { ...driverObj } : null);
        setIsEditingProfile(true);
    };
    const saveProfileEdits = async () => {
        if (!editTruckData)
            return;
        if (editTruckData.driver_id &&
            editTruckData.co_driver_id &&
            editTruckData.driver_id === editTruckData.co_driver_id) {
            toast.error('Primary driver and co-driver must be different.');
            return;
        }
        const toastId = toast.loading('Saving master file...');
        try {
            if (editDriverData && editDriverData.id) {
                await axios.put(`${API_URL}/api/drivers/${editDriverData.id}`, editDriverData);
            }
            const customFields = { ...(editTruckData.custom_fields || {}) };
            const trimmedSamsara = String(editTruckData.samsara_vehicle_id || '').trim();
            if (trimmedSamsara) {
                customFields.samsara_vehicle_id = trimmedSamsara;
            }
            else {
                delete customFields.samsara_vehicle_id;
                delete customFields.samsaraVehicleId;
            }
            const truckPayload = {
                truck_number: editTruckData.truck_number,
                trailer_number: editTruckData.trailer_number,
                vin: editTruckData.vin,
                equipment_type: editTruckData.equipment_type,
                driver_id: editTruckData.driver_id ?? null,
                co_driver_id: editTruckData.co_driver_id ?? null,
                custom_fields: customFields,
                samsara_vehicle_id: trimmedSamsara || null,
            };
            await axios.put(`${API_URL}/api/trucks/${editTruckData.id}`, truckPayload);
            await fetchData();
            setIsEditingProfile(false);
            toast.success('Master file successfully updated!', { id: toastId });
        }
        catch (err: any) {
            const detail = err.response?.data?.detail;
            toast.error(typeof detail === 'string' ? detail : 'Error updating profile assets.', { id: toastId });
        }
    };
    const handleDeleteDriver = async (driverId: number) => {
        if (!confirm("Are you sure you want to permanently delete this driver?"))
            return;
        try {
            await axios.delete(`${API_URL}/api/drivers/${driverId}`);
            fetchData();
            setIsEditingProfile(false);
        }
        catch (err) {
            alert("Error deleting driver.");
        }
    };
    const handleDeleteTruck = async (truckId: number) => {
        if (!confirm("Are you sure you want to permanently delete this equipment?"))
            return;
        try {
            await axios.delete(`${API_URL}/api/trucks/${truckId}`);
            setActiveAssetProfile(null);
            setIsEditingProfile(false);
            fetchData();
        }
        catch (err) {
            alert("Error deleting truck.");
        }
    };
    const dashboardContextValue = useMemo(() => ({
        drawerLoad,
        token,
        trucks,
        drivers,
        customers,
        facilities,
        setCustomers,
        setFacilities,
        teamDispatchers,
        teamDispatchersLoading,
        canViewOperationalFinancials,
        canViewNetProfit,
        setActiveDrawerLoadId,
        refreshDashboard,
        currentUserId,
        totalLoadsCount,
        unassignedLoadsCount,
        bookedLoadsCount,
        inTransitCount,
        deliveredCount,
        delayedCount,
        loadDateFilterMenuRef,
        isLoadDateMenuOpen,
        setIsLoadDateMenuOpen,
        loadDatePreset,
        loadDateFrom,
        loadDateTo,
        applyLoadDatePreset,
        handleLoadCustomDateChange,
        loadDateFilterButtonLabel,
        loadStatusFilter,
        setLoadStatusFilter,
        loadManagementView,
        setLoadManagementView,
        timeRange,
        analytics,
        boardLoads,
        boardLoadsLoading,
        loadsPage,
        loadsLimit,
        loadsPagination,
        setLoadsPage,
        setLoadsLimit,
        fetchData,
        activeDrawerLoadId,
        activeBrokerViewId,
        brokerProfileCustomer,
        closeBrokerProfile,
        activeDriverViewId,
        closeDriverProfile,
        activeTruckViewId,
        closeTruckProfile,
        openDriverProfileFromLoads,
        openTruckProfileFromLoads,
        openBrokerWorkspaceFromLoads,
        activeLoads,
        knownLoads,
        fleetTrucks,
        filteredFleetTrucks,
        etaBoard,
        router,
        searchQuery,
        fleetMetrics,
        fleetWindowStart,
        fleetWindowEnd,
        planningWindowStart,
        planningWindowEnd,
        handlePlanningWindowChange,
        planningBoardRefreshKey,
        setActiveDriverVault,
        updatingTruckStatusId,
        handleTruckStatusChange,
        handleAssetProfileClick,
        updateTruck,
    }), [
        drawerLoad,
        token,
        trucks,
        drivers,
        customers,
        facilities,
        teamDispatchers,
        teamDispatchersLoading,
        canViewOperationalFinancials,
        canViewNetProfit,
        refreshDashboard,
        currentUserId,
        totalLoadsCount,
        unassignedLoadsCount,
        bookedLoadsCount,
        inTransitCount,
        deliveredCount,
        delayedCount,
        isLoadDateMenuOpen,
        loadDatePreset,
        loadDateFrom,
        loadDateTo,
        applyLoadDatePreset,
        handleLoadCustomDateChange,
        loadDateFilterButtonLabel,
        loadStatusFilter,
        loadManagementView,
        timeRange,
        analytics,
        boardLoads,
        boardLoadsLoading,
        loadsPage,
        loadsLimit,
        loadsPagination,
        fetchData,
        activeDrawerLoadId,
        activeBrokerViewId,
        brokerProfileCustomer,
        closeBrokerProfile,
        activeDriverViewId,
        closeDriverProfile,
        activeTruckViewId,
        closeTruckProfile,
        openDriverProfileFromLoads,
        openTruckProfileFromLoads,
        openBrokerWorkspaceFromLoads,
        activeLoads,
        knownLoads,
        fleetTrucks,
        filteredFleetTrucks,
        etaBoard,
        router,
        searchQuery,
        fleetMetrics,
        fleetWindowStart,
        fleetWindowEnd,
        planningWindowStart,
        planningWindowEnd,
        handlePlanningWindowChange,
        planningBoardRefreshKey,
        updatingTruckStatusId,
        handleTruckStatusChange,
        handleAssetProfileClick,
        updateTruck,
    ]);
    return (<DashboardContext.Provider value={dashboardContextValue}>
    <div className="flex h-screen w-screen overflow-hidden flex-col md:flex-row bg-zinc-50 dark:bg-[#0B0B0B] text-zinc-900 dark:text-white font-sans transition-colors duration-200">
      <Sidebar etaAlertCount={etaAlertCount} activeDrawerLoadId={activeDrawerLoadId} onCloseLoadDrawer={() => setActiveDrawerLoadId(null)}/>

      <MobileNavDrawer open={isMobileMenuOpen} onClose={() => setIsMobileMenuOpen(false)} etaAlertCount={etaAlertCount} activeDrawerLoadId={activeDrawerLoadId} onCloseLoadDrawer={() => setActiveDrawerLoadId(null)}/>

      
        {isLoadModalOpen && (<div className="fixed inset-0 z-[80] flex items-end md:items-center justify-center bg-zinc-900/60 dark:bg-[#0B0B0B]/80 backdrop-blur-sm p-0 md:p-4 transition-colors">
            <div className="bg-white dark:bg-[#161616] border border-transparent dark:border-zinc-800 rounded-t-xl md:rounded-2xl shadow-2xl w-full max-w-full md:max-w-6xl max-h-[calc(100svh-0px)] md:max-h-[90vh] md:h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200 transition-colors">
            
            
            <div className="px-6 py-4 border-b border-zinc-100 dark:border-zinc-800 flex justify-between items-center bg-zinc-50 dark:bg-zinc-900/50 transition-colors">
                <h2 className="text-xl font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                <LayoutList className="text-zinc-700 dark:text-zinc-400" size={24}/> {isLoadEntryViewMode ? 'View Load Entry' : 'New Load Entry'}
                </h2>
                <button onClick={closeLoadEntryModal} className="p-2 text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-800 hover:text-zinc-700 dark:hover:text-zinc-300 rounded-full transition-colors">
                <X size={20}/>
                </button>
            </div>
            
            <div className="flex flex-col md:flex-row flex-1 min-h-0 overflow-hidden">
                
                <div className="order-2 md:order-1 w-full md:w-2/3 flex flex-col min-h-0 border-t md:border-t-0 md:border-r border-zinc-100 dark:border-zinc-800 transition-colors">
                
                <fieldset disabled={isLoadEntryViewMode} className={`flex-1 overflow-y-auto p-4 md:p-6 space-y-6 transition-colors ${LOAD_ENTRY_FIELDSET_CLASS}`}>
                
                
                <div className="bg-white dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 shadow-sm transition-colors">
                    <h3 className={PANEL_TITLE_CLASS}>
                    <Truck size={16}/> Load Info & Assignment
                    </h3>
                    
                    <LoadCrmBrokerLink customers={customers} onCustomersChange={setCustomers} stagedLoad={stagedLoad} setStagedLoad={setStagedLoad} apiUrl={API_URL} disabled={isLoadEntryViewMode}/>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div>
                        <label className={FORM_LABEL_CLASS}>Broker Name</label>
                        <input type="text" placeholder="e.g. TQL" value={stagedLoad?.broker_name || ''} onChange={(e) => stagedLoad ? setStagedLoad({ ...stagedLoad, broker_name: e.target.value }) : null} className="w-full border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 text-zinc-900 dark:text-white p-2 rounded-lg text-sm font-semibold outline-none focus:border-zinc-700 transition-colors"/>
                    </div>
                    <div>
                        <label className={FORM_LABEL_CLASS}>Billing Email</label>
                        <input type="text" placeholder="ap@broker.com" value={stagedLoad?.broker_email || ''} onChange={(e) => stagedLoad ? setStagedLoad({ ...stagedLoad, broker_email: e.target.value }) : null} className="w-full border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 text-zinc-900 dark:text-white p-2 rounded-lg text-sm font-semibold outline-none focus:border-zinc-700 transition-colors"/>
                    </div>
                    <div>
                        <label className={FORM_LABEL_CLASS}>Broker Address</label>
                        <input type="text" placeholder="Broker Address" value={stagedLoad?.broker_address || ''} onChange={(e) => stagedLoad ? setStagedLoad({ ...stagedLoad, broker_address: e.target.value }) : null} className="w-full border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white p-2 rounded-lg text-sm font-semibold outline-none focus:border-zinc-700 transition-colors"/>
                    </div>
                    <div>
                        <label className={FORM_LABEL_CLASS}>Broker Phone</label>
                        <input type="text" placeholder="e.g. (800) 555-0199 x 104" value={stagedLoad?.broker_phone || ''} onChange={(e) => stagedLoad ? setStagedLoad({ ...stagedLoad, broker_phone: e.target.value }) : null} className="w-full border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 text-zinc-900 dark:text-white p-2 rounded-lg text-sm font-semibold outline-none focus:border-zinc-700 transition-colors"/>
                    </div>
                </div>

                <div className="mb-4">
                    <label className={FORM_LABEL_CLASS}>Pickup Number (PU#)</label>
                    <input type="text" placeholder="e.g. PU-48291" value={stagedLoad?.pickup_number || ''} onChange={(e) => setStagedLoad({ ...(stagedLoad || {}), pickup_number: e.target.value })} className="w-full border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 text-zinc-900 dark:text-white p-2 rounded-lg text-sm font-semibold outline-none focus:border-zinc-700 transition-colors"/>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div>
                        <label className={FORM_LABEL_CLASS}>Origin (Required)</label>
                        <input type="text" placeholder="e.g. Elizabeth, NJ" value={stagedLoad?.origin || ''} onChange={(e) => setStagedLoad({ ...(stagedLoad || {}), origin: e.target.value })} className="w-full border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 text-zinc-900 dark:text-white p-2 rounded-lg text-sm font-semibold outline-none focus:border-zinc-700 transition-colors"/>
                    </div>
                    <div>
                        <label className={FORM_LABEL_CLASS}>Destination (Required)</label>
                        <input type="text" placeholder="e.g. Grove City, OH" value={stagedLoad?.destination || ''} onChange={(e) => setStagedLoad({ ...(stagedLoad || {}), destination: e.target.value })} className="w-full border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 text-zinc-900 dark:text-white p-2 rounded-lg text-sm font-semibold outline-none focus:border-zinc-700 transition-colors"/>
                    </div>
                </div>



                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                    <div>
                        <label className={FORM_LABEL_CLASS}>Gross Pay ($)</label>
                        <input type="number" placeholder="0.00" value={stagedLoad?.rate || ''} onChange={(e) => setStagedLoad({ ...stagedLoad, rate: e.target.value })} className="w-full border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white p-2 rounded-lg text-sm font-semibold outline-none focus:border-zinc-700 transition-colors"/>
                    </div>
                    <div>
                        <label className={FORM_LABEL_CLASS}>Fuel Surcharge ($)</label>
                        <input type="number" placeholder="0.00" value={stagedLoad?.fuel_surcharge || ''} onChange={(e) => setStagedLoad({ ...stagedLoad, fuel_surcharge: e.target.value })} className="w-full border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white p-2 rounded-lg text-sm font-semibold outline-none focus:border-zinc-700 transition-colors"/>
                    </div>
                    <div>
                        <label className={FORM_LABEL_CLASS}>Accessorials ($)</label>
                        <input type="number" placeholder="0.00" value={stagedLoad?.accessorial_charge || ''} onChange={(e) => setStagedLoad({ ...stagedLoad, accessorial_charge: e.target.value })} className="w-full border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white p-2 rounded-lg text-sm font-semibold outline-none focus:border-zinc-700 transition-colors"/>
                    </div>
                    <div>
                        <label className={FORM_LABEL_CLASS}>Est. Distance</label>
                        <input type="text" readOnly placeholder="Auto Calculated" value={stagedLoad ? `${stagedLoad.miles || stagedLoad.total_miles || 0} mi` : ''} className="w-full border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-2 rounded-lg text-sm font-semibold text-zinc-500 dark:text-zinc-400 cursor-not-allowed transition-colors"/>
                    </div>
                </div>

                <div className="mb-6">
                    <h4 className="text-xs font-bold tracking-wide text-zinc-500 dark:text-zinc-400 mb-3">
                      Reefer & Temperature Controls
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className={FORM_LABEL_CLASS}>
                          Target Temperature
                        </label>
                        <input type="text" placeholder="e.g. +15.0°C" value={stagedLoad?.reefer_temperature || ''} onChange={(e) => stagedLoad
                ? setStagedLoad({ ...stagedLoad, reefer_temperature: e.target.value })
                : null} className="w-full border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 text-zinc-900 dark:text-white p-2 rounded-lg text-sm font-semibold outline-none focus:border-zinc-700 transition-colors"/>
                      </div>
                      <div>
                        <label className={FORM_LABEL_CLASS}>
                          Reefer Mode
                        </label>
                        <select value={stagedLoad?.reefer_mode || 'N/A (Dry Van)'} onChange={(e) => stagedLoad
                ? setStagedLoad({ ...stagedLoad, reefer_mode: e.target.value })
                : null} className="w-full border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white p-2 rounded-lg text-sm font-semibold outline-none focus:border-zinc-700 transition-colors">
                          {REEFER_MODE_OPTIONS.map((mode) => (<option key={mode} value={mode}>
                              {mode}
                            </option>))}
                        </select>
                      </div>
                    </div>
                </div>

                    <div>
                    <label className={FORM_LABEL_CLASS}>Assign Driver & Unit</label>
                    <select className="w-full border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white p-2 rounded-lg text-sm focus:ring-1 focus:ring-zinc-600 outline-none font-medium transition-colors" value={stagedLoad?.truck_id || ''} onChange={(e) => stagedLoad ? setStagedLoad({ ...stagedLoad, truck_id: e.target.value }) : null}>
                        <option value="">Unassigned / External Carrier</option>
                        {fleetTrucks.map((truck: any) => {
                const driverName = truck.driver_name ||
                    drivers.find((d) => d.id === truck.driver_id)?.driver_name;
                const label = (driverName && String(driverName).trim()) || 'No Driver';
                return (<option key={truck.id} value={truck.id}>
                              Unit #{truck.truck_number} ({label})
                            </option>);
            })}
                    </select>
                    </div>
                    <LoadDispatcherCommissionFields stagedLoad={stagedLoad} setStagedLoad={setStagedLoad} teamDispatchers={teamDispatchers} currentUserId={currentUserId}/>
                </div>

                
                {stagedLoad && stagedLoad.stops && stagedLoad.stops.length > 0 && (<div className="space-y-4">
                    <h3 className={`${PANEL_TITLE_CLASS} mb-0`}><MapPin size={16}/> Stops Routing</h3>
                    {stagedLoad.stops.map((stop: any, index: number) => (<div key={index} className="bg-white dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 shadow-sm relative transition-colors">
                        <div className="absolute top-4 right-4 text-xs font-bold text-zinc-500 dark:text-zinc-300">{formatTitleCaseLabel(stop.stop_type || '')}</div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                            <label className={FORM_LABEL_CLASS}>Company Name</label>
                            <input type="text" value={stop.company_name || ''} readOnly className="w-full border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 text-zinc-900 dark:text-white p-2 rounded-lg text-sm font-semibold transition-colors"/>
                            </div>
                            <div>
                            <label className={FORM_LABEL_CLASS}>Address</label>
                            <input type="text" value={stop.address || ''} readOnly className="w-full border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 text-zinc-900 dark:text-white p-2 rounded-lg text-sm font-semibold transition-colors"/>
                            </div>
                            <div>
                            <label className={FORM_LABEL_CLASS}>Date / Appointment Window</label>
                            <input type="text" value={String(stop.date_time || '').trim() ||
                        compileAppointmentWindowFromStop(stop as Record<string, unknown>) ||
                        ''} readOnly className="w-full border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 text-zinc-900 dark:text-white p-2 rounded-lg text-sm transition-colors break-words"/>
                            </div>
                            <div>
                            <label className={FORM_LABEL_CLASS}>Notes</label>
                            <input type="text" value={stop.notes || ''} readOnly className="w-full border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 text-zinc-900 dark:text-white p-2 rounded-lg text-sm transition-colors"/>
                            </div>
                        </div>
                        </div>))}
                    </div>)}

                
                {stagedLoad && stagedLoad.commodities && stagedLoad.commodities.length > 0 && (<div className="space-y-4">
                    <h3 className={`${PANEL_TITLE_CLASS} mb-0`}><Package size={16}/> Commodities</h3>
                    <div className="border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden shadow-sm transition-colors">
                    <div className="w-full overflow-x-auto">
                        <table className="w-full text-left text-sm text-zinc-900 dark:text-white min-w-[480px]">
                        <thead className="bg-zinc-50 dark:bg-[#161616] border-b border-zinc-200 dark:border-zinc-800 text-xs text-zinc-500 dark:text-zinc-400 font-bold transition-colors">
                            <tr><th className="p-3">Description</th><th className="p-3">Qty</th><th className="p-3">Type</th><th className="p-3">Weight</th><th className="p-3">Dimensions</th><th className="p-3">Notes</th></tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800 bg-white dark:bg-zinc-800/50 transition-colors">
                            {stagedLoad.commodities.map((cmd: any, i: number) => (<tr key={i}>
                                <td className="p-3 font-semibold">{cmd.description}</td>
                                <td className="p-3">{cmd.quantity}</td>
                                <td className="p-3">{cmd.type}</td>
                                <td className="p-3">{cmd.weight} lbs</td>
                                <td className="p-3">{cmd.dimensions}</td>
                                <td className="p-3">{cmd.note}</td>
                            </tr>))}
                        </tbody>
                        </table>
                    </div>
                    </div>
                    </div>)}

                
                <div className="bg-white dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 shadow-sm mb-8 transition-colors">
                    <h3 className={PANEL_TITLE_CLASS}><CheckCircle size={16}/> Load Requirements & Notes</h3>
                    {stagedLoad?.requirements && (stagedLoad.requirements.driver_requirements?.length > 0 || stagedLoad.requirements.special_instructions) && (<div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-4">
                        {stagedLoad.requirements.driver_requirements?.length > 0 && (<div>
                        <label className="text-xs font-bold text-zinc-500 dark:text-zinc-400 mb-2 block">Driver Requirements</label>
                        <div className="flex flex-wrap gap-2">
                            {stagedLoad.requirements.driver_requirements.map((req: string, i: number) => (<span key={i} className="px-2 py-1 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white border border-zinc-200 dark:border-zinc-800 rounded-lg text-xs font-semibold transition-colors">{req}</span>))}
                        </div>
                        </div>)}
                        {stagedLoad.requirements.special_instructions && (<div>
                        <label className="text-xs font-bold text-zinc-500 dark:text-zinc-400 mb-2 block">Special Instructions</label>
                        <p className="bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white border border-zinc-200 dark:border-zinc-800 p-3 rounded-lg text-sm transition-colors">{stagedLoad.requirements.special_instructions}</p>
                        </div>)}
                    </div>)}
                    <div>
                        <label className="text-xs font-bold text-zinc-500 dark:text-zinc-400 mb-2 block">Load Comments</label>
                        <textarea rows={4} placeholder="Dispatcher notes, load remarks, or instructions for the driver..." value={stagedLoad?.comments || ''} onChange={(e) => setStagedLoad({ ...(stagedLoad || {}), comments: e.target.value })} className="w-full border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 text-zinc-900 dark:text-white p-3 rounded-lg text-sm font-medium outline-none focus:border-zinc-700 transition-colors resize-y min-h-[96px]"/>
                    </div>
                    {(stagedLoad?.notes || stagedLoad?.load_notes) && (<div className="mt-4 pt-4 border-t border-zinc-100 dark:border-zinc-800 transition-colors">
                        <label className="text-xs font-bold text-zinc-500 dark:text-zinc-400 mb-2 block">General Notes (from Rate Con)</label>
                        <p className="text-sm text-zinc-700 dark:text-zinc-300 bg-zinc-50 dark:bg-zinc-900/50 p-3 rounded-lg border border-zinc-100 dark:border-zinc-800 transition-colors">{stagedLoad.notes || stagedLoad.load_notes}</p>
                        </div>)}
                </div>

                </fieldset>

                <div className="shrink-0 pt-4 px-4 md:px-6 pb-4 border-t border-zinc-100 dark:border-zinc-800 flex flex-col gap-3 transition-colors">
                    {isLoadEntryViewMode ? (<div className="w-full flex justify-end">
                        <button type="button" onClick={closeLoadEntryModal} className="w-full sm:w-auto sm:min-w-[120px] px-6 py-3 rounded-xl font-bold bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors">
                          Close
                        </button>
                      </div>) : (<>
                    <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 shrink-0">
                        Initial Status
                      </span>
                      <div className="inline-flex rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-900/80 p-0.5 gap-0.5" role="group" aria-label="Initial status">
                        {([
                    { value: 'UNASSIGNED' as const, label: 'Unassigned' },
                    { value: 'BOOKED' as const, label: 'Booked' },
                ]).map((option) => {
                    const selected = (stagedLoad?.initial_status || 'UNASSIGNED') === option.value;
                    return (<button key={option.value} type="button" disabled={savingLoad} onClick={() => setStagedLoad({
                            ...(stagedLoad || emptyStagedLoad(currentUserId)),
                            initial_status: option.value,
                        })} className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors disabled:opacity-50 ${selected
                            ? option.value === 'BOOKED'
                                ? 'bg-cyan-500/15 text-cyan-600 dark:text-cyan-300 border border-cyan-500/30 shadow-sm'
                                : 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 border border-zinc-200 dark:border-zinc-600 shadow-sm'
                            : 'text-zinc-500 dark:text-zinc-400 border border-transparent hover:text-zinc-700 dark:hover:text-zinc-200'}`}>
                              {option.label}
                            </button>);
                })}
                      </div>
                    </div>
                    <div className="flex flex-col-reverse sm:flex-row gap-3">
                    <button onClick={closeLoadEntryModal} className="w-full sm:w-auto sm:min-w-[120px] px-6 py-3 rounded-xl font-bold bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors">Cancel</button>
                    
                    <button onClick={finalizeLoad} disabled={savingLoad} className="w-full sm:flex-1 px-4 py-3 rounded-xl font-bold transition-colors bg-zinc-900 dark:bg-white dark:text-black text-white hover:bg-zinc-800 dark:hover:bg-zinc-200 disabled:opacity-60">
                        {savingLoad ? 'Saving Load...' : '✓ Confirm & Save Load'}
                    </button>
                    </div>
                      </>)}
                </div>
                </div>

                <div className="order-1 md:order-2 w-full md:w-1/3 bg-zinc-50 dark:bg-[#161616] p-4 md:p-8 flex flex-col shrink-0 transition-colors max-h-[40vh] md:max-h-none overflow-y-auto">
                    {isLoadEntryViewMode ? (<div className="w-full max-w-sm mx-auto">
                        <div className="mb-6">
                          <h3 className="text-xl font-bold text-zinc-900 dark:text-white">Attached Documents</h3>
                          <p className="text-zinc-500 dark:text-zinc-400 text-sm mt-2">Files linked to this load entry.</p>
                        </div>
                        <div className="w-full rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/40 p-4">
                          {viewLoadDocumentsLoading ? (<div className="flex items-center justify-center gap-2 py-8 text-sm text-zinc-500">
                              <Loader2 size={16} className="animate-spin" aria-hidden/>
                              Loading files...
                            </div>) : viewLoadDocuments.length === 0 ? (<p className="text-sm text-zinc-500 dark:text-zinc-400 text-center py-8">No documents attached</p>) : (<ul className="space-y-2">
                              {viewLoadDocuments.map((doc) => {
                        const href = resolveLoadDocumentUrl(doc);
                        const label = loadDocumentDisplayName(doc);
                        return (<li key={doc.id}>
                                    {href ? (<button type="button" onClick={(event) => openLoadDocumentFromView(event, href)} className="w-full flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors text-left">
                                        <FileText size={16} className="shrink-0 text-zinc-400" aria-hidden/>
                                        <span className="flex-1 min-w-0 truncate">{label}</span>
                                      </button>) : (<div className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm text-zinc-500 dark:text-zinc-400">
                                        <FileText size={16} className="shrink-0" aria-hidden/>
                                        <span className="flex-1 min-w-0 truncate">{label}</span>
                                      </div>)}
                                  </li>);
                    })}
                            </ul>)}
                        </div>
                      </div>) : (<div className="w-full max-w-sm mx-auto flex flex-col items-center justify-center">
                    <div className="text-center mb-8 w-full">
                        {rateConParsing ? (<>
                            <h3 className="text-2xl font-bold text-zinc-900 dark:text-white flex items-center justify-center gap-2">
                              <Loader2 className="animate-spin text-emerald-500" size={28}/>
                              AI Parsing
                            </h3>
                            <p className="text-zinc-500 dark:text-zinc-400 text-sm mt-2">AI is reading your Rate Confirmation...</p>
                          </>) : rateConQuotaRetryCountdown > 0 && file ? (<>
                            <h3 className="text-2xl font-bold text-amber-600 dark:text-amber-400 flex items-center justify-center gap-2">
                              <Clock size={28}/>
                              AI Limit Reached
                            </h3>
                            <p className="text-zinc-500 dark:text-zinc-400 text-sm mt-2">
                              Free tier quota exhausted. Use Retry when the countdown completes or continue filling the form manually.
                            </p>
                          </>) : file && rateConParseFailed ? (<>
                            <h3 className="text-2xl font-bold text-zinc-900 dark:text-white">Parse Unsuccessful</h3>
                            <p className="text-zinc-500 dark:text-zinc-400 text-sm mt-2">
                              Your document is still attached. Retry extraction or remove the file to continue manually.
                            </p>
                          </>) : file ? (<>
                            <h3 className="text-2xl font-bold text-zinc-900 dark:text-white">Rate Con Attached</h3>
                            <p className="text-zinc-500 dark:text-zinc-400 text-sm mt-2">Fields on the left were auto-filled from your document. Review them, then confirm to save.</p>
                          </>) : (<>
                            <h3 className="text-2xl font-bold text-zinc-900 dark:text-white">AI Smart Assist Mode</h3>
                            <p className="text-zinc-500 dark:text-zinc-400 text-sm mt-2">Drop or click to upload a broker rate confirmation. The AI will read, extract, and populate the load details automatically.</p>
                          </>)}
                    </div>
                    <div className={`w-full border-2 border-dashed rounded-3xl flex flex-col items-center justify-center p-6 md:p-12 transition-all ${rateConParsing
                    ? 'border-emerald-400 dark:border-emerald-600 bg-emerald-50/50 dark:bg-emerald-900/10 cursor-wait'
                    : file && rateConParseFailed
                        ? 'border-amber-400 dark:border-amber-600 bg-amber-50/30 dark:bg-amber-900/10 cursor-default'
                        : rateConQuotaRetryCountdown > 0
                            ? 'border-amber-400 dark:border-amber-600 bg-amber-50/50 dark:bg-amber-900/10 cursor-not-allowed'
                            : file
                                ? 'border-zinc-500 dark:border-zinc-500 bg-zinc-100 dark:bg-zinc-900/60 shadow-inner cursor-pointer'
                                : 'border-zinc-300 dark:border-zinc-800 hover:border-zinc-500 dark:hover:border-zinc-500 bg-white dark:bg-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800/80 cursor-pointer'}`} onClick={() => { if (!rateConParsing && rateConQuotaRetryCountdown <= 0)
                fileInputRef.current?.click(); }} onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }} onDrop={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (rateConParsing || rateConQuotaRetryCountdown > 0)
                        return;
                    const dropped = e.dataTransfer.files?.[0];
                    if (dropped)
                        handleRateConUpload(dropped);
                }}>
                        <input type="file" accept=".pdf,.png,.jpg,.jpeg" className="hidden" ref={fileInputRef} disabled={rateConParsing || rateConQuotaRetryCountdown > 0} onChange={(e) => {
                    const uploaded = e.target.files?.[0];
                    if (uploaded)
                        handleRateConUpload(uploaded);
                    e.target.value = '';
                }}/>
                        {rateConParsing ? (<>
                            <FileText className="text-emerald-500/50 dark:text-emerald-400/50 mb-4" size={48}/>
                            {file && (<p className="font-bold text-zinc-900 dark:text-white text-center truncate w-full px-4 text-base">
                                {file.name}
                              </p>)}
                        </>) : file ? (<>
                            <FileText className={`mb-4 ${rateConParseFailed ? 'text-amber-500/70 dark:text-amber-400/70' : 'text-zinc-700 dark:text-zinc-300'}`} size={48}/>
                            <p className="font-bold text-zinc-900 dark:text-white text-center truncate w-full px-4 text-base">{file.name}</p>
                            <div className="flex items-center justify-center gap-3 mt-3">
                              {rateConParseFailed && (<button type="button" onClick={(e) => {
                            e.stopPropagation();
                            handleRateConRetry();
                        }} disabled={rateConParsing || rateConQuotaRetryCountdown > 0} className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-lg border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors ${rateConParsing || rateConQuotaRetryCountdown > 0
                            ? 'cursor-not-allowed opacity-50'
                            : ''}`}>
                                  <RefreshCw className={`w-3.5 h-3.5 ${rateConParsing ? 'animate-spin' : ''}`} aria-hidden/>
                                  {rateConQuotaRetryCountdown > 0
                            ? `Retry in ${rateConQuotaRetryCountdown}s`
                            : 'Retry'}
                                </button>)}
                              <button type="button" onClick={(e) => {
                        e.stopPropagation();
                        clearRateConAttachment();
                    }} disabled={rateConParsing} className={`text-xs text-red-500 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 font-bold transition-colors ${rateConParsing ? 'cursor-not-allowed opacity-50' : ''}`}>
                                Remove
                              </button>
                            </div>
                        </>) : (<>
                            <UploadCloud className="text-zinc-400 dark:text-zinc-500 mb-4" size={48}/>
                            <p className="font-bold text-zinc-600 dark:text-zinc-300 text-base">Attach Rate Con (Optional)</p>
                            <p className="text-xs font-medium text-zinc-400 dark:text-zinc-500 mt-2">PDF, PNG, or JPG — drop to auto-fill</p>
                        </>)}
                    </div>
                    </div>)}
                </div>
            </div>
            </div>
        </div>)}

      <SettleModal isOpen={!!settleModalId} onClose={() => setSettleModalId(null)} onSuccess={async () => {
            requestBillingRefresh(settleModalId ?? undefined);
            await fetchData();
        }} loadId={settleModalId}/>

      <UploadRevisionModal isOpen={isRevisionModalOpen} onClose={handleCloseRevisionModal} loadId={selectedLoadIdForRevision} onApplied={refreshDashboard}/>

      
        {activeVaultLoad && (<div className="fixed inset-0 bg-zinc-900/60 dark:bg-[#0B0B0B]/80 flex items-center justify-center z-[100] p-4 backdrop-blur-sm transition-colors">
            <div className="bg-white dark:bg-[#161616] border border-transparent dark:border-zinc-800 rounded-2xl p-6 w-full max-w-lg shadow-xl animate-in zoom-in-95 duration-200 transition-colors flex flex-col">
            
            <div className="flex justify-between items-center mb-6">
                <h3 className="font-bold text-lg text-zinc-900 dark:text-white">
                📄 Load Document Manager
                </h3>
                <button onClick={() => setActiveVaultLoad(null)} className="text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-300 p-1.5 rounded-full transition-colors">
                <X size={20}/>
                </button>
            </div>

            <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-4">
              Load ID: <span className="font-mono font-bold text-zinc-700 dark:text-zinc-200">{activeVaultLoad}</span>
              <span className="mx-2">•</span>
              Uploading a POD auto-settles the invoice and releases capital to analytics.
            </p>
            
            <div className="flex gap-3 mb-4">
                <select id={`doc-type-${activeVaultLoad}`} className="border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-zinc-900 dark:text-white p-2.5 rounded-lg text-sm font-medium outline-none focus:ring-2 focus:ring-zinc-600 w-full transition-colors">
                <option value="POD">Signed POD</option>
                <option value="BOL">Signed BOL</option>
                <option value="Rate Confirmation">Rate Confirmation</option>
                <option value="Lumper">Lumper Receipt</option>
                <option value="Scale Ticket">Scale Ticket</option>
                </select>
            </div>

            <div onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }} onDrop={(e) => handleVaultDrop(e, activeVaultLoad)} className="border-2 border-dashed border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/50 rounded-xl p-8 text-center mb-6 transition-colors hover:border-zinc-500 dark:hover:border-zinc-500">
                <FolderOpen className="mx-auto text-zinc-500 mb-3" size={28}/>
                <p className="text-sm font-semibold text-zinc-700 dark:text-zinc-200 mb-1">
                  {uploadingDoc ? 'Uploading file...' : 'Drop POD or BOL here'}
                </p>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-4">PDF, PNG, or JPG accepted</p>
                <input type="file" id={`doc-file-${activeVaultLoad}`} className="hidden" accept=".pdf,.png,.jpg,.jpeg" onChange={(e) => handleUploadToVault(e, activeVaultLoad)}/>
                <button onClick={() => document.getElementById(`doc-file-${activeVaultLoad}`)?.click()} disabled={uploadingDoc} className="bg-zinc-900 hover:bg-zinc-800 dark:bg-white dark:text-black dark:hover:bg-zinc-200 dark:bg-zinc-1000 dark:hover:bg-zinc-900 dark:bg-white dark:text-black text-white rounded-lg text-sm font-semibold px-4 py-2 transition-all disabled:opacity-50 shadow-sm">
                {uploadingDoc ? 'Uploading...' : 'Browse Files'}
                </button>
            </div>
            
            
            <div className="space-y-3 max-h-[300px] overflow-y-auto">
                {vaultDocs.length === 0 ? (<div className="border-2 border-dashed border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50 rounded-xl p-8 text-center transition-colors">
                    <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
                    No documents attached yet.
                    </p>
                </div>) : vaultDocs.map(doc => (<div key={doc.id} className="flex justify-between items-center p-4 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-800 shadow-sm rounded-xl hover:border-zinc-500 dark:hover:border-zinc-500 transition-colors">
                    <div className="flex items-center gap-3">
                    <div className="bg-zinc-100 dark:bg-zinc-800 p-2 rounded-lg">
                        <FileText size={18} className="text-zinc-700 dark:text-zinc-300"/>
                    </div>
                    <div>
                        <p className="text-sm font-bold text-zinc-700 dark:text-zinc-200">{doc.document_type}</p>
                        <p className="text-xs text-zinc-400 dark:text-zinc-500">{new Date(doc.uploaded_at).toLocaleDateString()}</p>
                    </div>
                    </div>
                    <a href={doc.file_url?.startsWith('http')
                    ? doc.file_url
                    : `${API_URL}${doc.file_url || doc.file_path || ''}`} target="_blank" rel="noreferrer" className="px-3 py-1.5 bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-300 text-xs font-bold rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors">
                    View File
                    </a>
                </div>))}
            </div>

            </div>
        </div>)}

      
      {activeFuelVault && (<div className="fixed inset-0 bg-zinc-900/60 dark:bg-[#0B0B0B]/80 flex items-center justify-center z-[80] p-4 backdrop-blur-sm transition-colors">
            <div className="bg-white dark:bg-[#161616] border border-transparent dark:border-zinc-800 rounded-2xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col transition-colors">
                
                
                <div className="p-5 border-b border-zinc-100 dark:border-zinc-800 flex justify-between items-center bg-zinc-50 dark:bg-zinc-900/50 transition-colors">
                    <h3 className="font-bold text-lg text-zinc-900 dark:text-white flex items-center gap-2">
                    <FolderOpen className="text-emerald-500 dark:text-emerald-400" size={20}/> 
                    Fuel Receipts (Entry ID: {activeFuelVault})
                    </h3>
                    <button onClick={() => setActiveFuelVault(null)} className="text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-300 p-1.5 rounded-full transition-colors">
                    <X size={20}/>
                    </button>
                </div>
                
                
                <div className="p-6 space-y-6">
                    <div className="flex gap-3">
                        <input type="file" id={`fuel-doc-file-${activeFuelVault}`} className="hidden" onChange={(e) => handleUploadFuelDoc(e, activeFuelVault)}/>
                        <button onClick={() => document.getElementById(`fuel-doc-file-${activeFuelVault}`)?.click()} disabled={uploadingDoc} className="flex-grow bg-zinc-800 hover:bg-zinc-900 dark:bg-zinc-700 dark:hover:bg-zinc-700 text-white py-2.5 rounded-lg text-sm font-bold shadow-sm transition-all disabled:bg-zinc-400 dark:disabled:bg-zinc-800">
                            {uploadingDoc ? 'Uploading...' : 'Upload Receipt Image/PDF'}
                        </button>
                        {selectedFuelDocs.length > 0 && (<button onClick={handleDeleteSelectedFuelDocs} className="bg-red-500 hover:bg-red-600 dark:bg-red-600 dark:hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-all">
                                Delete Selected
                            </button>)}
                    </div>
                    
                    
                    <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
                        {fuelDocs.length === 0 ? (<div className="text-center p-8 bg-zinc-50 dark:bg-zinc-800/50 rounded-xl border-2 border-dashed border-zinc-200 dark:border-zinc-800 transition-colors">
                            <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">No receipts attached yet.</p>
                            </div>) : fuelDocs.map(doc => (<div key={doc.id} className="flex justify-between items-center p-4 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-800 shadow-sm rounded-xl hover:border-emerald-300 dark:hover:border-emerald-500 transition-colors">
                                <div className="flex items-center gap-3">
                                    <input type="checkbox" checked={selectedFuelDocs.includes(doc.id)} onChange={(e) => {
                    if (e.target.checked)
                        setSelectedFuelDocs([...selectedFuelDocs, doc.id]);
                    else
                        setSelectedFuelDocs(selectedFuelDocs.filter(id => id !== doc.id));
                }} className="w-4 h-4 text-emerald-600 rounded border-zinc-300 dark:border-zinc-700 bg-white dark:bg-[#0B0B0B] focus:ring-emerald-500 dark:focus:ring-emerald-400 dark:focus:ring-offset-zinc-900 transition-colors"/>
                                    <div className="bg-emerald-50 dark:bg-emerald-900/30 p-2 rounded-lg transition-colors">
                                    <FileText size={18} className="text-emerald-600 dark:text-emerald-400"/>
                                    </div>
                                    <div>
                                    <p className="text-sm font-bold text-zinc-700 dark:text-zinc-200">Receipt Document</p>
                                    <p className="text-xs text-zinc-400 dark:text-zinc-500">{new Date(doc.uploaded_at).toLocaleDateString()}</p>
                                    </div>
                                </div>
                                <a href={doc.file_url || `${API_URL}${doc.file_path}`} target="_blank" rel="noreferrer" className="px-3 py-1.5 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 text-xs font-bold rounded-md hover:bg-emerald-100 dark:hover:bg-emerald-900/50 transition-colors">
                                View File
                                </a>
                            </div>))}
                    </div>
                </div>
            </div>
        </div>)}

      
      {activeDriverVault && (() => {
            const vaultDriver = drivers.find(d => d.id === activeDriverVault);
            const vaultDriverName = vaultDriver?.driver_name ||
                trucks.find(t => t.driver_id === activeDriverVault)?.driver_name ||
                trucks.find(t => t.co_driver_id === activeDriverVault)?.co_driver_name ||
                `ID ${activeDriverVault}`;
            return (<div className="fixed inset-0 z-[90] bg-zinc-900/60 dark:bg-[#0B0B0B]/80 flex items-center justify-center p-4 backdrop-blur-sm transition-colors">
            <div className="bg-white dark:bg-[#161616] border border-transparent dark:border-zinc-800 rounded-2xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col transition-colors">
                <div className="p-5 border-b border-zinc-100 dark:border-zinc-800 flex justify-between items-center bg-zinc-50 dark:bg-zinc-900/50 transition-colors">
                    <h3 className="font-bold text-lg text-zinc-900 dark:text-white flex items-center gap-2">
                        <FolderOpen className="text-zinc-500 dark:text-zinc-300" size={20}/>
                        Driver Files — {vaultDriverName}
                    </h3>
                    <button onClick={() => setActiveDriverVault(null)} className="text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-300 p-1.5 rounded-full transition-colors">
                        <X size={20}/>
                    </button>
                </div>

                <div className="p-6 space-y-6">
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">
                        Optional compliance documents — licenses, medical cards, TWIC cards, and other driver files.
                    </p>

                    <select id={`driver-doc-type-${activeDriverVault}`} className="border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-zinc-900 dark:text-white p-2.5 rounded-lg text-sm font-medium outline-none focus:ring-2 focus:ring-zinc-600 w-full transition-colors">
                        <option value="Driver's License">Driver&apos;s License</option>
                        <option value="Medical Card">Medical Card</option>
                        <option value="TWIC Card">TWIC Card</option>
                        <option value="Driver Document">Other Document</option>
                    </select>

                    <div onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }} onDrop={(e) => handleDriverVaultDrop(e, activeDriverVault)} className="border-2 border-dashed border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50 rounded-xl p-6 text-center transition-colors">
                        <UploadCloud size={28} className="mx-auto text-zinc-400 dark:text-zinc-500 mb-2"/>
                        <p className="text-sm font-semibold text-zinc-700 dark:text-zinc-200 mb-1">Drag & drop or browse</p>
                        <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-4">PDF, PNG, or JPG accepted</p>
                        <input type="file" id={`driver-doc-file-${activeDriverVault}`} className="hidden" accept=".pdf,.png,.jpg,.jpeg" onChange={(e) => handleUploadDriverDoc(e, activeDriverVault)}/>
                        <button onClick={() => document.getElementById(`driver-doc-file-${activeDriverVault}`)?.click()} disabled={uploadingDoc} className="bg-zinc-900 hover:bg-zinc-800 dark:bg-white dark:text-black dark:hover:bg-zinc-200 text-white rounded-lg text-sm font-semibold px-4 py-2 transition-all disabled:opacity-50 shadow-sm">
                            {uploadingDoc ? 'Uploading...' : 'Browse Files'}
                        </button>
                    </div>

                    <div className="space-y-3 max-h-[300px] overflow-y-auto">
                        {driverDocs.length === 0 ? (<div className="border-2 border-dashed border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50 rounded-xl p-8 text-center transition-colors">
                                <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">No documents attached yet.</p>
                            </div>) : driverDocs.map(doc => (<div key={doc.id} className="flex justify-between items-center p-4 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-800 shadow-sm rounded-xl hover:border-zinc-500 dark:hover:border-zinc-500 transition-colors">
                                <div className="flex items-center gap-3">
                                    <div className="bg-zinc-100 dark:bg-zinc-800 p-2 rounded-lg">
                                        <FileText size={18} className="text-zinc-700 dark:text-zinc-300"/>
                                    </div>
                                    <div>
                                        <p className="text-sm font-bold text-zinc-700 dark:text-zinc-200">{doc.document_type || doc.file_name || 'Document'}</p>
                                        <p className="text-xs text-zinc-400 dark:text-zinc-500">{doc.uploaded_at ? new Date(doc.uploaded_at).toLocaleDateString() : ''}</p>
                                    </div>
                                </div>
                                <a href={doc.file_url?.startsWith('http')
                        ? doc.file_url
                        : `${API_URL}${doc.file_url || (doc.file_path ? `/${doc.file_path.replace(/^\/+/, '')}` : '')}`} target="_blank" rel="noreferrer" className="px-3 py-1.5 bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-300 text-xs font-bold rounded-md hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors">
                                    View File
                                </a>
                            </div>))}
                    </div>
                </div>
            </div>
        </div>);
        })()}

        
      {activeAssetProfile && (() => {
            const profileTruck = trucks.find(t => t.id === activeAssetProfile);
            const profileDriver = drivers.find(d => d.id === profileTruck?.driver_id);
            const profileCoDriver = drivers.find(d => d.id === profileTruck?.co_driver_id);
            const coDriverDisplayName = profileTruck?.co_driver_name || profileCoDriver?.driver_name;
            const coDriverCdl = profileTruck?.co_driver_cdl ?? profileCoDriver?.cdl_number;
            const coDriverPhone = profileTruck?.co_driver_phone ?? profileCoDriver?.phone_number;
            const coDriverEmail = profileTruck?.co_driver_email ?? profileCoDriver?.email;
            const coDriverPay = profileTruck?.co_driver_pay_percentage ?? profileCoDriver?.pay_percentage;
            const hasCoDriver = !!(profileTruck?.co_driver_id || coDriverDisplayName);
            const coDriverVaultId = profileCoDriver?.id ?? profileTruck?.co_driver_id ?? null;
            const assignedLoads = knownLoads.filter((h) => h.truck_id === profileTruck?.id);
            return (<div className="fixed inset-0 bg-zinc-900/60 dark:bg-[#0B0B0B]/80 flex items-center justify-center z-[80] p-4 backdrop-blur-sm transition-colors">
              <div className="bg-white dark:bg-[#161616] border border-transparent dark:border-zinc-800 rounded-2xl shadow-xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[90vh] transition-colors">
                  
                  
                  <div className="p-6 border-b border-zinc-100 dark:border-zinc-800 flex justify-between items-center bg-zinc-800 dark:bg-[#0B0B0B] text-white transition-colors">
                      <div>
                          <h3 className="font-bold text-xl flex items-center gap-2">
                              <Truck className="text-zinc-400" size={24}/> Unit #{profileTruck?.truck_number} Master File
                          </h3>
                          <p className="text-zinc-300 text-sm mt-1">Detailed asset, driver, and operational history</p>
                      </div>
                      <div className="flex items-center gap-3">
                          {isEditingProfile ? (<button onClick={saveProfileEdits} className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-4 py-2 rounded-lg flex items-center gap-1.5 transition-all shadow"><Save size={14}/> Save Changes</button>) : (<button onClick={() => startEditingProfile(profileTruck, profileDriver)} className="bg-zinc-900 hover:bg-zinc-800 dark:bg-white dark:text-black dark:hover:bg-zinc-200 text-white text-xs font-bold px-4 py-2 rounded-lg flex items-center gap-1.5 transition-all shadow"><Edit3 size={14}/> Edit Info</button>)}
                          <button onClick={() => { setActiveAssetProfile(null); setIsEditingProfile(false); }} className="text-zinc-300 hover:text-white transition-colors bg-zinc-700 dark:bg-zinc-800 p-2 rounded-full"><X size={16}/></button>
                      </div>
                  </div>
                  
                  
                  <div className="p-8 overflow-y-auto bg-zinc-50 dark:bg-[#161616] flex-grow transition-colors">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
                          
                          
                          <div className="bg-white dark:bg-zinc-800/50 p-6 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm relative group transition-colors">
                              <div className="flex justify-between items-center border-b border-zinc-100 dark:border-zinc-800 pb-3 mb-4 transition-colors">
                                  <h4 className="font-bold text-zinc-700 dark:text-zinc-300 flex items-center gap-2 uppercase tracking-wider text-sm"><UserCircle size={18}/> Driver Information</h4>
                                  {profileDriver && !isEditingProfile && (<button onClick={() => handleDeleteDriver(profileDriver.id)} className="text-zinc-400 dark:text-zinc-500 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 p-1.5 rounded-md transition-colors" title="Remove Driver"><Trash2 size={16}/></button>)}
                              </div>
                              
                              {isEditingProfile ? (<div className="space-y-3 text-sm">
                                      <div>
                                          <label className="text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase">Assigned Driver</label>
                                          <select className="w-full border border-zinc-200 dark:border-zinc-800 p-2 rounded mt-1 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white font-semibold focus:outline-none focus:ring-1 focus:ring-zinc-600 transition-colors" value={editTruckData?.driver_id || ""} onChange={(e) => { const newDriverId = e.target.value ? parseInt(e.target.value) : null; setEditTruckData({ ...editTruckData, driver_id: newDriverId }); setEditDriverData(drivers.find(d => d.id === newDriverId) ? { ...drivers.find(d => d.id === newDriverId) } : null); }}>
                                              <option value="">Unassigned / Solo Pool</option>
                                              {drivers.filter((d: any) => d.id !== editTruckData?.co_driver_id).map((d: any) => <option key={d.id} value={d.id}>{d.driver_name}</option>)}
                                          </select>
                                      </div>
                                      <div>
                                          <label className="text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase">Assign Co-Driver (Team Pool)</label>
                                          <select className="w-full border border-zinc-200 dark:border-zinc-800 p-2 rounded mt-1 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white font-semibold focus:outline-none focus:ring-1 focus:ring-zinc-600 transition-colors" value={editTruckData?.co_driver_id || ""} onChange={(e) => { const newCoDriverId = e.target.value ? parseInt(e.target.value) : null; setEditTruckData({ ...editTruckData, co_driver_id: newCoDriverId }); }}>
                                              <option value="">Unassigned / Solo Pool</option>
                                              {drivers.filter((d: any) => d.id !== editTruckData?.driver_id).map((d: any) => <option key={d.id} value={d.id}>{d.driver_name}</option>)}
                                          </select>
                                      </div>

                                      {editDriverData ? (<div className="pt-2 space-y-3 border-t border-zinc-100 dark:border-zinc-800 mt-3 transition-colors">
                                              <div><label className="text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase">Driver Name</label><input type="text" className="w-full border border-zinc-200 dark:border-zinc-800 p-2 rounded mt-1 bg-zinc-50 dark:bg-zinc-900/50 text-zinc-900 dark:text-white font-semibold focus:outline-none focus:ring-1 focus:ring-zinc-600 transition-colors" value={editDriverData.driver_name || ''} onChange={e => setEditDriverData({ ...editDriverData, driver_name: e.target.value })}/></div>
                                              <div><label className="text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase">CDL Number</label><input type="text" className="w-full border border-zinc-200 dark:border-zinc-800 p-2 rounded mt-1 bg-zinc-50 dark:bg-zinc-900/50 text-zinc-900 dark:text-white font-semibold focus:outline-none focus:ring-1 focus:ring-zinc-600 transition-colors" value={editDriverData.cdl_number || ''} onChange={e => setEditDriverData({ ...editDriverData, cdl_number: e.target.value })}/></div>
                                              <div><label className="text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase">Phone Number</label><input type="text" className="w-full border border-zinc-200 dark:border-zinc-800 p-2 rounded mt-1 bg-zinc-50 dark:bg-zinc-900/50 text-zinc-900 dark:text-white font-semibold focus:outline-none focus:ring-1 focus:ring-zinc-600 transition-colors" value={editDriverData.phone_number || ''} onChange={e => setEditDriverData({ ...editDriverData, phone_number: e.target.value })}/></div>
                                              <div><label className="text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase">Email</label><input type="email" className="w-full border border-zinc-200 dark:border-zinc-800 p-2 rounded mt-1 bg-zinc-50 dark:bg-zinc-900/50 text-zinc-900 dark:text-white font-semibold focus:outline-none focus:ring-1 focus:ring-zinc-600 transition-colors" value={editDriverData.email || ''} onChange={e => setEditDriverData({ ...editDriverData, email: e.target.value })}/></div>
                                              <div><label className="text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase">Pay Percentage (%)</label><input type="number" className="w-full border border-zinc-200 dark:border-zinc-800 p-2 rounded mt-1 bg-zinc-50 dark:bg-zinc-900/50 text-zinc-900 dark:text-white font-semibold focus:outline-none focus:ring-1 focus:ring-zinc-600 transition-colors" value={editDriverData.pay_percentage ?? ''} onChange={e => setEditDriverData({ ...editDriverData, pay_percentage: parseFloat(e.target.value) })}/></div>
                                              
                                              {editDriverData.custom_fields && Object.keys(editDriverData.custom_fields).map(key => (<div key={key} className="pt-1"><label className="text-xs font-bold text-zinc-500 dark:text-zinc-300 uppercase">{key}</label><input type="text" className="w-full border border-zinc-200 dark:border-zinc-800 p-2 rounded mt-1 bg-zinc-100/50 dark:bg-zinc-900/60 text-zinc-900 dark:text-white font-semibold focus:outline-none focus:ring-1 focus:ring-zinc-600 transition-colors" value={editDriverData.custom_fields[key] || ''} onChange={e => setEditDriverData({ ...editDriverData, custom_fields: { ...editDriverData.custom_fields, [key]: e.target.value } })}/></div>))}
                                          </div>) : (<div className="bg-zinc-50 dark:bg-zinc-900/50 p-4 rounded-lg border border-zinc-200 dark:border-zinc-800 text-center mt-4 transition-colors"><p className="text-zinc-500 dark:text-zinc-400 text-sm font-medium">Select a driver above to edit their details.</p></div>)}
                                  </div>) : profileDriver ? (<div className="space-y-4">
                                      <div className="grid grid-cols-2 gap-2 text-sm">
                                          <p className="text-zinc-500 dark:text-zinc-400 font-medium">Name</p>
                                          <div className="flex items-center justify-end gap-2 min-w-0">
                                              <p className="font-bold text-zinc-900 dark:text-white text-right truncate">{profileDriver.driver_name}</p>
                                              <button type="button" onClick={() => setActiveDriverVault(profileDriver.id)} className="text-xs font-bold bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 px-2 py-1 rounded-md transition-colors inline-flex items-center gap-1 shrink-0" title="View primary driver files">
                                                  <FolderOpen size={12}/> View Files
                                              </button>
                                          </div>
                                          <p className="text-zinc-500 dark:text-zinc-400 font-medium">CDL</p><p className="font-mono font-bold text-zinc-900 dark:text-white text-right">{profileDriver.cdl_number || '-'}</p>
                                          <p className="text-zinc-500 dark:text-zinc-400 font-medium">Phone</p><p className="font-bold text-zinc-900 dark:text-white text-right">{profileDriver.phone_number || '-'}</p>
                                          <p className="text-zinc-500 dark:text-zinc-400 font-medium">Email</p><p className="font-bold text-zinc-900 dark:text-white text-right">{profileDriver.email || '-'}</p>
                                          <p className="text-zinc-500 dark:text-zinc-400 font-medium">Pay Cut</p><p className="font-bold text-emerald-600 dark:text-emerald-400 text-right">{profileDriver.pay_percentage}%</p>
                                      </div>
                                      {hasCoDriver && (<div className="pt-4 border-t border-zinc-100 dark:border-zinc-800 transition-colors">
                                              <div className="grid grid-cols-2 gap-2 text-sm">
                                                  <p className="text-zinc-500 dark:text-zinc-400 font-medium">Co-Driver</p>
                                                  <div className="flex items-center justify-end gap-2 min-w-0">
                                                      <p className="font-semibold text-zinc-400 dark:text-zinc-500 text-right truncate">{coDriverDisplayName || '-'}</p>
                                                      {coDriverVaultId && (<button type="button" onClick={() => setActiveDriverVault(coDriverVaultId)} className="text-xs font-bold bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 px-2 py-1 rounded-md transition-colors inline-flex items-center gap-1 shrink-0" title="View co-driver files">
                                                              <FolderOpen size={12}/> View Files
                                                          </button>)}
                                                  </div>
                                                  <p className="text-zinc-500 dark:text-zinc-400 font-medium">CDL</p><p className="font-mono font-bold text-zinc-900 dark:text-white text-right">{coDriverCdl || '-'}</p>
                                                  <p className="text-zinc-500 dark:text-zinc-400 font-medium">Phone</p><p className="font-bold text-zinc-900 dark:text-white text-right">{coDriverPhone || '-'}</p>
                                                  <p className="text-zinc-500 dark:text-zinc-400 font-medium">Email</p><p className="font-bold text-zinc-900 dark:text-white text-right">{coDriverEmail || '-'}</p>
                                                  <p className="text-zinc-500 dark:text-zinc-400 font-medium">Pay Cut</p><p className="font-bold text-emerald-600 dark:text-emerald-400 text-right">{coDriverPay != null ? `${coDriverPay}%` : '-'}</p>
                                              </div>
                                          </div>)}
                                      {profileDriver.custom_fields && Object.keys(profileDriver.custom_fields).length > 0 && (<div className="pt-4 border-t border-zinc-100 dark:border-zinc-800 mt-4 transition-colors">
                                              <p className="text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase mb-2">Custom Fields</p>
                                              <div className="grid grid-cols-2 gap-2 text-sm">
                                                  {Object.entries(profileDriver.custom_fields).map(([key, value]) => (<React.Fragment key={key}><p className="text-zinc-500 dark:text-zinc-400 font-medium">{key}</p><FleetCustomFieldValue label={key} value={String(value)}/></React.Fragment>))}
                                              </div>
                                          </div>)}
                                  </div>) : (<div className="bg-zinc-50 dark:bg-zinc-900/50 p-6 rounded-lg border border-zinc-200 dark:border-zinc-800 text-center transition-colors">
                                      <p className="text-zinc-500 dark:text-zinc-400 text-sm font-medium mb-1">No driver assigned.</p>
                                      <p className="text-xs text-zinc-400 dark:text-zinc-500">Click "Edit Info" to assign a driver to this unit.</p>
                                  </div>)}
                          </div>

                          
                          <div className="bg-white dark:bg-zinc-800/50 p-6 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm relative group transition-colors">
                              <div className="flex justify-between items-center border-b border-zinc-100 dark:border-zinc-800 pb-3 mb-4 transition-colors">
                                  <h4 className="font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-2 uppercase tracking-wider text-sm"><Truck size={18}/> Equipment Information</h4>
                                  {profileTruck && !isEditingProfile && (<button onClick={() => handleDeleteTruck(profileTruck.id)} className="text-zinc-400 dark:text-zinc-500 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 p-1.5 rounded-md transition-colors" title="Delete Truck"><Trash2 size={16}/></button>)}
                              </div>

                              <div className="space-y-4">
                                  {isEditingProfile && editTruckData ? (<div className="space-y-3 text-sm">
                                          <div><label className="text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase">Truck Number</label><input type="text" className="w-full border border-zinc-200 dark:border-zinc-800 p-2 rounded mt-1 bg-zinc-50 dark:bg-zinc-900/50 text-zinc-900 dark:text-white font-semibold focus:outline-none focus:ring-1 focus:ring-emerald-500 transition-colors" value={editTruckData.truck_number || ''} onChange={e => setEditTruckData({ ...editTruckData, truck_number: e.target.value })}/></div>
                                          <div><label className="text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase">Trailer Number</label><input type="text" className="w-full border border-zinc-200 dark:border-zinc-800 p-2 rounded mt-1 bg-zinc-50 dark:bg-zinc-900/50 text-zinc-900 dark:text-white font-semibold focus:outline-none focus:ring-1 focus:ring-emerald-500 transition-colors" value={editTruckData.trailer_number || ''} onChange={e => setEditTruckData({ ...editTruckData, trailer_number: e.target.value })}/></div>
                                          <div><label className="text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase">VIN</label><input type="text" className="w-full border border-zinc-200 dark:border-zinc-800 p-2 rounded mt-1 bg-zinc-50 dark:bg-zinc-900/50 text-zinc-900 dark:text-white font-semibold focus:outline-none focus:ring-1 focus:ring-emerald-500 transition-colors" value={editTruckData.vin || ''} onChange={e => setEditTruckData({ ...editTruckData, vin: e.target.value })}/></div>
                                          <div><label className="text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase">Trailer Type</label><select className="w-full border border-zinc-200 dark:border-zinc-800 p-2 rounded mt-1 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white font-semibold focus:outline-none focus:ring-1 focus:ring-emerald-500 transition-colors" value={editTruckData.equipment_type || ''} onChange={e => setEditTruckData({ ...editTruckData, equipment_type: e.target.value })}><option>Reefer</option><option>Dry Van</option><option>Flatbed</option><option>Stepdeck</option></select></div>
                                          <div>
                                            <label className="text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase">Samsara Vehicle ID (Optional)</label>
                                            <input type="text" placeholder="e.g., 2834792374" className="w-full rounded-lg border border-zinc-200 dark:border-zinc-800 bg-transparent px-3 py-2 text-sm mt-1 focus:outline-none focus:ring-1 focus:ring-emerald-500 transition-colors" value={editTruckData.samsara_vehicle_id || ''} onChange={e => setEditTruckData({ ...editTruckData, samsara_vehicle_id: e.target.value })}/>
                                            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1.5 italic">
                                              Optional. Used to explicitly tie this truck to its physical Samsara hardware if the truck number doesn&apos;t match the Samsara vehicle name.
                                            </p>
                                          </div>
                                          
                                          {editTruckData.custom_fields && Object.keys(editTruckData.custom_fields).filter(key => key !== 'samsara_vehicle_id' && key !== 'samsaraVehicleId').map(key => (<div key={key} className="pt-1"><label className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase">{key}</label><input type="text" className="w-full border border-emerald-200 dark:border-emerald-900/50 p-2 rounded mt-1 bg-emerald-50/50 dark:bg-emerald-900/20 text-zinc-900 dark:text-white font-semibold focus:outline-none focus:ring-1 focus:ring-emerald-500 transition-colors" value={editTruckData.custom_fields[key] || ''} onChange={e => setEditTruckData({ ...editTruckData, custom_fields: { ...editTruckData.custom_fields, [key]: e.target.value } })}/></div>))}
                                      </div>) : (<div className="space-y-4">
                                          <div className="grid grid-cols-2 gap-2 text-sm">
                                              <p className="text-zinc-500 dark:text-zinc-400 font-medium">Unit Type</p><p className="font-bold text-zinc-900 dark:text-white text-right">{profileTruck?.equipment_type}</p>
                                              <p className="text-zinc-500 dark:text-zinc-400 font-medium">Trailer #</p><p className="font-bold text-zinc-900 dark:text-white text-right">{profileTruck?.trailer_number || 'N/A'}</p>
                                              <p className="text-zinc-500 dark:text-zinc-400 font-medium">VIN</p><p className="font-mono text-xs font-bold text-zinc-900 dark:text-white text-right">{profileTruck?.vin}</p>
                                              <p className="text-zinc-500 dark:text-zinc-400 font-medium">Current Status</p><p className="font-bold text-emerald-600 dark:text-emerald-400 text-right uppercase">{profileTruck?.status}</p>
                                              {(profileTruck?.custom_fields?.samsara_vehicle_id || profileTruck?.custom_fields?.samsaraVehicleId) ? (<>
                                                  <p className="text-zinc-500 dark:text-zinc-400 font-medium">Samsara Vehicle ID</p>
                                                  <p className="font-mono text-xs font-bold text-zinc-900 dark:text-white text-right">{String(profileTruck.custom_fields.samsara_vehicle_id || profileTruck.custom_fields.samsaraVehicleId)}</p>
                                                </>) : null}
                                          </div>
                                          {profileTruck?.custom_fields && Object.keys(profileTruck.custom_fields).filter(key => key !== 'samsara_vehicle_id' && key !== 'samsaraVehicleId').length > 0 && (<div className="pt-4 border-t border-zinc-100 dark:border-zinc-800 mt-4 transition-colors">
                                                  <p className="text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase mb-2">Custom Fields</p>
                                                  <div className="grid grid-cols-2 gap-2 text-sm">
                                                      {Object.entries(profileTruck.custom_fields).filter(([key]) => key !== 'samsara_vehicle_id' && key !== 'samsaraVehicleId').map(([key, value]) => (<React.Fragment key={key}><p className="text-zinc-500 dark:text-zinc-400 font-medium">{key}</p><FleetCustomFieldValue label={key} value={String(value)}/></React.Fragment>))}
                                                  </div>
                                              </div>)}
                                      </div>)}
                              </div>
                          </div>
                      </div>

                      
                      <div className="bg-white dark:bg-zinc-800/50 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden transition-colors">
                          <div className="p-4 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 flex justify-between items-center transition-colors">
                              <h4 className="font-bold text-zinc-900 dark:text-white flex items-center gap-2"><FileText size={18} className="text-zinc-500 dark:text-zinc-400"/> Lifetime Assigned Loads</h4>
                              <span className="text-xs font-bold bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 px-2 py-1 rounded transition-colors">{assignedLoads.length} Records</span>
                          </div>
                          {assignedLoads.length === 0 ? (<p className="text-center text-zinc-400 text-sm py-8">This unit has not completed any loads yet.</p>) : (<table className="w-full text-left text-sm">
                                  <thead className="bg-zinc-50 text-zinc-500 text-xs uppercase font-semibold border-b">
                                      <tr>
                                        <th className="p-3 pl-4">Date</th>
                                        <th className="p-3">Route</th>
                                        {canViewOperationalFinancials ? (<>
                                            <th className="p-3">Gross</th>
                                            {canViewNetProfit ? <th className="p-3">Net Profit</th> : null}
                                          </>) : null}
                                        <th className="p-3 text-right pr-4">Documents</th>
                                      </tr>
                                  </thead>
                                  <tbody className="divide-y text-sm">
                                      {assignedLoads.map(load => (<tr key={load.id} className="hover:bg-zinc-50 transition-colors">
                                              <td className="p-3 pl-4 text-zinc-500">{new Date(load.created_at || '').toLocaleDateString()}</td>
                                              <td className="p-3 font-medium text-zinc-700">{load.origin} ➔ {load.destination}</td>
                                              {canViewOperationalFinancials ? (<>
                                                  <td className="p-3 font-semibold text-zinc-600">${load.linehaul_rate?.toFixed(2) ?? '0.00'}</td>
                                                  {canViewNetProfit ? (<td className="p-3 font-bold text-emerald-600">{load.payment_status === "Settled" ? `$${load.net_profit?.toFixed(2) ?? '0.00'}` : '-'}</td>) : null}
                                                </>) : null}
                                              <td className="p-3 pr-4 text-right">
                                                  <button onClick={() => setActiveVaultLoad(load.id)} className="text-xs font-bold bg-zinc-100 text-zinc-700 hover:bg-zinc-100 px-3 py-1.5 rounded-lg border border-zinc-200 transition-colors inline-flex items-center gap-1">
                                                      <FolderOpen size={14}/> Files
                                                  </button>
                                              </td>
                                          </tr>))}
                                  </tbody>
                              </table>)}
                      </div>
                  </div>
              </div>
          </div>);
        })()}

      <main className="flex flex-1 min-h-0 min-w-0 w-full flex-col overflow-hidden relative transition-all duration-300">
        <div className="md:hidden h-14 shrink-0 bg-white dark:bg-[#0B0B0B] border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between px-4">
          <button type="button" onClick={() => setIsMobileMenuOpen(true)} className="p-2 -ml-1 rounded-lg text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors" aria-label="Open navigation menu" aria-expanded={isMobileMenuOpen}>
            <Menu size={22}/>
          </button>
          <div className="flex items-center gap-2 min-w-0">
            <div className="bg-zinc-800 p-1.5 rounded-lg shrink-0">
              <FleetyIcon className="h-5 w-5" aria-hidden/>
            </div>
            <span className="text-base font-black text-zinc-900 dark:text-white tracking-tight truncate">
              Fleety
            </span>
          </div>
          <div className="w-9" aria-hidden/>
        </div>

        <header className="h-auto min-h-14 md:h-16 bg-white dark:bg-[#0B0B0B] border-b border-zinc-200 dark:border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 md:px-8 py-3 md:py-0 flex-shrink-0 transition-colors duration-200">
            <h2 className="text-lg font-bold capitalize flex items-center gap-2 text-zinc-900 dark:text-white">
                {isLoadManagementRoute && <BarChart3 className="text-zinc-500" size={20}/>}
                {isLiveOperationsRoute && <Radio className="text-zinc-500 dark:text-zinc-400" size={20}/>}
                {isFleetPath(pathname) && <Users className="text-zinc-500 dark:text-zinc-400" size={20}/>}
                {pathname === DASHBOARD_ROUTES.crm && <Building2 className="text-zinc-500" size={20}/>}
                {pathname === DASHBOARD_ROUTES.accounting && <Calculator className="text-zinc-500" size={20}/>}
                {pathname === DASHBOARD_ROUTES.settings && <Settings className="text-zinc-500" size={20}/>}
                {getDashboardPageTitle(pathname)}
            </h2>
            <div className="flex flex-row flex-wrap xl:flex-nowrap items-end justify-start xl:justify-end gap-3 min-w-0">
                {isLoadManagementRoute && (<button type="button" onClick={() => {
                setIsLoadEntryViewMode(false);
                setStagedLoad(emptyStagedLoad(currentUserId));
                clearRateConAttachment();
                setRateConParsing(false);
                setIsLoadModalOpen(true);
            }} className="shrink-0 bg-zinc-900 hover:bg-zinc-800 dark:bg-white dark:text-black dark:hover:bg-zinc-200 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 shadow-sm transition-all whitespace-nowrap">
                    <Plus size={16}/>
                    New Detailed Load
                  </button>)}

                {showFleetDateFilter && (<DateFilterDropdown menuRef={fleetDateFilterMenuRef} isOpen={isDateMenuOpen} onToggle={() => setIsDateMenuOpen((open) => !open)} presets={activeFleetDatePresets} activePreset={activeWindowPreset} dateFrom={activePlanningWindowStart} dateTo={activePlanningWindowEnd} onPresetSelect={(preset) => void applyFleetWindowPreset(preset)} onCustomDateChange={(field, value) => void handleFleetCustomDateChange(field, value)} menuAriaLabel="Fleet date filter" buttonLabel={fleetDateFilterButtonLabel} startDateAriaLabel="Fleet window start date" endDateAriaLabel="Fleet window end date"/>)}

                {isFleetAssetsRoute && (<>
                    <button type="button" onClick={() => setShowOnboardDriverModal(true)} className="shrink-0 bg-zinc-900 hover:bg-zinc-800 dark:bg-white dark:text-black dark:hover:bg-zinc-200 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 shadow-sm transition-all whitespace-nowrap">
                      <Plus size={16}/> Add New Driver
                    </button>
                    <button type="button" onClick={() => openRegisterEquipmentModal()} className="shrink-0 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 shadow-sm transition-all border border-zinc-200 dark:border-zinc-700 whitespace-nowrap">
                      <Plus size={16}/> Register Equipment
                    </button>
                  </>)}

                <GlobalSearchDropdown value={searchQuery} onChange={setSearchQuery} token={token || ''} placeholder={pathname === DASHBOARD_ROUTES.crm
            ? 'Search companies, MC, or facilities...'
            : 'Search loads, drivers, units...'} ariaLabel={pathname === DASHBOARD_ROUTES.crm
            ? 'Search companies, MC, or facilities'
            : 'Search loads, drivers, units'} suppressResults={pathname === DASHBOARD_ROUTES.crm} onSelectDriver={(driverId) => {
            router.push(DASHBOARD_ROUTES.fleetAssets);
            setFleetProfilePresentation('modal');
            setSelectedDriverProfileId(driverId);
        }} onSelectTruck={(truckId) => {
            router.push(DASHBOARD_ROUTES.fleetAssets);
            setActiveAssetProfile(truckId);
        }} onSelectLoad={(loadId) => {
            router.push('/load-management');
            setActiveVaultLoad(loadId);
        }} onSelectInvoice={(loadId) => {
            router.push('/load-management');
            setActiveVaultLoad(loadId);
        }}/>

                
                <button onClick={toggleTheme} className="shrink-0 p-2.5 rounded-full bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-300 transition-colors" title="Toggle Dark Mode">
                    {isDarkMode ? <Sun size={18}/> : <Moon size={18}/>}
                </button>
            </div>
        </header>

        <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden relative p-4 md:p-6 w-full">
            {Object.entries(cachedViews).map(([path, view]) => pathname === path ? <div key={path}>{view}</div> : null)}
        </div>
      </main>

      <OnboardDriverModal isOpen={showOnboardDriverModal} token={token || ''} onClose={() => setShowOnboardDriverModal(false)} onSuccess={handleFleetOnboardingSuccess}/>
      <RegisterEquipmentModal isOpen={showRegisterEquipmentModal} token={token || ''} drivers={drivers} truckId={equipmentModalTruck?.id ?? null} initialTruck={equipmentModalTruck} onClose={closeRegisterEquipmentModal} onSuccess={fetchData}/>
      {(selectedDriverProfileId || selectedTruckProfileId) && fleetProfilePresentation === 'drawer' ? (<ProfileDrawerShell open onClose={closeFleetProfile}>
          {selectedDriverProfileId ? (<DriverDetailModal bare token={token || ''} driverId={selectedDriverProfileId} trucks={trucks} onClose={closeFleetProfile} onOpenTruck={openTruckProfileFromLoads} onOpenTrailer={openTrailerProfileFromLoads} onDocumentUploaded={() => setPlanningBoardRefreshKey((key) => key + 1)} onProfileUpdated={() => {
                    void fetchData();
                    setPlanningBoardRefreshKey((key) => key + 1);
                }}/>) : (<TruckDetailModal bare token={token || ''} truck={truckForProfile} drivers={drivers} trucks={trucks} onClose={closeFleetProfile} onOpenDriver={openDriverProfileFromLoads} onOpenTrailer={openTrailerProfileFromLoads} onSuccess={async () => {
                    await fetchData();
                    setPlanningBoardRefreshKey((key) => key + 1);
                }}/>)}
        </ProfileDrawerShell>) : null}
      {selectedDriverProfileId && fleetProfilePresentation === 'modal' ? (<DriverDetailModal token={token || ''} driverId={selectedDriverProfileId} trucks={trucks} onClose={() => setSelectedDriverProfileId(null)} onOpenTruck={openTruckProfileFromLoads} onOpenTrailer={openTrailerProfileFromLoads} onDocumentUploaded={() => setPlanningBoardRefreshKey((key) => key + 1)} onProfileUpdated={() => {
                void fetchData();
                setPlanningBoardRefreshKey((key) => key + 1);
            }}/>) : null}
      {selectedTruckProfileId && fleetProfilePresentation === 'modal' ? (<TruckDetailModal token={token || ''} truck={truckForProfile} drivers={drivers} trucks={trucks} onClose={() => setSelectedTruckProfileId(null)} onOpenDriver={openDriverProfileFromLoads} onOpenTrailer={openTrailerProfileFromLoads} onSuccess={async () => {
                await fetchData();
                setPlanningBoardRefreshKey((key) => key + 1);
            }}/>) : null}
    </div>
    </DashboardContext.Provider>);
}
