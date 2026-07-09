'use client';
import dynamic from 'next/dynamic';
const AccountingDashboard = dynamic(() => import('@/components/accounting/AccountingDashboard'), {
    ssr: false,
    loading: () => (<div className="animate-pulse bg-zinc-100 dark:bg-zinc-800 rounded-xl min-h-[720px] w-full"/>),
});
export default function AccountingBoard() {
    return <AccountingDashboard />;
}
