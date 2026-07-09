'use client';
import dynamic from 'next/dynamic';
import { useDashboard } from '@/contexts/DashboardContext';
const LiveOperationsMap = dynamic(() => import('@/components/LiveOperationsDashboard'), {
    ssr: false,
    loading: () => (<div className="animate-pulse bg-zinc-100 dark:bg-zinc-800 rounded-xl h-[600px] w-full"/>),
});
export default function LiveOperationsDashboard() {
    const { activeLoads, knownLoads, fleetTrucks, drivers, etaBoard, canViewNetProfit, setActiveDrawerLoadId, router, } = useDashboard();
    return (<LiveOperationsMap loads={activeLoads} allLoads={knownLoads} trucks={fleetTrucks} drivers={drivers} etaBoard={etaBoard} canViewNetProfit={canViewNetProfit} onViewLoadDetails={(loadId) => {
            router.push('/load-management');
            setActiveDrawerLoadId(loadId);
        }}/>);
}
