'use client';
import dynamic from 'next/dynamic';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronLeft, ChevronRight, Calendar, Loader2, Plus, Search, Trash2, Truck } from 'lucide-react';
import ProfileDrawerShell from '@/components/ui/ProfileDrawerShell';
import { createApiClient, formatApiError } from '@/lib/api-client';
import { getUserId } from '@/lib/auth';
import { buildPlanningRowDayGrid, buildPlanningRowDayStatusGrid, buildPlanningDateRangeToEnd, buildWeekDays, getMondayStart, getPlanningWeekWindow, parseLocalDate, rowHasPlanningWindowContext, shiftWeekStart, toInputDate, type PlanningScheduleLoad, } from '@/lib/planning-timeline';
import type { PlanningEvent, PlanningEventFormInput, PlanningEventStatus, } from '@/components/modals/PlanningEventModal';
import { embedCalendarDutyPayload, findPlanningCustomStatus, formatPlanningCustomAssignedUnit, parseCalendarDutyPayload, parseCalendarStatusFromDescription, parsePlanningCustomAssignedUnit, PLANNING_DEFAULT_CUSTOM_STATUSES, type PlanningCustomStatus, } from '@/components/modals/PlanningEventModal';
import { PLANNING_DAY_DUTY_OPTIONS, type PlanningDayDutyStatus, } from '@/lib/planning-day-status';
import { parsePlanningDayStatusValue, resolvePlanningDutyDateKey, resolveLoadDaySegment, isPlanningWhoStructuralPlaceholder, resolvePlanningCustomWhoCandidate, resolvePlanningCustomWhoHydration, resolveStoredPlanningCustomWho, sanitizePlanningWhoDisplayValue, getCalendarColorClasses, injectCalendarColorIntoDutyDescription, parseCalendarColorFromDescription, type LoadDaySegment, type PlanningDayStatusEntry, } from '@/lib/planning-display';
import { createTmsApi, type DriverPlanningRow, type DriverRecord, type LoadRecord, type TruckRecord } from '@/lib/tms-api';
function normalizeLoadStatus(status?: string | null): string {
    return (status || '').trim().toUpperCase().replace(/[\s-]+/g, '_');
}
function isUnassignedLoad(load: {
    truck_id?: number | null;
    status?: string;
}, fleetTrucks: TruckRecord[]): boolean {
    const status = normalizeLoadStatus(load.status);
    if (!load.truck_id)
        return true;
    if (status === 'UNASSIGNED' || status === 'AVAILABLE' || status === 'CREATED' || status === 'BOOKED')
        return true;
    const truck = fleetTrucks.find((t) => t.id === load.truck_id);
    return !truck?.driver_id;
}
function toPlanningDateKey(value: string | null | undefined): string | null {
    return normalizePlanningDateKey(value);
}
function normalizePlanningDateKey(value: string | null | undefined): string | null {
    if (!value)
        return null;
    const trimmed = value.trim();
    if (!trimmed)
        return null;
    const isoPrefix = trimmed.match(/^(\d{4}-\d{2}-\d{2})/);
    if (isoPrefix)
        return isoPrefix[1];
    const slashMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (slashMatch) {
        const [, month, day, year] = slashMatch;
        return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    }
    const parsed = new Date(trimmed);
    if (Number.isNaN(parsed.getTime()))
        return null;
    return toInputDate(parsed);
}
function isPlanningDutyEntityId(value: string | null | undefined): boolean {
    const trimmed = value?.trim() ?? '';
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(trimmed);
}
function resolvePlanningDutyBaseDateKey(rawKey: string): string | null {
    const baseSegment = rawKey.split('::')[0]?.trim() ?? '';
    return normalizePlanningDateKey(baseSegment);
}
function sanitizePlanningTransportDateKey(value: string | null | undefined): string {
    const baseSegment = value?.split('::')[0]?.trim() ?? '';
    return normalizePlanningDateKey(baseSegment) ?? baseSegment;
}
function mapDutyStatusToEventStatus(dutyStatus: string): string {
    if (dutyStatus === 'maintenance')
        return 'maintenance';
    if (dutyStatus === 'off_duty')
        return 'on_hold';
    if (dutyStatus === 'layover')
        return 'empty';
    if (dutyStatus === 'external_dispatch')
        return 'open';
    return 'open';
}
function resolveCalendarStatusId(dutyEntry: PlanningDayStatusEntry, statuses: PlanningCustomStatus[]): string {
    const embedded = parseCalendarStatusFromDescription(dutyEntry.description);
    if (embedded.statusId) {
        const match = findPlanningCustomStatus(statuses, embedded.statusId);
        if (match)
            return match.id;
        return embedded.statusId;
    }
    const fallback = mapDutyStatusToEventStatus(dutyEntry.status);
    const match = findPlanningCustomStatus(statuses, fallback);
    return match?.id ?? fallback;
}
function resolveCalendarStatusPresentation(calendarStatusId: string, statuses: PlanningCustomStatus[]): PlanningCustomStatus {
    const match = findPlanningCustomStatus(statuses, calendarStatusId);
    if (match)
        return match;
    return {
        id: calendarStatusId,
        name: calendarStatusId.replace(/_/g, ' '),
        bgClass: 'bg-zinc-700 text-white',
    };
}
function loadOverlapsNormalizedDay(load: PlanningScheduleLoad, dayKey: string): boolean {
    const pickupKey = normalizePlanningDateKey(load.pickup_date);
    const deliveryKey = normalizePlanningDateKey(load.delivery_date);
    if (pickupKey === dayKey || deliveryKey === dayKey)
        return true;
    if (pickupKey && deliveryKey && pickupKey <= dayKey && deliveryKey >= dayKey)
        return true;
    return false;
}
function mapLoadStatusToEventStatus(status: string): PlanningEventStatus {
    const normalized = status.trim().toLowerCase().replace(/_/g, ' ');
    if (normalized.includes('maintenance'))
        return 'maintenance';
    if (normalized.includes('hold'))
        return 'on_hold';
    if (normalized.includes('created') ||
        normalized.includes('unassigned') ||
        normalized.includes('booked') ||
        normalized.includes('available')) {
        return 'empty';
    }
    if (normalized.includes('dispatched') ||
        normalized.includes('delivered') ||
        normalized.includes('assigned') ||
        normalized.includes('loaded') ||
        normalized.includes('transit') ||
        normalized.includes('settled')) {
        return 'covered';
    }
    return 'open';
}
function formatPlanningAssignedUnit(row: DriverPlanningRow): string {
    const segments = [
        row.truck_number ? `#${row.truck_number}` : null,
        row.driver_name,
        row.phone_number || null,
    ].filter((segment): segment is string => Boolean(segment));
    return segments.join(' - ');
}
function formatPlanningAssignedUnitValue(row: DriverPlanningRow): string {
    return `${row.truck_number || 'unassigned'}::${row.id}`;
}
function buildPlanningEventFromScheduleLoad(load: PlanningScheduleLoad, row: DriverPlanningRow, dayKey: string, brokerLoadId?: string | number | null): PlanningEvent {
    const segment = resolveLoadDaySegment(load, dayKey, brokerLoadId);
    const pickupKey = toPlanningDateKey(load.pickup_date) ?? dayKey;
    const deliveryKey = toPlanningDateKey(load.delivery_date) ?? dayKey;
    const titleSource = segment.segmentLabel === 'Delivery'
        ? load.destination.split(',')[0]?.trim()
        : load.origin.split(',')[0]?.trim();
    return {
        id: load.id,
        title: (titleSource || segment.loadLabel.replace(/^#/, '')).toUpperCase(),
        start_date: pickupKey,
        end_date: deliveryKey,
        is_all_day: true,
        repeats: false,
        status: mapLoadStatusToEventStatus(load.status),
        assigned_unit: formatPlanningAssignedUnitValue(row),
        unit_code: formatPlanningAssignedUnit(row),
        driver_id: row.id,
        unit_id: row.truck_number || null,
        location: segment.segmentLabel === 'Delivery' ? load.destination : load.origin,
        description: `${segment.loadLabel} · ${segment.segmentLabel}\n${load.origin} → ${load.destination}`,
        branding_color: row.planning_color ?? null,
    };
}
function mapEventStatusToDutyStatus(status: string): PlanningDayDutyStatus {
    if (status === 'maintenance')
        return 'maintenance';
    if (status === 'on_hold')
        return 'off_duty';
    if (status === 'empty')
        return 'layover';
    if (status === 'covered' || status === 'open')
        return 'external_dispatch';
    return 'external_dispatch';
}
interface PlanningAgendaLoadEntry {
    kind: 'load';
    id: string;
    dayKey: string;
    load: PlanningScheduleLoad;
    row: DriverPlanningRow;
    segment: LoadDaySegment;
    calendarStatusId: string;
    brandingColor: string | null;
}
interface PlanningAgendaDutyEntry {
    kind: 'duty';
    id: string;
    dayKey: string;
    storageDateKey: string;
    row: DriverPlanningRow;
    dutyEntry: PlanningDayStatusEntry;
    calendarStatusId: string;
    eventTitle: string;
    customWho: string;
    statusLabel: string;
    statusBgClass: string;
    assignedDriver: string;
    destination: string;
    brandingColor: string | null;
}
type PlanningAgendaEntry = PlanningAgendaLoadEntry | PlanningAgendaDutyEntry;
function rowHasGenuineAssignedDriver(row: DriverPlanningRow): boolean {
    const driverName = row.driver_name?.trim() ?? '';
    if (!driverName || isPlanningWhoStructuralPlaceholder(driverName))
        return false;
    if (!row.truck_number) {
        const lower = driverName.toLowerCase();
        if (lower.includes('unassigned') || lower.includes('empty'))
            return false;
    }
    return true;
}
function buildPlanningEventFromDutyEntry(row: DriverPlanningRow, dayKey: string, dutyEntry: PlanningDayStatusEntry, calendarStatusId: string, storageDateKey: string): PlanningEvent {
    const embedded = parseCalendarDutyPayload(dutyEntry.description);
    const statusDef = resolveCalendarStatusPresentation(calendarStatusId, PLANNING_DEFAULT_CUSTOM_STATUSES);
    const whoContext = {
        location: dutyEntry.location,
        rowDriverName: row.driver_name,
    };
    const customWho = resolveStoredPlanningCustomWho(embedded, whoContext);
    const eventTitle = (embedded.title?.trim() && embedded.title.trim() !== customWho ? embedded.title.trim() : null) ||
        dutyEntry.location?.trim() ||
        embedded.body ||
        statusDef.name;
    const hasAssignedDriver = rowHasGenuineAssignedDriver(row);
    return {
        title: eventTitle.toUpperCase(),
        start_date: dayKey,
        end_date: dayKey,
        is_all_day: true,
        repeats: false,
        status: calendarStatusId,
        assigned_unit: customWho
            ? formatPlanningCustomAssignedUnit(customWho)
            : hasAssignedDriver
                ? formatPlanningAssignedUnitValue(row)
                : '',
        unit_code: customWho ?? (hasAssignedDriver ? formatPlanningAssignedUnit(row) : undefined),
        driver_id: customWho ? undefined : hasAssignedDriver ? row.id : undefined,
        custom_driver_name: customWho,
        unit_id: row.truck_number || null,
        location: dutyEntry.location?.trim() || '',
        description: embedded.body,
        rcUrl: dutyEntry.rc_url ?? null,
        rcFileName: dutyEntry.rc_file_name ?? null,
        branding_color: row.planning_color ?? null,
        duty_storage_date_key: dutyEntry.id ?? storageDateKey,
    };
}
function formatAgendaDateLabel(date: Date): string {
    return date.toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
    });
}
function resolveAgendaEntryColorClasses(entry: PlanningAgendaEntry) {
    if (entry.kind === 'duty') {
        const explicitColor = parseCalendarColorFromDescription(entry.dutyEntry.description);
        return getCalendarColorClasses(entry.calendarStatusId, entry.statusBgClass, entry.statusLabel, explicitColor);
    }
    const matchedStatus = findPlanningCustomStatus(PLANNING_DEFAULT_CUSTOM_STATUSES, entry.calendarStatusId);
    return getCalendarColorClasses(entry.calendarStatusId, matchedStatus?.bgClass ?? null, entry.segment.segmentLabel, null);
}
function resolveDutyStatusBgClass(description: string | null | undefined, fallbackBgClass: string): string {
    const embeddedColor = parseCalendarColorFromDescription(description);
    if (!embeddedColor)
        return fallbackBgClass;
    return `bg-${embeddedColor}-500 text-white`;
}
function extractColorNameFromBgClass(bgClass: string | null | undefined): string | null {
    if (!bgClass?.trim())
        return null;
    const match = bgClass.toLowerCase().match(/bg-([a-z]+)-/);
    if (!match)
        return null;
    return match[1];
}
function sanitizePlanningStatusDisplayLabel(value: string): string {
    const trimmed = value.trim();
    if (!trimmed)
        return trimmed;
    return trimmed.replace(/-\d+$/, '').replace(/_/g, ' ');
}
function formatDutyAgendaAccentParts(entry: PlanningAgendaDutyEntry): string[] {
    return [
        entry.eventTitle,
        entry.customWho,
        sanitizePlanningStatusDisplayLabel(entry.statusLabel),
    ].filter((part) => part.trim().length > 0);
}
function formatDutyAgendaMetaLine(entry: PlanningAgendaDutyEntry): string {
    return [entry.assignedDriver, entry.destination]
        .filter((part) => part.trim().length > 0)
        .join(' — ');
}
function resolveAgendaLocationLabel(load: PlanningScheduleLoad, segment: LoadDaySegment): string {
    if (segment.segmentLabel === 'Delivery') {
        return load.destination;
    }
    if (segment.segmentLabel === 'Pickup') {
        return load.origin;
    }
    return segment.routeLabel || load.origin;
}
function resolveDriverIdFromAssignedUnit(assignedUnit: string): number | null {
    const match = assignedUnit.match(/::(\d+)$/);
    if (!match)
        return null;
    const id = Number.parseInt(match[1], 10);
    return Number.isFinite(id) ? id : null;
}
function resolveDriverIdFromPlanningPayload(assignedUnit: string, rows: DriverPlanningRow[], unitOptions: Array<{
    value: string;
    label: string;
}>, fallbackDriverId?: number | null): number | null {
    const fromContext = fallbackDriverId ?? null;
    if (fromContext != null)
        return fromContext;
    const fromValue = resolveDriverIdFromAssignedUnit(assignedUnit);
    if (fromValue != null)
        return fromValue;
    const matchedOption = unitOptions.find((option) => option.value === assignedUnit || option.label === assignedUnit);
    if (matchedOption) {
        const fromOption = resolveDriverIdFromAssignedUnit(matchedOption.value);
        if (fromOption != null)
            return fromOption;
    }
    for (const row of rows) {
        if (formatPlanningAssignedUnit(row) === assignedUnit ||
            formatPlanningAssignedUnitValue(row) === assignedUnit) {
            return row.id;
        }
    }
    return null;
}
const DriverDetailModal = dynamic(() => import('@/components/modals/DriverDetailModal'), { ssr: false });
const TruckDetailModal = dynamic(() => import('@/components/modals/TruckDetailModal'), { ssr: false });
const PlanningEventModal = dynamic(() => import('@/components/modals/PlanningEventModal'), {
    ssr: false,
});
function planningIncludedStorageKey(userId: number | null): string {
    return userId != null
        ? `fleety_planning_selected_drivers_${userId}`
        : 'fleety_planning_selected_drivers';
}
function legacyPlanningIncludedStorageKeys(userId: number | null): string[] {
    const keys = ['fleety_planning_selected_drivers', 'planning_board_included'];
    if (userId != null) {
        keys.push(`fleety_planning_selected_drivers_${userId}`);
        keys.push(`planning_board_included_${userId}`);
    }
    return keys;
}
function writeIncludedDriverIds(userId: number | null, ids: Set<number>): void {
    if (typeof window === 'undefined')
        return;
    try {
        localStorage.setItem(planningIncludedStorageKey(userId), JSON.stringify([...ids]));
    }
    catch {
        return;
    }
}
function readIncludedDriverIds(userId: number | null): Set<number> {
    if (typeof window === 'undefined')
        return new Set();
    const primaryKey = planningIncludedStorageKey(userId);
    try {
        const primaryRaw = localStorage.getItem(primaryKey);
        if (primaryRaw) {
            const primaryParsed: unknown = JSON.parse(primaryRaw);
            if (Array.isArray(primaryParsed)) {
                return new Set(primaryParsed.filter((id): id is number => typeof id === 'number'));
            }
        }
    }
    catch {
        return new Set();
    }
    for (const legacyKey of legacyPlanningIncludedStorageKeys(userId)) {
        if (legacyKey === primaryKey)
            continue;
        try {
            const raw = localStorage.getItem(legacyKey);
            if (!raw)
                continue;
            const parsed: unknown = JSON.parse(raw);
            if (!Array.isArray(parsed))
                continue;
            const ids = new Set(parsed.filter((id): id is number => typeof id === 'number'));
            if (ids.size > 0) {
                writeIncludedDriverIds(userId, ids);
                return ids;
            }
        }
        catch {
            continue;
        }
    }
    return new Set();
}
interface FleetSearchEntry {
    driverId: number;
    driverName: string;
    unitNumber: string | null;
    truckId: number | null;
}
interface PlanningBoardProps {
    token: string;
    trucks: TruckRecord[];
    drivers: DriverRecord[];
    loads: LoadRecord[];
    windowStart: string;
    windowEnd: string;
    onWindowChange: (start: string, end: string) => void;
    onRefresh: () => void | Promise<void>;
}
function resolveEffectiveEndDate(startKey: string, selectedEnd: string): string {
    if (!selectedEnd || selectedEnd < startKey)
        return startKey;
    return selectedEnd;
}
function openDatePicker(event: React.MouseEvent<HTMLInputElement>) {
    event.stopPropagation();
    const input = event.currentTarget;
    if (typeof input.showPicker === 'function') {
        try {
            input.showPicker();
        }
        catch {
            return;
        }
    }
}
export default function PlanningBoard({ token, trucks, drivers, loads, windowStart, windowEnd, onWindowChange, onRefresh, }: PlanningBoardProps) {
    const api = useMemo(() => createTmsApi(createApiClient(token)), [token]);
    const currentUserId = useMemo(() => getUserId(token), [token]);
    const [rows, setRows] = useState<DriverPlanningRow[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [showFleetMenu, setShowFleetMenu] = useState(false);
    const [driverSearchQuery, setDriverSearchQuery] = useState('');
    const [includedDriverIds, setIncludedDriverIds] = useState<Set<number>>(() => new Set());
    const [includedStorageReady, setIncludedStorageReady] = useState(false);
    const [selectedDriverProfileId, setSelectedDriverProfileId] = useState<number | null>(null);
    const [selectedTruckProfileId, setSelectedTruckProfileId] = useState<number | null>(null);
    const [assigningContext, setAssigningContext] = useState<{
        driverId: number;
        driverName: string;
        dateStr: string;
        mode?: 'assign' | 'clear';
        existingLoadId?: number | null;
        existingDutyStatus?: string | null;
    } | null>(null);
    const [endDate, setEndDate] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [modalTab, setModalTab] = useState<'load' | 'status'>('load');
    const [dutyLocation, setDutyLocation] = useState('');
    const [dutyDescription, setDutyDescription] = useState('');
    const [isEventModalOpen, setIsEventModalOpen] = useState(false);
    const [selectedEventData, setSelectedEventData] = useState<PlanningEvent | null>(null);
    const [selectedEventDriverId, setSelectedEventDriverId] = useState<number | null>(null);
    const [eventCreateContext, setEventCreateContext] = useState<{
        driverId?: number;
        driverName?: string;
        dateStr: string;
    } | null>(null);
    const fleetMenuRef = useRef<HTMLDivElement>(null);
    const [mounted, setMounted] = useState(false);
    useEffect(() => {
        setMounted(true);
        return () => setMounted(false);
    }, []);
    const visibleWeekStart = useMemo(() => getMondayStart(parseLocalDate(windowStart)), [windowStart]);
    const weekDays = useMemo(() => buildWeekDays(visibleWeekStart), [visibleWeekStart]);
    const viewDateKeys = useMemo(() => weekDays.map((day) => toInputDate(day)), [weekDays]);
    const shiftVisibleWeek = useCallback((deltaWeeks: number) => {
        const nextMonday = shiftWeekStart(visibleWeekStart, deltaWeeks);
        const sunday = new Date(nextMonday);
        sunday.setDate(nextMonday.getDate() + 6);
        onWindowChange(toInputDate(nextMonday), toInputDate(sunday));
    }, [onWindowChange, visibleWeekStart]);
    const goToThisWeek = useCallback(() => {
        const week = getPlanningWeekWindow();
        onWindowChange(week.start, week.end);
    }, [onWindowChange]);
    const unassignedLoads = useMemo(() => loads.filter((load) => isUnassignedLoad(load, trucks)), [loads, trucks]);
    const fetchBoard = useCallback(async () => {
        if (!token)
            return;
        setLoading(true);
        setError(null);
        try {
            const data = await api.fleet.planningBoard({
                start_date: windowStart,
                end_date: windowEnd,
            });
            setRows(data);
        }
        catch (err: unknown) {
            const message = err && typeof err === 'object' && 'response' in err
                ? (err as {
                    response?: {
                        data?: {
                            detail?: string;
                        };
                    };
                }).response?.data?.detail
                : null;
            setError(typeof message === 'string' ? message : 'Failed to load planning timeline.');
            setRows([]);
        }
        finally {
            setLoading(false);
        }
    }, [api, token, windowStart, windowEnd]);
    useEffect(() => {
        void fetchBoard();
    }, [fetchBoard]);
    useLayoutEffect(() => {
        setIncludedDriverIds(readIncludedDriverIds(currentUserId));
        setIncludedStorageReady(true);
    }, [currentUserId]);
    useEffect(() => {
        if (!includedStorageReady)
            return;
        writeIncludedDriverIds(currentUserId, includedDriverIds);
    }, [includedDriverIds, currentUserId, includedStorageReady]);
    useEffect(() => {
        if (!showFleetMenu)
            return;
        const handlePointerDown = (event: MouseEvent) => {
            const target = event.target as Node;
            if (fleetMenuRef.current?.contains(target))
                return;
            setShowFleetMenu(false);
        };
        document.addEventListener('mousedown', handlePointerDown);
        return () => document.removeEventListener('mousedown', handlePointerDown);
    }, [showFleetMenu]);
    const displayedRows = useMemo(() => {
        const sorted = [...rows].sort((a, b) => a.driver_name.localeCompare(b.driver_name));
        return sorted.filter((row) => includedDriverIds.has(row.id) || rowHasPlanningWindowContext(row, weekDays));
    }, [rows, includedDriverIds, weekDays]);
    const fleetSearchDrivers = useMemo((): FleetSearchEntry[] => {
        const sorted = [...drivers].sort((a, b) => a.driver_name.localeCompare(b.driver_name));
        return sorted.map((driver) => {
            const truck = trucks.find((t) => t.driver_id === driver.id);
            const row = rows.find((r) => r.id === driver.id);
            const unitNumber = truck?.truck_number ?? row?.truck_number ?? null;
            const truckId = truck?.id ?? row?.truck_id ?? null;
            return {
                driverId: driver.id,
                driverName: driver.driver_name,
                unitNumber,
                truckId,
            };
        });
    }, [drivers, trucks, rows]);
    const filteredFleetDrivers = useMemo(() => {
        const query = driverSearchQuery.trim().toLowerCase();
        if (!query)
            return fleetSearchDrivers;
        return fleetSearchDrivers.filter((entry) => entry.driverName.toLowerCase().includes(query) ||
            (entry.unitNumber?.toLowerCase().includes(query) ?? false));
    }, [fleetSearchDrivers, driverSearchQuery]);
    const isDriverIncluded = useCallback((driverId: number) => includedDriverIds.has(driverId), [includedDriverIds]);
    const rowDayGrid = useMemo(() => buildPlanningRowDayGrid(displayedRows, weekDays), [displayedRows, weekDays]);
    const rowDayStatusGrid = useMemo(() => buildPlanningRowDayStatusGrid(displayedRows), [displayedRows]);
    const loadDisplayIds = useMemo(() => {
        const map = new Map<number, string | number>();
        for (const load of loads) {
            map.set(load.id, load.broker_load_id ?? load.id);
        }
        for (const row of displayedRows) {
            for (const load of row.schedule_loads ?? []) {
                if (!map.has(load.id)) {
                    map.set(load.id, load.broker_load_id ?? load.id);
                }
            }
        }
        return map;
    }, [displayedRows, loads]);
    const planningUnitOptions = useMemo(() => displayedRows.map((row) => ({
        value: `${row.truck_number || 'unassigned'}::${row.id}`,
        label: `${row.driver_name}${row.truck_number ? ` · Unit #${row.truck_number}` : ' · Unassigned'}`,
    })), [displayedRows]);
    const agendaByDay = useMemo(() => {
        const map = new Map<string, PlanningAgendaEntry[]>();
        for (const day of weekDays) {
            map.set(toInputDate(day), []);
        }
        for (const row of displayedRows) {
            for (const day of weekDays) {
                const dayKey = toInputDate(day);
                const entries = map.get(dayKey) ?? [];
                for (const load of row.schedule_loads ?? []) {
                    if (!loadOverlapsNormalizedDay(load, dayKey))
                        continue;
                    const segment = resolveLoadDaySegment(load, dayKey, loadDisplayIds.get(load.id));
                    entries.push({
                        kind: 'load',
                        id: `load-${load.id}-${dayKey}-${row.id}`,
                        dayKey,
                        load,
                        row,
                        segment,
                        calendarStatusId: mapLoadStatusToEventStatus(load.status),
                        brandingColor: row.planning_color ?? null,
                    });
                }
                if (row.day_statuses) {
                    for (const [dutyKey, rawValue] of Object.entries(row.day_statuses)) {
                        const dutyEntry = parsePlanningDayStatusValue(rawValue);
                        if (!dutyEntry)
                            continue;
                        const statusDateKey = resolvePlanningDutyDateKey(dutyKey, dutyEntry) ??
                            resolvePlanningDutyBaseDateKey(dutyKey);
                        if (statusDateKey !== dayKey)
                            continue;
                        const storageKey = dutyEntry.id ?? dutyKey;
                        const calendarStatusId = resolveCalendarStatusId(dutyEntry, PLANNING_DEFAULT_CUSTOM_STATUSES);
                        const statusDef = resolveCalendarStatusPresentation(calendarStatusId, PLANNING_DEFAULT_CUSTOM_STATUSES);
                        const embedded = parseCalendarDutyPayload(dutyEntry.description);
                        const whoContext = {
                            location: dutyEntry.location,
                            rowDriverName: row.driver_name,
                        };
                        const customWho = embedded.who ||
                            resolveStoredPlanningCustomWho(embedded, whoContext) ||
                            '';
                        const eventTitle = (embedded.title?.trim() && embedded.title.trim() !== customWho
                            ? embedded.title.trim()
                            : null) ||
                            dutyEntry.location?.trim() ||
                            embedded.body ||
                            statusDef.name;
                        const destination = dutyEntry.location?.trim() || row.driver_name;
                        const statusBgClass = resolveDutyStatusBgClass(dutyEntry.description, statusDef.bgClass);
                        entries.push({
                            kind: 'duty',
                            id: `duty-${row.id}-${storageKey}`,
                            dayKey,
                            storageDateKey: storageKey,
                            row,
                            dutyEntry,
                            calendarStatusId,
                            eventTitle,
                            customWho,
                            statusLabel: statusDef.name,
                            statusBgClass,
                            assignedDriver: row.driver_name,
                            destination,
                            brandingColor: row.planning_color ?? null,
                        });
                    }
                }
                map.set(dayKey, entries);
            }
        }
        for (const entries of map.values()) {
            entries.sort((a, b) => a.row.driver_name.localeCompare(b.row.driver_name));
        }
        return map;
    }, [displayedRows, weekDays, loadDisplayIds]);
    useEffect(() => {
        if (!assigningContext) {
            setDutyLocation('');
            setDutyDescription('');
            return;
        }
        const entry = rowDayStatusGrid[assigningContext.driverId]?.[assigningContext.dateStr]?.[0];
        setDutyLocation(entry?.location ?? '');
        setDutyDescription(entry?.description ?? '');
    }, [assigningContext, rowDayStatusGrid]);
    const selectedTruck = useMemo(() => selectedTruckProfileId != null
        ? trucks.find((truck) => truck.id === selectedTruckProfileId) ?? null
        : null, [selectedTruckProfileId, trucks]);
    const toggleDriverInclusion = useCallback((entry: FleetSearchEntry) => {
        setIncludedDriverIds((prev) => {
            const next = new Set(prev);
            if (next.has(entry.driverId)) {
                next.delete(entry.driverId);
            }
            else {
                next.add(entry.driverId);
            }
            writeIncludedDriverIds(currentUserId, next);
            return next;
        });
        setDriverSearchQuery('');
    }, [currentUserId]);
    const openDriverProfile = (driverId: number) => {
        setSelectedTruckProfileId(null);
        setSelectedDriverProfileId(driverId);
    };
    const openTruckProfile = (truckId: number) => {
        setSelectedDriverProfileId(null);
        setSelectedTruckProfileId(truckId);
    };
    const closeProfileDrawer = () => {
        setSelectedDriverProfileId(null);
        setSelectedTruckProfileId(null);
    };
    const profileDrawerOpen = selectedDriverProfileId !== null || selectedTruckProfileId !== null;
    const clearDriverDateRange = useCallback(async (driverId: number, startKey: string, endKey: string) => {
        if (isSubmitting)
            return;
        const effectiveEnd = resolveEffectiveEndDate(startKey, endKey);
        const dateKeys = buildPlanningDateRangeToEnd(startKey, effectiveEnd);
        const loadIds = new Set<number>();
        for (const dateKey of dateKeys) {
            const dayLoads = rowDayGrid[driverId]?.[dateKey] ?? [];
            for (const load of dayLoads) {
                loadIds.add(load.id);
            }
        }
        try {
            setIsSubmitting(true);
            for (const loadId of loadIds) {
                await api.loads.patch(loadId, { truck_id: null, status: 'created' });
            }
            for (const dateKey of dateKeys) {
                const transportDateKey = sanitizePlanningTransportDateKey(dateKey);
                if (!transportDateKey)
                    continue;
                if ((rowDayStatusGrid[driverId]?.[dateKey]?.length ?? 0) > 0) {
                    await api.fleet.clearDriverDayStatus(driverId, transportDateKey);
                }
            }
            await onRefresh();
            await fetchBoard();
        }
        catch (err) {
            console.error(err);
            setError(formatApiError(err, 'Failed to clear planning range.'));
        }
        finally {
            setIsSubmitting(false);
        }
    }, [api, fetchBoard, isSubmitting, onRefresh, rowDayGrid, rowDayStatusGrid]);
    const openClearRangePlanner = useCallback((driverId: number, driverName: string) => {
        setEndDate(windowEnd || viewDateKeys[viewDateKeys.length - 1] || '');
        setAssigningContext({
            driverId,
            driverName,
            dateStr: windowStart || viewDateKeys[0] || '',
            mode: 'clear',
        });
    }, [viewDateKeys, windowEnd, windowStart]);
    const handleClearCustomRange = useCallback(async () => {
        if (!assigningContext || assigningContext.mode !== 'clear')
            return;
        const effectiveEnd = resolveEffectiveEndDate(assigningContext.dateStr, endDate);
        await clearDriverDateRange(assigningContext.driverId, assigningContext.dateStr, effectiveEnd);
        setAssigningContext(null);
    }, [assigningContext, clearDriverDateRange, endDate]);
    const planningDateKeys = useMemo(() => {
        if (!assigningContext)
            return [];
        const effectiveEnd = resolveEffectiveEndDate(assigningContext.dateStr, endDate);
        return buildPlanningDateRangeToEnd(assigningContext.dateStr, effectiveEnd);
    }, [assigningContext, endDate]);
    const handleAssignLoad = useCallback(async (loadId: number) => {
        if (isSubmitting || !assigningContext)
            return;
        const planningRow = displayedRows.find((row) => row.id === assigningContext.driverId);
        if (!planningRow?.truck_id) {
            setError('Assign a truck to this driver before scheduling loads.');
            return;
        }
        const effectiveEnd = resolveEffectiveEndDate(assigningContext.dateStr, endDate);
        try {
            setIsSubmitting(true);
            await api.fleet.assignPlanningLoad(assigningContext.driverId, {
                load_id: loadId,
                start_date: assigningContext.dateStr,
                end_date: effectiveEnd,
            });
            await onRefresh();
            await fetchBoard();
            setAssigningContext(null);
        }
        catch (err) {
            console.error(err);
            setError(formatApiError(err, 'Failed to assign load.'));
        }
        finally {
            setIsSubmitting(false);
        }
    }, [api, assigningContext, endDate, fetchBoard, displayedRows, isSubmitting, onRefresh]);
    const handleSetDutyStatus = useCallback(async (statusValue: PlanningDayDutyStatus) => {
        if (isSubmitting || !assigningContext)
            return;
        try {
            setIsSubmitting(true);
            for (const date of planningDateKeys) {
                const transportDateKey = sanitizePlanningTransportDateKey(date);
                if (!transportDateKey)
                    continue;
                await api.fleet.setDriverDayStatus(assigningContext.driverId, {
                    date: transportDateKey,
                    status: statusValue,
                    location: dutyLocation.trim() || null,
                    description: dutyDescription.trim() || null,
                });
            }
            await onRefresh();
            await fetchBoard();
            setAssigningContext(null);
        }
        catch (err) {
            console.error(err);
            setError(formatApiError(err, 'Failed to set duty status.'));
        }
        finally {
            setIsSubmitting(false);
        }
    }, [api, assigningContext, dutyDescription, dutyLocation, fetchBoard, isSubmitting, onRefresh, planningDateKeys]);
    const handleClearModalAssignment = useCallback(async () => {
        if (isSubmitting || !assigningContext)
            return;
        const loadsForStartDay = rowDayGrid[assigningContext.driverId]?.[assigningContext.dateStr] ?? [];
        const loadIds = new Set<number>();
        for (const load of loadsForStartDay) {
            loadIds.add(load.id);
        }
        if (assigningContext.existingLoadId) {
            loadIds.add(assigningContext.existingLoadId);
        }
        try {
            setIsSubmitting(true);
            for (const loadId of loadIds) {
                await api.loads.patch(loadId, { truck_id: null, status: 'created' });
            }
            for (const date of planningDateKeys) {
                const transportDateKey = sanitizePlanningTransportDateKey(date);
                if (!transportDateKey)
                    continue;
                if ((rowDayStatusGrid[assigningContext.driverId]?.[date]?.length ?? 0) > 0) {
                    await api.fleet.clearDriverDayStatus(assigningContext.driverId, transportDateKey);
                }
            }
            await onRefresh();
            await fetchBoard();
            setAssigningContext(null);
        }
        catch (err) {
            console.error(err);
            setError(formatApiError(err, 'Failed to clear assignment.'));
        }
        finally {
            setIsSubmitting(false);
        }
    }, [
        api,
        assigningContext,
        fetchBoard,
        isSubmitting,
        onRefresh,
        rowDayGrid,
        rowDayStatusGrid,
        planningDateKeys,
    ]);
    const openDayPlanner = useCallback((driverId: number, driverName: string, dateStr: string, tab: 'load' | 'status' = 'load', existing?: {
        loadId?: number | null;
        dutyStatus?: string | null;
    }) => {
        setModalTab(tab);
        setEndDate(dateStr);
        setAssigningContext({
            driverId,
            driverName,
            dateStr,
            mode: 'assign',
            existingLoadId: existing?.loadId ?? null,
            existingDutyStatus: existing?.dutyStatus ?? null,
        });
    }, []);
    const openCreatePlanningEvent = useCallback((driverId: number, driverName: string, dateStr: string) => {
        setSelectedEventDriverId(driverId);
        setEventCreateContext({ driverId, driverName, dateStr });
        setSelectedEventData(null);
        setIsEventModalOpen(true);
    }, []);
    const openCreatePlanningEventForDate = useCallback((dateStr: string) => {
        const defaultRow = displayedRows[0];
        if (defaultRow) {
            openCreatePlanningEvent(defaultRow.id, defaultRow.driver_name, dateStr);
            return;
        }
        setEventCreateContext({ dateStr });
        setSelectedEventDriverId(null);
        setSelectedEventData(null);
        setIsEventModalOpen(true);
    }, [displayedRows, openCreatePlanningEvent]);
    const openHeaderCreatePlanningEvent = useCallback(() => {
        const todayKey = toInputDate(new Date());
        const dateStr = viewDateKeys.includes(todayKey)
            ? todayKey
            : viewDateKeys[0] ?? todayKey;
        openCreatePlanningEventForDate(dateStr);
    }, [openCreatePlanningEventForDate, viewDateKeys]);
    const openEditPlanningEvent = useCallback((entry: PlanningAgendaEntry) => {
        setEventCreateContext(null);
        setSelectedEventDriverId(entry.row.id);
        if (entry.kind === 'load') {
            setSelectedEventData(buildPlanningEventFromScheduleLoad(entry.load, entry.row, entry.dayKey, loadDisplayIds.get(entry.load.id)));
        }
        else {
            setSelectedEventData(buildPlanningEventFromDutyEntry(entry.row, entry.dayKey, entry.dutyEntry, entry.calendarStatusId, entry.storageDateKey));
        }
        setIsEventModalOpen(true);
    }, [loadDisplayIds]);
    const handleSavePlanningEvent = useCallback(async (payload: PlanningEventFormInput) => {
        const safeDisplayedRows = displayedRows ?? [];
        try {
            const loadId = selectedEventData?.id != null ? Number(selectedEventData.id) : Number.NaN;
            const isFreightLoad = Number.isFinite(loadId);
            if (isFreightLoad) {
                await api.loads.patch(loadId, {
                    comments: payload.description.trim() || null,
                });
            }
            else if (eventCreateContext || selectedEventData) {
                const customDriverName = resolvePlanningCustomWhoHydration(payload.custom_driver_name) ||
                    resolvePlanningCustomWhoHydration(parsePlanningCustomAssignedUnit(payload.assigned_unit));
                const selectedRow = selectedEventDriverId != null
                    ? safeDisplayedRows.find((row) => row.id === selectedEventDriverId) ?? null
                    : null;
                const matchedOption = planningUnitOptions.find((option) => option.value === payload.assigned_unit || option.label === payload.assigned_unit);
                const unitPayload = payload.assigned_unit ||
                    matchedOption?.value ||
                    (selectedRow ? formatPlanningAssignedUnitValue(selectedRow) : '') ||
                    (selectedRow ? formatPlanningAssignedUnit(selectedRow) : '') ||
                    'Unassigned';
                const anchorDriverId = eventCreateContext?.driverId ??
                    selectedEventDriverId ??
                    selectedEventData?.driver_id ??
                    null;
                const driverId = customDriverName
                    ? anchorDriverId
                    : payload.driver_id ??
                        resolveDriverIdFromPlanningPayload(unitPayload, safeDisplayedRows, planningUnitOptions, anchorDriverId);
                if (!driverId) {
                    setError('Select an assigned unit before saving.');
                    return;
                }
                const dutyStatus = mapEventStatusToDutyStatus(payload.status);
                const startKey = normalizePlanningDateKey(payload.start_date) ?? payload.start_date;
                const endKey = normalizePlanningDateKey(payload.end_date) ?? startKey;
                const dateKeys = buildPlanningDateRangeToEnd(startKey, endKey) ?? [];
                const location = payload.location.trim() || null;
                const persistedColor = parseCalendarColorFromDescription(payload.description) ||
                    extractColorNameFromBgClass(payload.status_bg_class) ||
                    extractColorNameFromBgClass(findPlanningCustomStatus(PLANNING_DEFAULT_CUSTOM_STATUSES, payload.status)?.bgClass);
                const description = injectCalendarColorIntoDutyDescription(embedCalendarDutyPayload(payload.status, payload.title.trim(), payload.description, customDriverName), persistedColor);
                const existingDutyId = selectedEventData?.duty_storage_date_key?.trim();
                const preserveDutyId = isPlanningDutyEntityId(existingDutyId) ? existingDutyId : null;
                for (let index = 0; index < dateKeys.length; index += 1) {
                    const dateKey = dateKeys[index];
                    try {
                        const transportDateKey = sanitizePlanningTransportDateKey(dateKey);
                        if (!transportDateKey)
                            continue;
                        await api.fleet.setDriverDayStatus(driverId, {
                            ...(preserveDutyId && index === 0 ? { id: preserveDutyId } : {}),
                            date: transportDateKey,
                            status: dutyStatus,
                            location,
                            description,
                            rc_url: payload.rcUrl?.trim() || null,
                            rc_file_name: payload.rcFileName?.trim() || null,
                        });
                    }
                    catch (loopError) {
                        console.error('Failed to save planning duty event for date', dateKey, loopError);
                        setError(formatApiError(loopError));
                        throw loopError;
                    }
                }
            }
            await onRefresh();
            await fetchBoard();
            setIsEventModalOpen(false);
            setEventCreateContext(null);
            setSelectedEventDriverId(null);
        }
        catch (error) {
            console.error('Failed to save planning event', error);
            setError(formatApiError(error));
            throw error;
        }
    }, [
        api,
        displayedRows,
        eventCreateContext,
        fetchBoard,
        onRefresh,
        planningUnitOptions,
        selectedEventData,
        selectedEventDriverId,
    ]);
    const handleDeletePlanningEvent = useCallback(async () => {
        const loadId = selectedEventData?.id != null ? Number(selectedEventData.id) : Number.NaN;
        if (Number.isFinite(loadId)) {
            await api.loads.patch(loadId, { truck_id: null, status: 'created' });
        }
        else {
            const driverId = selectedEventDriverId ??
                eventCreateContext?.driverId ??
                selectedEventData?.driver_id ??
                null;
            const dutyKey = selectedEventData?.duty_storage_date_key?.trim();
            if (driverId != null && dutyKey) {
                await api.fleet.clearDriverDayStatus(driverId, dutyKey);
            }
        }
        await onRefresh();
        await fetchBoard();
        setIsEventModalOpen(false);
        setEventCreateContext(null);
        setSelectedEventDriverId(null);
    }, [
        api,
        eventCreateContext,
        fetchBoard,
        onRefresh,
        selectedEventData,
        selectedEventDriverId,
    ]);
    const modalHasActiveAssignment = useMemo(() => {
        if (!assigningContext)
            return false;
        const loadsForDay = rowDayGrid[assigningContext.driverId]?.[assigningContext.dateStr] ?? [];
        const duty = rowDayStatusGrid[assigningContext.driverId]?.[assigningContext.dateStr]?.[0];
        return (loadsForDay.length > 0 ||
            Boolean(duty) ||
            Boolean(assigningContext.existingLoadId) ||
            Boolean(assigningContext.existingDutyStatus));
    }, [assigningContext, rowDayGrid, rowDayStatusGrid]);
    const showPlanningAgenda = includedStorageReady && !loading && displayedRows.length > 0;
    const showPlanningEmpty = includedStorageReady && !loading && displayedRows.length === 0;
    const showPlanningLoading = loading || !includedStorageReady;
    const isClearRangeModal = assigningContext?.mode === 'clear';
    return (<div className="space-y-6 animate-in fade-in duration-200">
      <div className="flex flex-wrap items-center justify-end gap-2 mb-6">
          <button type="button" onClick={openHeaderCreatePlanningEvent} className="bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-2 text-sm font-semibold hover:bg-zinc-100 dark:hover:bg-zinc-800/80 transition-all flex items-center gap-2 text-zinc-700 dark:text-zinc-200 shadow-sm">
            <Plus size={16} aria-hidden/>
            Add Event
          </button>
          <div className="relative" ref={fleetMenuRef}>
            <button type="button" onClick={() => setShowFleetMenu((open) => !open)} className="bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-2 text-sm font-semibold hover:bg-zinc-100 dark:hover:bg-zinc-800/80 transition-all flex items-center gap-2 text-zinc-700 dark:text-zinc-200 shadow-sm">
              <Truck size={16} aria-hidden/>
              Manage My Fleet
            </button>

            {showFleetMenu ? (<div className="absolute right-0 mt-2 w-72 z-[60] rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#161616] shadow-xl overflow-hidden">
                <div className="p-2 border-b border-zinc-200 dark:border-zinc-800 sticky top-0 bg-white dark:bg-[#161616] z-10">
                  <div className="relative">
                    <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" aria-hidden/>
                    <input type="text" value={driverSearchQuery} onChange={(e) => setDriverSearchQuery(e.target.value)} placeholder="Search driver or unit..." className="w-full bg-zinc-50 dark:bg-zinc-900 text-xs text-zinc-700 dark:text-zinc-200 pl-8 pr-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 focus:outline-none focus:border-zinc-400 dark:focus:border-zinc-700 focus:ring-1 focus:ring-zinc-400 dark:focus:ring-zinc-700"/>
                  </div>
                </div>
                <div className="max-h-64 overflow-y-auto p-1">
                  {fleetSearchDrivers.length === 0 ? (<p className="text-xs text-zinc-500 px-2 py-3">No drivers available.</p>) : filteredFleetDrivers.length === 0 ? (<p className="text-xs text-zinc-500 px-2 py-3">No drivers found.</p>) : (filteredFleetDrivers.map((entry) => {
                const included = isDriverIncluded(entry.driverId);
                return (<button key={entry.driverId} type="button" onClick={() => toggleDriverInclusion(entry)} className="w-full flex items-center justify-between gap-2 px-2 py-2 rounded-md hover:bg-zinc-100/70 dark:hover:bg-zinc-800/40 text-left">
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-zinc-700 dark:text-zinc-200 truncate">
                              {entry.driverName}
                            </p>
                            {entry.unitNumber ? (<p className="text-xs text-zinc-500">#{entry.unitNumber}</p>) : null}
                          </div>
                          {included ? (<Check size={16} className="text-emerald-500 shrink-0" aria-hidden/>) : (<Plus size={16} className="text-zinc-500 shrink-0" aria-hidden/>)}
                        </button>);
            }))}
                </div>
              </div>) : null}
          </div>

          <div className="flex items-center gap-1 bg-zinc-100 dark:bg-zinc-900 rounded-lg p-1">
            <button type="button" onClick={() => shiftVisibleWeek(-1)} className="p-1.5 rounded-md hover:bg-white dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-400" aria-label="Previous week">
              <ChevronLeft size={16}/>
            </button>
            <button type="button" onClick={goToThisWeek} className="px-3 py-1.5 text-xs font-semibold rounded-md hover:bg-white dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-200">
              This Week
            </button>
            <button type="button" onClick={() => shiftVisibleWeek(1)} className="p-1.5 rounded-md hover:bg-white dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-400" aria-label="Next week">
              <ChevronRight size={16}/>
            </button>
          </div>
      </div>

      {error ? (<div className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-700 dark:text-rose-400">
          {error}
        </div>) : null}

      {unassignedLoads.length > 0 ? (<div className="flex flex-wrap gap-2 p-3 bg-zinc-50 dark:bg-zinc-900/40 border border-zinc-200 dark:border-zinc-800 rounded-xl" data-testid="unassigned-loads-rail">
          {unassignedLoads.map((load) => (<div key={load.id} data-testid={`unassigned-load-${load.id}`} className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-[#161616] px-3 py-2 text-xs shadow-sm">
              <span className="font-bold text-zinc-900 dark:text-white">
                Load #{load.broker_load_id || load.id}
              </span>
              <span className="block text-zinc-500 truncate max-w-[180px]">
                {load.origin} → {load.destination}
              </span>
            </div>))}
        </div>) : null}

      <div className="w-full min-h-0 flex-1 bg-white dark:bg-[#161616] border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-sm px-4 pb-4">
        {showPlanningLoading ? (<div className="flex items-center justify-center gap-2 p-12 text-sm text-zinc-500 dark:text-zinc-400">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden/>
            Loading planning timeline...
          </div>) : showPlanningEmpty ? (<div className="p-12 text-center text-sm text-zinc-500 dark:text-zinc-400">
            No drivers on your board. Open <strong>Manage My Fleet</strong> to search and add drivers.
          </div>) : showPlanningAgenda ? (<div className="w-full h-full flex flex-col gap-6 overflow-y-auto pt-0 relative custom-scrollbar max-h-[calc(100vh-16rem)]">
            {weekDays.map((day) => {
                const dayKey = toInputDate(day);
                const entries = agendaByDay.get(dayKey) ?? [];
                return (<section key={dayKey}>
                  <div className="sticky top-0 bg-zinc-100 dark:bg-[#161616] z-10 w-full py-2.5 flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 mb-3">
                    <span className="text-sm font-semibold font-sans tracking-tight">
                      {formatAgendaDateLabel(day)}
                    </span>
                  </div>
                  {entries.length > 0 ? (<div className="flex flex-col gap-2">
                      {entries.map((entry) => {
                            const colors = resolveAgendaEntryColorClasses(entry);
                            return (<button key={entry.id} type="button" onClick={() => openEditPlanningEvent(entry)} className={`group w-full cursor-pointer rounded-xl p-3.5 flex items-center justify-between transition-opacity hover:opacity-90 border-l-4 ${colors.border} ${colors.bg}`}>
                          <div className="flex min-w-0 flex-1 items-center">
                            <span className={`shrink-0 text-xs font-bold font-mono tracking-wide ${colors.text}`}>
                              {entry.kind === 'load' ? (`${entry.segment.loadLabel} · ${entry.segment.segmentLabel}`) : (<>
                                  {formatDutyAgendaAccentParts(entry).map((part, index) => (<span key={`${entry.id}-accent-${index}`}>
                                      {index > 0 ? ' · ' : null}
                                      {index === 0 ? (<span className="font-extrabold">{part}</span>) : (part)}
                                    </span>))}
                                </>)}
                            </span>
                            <span className="ml-3 truncate text-xs font-medium text-zinc-600 dark:text-zinc-300">
                              {entry.kind === 'load'
                                    ? `${entry.row.driver_name} — ${resolveAgendaLocationLabel(entry.load, entry.segment)}`
                                    : formatDutyAgendaMetaLine(entry)}
                            </span>
                          </div>
                        </button>);
                        })}
                    </div>) : null}
                </section>);
            })}
          </div>) : null}
      </div>

      {mounted && assigningContext
            ? createPortal(<div className="fixed inset-0 z-[9999] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="assign-load-title">
              <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => {
                    if (!isSubmitting)
                        setAssigningContext(null);
                }} aria-hidden/>
              <div className="relative z-10 bg-white dark:bg-[#161616] border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-2xl max-w-md w-full p-6 animate-in fade-in zoom-in-95 duration-150">
                <div className="flex items-center justify-between mb-4">
                  <h3 id="assign-load-title" className="text-lg font-bold text-zinc-900 dark:text-white">
                    {isClearRangeModal ? 'Clear Planning Range' : 'Day Planner'}
                  </h3>
                  <button type="button" disabled={isSubmitting} onClick={() => setAssigningContext(null)} className="text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 text-sm disabled:opacity-50 disabled:cursor-not-allowed">
                    Cancel
                  </button>
                </div>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-3">
                  {assigningContext.driverName}
                  {isClearRangeModal
                    ? null
                    : ` · ${assigningContext.dateStr}`}
                </p>

                {isClearRangeModal ? (<>
                    <div className="mb-4 space-y-3">
                      <div>
                        <span className="block text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1.5">
                          START DATE
                        </span>
                        <div className="flex items-center gap-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 px-3 py-2 shadow-sm">
                          <Calendar className="w-4 h-4 text-zinc-400 shrink-0" aria-hidden/>
                          <input type="date" value={assigningContext.dateStr} max={endDate || assigningContext.dateStr} disabled={isSubmitting} onChange={(event) => {
                        const next = event.target.value;
                        setAssigningContext((prev) => prev ? { ...prev, dateStr: next } : prev);
                        setEndDate((prev) => resolveEffectiveEndDate(next, prev || next));
                    }} onClick={openDatePicker} className="w-full bg-transparent text-sm font-medium text-zinc-900 dark:text-zinc-100 outline-none cursor-pointer [color-scheme:dark] [&::-webkit-calendar-picker-indicator]:opacity-60" aria-label="Start date"/>
                        </div>
                      </div>
                      <div>
                        <span className="block text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1.5">
                          END DATE
                        </span>
                        <div className="flex items-center gap-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 px-3 py-2 shadow-sm">
                          <Calendar className="w-4 h-4 text-zinc-400 shrink-0" aria-hidden/>
                          <input type="date" value={endDate || assigningContext.dateStr} min={assigningContext.dateStr} disabled={isSubmitting} onChange={(event) => {
                        const next = event.target.value;
                        setEndDate(resolveEffectiveEndDate(assigningContext.dateStr, next));
                    }} onClick={openDatePicker} className="w-full bg-transparent text-sm font-medium text-zinc-900 dark:text-zinc-100 outline-none cursor-pointer [color-scheme:dark] [&::-webkit-calendar-picker-indicator]:opacity-60" aria-label="End date"/>
                        </div>
                      </div>
                    </div>
                    <button type="button" disabled={isSubmitting} onClick={() => void handleClearCustomRange()} className="w-full rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-500/15 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2">
                      {isSubmitting ? (<>
                          <Loader2 className="h-4 w-4 animate-spin" aria-hidden/>
                          Clearing...
                        </>) : (<>
                          <Trash2 size={16} aria-hidden/>
                          Clear Range
                        </>)}
                    </button>
                  </>) : (<>
                <div className="mb-4">
                  <span className="block text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1.5">
                    END DATE
                  </span>
                  <div className="flex items-center gap-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 px-3 py-2 shadow-sm">
                    <Calendar className="w-4 h-4 text-zinc-400 shrink-0" aria-hidden/>
                    <input type="date" value={endDate || assigningContext.dateStr} min={assigningContext.dateStr} disabled={isSubmitting} onChange={(event) => {
                        const next = event.target.value;
                        setEndDate(resolveEffectiveEndDate(assigningContext.dateStr, next));
                    }} onClick={openDatePicker} className="w-full bg-transparent text-sm font-medium text-zinc-900 dark:text-zinc-100 outline-none cursor-pointer [color-scheme:dark] [&::-webkit-calendar-picker-indicator]:opacity-60" aria-label="End date"/>
                  </div>
                </div>

                <div className="mb-4 flex rounded-xl bg-zinc-100 dark:bg-zinc-900 p-1 gap-1">
                  <button type="button" disabled={isSubmitting} onClick={() => setModalTab('load')} className={`flex-1 rounded-lg px-3 py-2 text-xs font-semibold transition-colors ${modalTab === 'load'
                        ? 'bg-white dark:bg-[#161616] text-zinc-900 dark:text-white shadow-sm'
                        : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200'}`}>
                    Assign Freight
                  </button>
                  <button type="button" disabled={isSubmitting} onClick={() => setModalTab('status')} className={`flex-1 rounded-lg px-3 py-2 text-xs font-semibold transition-colors ${modalTab === 'status'
                        ? 'bg-white dark:bg-[#161616] text-zinc-900 dark:text-white shadow-sm'
                        : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200'}`}>
                    Set Duty Status
                  </button>
                </div>

                {modalTab === 'load' ? (<div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                    {unassignedLoads.length > 0 ? (unassignedLoads.map((load) => (<div key={load.id} className="p-3 border border-zinc-200 dark:border-zinc-800 rounded-xl bg-zinc-50 dark:bg-zinc-900/50 flex justify-between items-center text-sm gap-3">
                          <div className="min-w-0">
                            <span className="font-bold text-zinc-900 dark:text-white">
                              Load #{load.broker_load_id || load.id}
                            </span>
                            <span className="block text-xs text-zinc-500 truncate">
                              {load.origin} → {load.destination}
                            </span>
                          </div>
                          <button type="button" disabled={isSubmitting} onClick={async (e) => {
                                e.stopPropagation();
                                await handleAssignLoad(load.id);
                            }} className={`shrink-0 px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded-lg disabled:opacity-50 disabled:cursor-not-allowed ${isSubmitting ? 'opacity-50 cursor-not-allowed' : ''}`}>
                            {isSubmitting ? 'Assigning...' : 'Assign'}
                          </button>
                        </div>))) : (<p className="text-sm text-zinc-500 dark:text-zinc-400 text-center py-4">
                        No unassigned loads currently available.
                      </p>)}
                  </div>) : (<>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {PLANNING_DAY_DUTY_OPTIONS.map((option) => (<button key={option.value} type="button" disabled={isSubmitting} onClick={() => void handleSetDutyStatus(option.value)} className={`rounded-xl border px-3 py-3 text-left text-sm font-semibold text-zinc-900 dark:text-zinc-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${option.panelClass}`}>
                          {option.label}
                        </button>))}
                    </div>
                    <div className="mt-4 space-y-3">
                      <div>
                        <label htmlFor="duty-location" className="block text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1.5">
                          Where / Custom Location
                        </label>
                        <input id="duty-location" type="text" value={dutyLocation} maxLength={120} disabled={isSubmitting} onChange={(event) => setDutyLocation(event.target.value)} placeholder="Warehouse yard, shop bay, rest area..." className="w-full rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 outline-none focus:border-sky-500/60"/>
                      </div>
                      <div>
                        <label htmlFor="duty-description" className="block text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1.5">
                          Description / Custom Notes
                        </label>
                        <textarea id="duty-description" value={dutyDescription} maxLength={500} rows={3} disabled={isSubmitting} onChange={(event) => setDutyDescription(event.target.value)} placeholder="Operational notes for this duty block..." className="w-full rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 outline-none focus:border-sky-500/60 resize-y min-h-[72px]"/>
                      </div>
                    </div>
                  </>)}

                {modalHasActiveAssignment ? (<button type="button" disabled={isSubmitting} onClick={() => void handleClearModalAssignment()} className="mt-4 w-full rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-500/15 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                    Remove Assignment / Clear Status
                  </button>) : null}
                  </>)}
              </div>
            </div>, document.body)
            : null}

      {profileDrawerOpen ? (<ProfileDrawerShell open onClose={closeProfileDrawer}>
          {selectedDriverProfileId ? (<DriverDetailModal bare token={token} driverId={selectedDriverProfileId} trucks={trucks} onClose={closeProfileDrawer} onOpenTruck={openTruckProfile} onProfileUpdated={async () => {
                    await onRefresh();
                    await fetchBoard();
                }}/>) : selectedTruck ? (<TruckDetailModal bare token={token} truck={selectedTruck} drivers={drivers} trucks={trucks} onClose={closeProfileDrawer} onOpenDriver={openDriverProfile} onSuccess={async () => {
                    await onRefresh();
                    await fetchBoard();
                }}/>) : null}
        </ProfileDrawerShell>) : null}

      <PlanningEventModal isOpen={isEventModalOpen} onClose={() => {
            setIsEventModalOpen(false);
            setEventCreateContext(null);
            setSelectedEventDriverId(null);
        }} eventData={selectedEventData} createDateKey={!selectedEventData ? eventCreateContext?.dateStr : undefined} unitOptions={planningUnitOptions} onSave={handleSavePlanningEvent} onDelete={handleDeletePlanningEvent}/>
    </div>);
}
