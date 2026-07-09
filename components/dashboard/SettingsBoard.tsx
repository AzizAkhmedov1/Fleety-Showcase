'use client';
import dynamic from 'next/dynamic';
import { useDashboard } from '@/contexts/DashboardContext';
const SettingsAccountView = dynamic(() => import('@/components/SettingsAccountView'), {
    ssr: false,
    loading: () => (<div className="animate-pulse bg-zinc-100 dark:bg-zinc-800 rounded-xl min-h-[400px] w-full"/>),
});
export default function SettingsBoard() {
    const { token } = useDashboard();
    return <SettingsAccountView token={token}/>;
}
