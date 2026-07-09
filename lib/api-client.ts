import axios, { AxiosError, AxiosInstance, InternalAxiosRequestConfig } from 'axios';
import { signOut } from 'next-auth/react';
import { ACCESS_TOKEN_TTL_MS, clearLastActivity, FLEETY_LAST_ACTIVITY_KEY, isInactiveSessionLapsed, recordSessionActivity, } from '@/lib/session-inactivity';
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
export { ACCESS_TOKEN_TTL_MS } from '@/lib/session-inactivity';
export const TMS_SESSION_EXPIRES_KEY = 'tms_session_expires_at';
export const AUTH_NETWORK_TIMEOUT_MS = 30000;
export const COLD_START_MAX_RETRIES = 5;
export const COLD_START_RETRY_DELAY_MS = 5000;
export const AUTH_COLD_START_RETRY_MESSAGE = 'The server is taking a moment to wake up. Retrying automatically...';
export const AUTH_COLD_START_FAILED_MESSAGE = 'The server is taking a moment to wake up. Please try again in a few seconds.';
export const AUTH_COLD_START_MESSAGE = AUTH_COLD_START_FAILED_MESSAGE;
export type ColdStartRetryState = {
    active: boolean;
    attempt: number;
    maxAttempts: number;
};
let coldStartRetryState: ColdStartRetryState = {
    active: false,
    attempt: 0,
    maxAttempts: COLD_START_MAX_RETRIES,
};
const coldStartRetryListeners = new Set<(state: ColdStartRetryState) => void>();
function emitColdStartRetry(state: ColdStartRetryState): void {
    coldStartRetryState = state;
    coldStartRetryListeners.forEach((listener) => listener(state));
}
export function subscribeColdStartRetry(listener: (state: ColdStartRetryState) => void): () => void {
    coldStartRetryListeners.add(listener);
    listener(coldStartRetryState);
    return () => {
        coldStartRetryListeners.delete(listener);
    };
}
export function isColdStartRetriableError(err: unknown): boolean {
    if (!axios.isAxiosError(err)) {
        if (err instanceof Error) {
            const message = err.message.toLowerCase();
            return message.includes('network error') || message.includes('timeout');
        }
        return false;
    }
    const status = err.response?.status;
    if (status === 502 || status === 503 || status === 504) {
        return true;
    }
    const code = (err.code || '').toUpperCase();
    if (code === 'ERR_NETWORK' || code === 'ECONNREFUSED' || code === 'ECONNABORTED') {
        return true;
    }
    const message = (err.message || '').toLowerCase();
    if (!err.response && (message.includes('network error') || message.includes('timeout'))) {
        return true;
    }
    return isRequestTimeoutError(err);
}
export function isRequestTimeoutError(err: unknown): boolean {
    if (!axios.isAxiosError(err)) {
        return err instanceof Error && err.message.toLowerCase().includes('timeout');
    }
    const message = (err.message || '').toLowerCase();
    return (err.code === 'ECONNABORTED' ||
        err.code === 'ERR_CANCELED' ||
        message.includes('timeout'));
}
const LOGOUT_BEST_EFFORT_TIMEOUT_MS = 3000;
export function applyAxiosCredentialsDefaults(): void {
    axios.defaults.withCredentials = true;
    applySessionAccessToken(sessionAccessToken);
    configureAuthInterceptors();
}
const apiClient: AxiosInstance = axios.create({
    baseURL: API_URL,
    withCredentials: true,
});
export const TMS_COOKIE_SESSION_MARKER = 'cookie-session';
export type UnauthorizedHandler = () => void;
export interface TmsSessionProfile {
    userId: number;
    companyId: number;
    roles: string[];
}
let globalUnauthorizedHandler: UnauthorizedHandler | null = null;
let isHandlingUnauthorized = false;
let isEvictingSession = false;
let isAuthenticating = false;
let sessionHydrationDepth = 0;
let sessionActive = false;
let sessionProfile: TmsSessionProfile | null = null;
let sessionAccessToken: string | null = null;
let authInterceptorsConfigured = false;
const AUTH_ENDPOINT_PATHS = [
    '/api/login',
    '/api/register',
    '/api/logout',
    '/api/auth',
    '/auth/login',
] as const;
const PROFILE_HYDRATION_PATHS = ['/api/users/me', '/api/company/me'] as const;
function isAuthEndpoint(url?: string): boolean {
    if (!url)
        return false;
    return AUTH_ENDPOINT_PATHS.some((path) => url.includes(path));
}
function isProfileHydrationEndpoint(url?: string): boolean {
    if (!url)
        return false;
    return PROFILE_HYDRATION_PATHS.some((path) => url.includes(path));
}
let profileSessionTerminated = false;
export function isProfileSessionTerminated(): boolean {
    return profileSessionTerminated;
}
function resetProfileSessionTermination(): void {
    profileSessionTerminated = false;
}
function resetSessionHydrationState(): void {
    sessionHydrationDepth = 0;
}
function shouldSuppressUnauthorizedEviction(config?: InternalAxiosRequestConfig, rawUrl?: string): boolean {
    const requestUrl = config ? resolveRequestUrl(config) : (rawUrl ?? '');
    if (isProfileHydrationEndpoint(requestUrl)) {
        return isAuthenticating;
    }
    if (isAuthenticating || sessionHydrationDepth > 0)
        return true;
    return isAuthEndpoint(requestUrl);
}
function handleTerminalProfileUnauthorized(): void {
    if (typeof window === 'undefined' || isHandlingUnauthorized || profileSessionTerminated) {
        return;
    }
    profileSessionTerminated = true;
    isHandlingUnauthorized = true;
    resetSessionHydrationState();
    isAuthenticating = false;
    purgeClientSessionLocally();
    globalUnauthorizedHandler?.();
    void signOut({ redirect: false }).finally(() => {
        isHandlingUnauthorized = false;
    });
    redirectToLogin('expired');
}
function beginSessionHydration(): void {
    sessionHydrationDepth += 1;
}
function endSessionHydration(): void {
    sessionHydrationDepth = Math.max(0, sessionHydrationDepth - 1);
}
export function applySessionAccessToken(token: string | null | undefined): void {
    sessionAccessToken = typeof token === 'string' && token.trim() ? token.trim() : null;
    if (sessionAccessToken) {
        apiClient.defaults.headers.common.Authorization = `Bearer ${sessionAccessToken}`;
        axios.defaults.headers.common.Authorization = `Bearer ${sessionAccessToken}`;
        return;
    }
    delete apiClient.defaults.headers.common.Authorization;
    delete axios.defaults.headers.common.Authorization;
}
export type AuthStatusPayload = {
    access_token?: string | null;
};
export async function completeLoginSession(payload?: AuthStatusPayload | null, timeoutMs = AUTH_NETWORK_TIMEOUT_MS): Promise<boolean> {
    resetProfileSessionTermination();
    applySessionAccessToken(payload?.access_token);
    setAuthenticating(true);
    try {
        return await persistTmsSession(timeoutMs);
    }
    finally {
        setAuthenticating(false);
    }
}
function resolveRequestUrl(config: InternalAxiosRequestConfig): string {
    const requestUrl = config.url ?? '';
    if (requestUrl.startsWith('http://') || requestUrl.startsWith('https://')) {
        return requestUrl;
    }
    const baseURL = config.baseURL ?? '';
    if (!baseURL)
        return requestUrl;
    return `${baseURL.replace(/\/$/, '')}/${requestUrl.replace(/^\//, '')}`;
}
function stripAuthHeaders(config: InternalAxiosRequestConfig): InternalAxiosRequestConfig {
    if (!config.headers)
        return config;
    const headers = config.headers as Record<string, unknown> & {
        common?: Record<string, unknown>;
    };
    delete headers.Authorization;
    delete headers.authorization;
    if (headers.common) {
        delete headers.common.Authorization;
        delete headers.common.authorization;
    }
    return config;
}
export function setAuthenticating(value: boolean): void {
    isAuthenticating = value;
}
export function resolveInactiveLogoutNotice(reasonParam?: string | null): boolean {
    if (reasonParam === 'inactive' || reasonParam === 'expired')
        return true;
    return hasLocalSessionHint() && isInactiveSessionLapsed();
}
export function purgeClientSessionLocally(): void {
    evictAuthStorageLocally();
    clearTmsToken();
    isHandlingUnauthorized = false;
}
async function postLogoutBestEffort(timeoutMs = LOGOUT_BEST_EFFORT_TIMEOUT_MS): Promise<void> {
    await Promise.race([
        (async () => {
            try {
                await axios.post(`${API_URL}/api/logout`, {}, {
                    withCredentials: true,
                    timeout: timeoutMs,
                });
            }
            catch {
                try {
                    await axios.post('/api/logout', {}, {
                        withCredentials: true,
                        timeout: timeoutMs,
                    });
                }
                catch {
                }
            }
        })(),
        new Promise<void>((resolve) => {
            setTimeout(resolve, timeoutMs);
        }),
    ]);
}
export async function evictStaleClientSession(): Promise<void> {
    if (isEvictingSession)
        return;
    isEvictingSession = true;
    purgeClientSessionLocally();
    try {
        await postLogoutBestEffort();
    }
    finally {
        isEvictingSession = false;
    }
}
export function scheduleStaleSessionEviction(): void {
    purgeClientSessionLocally();
    void evictStaleClientSession();
}
export function setUnauthorizedHandler(handler: UnauthorizedHandler | null) {
    globalUnauthorizedHandler = handler;
}
export function normalizeBearerToken(token: string | null | undefined): string {
    return typeof token === 'string' ? token.trim() : '';
}
export function hasValidTmsToken(_token?: string | null): boolean {
    return sessionActive;
}
export function getTmsSessionProfile(): TmsSessionProfile | null {
    return sessionProfile;
}
export function getTmsSessionRoles(): string[] {
    return sessionProfile?.roles ?? [];
}
export const TMS_TOKEN_UPDATED_EVENT = 'tms-token-updated';
export const TMS_SESSION_HINT_KEY = 'tms_session_hint';
function collectAuthStorageKeys(): string[] {
    if (typeof window === 'undefined')
        return [];
    const keys: string[] = [];
    try {
        for (let i = 0; i < localStorage.length; i += 1) {
            const key = localStorage.key(i);
            if (!key)
                continue;
            if (key === TMS_SESSION_HINT_KEY ||
                key === TMS_SESSION_EXPIRES_KEY ||
                key === FLEETY_LAST_ACTIVITY_KEY ||
                key.startsWith('fleety_onboarded_') ||
                key.startsWith('fleety_oauth_secret_') ||
                key.startsWith('fleety_route_')) {
                keys.push(key);
            }
        }
    }
    catch {
        return keys;
    }
    return keys;
}
function evictAuthStorageLocally(): void {
    if (typeof window === 'undefined')
        return;
    try {
        collectAuthStorageKeys().forEach((key) => localStorage.removeItem(key));
    }
    catch {
    }
}
export function redirectToLogin(reason?: string): void {
    if (typeof window === 'undefined')
        return;
    const target = reason ? `/login?reason=${encodeURIComponent(reason)}` : '/login';
    if (window.location.pathname === '/login')
        return;
    window.location.href = target;
}
function setLocalSessionHint(): void {
    if (typeof window === 'undefined')
        return;
    try {
        localStorage.setItem(TMS_SESSION_HINT_KEY, '1');
        localStorage.setItem(TMS_SESSION_EXPIRES_KEY, String(Date.now() + ACCESS_TOKEN_TTL_MS));
    }
    catch {
    }
}
function clearLocalSessionHint(): void {
    if (typeof window === 'undefined')
        return;
    try {
        localStorage.removeItem(TMS_SESSION_HINT_KEY);
        localStorage.removeItem(TMS_SESSION_EXPIRES_KEY);
    }
    catch {
    }
}
export function hasLocalSessionHint(): boolean {
    if (typeof window === 'undefined')
        return false;
    try {
        const expiresRaw = localStorage.getItem(TMS_SESSION_EXPIRES_KEY);
        if (expiresRaw) {
            const expiresAt = Number.parseInt(expiresRaw, 10);
            if (Number.isFinite(expiresAt) && Date.now() >= expiresAt) {
                evictAuthStorageLocally();
                sessionActive = false;
                sessionProfile = null;
                return false;
            }
        }
        if (localStorage.getItem(TMS_SESSION_HINT_KEY) === '1')
            return true;
        for (let i = 0; i < localStorage.length; i += 1) {
            const key = localStorage.key(i);
            if (key?.startsWith('fleety_onboarded_') ||
                key?.startsWith('fleety_oauth_secret_')) {
                return true;
            }
        }
        const cookie = document.cookie;
        if (cookie.includes('next-auth.session-token') ||
            cookie.includes('__Secure-next-auth.session-token')) {
            return true;
        }
    }
    catch {
        return false;
    }
    return false;
}
function dispatchSessionUpdatedEvent(): void {
    if (typeof window === 'undefined')
        return;
    window.dispatchEvent(new Event(TMS_TOKEN_UPDATED_EVENT));
}
async function refreshTmsSessionProfile(timeoutMs = AUTH_NETWORK_TIMEOUT_MS): Promise<boolean> {
    if (profileSessionTerminated)
        return false;
    beginSessionHydration();
    try {
        const requestConfig = { timeout: timeoutMs, withCredentials: true as const };
        const [userRes, companyRes] = await Promise.all([
            apiClient.get<{
                id: number;
                roles?: string[];
            }>('/api/users/me', requestConfig),
            apiClient.get<{
                id: number;
            }>('/api/company/me', requestConfig),
        ]);
        sessionProfile = {
            userId: userRes.data.id,
            companyId: companyRes.data.id,
            roles: Array.isArray(userRes.data.roles) ? userRes.data.roles : [],
        };
        sessionActive = true;
        resetProfileSessionTermination();
        return true;
    }
    catch {
        sessionActive = false;
        sessionProfile = null;
        return false;
    }
    finally {
        endSessionHydration();
    }
}
export async function validateTmsSession(): Promise<boolean> {
    return refreshTmsSessionProfile();
}
export async function validateTmsSessionWithTimeout(timeoutMs = 3000): Promise<boolean> {
    if (profileSessionTerminated)
        return false;
    const timeoutGate = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Timeout')), timeoutMs);
    });
    try {
        const ok = await Promise.race([validateTmsSession(), timeoutGate]);
        if (ok) {
            setLocalSessionHint();
        }
        return ok;
    }
    catch {
        sessionActive = false;
        sessionProfile = null;
        clearLocalSessionHint();
        return false;
    }
}
export function readPersistedTmsToken(): string | null {
    return sessionActive ? TMS_COOKIE_SESSION_MARKER : null;
}
export async function persistTmsSession(timeoutMs = AUTH_NETWORK_TIMEOUT_MS): Promise<boolean> {
    const ok = await refreshTmsSessionProfile(timeoutMs);
    if (ok) {
        setLocalSessionHint();
        recordSessionActivity();
        dispatchSessionUpdatedEvent();
    }
    return ok;
}
export function persistTmsToken(_token?: string): void {
    dispatchSessionUpdatedEvent();
    void refreshTmsSessionProfile().then((ok) => {
        if (ok) {
            setLocalSessionHint();
        }
    });
}
export function clearTmsToken(): void {
    sessionActive = false;
    sessionProfile = null;
    applySessionAccessToken(null);
    clearLocalSessionHint();
    clearLastActivity();
    dispatchSessionUpdatedEvent();
}
function handleUnauthorizedResponse() {
    if (typeof window === 'undefined' ||
        isHandlingUnauthorized ||
        isEvictingSession ||
        isAuthenticating ||
        sessionHydrationDepth > 0) {
        return;
    }
    isHandlingUnauthorized = true;
    purgeClientSessionLocally();
    globalUnauthorizedHandler?.();
    void signOut({ redirect: false }).finally(() => {
        isHandlingUnauthorized = false;
        redirectToLogin('expired');
    });
}
function rejectWithoutRetry(error: AxiosError): Promise<never> {
    const status = error.response?.status;
    const requestUrl = error.config ? resolveRequestUrl(error.config) : '';
    if (status === 401) {
        if (isProfileHydrationEndpoint(requestUrl) && !isAuthenticating) {
            handleTerminalProfileUnauthorized();
            return Promise.reject(error);
        }
        if (!shouldSuppressUnauthorizedEviction(error.config, requestUrl)) {
            handleUnauthorizedResponse();
        }
    }
    return Promise.reject(error);
}
type ColdStartAxiosConfig = InternalAxiosRequestConfig & {
    coldStartRetryCount?: number;
};
function isGatewayRequest(config: InternalAxiosRequestConfig): boolean {
    const requestUrl = resolveRequestUrl(config);
    if (requestUrl.startsWith(API_URL)) {
        return true;
    }
    try {
        const parsed = new URL(requestUrl);
        const apiOrigin = new URL(API_URL).origin;
        return parsed.origin === apiOrigin;
    }
    catch {
        return Boolean(config.baseURL && config.baseURL.replace(/\/$/, '') === API_URL.replace(/\/$/, ''));
    }
}
function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
}
async function handleResponseError(error: AxiosError): Promise<unknown> {
    const config = error.config as ColdStartAxiosConfig | undefined;
    if (!config || !isGatewayRequest(config) || !isColdStartRetriableError(error)) {
        return rejectWithoutRetry(error);
    }
    const retryCount = config.coldStartRetryCount ?? 0;
    if (retryCount >= COLD_START_MAX_RETRIES) {
        emitColdStartRetry({ active: false, attempt: retryCount, maxAttempts: COLD_START_MAX_RETRIES });
        return rejectWithoutRetry(error);
    }
    config.coldStartRetryCount = retryCount + 1;
    emitColdStartRetry({
        active: true,
        attempt: config.coldStartRetryCount,
        maxAttempts: COLD_START_MAX_RETRIES,
    });
    await sleep(COLD_START_RETRY_DELAY_MS);
    try {
        const response = await axios.request(config);
        emitColdStartRetry({ active: false, attempt: 0, maxAttempts: COLD_START_MAX_RETRIES });
        return response;
    }
    catch (retryError) {
        if (axios.isAxiosError(retryError)) {
            return handleResponseError(retryError);
        }
        emitColdStartRetry({ active: false, attempt: 0, maxAttempts: COLD_START_MAX_RETRIES });
        return Promise.reject(retryError);
    }
}
function installAuthRequestInterceptor(instance: AxiosInstance): void {
    instance.interceptors.request.use((config) => {
        const requestUrl = resolveRequestUrl(config);
        if (isAuthEndpoint(requestUrl) || isAuthEndpoint(config.url)) {
            return stripAuthHeaders(config);
        }
        if (sessionAccessToken) {
            config.headers = config.headers ?? {};
            config.headers.Authorization = `Bearer ${sessionAccessToken}`;
        }
        config.withCredentials = true;
        return config;
    });
}
function installAuthResponseInterceptor(instance: AxiosInstance): void {
    instance.interceptors.response.use((response) => {
        const config = response.config as ColdStartAxiosConfig;
        if (config.coldStartRetryCount && config.coldStartRetryCount > 0) {
            emitColdStartRetry({ active: false, attempt: 0, maxAttempts: COLD_START_MAX_RETRIES });
        }
        return response;
    }, (error: AxiosError) => handleResponseError(error));
}
let fetchInterceptorInstalled = false;
function installFetchAuthInterceptor(): void {
    if (fetchInterceptorInstalled || typeof window === 'undefined')
        return;
    fetchInterceptorInstalled = true;
    const nativeFetch = window.fetch.bind(window);
    window.fetch = async (...args: Parameters<typeof fetch>): Promise<Response> => {
        const response = await nativeFetch(...args);
        if (response.status === 401) {
            const requestTarget = args[0];
            const requestUrl = typeof requestTarget === 'string'
                ? requestTarget
                : requestTarget instanceof Request
                    ? requestTarget.url
                    : '';
            if (isProfileHydrationEndpoint(requestUrl) && !isAuthenticating) {
                handleTerminalProfileUnauthorized();
                return response;
            }
            if (!shouldSuppressUnauthorizedEviction(undefined, requestUrl)) {
                handleUnauthorizedResponse();
            }
        }
        return response;
    };
}
function configureAuthInterceptors(): void {
    if (authInterceptorsConfigured)
        return;
    authInterceptorsConfigured = true;
    installAuthRequestInterceptor(apiClient);
    installAuthRequestInterceptor(axios);
    installAuthResponseInterceptor(apiClient);
    installAuthResponseInterceptor(axios);
    installFetchAuthInterceptor();
}
configureAuthInterceptors();
export function createApiClient(_token?: string | null): AxiosInstance {
    return apiClient;
}
export function getApiBaseUrl(): string {
    return API_URL;
}
export const FISCAL_PERIOD_LOCK_BANNER_MESSAGE = 'Transaction Denied: Target fiscal period has been formally locked';
export function resolveFiscalPeriodLockMessage(err: unknown): string | null {
    if (!axios.isAxiosError(err)) {
        return null;
    }
    const status = err.response?.status;
    const detail = (err.response?.data as {
        detail?: unknown;
    } | undefined)?.detail;
    if (detail && typeof detail === 'object' && !Array.isArray(detail)) {
        const payload = detail as {
            code?: string;
            message?: string;
        };
        if (payload.code === 'FISCAL_PERIOD_LOCKED') {
            return payload.message?.trim() || FISCAL_PERIOD_LOCK_BANNER_MESSAGE;
        }
    }
    if (status === 422 || status === 400) {
        const text = typeof detail === 'string' ? detail : '';
        if (/fiscal period|period.*lock|formally locked|period is closed/i.test(text)) {
            return FISCAL_PERIOD_LOCK_BANNER_MESSAGE;
        }
    }
    return null;
}
export function formatApiError(err: unknown, fallback = 'Request failed'): string {
    if (!axios.isAxiosError(err)) {
        return err instanceof Error ? err.message : fallback;
    }
    const lockMessage = resolveFiscalPeriodLockMessage(err);
    if (lockMessage) {
        return lockMessage;
    }
    const data = err.response?.data;
    if (typeof data === 'string') {
        const trimmed = data.trim();
        if (trimmed) {
            try {
                const parsed = JSON.parse(trimmed) as {
                    detail?: unknown;
                };
                if (typeof parsed.detail === 'string' && parsed.detail.trim()) {
                    return parsed.detail;
                }
            }
            catch {
                return trimmed;
            }
        }
    }
    const detail = (data as {
        detail?: unknown;
    } | undefined)?.detail;
    if (typeof detail === 'string' && detail.trim()) {
        return detail;
    }
    if (detail && typeof detail === 'object' && !Array.isArray(detail)) {
        const payload = detail as {
            message?: unknown;
            msg?: unknown;
        };
        if (typeof payload.message === 'string' && payload.message.trim()) {
            return payload.message;
        }
        if (payload.msg != null) {
            return String(payload.msg);
        }
    }
    if (Array.isArray(detail) && detail.length > 0) {
        const first = detail[0] as {
            loc?: unknown[];
            msg?: unknown;
        };
        if (first?.msg != null) {
            const loc = Array.isArray(first.loc)
                ? first.loc.filter((part) => part !== 'body').join('. ')
                : '';
            return loc ? `${loc}: ${String(first.msg)}` : String(first.msg);
        }
    }
    if (detail && typeof detail === 'object' && !Array.isArray(detail) && 'msg' in detail) {
        return String((detail as {
            msg: unknown;
        }).msg);
    }
    return err.message || fallback;
}
export function assertTenantContext(_token?: string | null): number {
    const carrierId = sessionProfile?.companyId ?? null;
    if (carrierId == null) {
        throw new Error('Missing workspace carrier_id in session profile.');
    }
    return carrierId;
}
export async function performTmsLogout(callbackUrl = '/login'): Promise<void> {
    purgeClientSessionLocally();
    try {
        await postLogoutBestEffort();
    }
    catch (error) {
        console.error('Backend logout failed', error);
    }
    finally {
        await signOut({ redirect: false });
        if (typeof window !== 'undefined') {
            window.location.href = callbackUrl;
        }
    }
}
