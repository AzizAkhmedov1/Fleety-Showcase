'use client';
import { useInactivityLogout } from '@/hooks/useInactivityLogout';
export default function InactivityLogoutGuard({ children }: {
    children: React.ReactNode;
}) {
    useInactivityLogout();
    return <>{children}</>;
}
