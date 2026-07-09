'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { hasLocalSessionHint, performTmsLogout, TMS_TOKEN_UPDATED_EVENT, } from '@/lib/api-client';
import { ACTIVITY_THROTTLE_MS, FLEETY_LAST_ACTIVITY_KEY, INACTIVITY_LIMIT_MS, INACTIVITY_POLL_INTERVAL_MS, readLastActivity, recordSessionActivity, writeLastActivity, } from '@/lib/session-inactivity';
const ACTIVITY_EVENTS = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'] as const;
const INACTIVITY_LOGOUT_URL = '/login?reason=inactive';
export function useInactivityLogout(): void {
    const pathname = usePathname();
    const [trackingEnabled, setTrackingEnabled] = useState(false);
    const lastTouchAtRef = useRef(0);
    const lastActivityRef = useRef(0);
    const evictingRef = useRef(false);
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    useEffect(() => {
        const syncTracking = () => {
            setTrackingEnabled(hasLocalSessionHint());
        };
        syncTracking();
        window.addEventListener(TMS_TOKEN_UPDATED_EVENT, syncTracking);
        return () => window.removeEventListener(TMS_TOKEN_UPDATED_EVENT, syncTracking);
    }, []);
    const stopVerificationLoop = useCallback(() => {
        if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
        }
    }, []);
    const evictSession = useCallback(async () => {
        if (evictingRef.current)
            return;
        evictingRef.current = true;
        stopVerificationLoop();
        await performTmsLogout(INACTIVITY_LOGOUT_URL);
    }, [stopVerificationLoop]);
    const verifyIdleTimeout = useCallback(() => {
        if (evictingRef.current || typeof window === 'undefined')
            return;
        if (!hasLocalSessionHint())
            return;
        const stored = readLastActivity();
        if (stored == null) {
            recordSessionActivity();
            lastActivityRef.current = Date.now();
            return;
        }
        lastActivityRef.current = stored;
        if (Date.now() - stored >= INACTIVITY_LIMIT_MS) {
            void evictSession();
        }
    }, [evictSession]);
    const touchActivity = useCallback(() => {
        const now = Date.now();
        if (now - lastTouchAtRef.current < ACTIVITY_THROTTLE_MS)
            return;
        lastTouchAtRef.current = now;
        lastActivityRef.current = now;
        writeLastActivity(now);
    }, []);
    useEffect(() => {
        if (typeof window === 'undefined')
            return;
        if (!trackingEnabled || pathname === '/login')
            return;
        const stored = readLastActivity();
        if (stored != null) {
            lastActivityRef.current = stored;
        }
        else {
            recordSessionActivity();
            lastActivityRef.current = Date.now();
        }
        const onStorage = (event: StorageEvent) => {
            if (event.key !== FLEETY_LAST_ACTIVITY_KEY || event.newValue == null)
                return;
            const parsed = Number.parseInt(event.newValue, 10);
            if (Number.isFinite(parsed)) {
                lastActivityRef.current = parsed;
            }
            verifyIdleTimeout();
        };
        const onFocus = () => verifyIdleTimeout();
        const onVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                verifyIdleTimeout();
            }
        };
        ACTIVITY_EVENTS.forEach((eventName) => {
            window.addEventListener(eventName, touchActivity, { passive: true });
        });
        window.addEventListener('storage', onStorage);
        window.addEventListener('focus', onFocus);
        document.addEventListener('visibilitychange', onVisibilityChange);
        verifyIdleTimeout();
        intervalRef.current = setInterval(verifyIdleTimeout, INACTIVITY_POLL_INTERVAL_MS);
        return () => {
            stopVerificationLoop();
            ACTIVITY_EVENTS.forEach((eventName) => {
                window.removeEventListener(eventName, touchActivity);
            });
            window.removeEventListener('storage', onStorage);
            window.removeEventListener('focus', onFocus);
            document.removeEventListener('visibilitychange', onVisibilityChange);
        };
    }, [pathname, stopVerificationLoop, touchActivity, trackingEnabled, verifyIdleTimeout]);
}
