'use client';
import dynamic from 'next/dynamic';
import { useDashboard } from '@/contexts/DashboardContext';
const PlanningBoard = dynamic(() => import('@/components/fleet/PlanningBoard'), {
    ssr: false,
    loading: () => (<div className="animate-pulse bg-zinc-100 dark:bg-zinc-800 rounded-xl h-[520px] w-full"/>),
});
export default function FleetPlanningView() {
    const { token, trucks, drivers, activeLoads, planningWindowStart, planningWindowEnd, handlePlanningWindowChange, fetchData, } = useDashboard();
    if (!token) {
        return null;
    }
    return (<PlanningBoard token={token} trucks={trucks} drivers={drivers} loads={activeLoads} windowStart={planningWindowStart} windowEnd={planningWindowEnd} onWindowChange={handlePlanningWindowChange} onRefresh={fetchData}/>);
}
