'use client';
import type { ReactNode } from 'react';
import { useCallback, useState } from 'react';
import dynamic from 'next/dynamic';
import { Activity, AlertTriangle, BarChart3, BookMarked, CheckCircle, Clock, DollarSign, LayoutList, Navigation, Truck, } from 'lucide-react';
import LoadTable, { loadStatusToUi, statusBadgeClass, statusOptionLabel, } from '@/components/tables/LoadTable';
import LoadTrashBin from '@/components/tables/LoadTrashBin';
import DateFilterDropdown from '@/components/ui/DateFilterDropdown';
import LoadTableToolbar from '@/components/load-management/LoadTableToolbar';
import { LOAD_MANAGEMENT_DATE_PRESETS } from '@/lib/fleet-financial-metrics';
import { EMPTY_LOAD_TABLE_FILTERS, type LoadTableColumnFilters, type LoadTableColumnId, } from '@/lib/load-table-columns';
import { useDashboard } from '@/contexts/DashboardContext';
import type { LoadStatusFilter } from '@/components/dashboard/load-management-types';
const BrokerWorkspaceProfilePanel = dynamic(() => import('@/components/load-management/BrokerWorkspaceProfilePanel'), {
    ssr: false,
    loading: () => (<div className="animate-pulse bg-zinc-100 dark:bg-zinc-800 rounded-xl min-h-[720px] w-full"/>),
});
const DriverWorkspaceProfilePanel = dynamic(() => import('@/components/load-management/DriverWorkspaceProfilePanel'), {
    ssr: false,
    loading: () => (<div className="animate-pulse bg-zinc-100 dark:bg-zinc-800 rounded-xl min-h-[720px] w-full"/>),
});
const TruckWorkspaceProfilePanel = dynamic(() => import('@/components/load-management/TruckWorkspaceProfilePanel'), {
    ssr: false,
    loading: () => (<div className="animate-pulse bg-zinc-100 dark:bg-zinc-800 rounded-xl min-h-[720px] w-full"/>),
});
const LoadContextDrawer = dynamic(() => import('@/components/LoadContextDrawer'), {
    ssr: false,
    loading: () => (<div className="animate-pulse bg-zinc-100 dark:bg-zinc-800 rounded-xl min-h-[720px] w-full"/>),
});
export default function LoadManagementBoard() {
    const { drawerLoad, token, trucks, drivers, customers, teamDispatchers, teamDispatchersLoading, canViewOperationalFinancials, canViewNetProfit, setActiveDrawerLoadId, refreshDashboard, currentUserId, totalLoadsCount, unassignedLoadsCount, bookedLoadsCount, inTransitCount, deliveredCount, delayedCount, loadDateFilterMenuRef, isLoadDateMenuOpen, setIsLoadDateMenuOpen, loadDatePreset, loadDateFrom, loadDateTo, applyLoadDatePreset, handleLoadCustomDateChange, loadDateFilterButtonLabel, loadStatusFilter, setLoadStatusFilter, loadManagementView, setLoadManagementView, timeRange, analytics, boardLoads, boardLoadsLoading, loadsPage, loadsLimit, loadsPagination, setLoadsPage, setLoadsLimit, fetchData, activeDrawerLoadId, activeBrokerViewId, brokerProfileCustomer, closeBrokerProfile, activeDriverViewId, closeDriverProfile, activeTruckViewId, closeTruckProfile, openDriverProfileFromLoads, openTruckProfileFromLoads, openBrokerWorkspaceFromLoads, knownLoads, setCustomers, } = useDashboard();
    const [columnFilters, setColumnFilters] = useState<LoadTableColumnFilters>(EMPTY_LOAD_TABLE_FILTERS);
    const handleColumnFilterChange = useCallback((columnId: Exclude<LoadTableColumnId, 'actions'>, value: string) => {
        setColumnFilters((previous) => ({ ...previous, [columnId]: value }));
    }, []);
    if (drawerLoad && token) {
        return (<LoadContextDrawer load={drawerLoad} trucks={trucks} drivers={drivers} customers={customers} dispatchers={teamDispatchers} dispatchersLoading={teamDispatchersLoading} token={token} canViewOperationalFinancials={canViewOperationalFinancials} canViewNetProfit={canViewNetProfit} statusBadgeClass={statusBadgeClass} statusLabel={(status) => statusOptionLabel(loadStatusToUi(status))} onClose={() => setActiveDrawerLoadId(null)} onRefresh={refreshDashboard} onLoadPatched={() => {
                void refreshDashboard();
            }} currentUserId={currentUserId}/>);
    }
    if (activeBrokerViewId != null && brokerProfileCustomer && token) {
        return (<BrokerWorkspaceProfilePanel customer={brokerProfileCustomer} loads={knownLoads} token={token} onClose={closeBrokerProfile} onRefresh={refreshDashboard} onCustomerUpdated={(updated) => {
                setCustomers((previous) => previous.map((entry) => entry.id === updated.id
                    ? {
                        ...entry,
                        name: updated.name,
                        mc: updated.mc ?? entry.mc,
                        phone: updated.phone ?? entry.phone,
                        email: updated.email ?? entry.email,
                        rating: updated.rating ?? entry.rating,
                        status: updated.status ?? entry.status,
                    }
                    : entry));
            }}/>);
    }
    if (activeDriverViewId != null && token) {
        return (<DriverWorkspaceProfilePanel driverId={activeDriverViewId} token={token} trucks={trucks} onClose={closeDriverProfile} onRefresh={refreshDashboard} onOpenTruck={openTruckProfileFromLoads} onOpenTrailer={openTruckProfileFromLoads}/>);
    }
    if (activeTruckViewId != null && token) {
        return (<TruckWorkspaceProfilePanel truckId={activeTruckViewId} token={token} trucks={trucks} drivers={drivers} loads={knownLoads} onClose={closeTruckProfile} onRefresh={refreshDashboard} onOpenDriver={openDriverProfileFromLoads} onOpenTrailer={openTruckProfileFromLoads}/>);
    }
    const pipelineCards: Array<{
        id: LoadStatusFilter;
        label: string;
        count: number;
        subtitle: string;
        icon: ReactNode;
        idleClass: string;
        activeClass: string;
        subtitleClass: string;
    }> = [
        {
            id: 'all',
            label: 'Total Loads',
            count: totalLoadsCount,
            subtitle: 'On active board',
            icon: <Activity size={12}/>,
            idleClass: 'bg-white dark:bg-zinc-900/40 border-zinc-200 dark:border-zinc-800/80 hover:border-zinc-300 dark:hover:border-zinc-700',
            activeClass: 'ring-1 ring-zinc-700 bg-zinc-900/80 border-zinc-700 text-white',
            subtitleClass: 'text-zinc-500 dark:text-zinc-400',
        },
        {
            id: 'unassigned',
            label: 'Unassigned',
            count: unassignedLoadsCount,
            subtitle: unassignedLoadsCount > 0 ? 'Awaiting driver or unit' : 'Fully assigned',
            icon: <AlertTriangle size={12}/>,
            idleClass: 'bg-white dark:bg-zinc-900/40 border-zinc-200 dark:border-zinc-800/80 hover:border-amber-500/40',
            activeClass: 'ring-1 ring-amber-500/50 bg-amber-500/10 border-amber-500/40 dark:bg-amber-500/15',
            subtitleClass: unassignedLoadsCount > 0
                ? 'text-amber-600 dark:text-amber-500'
                : 'text-emerald-600 dark:text-emerald-400',
        },
        {
            id: 'booked',
            label: 'Booked',
            count: bookedLoadsCount,
            subtitle: bookedLoadsCount > 0 ? 'Locked, not yet rolling' : 'No booked freight',
            icon: <BookMarked size={12}/>,
            idleClass: 'bg-white dark:bg-zinc-900/40 border-zinc-200 dark:border-zinc-800/80 hover:border-cyan-500/40',
            activeClass: 'ring-1 ring-cyan-500/50 bg-cyan-500/10 border-cyan-500/40 dark:bg-cyan-500/15',
            subtitleClass: 'text-cyan-700 dark:text-cyan-300',
        },
        {
            id: 'in_transit',
            label: 'In Transit',
            count: inTransitCount,
            subtitle: 'Dispatched & rolling',
            icon: <Truck size={12}/>,
            idleClass: 'bg-white dark:bg-zinc-900/40 border-zinc-200 dark:border-zinc-800/80 hover:border-emerald-500/40',
            activeClass: 'ring-1 ring-emerald-500/50 bg-emerald-500/10 border-emerald-500/40 dark:bg-emerald-500/15',
            subtitleClass: 'text-emerald-600 dark:text-emerald-400',
        },
        {
            id: 'delivered',
            label: 'Delivered',
            count: deliveredCount,
            subtitle: 'Completed hauls',
            icon: <CheckCircle size={12}/>,
            idleClass: 'bg-white dark:bg-zinc-900/40 border-zinc-200 dark:border-zinc-800/80 hover:border-emerald-700/40',
            activeClass: 'ring-1 ring-emerald-700/50 bg-emerald-900/20 border-emerald-700/40 dark:bg-emerald-950/40',
            subtitleClass: 'text-emerald-700 dark:text-emerald-500',
        },
        {
            id: 'delayed',
            label: 'Delayed',
            count: delayedCount,
            subtitle: delayedCount > 0 ? 'Requires attention' : 'On schedule',
            icon: <Clock size={12}/>,
            idleClass: 'bg-white dark:bg-zinc-900/40 border-zinc-200 dark:border-zinc-800/80 hover:border-rose-500/40',
            activeClass: 'ring-1 ring-rose-500/50 bg-rose-500/10 border-rose-500/40 dark:bg-rose-500/15',
            subtitleClass: delayedCount > 0
                ? 'text-rose-600 dark:text-rose-400'
                : 'text-emerald-600 dark:text-emerald-400',
        },
    ];
    return (<div className="min-w-0 space-y-4 animate-in fade-in duration-200">
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4 mb-4" role="tablist" aria-label="Load pipeline filters">
        {pipelineCards.map((card) => {
            const selected = loadStatusFilter === card.id;
            return (<button key={card.id} type="button" role="tab" aria-selected={selected} onClick={() => setLoadStatusFilter(card.id)} className={`rounded-xl p-3.5 shadow-sm border text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/40 ${selected ? card.activeClass : card.idleClass}`}>
              <p className={`text-[10px] font-bold tracking-widest ${selected && card.id === 'all'
                    ? 'text-zinc-50'
                    : 'text-zinc-950 dark:text-zinc-50'}`}>
                {card.label}
              </p>
              <p className={`text-2xl font-bold mt-1 ${selected && card.id === 'all'
                    ? 'text-white'
                    : selected && card.id === 'booked'
                        ? 'text-cyan-700 dark:text-cyan-300'
                        : selected && card.id === 'unassigned'
                            ? 'text-amber-700 dark:text-amber-400'
                            : selected && card.id === 'delayed'
                                ? 'text-rose-700 dark:text-rose-400'
                                : selected && (card.id === 'in_transit' || card.id === 'delivered')
                                    ? 'text-emerald-700 dark:text-emerald-400'
                                    : 'text-zinc-900 dark:text-white'}`}>
                {card.count}
              </p>
              <p className={`text-xs mt-2 flex items-center gap-1 ${card.subtitleClass}`}>
                {card.icon}
                {card.subtitle}
              </p>
            </button>);
        })}
      </div>

      <div className={`grid grid-cols-1 ${canViewNetProfit ? 'md:grid-cols-3' : ''} gap-4`}>
        {canViewNetProfit ? (<>
            <div className="bg-white dark:bg-[#161616] p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm flex items-center gap-4 transition-colors">
              <div className="bg-zinc-100 dark:bg-zinc-800 p-4 rounded-xl">
                <BarChart3 className="text-zinc-700 dark:text-zinc-300" size={28}/>
              </div>
              <div>
                <p className="text-xs font-bold text-zinc-950 dark:text-zinc-50 uppercase tracking-wider">
                  {timeRange === 'all' ? 'All-Time Gross' : '30-Day Gross'}
                </p>
                <p className="text-2xl font-black text-zinc-900 dark:text-white">
                  ${analytics.monthly_gross.toFixed(2)}
                </p>
                <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 mt-1">
                  Gross RPM: ${(analytics?.monthly_gross_rpm ?? analytics?.monthly_rpm ?? 0).toFixed(2)}
                </p>
              </div>
            </div>
            <div className="bg-emerald-50 dark:bg-emerald-900/20 p-6 rounded-2xl border border-emerald-200 dark:border-emerald-800/30 shadow-sm flex items-center gap-4 transition-colors">
              <div className="bg-emerald-100 dark:bg-emerald-900/50 p-4 rounded-xl">
                <DollarSign className="text-emerald-700 dark:text-emerald-400" size={28}/>
              </div>
              <div>
                <p className="text-xs font-bold text-zinc-950 dark:text-zinc-50 uppercase tracking-wider">
                  {timeRange === 'all' ? 'All-Time Net Profit' : '30-Day Net Profit'}
                </p>
                <p className="text-2xl font-black text-emerald-900 dark:text-emerald-100">
                  ${analytics.monthly_net.toFixed(2)}
                </p>
                <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 mt-1">
                  Net RPM: ${(analytics?.monthly_net_rpm || 0).toFixed(2)}
                </p>
                <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 mt-0.5">
                  After fuel, tolls, and driver pay
                </p>
              </div>
            </div>
          </>) : null}
        <div className="bg-white dark:bg-[#161616] p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm flex items-center gap-4 transition-colors">
          <div className="bg-zinc-100 dark:bg-zinc-800 p-4 rounded-xl">
            <Navigation className="text-zinc-600 dark:text-zinc-400" size={28}/>
          </div>
          <div>
            <p className="text-xs font-bold text-zinc-950 dark:text-zinc-50 uppercase tracking-wider">
              {timeRange === 'all' ? 'Total Miles (All Time)' : 'Total Miles (MTD)'}
            </p>
            <p className="text-2xl font-black text-zinc-900 dark:text-white">
              {(analytics.monthly_fleet_miles || analytics.monthly_miles || 0).toLocaleString()} mi
            </p>
            <p className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 mt-1">
              {(analytics.monthly_loaded_miles || 0).toLocaleString()} loaded |{' '}
              {(analytics.monthly_deadhead_miles || 0).toLocaleString()} deadhead
            </p>
          </div>
        </div>
      </div>

      <section className="min-w-0 bg-white dark:bg-[#161616] rounded-2xl shadow-sm border border-zinc-200 dark:border-zinc-800 flex flex-col overflow-hidden transition-colors">
        <div className="p-4 sm:p-5 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-[#0B0B0B] transition-colors">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3 min-w-0">
              <h2 className="text-lg font-bold text-zinc-900 dark:text-white flex items-center gap-2 shrink-0">
                <LayoutList className="text-zinc-500" size={20}/>
                {loadManagementView === 'active'
            ? `Loads (${loadsPagination.total_count})`
            : 'Deleted Loads'}
              </h2>
              <DateFilterDropdown menuRef={loadDateFilterMenuRef} isOpen={isLoadDateMenuOpen} onToggle={() => setIsLoadDateMenuOpen((open) => !open)} presets={LOAD_MANAGEMENT_DATE_PRESETS} activePreset={loadDatePreset} dateFrom={loadDateFrom} dateTo={loadDateTo} onPresetSelect={applyLoadDatePreset} onCustomDateChange={handleLoadCustomDateChange} menuAriaLabel="Load management date filter" buttonLabel={loadDateFilterButtonLabel} align="left" startDateAriaLabel="Filter from date" endDateAriaLabel="Filter to date"/>
              {loadManagementView === 'active' ? (<LoadTableToolbar filters={columnFilters} onFilterChange={handleColumnFilterChange}/>) : null}
            </div>
            <div className="flex rounded-lg border border-zinc-200 dark:border-zinc-800 overflow-hidden shrink-0 self-start sm:self-auto">
              <button type="button" onClick={() => setLoadManagementView('active')} className={`px-3 py-1.5 text-xs font-bold transition-colors ${loadManagementView === 'active'
            ? 'bg-zinc-900 text-white dark:bg-white dark:text-black'
            : 'bg-white dark:bg-[#161616] text-zinc-500 hover:bg-zinc-50 dark:hover:bg-zinc-800'}`}>
                Active Loads
              </button>
              <button type="button" onClick={() => setLoadManagementView('trash')} className={`px-3 py-1.5 text-xs font-bold transition-colors ${loadManagementView === 'trash'
            ? 'bg-zinc-900 text-white dark:bg-white dark:text-black'
            : 'bg-white dark:bg-[#161616] text-zinc-500 hover:bg-zinc-50 dark:hover:bg-zinc-800'}`}>
                Deleted Loads
              </button>
            </div>
          </div>
        </div>

        {loadManagementView === 'active' ? (<LoadTable customers={customers} loads={boardLoads} trucks={trucks} drivers={drivers} token={token || ''} refreshData={refreshDashboard} loading={boardLoadsLoading} pagination={{
                page: loadsPage,
                limit: loadsLimit,
                totalPages: loadsPagination.total_pages,
                totalCount: loadsPagination.total_count,
                onPrevious: () => setLoadsPage((page) => Math.max(1, page - 1)),
                onNext: () => setLoadsPage((page) => Math.min(loadsPagination.total_pages, page + 1)),
                onLimitChange: (limit) => {
                    setLoadsLimit(limit);
                    setLoadsPage(1);
                },
            }} canViewOperationalFinancials={canViewOperationalFinancials} canViewNetProfit={canViewNetProfit} activeDrawerLoadId={activeDrawerLoadId} onSelectLoad={(loadId) => setActiveDrawerLoadId((prev) => (prev === loadId ? null : loadId))} onOpenDriverProfile={openDriverProfileFromLoads} onOpenTruckProfile={openTruckProfileFromLoads} onOpenTrailerProfile={openTruckProfileFromLoads} onOpenBrokerWorkspace={openBrokerWorkspaceFromLoads} columnFilters={columnFilters} onColumnFilterChange={handleColumnFilterChange}/>) : (<LoadTrashBin token={token || ''} refreshData={fetchData}/>)}
      </section>
    </div>);
}
