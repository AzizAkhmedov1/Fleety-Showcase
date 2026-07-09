export function formatTitleCaseLabel(value: string): string {
    return value
        .replace(/_/g, ' ')
        .trim()
        .split(/\s+/)
        .filter(Boolean)
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ');
}
export function paymentStatusLabel(status?: string | null): string {
    if (!status || !status.trim())
        return 'Unsettled';
    return formatTitleCaseLabel(status);
}
export const SECTION_LABEL_CLASS = 'text-[10px] font-bold tracking-widest text-zinc-400 dark:text-zinc-500 mb-2';
export const CARD_SECTION_LABEL_CLASS = 'text-[10px] font-bold tracking-widest text-zinc-400 dark:text-zinc-500 mb-3';
export const FORM_LABEL_CLASS = 'text-xs font-bold text-zinc-500 dark:text-zinc-400 mb-1 block';
export const PANEL_TITLE_CLASS = 'text-sm font-bold tracking-wide text-zinc-500 dark:text-zinc-400 mb-4 flex items-center gap-2';
