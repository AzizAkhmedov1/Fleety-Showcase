import { combineEditDateWithWindow, compileAppointmentWindowFromStop, normalizeEditDateString, splitStopScheduleForEdit, } from '@/lib/load-appointment-window';
import { coerceDateValue, extractCleanDate, formatLoadDateTimeParts } from '@/lib/load-dates';
import { resolveStopRole, type ManifestStopRole, } from '@/lib/load-manifest-stops';
import type { LoadRecord } from '@/lib/tms-api';
export type EditStopType = 'pickup' | 'drop' | 'delivery';
export interface EditRouteStop {
    id: number;
    type: EditStopType;
    facility_name: string;
    address: string;
    appointment_date: string;
    appointment_window: string;
}
function roleToEditType(role: ManifestStopRole): EditStopType {
    if (role === 'PICKUP')
        return 'pickup';
    if (role === 'DROP')
        return 'drop';
    return 'delivery';
}
export function editTypeToManifestRole(type: EditStopType): ManifestStopRole {
    if (type === 'pickup')
        return 'PICKUP';
    if (type === 'drop')
        return 'DROP';
    return 'DELIVERY';
}
function editTypeToApiStopType(type: EditStopType): string {
    if (type === 'pickup')
        return 'pickup';
    if (type === 'drop')
        return 'drop';
    return 'delivery';
}
function resolveRawStopType(stop: Record<string, unknown>, index: number, total: number): EditStopType {
    const raw = String(stop.stop_type ?? '').trim().toLowerCase();
    if (raw === 'pickup' || raw === 'origin')
        return 'pickup';
    if (raw === 'drop')
        return 'drop';
    if (raw === 'delivery' || raw === 'destination')
        return 'delivery';
    return roleToEditType(resolveStopRole(index, total));
}
export function splitDateTimeForEdit(value?: string | null): {
    date: string;
    time: string;
} {
    const normalized = coerceDateValue(value);
    if (!normalized)
        return { date: '', time: '' };
    const parsed = new Date(normalized);
    if (Number.isNaN(parsed.getTime()))
        return { date: '', time: '' };
    const month = String(parsed.getMonth() + 1).padStart(2, '0');
    const day = String(parsed.getDate()).padStart(2, '0');
    const hours = String(parsed.getHours()).padStart(2, '0');
    const minutes = String(parsed.getMinutes()).padStart(2, '0');
    return {
        date: `${parsed.getFullYear()}-${month}-${day}`,
        time: `${hours}:${minutes}`,
    };
}
export function parseEditStopsFromLoad(load: LoadRecord): EditRouteStop[] {
    const rawStops = Array.isArray(load.detailed_stops) ? load.detailed_stops : [];
    if (rawStops.length > 0) {
        const total = rawStops.length;
        return rawStops.map((stop, index) => {
            const record = stop as Record<string, unknown>;
            const dateTimeRaw = String(record.date_time ?? record.scheduled_date ?? record.date ?? '').trim();
            const { date, window } = splitStopScheduleForEdit(dateTimeRaw, record);
            return {
                id: index + 1,
                type: resolveRawStopType(record, index, total),
                facility_name: String(record.company_name ?? record.facility_name ?? '').trim(),
                address: String(record.address ?? '').trim(),
                appointment_date: normalizeEditDateString(date),
                appointment_window: window,
            };
        });
    }
    const origin = String(load.origin ?? '').trim();
    const destination = String(load.destination ?? '').trim();
    const stops: EditRouteStop[] = [];
    if (origin) {
        stops.push({
            id: 1,
            type: 'pickup',
            facility_name: origin,
            address: origin,
            appointment_date: '',
            appointment_window: '',
        });
    }
    if (destination) {
        stops.push({
            id: stops.length + 1,
            type: 'delivery',
            facility_name: destination,
            address: destination,
            appointment_date: '',
            appointment_window: '',
        });
    }
    return stops;
}
export function buildApiStopsFromEditStops(stops: EditRouteStop[]): Array<Record<string, string>> {
    return stops.map((stop, index) => {
        const appointmentDate = normalizeEditDateString(stop.appointment_date);
        const appointmentWindow = stop.appointment_window.trim();
        const dateTime = combineEditDateWithWindow(appointmentDate, appointmentWindow);
        const cleanedDate = extractCleanDate(dateTime);
        return {
            stop_type: editTypeToApiStopType(stop.type),
            company_name: stop.facility_name.trim(),
            address: stop.address.trim(),
            date_time: dateTime || cleanedDate || '',
            appointment_window: appointmentWindow,
            raw_appointment_window: appointmentWindow,
            notes: '',
            stop_index: String(index),
        };
    });
}
export function deriveEndpointsFromEditStops(stops: EditRouteStop[]): {
    origin: string;
    destination: string;
} {
    const first = stops.find((stop) => stop.address.trim());
    const last = [...stops].reverse().find((stop) => stop.address.trim());
    return {
        origin: first?.address.trim() ?? '',
        destination: last?.address.trim() ?? '',
    };
}
export function formatEditStopSummary(stop: EditRouteStop): string {
    const parts: string[] = [];
    const facility = stop.facility_name.trim();
    const address = stop.address.trim();
    if (facility)
        parts.push(facility);
    if (address && address !== facility)
        parts.push(address);
    const window = stop.appointment_window.trim();
    const dateTime = combineEditDateWithWindow(stop.appointment_date, window);
    if (window) {
        parts.push(stop.appointment_date.trim()
            ? `${stop.appointment_date} @ ${window}`
            : window);
    }
    else if (dateTime) {
        const formatted = formatLoadDateTimeParts(dateTime);
        if (formatted.date !== '—') {
            parts.push(formatted.time !== '—' ? `${formatted.date} @ ${formatted.time}` : formatted.date);
        }
    }
    else if (stop.appointment_date.trim()) {
        parts.push(stop.appointment_date);
    }
    return parts.join(' • ') || 'Stop details pending';
}
export { compileAppointmentWindowFromStop };
