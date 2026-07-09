import type { PlanningScheduleLoad } from '@/lib/planning-timeline';
export interface PlanningDayStatusEntry {
    id?: string;
    date?: string;
    status: string;
    location?: string | null;
    description?: string | null;
    rc_url?: string | null;
    rc_file_name?: string | null;
}
export function resolvePlanningDutyDateKey(storageKey: string, entry: PlanningDayStatusEntry): string | null {
    const fromEntry = entry.date?.split('::')[0]?.trim() ?? '';
    if (/^\d{4}-\d{2}-\d{2}$/.test(fromEntry))
        return fromEntry;
    const fromKey = storageKey.split('::')[0]?.trim() ?? '';
    if (/^\d{4}-\d{2}-\d{2}$/.test(fromKey))
        return fromKey;
    return null;
}
export type LoadDaySegmentKind = 'pickup' | 'delivery' | 'transit';
export interface LoadDaySegment {
    kind: LoadDaySegmentKind;
    loadId: number;
    loadLabel: string;
    segmentLabel: string;
    routeLabel: string;
    metaLine: string | null;
}
function toPlanningDateKey(value: string | null | undefined): string | null {
    if (!value)
        return null;
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime()))
        return null;
    const year = parsed.getFullYear();
    const month = String(parsed.getMonth() + 1).padStart(2, '0');
    const day = String(parsed.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}
