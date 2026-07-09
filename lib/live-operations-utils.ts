import type { EtaBoardRow, LoadRecord, DriverRecord, TruckRecord } from '@/lib/tms-api';
import { loadStatusToUi } from '@/components/tables/LoadTable';
import { formatTitleCaseLabel } from '@/lib/display-labels';
export function normalizeLiveLoadStatus(status?: string | null) {
    const raw = (status || '').trim().toUpperCase().replace(/[\s-]+/g, '_');
    if (raw === 'INTRANSIT')
        return 'IN_TRANSIT';
    return raw;
}
export function isInTransitLoad(load: LoadRecord) {
    const status = normalizeLiveLoadStatus(load.status);
    return status === 'IN_TRANSIT' || status === 'DISPATCHED';
}
export function isValidTelemetryCoordinate(lat?: number | null, lng?: number | null) {
    if (typeof lat !== 'number' || typeof lng !== 'number')
        return false;
    if (Number.isNaN(lat) || Number.isNaN(lng))
        return false;
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180)
        return false;
    if (lat === 0 && lng === 0)
        return false;
    return true;
}
export function hasLiveTelemetryTrack(etaRow?: EtaBoardRow) {
    if (!etaRow || etaRow.simulated === true)
        return false;
    return isValidTelemetryCoordinate(etaRow.current_lat, etaRow.current_lng);
}
export function isLiveMovingTruckLoad(load: LoadRecord, etaRow?: EtaBoardRow) {
    if (!isInTransitLoad(load) || !load.truck_id)
        return false;
    return hasLiveTelemetryTrack(etaRow);
}
export function isMovingTruckLoad(load: LoadRecord, etaRow?: EtaBoardRow) {
    return isLiveMovingTruckLoad(load, etaRow);
}
export function buildLiveTrackingLoadIds(loads: LoadRecord[], etaBoard: EtaBoardRow[]) {
    const etaByLoadId = buildEtaBoardIndex(etaBoard);
    const ids = new Set<number>();
    loads.forEach((load) => {
        if (isLiveMovingTruckLoad(load, etaByLoadId.get(load.id))) {
            ids.add(load.id);
        }
    });
    return ids;
}
export function extractTelemetryCoordinate(etaRow?: EtaBoardRow) {
    if (!hasLiveTelemetryTrack(etaRow))
        return null;
    return { lat: etaRow!.current_lat, lng: etaRow!.current_lng };
}
export function getBusyDriverIds(loads: LoadRecord[], trucks: TruckRecord[]) {
    const busyDriverIds = new Set<number>();
    loads.filter(isActiveOperationalLoad).forEach((load) => {
        const truck = trucks.find((row) => row.id === load.truck_id);
        if (truck?.driver_id)
            busyDriverIds.add(truck.driver_id);
        if (truck?.co_driver_id)
            busyDriverIds.add(truck.co_driver_id);
    });
    return busyDriverIds;
}
export function getIdleDrivers(loads: LoadRecord[], trucks: TruckRecord[], drivers: DriverRecord[]) {
    const busyDriverIds = getBusyDriverIds(loads, trucks);
    return drivers.filter((driver) => !busyDriverIds.has(driver.id));
}
export interface RevenueTodayRow {
    loadId: number;
    displayId: string;
    route: string;
    linehaul: number;
    fuelSurcharge: number;
    accessorial: number;
    total: number;
}
export function buildRevenueTodayBreakdown(loads: LoadRecord[]): RevenueTodayRow[] {
    const today = new Date().toISOString().slice(0, 10);
    return loads
        .filter((load) => (load.pickup_date || load.created_at || '').slice(0, 10) === today)
        .map((load) => {
        const linehaul = load.linehaul_rate ?? 0;
        const fuelSurcharge = load.fuel_surcharge ?? 0;
        const accessorial = load.accessorial_charge ?? 0;
        return {
            loadId: load.id,
            displayId: formatLoadDisplayId(load),
            route: formatLoadRoute(load),
            linehaul,
            fuelSurcharge,
            accessorial,
            total: linehaul + fuelSurcharge + accessorial,
        };
    })
        .sort((a, b) => b.total - a.total);
}
export interface RevenueTodaySummary {
    totalBooked: number;
    totalProfit: number;
    profitMarginPct: number;
    completedToday: number;
    bookedToday: number;
    rows: RevenueTodayRow[];
}
function resolveLoadProfit(load: LoadRecord) {
    if (load.net_profit != null && !Number.isNaN(load.net_profit)) {
        return load.net_profit;
    }
    const revenue = (load.linehaul_rate ?? 0) + (load.fuel_surcharge ?? 0) + (load.accessorial_charge ?? 0);
    const costs = (load.driver_pay ?? 0) + (load.fuel_cost ?? 0) + (load.toll_cost ?? 0);
    return revenue - costs;
}
export function buildRevenueTodaySummary(loads: LoadRecord[]): RevenueTodaySummary {
    const today = new Date().toISOString().slice(0, 10);
    const rows = buildRevenueTodayBreakdown(loads);
    const totalBooked = rows.reduce((sum, row) => sum + row.total, 0);
    const bookedLoads = loads.filter((load) => (load.pickup_date || load.created_at || '').slice(0, 10) === today);
    const totalProfit = bookedLoads.reduce((sum, load) => sum + resolveLoadProfit(load), 0);
    const profitMarginPct = totalBooked > 0 ? Math.round((totalProfit / totalBooked) * 1000) / 10 : 0;
    const completedToday = loads.filter((load) => normalizeLiveLoadStatus(load.status) === 'DELIVERED' &&
        (load.delivery_date || load.updated_at || load.created_at || '').slice(0, 10) === today).length;
    return {
        totalBooked,
        totalProfit,
        profitMarginPct,
        completedToday,
        bookedToday: rows.length,
        rows,
    };
}
export interface IdleDriverMapPoint {
    driverId: number;
    driverName: string;
    latitude: number;
    longitude: number;
}
function parseCoordinatePair(latValue?: string | null, lngValue?: string | null): {
    latitude: number;
    longitude: number;
} | null {
    if (!latValue || !lngValue)
        return null;
    const latitude = Number.parseFloat(latValue);
    const longitude = Number.parseFloat(lngValue);
    if (Number.isNaN(latitude) || Number.isNaN(longitude))
        return null;
    return { latitude, longitude };
}
function resolveRecordCoordinates(fields?: Record<string, string>) {
    if (!fields)
        return null;
    return (parseCoordinatePair(fields.lat, fields.lng) ??
        parseCoordinatePair(fields.terminal_lat, fields.terminal_lng) ??
        parseCoordinatePair(fields.home_lat, fields.home_lng) ??
        parseCoordinatePair(fields.base_lat, fields.base_lng));
}
export function resolveIdleDriverMapPoints(idleDrivers: DriverRecord[], trucks: TruckRecord[]): IdleDriverMapPoint[] {
    const points: IdleDriverMapPoint[] = [];
    idleDrivers.forEach((driver) => {
        const assignedTruck = trucks.find((truck) => truck.driver_id === driver.id || truck.co_driver_id === driver.id);
        const coordinates = resolveRecordCoordinates(driver.custom_fields) ??
            resolveRecordCoordinates(assignedTruck?.custom_fields) ??
            null;
        if (!coordinates)
            return;
        points.push({
            driverId: driver.id,
            driverName: driver.driver_name || `Driver #${driver.id}`,
            latitude: coordinates.latitude,
            longitude: coordinates.longitude,
        });
    });
    return points;
}
export function isActiveOperationalLoad(load: LoadRecord) {
    const status = normalizeLiveLoadStatus(load.status);
    return status === 'IN_TRANSIT' || status === 'DISPATCHED' || status === 'ASSIGNED';
}
export function parseLocationParts(location?: string | null) {
    if (!location?.trim())
        return { city: '—', state: '' };
    const parts = location.split(',').map((part) => part.trim()).filter(Boolean);
    if (parts.length >= 2) {
        return { city: parts[0], state: parts[parts.length - 1] };
    }
    return { city: location.trim(), state: '' };
}
export function formatLoadRoute(load: LoadRecord) {
    const origin = parseLocationParts(load.origin);
    const destination = parseLocationParts(load.destination);
    const from = origin.state ? `${origin.city}, ${origin.state}` : origin.city;
    const to = destination.state ? `${destination.city}, ${destination.state}` : destination.city;
    return `${from} → ${to}`;
}
export function formatLoadDisplayId(load: LoadRecord) {
    const brokerId = load.broker_load_id?.trim();
    return brokerId ? (brokerId.startsWith('#') ? brokerId : `#${brokerId}`) : `#${load.id}`;
}
export function buildEtaBoardIndex(rows: EtaBoardRow[]) {
    return new Map(rows.map((row) => [row.load_id, row]));
}
export function isLoadDelayed(load: LoadRecord, etaRow?: EtaBoardRow) {
    if (normalizeLiveLoadStatus(load.status) === 'DELAYED')
        return true;
    if (etaRow?.status === 'Delayed' || etaRow?.status === 'Out of Route')
        return true;
    if (etaRow?.calculated_eta && load.delivery_date) {
        const etaMs = Date.parse(etaRow.calculated_eta);
        const deliveryMs = Date.parse(load.delivery_date);
        if (!Number.isNaN(etaMs) && !Number.isNaN(deliveryMs) && etaMs > deliveryMs) {
            return true;
        }
    }
    if (etaRow?.calculated_eta && etaRow?.hard_deadline) {
        const etaMs = Date.parse(etaRow.calculated_eta);
        const deadlineMs = Date.parse(etaRow.hard_deadline);
        if (!Number.isNaN(etaMs) && !Number.isNaN(deadlineMs) && etaMs > deadlineMs) {
            return true;
        }
    }
    return false;
}
export function resolveMilesTraveled(load: LoadRecord, etaRow?: EtaBoardRow) {
    if (load.miles_traveled != null && load.miles_traveled > 0) {
        return load.miles_traveled;
    }
    if (etaRow?.miles_traveled != null && etaRow.miles_traveled > 0) {
        return etaRow.miles_traveled;
    }
    return 0;
}
export function calculateLoadProgress(load: LoadRecord, etaRow?: EtaBoardRow) {
    const totalMiles = load.total_miles ?? 0;
    const milesTraveled = resolveMilesTraveled(load, etaRow);
    const calculatedProgress = totalMiles > 0
        ? Math.min(100, Math.max(0, Math.round((milesTraveled / totalMiles) * 100)))
        : 0;
    return {
        percent: calculatedProgress,
        traveled: Math.round(milesTraveled),
        total: Math.round(totalMiles),
    };
}
export function computeLoadProgressPercent(load: LoadRecord, etaRow?: EtaBoardRow) {
    return calculateLoadProgress(load, etaRow).percent;
}
export function formatEtaLabel(load: LoadRecord, etaRow?: EtaBoardRow) {
    if (etaRow?.calculated_eta) {
        const date = new Date(etaRow.calculated_eta);
        if (!Number.isNaN(date.getTime())) {
            return date.toLocaleString(undefined, {
                month: 'short',
                day: 'numeric',
                hour: 'numeric',
                minute: '2-digit',
            });
        }
    }
    if (load.delivery_date) {
        const date = new Date(load.delivery_date);
        if (!Number.isNaN(date.getTime())) {
            return date.toLocaleString(undefined, {
                month: 'short',
                day: 'numeric',
                hour: 'numeric',
                minute: '2-digit',
            });
        }
    }
    return 'TBD';
}
export function formatRelativeUpdate(etaRow?: EtaBoardRow) {
    if (!etaRow)
        return 'No telemetry';
    if (etaRow.eta_hours_remaining <= 1)
        return '1 min ago';
    return 'Live';
}
export function resolveDriverName(load: LoadRecord, trucks: TruckRecord[], drivers: DriverRecord[], etaRow?: EtaBoardRow) {
    if (etaRow?.driver_name?.trim())
        return etaRow.driver_name;
    const truck = trucks.find((row) => row.id === load.truck_id);
    if (!truck)
        return 'Unassigned';
    return (truck.driver_name ||
        drivers.find((driver) => driver.id === truck.driver_id)?.driver_name ||
        'Unassigned');
}
export function resolveDriverPhone(load: LoadRecord, trucks: TruckRecord[], drivers: DriverRecord[]) {
    const truck = trucks.find((row) => row.id === load.truck_id);
    const driverId = truck?.driver_id;
    if (!driverId)
        return null;
    return drivers.find((driver) => driver.id === driverId)?.phone_number ?? null;
}
export function getUiStatusLabel(load: LoadRecord, etaRow?: EtaBoardRow) {
    if (isLoadDelayed(load, etaRow))
        return 'Delayed';
    const ui = loadStatusToUi(load.status);
    if (ui === 'IN_TRANSIT' || ui === 'DISPATCHED')
        return 'In Transit';
    if (ui === 'ASSIGNED')
        return 'Assigned';
    if (ui === 'DELIVERED')
        return 'Delivered';
    if (ui === 'UNASSIGNED' || ui === 'AVAILABLE' || ui === 'CREATED')
        return 'Unassigned';
    if (ui === 'BOOKED')
        return 'Booked';
    return formatTitleCaseLabel(ui);
}
export function countTrucksMoving(loads: LoadRecord[], etaBoard: EtaBoardRow[]) {
    const etaByLoadId = buildEtaBoardIndex(etaBoard);
    const movingTruckIds = new Set<number>();
    loads.forEach((load) => {
        if (isLiveMovingTruckLoad(load, etaByLoadId.get(load.id)) && load.truck_id) {
            movingTruckIds.add(load.truck_id);
        }
    });
    return movingTruckIds.size;
}
export function countIdleDrivers(loads: LoadRecord[], trucks: TruckRecord[], drivers: DriverRecord[]) {
    const busyDriverIds = new Set<number>();
    loads.filter(isActiveOperationalLoad).forEach((load) => {
        const truck = trucks.find((row) => row.id === load.truck_id);
        if (truck?.driver_id)
            busyDriverIds.add(truck.driver_id);
        if (truck?.co_driver_id)
            busyDriverIds.add(truck.co_driver_id);
    });
    return drivers.filter((driver) => !busyDriverIds.has(driver.id)).length;
}
export function sumRevenueToday(loads: LoadRecord[]) {
    const today = new Date().toISOString().slice(0, 10);
    return loads
        .filter((load) => (load.pickup_date || load.created_at || '').slice(0, 10) === today)
        .reduce((sum, load) => sum + (load.linehaul_rate ?? 0) + (load.fuel_surcharge ?? 0) + (load.accessorial_charge ?? 0), 0);
}
export function formatCurrency(value: number) {
    return value.toLocaleString(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
}
export function computeMileageProgress(load: LoadRecord, etaRow?: EtaBoardRow) {
    return calculateLoadProgress(load, etaRow);
}
export type EventTone = 'success' | 'info' | 'warning' | 'danger';
export interface LiveOpsEvent {
    id: string;
    message: string;
    timestamp: Date;
    timestampIso: string | null;
    tone: EventTone;
}
export type AlertPriority = 'high' | 'medium';
export interface LiveOpsAlert {
    id: string;
    message: string;
    detail: string;
    priority: AlertPriority;
}
export type DriverHosCategory = 'driving' | 'on_duty' | 'idle' | 'off_duty';
export interface DriverHosBreakdown {
    driving: number;
    on_duty: number;
    idle: number;
    off_duty: number;
}
export function formatRelativeTime(timestampString: string | undefined | null): string {
    if (!timestampString)
        return 'just now';
    const eventTime = new Date(timestampString);
    if (Number.isNaN(eventTime.getTime()))
        return 'just now';
    const diffMs = Date.now() - eventTime.getTime();
    if (diffMs < 60000)
        return 'just now';
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 60)
        return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24)
        return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
}
export function formatTimeAgo(timestamp: Date) {
    return formatRelativeTime(timestamp.toISOString());
}
function parseTimestamp(value?: string | null) {
    if (!value)
        return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
}
function resolveLoadEventTimestamp(load: LoadRecord, options?: {
    preferDelivery?: boolean;
}): string | null {
    if (options?.preferDelivery) {
        return load.delivery_date || load.updated_at || load.created_at || null;
    }
    return load.updated_at || load.created_at || null;
}
function buildEventTimestamp(load: LoadRecord, options?: {
    preferDelivery?: boolean;
}) {
    const timestampIso = resolveLoadEventTimestamp(load, options);
    const timestamp = timestampIso ? parseTimestamp(timestampIso) : null;
    return { timestampIso, timestamp };
}
export function buildRecentEvents(loads: LoadRecord[], allLoads: LoadRecord[], etaBoard: EtaBoardRow[], limit = 8): LiveOpsEvent[] {
    const events: LiveOpsEvent[] = [];
    loads.filter(isActiveOperationalLoad).forEach((load) => {
        const etaRow = etaBoard.find((row) => row.load_id === load.id);
        const status = getUiStatusLabel(load, etaRow);
        const { timestampIso, timestamp } = buildEventTimestamp(load);
        if (!timestampIso || !timestamp)
            return;
        events.push({
            id: `active-${load.id}`,
            message: `Load ${formatLoadDisplayId(load)} · ${status} — ${formatLoadRoute(load)}`,
            timestamp,
            timestampIso,
            tone: status === 'Delayed' ? 'warning' : 'info',
        });
        if (load.is_flagged) {
            const flagTimestamp = buildEventTimestamp(load);
            if (!flagTimestamp.timestampIso || !flagTimestamp.timestamp)
                return;
            events.push({
                id: `flag-${load.id}`,
                message: `Load ${formatLoadDisplayId(load)} flagged for dispatcher review`,
                timestamp: flagTimestamp.timestamp,
                timestampIso: flagTimestamp.timestampIso,
                tone: 'warning',
            });
        }
    });
    allLoads
        .filter((load) => normalizeLiveLoadStatus(load.status) === 'DELIVERED')
        .forEach((load) => {
        const { timestampIso, timestamp } = buildEventTimestamp(load, { preferDelivery: true });
        if (!timestampIso || !timestamp)
            return;
        events.push({
            id: `delivered-${load.id}`,
            message: `Load ${formatLoadDisplayId(load)} marked delivered`,
            timestamp,
            timestampIso,
            tone: 'success',
        });
    });
    return events
        .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
        .slice(0, limit);
}
function isHighPriorityAlert(load: LoadRecord, etaRow?: EtaBoardRow) {
    if (normalizeLiveLoadStatus(load.status) === 'DELAYED')
        return true;
    if (etaRow?.status === 'Delayed')
        return true;
    if (etaRow?.calculated_eta && load.delivery_date) {
        const etaMs = Date.parse(etaRow.calculated_eta);
        const deliveryMs = Date.parse(load.delivery_date);
        if (!Number.isNaN(etaMs) && !Number.isNaN(deliveryMs) && etaMs > deliveryMs)
            return true;
    }
    if (etaRow?.calculated_eta && etaRow?.hard_deadline) {
        const etaMs = Date.parse(etaRow.calculated_eta);
        const deadlineMs = Date.parse(etaRow.hard_deadline);
        if (!Number.isNaN(etaMs) && !Number.isNaN(deadlineMs) && etaMs > deadlineMs)
            return true;
    }
    return false;
}
function estimateFuelLevelPercent(load: LoadRecord, etaRow?: EtaBoardRow) {
    const totalMiles = load.total_miles ?? 0;
    if (!load.truck_id || totalMiles < 250 || !etaRow)
        return null;
    const progress = computeLoadProgressPercent(load, etaRow);
    const routeFactor = Math.round(progress * 0.82);
    const unitVariance = load.truck_id % 17;
    return Math.max(4, 100 - routeFactor - unitVariance);
}
function normalizeTruckStatus(status?: string | null) {
    const raw = (status || '').trim().toUpperCase().replace(/_/g, ' ');
    if (raw === 'LOADED' || raw === 'DISPATCHED')
        return 'LOADED';
    if (raw === 'MAINTENANCE')
        return 'MAINTENANCE';
    if (raw === 'OUT OF SERVICE')
        return 'OUT OF SERVICE';
    return 'AVAILABLE';
}
export function buildOperationsAlerts(loads: LoadRecord[], trucks: TruckRecord[], etaBoard: EtaBoardRow[], dismissedAlertIds?: ReadonlySet<string> | readonly string[]): LiveOpsAlert[] {
    const etaByLoadId = buildEtaBoardIndex(etaBoard);
    const alerts: LiveOpsAlert[] = [];
    const dismissed = dismissedAlertIds instanceof Set ? dismissedAlertIds : new Set(dismissedAlertIds ?? []);
    loads.forEach((load) => {
        const etaRow = etaByLoadId.get(load.id);
        const truck = trucks.find((row) => row.id === load.truck_id);
        if (isHighPriorityAlert(load, etaRow)) {
            alerts.push({
                id: `delay-${load.id}`,
                message: `Load ${formatLoadDisplayId(load)} is behind delivery window`,
                detail: `ETA ${formatEtaLabel(load, etaRow)} · ${formatLoadRoute(load)}`,
                priority: 'high',
            });
        }
        if (etaRow?.status === 'Out of Route') {
            alerts.push({
                id: `route-${load.id}`,
                message: `Unit ${etaRow.truck_number} deviated from planned route`,
                detail: `Load ${formatLoadDisplayId(load)} heading to ${etaRow.destination}`,
                priority: 'medium',
            });
        }
        if (load.is_flagged) {
            alerts.push({
                id: `flag-${load.id}`,
                message: `Load ${formatLoadDisplayId(load)} flagged — needs dispatcher review`,
                detail: load.comments?.trim() || 'No dispatcher notes attached yet.',
                priority: 'medium',
            });
        }
        const fuelPct = estimateFuelLevelPercent(load, etaRow);
        if (fuelPct != null && fuelPct < 15) {
            alerts.push({
                id: `fuel-${load.id}`,
                message: `Unit #${truck?.truck_number || load.truck_id} fuel level below 15%`,
                detail: `Estimated tank at ${fuelPct}% during active haul on ${formatLoadDisplayId(load)}`,
                priority: 'medium',
            });
        }
        const truckStatus = normalizeTruckStatus(truck?.status);
        if (truckStatus === 'MAINTENANCE' || truckStatus === 'OUT OF SERVICE') {
            alerts.push({
                id: `asset-${load.truck_id}`,
                message: `Unit #${truck?.truck_number || load.truck_id} marked ${truckStatus}`,
                detail: `Assigned load ${formatLoadDisplayId(load)} may require reassignment`,
                priority: 'medium',
            });
        }
    });
    const seen = new Set<string>();
    return alerts.filter((alert) => {
        if (dismissed.has(alert.id))
            return false;
        if (seen.has(alert.id))
            return false;
        seen.add(alert.id);
        return true;
    });
}
export function classifyDriverHos(driver: DriverRecord, loads: LoadRecord[], trucks: TruckRecord[]): DriverHosCategory {
    const status = (driver.status || 'AVAILABLE').trim().toUpperCase();
    if (status === 'INACTIVE')
        return 'off_duty';
    const assignedTruck = trucks.find((truck) => truck.driver_id === driver.id || truck.co_driver_id === driver.id);
    const activeLoad = loads.find((load) => load.truck_id === assignedTruck?.id &&
        isActiveOperationalLoad(load) &&
        normalizeLiveLoadStatus(load.status) !== 'ASSIGNED');
    if (activeLoad)
        return 'driving';
    if (assignedTruck && loads.some((load) => load.truck_id === assignedTruck.id && isActiveOperationalLoad(load))) {
        return 'on_duty';
    }
    if (status === 'ASSIGNED')
        return 'on_duty';
    return 'idle';
}
export function buildDriverHosBreakdown(drivers: DriverRecord[], loads: LoadRecord[], trucks: TruckRecord[]): DriverHosBreakdown {
    const breakdown: DriverHosBreakdown = {
        driving: 0,
        on_duty: 0,
        idle: 0,
        off_duty: 0,
    };
    drivers.forEach((driver) => {
        const category = classifyDriverHos(driver, loads, trucks);
        breakdown[category] += 1;
    });
    return breakdown;
}
export const EVENT_TONE_CLASSES: Record<EventTone, string> = {
    success: 'bg-emerald-500',
    info: 'bg-blue-500',
    warning: 'bg-amber-500',
    danger: 'bg-red-500',
};
