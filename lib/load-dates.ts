import { LoadRecord } from '@/lib/tms-api';
export type LoadDateSource = LoadRecord & {
    origin_date?: string | null;
    destination_date?: string | null;
    stops?: Array<Record<string, unknown>>;
    detailed_stops?: Array<Record<string, unknown>>;
};
const US_DATE_TIME_PATTERN = /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:[,\s]+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?)?$/i;
const parseIsoDateTimeString = (value: string): Date | null => {
    const trimmed = value.trim();
    const match = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?)?/i);
    if (!match)
        return null;
    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    if (!year || !month || !day)
        return null;
    let hours = 0;
    let minutes = 0;
    if (match[4] != null && match[5] != null) {
        hours = Number(match[4]);
        minutes = Number(match[5]);
        const ampm = match[7]?.toUpperCase();
        if (ampm === 'PM' && hours < 12)
            hours += 12;
        if (ampm === 'AM' && hours === 12)
            hours = 0;
    }
    const parsed = new Date(year, month - 1, day, hours, minutes);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
};
const parseUsDateString = (value: string): Date | null => {
    const trimmed = value.trim();
    const match = trimmed.match(US_DATE_TIME_PATTERN);
    if (!match)
        return null;
    const month = Number(match[1]);
    const day = Number(match[2]);
    const year = Number(match[3]);
    if (!month || !day || !year)
        return null;
    let hours = 0;
    let minutes = 0;
    if (match[4] != null && match[5] != null) {
        hours = Number(match[4]);
        minutes = Number(match[5]);
        const ampm = match[7]?.toUpperCase();
        if (ampm === 'PM' && hours < 12)
            hours += 12;
        if (ampm === 'AM' && hours === 12)
            hours = 0;
    }
    const parsed = new Date(year, month - 1, day, hours, minutes);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
};
const parseDateOnlyIso = (value: string): Date | null => {
    const match = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match)
        return null;
    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const parsed = new Date(year, month - 1, day);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
};
export const coerceDateValue = (value: unknown): string | null => {
    if (value == null)
        return null;
    if (value instanceof Date) {
        return Number.isNaN(value.getTime()) ? null : value.toISOString();
    }
    if (typeof value === 'number' && Number.isFinite(value)) {
        const parsed = new Date(value);
        return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
    }
    if (typeof value === 'string') {
        const trimmed = value.trim();
        if (!trimmed)
            return null;
        const isoDateTimeParsed = parseIsoDateTimeString(trimmed);
        if (isoDateTimeParsed)
            return isoDateTimeParsed.toISOString();
        const usParsed = parseUsDateString(trimmed);
        if (usParsed)
            return usParsed.toISOString();
        const isoDateOnly = parseDateOnlyIso(trimmed);
        if (isoDateOnly)
            return isoDateOnly.toISOString();
        const nativeParsed = new Date(trimmed);
        if (!Number.isNaN(nativeParsed.getTime())) {
            return nativeParsed.toISOString();
        }
        return null;
    }
    if (typeof value === 'object') {
        const obj = value as Record<string, unknown>;
        if ('year' in obj && 'month' in obj && 'day' in obj) {
            const year = Number(obj.year);
            const month = Number(obj.month);
            const day = Number(obj.day);
            if (!Number.isNaN(year) && !Number.isNaN(month) && !Number.isNaN(day)) {
                const parsed = new Date(year, month - 1, day);
                return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
            }
        }
    }
    return null;
};
export const extractCleanDate = (inputVal: string | null | undefined): string | null => {
    if (!inputVal)
        return null;
    const trimmed = String(inputVal).trim();
    if (!trimmed)
        return null;
    const mdYMatch = trimmed.match(/^(\d{1,2}\/\d{1,2}\/\d{2,4})/);
    if (mdYMatch?.[1])
        return mdYMatch[1];
    const isoDateMatch = trimmed.match(/^(\d{4}-\d{2}-\d{2})/);
    if (isoDateMatch?.[1])
        return isoDateMatch[1];
    const firstPart = trimmed.split(/[- ]/)[0]?.trim();
    return firstPart || null;
};
const resolveStopsList = (load: LoadDateSource): Array<Record<string, unknown>> => {
    if (Array.isArray(load.stops) && load.stops.length > 0)
        return load.stops;
    if (Array.isArray(load.detailed_stops) && load.detailed_stops.length > 0) {
        return load.detailed_stops;
    }
    return [];
};
const extractStopDate = (stop: Record<string, unknown> | null | undefined): string | null => {
    if (!stop)
        return null;
    return coerceDateValue(stop.date ??
        stop.scheduled_date ??
        stop.date_time ??
        stop.pickup_time ??
        stop.delivery_time);
};
const isPickupStop = (stop: Record<string, unknown>) => {
    const stopType = String(stop.stop_type ?? stop.type ?? '').toLowerCase();
    return (stopType === 'pickup' ||
        stopType === 'origin' ||
        stop.index === 0 ||
        stop.stop_index === 0);
};
const isDeliveryStop = (stop: Record<string, unknown>) => {
    const stopType = String(stop.stop_type ?? stop.type ?? '').toLowerCase();
    return stopType === 'delivery' || stopType === 'destination';
};
export function getFallbackDate(load: LoadDateSource | null | undefined, type: 'pickup' | 'delivery'): string | null {
    if (!load)
        return null;
    const stopsList = resolveStopsList(load);
    if (type === 'pickup') {
        if (load.pickup_date)
            return coerceDateValue(load.pickup_date);
        if (load.origin_date)
            return coerceDateValue(load.origin_date);
        const pickupStop = stopsList.find(isPickupStop) ||
            stopsList[0];
        if (pickupStop) {
            return extractStopDate(pickupStop);
        }
    }
    else {
        if (load.delivery_date)
            return coerceDateValue(load.delivery_date);
        if (load.destination_date)
            return coerceDateValue(load.destination_date);
        const deliveryCandidates = stopsList.filter(isDeliveryStop);
        const deliveryStop = deliveryCandidates[deliveryCandidates.length - 1] ||
            stopsList[stopsList.length - 1];
        if (deliveryStop) {
            return extractStopDate(deliveryStop);
        }
    }
    return null;
}
export const formatLoadDateLabel = (value?: string | null) => {
    const normalized = coerceDateValue(value);
    if (!normalized)
        return null;
    const parsed = new Date(normalized);
    if (Number.isNaN(parsed.getTime()))
        return null;
    return parsed.toLocaleDateString('en-US', {
        month: '2-digit',
        day: '2-digit',
        year: 'numeric',
    });
};
export function normalizeToLocalDateKey(value?: string | null): string | null {
    if (!value?.trim())
        return null;
    const trimmed = value.trim();
    const usMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (usMatch) {
        const month = Number(usMatch[1]);
        const day = Number(usMatch[2]);
        const year = Number(usMatch[3]);
        if (!month || !day || !year)
            return null;
        return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
    const isoOnly = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (isoOnly) {
        return `${isoOnly[1]}-${isoOnly[2]}-${isoOnly[3]}`;
    }
    const normalized = coerceDateValue(trimmed);
    if (!normalized)
        return null;
    const isoFromCoerce = normalized.match(/^(\d{4}-\d{2}-\d{2})/);
    if (isoFromCoerce)
        return isoFromCoerce[1];
    const parsed = new Date(normalized);
    if (Number.isNaN(parsed.getTime()))
        return null;
    return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}-${String(parsed.getDate()).padStart(2, '0')}`;
}
export function toPaddedUsDateDisplay(value?: string | null): string | null {
    const key = normalizeToLocalDateKey(value);
    if (!key)
        return null;
    const [year, month, day] = key.split('-');
    return `${month}/${day}/${year}`;
}
export function dateToPaddedUsFilterString(date: Date): string {
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${month}/${day}/${date.getFullYear()}`;
}
export function parseUsFilterStringToDate(value?: string | null): Date | undefined {
    const key = normalizeToLocalDateKey(value);
    if (!key)
        return undefined;
    const [year, month, day] = key.split('-').map(Number);
    if (!year || !month || !day)
        return undefined;
    return new Date(year, month - 1, day);
}
export function matchesLoadDateHorizonFilters(pickupKey: string | null, deliveryKey: string | null, pickupFilter?: string | null, deliveryFilter?: string | null): boolean {
    const pickupHorizon = normalizeToLocalDateKey(pickupFilter);
    const deliveryCutoff = normalizeToLocalDateKey(deliveryFilter);
    const hasPickupFilter = Boolean(pickupHorizon);
    const hasDeliveryFilter = Boolean(deliveryCutoff);
    if (!hasPickupFilter && !hasDeliveryFilter) {
        return true;
    }
    if (hasPickupFilter && hasDeliveryFilter) {
        if (!pickupKey || !deliveryKey)
            return false;
        return pickupKey >= pickupHorizon! && deliveryKey <= deliveryCutoff!;
    }
    if (hasPickupFilter) {
        if (!pickupKey)
            return false;
        return pickupKey >= pickupHorizon!;
    }
    if (!deliveryKey)
        return false;
    return deliveryKey <= deliveryCutoff!;
}
export function resolveLoadPickupDateFilterKey(load: LoadDateSource): string | null {
    return normalizeToLocalDateKey(getFallbackDate(load, 'pickup') || load.created_at);
}
export function resolveLoadDeliveryDateFilterKey(load: LoadDateSource): string | null {
    return normalizeToLocalDateKey(getFallbackDate(load, 'delivery'));
}
export const formatLoadDateTimeParts = (value?: string | null) => {
    const normalized = coerceDateValue(value);
    if (!normalized)
        return { date: '—', time: '—' };
    const parsed = new Date(normalized);
    if (Number.isNaN(parsed.getTime()))
        return { date: '—', time: '—' };
    const rawString = typeof value === 'string' ? value.trim() : '';
    const usMatch = rawString ? rawString.match(US_DATE_TIME_PATTERN) : null;
    const hasExplicitTime = Boolean(usMatch?.[4]) ||
        (rawString.includes('T') && /T\d{1,2}:\d{2}/.test(rawString)) ||
        /^\d{4}-\d{2}-\d{2}[ T]\d{1,2}:\d{2}/.test(rawString) ||
        /\d{1,2}:\d{2}\s*(AM|PM)/i.test(rawString);
    return {
        date: parsed.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
        }),
        time: hasExplicitTime
            ? parsed.toLocaleTimeString('en-US', {
                hour: 'numeric',
                minute: '2-digit',
            })
            : '—',
    };
};
