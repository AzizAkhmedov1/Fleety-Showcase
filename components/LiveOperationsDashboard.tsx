'use client';
import { useCallback, useEffect, useMemo, useRef, useState, memo, type ReactNode } from 'react';
import { Activity, AlertTriangle, ArrowDown, ArrowUp, Clock, DollarSign, FileText, MoreHorizontal, Radio, Truck, Users, Wrench, X, } from 'lucide-react';
import MapTypeToggle, { MAP_ACTION_BUTTON_CLASS, type MapViewType } from '@/components/MapTypeToggle';
import LiveOperationsBottomTier from '@/components/LiveOperationsBottomTier';
import LiveOperationsMap, { type LiveOperationsMapHandle } from '@/components/LiveOperationsMap';
import ProfileDrawerShell from '@/components/ui/ProfileDrawerShell';
import { createApiClient, readPersistedTmsToken } from '@/lib/api-client';
import { createTmsApi, type DriverRecord, type EtaBoardRow, type LoadRecord, type TelemetryMapMarker, type TelemetryMapTrail, type TruckRecord, } from '@/lib/tms-api';
import { buildEtaBoardIndex, buildRecentEvents, buildRevenueTodaySummary, buildLiveTrackingLoadIds, computeMileageProgress, countIdleDrivers, countTrucksMoving, extractTelemetryCoordinate, formatCurrency, formatEtaLabel, formatLoadDisplayId, formatLoadRoute, formatRelativeTime, formatRelativeUpdate, getIdleDrivers, getUiStatusLabel, hasLiveTelemetryTrack, isActiveOperationalLoad, isInTransitLoad, isLoadDelayed, isValidTelemetryCoordinate, normalizeLiveLoadStatus, resolveDriverName, resolveIdleDriverMapPoints, sumRevenueToday, EVENT_TONE_CLASSES, type LiveOpsEvent, } from '@/lib/live-operations-utils';
interface LiveOperationsDashboardProps {
    loads: LoadRecord[];
    allLoads: LoadRecord[];
    trucks: TruckRecord[];
    drivers: DriverRecord[];
    etaBoard: EtaBoardRow[];
    onViewLoadDetails?: (loadId: number) => void;
    canViewNetProfit?: boolean;
}
type LiveOpsKpiFilter = 'all' | 'active' | 'delayed' | 'moving' | 'idle_drivers';
const KPI_FILTER_LABELS: Record<Exclude<LiveOpsKpiFilter, 'all'>, string> = {
    active: 'in transit only',
    delayed: 'delayed only',
    moving: 'moving units only',
    idle_drivers: 'idle drivers focus',
};
const KPI_ACTIVE_STYLES: Record<Exclude<LiveOpsKpiFilter, 'all'>, string> = {
    active: 'border-emerald-500 bg-emerald-500/10 ring-2 ring-emerald-500/50 dark:border-emerald-400 dark:bg-emerald-500/15',
    moving: 'border-violet-500 bg-violet-500/10 ring-2 ring-violet-500/50 dark:border-violet-400 dark:bg-violet-500/15',
    delayed: 'border-amber-500 bg-amber-500/10 ring-2 ring-amber-500/50 dark:border-amber-400 dark:bg-amber-500/15',
    idle_drivers: 'border-orange-500 bg-orange-500/10 ring-2 ring-orange-500/50 dark:border-orange-400 dark:bg-orange-500/15',
};
interface MetricCardProps {
    label: string;
    value: string;
    trend: string;
    trendDirection: 'up' | 'down' | 'neutral';
    icon: ReactNode;
    onClick?: () => void;
    isActive?: boolean;
    activeAccent?: Exclude<LiveOpsKpiFilter, 'all'>;
}
function MetricCard({ label, value, trend, trendDirection, icon, onClick, isActive = false, activeAccent, }: MetricCardProps) {
    const trendColorClass = trendDirection === 'up'
        ? 'text-emerald-600 dark:text-emerald-400'
        : trendDirection === 'down'
            ? 'text-red-600 dark:text-red-400'
            : 'text-amber-600 dark:text-amber-400';
    const TrendIcon = trendDirection === 'down' ? ArrowDown : ArrowUp;
    const body = (<>
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-zinc-200 bg-zinc-50 text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800/80 dark:text-zinc-300">
          {icon}
        </div>
      </div>
      <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">{label}</p>
      <p className="mt-1 text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">{value}</p>
      <p className={`mt-2 flex items-center gap-1 text-xs font-semibold ${trendColorClass}`}>
        {trendDirection !== 'neutral' && <TrendIcon size={14} aria-hidden="true"/>}
        <span>{trend}</span>
      </p>
    </>);
    const interactiveClassName = onClick
        ? 'cursor-pointer transition-all duration-200 ease-in-out hover:bg-neutral-900/40 hover:border-neutral-700 active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 dark:focus-visible:ring-zinc-500'
        : '';
    const activeClassName = isActive && activeAccent ? KPI_ACTIVE_STYLES[activeAccent] : '';
    const shellClassName = `rounded-xl border border-zinc-200 bg-white p-4 shadow-sm transition-all duration-200 ease-in-out dark:border-zinc-800 dark:bg-zinc-900/50 ${interactiveClassName} ${activeClassName}`;
    if (onClick) {
        return (<button type="button" onClick={onClick} aria-label={`${label}: ${value}`} aria-pressed={isActive} className={`w-full text-left ${shellClassName}`}>
        {body}
      </button>);
    }
    return <article className={shellClassName}>{body}</article>;
}
function LoadStatusBadge({ label, delayed }: {
    label: string;
    delayed: boolean;
}) {
    return (<span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-normal ${delayed
            ? 'border border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-400'
            : 'border border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-400'}`}>
      {label}
    </span>);
}
function ProgressTrack({ value, variant = 'green' }: {
    value: number;
    variant?: 'green' | 'amber';
}) {
    const fillClass = variant === 'amber'
        ? 'bg-amber-500 dark:bg-amber-400'
        : 'bg-emerald-500 dark:bg-emerald-400';
    return (<div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
      <div className={`h-full rounded-full transition-all ${fillClass}`} style={{ width: `${Math.min(100, Math.max(0, value))}%` }}/>
    </div>);
}
interface ActiveLoadCardProps {
    load: LoadRecord;
    etaRow?: EtaBoardRow;
    driverName: string;
    route: string;
    progress: number;
    traveledMiles: number;
    totalMiles: number;
    etaLabel: string;
    statusLabel: string;
    delayed: boolean;
    selected: boolean;
    onSelect: () => void;
    onMouseEnter?: () => void;
    onMouseLeave?: () => void;
}
function ActiveLoadCard({ load, driverName, route, progress, traveledMiles, totalMiles, etaLabel, statusLabel, delayed, selected, onSelect, onMouseEnter, onMouseLeave, }: ActiveLoadCardProps) {
    const progressVariant = delayed ? 'amber' : 'green';
    return (<article onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave} className={`rounded-xl border p-3 shadow-sm transition-colors ${selected
            ? 'border-blue-300 bg-blue-50/70 dark:border-blue-500/40 dark:bg-blue-500/10'
            : 'border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900/80'}`}>
      <button type="button" onClick={onSelect} className="w-full text-left">
        <div className="mb-2 flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <span className="truncate text-sm font-bold text-zinc-900 dark:text-zinc-50">
              {formatLoadDisplayId(load)}
            </span>
            <LoadStatusBadge label={statusLabel} delayed={delayed}/>
          </div>
          <span role="presentation" className="shrink-0 rounded-md p-1 text-zinc-400" onClick={(event) => event.stopPropagation()}>
            <MoreHorizontal size={16}/>
          </span>
        </div>

        <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{driverName}</p>
        <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">{route}</p>

        <div className="mt-3 flex items-center gap-2">
          <Truck size={14} className={`shrink-0 ${delayed ? 'text-amber-500 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'}`} aria-hidden="true"/>
          <span className={`text-xs font-bold ${delayed ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
            {progress}%
          </span>
          {totalMiles > 0 && (<span className="shrink-0 text-[10px] font-medium text-zinc-500 dark:text-zinc-400">
              {traveledMiles.toLocaleString()} of {totalMiles.toLocaleString()} mi
            </span>)}
          <div className="min-w-0 flex-1">
            <ProgressTrack value={progress} variant={progressVariant}/>
          </div>
        </div>

        <p className="mt-2 text-xs font-medium text-zinc-600 dark:text-zinc-400">ETA {etaLabel}</p>
      </button>
    </article>);
}
interface MapTruckPopupProps {
    load: LoadRecord;
    truck?: TruckRecord;
    etaRow?: EtaBoardRow;
    driverName: string;
    mapType: MapViewType;
    onToggleMapType: () => void;
    onClose: () => void;
    onViewDetails?: (loadId: number) => void;
}
function MapTruckPopup({ load, truck, etaRow, driverName, mapType, onToggleMapType, onClose, onViewDetails, }: MapTruckPopupProps) {
    const delayed = isLoadDelayed(load, etaRow);
    const mileage = computeMileageProgress(load, etaRow);
    const moving = hasLiveTelemetryTrack(etaRow);
    const nextStop = load.detailed_stops?.find((stop) => {
        const type = (stop.stop_type || '').toLowerCase();
        return type !== 'pickup' && type !== 'delivery';
    });
    return (<div className="absolute left-6 top-6 z-10 w-80 rounded-xl border border-zinc-200 bg-white p-4 shadow-xl dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-50">
            Truck #{truck?.truck_number || load.truck_number || load.truck_id || '—'}
          </h3>
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${moving
            ? 'border border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-400'
            : 'border border-zinc-200 bg-zinc-50 text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300'}`}>
            {moving ? 'Moving' : 'Idle'}
          </span>
        </div>
        <button type="button" aria-label="Close truck details" onClick={onClose} className="rounded-md p-1 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200">
          <X size={16}/>
        </button>
      </div>

      <div className="grid grid-cols-3 gap-y-2 py-3 text-xs">
        <span className="font-medium text-zinc-500 dark:text-zinc-400">Driver</span>
        <span className="col-span-2 font-semibold text-zinc-900 dark:text-zinc-100">{driverName}</span>

        <span className="font-medium text-zinc-500 dark:text-zinc-400">Load</span>
        <span className="col-span-2 font-semibold text-blue-600 dark:text-blue-400">
          {formatLoadDisplayId(load)}
        </span>

        <span className="font-medium text-zinc-500 dark:text-zinc-400">Route</span>
        <span className="col-span-2 font-medium text-zinc-900 dark:text-zinc-100">{formatLoadRoute(load)}</span>

        <span className="font-medium text-zinc-500 dark:text-zinc-400">ETA</span>
        <span className="col-span-2 font-medium text-zinc-900 dark:text-zinc-100">
          {formatEtaLabel(load, etaRow)}
        </span>

        <span className="font-medium text-zinc-500 dark:text-zinc-400">Speed</span>
        <span className="col-span-2 font-medium text-zinc-900 dark:text-zinc-100">—</span>

        <span className="font-medium text-zinc-500 dark:text-zinc-400">Last Update</span>
        <span className="col-span-2 font-medium text-zinc-900 dark:text-zinc-100">
          {formatRelativeUpdate(etaRow)}
        </span>
      </div>

      <div className="border-t border-zinc-100 pt-3 dark:border-zinc-800">
        <p className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
          Progress: <span className="font-bold text-zinc-900 dark:text-zinc-50">{mileage.percent}%</span>
          {mileage.total > 0 && (<>
              <span className="text-zinc-400 dark:text-zinc-500"> | </span>
              {mileage.traveled.toLocaleString()} of {mileage.total.toLocaleString()} mi
            </>)}
        </p>
        <div className="mt-2">
          <ProgressTrack value={mileage.percent} variant={delayed ? 'amber' : 'green'}/>
        </div>
      </div>

      {(nextStop || load.destination) && (<div className="mt-4 border-t border-zinc-100 pt-3 dark:border-zinc-800">
          <p className="mb-2 text-[10px] font-bold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Next Stop
          </p>
          <div className="relative pl-4">
            <span className="absolute bottom-1 left-[5px] top-1 w-px bg-zinc-200 dark:bg-zinc-700" aria-hidden="true"/>
            <div className="relative mb-3 flex items-start gap-2">
              <span className="absolute -left-4 mt-0.5 text-emerald-600 dark:text-emerald-400" aria-hidden="true">
                ●
              </span>
              <p className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                {nextStop?.company_name || nextStop?.address || load.destination}
              </p>
            </div>
            <div className="relative flex items-start gap-2">
              <span className="absolute -left-4 mt-0.5 text-zinc-400 dark:text-zinc-500" aria-hidden="true">
                ○
              </span>
              <p className="text-xs text-zinc-600 dark:text-zinc-400">
                ETA: {nextStop?.date_time || formatEtaLabel(load, etaRow)}
              </p>
            </div>
          </div>
        </div>)}

      <div className="mt-4 flex flex-col gap-2">
        <button type="button" onClick={() => onViewDetails?.(load.id)} className={MAP_ACTION_BUTTON_CLASS}>
          View Details
        </button>
        <MapTypeToggle mapType={mapType} onToggle={onToggleMapType}/>
      </div>
    </div>);
}
const METRIC_ICON_SIZE = 20;
const METRIC_ICON_PROPS = { size: METRIC_ICON_SIZE, 'aria-hidden': true as const };
function LiveOpsEventsPanel({ events }: {
    events: LiveOpsEvent[];
}) {
    if (events.length === 0) {
        return (<p className="px-6 py-8 text-sm text-zinc-500 dark:text-zinc-400">
        No operational events recorded for this fleet window.
      </p>);
    }
    return (<ul className="space-y-4 overflow-y-auto px-6 py-4">
      {events.map((event) => (<li key={event.id} className="relative pl-5">
          <span className={`absolute left-0 top-1.5 h-2.5 w-2.5 rounded-full ${EVENT_TONE_CLASSES[event.tone]}`} aria-hidden="true"/>
          <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{event.message}</p>
          <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
            {formatRelativeTime(event.timestampIso)}
          </p>
        </li>))}
    </ul>);
}
function LiveOpsLoadsPanel({ fleetLoads, trucks, drivers, etaByLoadId, onSelectLoad, }: {
    fleetLoads: LoadRecord[];
    trucks: TruckRecord[];
    drivers: DriverRecord[];
    etaByLoadId: Map<number, EtaBoardRow>;
    onSelectLoad: (loadId: number) => void;
}) {
    if (fleetLoads.length === 0) {
        return (<p className="px-6 py-8 text-sm text-zinc-500 dark:text-zinc-400">
        No active fleet loads with assigned units.
      </p>);
    }
    return (<div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-6 py-4">
      {fleetLoads.map((load) => {
            const etaRow = etaByLoadId.get(load.id);
            const delayed = isLoadDelayed(load, etaRow);
            const mileage = computeMileageProgress(load, etaRow);
            return (<ActiveLoadCard key={load.id} load={load} etaRow={etaRow} driverName={resolveDriverName(load, trucks, drivers, etaRow)} route={formatLoadRoute(load)} progress={mileage.percent} traveledMiles={mileage.traveled} totalMiles={mileage.total} etaLabel={formatEtaLabel(load, etaRow)} statusLabel={getUiStatusLabel(load, etaRow)} delayed={delayed} selected={false} onSelect={() => onSelectLoad(load.id)}/>);
        })}
    </div>);
}
interface RevenueTodayOverlayProps {
    open: boolean;
    onClose: () => void;
    totalRevenue: number;
    allLoads: LoadRecord[];
}
function RevenueTodayOverlay({ open, onClose, totalRevenue, allLoads }: RevenueTodayOverlayProps) {
    const summary = useMemo(() => buildRevenueTodaySummary(allLoads), [allLoads]);
    const breakdown = summary.rows;
    useEffect(() => {
        if (!open)
            return;
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape')
                onClose();
        };
        document.addEventListener('keydown', onKeyDown);
        return () => document.removeEventListener('keydown', onKeyDown);
    }, [open, onClose]);
    if (!open)
        return null;
    return (<div className="fixed inset-0 z-[94] flex items-center justify-center p-4">
      <button type="button" className="absolute inset-0 bg-zinc-900/60 backdrop-blur-sm dark:bg-[#0B0B0B]/80" onClick={onClose} aria-label="Close revenue breakdown"/>
      <div role="dialog" aria-modal="true" aria-labelledby="revenue-today-title" className="relative z-10 flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex items-center justify-between border-b border-zinc-200 px-5 py-4 dark:border-zinc-800">
          <h2 id="revenue-today-title" className="text-base font-bold text-zinc-900 dark:text-zinc-50">
            Revenue Today
          </h2>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-md p-1 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200">
            <X size={18}/>
          </button>
        </div>

        <div className="border-b border-zinc-100 px-5 py-4 dark:border-zinc-800">
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Total booked today
          </p>
          <p className="mt-1 text-3xl font-bold text-zinc-900 dark:text-zinc-50">
            {formatCurrency(summary.totalBooked || totalRevenue)}
          </p>
          <div className="mt-4 grid grid-cols-3 gap-3">
            <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 dark:border-zinc-800 dark:bg-zinc-900/60">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                Net profit
              </p>
              <p className="mt-1 text-sm font-bold text-emerald-600 dark:text-emerald-400">
                {formatCurrency(summary.totalProfit)}
              </p>
            </div>
            <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 dark:border-zinc-800 dark:bg-zinc-900/60">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                Margin
              </p>
              <p className="mt-1 text-sm font-bold text-zinc-900 dark:text-zinc-50">
                {summary.profitMarginPct}%
              </p>
            </div>
            <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 dark:border-zinc-800 dark:bg-zinc-900/60">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                Completed
              </p>
              <p className="mt-1 text-sm font-bold text-zinc-900 dark:text-zinc-50">
                {summary.completedToday}
              </p>
            </div>
          </div>
          <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">
            {summary.bookedToday} load{summary.bookedToday === 1 ? '' : 's'} booked today
          </p>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {breakdown.length === 0 ? (<p className="text-sm text-zinc-500 dark:text-zinc-400">No revenue posted today.</p>) : (<ul className="space-y-3">
              {breakdown.map((row) => (<li key={row.loadId} className="rounded-lg border border-zinc-200 px-3 py-2.5 dark:border-zinc-800 dark:bg-zinc-900/50">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-bold text-zinc-900 dark:text-zinc-50">{row.displayId}</span>
                    <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
                      {formatCurrency(row.total)}
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">{row.route}</p>
                  <div className="mt-2 grid grid-cols-3 gap-2 text-[10px] font-medium text-zinc-600 dark:text-zinc-400">
                    <span>Linehaul {formatCurrency(row.linehaul)}</span>
                    <span>FSC {formatCurrency(row.fuelSurcharge)}</span>
                    <span>Acc. {formatCurrency(row.accessorial)}</span>
                  </div>
                </li>))}
            </ul>)}
        </div>
      </div>
    </div>);
}
function LiveOperationsDashboard({ loads, allLoads, trucks, drivers, etaBoard, onViewLoadDetails, canViewNetProfit = true, }: LiveOperationsDashboardProps) {
    const etaByLoadId = useMemo(() => buildEtaBoardIndex(etaBoard), [etaBoard]);
    const [kpiFilter, setKpiFilter] = useState<LiveOpsKpiFilter>('all');
    const [revenueOverlayOpen, setRevenueOverlayOpen] = useState(false);
    const [eventsDrawerOpen, setEventsDrawerOpen] = useState(false);
    const [loadsDrawerOpen, setLoadsDrawerOpen] = useState(false);
    const mapRef = useRef<LiveOperationsMapHandle>(null);
    const prevKpiFilterRef = useRef<LiveOpsKpiFilter>(kpiFilter);
    const hasInitializedSelectionRef = useRef(false);
    const fleetLoads = useMemo(() => {
        const seen = new Set<number>();
        return loads
            .filter((load) => load.truck_id)
            .filter((load) => normalizeLiveLoadStatus(load.status) !== 'DELIVERED')
            .filter((load) => {
            if (seen.has(load.id))
                return false;
            seen.add(load.id);
            return true;
        })
            .sort((a, b) => b.id - a.id);
    }, [loads]);
    const liveMovingLoadIds = useMemo(() => buildLiveTrackingLoadIds(fleetLoads, etaBoard), [fleetLoads, etaBoard]);
    const delayedLoadIds = useMemo(() => {
        const ids = new Set<number>();
        loads.forEach((load) => {
            if (isLoadDelayed(load, etaByLoadId.get(load.id))) {
                ids.add(load.id);
            }
        });
        return ids;
    }, [loads, etaByLoadId]);
    const [selectedLoadId, setSelectedLoadId] = useState<number | null>(null);
    const [hoveredLoadId, setHoveredLoadId] = useState<number | null>(null);
    const [popupVisible, setPopupVisible] = useState(true);
    const [mapType, setMapType] = useState<MapViewType>('roadmap');
    const [telemetryTrails, setTelemetryTrails] = useState<TelemetryMapTrail[]>([]);
    const filteredFleetLoads = useMemo(() => {
        switch (kpiFilter) {
            case 'active':
                return fleetLoads.filter(isInTransitLoad);
            case 'delayed':
                return fleetLoads.filter((load) => delayedLoadIds.has(load.id));
            case 'moving':
                return fleetLoads.filter((load) => liveMovingLoadIds.has(load.id));
            case 'idle_drivers':
                return [];
            default:
                return fleetLoads;
        }
    }, [fleetLoads, kpiFilter, delayedLoadIds, liveMovingLoadIds]);
    const displayFleetLoads = useMemo(() => {
        if (kpiFilter !== 'all') {
            return filteredFleetLoads;
        }
        if (selectedLoadId == null)
            return filteredFleetLoads;
        if (filteredFleetLoads.some((load) => load.id === selectedLoadId)) {
            return filteredFleetLoads;
        }
        const pinned = fleetLoads.find((load) => load.id === selectedLoadId);
        return pinned ? [pinned, ...filteredFleetLoads] : filteredFleetLoads;
    }, [filteredFleetLoads, fleetLoads, selectedLoadId, kpiFilter]);
    const visibleLoadIds = useMemo(() => new Set(displayFleetLoads.map((load) => load.id)), [displayFleetLoads]);
    const idleDriverRows = useMemo(() => getIdleDrivers(loads, trucks, drivers), [loads, trucks, drivers]);
    const idleAssetMarkers = useMemo(() => {
        if (kpiFilter !== 'idle_drivers')
            return [];
        return resolveIdleDriverMapPoints(idleDriverRows, trucks).map((point) => ({
            id: point.driverId,
            latitude: point.latitude,
            longitude: point.longitude,
            label: point.driverName,
        }));
    }, [kpiFilter, idleDriverRows, trucks]);
    const showIdleDriverMapNotice = kpiFilter === 'idle_drivers' && idleAssetMarkers.length === 0 && idleDriverRows.length > 0;
    const panelLoads = useMemo(() => {
        switch (kpiFilter) {
            case 'active':
                return loads.filter(isInTransitLoad);
            case 'delayed':
                return loads.filter((load) => delayedLoadIds.has(load.id));
            case 'moving':
                return loads.filter((load) => liveMovingLoadIds.has(load.id));
            case 'idle_drivers':
                return loads;
            default:
                return loads;
        }
    }, [loads, kpiFilter, delayedLoadIds, liveMovingLoadIds]);
    const bottomTierLoads = useMemo(() => (kpiFilter === 'idle_drivers' ? loads : panelLoads), [kpiFilter, loads, panelLoads]);
    const allRecentEvents = useMemo(() => buildRecentEvents(loads, allLoads, etaBoard, 200), [loads, allLoads, etaBoard]);
    const client = useMemo(() => createTmsApi(createApiClient(readPersistedTmsToken())), []);
    const telemetryMarkers = useMemo<TelemetryMapMarker[]>(() => {
        return etaBoard
            .filter((row) => visibleLoadIds.has(row.load_id) &&
            row.simulated !== true &&
            isValidTelemetryCoordinate(row.current_lat, row.current_lng))
            .map((row) => ({
            loadId: row.load_id,
            latitude: row.current_lat,
            longitude: row.current_lng,
            heading: row.heading ?? null,
        }));
    }, [etaBoard, visibleLoadIds]);
    const delayedCount = delayedLoadIds.size;
    const fetchTelemetryTrails = useCallback(async (loadId: number | null) => {
        try {
            const response = await client.mobile.telemetryTrails({
                load_id: loadId ?? undefined,
                limit: 200,
            });
            const trails: TelemetryMapTrail[] = (response.trails ?? [])
                .map((trail) => ({
                loadId: trail.load_id ?? null,
                points: (trail.points ?? [])
                    .filter((point) => typeof point.latitude === 'number' &&
                    typeof point.longitude === 'number' &&
                    !Number.isNaN(point.latitude) &&
                    !Number.isNaN(point.longitude))
                    .map((point) => ({
                    lat: point.latitude,
                    lng: point.longitude,
                })),
            }))
                .filter((trail) => trail.points.length > 0);
            setTelemetryTrails(trails);
        }
        catch {
            setTelemetryTrails([]);
        }
    }, [client]);
    useEffect(() => {
        void fetchTelemetryTrails(selectedLoadId);
    }, [fetchTelemetryTrails, selectedLoadId]);
    useEffect(() => {
        if (prevKpiFilterRef.current !== kpiFilter) {
            prevKpiFilterRef.current = kpiFilter;
            if (kpiFilter === 'idle_drivers' && idleAssetMarkers.length > 0) {
                window.requestAnimationFrame(() => mapRef.current?.fitLoadViewport(null));
            }
        }
    }, [kpiFilter, idleAssetMarkers.length]);
    useEffect(() => {
        if (kpiFilter === 'idle_drivers')
            return;
        if (selectedLoadId != null) {
            const inFiltered = filteredFleetLoads.some((load) => load.id === selectedLoadId);
            if (inFiltered) {
                hasInitializedSelectionRef.current = true;
                return;
            }
            const fallbackId = filteredFleetLoads[0]?.id ?? null;
            setSelectedLoadId(fallbackId);
            if (fallbackId == null)
                setPopupVisible(false);
            return;
        }
        if (!hasInitializedSelectionRef.current && filteredFleetLoads.length > 0) {
            const initialId = kpiFilter === 'moving'
                ? filteredFleetLoads.find((load) => liveMovingLoadIds.has(load.id))?.id ??
                    filteredFleetLoads[0]?.id
                : filteredFleetLoads[0]?.id;
            if (initialId != null) {
                setSelectedLoadId(initialId);
                hasInitializedSelectionRef.current = true;
            }
        }
    }, [filteredFleetLoads, selectedLoadId, kpiFilter, liveMovingLoadIds]);
    const focusLoadOnMap = useCallback((loadId: number | null) => {
        if (loadId == null) {
            setSelectedLoadId(null);
            setPopupVisible(false);
            return;
        }
        const etaRow = etaByLoadId.get(loadId);
        const coordinate = extractTelemetryCoordinate(etaRow);
        setSelectedLoadId(loadId);
        setPopupVisible(true);
        if (!coordinate)
            return;
        window.requestAnimationFrame(() => {
            mapRef.current?.fitCoordinates([coordinate]);
        });
    }, [etaByLoadId]);
    const toggleKpiFilter = useCallback((nextFilter: LiveOpsKpiFilter) => {
        setKpiFilter((previous) => {
            const resolved = previous === nextFilter ? 'all' : nextFilter;
            if (resolved === 'moving') {
                const pool = fleetLoads.filter((load) => liveMovingLoadIds.has(load.id));
                focusLoadOnMap(pool[0]?.id ?? null);
            }
            else if (resolved !== 'all' && resolved !== 'idle_drivers') {
                const pool = resolved === 'active'
                    ? fleetLoads.filter(isInTransitLoad)
                    : fleetLoads.filter((load) => isLoadDelayed(load, etaByLoadId.get(load.id)));
                focusLoadOnMap(pool[0]?.id ?? null);
            }
            return resolved;
        });
    }, [fleetLoads, etaByLoadId, liveMovingLoadIds, focusLoadOnMap]);
    const trucksMoving = useMemo(() => countTrucksMoving(loads, etaBoard), [loads, etaBoard]);
    const activeCount = useMemo(() => loads.filter(isActiveOperationalLoad).length, [loads]);
    const fleetTruckCount = Math.max(trucks.length, 1);
    const idleDrivers = useMemo(() => countIdleDrivers(loads, trucks, drivers), [loads, trucks, drivers]);
    const revenueToday = useMemo(() => sumRevenueToday(allLoads), [allLoads]);
    const metrics: MetricCardProps[] = useMemo(() => {
        const cards: MetricCardProps[] = [
            {
                label: 'Active Loads',
                value: String(activeCount),
                trend: `${fleetLoads.length} on live board`,
                trendDirection: 'up',
                icon: <Activity {...METRIC_ICON_PROPS}/>,
                onClick: () => toggleKpiFilter('active'),
                isActive: kpiFilter === 'active',
                activeAccent: 'active',
            },
            {
                label: 'Trucks Moving',
                value: String(trucksMoving),
                trend: `${Math.round((trucksMoving / fleetTruckCount) * 100)}% of fleet`,
                trendDirection: 'neutral',
                icon: <Truck {...METRIC_ICON_PROPS}/>,
                onClick: () => toggleKpiFilter('moving'),
                isActive: kpiFilter === 'moving',
                activeAccent: 'moving',
            },
            {
                label: 'Delayed Loads',
                value: String(delayedCount),
                trend: delayedCount > 0 ? 'ETA past delivery window' : 'All on schedule',
                trendDirection: delayedCount > 0 ? 'down' : 'up',
                icon: <AlertTriangle {...METRIC_ICON_PROPS}/>,
                onClick: () => toggleKpiFilter('delayed'),
                isActive: kpiFilter === 'delayed',
                activeAccent: 'delayed',
            },
            {
                label: 'Drivers Idle',
                value: String(idleDrivers),
                trend: `${drivers.length} total drivers`,
                trendDirection: 'neutral',
                icon: <Wrench {...METRIC_ICON_PROPS}/>,
                onClick: () => toggleKpiFilter('idle_drivers'),
                isActive: kpiFilter === 'idle_drivers',
                activeAccent: 'idle_drivers',
            },
        ];
        if (canViewNetProfit) {
            cards.push({
                label: 'Revenue Today',
                value: formatCurrency(revenueToday),
                trend: revenueToday > 0 ? 'Booked today' : 'No revenue posted today',
                trendDirection: revenueToday > 0 ? 'up' : 'neutral',
                icon: <DollarSign {...METRIC_ICON_PROPS}/>,
                onClick: () => setRevenueOverlayOpen(true),
            });
        }
        return cards;
    }, [
        activeCount,
        fleetLoads.length,
        trucksMoving,
        fleetTruckCount,
        delayedCount,
        idleDrivers,
        drivers.length,
        canViewNetProfit,
        revenueToday,
        toggleKpiFilter,
        kpiFilter,
    ]);
    const filterHint = kpiFilter !== 'all' ? KPI_FILTER_LABELS[kpiFilter as Exclude<LiveOpsKpiFilter, 'all'>] : null;
    const handleDrawerLoadSelect = useCallback((loadId: number) => {
        setLoadsDrawerOpen(false);
        focusLoadOnMap(loadId);
    }, [focusLoadOnMap]);
    const selectedLoad = fleetLoads.find((load) => load.id === selectedLoadId) ??
        displayFleetLoads.find((load) => load.id === selectedLoadId) ??
        null;
    const selectedEta = selectedLoad ? etaByLoadId.get(selectedLoad.id) : undefined;
    const selectedTruck = selectedLoad
        ? trucks.find((truck) => truck.id === selectedLoad.truck_id)
        : undefined;
    return (<div className="animate-in fade-in duration-200">
      <section aria-label="Operations metrics" className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {metrics.map((metric) => (<MetricCard key={metric.label} {...metric}/>))}
      </section>

      <section aria-label="Live operations workspace" className="mb-4 grid grid-cols-1 gap-6 lg:grid-cols-4">
        <div className="lg:col-span-3">
          <div className="flex h-[600px] flex-col overflow-hidden rounded-xl border border-zinc-200 bg-zinc-50 shadow-sm transition-colors dark:border-zinc-800 dark:bg-zinc-900/30">
            <div className="flex items-center justify-between border-b border-zinc-200 bg-white px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900/50">
              <h2 className="text-sm font-bold text-zinc-900 dark:text-zinc-50">Fleet Map</h2>
              <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                {displayFleetLoads.length} active routes
                {filterHint ? ` · ${filterHint}` : ''}
              </span>
            </div>

            <div className="relative min-h-[540px] flex-1">
              <button type="button" onClick={() => setKpiFilter('all')} aria-hidden={kpiFilter === 'all'} className={`absolute left-1/2 top-3 z-20 flex -translate-x-1/2 items-center gap-1.5 rounded-full border border-zinc-300 bg-white/95 px-3 py-1 text-[11px] font-semibold text-zinc-700 shadow-md backdrop-blur-sm transition-all duration-200 ease-in-out hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-900/95 dark:text-zinc-200 dark:hover:bg-zinc-800 ${kpiFilter === 'all'
            ? 'pointer-events-none scale-95 opacity-0'
            : 'scale-100 opacity-100'}`}>
                <X size={12} aria-hidden="true"/>
                Clear Filter
              </button>
              <LiveOperationsMap ref={mapRef} loads={displayFleetLoads} selectedLoadId={selectedLoadId} hoveredLoadId={hoveredLoadId} mapType={mapType} telemetryMarkers={telemetryMarkers} telemetryTrails={telemetryTrails} idleAssetMarkers={idleAssetMarkers} showAllTelemetryMarkers={kpiFilter === 'idle_drivers'} telemetryOnlyViewport={kpiFilter === 'moving'}/>
              {showIdleDriverMapNotice && (<div className="pointer-events-none absolute bottom-4 left-1/2 z-20 max-w-md -translate-x-1/2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-2 text-center text-xs font-semibold text-amber-700 backdrop-blur-sm transition-all duration-200 ease-in-out dark:text-amber-300">
                  Showing unassigned driver assets - map bounds reset
                </div>)}
              {popupVisible && selectedLoad && (<MapTruckPopup load={selectedLoad} truck={selectedTruck} etaRow={selectedEta} driverName={resolveDriverName(selectedLoad, trucks, drivers, selectedEta)} mapType={mapType} onToggleMapType={() => setMapType((prev) => (prev === 'roadmap' ? 'satellite' : 'roadmap'))} onClose={() => setPopupVisible(false)} onViewDetails={onViewLoadDetails}/>)}
            </div>
          </div>
        </div>

        <aside className="lg:col-span-1">
          <div className="flex h-[600px] flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm transition-colors dark:border-zinc-800 dark:bg-zinc-900/50">
            <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
              <div className="flex items-center gap-2">
                <Radio className="text-emerald-600 dark:text-emerald-400" size={16} aria-hidden="true"/>
                <h2 className="text-sm font-bold text-zinc-900 dark:text-zinc-50">
                  Active Loads ({displayFleetLoads.length})
                </h2>
              </div>
              <button type="button" onClick={() => setLoadsDrawerOpen(true)} className="text-xs font-semibold text-zinc-500 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200">
                View All
              </button>
            </div>

            <div className="flex min-h-0 flex-1 flex-col p-4">
              {displayFleetLoads.length === 0 ? (<div className="flex flex-1 items-center justify-center rounded-xl border border-dashed border-zinc-200 bg-zinc-50 p-6 text-center dark:border-zinc-800 dark:bg-zinc-900/40">
                  <p className="text-sm font-medium text-zinc-600 dark:text-zinc-400">
                    {kpiFilter === 'delayed'
                ? 'No delayed loads on the live board.'
                : kpiFilter === 'active'
                    ? 'No in-transit loads on the live board.'
                    : kpiFilter === 'moving'
                        ? 'No moving units on the live board.'
                        : kpiFilter === 'idle_drivers'
                            ? 'No loads linked to idle drivers.'
                            : 'No active fleet loads with assigned units.'}
                  </p>
                </div>) : (<div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto pr-1">
                  {displayFleetLoads.map((load) => {
                const etaRow = etaByLoadId.get(load.id);
                const delayed = isLoadDelayed(load, etaRow);
                const mileage = computeMileageProgress(load, etaRow);
                return (<ActiveLoadCard key={load.id} load={load} etaRow={etaRow} driverName={resolveDriverName(load, trucks, drivers, etaRow)} route={formatLoadRoute(load)} progress={mileage.percent} traveledMiles={mileage.traveled} totalMiles={mileage.total} etaLabel={formatEtaLabel(load, etaRow)} statusLabel={getUiStatusLabel(load, etaRow)} delayed={delayed} selected={load.id === selectedLoadId} onSelect={() => focusLoadOnMap(load.id)} onMouseEnter={() => setHoveredLoadId(load.id)} onMouseLeave={() => setHoveredLoadId(null)}/>);
            })}
                </div>)}
            </div>
          </div>
        </aside>
      </section>

      <LiveOperationsBottomTier loads={bottomTierLoads} allLoads={allLoads} trucks={trucks} drivers={drivers} etaBoard={etaBoard} filterIdleDriversOnly={kpiFilter === 'idle_drivers'} onViewAllEvents={() => setEventsDrawerOpen(true)}/>

      <RevenueTodayOverlay open={revenueOverlayOpen} onClose={() => setRevenueOverlayOpen(false)} totalRevenue={revenueToday} allLoads={allLoads}/>

      <ProfileDrawerShell open={eventsDrawerOpen} onClose={() => setEventsDrawerOpen(false)}>
        <div className="flex h-full min-h-0 flex-col">
          <div className="flex items-center justify-between border-b border-zinc-200 px-6 py-4 dark:border-zinc-800">
            <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-50">Recent Events</h2>
            <button type="button" onClick={() => setEventsDrawerOpen(false)} aria-label="Close events panel" className="rounded-md p-1 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200">
              <X size={18}/>
            </button>
          </div>
          <LiveOpsEventsPanel events={allRecentEvents}/>
        </div>
      </ProfileDrawerShell>

      <ProfileDrawerShell open={loadsDrawerOpen} onClose={() => setLoadsDrawerOpen(false)}>
        <div className="flex h-full min-h-0 flex-col">
          <div className="flex items-center justify-between border-b border-zinc-200 px-6 py-4 dark:border-zinc-800">
            <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-50">
              Active Loads ({fleetLoads.length})
            </h2>
            <button type="button" onClick={() => setLoadsDrawerOpen(false)} aria-label="Close loads panel" className="rounded-md p-1 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200">
              <X size={18}/>
            </button>
          </div>
          <LiveOpsLoadsPanel fleetLoads={fleetLoads} trucks={trucks} drivers={drivers} etaByLoadId={etaByLoadId} onSelectLoad={handleDrawerLoadSelect}/>
        </div>
      </ProfileDrawerShell>
    </div>);
}
export default memo(LiveOperationsDashboard);
