export type ExpirationUrgency = 'critical' | 'warning' | 'ok' | 'unknown';
export interface ExpirationDisplay {
    urgency: ExpirationUrgency;
    daysRemaining: number | null;
    formattedDate: string | null;
    textClass: string;
    badgeClass: string;
}
const URGENCY_CLASSES: Record<Exclude<ExpirationUrgency, 'unknown'>, {
    textClass: string;
    badgeClass: string;
}> = {
    critical: {
        textClass: 'text-red-500',
        badgeClass: 'bg-red-500/10 text-red-500',
    },
    warning: {
        textClass: 'text-amber-500',
        badgeClass: 'bg-amber-500/10 text-amber-500',
    },
    ok: {
        textClass: 'text-emerald-500',
        badgeClass: 'bg-emerald-500/10 text-emerald-500',
    },
};
const NEUTRAL_CLASSES = {
    textClass: 'text-zinc-500 dark:text-zinc-400',
    badgeClass: 'bg-zinc-500/10 text-zinc-500 dark:text-zinc-400',
};
export function parseExpirationDate(value?: string | Date | null): Date | null {
    if (value == null)
        return null;
    if (value instanceof Date) {
        return Number.isNaN(value.getTime()) ? null : value;
    }
    const trimmed = value.trim();
    if (!trimmed)
        return null;
    const usMatch = trimmed.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
    if (usMatch) {
        const [, month, day, year] = usMatch;
        const parsed = new Date(Number(year), Number(month) - 1, Number(day));
        return Number.isNaN(parsed.getTime()) ? null : parsed;
    }
    const parsed = new Date(trimmed);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
}
export function daysUntilExpiration(expirationDate: Date, referenceDate: Date = new Date()): number {
    const exp = new Date(expirationDate);
    exp.setHours(0, 0, 0, 0);
    const ref = new Date(referenceDate);
    ref.setHours(0, 0, 0, 0);
    const msPerDay = 24 * 60 * 60 * 1000;
    return Math.round((exp.getTime() - ref.getTime()) / msPerDay);
}
export function getExpirationUrgency(daysRemaining: number): ExpirationUrgency {
    if (daysRemaining <= 30)
        return 'critical';
    if (daysRemaining <= 90)
        return 'warning';
    return 'ok';
}
export function getExpirationUrgencyClasses(urgency: ExpirationUrgency): {
    textClass: string;
    badgeClass: string;
} {
    if (urgency === 'unknown')
        return NEUTRAL_CLASSES;
    return URGENCY_CLASSES[urgency];
}
export function formatExpirationDate(value?: string | Date | null): string | null {
    const parsed = parseExpirationDate(value);
    if (!parsed) {
        if (typeof value === 'string' && value.trim())
            return value.trim();
        return null;
    }
    return parsed.toLocaleDateString('en-US', {
        month: '2-digit',
        day: '2-digit',
        year: 'numeric',
    });
}
export function getExpirationDisplay(value?: string | Date | null, referenceDate?: Date): ExpirationDisplay {
    const parsed = parseExpirationDate(value);
    const formattedDate = formatExpirationDate(parsed ?? value);
    if (!parsed) {
        return {
            urgency: 'unknown',
            daysRemaining: null,
            formattedDate,
            ...NEUTRAL_CLASSES,
        };
    }
    const daysRemaining = daysUntilExpiration(parsed, referenceDate);
    const urgency = getExpirationUrgency(daysRemaining);
    const classes = getExpirationUrgencyClasses(urgency);
    return {
        urgency,
        daysRemaining,
        formattedDate,
        ...classes,
    };
}
export function isExpirationFieldLabel(label: string): boolean {
    const normalized = label.trim().toLowerCase();
    return (normalized.includes('expir') ||
        normalized.includes('registration') ||
        normalized.includes(' reg ') ||
        normalized.endsWith(' reg'));
}
