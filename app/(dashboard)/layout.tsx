'use client';
import AuthRouteGuard from '@/components/providers/AuthRouteGuard';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
export default function DashboardRouteLayout({ children, }: {
    children: React.ReactNode;
}) {
    return (<AuthRouteGuard>
      <DashboardLayout>{children}</DashboardLayout>
    </AuthRouteGuard>);
}
