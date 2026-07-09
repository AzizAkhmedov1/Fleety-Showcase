'use client';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { hasLocalSessionHint, hasValidTmsToken, isProfileSessionTerminated, redirectToLogin, TMS_TOKEN_UPDATED_EVENT, validateTmsSessionWithTimeout, } from '@/lib/api-client';
const PUBLIC_PATHS = new Set(['/login']);
function isProtectedPath(pathname: string): boolean {
    if (PUBLIC_PATHS.has(pathname))
        return false;
    return true;
}
export default function AuthRouteGuard({ children }: {
    children: React.ReactNode;
}) {
    const pathname = usePathname();
    const validationAttemptedRef = useRef(false);
    const [authorized, setAuthorized] = useState<boolean | null>(() => {
        if (typeof window === 'undefined')
            return null;
        if (!isProtectedPath(pathname))
            return true;
        if (isProfileSessionTerminated())
            return false;
        if (hasValidTmsToken())
            return true;
        if (!hasLocalSessionHint())
            return false;
        return null;
    });
    useEffect(() => {
        validationAttemptedRef.current = false;
    }, [pathname]);
    useLayoutEffect(() => {
        if (!isProtectedPath(pathname)) {
            setAuthorized(true);
            return;
        }
        if (isProfileSessionTerminated()) {
            setAuthorized(false);
            return;
        }
        if (hasValidTmsToken()) {
            setAuthorized(true);
            return;
        }
        if (!hasLocalSessionHint()) {
            setAuthorized(false);
            redirectToLogin();
            return;
        }
        setAuthorized(null);
    }, [pathname]);
    useEffect(() => {
        const reassess = () => {
            if (!isProtectedPath(pathname)) {
                setAuthorized(true);
                return;
            }
            if (isProfileSessionTerminated()) {
                setAuthorized(false);
                return;
            }
            if (hasValidTmsToken()) {
                setAuthorized(true);
                return;
            }
            if (!hasLocalSessionHint()) {
                setAuthorized(false);
                redirectToLogin();
            }
        };
        window.addEventListener(TMS_TOKEN_UPDATED_EVENT, reassess);
        return () => window.removeEventListener(TMS_TOKEN_UPDATED_EVENT, reassess);
    }, [pathname]);
    useEffect(() => {
        if (!isProtectedPath(pathname))
            return;
        if (isProfileSessionTerminated())
            return;
        if (hasValidTmsToken())
            return;
        if (!hasLocalSessionHint())
            return;
        if (validationAttemptedRef.current)
            return;
        validationAttemptedRef.current = true;
        void validateTmsSessionWithTimeout(3000).then((ok) => {
            if (isProfileSessionTerminated()) {
                setAuthorized(false);
                return;
            }
            if (!ok) {
                setAuthorized(false);
                return;
            }
            setAuthorized(true);
        });
    }, [pathname]);
    if (!isProtectedPath(pathname)) {
        return <>{children}</>;
    }
    if (authorized === false) {
        return null;
    }
    if (authorized === null) {
        return (<div className="flex h-screen w-screen items-center justify-center bg-[#121212] text-zinc-500">
        Loading...
      </div>);
    }
    return <>{children}</>;
}
