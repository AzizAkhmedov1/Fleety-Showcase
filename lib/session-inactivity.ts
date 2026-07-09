export const ACCESS_TOKEN_TTL_MS = 720 * 60 * 1000;
export const FLEETY_LAST_ACTIVITY_KEY = 'fleety_last_activity';
export const INACTIVITY_LIMIT_MS = ACCESS_TOKEN_TTL_MS;
export const ACTIVITY_THROTTLE_MS = 30000;
export const INACTIVITY_POLL_INTERVAL_MS = 60000;
export function readLastActivity(): number | null {
    if (typeof window === 'undefined')
        return null;
    try {
        const raw = localStorage.getItem(FLEETY_LAST_ACTIVITY_KEY);
        if (!raw)
            return null;
        const parsed = Number.parseInt(raw, 10);
        return Number.isFinite(parsed) ? parsed : null;
    }
    catch {
        return null;
    }
}
export function writeLastActivity(timestamp: number): void {
    if (typeof window === 'undefined')
        return;
    try {
        localStorage.setItem(FLEETY_LAST_ACTIVITY_KEY, String(timestamp));
    }
    catch {
    }
}
export function clearLastActivity(): void {
    if (typeof window === 'undefined')
        return;
    try {
        localStorage.removeItem(FLEETY_LAST_ACTIVITY_KEY);
    }
    catch {
    }
}
export function recordSessionActivity(): void {
    writeLastActivity(Date.now());
}
export function isInactiveSessionLapsed(): boolean {
    const last = readLastActivity();
    if (last == null)
        return false;
    return Date.now() - last >= INACTIVITY_LIMIT_MS;
}
