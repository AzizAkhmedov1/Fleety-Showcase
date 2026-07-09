export const LOAD_UI_STATUSES = [
    'UNASSIGNED',
    'BOOKED',
    'ASSIGNED',
    'IN_TRANSIT',
    'DELIVERED',
    'DELAYED',
    'SETTLED',
] as const;
export type LoadUiStatus = (typeof LOAD_UI_STATUSES)[number];
export const LOAD_INITIAL_STATUSES = ['UNASSIGNED', 'BOOKED'] as const;
export type LoadInitialStatus = (typeof LOAD_INITIAL_STATUSES)[number];
export const UNASSIGNED_STATUS_BADGE_CLASS = 'bg-slate-100 dark:bg-slate-800/50 text-slate-600 dark:text-slate-300 border-slate-300 dark:border-slate-600';
