export type PlanningDayDutyStatus = 'layover' | 'off_duty' | 'maintenance' | 'external_dispatch';
export const PLANNING_DAY_DUTY_STATUSES: PlanningDayDutyStatus[] = [
    'layover',
    'off_duty',
    'maintenance',
    'external_dispatch',
];
export interface PlanningDayDutyOption {
    value: PlanningDayDutyStatus;
    label: string;
    shortLabel: string;
    cellBar: string;
    panelClass: string;
}
export const PLANNING_DAY_DUTY_OPTIONS: PlanningDayDutyOption[] = [
    {
        value: 'layover',
        label: 'Waiting',
        shortLabel: 'Waiting',
        cellBar: 'bg-amber-500/15 dark:bg-amber-500/25 text-amber-800 dark:text-amber-300 border border-amber-500/25 dark:border-amber-500/35 font-medium',
        panelClass: 'border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/15 dark:bg-amber-500/15 dark:hover:bg-amber-500/20',
    },
    {
        value: 'off_duty',
        label: 'Off Duty',
        shortLabel: 'Off Duty',
        cellBar: 'bg-zinc-200/80 dark:bg-zinc-800/80 text-zinc-700 dark:text-zinc-300 border border-zinc-300/80 dark:border-zinc-700 font-medium',
        panelClass: 'border-zinc-300 dark:border-zinc-700 bg-zinc-100 hover:bg-zinc-200/80 dark:bg-zinc-900/50 dark:hover:bg-zinc-800/60',
    },
    {
        value: 'maintenance',
        label: 'Maintenance',
        shortLabel: 'Maintenance',
        cellBar: 'bg-rose-500/15 dark:bg-rose-500/25 text-rose-800 dark:text-rose-300 border border-rose-500/25 dark:border-rose-500/35 font-medium',
        panelClass: 'border-rose-500/30 bg-rose-500/10 hover:bg-rose-500/15 dark:bg-rose-500/15 dark:hover:bg-rose-500/20',
    },
    {
        value: 'external_dispatch',
        label: 'Dispatched',
        shortLabel: 'Dispatched',
        cellBar: 'bg-indigo-500/15 dark:bg-indigo-500/25 text-indigo-800 dark:text-indigo-300 border border-indigo-500/25 dark:border-indigo-500/35 font-medium',
        panelClass: 'border-indigo-500/30 bg-indigo-500/10 hover:bg-indigo-500/15 dark:bg-indigo-500/15 dark:hover:bg-indigo-500/20',
    },
];
const OPTION_MAP = Object.fromEntries(PLANNING_DAY_DUTY_OPTIONS.map((option) => [option.value, option])) as Record<PlanningDayDutyStatus, PlanningDayDutyOption>;
export function isPlanningDayDutyStatus(value: string): value is PlanningDayDutyStatus {
    return PLANNING_DAY_DUTY_STATUSES.includes(value as PlanningDayDutyStatus);
}
export function getPlanningDayDutyOption(status?: string | null): PlanningDayDutyOption | null {
    if (!status || !isPlanningDayDutyStatus(status))
        return null;
    return OPTION_MAP[status];
}
