import { extractCleanDate, formatLoadDateLabel, formatLoadDateTimeParts, getFallbackDate, type LoadDateSource, } from '@/lib/load-dates';
import { compileAppointmentWindowFromStop } from '@/lib/load-appointment-window';
export type ManifestStopRole = 'PICKUP' | 'DROP' | 'DELIVERY';
export interface ManifestStopView {
    sequence: number;
    role: ManifestStopRole;
    companyName: string;
    address: string;
    locationLine: string;
    dateLabel: string;
    timeLabel: string;
    windowLabel: string | null;
    scheduleLabel: string;
    dateTimeRaw: string;
    referenceLine: string | null;
    weightLine: string | null;
    appointmentLine: string | null;
    notes: string;
}
export interface LoadManifestSource {
    origin?: string | null;
    destination?: string | null;
    pickup_date?: string | null;
    delivery_date?: string | null;
    pickup_date_time?: string | null;
    delivery_date_time?: string | null;
    pickup_number?: string | null;
    pu_number?: string | null;
    delivery_number?: string | null;
    stops?: Array<Record<string, unknown>>;
    detailed_stops?: Array<Record<string, unknown>>;
}
const readString = (value: unknown) => String(value ?? '').trim();
const STREET_TOKENS = new Set([
    'AVE',
    'AVENUE',
    'AV',
    'ST',
    'STREET',
    'RD',
    'ROAD',
    'DR',
    'DRIVE',
    'BLVD',
    'BOULEVARD',
    'LN',
    'LANE',
    'WAY',
    'CT',
    'COURT',
    'PL',
    'PLACE',
    'HWY',
    'HIGHWAY',
    'PKWY',
    'PARKWAY',
    'STE',
    'SUITE',
    'UNIT',
    'APT',
    'APARTMENT',
    'BLDG',
    'BUILDING',
    'FWY',
    'FREEWAY',
    'EXPY',
    'EXPRESSWAY',
    'TRL',
    'TRAIL',
    'CIR',
    'CIRCLE',
    'LOOP',
]);
const DIRECTIONAL_TOKENS = new Set(['N', 'S', 'E', 'W', 'NE', 'NW', 'SE', 'SW']);
function titleCaseCity(value: string) {
    return value
        .toLowerCase()
        .split(/\s+/)
        .filter(Boolean)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' ');
}
function isStreetToken(token: string) {
    const normalized = token.replace(/[^\w]/g, '').toUpperCase();
    return STREET_TOKENS.has(normalized) || DIRECTIONAL_TOKENS.has(normalized);
}
export function parseLocationFromAddress(address?: string | null) {
    if (!address?.trim())
        return { city: '—', state: '' };
    const normalized = address.replace(/,/g, ' ').replace(/\s+/g, ' ').trim();
    const upperNormalized = normalized.toUpperCase();
    const stateZipMatch = upperNormalized.match(/\s+([A-Z]{2})(?:\s+(\d{5}(?:-\d{4})?))?\s*$/);
    if (stateZipMatch) {
        const state = stateZipMatch[1];
        const stateIndex = normalized.search(new RegExp(`\\s${state}(?:\\s\\d{5})?\\s*$`, 'i'));
        const beforeState = stateIndex >= 0 ? normalized.slice(0, stateIndex).trim() : normalized;
        const tokens = beforeState.split(/\s+/).filter(Boolean);
        const cityTokens: string[] = [];
        for (let index = tokens.length - 1; index >= 0; index -= 1) {
            const token = tokens[index];
            const stripped = token.replace(/[^\w.'-]/g, '');
            if (!stripped || /^\d/.test(stripped) || isStreetToken(stripped.toUpperCase())) {
                break;
            }
            cityTokens.unshift(stripped);
            if (cityTokens.length >= 4)
                break;
        }
        if (cityTokens.length > 0) {
            return {
                city: titleCaseCity(cityTokens.join(' ')),
                state,
            };
        }
    }
    const commaParts = address.split(',').map((part) => part.trim()).filter(Boolean);
    if (commaParts.length >= 2) {
        const stateSegment = commaParts[commaParts.length - 1];
        const stateMatch = stateSegment.match(/\b([A-Z]{2})\b/);
        if (stateMatch) {
            const citySegment = commaParts[commaParts.length - 2] || commaParts[0];
            const cityTokens = citySegment.split(/\s+/).filter(Boolean);
            const cleanedTokens: string[] = [];
            for (let index = cityTokens.length - 1; index >= 0; index -= 1) {
                const stripped = cityTokens[index].replace(/[^\w.'-]/g, '');
                if (!stripped || /^\d/.test(stripped) || isStreetToken(stripped.toUpperCase())) {
                    break;
                }
                cleanedTokens.unshift(stripped);
                if (cleanedTokens.length >= 4)
                    break;
            }
            return {
                city: titleCaseCity(cleanedTokens.join(' ') || citySegment),
                state: stateMatch[1],
            };
        }
    }
    return { city: titleCaseCity(normalized), state: '' };
}
export function formatManifestInlineTime(timeLabel: string, windowLabel?: string | null) {
    const value = windowLabel?.trim() || timeLabel?.trim();
    if (!value || value === '—')
        return null;
    return value;
}
export function formatManifestLocationLine(city: string, state: string) {
    if (!city || city === '—')
        return '—';
    return state ? `${city}, ${state}` : city;
}
export function formatManifestScheduleLine(dateLabel: string, timeLabel: string) {
    if (timeLabel && timeLabel !== '—') {
        return `${dateLabel} @ ${timeLabel}`;
    }
    return dateLabel;
}
function resolveStopSequence(stop: Record<string, unknown>, fallback: number) {
    const raw = stop.stop_index ?? stop.index ?? stop.sequence ?? stop.stop_number;
    if (typeof raw === 'number' && Number.isFinite(raw))
        return raw;
    const parsed = Number.parseInt(String(raw ?? ''), 10);
    return Number.isFinite(parsed) ? parsed : fallback;
}
function resolveRawStops(load: LoadManifestSource): Array<Record<string, unknown>> {
    if (Array.isArray(load.stops) && load.stops.length > 0)
        return load.stops;
    if (Array.isArray(load.detailed_stops) && load.detailed_stops.length > 0) {
        return load.detailed_stops;
    }
    return [];
}
export function resolveStopRole(index: number, total: number): ManifestStopRole {
    if (total <= 1)
        return index === 0 ? 'PICKUP' : 'DELIVERY';
    if (index === 0)
        return 'PICKUP';
    if (index === total - 1)
        return 'DELIVERY';
    return 'DROP';
}
function resolveStopReference(role: ManifestStopRole, stop: Record<string, unknown>, load: LoadManifestSource, isFirstStop: boolean): string | null {
    const pickupRef = readString(stop.pu_po_number ??
        stop.pickup_po_number ??
        stop.pickup_number ??
        stop.po_number ??
        stop.reference ??
        stop.reference_number ??
        (isFirstStop ? load.pickup_number ?? load.pu_number : ''));
    const deliveryRef = readString(stop.del_po_number ??
        stop.delivery_po_number ??
        stop.delivery_number ??
        stop.po_number ??
        stop.reference ??
        stop.reference_number ??
        load.delivery_number);
    if (role === 'PICKUP' && pickupRef)
        return `PU PO#: ${pickupRef}`;
    if ((role === 'DROP' || role === 'DELIVERY') && deliveryRef)
        return `DELV# ${deliveryRef}`;
    return null;
}
function resolveWeightLine(stop: Record<string, unknown>): string | null {
    const parts: string[] = [];
    const weight = stop.weight ?? stop.total_weight;
    const pallets = stop.pallets ?? stop.pallet_count;
    const pieces = stop.pieces ?? stop.piece_count ?? stop.quantity;
    if (weight != null && readString(weight))
        parts.push(`Weight: ${weight}`);
    if (pieces != null && readString(pieces))
        parts.push(`Pieces: ${pieces}`);
    if (pallets != null && readString(pallets))
        parts.push(`Pallets: ${pallets}`);
    return parts.length > 0 ? parts.join(' | ') : null;
}
function resolveAppointmentLine(stop: Record<string, unknown>): string | null {
    const window = compileAppointmentWindowFromStop(stop);
    if (window)
        return `Appointment: ${window}`;
    const earliest = readString(stop.earliest_appointment ?? stop.appointment_earliest ?? stop.earliest ?? stop.earliest_time);
    const latest = readString(stop.latest_appointment ?? stop.appointment_latest ?? stop.latest ?? stop.latest_time);
    if (earliest && latest)
        return `Appointment: ${earliest} – ${latest}`;
    if (earliest)
        return `Appointment: Earliest ${earliest}`;
    if (latest)
        return `Appointment: Latest ${latest}`;
    return null;
}
function resolveWindowLabel(stop: Record<string, unknown>, timeLabel: string): string | null {
    const compiled = compileAppointmentWindowFromStop(stop);
    if (compiled)
        return compiled;
    if (timeLabel && timeLabel !== '—')
        return timeLabel;
    return null;
}
function buildFallbackStops(load: LoadManifestSource): Array<Record<string, unknown>> {
    return [
        {
            stop_type: 'pickup',
            company_name: readString(load.origin) || 'Pickup',
            address: readString(load.origin),
            date_time: load.pickup_date_time ?? load.pickup_date ?? '',
        },
        {
            stop_type: 'delivery',
            company_name: readString(load.destination) || 'Delivery',
            address: readString(load.destination),
            date_time: load.delivery_date_time ?? load.delivery_date ?? '',
        },
    ];
}
export function resolveManifestStops(load: LoadManifestSource | null | undefined): ManifestStopView[] {
    if (!load)
        return [];
    const rawStops = resolveRawStops(load);
    const sortedStops = (rawStops.length > 0 ? rawStops : buildFallbackStops(load))
        .map((stop, index) => ({ stop, sequence: resolveStopSequence(stop, index) }))
        .sort((left, right) => left.sequence - right.sequence)
        .map(({ stop }) => stop);
    const total = sortedStops.length;
    return sortedStops.map((stop, index) => {
        const role = resolveStopRole(index, total);
        const address = readString(stop.address) ||
            (index === 0 ? readString(load.origin) : readString(load.destination)) ||
            'Address pending';
        const companyName = readString(stop.company_name) ||
            (index === 0 ? readString(load.origin) : readString(load.destination)) ||
            role;
        const location = parseLocationFromAddress(address);
        const dateTimeRaw = readString(stop.date_time ??
            stop.scheduled_date ??
            stop.date ??
            stop.pickup_time ??
            stop.delivery_time);
        const fallbackDate = extractCleanDate(dateTimeRaw) ||
            getFallbackDate(load as LoadDateSource, index === total - 1 ? 'delivery' : 'pickup') ||
            '';
        const formatted = formatLoadDateTimeParts(dateTimeRaw || fallbackDate);
        const dateLabel = formatted.date !== '—'
            ? formatted.date
            : formatLoadDateLabel(fallbackDate) || 'TBD';
        const timeLabel = formatted.time;
        const windowLabel = resolveWindowLabel(stop, timeLabel);
        const scheduleLabel = formatManifestScheduleLine(dateLabel, windowLabel ?? timeLabel);
        return {
            sequence: index + 1,
            role,
            companyName,
            address,
            locationLine: formatManifestLocationLine(location.city, location.state),
            dateLabel,
            timeLabel,
            windowLabel,
            scheduleLabel,
            dateTimeRaw: dateTimeRaw || fallbackDate,
            referenceLine: resolveStopReference(role, stop, load, index === 0),
            weightLine: resolveWeightLine(stop),
            appointmentLine: resolveAppointmentLine(stop),
            notes: readString(stop.notes),
        };
    });
}
export function countIntermediateDrops(stops: ManifestStopView[]): number {
    return Math.max(0, stops.length - 2);
}
export function getIntermediateDropStops(stops: ManifestStopView[]): ManifestStopView[] {
    if (stops.length <= 2)
        return [];
    return stops.slice(1, -1);
}
export function getManifestRoleLabelClass(role: ManifestStopRole): string {
    if (role === 'PICKUP')
        return 'text-emerald-600 dark:text-emerald-400';
    if (role === 'DROP')
        return 'text-amber-600 dark:text-amber-400';
    return 'text-sky-600 dark:text-sky-400';
}
export function getManifestRoleNodeClass(role: ManifestStopRole): string {
    if (role === 'PICKUP')
        return 'bg-emerald-500';
    if (role === 'DROP')
        return 'bg-amber-500';
    return 'bg-sky-500';
}
export function formatManifestRoleLabel(role: ManifestStopRole): string {
    if (role === 'PICKUP')
        return 'Pickup';
    if (role === 'DROP')
        return 'Drop';
    return 'Delivery';
}
