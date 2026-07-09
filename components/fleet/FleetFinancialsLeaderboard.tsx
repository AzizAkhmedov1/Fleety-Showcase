'use client';
import dynamic from 'next/dynamic';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowUpDown, ChevronDown, ChevronUp, Loader2, Mail, UserCircle, } from 'lucide-react';
import ProfileDrawerShell from '@/components/ui/ProfileDrawerShell';
import { createApiClient } from '@/lib/api-client';
import { computeFleetRpm, detectFleetWindowPreset, formatCurrency, formatRpm, getPresetRange, isLoadInWindow, loadGrossRevenue, loadTotalMiles, } from '@/lib/fleet-financial-metrics';
import { formatOdometerReading } from '@/lib/fleet-display';
import { createTmsApi } from '@/lib/tms-api';
import type { AssetProfitability, DriverRecord, FleetTruckFinancialRow, LoadRecord, TeamDispatcher, TruckRecord, } from '@/lib/tms-api';
const TruckDetailModal = dynamic(() => import('@/components/modals/TruckDetailModal'), { ssr: false });
type LeaderboardView = 'trucks' | 'dispatchers';
type SortBy = 'gross' | 'rpm' | 'miles' | 'loads';
type SortOrder = 'desc' | 'asc';
interface FleetFinancialsLeaderboardProps {
    token: string;
    windowStart: string;
    windowEnd: string;
    trucks: TruckRecord[];
    drivers: DriverRecord[];
    onFleetRefresh: () => void | Promise<void>;
}
interface TruckLeaderboardRow {
    truck: TruckRecord;
    unitNumber: string;
    driverName: string | null;
    grossRevenue: number;
    totalMiles: number;
    rpm: number;
}
interface DispatcherLeaderboardRow {
    dispatcher: TeamDispatcher;
    grossRevenue: number;
    totalMiles: number;
    bookedLoads: number;
}
function SortIcon({ column, sortBy, sortOrder, }: {
    column: SortBy;
    sortBy: SortBy;
    sortOrder: SortOrder;
}) {
    const isActive = sortBy === column;
    const className = `inline-block ml-1 h-3.5 w-3.5 ${isActive ? 'text-sky-500' : 'opacity-30'}`;
    if (!isActive)
        return <ArrowUpDown className={className} aria-hidden/>;
    return sortOrder === 'asc' ? (<ChevronUp className={className} aria-hidden/>) : (<ChevronDown className={className} aria-hidden/>);
}
function RankBadge({ rank }: {
    rank: number;
}) {
    return (<span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800 text-xs font-bold text-zinc-700 dark:text-zinc-200">
      {rank}
    </span>);
}
const CPM_TARGET_BASELINE = 2.1;
function readTruckOdometerReading(truck: TruckRecord | null | undefined): string {
    if (!truck)
        return '—';
    const customFields = truck.custom_fields || {};
    return formatOdometerReading(customFields.Mileage ?? customFields.Odometer ?? customFields.mileage ?? null);
}
function resolveProfitabilityWindow(windowStart: string, windowEnd: string): {
    start_date: string;
    end_date: string;
} {
    if (windowStart && windowEnd) {
        return { start_date: windowStart, end_date: windowEnd };
    }
    const range = getPresetRange('mtd');
    return { start_date: range.start, end_date: range.end };
}
function cpmBadgeClass(costPerMile: number, target: number): string {
    if (costPerMile <= 0) {
        return 'bg-zinc-500/10 text-zinc-500 border-zinc-500/20';
    }
    if (costPerMile <= target) {
        return 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20';
    }
    if (costPerMile <= target * 1.15) {
        return 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20';
    }
    return 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20';
}
async function fetchLoadsForWindow(token: string, windowStart: string, windowEnd: string): Promise<LoadRecord[]> {
    const client = createApiClient(token);
    const api = createTmsApi(client);
    const collected: LoadRecord[] = [];
    let page = 1;
    let totalPages = 1;
    while (page <= totalPages) {
        const response = await api.loads.list({ page, limit: 100 });
        totalPages = response.total_pages;
        collected.push(...response.data);
        page += 1;
    }
    return collected.filter((load) => isLoadInWindow(load, windowStart, windowEnd));
}
export default function FleetFinancialsLeaderboard({ token, windowStart, windowEnd, trucks, drivers, onFleetRefresh, }: FleetFinancialsLeaderboardProps) {
    const [view, setView] = useState<LeaderboardView>('trucks');
    const [sortBy, setSortBy] = useState<SortBy>('gross');
    const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
    const [dispatchers, setDispatchers] = useState<TeamDispatcher[]>([]);
    const [windowLoads, setWindowLoads] = useState<LoadRecord[]>([]);
    const [truckFinancialRows, setTruckFinancialRows] = useState<FleetTruckFinancialRow[]>([]);
    const [loadsLoading, setLoadsLoading] = useState(false);
    const [truckFinancialsLoading, setTruckFinancialsLoading] = useState(false);
    const [selectedTruckId, setSelectedTruckId] = useState<number | null>(null);
    const [highlightedTruckId, setHighlightedTruckId] = useState<number | null>(null);
    const [assetProfitability, setAssetProfitability] = useState<AssetProfitability | null>(null);
    const [assetProfitabilityLoading, setAssetProfitabilityLoading] = useState(false);
    const [selectedDispatcher, setSelectedDispatcher] = useState<TeamDispatcher | null>(null);
    useEffect(() => {
        let cancelled = false;
        const client = createApiClient(token);
        const api = createTmsApi(client);
        void api.users
            .dispatchers()
            .then((res) => {
            if (!cancelled)
                setDispatchers(res.dispatchers || []);
        })
            .catch(() => {
            if (!cancelled)
                setDispatchers([]);
        });
        return () => {
            cancelled = true;
        };
    }, [token]);
    useEffect(() => {
        let cancelled = false;
        setLoadsLoading(true);
        void fetchLoadsForWindow(token, windowStart, windowEnd)
            .then((loads) => {
            if (!cancelled)
                setWindowLoads(loads);
        })
            .catch(() => {
            if (!cancelled)
                setWindowLoads([]);
        })
            .finally(() => {
            if (!cancelled)
                setLoadsLoading(false);
        });
        return () => {
            cancelled = true;
        };
    }, [token, windowStart, windowEnd]);
    useEffect(() => {
        let cancelled = false;
        const client = createApiClient(token);
        const api = createTmsApi(client);
        const preset = detectFleetWindowPreset(windowStart, windowEnd);
        const params = preset === 'custom'
            ? { timeframe: 'custom' as const, start_date: windowStart, end_date: windowEnd }
            : preset === 'all'
                ? { time_range: 'all' as const }
                : { timeframe: preset };
        setTruckFinancialsLoading(true);
        void api.fleet
            .financials(params)
            .then((response) => {
            if (!cancelled)
                setTruckFinancialRows(response.rows || []);
        })
            .catch(() => {
            if (!cancelled)
                setTruckFinancialRows([]);
        })
            .finally(() => {
            if (!cancelled)
                setTruckFinancialsLoading(false);
        });
        return () => {
            cancelled = true;
        };
    }, [token, windowStart, windowEnd]);
    useEffect(() => {
        if (view !== 'trucks' || highlightedTruckId == null) {
            setAssetProfitability(null);
            return;
        }
        let cancelled = false;
        const client = createApiClient(token);
        const api = createTmsApi(client);
        const window = resolveProfitabilityWindow(windowStart, windowEnd);
        setAssetProfitabilityLoading(true);
        void api.accounting
            .assetProfitability(highlightedTruckId, window)
            .then((response) => {
            if (!cancelled)
                setAssetProfitability(response);
        })
            .catch(() => {
            if (!cancelled)
                setAssetProfitability(null);
        })
            .finally(() => {
            if (!cancelled)
                setAssetProfitabilityLoading(false);
        });
        return () => {
            cancelled = true;
        };
    }, [token, view, highlightedTruckId, windowStart, windowEnd]);
    const handleSort = (column: SortBy) => {
        if (sortBy === column) {
            setSortOrder((prev) => (prev === 'desc' ? 'asc' : 'desc'));
            return;
        }
        setSortBy(column);
        setSortOrder('desc');
    };
    const headerButtonClass = 'cursor-pointer select-none hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors';
    const powerUnits = useMemo(() => trucks.filter((truck) => truck.asset_type !== 'standalone_trailer'), [trucks]);
    const truckRows = useMemo<TruckLeaderboardRow[]>(() => {
        const truckById = new Map(powerUnits.map((truck) => [truck.id, truck]));
        return truckFinancialRows
            .map((row) => {
            const truck = truckById.get(row.truck_id);
            if (!truck)
                return null;
            return {
                truck,
                unitNumber: row.truck_number ? `#${row.truck_number}` : `#${row.truck_id}`,
                driverName: row.driver_name?.trim() || null,
                grossRevenue: row.gross_revenue,
                totalMiles: row.total_miles,
                rpm: row.avg_rpm > 0 ? row.avg_rpm : computeFleetRpm(row.gross_revenue, row.total_miles),
            };
        })
            .filter((row): row is TruckLeaderboardRow => row !== null);
    }, [powerUnits, truckFinancialRows]);
    const dispatcherRows = useMemo<DispatcherLeaderboardRow[]>(() => {
        const aggregate = new Map<number, DispatcherLeaderboardRow>();
        for (const dispatcher of dispatchers) {
            aggregate.set(dispatcher.id, {
                dispatcher,
                grossRevenue: 0,
                totalMiles: 0,
                bookedLoads: 0,
            });
        }
        for (const load of windowLoads) {
            if (!load.dispatcher_id)
                continue;
            const existing = aggregate.get(load.dispatcher_id);
            if (!existing)
                continue;
            existing.grossRevenue += loadGrossRevenue(load);
            existing.totalMiles += loadTotalMiles(load);
            existing.bookedLoads += 1;
        }
        return Array.from(aggregate.values()).filter((row) => row.bookedLoads > 0 || row.grossRevenue > 0 || row.totalMiles > 0);
    }, [dispatchers, windowLoads]);
    const sortedTruckRows = useMemo(() => {
        const rows = [...truckRows];
        const direction = sortOrder === 'asc' ? 1 : -1;
        rows.sort((a, b) => {
            if (sortBy === 'gross')
                return (a.grossRevenue - b.grossRevenue) * direction;
            if (sortBy === 'rpm')
                return (a.rpm - b.rpm) * direction;
            if (sortBy === 'miles')
                return (a.totalMiles - b.totalMiles) * direction;
            return a.unitNumber.localeCompare(b.unitNumber) * direction;
        });
        return rows;
    }, [truckRows, sortBy, sortOrder]);
    const sortedDispatcherRows = useMemo(() => {
        const rows = [...dispatcherRows];
        const direction = sortOrder === 'asc' ? 1 : -1;
        rows.sort((a, b) => {
            if (sortBy === 'gross')
                return (a.grossRevenue - b.grossRevenue) * direction;
            if (sortBy === 'miles')
                return (a.totalMiles - b.totalMiles) * direction;
            if (sortBy === 'loads')
                return (a.bookedLoads - b.bookedLoads) * direction;
            const aRpm = computeFleetRpm(a.grossRevenue, a.totalMiles);
            const bRpm = computeFleetRpm(b.grossRevenue, b.totalMiles);
            return (aRpm - bRpm) * direction;
        });
        return rows;
    }, [dispatcherRows, sortBy, sortOrder]);
    const selectedTruck = useMemo(() => (selectedTruckId != null ? trucks.find((truck) => truck.id === selectedTruckId) ?? null : null), [selectedTruckId, trucks]);
    const highlightedTruck = useMemo(() => highlightedTruckId != null
        ? trucks.find((truck) => truck.id === highlightedTruckId) ?? null
        : null, [highlightedTruckId, trucks]);
    const closeTruckProfile = useCallback(() => setSelectedTruckId(null), []);
    const closeDispatcherProfile = useCallback(() => setSelectedDispatcher(null), []);
    const isLoading = view === 'trucks' ? truckFinancialsLoading : loadsLoading;
    return (<div className="space-y-6 animate-in fade-in duration-200">
      <div className="flex p-1 bg-zinc-100 dark:bg-zinc-900 rounded-lg max-w-xs gap-1">
          <button type="button" onClick={() => setView('trucks')} className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-all ${view === 'trucks'
            ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-50 shadow-sm'
            : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'}`}>
            Trucks
          </button>
          <button type="button" onClick={() => setView('dispatchers')} className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-all ${view === 'dispatchers'
            ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-50 shadow-sm'
            : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'}`}>
            Dispatchers
          </button>
        </div>

        <div className="bg-white dark:bg-[#161616] border border-zinc-200 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-sm">
          {isLoading ? (<div className="flex items-center justify-center gap-2 p-12 text-sm text-zinc-500 dark:text-zinc-400">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden/>
              Syncing leaderboard data...
            </div>) : view === 'trucks' ? (<div className="overflow-x-auto">
              <table className="w-full text-left min-w-[760px]">
                <thead className="bg-zinc-50 dark:bg-zinc-900/50 text-zinc-500 dark:text-zinc-400 text-xs font-semibold border-b border-zinc-200 dark:border-zinc-800">
                  <tr>
                    <th className="p-4">Rank</th>
                    <th className="p-4">Unit #</th>
                    <th className="p-4">Driver</th>
                    <th className="p-4">
                      <button type="button" className={headerButtonClass} onClick={() => handleSort('gross')}>
                        Gross Revenue
                        <SortIcon column="gross" sortBy={sortBy} sortOrder={sortOrder}/>
                      </button>
                    </th>
                    <th className="p-4">
                      <button type="button" className={headerButtonClass} onClick={() => handleSort('miles')}>
                        Total Miles
                        <SortIcon column="miles" sortBy={sortBy} sortOrder={sortOrder}/>
                      </button>
                    </th>
                    <th className="p-4">
                      <button type="button" className={headerButtonClass} onClick={() => handleSort('rpm')}>
                        Avg RPM
                        <SortIcon column="rpm" sortBy={sortBy} sortOrder={sortOrder}/>
                      </button>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sortedTruckRows.length === 0 ? (<tr>
                      <td colSpan={6} className="p-8 text-center text-sm text-zinc-500 dark:text-zinc-400">
                        No power units available for ranking.
                      </td>
                    </tr>) : (sortedTruckRows.map((row, index) => {
                const isHighlighted = highlightedTruckId === row.truck.id;
                return (<tr key={row.truck.id} onClick={() => setHighlightedTruckId((current) => current === row.truck.id ? null : row.truck.id)} className={`border-b border-zinc-100 dark:border-zinc-800/60 transition-colors cursor-pointer ${isHighlighted
                        ? 'bg-sky-500/10 dark:bg-sky-500/15'
                        : 'hover:bg-zinc-50/70 dark:hover:bg-zinc-900/50'}`}>
                        <td className="p-4">
                          <RankBadge rank={index + 1}/>
                        </td>
                        <td className="p-4">
                          <button type="button" onClick={(event) => {
                        event.stopPropagation();
                        setSelectedTruckId(row.truck.id);
                    }} className="font-bold text-sky-600 dark:text-sky-400 hover:underline">
                            {row.unitNumber}
                          </button>
                        </td>
                        <td className="p-4 text-zinc-700 dark:text-zinc-300">
                          {row.driverName || '—'}
                        </td>
                        <td className="p-4 text-emerald-600 dark:text-emerald-400 font-medium">
                          {formatCurrency(row.grossRevenue)}
                        </td>
                        <td className="p-4">{row.totalMiles.toLocaleString()} mi</td>
                        <td className="p-4">{formatRpm(row.grossRevenue, row.totalMiles)}</td>
                      </tr>);
            }))}
                </tbody>
              </table>
            </div>) : (<div className="overflow-x-auto">
              <table className="w-full text-left min-w-[760px]">
                <thead className="bg-zinc-50 dark:bg-zinc-900/50 text-zinc-500 dark:text-zinc-400 text-xs font-semibold border-b border-zinc-200 dark:border-zinc-800">
                  <tr>
                    <th className="p-4">Rank</th>
                    <th className="p-4">Dispatcher Name</th>
                    <th className="p-4">
                      <button type="button" className={headerButtonClass} onClick={() => handleSort('gross')}>
                        Gross Revenue
                        <SortIcon column="gross" sortBy={sortBy} sortOrder={sortOrder}/>
                      </button>
                    </th>
                    <th className="p-4">
                      <button type="button" className={headerButtonClass} onClick={() => handleSort('miles')}>
                        Total Miles
                        <SortIcon column="miles" sortBy={sortBy} sortOrder={sortOrder}/>
                      </button>
                    </th>
                    <th className="p-4">
                      <button type="button" className={headerButtonClass} onClick={() => handleSort('loads')}>
                        Booked Loads
                        <SortIcon column="loads" sortBy={sortBy} sortOrder={sortOrder}/>
                      </button>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sortedDispatcherRows.length === 0 ? (<tr>
                      <td colSpan={5} className="p-8 text-center text-sm text-zinc-500 dark:text-zinc-400">
                        No dispatcher activity in this window.
                      </td>
                    </tr>) : (sortedDispatcherRows.map((row, index) => (<tr key={row.dispatcher.id} className="border-b border-zinc-100 dark:border-zinc-800/60 hover:bg-zinc-50/70 dark:hover:bg-zinc-900/50 transition-colors">
                        <td className="p-4">
                          <RankBadge rank={index + 1}/>
                        </td>
                        <td className="p-4">
                          <button type="button" onClick={() => setSelectedDispatcher(row.dispatcher)} className="font-semibold text-sky-600 dark:text-sky-400 hover:underline text-left">
                            {row.dispatcher.display_name}
                          </button>
                        </td>
                        <td className="p-4 text-emerald-600 dark:text-emerald-400 font-medium">
                          {formatCurrency(row.grossRevenue)}
                        </td>
                        <td className="p-4">{row.totalMiles.toLocaleString()} mi</td>
                        <td className="p-4 font-semibold">{row.bookedLoads}</td>
                      </tr>)))}
                </tbody>
              </table>
            </div>)}
        </div>

        {view === 'trucks' && highlightedTruckId != null ? (<div className="border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50/40 dark:bg-zinc-950/40 p-5">
            {assetProfitabilityLoading ? (<div className="flex items-center justify-center gap-2 py-8 text-sm text-zinc-500">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden/>
                Calculating asset profitability…
              </div>) : assetProfitability ? (<div className="space-y-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-bold text-zinc-900 dark:text-white">
                      Asset Operating Detail
                      {assetProfitability.truck_number
                    ? ` — #${assetProfitability.truck_number}`
                    : ` — Unit ${assetProfitability.truck_id}`}
                    </h3>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                      {assetProfitability.period_start} → {assetProfitability.period_end}
                    </p>
                  </div>
                  <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-wide ${cpmBadgeClass(assetProfitability.cost_per_mile, assetProfitability.cpm_target || CPM_TARGET_BASELINE)}`}>
                    CPM {formatCurrency(assetProfitability.cost_per_mile)}/mi
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
                  {[
                    { label: 'Gross Revenue', value: formatCurrency(assetProfitability.gross_revenue) },
                    {
                        label: 'Operating Expense',
                        value: formatCurrency(assetProfitability.total_operating_cost),
                    },
                    {
                        label: 'Fleet Avg CPM',
                        value: `${formatCurrency(assetProfitability.fleet_avg_cpm)}/mi`,
                    },
                    {
                        label: 'Net Profitability',
                        value: formatCurrency(assetProfitability.net_profit),
                        accent: assetProfitability.net_profit >= 0
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : 'text-rose-600 dark:text-rose-400',
                    },
                ].map((metric) => (<article key={metric.label} className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#161616] p-4">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                        {metric.label}
                      </p>
                      <p className={`text-lg font-bold mt-1 tabular-nums ${metric.accent ?? 'text-zinc-900 dark:text-white'}`}>
                        {metric.value}
                      </p>
                    </article>))}
                </div>

                <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#161616] p-4">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                    Current Odometer
                  </p>
                  <p className="text-lg font-bold mt-1 tabular-nums text-zinc-900 dark:text-white">
                    {readTruckOdometerReading(highlightedTruck)}
                  </p>
                </div>

                <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#161616]">
                  <table className="w-full text-left text-xs min-w-[640px]">
                    <thead className="bg-zinc-50 dark:bg-zinc-900/50 text-zinc-500 dark:text-zinc-400 uppercase text-[10px] font-bold border-b border-zinc-200 dark:border-zinc-800">
                      <tr>
                        <th className="px-4 py-3">Expense Category</th>
                        <th className="px-4 py-3 text-right">Amount</th>
                        <th className="px-4 py-3 text-right">Share</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/80">
                      {assetProfitability.expense_breakdown.map((row) => {
                    const share = assetProfitability.total_operating_cost > 0
                        ? (row.amount / assetProfitability.total_operating_cost) * 100
                        : 0;
                    return (<tr key={row.category}>
                            <td className="px-4 py-3 font-medium text-zinc-800 dark:text-zinc-200">
                              {row.category}
                            </td>
                            <td className="px-4 py-3 text-right tabular-nums">
                              {formatCurrency(row.amount)}
                            </td>
                            <td className="px-4 py-3 text-right tabular-nums text-zinc-500">
                              {share.toFixed(1)}%
                            </td>
                          </tr>);
                })}
                      <tr className="bg-zinc-50/80 dark:bg-zinc-900/40 font-semibold">
                        <td className="px-4 py-3">Total Miles Logged</td>
                        <td className="px-4 py-3 text-right tabular-nums" colSpan={2}>
                          {assetProfitability.total_miles.toLocaleString()} mi
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>) : (<p className="text-sm text-center text-zinc-500 dark:text-zinc-400 py-8">
                Unable to load asset profitability for this unit.
              </p>)}
          </div>) : null}

      {selectedTruck ? (<ProfileDrawerShell open onClose={closeTruckProfile}>
          <TruckDetailModal bare token={token} truck={selectedTruck} drivers={drivers} trucks={trucks} onClose={closeTruckProfile} onSuccess={async () => {
                await onFleetRefresh();
            }}/>
        </ProfileDrawerShell>) : null}

      {selectedDispatcher ? (<ProfileDrawerShell open onClose={closeDispatcherProfile}>
          <div className="flex flex-col h-full bg-white dark:bg-[#161616] text-zinc-900 dark:text-zinc-100">
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200 dark:border-zinc-800">
              <h2 className="text-lg font-bold flex items-center gap-2">
                <UserCircle className="text-sky-500" size={20} aria-hidden/>
                Dispatcher Profile
              </h2>
              <button type="button" onClick={closeDispatcherProfile} className="text-xs font-bold text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200">
                Close
              </button>
            </div>
            <div className="p-6 space-y-4 overflow-y-auto">
              <div>
                <p className="text-xs font-bold uppercase text-zinc-400 tracking-wider">Name</p>
                <p className="text-lg font-bold mt-1">{selectedDispatcher.display_name}</p>
              </div>
              <div>
                <p className="text-xs font-bold uppercase text-zinc-400 tracking-wider">Email</p>
                <p className="text-sm font-medium mt-1 flex items-center gap-2">
                  <Mail size={14} className="text-zinc-400" aria-hidden/>
                  {selectedDispatcher.email}
                </p>
              </div>
              {selectedDispatcher.commission_rate != null ? (<div>
                  <p className="text-xs font-bold uppercase text-zinc-400 tracking-wider">Commission Rate</p>
                  <p className="text-sm font-semibold mt-1">{selectedDispatcher.commission_rate}%</p>
                </div>) : null}
              <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 p-4 bg-zinc-50/60 dark:bg-zinc-900/40">
                <p className="text-xs font-bold uppercase text-zinc-400 tracking-wider mb-3">
                  Window Performance
                </p>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-zinc-500">Booked Loads</p>
                    <p className="font-bold text-lg">
                      {dispatcherRows.find((row) => row.dispatcher.id === selectedDispatcher.id)?.bookedLoads ?? 0}
                    </p>
                  </div>
                  <div>
                    <p className="text-zinc-500">Gross Revenue</p>
                    <p className="font-bold text-lg text-emerald-600 dark:text-emerald-400">
                      {formatCurrency(dispatcherRows.find((row) => row.dispatcher.id === selectedDispatcher.id)?.grossRevenue ?? 0)}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </ProfileDrawerShell>) : null}
    </div>);
}
