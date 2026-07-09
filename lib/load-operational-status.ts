import type { LoadRecord } from '@/lib/tms-api';
export const SETTLED_UI_STATUS = 'SETTLED';
export const FINALIZED_RECORD_TOAST = 'Cannot modify finalized financial records';
export const SETTLED_STATUS_BADGE_CLASS = 'bg-zinc-200/80 dark:bg-zinc-800/60 text-zinc-600 dark:text-zinc-400 border-zinc-300 dark:border-zinc-600';
export function normalizeOperationalLoadStatus(status?: string | null) {
    const raw = (status || 'created').trim().toUpperCase().replace(/[\s-]+/g, '_');
    if (raw === 'INTRANSIT')
        return 'IN_TRANSIT';
    return raw;
}
export function isLoadFinanciallyFinalized(load: Pick<LoadRecord, 'status' | 'payment_status'>): boolean {
    if (normalizeOperationalLoadStatus(load.status) === 'SETTLED')
        return true;
    const payment = (load.payment_status || '').trim();
    return payment === 'Settled' || payment === 'Factoring Pending';
}
export function resolveLoadDisplayUiStatus(load: Pick<LoadRecord, 'status' | 'payment_status'>): string {
    if (isLoadFinanciallyFinalized(load))
        return SETTLED_UI_STATUS;
    const normalized = normalizeOperationalLoadStatus(load.status);
    if (normalized === 'CREATED' || normalized === 'STAGED' || normalized === 'AVAILABLE') {
        return 'UNASSIGNED';
    }
    if (normalized === 'BOOKED')
        return 'BOOKED';
    if (normalized === 'DISPATCHED')
        return 'IN_TRANSIT';
    if (normalized === 'SETTLED')
        return SETTLED_UI_STATUS;
    return normalized;
}
export function resolveLoadStatusBadgeClass(load: Pick<LoadRecord, 'status' | 'payment_status'>, operationalBadgeClass: (status?: string | null) => string): string {
    if (isLoadFinanciallyFinalized(load))
        return SETTLED_STATUS_BADGE_CLASS;
    return operationalBadgeClass(load.status);
}
