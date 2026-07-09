import type { TruckPerformanceMetrics, TruckRecord } from '@/lib/tms-api';
const METRIC_FIELD_ALIASES = {
    grossRevenue: ['gross_revenue', 'Gross Revenue', 'grossRevenue', 'revenue'],
    totalMiles: ['total_miles', 'Total Miles', 'totalMiles', 'telemetry_miles', 'miles'],
    avgMpg: ['avg_mpg', 'Avg MPG', 'avgMpg', 'mpg', 'average_mpg'],
    fuelSpent: ['fuel_spent', 'Fuel Spent', 'fuelSpent', 'fuel_cost', 'total_fuel'],
    maintenanceFees: [
        'maintenance_costs',
        'maintenance_cost',
        'Maintenance Costs',
        'maintenanceFees',
        'work_orders',
        'work_order_total',
        'repair_costs',
    ],
} as const;
function parseNumeric(value: unknown): number | null {
    if (typeof value === 'number' && Number.isFinite(value))
        return value;
    if (typeof value === 'string') {
        const parsed = Number.parseFloat(value.replace(/[$,\s]/g, ''));
        if (Number.isFinite(parsed))
            return parsed;
    }
    return null;
}
function readMetricValue(metrics: TruckPerformanceMetrics | undefined, customFields: Record<string, string> | undefined, aliases: readonly string[]): number {
    for (const key of aliases) {
        const fromMetrics = metrics?.[key as keyof TruckPerformanceMetrics];
        const parsedMetric = parseNumeric(fromMetrics);
        if (parsedMetric != null)
            return parsedMetric;
        const fromCustom = customFields?.[key];
        const parsedCustom = parseNumeric(fromCustom);
        if (parsedCustom != null)
            return parsedCustom;
    }
    return 0;
}
export interface UnitFinancialMetrics {
    grossRevenue: number;
    totalMiles: number;
    avgMpg: number;
    fuelSpent: number;
    maintenanceFees: number;
}
export function extractUnitFinancials(truck: TruckRecord): UnitFinancialMetrics {
    const metrics = truck.performance_metrics;
    const customFields = truck.custom_fields;
    return {
        grossRevenue: readMetricValue(metrics, customFields, METRIC_FIELD_ALIASES.grossRevenue),
        totalMiles: readMetricValue(metrics, customFields, METRIC_FIELD_ALIASES.totalMiles),
        avgMpg: readMetricValue(metrics, customFields, METRIC_FIELD_ALIASES.avgMpg),
        fuelSpent: readMetricValue(metrics, customFields, METRIC_FIELD_ALIASES.fuelSpent),
        maintenanceFees: readMetricValue(metrics, customFields, METRIC_FIELD_ALIASES.maintenanceFees),
    };
}
export function computeFleetRpm(grossRevenue: number, miles: number): number {
    return miles === 0 ? 0 : grossRevenue / miles;
}
export function formatCurrency(value: number): string {
    return value.toLocaleString(undefined, {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });
}
export function formatRpm(revenue: number, miles: number): string {
    if (miles <= 0)
        return '$0.00/mi';
    return `${formatCurrency(revenue / miles)}/mi`;
}
export function toIsoDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}
export function formatUsDate(iso: string): string {
    if (!iso)
        return '';
    const [year, month, day] = iso.split('-');
    if (!year || !month || !day)
        return '';
    return `${month}/${day}/${year}`;
}
export type FleetWindowPreset = 'mtd' | 'ytd' | 'all' | 'custom';
export type LoadManagementDatePreset = 'mtd' | 'ytd' | 'all' | 'custom';
export const FLEET_WINDOW_PRESETS: {
    id: Exclude<FleetWindowPreset, 'all'>;
    label: string;
}[] = [
    { id: 'mtd', label: 'Month to Date' },
    { id: 'ytd', label: 'Year to Date' },
    { id: 'custom', label: 'Custom' },
];
export const FLEET_FINANCIALS_WINDOW_PRESETS: {
    id: FleetWindowPreset;
    label: string;
}[] = [
    { id: 'mtd', label: 'Month to Date' },
    { id: 'ytd', label: 'Year to Date' },
    { id: 'all', label: 'All Time' },
    { id: 'custom', label: 'Custom' },
];
export const LOAD_MANAGEMENT_DATE_PRESETS: {
    id: LoadManagementDatePreset;
    label: string;
}[] = [
    { id: 'mtd', label: 'Month to Date' },
    { id: 'ytd', label: 'Year to Date' },
    { id: 'all', label: 'All Time' },
    { id: 'custom', label: 'Custom' },
];
export function getPresetRange(preset: Exclude<FleetWindowPreset, 'custom' | 'all'>): {
    start: string;
    end: string;
} {
    const end = new Date();
    const start = new Date(end);
    if (preset === 'ytd') {
        start.setMonth(0, 1);
        start.setHours(0, 0, 0, 0);
    }
    else {
        start.setDate(1);
    }
    return { start: toIsoDate(start), end: toIsoDate(end) };
}
export function detectFleetWindowPreset(start: string, end: string): FleetWindowPreset {
    if (!start && !end)
        return 'all';
    for (const preset of ['mtd', 'ytd'] as const) {
        const range = getPresetRange(preset);
        if (range.start === start && range.end === end)
            return preset;
    }
    return 'custom';
}
export function detectLoadManagementDatePreset(start: string, end: string): LoadManagementDatePreset {
    if (!start && !end)
        return 'all';
    for (const preset of ['mtd', 'ytd'] as const) {
        const range = getPresetRange(preset);
        if (range.start === start && range.end === end)
            return preset;
    }
    return 'custom';
}
export function loadActivityDate(load: {
    pickup_date?: string | null;
    created_at?: string;
}): string {
    return (load.pickup_date || load.created_at || '').slice(0, 10);
}
export function isLoadInWindow(load: {
    pickup_date?: string | null;
    created_at?: string;
}, windowStart: string, windowEnd: string): boolean {
    if (!windowStart && !windowEnd)
        return true;
    const activityDate = loadActivityDate(load);
    if (!activityDate)
        return false;
    if (windowStart && activityDate < windowStart)
        return false;
    if (windowEnd && activityDate > windowEnd)
        return false;
    return true;
}
export function loadGrossRevenue(load: {
    linehaul_rate?: number;
    fuel_surcharge?: number;
    accessorial_charge?: number;
}): number {
    return (load.linehaul_rate ?? 0) + (load.fuel_surcharge ?? 0) + (load.accessorial_charge ?? 0);
}
export function loadTotalMiles(load: {
    total_miles?: number;
    miles_traveled?: number;
}): number {
    return load.total_miles ?? load.miles_traveled ?? 0;
}
