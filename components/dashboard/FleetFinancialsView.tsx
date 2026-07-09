'use client';
import dynamic from 'next/dynamic';
import { useDashboard } from '@/contexts/DashboardContext';
const FleetFinancialsLeaderboard = dynamic(() => import('@/components/fleet/FleetFinancialsLeaderboard'), {
    ssr: false,
    loading: () => (<div className="animate-pulse bg-zinc-100 dark:bg-zinc-800 rounded-xl h-[480px] w-full"/>),
});
export default function FleetFinancialsView() {
    const { token, fleetWindowStart, fleetWindowEnd, trucks, drivers, fetchData } = useDashboard();
    if (!token) {
        return null;
    }
    return (<FleetFinancialsLeaderboard token={token} windowStart={fleetWindowStart} windowEnd={fleetWindowEnd} trucks={trucks} drivers={drivers} onFleetRefresh={fetchData}/>);
}