export function compactPlanningLocation(value: string | null | undefined): string {
    if (!value)
        return '';
    const normalized = value
        .replace(/\s+/g, ' ')
        .replace(/\s*,\s*/g, ', ')
        .trim();
    if (!normalized)
        return '';
    const parts = normalized.split(',').map((part) => part.trim()).filter(Boolean);
    if (parts.length >= 2) {
        const city = parts[parts.length - 2];
        const region = parts[parts.length - 1];
        if (region.length <= 3) {
            return `${city}, ${region.toUpperCase()}`;
        }
        return `${city}, ${region}`;
    }
    return normalized;
}
const PLANNING_META_PLACEHOLDERS = new Set(['', 'no notes', 'n/a', 'na', 'none', '-', '—']);
export function sanitizePlanningMetaValue(value: string | null | undefined): string | null {
    if (!value)
        return null;
    const trimmed = value.trim();
    if (!trimmed)
        return null;
    if (PLANNING_META_PLACEHOLDERS.has(trimmed.toLowerCase()))
        return null;
    return trimmed;
}
export function isPlanningWhoStructuralPlaceholder(value: string | null | undefined, context?: {
    location?: string | null;
    rowDriverName?: string | null;
    eventTitle?: string | null;
}): boolean {
    const trimmed = (value ?? '').trim();
    if (!trimmed)
        return true;
    const normalized = trimmed.toLowerCase().replace(/\s+/g, ' ');
    if (normalized === 'empty pa' || normalized.includes('empty'))
        return true;
    const normalize = (input: string) => input.trim().toLowerCase().replace(/\s+/g, ' ');
    if (context?.location && normalize(trimmed) === normalize(context.location))
        return true;
    if (context?.eventTitle && normalize(trimmed) === normalize(context.eventTitle))
        return true;
    if (context?.rowDriverName &&
        normalize(trimmed) === normalize(context.rowDriverName)) {
        return true;
    }
    return false;
}
export function sanitizePlanningWhoDisplayValue(value: string | null | undefined, context?: {
    location?: string | null;
    rowDriverName?: string | null;
    eventTitle?: string | null;
}): string {
    if (isPlanningWhoStructuralPlaceholder(value, context))
        return '';
    return (value ?? '').trim();
}
export function resolvePlanningCustomWhoCandidate(candidate: string | null | undefined, context?: {
    location?: string | null;
    rowDriverName?: string | null;
    eventTitle?: string | null;
}): string | null {
    const sanitized = sanitizePlanningWhoDisplayValue(candidate, context);
    return sanitized || null;
}
export function resolvePlanningCustomWhoHydration(candidate: string | null | undefined): string | null {
    const trimmed = (candidate ?? '').trim();
    if (!trimmed)
        return null;
    const normalized = trimmed.toLowerCase().replace(/\s+/g, ' ');
    if (normalized === 'empty pa' || normalized === 'empty')
        return null;
    return trimmed;
}
export function resolveStoredPlanningCustomWho(embedded: {
    who: string | null;
    title: string | null;
}, context?: {
    location?: string | null;
}): string | null {
    const fromWho = resolvePlanningCustomWhoHydration(embedded.who);
    if (fromWho)
        return fromWho;
    const titlePart = embedded.title?.trim() ?? '';
    if (!titlePart)
        return null;
    const normalize = (value: string) => value.trim().toLowerCase().replace(/\s+/g, ' ');
    const location = context?.location?.trim();
    if (location && normalize(titlePart) === normalize(location))
        return null;
    return resolvePlanningCustomWhoHydration(titlePart);
}
export function timelinePlanningLocation(value: string | null | undefined): string {
    const compact = compactPlanningLocation(value);
    if (compact.includes(','))
        return compact;
    const normalized = (value || '').replace(/\s+/g, ' ').trim();
    if (!normalized)
        return '';
    const tokens = normalized.split(' ');
    if (tokens.length >= 2) {
        const last = tokens[tokens.length - 1];
        if (/^[A-Za-z]{2}$/.test(last)) {
            const city = tokens[tokens.length - 2];
            return `${city}, ${last.toUpperCase()}`;
        }
    }
    return compact || normalized;
}
export function formatPlanningRouteLabel(origin: string | null | undefined, destination: string | null | undefined): string {
    const from = compactPlanningLocation(origin);
    const to = compactPlanningLocation(destination);
    if (from && to)
        return `${from} → ${to}`;
    return from || to || '';
}
export function parsePlanningDayStatusValue(value: string | PlanningDayStatusEntry | null | undefined): PlanningDayStatusEntry | null {
    if (!value)
        return null;
    if (typeof value === 'string') {
        const status = value.trim();
        return status ? { status } : null;
    }
    const status = String(value.status || '').trim();
    if (!status)
        return null;
    const id = typeof value.id === 'string' ? value.id.trim() : undefined;
    const date = typeof value.date === 'string' ? value.date.trim() : undefined;
    return {
        id: id || undefined,
        date: date || undefined,
        status,
        location: sanitizePlanningMetaValue(value.location),
        description: sanitizePlanningMetaValue(value.description),
        rc_url: sanitizePlanningMetaValue(value.rc_url),
        rc_file_name: sanitizePlanningMetaValue(value.rc_file_name),
    };
}
export function formatDutyStatusMetaLine(dutyLabel: string, entry: PlanningDayStatusEntry | null | undefined): {
    primary: string;
    secondary: string | null;
} {
    if (!entry) {
        return { primary: dutyLabel, secondary: null };
    }
    const description = sanitizePlanningMetaValue(entry.description);
    const locationRaw = sanitizePlanningMetaValue(entry.location);
    const timelineLocation = locationRaw ? timelinePlanningLocation(locationRaw) : null;
    if (description) {
        return {
            primary: `${dutyLabel} • ${description}`,
            secondary: timelineLocation,
        };
    }
    return {
        primary: dutyLabel,
        secondary: timelineLocation,
    };
}
export function resolveLoadDaySegment(load: PlanningScheduleLoad, dayKey: string, brokerLoadId?: string | number | null): LoadDaySegment {
    const pickupKey = toPlanningDateKey(load.pickup_date);
    const deliveryKey = toPlanningDateKey(load.delivery_date);
    const displayId = brokerLoadId ?? load.id;
    const loadLabel = `#${displayId}`;
    const routeLabel = formatPlanningRouteLabel(load.origin, load.destination);
    if (pickupKey === dayKey && deliveryKey === dayKey) {
        return {
            kind: 'pickup',
            loadId: load.id,
            loadLabel,
            segmentLabel: 'Pickup/Delivery',
            routeLabel,
            metaLine: routeLabel || null,
        };
    }
    if (pickupKey === dayKey) {
        return {
            kind: 'pickup',
            loadId: load.id,
            loadLabel,
            segmentLabel: 'Pickup',
            routeLabel: compactPlanningLocation(load.origin) || routeLabel,
            metaLine: compactPlanningLocation(load.destination) || null,
        };
    }
    if (deliveryKey === dayKey) {
        return {
            kind: 'delivery',
            loadId: load.id,
            loadLabel,
            segmentLabel: 'Delivery',
            routeLabel: compactPlanningLocation(load.destination) || routeLabel,
            metaLine: compactPlanningLocation(load.origin) || null,
        };
    }
    return {
        kind: 'transit',
        loadId: load.id,
        loadLabel,
        segmentLabel: 'In Transit',
        routeLabel,
        metaLine: null,
    };
}
export interface ColorThemeTokens {
    border: string;
    text: string;
    bg: string;
}
export type CalendarCategoryColorClasses = ColorThemeTokens;
export const GeneralizedColorMap: Record<string, ColorThemeTokens> = {
    purple: {
        border: 'border-l-purple-500 dark:border-l-purple-400',
        text: 'text-purple-950 dark:text-purple-400',
        bg: 'bg-purple-200 dark:bg-purple-950/30',
    },
    violet: {
        border: 'border-l-violet-500 dark:border-l-violet-400',
        text: 'text-violet-950 dark:text-violet-400',
        bg: 'bg-violet-200 dark:bg-violet-950/30',
    },
    emerald: {
        border: 'border-l-emerald-500 dark:border-l-emerald-500',
        text: 'text-emerald-700 dark:text-emerald-400',
        bg: 'bg-emerald-100/90 dark:bg-emerald-950/20',
    },
    green: {
        border: 'border-l-green-500 dark:border-l-green-400',
        text: 'text-green-700 dark:text-green-400',
        bg: 'bg-green-100/90 dark:bg-green-950/20',
    },
    amber: {
        border: 'border-l-amber-500 dark:border-l-amber-500',
        text: 'text-amber-700 dark:text-amber-400',
        bg: 'bg-amber-100/90 dark:bg-amber-950/20',
    },
    orange: {
        border: 'border-l-orange-500 dark:border-l-orange-400',
        text: 'text-orange-700 dark:text-orange-400',
        bg: 'bg-orange-100/90 dark:bg-orange-950/20',
    },
    blue: {
        border: 'border-l-blue-500 dark:border-l-blue-500',
        text: 'text-blue-700 dark:text-blue-400',
        bg: 'bg-blue-100/90 dark:bg-blue-950/20',
    },
    sky: {
        border: 'border-l-sky-500 dark:border-l-sky-400',
        text: 'text-sky-700 dark:text-sky-400',
        bg: 'bg-sky-100/90 dark:bg-sky-950/20',
    },
    red: {
        border: 'border-l-red-500 dark:border-l-red-400',
        text: 'text-red-700 dark:text-red-400',
        bg: 'bg-red-100/90 dark:bg-red-950/20',
    },
    rose: {
        border: 'border-l-rose-500 dark:border-l-rose-400',
        text: 'text-rose-950 dark:text-rose-400',
        bg: 'bg-rose-200 dark:bg-rose-950/20',
    },
    teal: {
        border: 'border-l-teal-500 dark:border-l-teal-400',
        text: 'text-teal-700 dark:text-teal-400',
        bg: 'bg-teal-100/90 dark:bg-teal-950/20',
    },
    pink: {
        border: 'border-l-pink-500 dark:border-l-pink-400',
        text: 'text-pink-950 dark:text-pink-400',
        bg: 'bg-pink-200 dark:bg-pink-950/20',
    },
    zinc: {
        border: 'border-l-zinc-400 dark:border-l-zinc-600',
        text: 'text-zinc-700 dark:text-zinc-400',
        bg: 'bg-zinc-100 dark:bg-zinc-900/50',
    },
};
const THEME_COLOR_KEYWORDS = [
    'purple',
    'violet',
    'emerald',
    'green',
    'amber',
    'orange',
    'blue',
    'sky',
    'teal',
    'pink',
    'rose',
    'red',
] as const;
const THEME_COLOR_KEYWORDS_BY_LENGTH = [...THEME_COLOR_KEYWORDS].sort((left, right) => right.length - left.length);
const CALENDAR_COLOR_TAG = /@color:([a-z]+)\|/i;
export function normalizeCalendarCategoryKey(value: string): string {
    return value.trim().toLowerCase().replace(/\s+/g, '_');
}
export function parseCalendarColorFromDescription(description: string | null | undefined): string | null {
    if (!description)
        return null;
    const match = description.match(CALENDAR_COLOR_TAG);
    if (!match)
        return null;
    const colorName = match[1].toLowerCase();
    if (colorName in GeneralizedColorMap)
        return colorName;
    if (colorName === 'indigo')
        return 'violet';
    if (colorName === 'yellow')
        return 'amber';
    if (colorName === 'slate' || colorName === 'gray' || colorName === 'grey')
        return 'zinc';
    return null;
}
export function injectCalendarColorIntoDutyDescription(description: string, colorName: string | null | undefined): string {
    const trimmedColor = colorName?.trim().toLowerCase();
    if (!trimmedColor)
        return description;
    const withoutExisting = description.replace(CALENDAR_COLOR_TAG, '');
    return withoutExisting.replace(/^(@status:[^|]+\|)/, `$1@color:${trimmedColor}|`);
}
function findThemeColorKeywordInString(value: string): keyof typeof GeneralizedColorMap | null {
    const query = value.toLowerCase();
    for (const keyword of THEME_COLOR_KEYWORDS_BY_LENGTH) {
        if (query.includes(keyword)) {
            return keyword;
        }
    }
    return null;
}
function resolveExplicitThemeColor(bgClass?: string | null, statusLabel?: string | null, explicitColor?: string | null): ColorThemeTokens | null {
    if (explicitColor?.trim()) {
        const normalized = explicitColor.trim().toLowerCase();
        if (normalized in GeneralizedColorMap) {
            return GeneralizedColorMap[normalized as keyof typeof GeneralizedColorMap];
        }
        const keyword = findThemeColorKeywordInString(normalized);
        if (keyword)
            return GeneralizedColorMap[keyword];
    }
    if (bgClass?.trim()) {
        const keyword = findThemeColorKeywordInString(bgClass);
        if (keyword)
            return GeneralizedColorMap[keyword];
    }
    const directLabel = statusLabel?.trim().toLowerCase();
    if (directLabel && directLabel in GeneralizedColorMap) {
        return GeneralizedColorMap[directLabel as keyof typeof GeneralizedColorMap];
    }
    return null;
}
function resolveSemanticThemeFromQuery(query: string): ColorThemeTokens | null {
    if (query.includes('not covered') || query.includes('not-covered')) {
        return GeneralizedColorMap.red;
    }
    if (query.includes('covered') || query.includes('delivery')) {
        return GeneralizedColorMap.emerald;
    }
    if (query.includes('maintenance') || query.includes('yellow')) {
        return GeneralizedColorMap.amber;
    }
    if (query.includes('empty')) {
        return GeneralizedColorMap.red;
    }
    if (query.includes('open')) {
        return GeneralizedColorMap.blue;
    }
    return null;
}
function resolveColorThemeFromQuery(query: string): ColorThemeTokens | null {
    const semantic = resolveSemanticThemeFromQuery(query);
    if (semantic)
        return semantic;
    for (const keyword of THEME_COLOR_KEYWORDS_BY_LENGTH) {
        if (query.includes(keyword)) {
            return GeneralizedColorMap[keyword];
        }
    }
    return null;
}
export function getCalendarColorClasses(categoryStatusId: string, bgClass?: string | null, statusLabel?: string | null, explicitColor?: string | null): ColorThemeTokens {
    const tier1 = resolveExplicitThemeColor(bgClass, statusLabel, explicitColor);
    if (tier1)
        return tier1;
    const tier2Query = `${statusLabel || ''}`.toLowerCase();
    const resolved = resolveColorThemeFromQuery(tier2Query);
    if (resolved)
        return resolved;
    return GeneralizedColorMap.zinc;
}
