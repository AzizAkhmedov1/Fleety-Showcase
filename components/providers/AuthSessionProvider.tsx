"use client";
import { SessionProvider } from "next-auth/react";
import AuthRouteGuard from "@/components/providers/AuthRouteGuard";
import InactivityLogoutGuard from "@/components/providers/InactivityLogoutGuard";
export default function AuthSessionProvider({ children }: {
    children: React.ReactNode;
}) {
    return (<SessionProvider>
      <AuthRouteGuard>
        <InactivityLogoutGuard>{children}</InactivityLogoutGuard>
      </AuthRouteGuard>
    </SessionProvider>);
}
