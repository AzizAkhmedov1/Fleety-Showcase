'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Activity, X } from 'lucide-react';
import toast from 'react-hot-toast';
import type { DriverRecord, EtaBoardRow, LoadRecord, TruckRecord } from '@/lib/tms-api';
import { createApiClient, formatApiError, readPersistedTmsToken } from '@/lib/api-client';
import { createTmsApi } from '@/lib/tms-api';
import { buildDriverHosBreakdown, buildOperationsAlerts, buildRecentEvents, EVENT_TONE_CLASSES, formatRelativeTime, getIdleDrivers, type DriverHosBreakdown, type LiveOpsAlert, } from '@/lib/live-operations-utils';
interface LiveOperationsBottomTierProps {
    loads: LoadRecord[];
    allLoads: LoadRecord[];
    trucks: TruckRecord[];
    drivers: DriverRecord[];
    etaBoard: EtaBoardRow[];
    filterIdleDriversOnly?: boolean;
    onViewAllEvents?: () => void;
}
const HOS_SEGMENTS: Array<{
    key: keyof DriverHosBreakdown;
    label: string;
    color: string;
    textClass: string;
}> = [
    { key: 'driving', label: 'Driving', color: '#22c55e', textClass: 'text-green-600 dark:text-green-400' },
    { key: 'on_duty', label: 'On Duty', color: '#10b981', textClass: 'text-emerald-600 dark:text-emerald-400' },
    { key: 'idle', label: 'Idle', color: '#f59e0b', textClass: 'text-amber-600 dark:text-amber-400' },
    { key: 'off_duty', label: 'Off Duty', color: '#a1a1aa', textClass: 'text-zinc-500 dark:text-zinc-400' },
];
const BOTTOM_PANEL_BODY = 'flex min-h-[13rem] max-h-[13rem] flex-col overflow-hidden transition-all duration-200 ease-in-out';
const BOTTOM_PANEL_SHELL = 'rounded-xl border border-zinc-200 bg-white p-3 transition-all duration-200 ease-in-out dark:border-zinc-800 dark:bg-zinc-900/50';
function DriverHosDonut({ breakdown }: {
    breakdown: DriverHosBreakdown;
}) {
    const total = breakdown.driving + breakdown.on_duty + breakdown.idle + breakdown.off_duty || 1;
    const radius = 53;
    const strokeWidth = 14;
    const circumference = 2 * Math.PI * radius;
    let offset = 0;
    return (<div className={`${BOTTOM_PANEL_BODY} items-center justify-center`}>
      <div className="flex w-full items-center gap-3">
      <div className="relative aspect-square h-36 w-36 shrink-0">
      <svg viewBox="0 0 120 120" className="h-full w-full" aria-label="Driver status breakdown">
        <g transform="rotate(-90 60 60)">
          {HOS_SEGMENTS.map((segment) => {
            const count = breakdown[segment.key];
            if (count <= 0)
                return null;
            const dash = (count / total) * circumference;
            const circle = (<circle key={segment.key} cx="60" cy="60" r={radius} fill="transparent" stroke={segment.color} strokeWidth={strokeWidth} strokeDasharray={`${dash} ${circumference - dash}`} strokeDashoffset={-offset} strokeLinecap="round"/>);
            offset += dash;
            return circle;
        })}
        </g>
        <text x="60" y="58" textAnchor="middle" dominantBaseline="middle" fontSize="20" fontWeight="700" className="fill-zinc-900 dark:fill-zinc-50">
          {total}
        </text>
        <text x="60" y="74" textAnchor="middle" dominantBaseline="middle" fontSize="11" fontWeight="600" className="fill-zinc-500 dark:fill-zinc-400">
          Drivers
        </text>
      </svg>
      </div>

      <div className="min-w-0 flex-1 space-y-1.5">
        {HOS_SEGMENTS.map((segment) => {
            const count = breakdown[segment.key];
            const percent = Math.round((count / total) * 100);
            return (<div key={segment.key} className="flex items-center justify-between gap-3 text-xs">
              <div className="flex min-w-0 items-center gap-2">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: segment.color }} aria-hidden="true"/>
                <span className={`font-semibold ${segment.textClass}`}>{segment.label}</span>
              </div>
              <span className="shrink-0 font-bold text-zinc-900 dark:text-zinc-50">
                {count}{' '}
                <span className="font-medium text-zinc-500 dark:text-zinc-400">({percent}%)</span>
              </span>
            </div>);
        })}
      </div>
      </div>
    </div>);
}
export default function LiveOperationsBottomTier({ loads, allLoads, trucks, drivers, etaBoard, filterIdleDriversOnly = false, onViewAllEvents, }: LiveOperationsBottomTierProps) {
    const [, setRelativeTimeTick] = useState(0);
    const [dismissedAlertIds, setDismissedAlertIds] = useState<Set<string>>(new Set());
    const [dismissingAlertId, setDismissingAlertId] = useState<string | null>(null);
    const client = useMemo(() => createTmsApi(createApiClient(readPersistedTmsToken())), []);
    const refreshDismissedAlerts = useCallback(async () => {
        try {
            const alertIds = await client.alerts.listDismissed();
            setDismissedAlertIds(new Set(alertIds));
        }
        catch {
            setDismissedAlertIds(new Set());
        }
    }, [client]);
    useEffect(() => {
        void refreshDismissedAlerts();
    }, [refreshDismissedAlerts]);
    useEffect(() => {
        const interval = window.setInterval(() => {
            setRelativeTimeTick((tick) => tick + 1);
        }, 60000);
        return () => window.clearInterval(interval);
    }, []);
    const derivedAlerts = useMemo(() => buildOperationsAlerts(loads, trucks, etaBoard, dismissedAlertIds), [loads, trucks, etaBoard, dismissedAlertIds]);
    const derivedAlertSignature = useMemo(() => derivedAlerts.map((alert) => alert.id).join('|'), [derivedAlerts]);
    const [displayAlerts, setDisplayAlerts] = useState<LiveOpsAlert[]>(derivedAlerts);
    useEffect(() => {
        setDisplayAlerts((current) => {
            const currentSignature = current.map((alert) => alert.id).join('|');
            if (currentSignature === derivedAlertSignature)
                return current;
            return derivedAlerts;
        });
    }, [derivedAlerts, derivedAlertSignature]);
    const handleDismissAlert = useCallback(async (alertId: string) => {
        const alertsSnapshot: LiveOpsAlert[] = displayAlerts;
        const dismissedSnapshot = new Set(dismissedAlertIds);
        setDisplayAlerts(alertsSnapshot.filter((alert) => alert.id !== alertId));
        setDismissedAlertIds((previous) => {
            const next = new Set(previous);
            next.add(alertId);
            return next;
        });
        setDismissingAlertId(alertId);
        try {
            await client.alerts.dismiss(alertId);
        }
        catch (error: unknown) {
            setDisplayAlerts(alertsSnapshot);
            setDismissedAlertIds(dismissedSnapshot);
            toast.error(formatApiError(error, 'Failed to dismiss alert'));
        }
        finally {
            setDismissingAlertId(null);
        }
    }, [client, displayAlerts, dismissedAlertIds]);
    const recentEvents = useMemo(() => buildRecentEvents(loads, allLoads, etaBoard), [loads, allLoads, etaBoard]);
    const hosBreakdown = useMemo(() => buildDriverHosBreakdown(drivers, loads, trucks), [drivers, loads, trucks]);
    const idleDriverRows = useMemo(() => getIdleDrivers(loads, trucks, drivers), [loads, trucks, drivers]);
    const criticalCount = useMemo(() => displayAlerts.filter((alert) => alert.priority === 'high').length, [displayAlerts]);
    return (<div className="mt-4 grid grid-cols-1 gap-4 transition-all duration-200 ease-in-out lg:grid-cols-3">
      <section className={BOTTOM_PANEL_SHELL}>
        <div className="mb-2 flex items-center justify-between gap-3">
          <h2 className="text-sm font-bold text-zinc-900 dark:text-zinc-50">Recent Events</h2>
          <button type="button" onClick={onViewAllEvents} className="text-xs font-semibold text-zinc-500 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200">
            View All
          </button>
        </div>

        {recentEvents.length === 0 ? (<div className={`${BOTTOM_PANEL_BODY} items-center justify-center rounded-xl border border-dashed border-zinc-200 bg-zinc-50 px-3 py-4 text-center dark:border-zinc-800 dark:bg-zinc-900/40`}>
            <Activity className="h-6 w-6 text-zinc-600" aria-hidden="true"/>
            <p className="mt-2 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              No Active Telemetry Streams
            </p>
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              Connect a live Samsara hardware integration to display real-time fleet event logs.
            </p>
          </div>) : (<ul className={`${BOTTOM_PANEL_BODY} space-y-3 overflow-y-auto pr-1`}>
            {recentEvents.map((event) => (<li key={event.id} className="relative pl-5">
                <span className={`absolute left-0 top-1.5 h-2.5 w-2.5 rounded-full ${EVENT_TONE_CLASSES[event.tone]}`} aria-hidden="true"/>
                <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{event.message}</p>
                <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                  {formatRelativeTime(event.timestampIso)}
                </p>
              </li>))}
          </ul>)}
      </section>

      <section className={BOTTOM_PANEL_SHELL}>
        <div className="mb-2 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-bold text-zinc-900 dark:text-zinc-50">Alerts</h2>
            <span className="rounded-full border border-zinc-200 bg-zinc-100 px-2 py-0.5 text-[10px] font-bold text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
              {displayAlerts.length}
            </span>
          </div>
          {criticalCount > 0 && (<span className="rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-400">
              {criticalCount} Critical
            </span>)}
        </div>

        {displayAlerts.length === 0 ? (<div className={`${BOTTOM_PANEL_BODY} items-center justify-center rounded-xl border border-dashed border-zinc-200 bg-zinc-50 px-3 py-4 text-center dark:border-zinc-800 dark:bg-zinc-900/40`}>
            <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
              No active operational alerts
            </p>
          </div>) : (<ul className={`${BOTTOM_PANEL_BODY} space-y-2 overflow-y-auto pr-1`}>
            {displayAlerts.map((alert) => {
                const isHigh = alert.priority === 'high';
                const isDismissing = dismissingAlertId === alert.id;
                return (<li key={alert.id} className={`relative rounded-lg border px-3 py-2.5 pr-10 ${isHigh
                        ? 'border-red-200 bg-red-50 dark:border-red-500/30 dark:bg-red-500/10'
                        : 'border-amber-200 bg-amber-50 dark:border-amber-500/30 dark:bg-amber-500/10'}`}>
                  <button type="button" onClick={() => void handleDismissAlert(alert.id)} disabled={isDismissing} aria-label={`Dismiss alert: ${alert.message}`} className="absolute right-2 top-2 rounded-md p-1 text-zinc-500 transition-colors hover:bg-black/5 hover:text-zinc-900 disabled:cursor-not-allowed disabled:opacity-50 dark:text-zinc-400 dark:hover:bg-white/10 dark:hover:text-zinc-100">
                    <X size={14} aria-hidden="true"/>
                  </button>
                  <p className={`text-sm font-semibold ${isHigh
                        ? 'text-red-700 dark:text-red-400'
                        : 'text-amber-700 dark:text-amber-400'}`}>
                    {alert.message}
                  </p>
                  <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">{alert.detail}</p>
                </li>);
            })}
          </ul>)}
      </section>

      <section className={BOTTOM_PANEL_SHELL}>
        <div className="mb-2 flex items-center justify-between gap-3">
          <h2 className="text-sm font-bold text-zinc-900 dark:text-zinc-50">Driver Status</h2>
          <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
            {drivers.length} total
          </span>
        </div>

        {drivers.length === 0 ? (<p className={`${BOTTOM_PANEL_BODY} text-sm text-zinc-500 dark:text-zinc-400`}>
            No drivers registered in fleet.
          </p>) : filterIdleDriversOnly ? (idleDriverRows.length === 0 ? (<p className={`${BOTTOM_PANEL_BODY} text-sm text-zinc-500 dark:text-zinc-400`}>
              All drivers are currently assigned.
            </p>) : (<ul className={`${BOTTOM_PANEL_BODY} space-y-2 overflow-y-auto pr-1`}>
              {idleDriverRows.map((driver) => (<li key={driver.id} className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 dark:border-amber-500/30 dark:bg-amber-500/10">
                  <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                    {driver.driver_name || `Driver #${driver.id}`}
                  </p>
                  <p className="mt-0.5 text-xs text-amber-700 dark:text-amber-400">Idle · awaiting assignment</p>
                </li>))}
            </ul>)) : (<DriverHosDonut breakdown={hosBreakdown}/>)}
      </section>
    </div>);
}
