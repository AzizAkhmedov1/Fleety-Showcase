export const TRUCK_STATUS_OPTIONS = ['AVAILABLE', 'LOADED', 'MAINTENANCE', 'OUT OF SERVICE'] as const;
export type TruckStatusOption = (typeof TRUCK_STATUS_OPTIONS)[number];
export const TRUCK_STATUS_STYLES: Record<TruckStatusOption, string> = {
    AVAILABLE: 'bg-zinc-100 dark:bg-zinc-800/50 text-zinc-700 dark:text-zinc-400 border-zinc-300 dark:border-zinc-700/60',
    LOADED: 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20',
    MAINTENANCE: 'bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-500/20',
    'OUT OF SERVICE': 'bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-500/20',
};
export const normalizeTruckStatus = (status?: string | null): TruckStatusOption => {
    const raw = (status || '').trim().toLowerCase().replace(/_/g, ' ');
    if (raw === 'waiting' || raw === 'available')
        return 'AVAILABLE';
    if (raw === 'loaded' || raw === 'dispatched')
        return 'LOADED';
    if (raw === 'maintenance')
        return 'MAINTENANCE';
    if (raw === 'out of service')
        return 'OUT OF SERVICE';
    if (TRUCK_STATUS_OPTIONS.includes(status as TruckStatusOption)) {
        return status as TruckStatusOption;
    }
    return 'AVAILABLE';
};
