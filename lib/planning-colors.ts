export type PlanningColorKey = 'sky' | 'emerald' | 'amber' | 'indigo' | 'purple' | 'rose';
export const PLANNING_COLOR_KEYS: PlanningColorKey[] = [
    'sky',
    'emerald',
    'amber',
    'indigo',
    'purple',
    'rose',
];
export interface PlanningColorTokens {
    leftAccent: string;
    rowText: string;
    loadBlock: string;
}
export const PLANNING_COLOR_TOKENS: Record<PlanningColorKey, PlanningColorTokens> = {
    sky: {
        leftAccent: 'border-l-sky-500',
        rowText: 'text-zinc-900 dark:text-zinc-100',
        loadBlock: 'bg-sky-500/10 dark:bg-sky-500/20 text-sky-700 dark:text-sky-400 border border-sky-500/20 dark:border-sky-500/30 font-medium',
    },
    emerald: {
        leftAccent: 'border-l-emerald-500',
        rowText: 'text-zinc-900 dark:text-zinc-100',
        loadBlock: 'bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 dark:border-emerald-500/30 font-medium',
    },
    amber: {
        leftAccent: 'border-l-amber-500',
        rowText: 'text-zinc-900 dark:text-zinc-100',
        loadBlock: 'bg-amber-500/10 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400 border border-amber-500/20 dark:border-amber-500/30 font-medium',
    },
    indigo: {
        leftAccent: 'border-l-indigo-500',
        rowText: 'text-zinc-900 dark:text-zinc-100',
        loadBlock: 'bg-indigo-500/10 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-400 border border-indigo-500/20 dark:border-indigo-500/30 font-medium',
    },
    purple: {
        leftAccent: 'border-l-purple-500',
        rowText: 'text-zinc-900 dark:text-zinc-100',
        loadBlock: 'bg-purple-500/10 dark:bg-purple-500/20 text-purple-700 dark:text-purple-400 border border-purple-500/20 dark:border-purple-500/30 font-medium',
    },
    rose: {
        leftAccent: 'border-l-rose-500',
        rowText: 'text-zinc-900 dark:text-zinc-100',
        loadBlock: 'bg-rose-500/10 dark:bg-rose-500/20 text-rose-700 dark:text-rose-400 border border-rose-500/20 dark:border-rose-500/30 font-medium',
    },
};
export function resolvePlanningColor(key?: string | null): PlanningColorKey {
    const normalized = (key || 'sky').toLowerCase() as PlanningColorKey;
    return PLANNING_COLOR_KEYS.includes(normalized) ? normalized : 'sky';
}
export const PLANNING_NO_ACCENT_BORDER = 'border-l-0 border-transparent dark:border-[#161616]';
export function getPlanningAccentBorderClass(planningColor?: string | null): string {
    if (!planningColor?.trim()) {
        return PLANNING_NO_ACCENT_BORDER;
    }
    const colorKey = resolvePlanningColor(planningColor);
    return `border-l-4 ${PLANNING_COLOR_TOKENS[colorKey].leftAccent}`;
}
