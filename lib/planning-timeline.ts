import type { DriverPlanningRow } from '@/lib/tms-api';
import { parsePlanningDayStatusValue, resolvePlanningDutyDateKey, type PlanningDayStatusEntry, } from '@/lib/planning-display';
export type { PlanningDayStatusEntry };
export type PlanningAvailability = 'empty' | 'in_transit' | 'oos';
export interface PlanningScheduleLoad {
    id: number;
    broker_load_id?: string | null;
    origin: string;
    destination: string;
    status: string;
    pickup_date?: string | null;
    delivery_date?: string | null;
}
function toLocalDateKey(value: string | null | undefined): string | null {
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
export function getMondayStart(date: Date): Date {
    const monday = new Date(date);
    const diff = (monday.getDay() + 6) % 7;
    monday.setDate(monday.getDate() - diff);
    monday.setHours(0, 0, 0, 0);
    return monday;
}
export function parseLocalDate(iso: string): Date {
    const [year, month, day] = iso.split('-').map(Number);
    return new Date(year, month - 1, day);
}
export function getPlanningWeekWindow(anchor = new Date()): {
    start: string;
    end: string;
} {
    const monday = getMondayStart(anchor);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    return { start: toInputDate(monday), end: toInputDate(sunday) };
}
export function buildWeekDays(weekStart: Date): Date[] {
    return Array.from({ length: 7 }, (_, index) => {
        const day = new Date(weekStart);
        day.setDate(weekStart.getDate() + index);
        return day;
    });
}
export function formatWeekDayLabel(date: Date): string {
    return date.toLocaleDateString(undefined, { weekday: 'short', month: 'numeric', day: 'numeric' });
}
export function toInputDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}
export function shiftWeekStart(weekStart: Date, deltaWeeks: number): Date {
    const next = new Date(weekStart);
    next.setDate(next.getDate() + deltaWeeks * 7);
    return next;
}
export function addDaysToDateKey(dateKey: string, days: number): string {
    const date = parseLocalDate(dateKey);
    date.setDate(date.getDate() + days);
    return toInputDate(date);
}
export function resolvePlanningEndDate(startKey: string, spanDays: number): string {
    const safeSpan = Math.max(1, Math.floor(spanDays));
    return addDaysToDateKey(startKey, safeSpan - 1);
}
export function buildPlanningDateRange(startKey: string, spanDays: number): string[] {
    const safeSpan = Math.max(1, Math.floor(spanDays));
    return Array.from({ length: safeSpan }, (_, index) => addDaysToDateKey(startKey, index));
}
export function buildPlanningDateRangeToEnd(startKey: string, endKey: string): string[] {
    const start = parseLocalDate(startKey);
    const end = parseLocalDate(endKey);
    if (end < start) {
        return [startKey];
    }
    const keys: string[] = [];
    const cursor = new Date(start);
    while (cursor <= end) {
        keys.push(toInputDate(cursor));
        cursor.setDate(cursor.getDate() + 1);
    }
    return keys;
}
const IN_TRANSIT_STATUSES = new Set(['assigned', 'dispatched', 'delayed']);
export function resolvePlanningAvailability(row: DriverPlanningRow, now = new Date()): PlanningAvailability {
    if (row.status === 'INACTIVE')
        return 'oos';
    const activeLoad = row.schedule_loads?.find((load) => load.id === row.active_load_id);
    const activeStatus = (activeLoad?.status || '').toLowerCase();
    if (row.active_load_id && IN_TRANSIT_STATUSES.has(activeStatus)) {
        return 'in_transit';
    }
    if (row.delivery_date) {
        const delivery = new Date(row.delivery_date);
        if (!Number.isNaN(delivery.getTime()) && delivery < now) {
            return 'empty';
        }
    }
    if (row.active_load_id) {
        return 'in_transit';
    }
    return 'empty';
}
export function loadOverlapsDay(load: PlanningScheduleLoad, day: Date): boolean {
    const dayKey = toInputDate(day);
    const pickupKey = toLocalDateKey(load.pickup_date);
    const deliveryKey = toLocalDateKey(load.delivery_date);
    if (pickupKey === dayKey || deliveryKey === dayKey)
        return true;
    if (pickupKey && deliveryKey && pickupKey <= dayKey && deliveryKey >= dayKey)
        return true;
    return false;
}
export function loadsForDay(loads: PlanningScheduleLoad[] | undefined, day: Date): PlanningScheduleLoad[] {
    if (!loads?.length)
        return [];
    return loads.filter((load) => loadOverlapsDay(load, day));
}
export function buildPlanningRowDayGrid(rows: DriverPlanningRow[], weekDays: Date[]): Record<number, Record<string, PlanningScheduleLoad[]>> {
    const grid: Record<number, Record<string, PlanningScheduleLoad[]>> = {};
    for (const row of rows) {
        const dayMap: Record<string, PlanningScheduleLoad[]> = {};
        for (const day of weekDays) {
            dayMap[toInputDate(day)] = loadsForDay(row.schedule_loads, day);
        }
        grid[row.id] = dayMap;
    }
    return grid;
}
export function buildPlanningRowDayStatusGrid(rows: Array<{
    id: number;
    day_statuses?: Record<string, string | PlanningDayStatusEntry>;
}>): Record<number, Record<string, PlanningDayStatusEntry[]>> {
    const grid: Record<number, Record<string, PlanningDayStatusEntry[]>> = {};
    for (const row of rows) {
        const dayMap: Record<string, PlanningDayStatusEntry[]> = {};
        if (row.day_statuses) {
            for (const [dutyKey, value] of Object.entries(row.day_statuses)) {
                const parsed = parsePlanningDayStatusValue(value);
                if (!parsed)
                    continue;
                const dateKey = resolvePlanningDutyDateKey(dutyKey, parsed);
                if (!dateKey)
                    continue;
                if (!dayMap[dateKey])
                    dayMap[dateKey] = [];
                dayMap[dateKey].push(parsed);
            }
        }
        grid[row.id] = dayMap;
    }
    return grid;
}
export function rowHasPlanningWindowContext(row: {
    schedule_loads?: PlanningScheduleLoad[];
    day_statuses?: Record<string, string | PlanningDayStatusEntry>;
}, weekDays: Date[]): boolean {
    if (row.schedule_loads?.length) {
        for (const day of weekDays) {
            if (loadsForDay(row.schedule_loads, day).length > 0)
                return true;
        }
    }
    if (row.day_statuses) {
        const windowDateKeys = new Set(weekDays.map(toInputDate));
        for (const [dutyKey, value] of Object.entries(row.day_statuses)) {
            const parsed = parsePlanningDayStatusValue(value);
            if (!parsed)
                continue;
            const dateKey = resolvePlanningDutyDateKey(dutyKey, parsed);
            if (dateKey && windowDateKeys.has(dateKey))
                return true;
        }
    }
    return false;
}
export function formatUnitLabel(truckNumber?: string | null): string {
    const cleaned = truckNumber?.trim();
    if (!cleaned || cleaned === '—' || cleaned === '-')
        return '';
    return cleaned.startsWith('#') ? cleaned : `#${cleaned}`;
}
