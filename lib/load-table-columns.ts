import type { LoadRecord } from '@/lib/tms-api';
import { formatLoadDateLabel, getFallbackDate, matchesLoadDateHorizonFilters, resolveLoadDeliveryDateFilterKey, resolveLoadPickupDateFilterKey, } from '@/lib/load-dates';
import { computeLoadGrossRate, computeLoadTotalRpm } from '@/lib/load-financials';
import { formatManifestLocationLine, parseLocationFromAddress, resolveManifestStops, } from '@/lib/load-manifest-stops';
import { resolveLoadDisplayUiStatus, SETTLED_UI_STATUS } from '@/lib/load-operational-status';
export type LoadTableColumnId = 'loadId' | 'broker' | 'route' | 'pickupDate' | 'deliveryDate' | 'rate' | 'rpm' | 'status' | 'driver' | 'truck' | 'trailer' | 'actions';
export const LOAD_TABLE_STATUS_FILTER_OPTIONS = [
    'UNASSIGNED',
    'BOOKED',
    'ASSIGNED',
    'IN_TRANSIT',
    'DELIVERED',
    'DELAYED',
    SETTLED_UI_STATUS,
] as const;
export type LoadTableSortDirection = 'asc' | 'desc';
export type LoadTableColumnFilters = Record<Exclude<LoadTableColumnId, 'actions'>, string>;
export const EMPTY_LOAD_TABLE_FILTERS = (): LoadTableColumnFilters => ({
    loadId: '',
    broker: '',
    route: '',
    pickupDate: '',
    deliveryDate: '',
    rate: '',
    rpm: '',
    status: '',
    driver: '',
    truck: '',
    trailer: '',
});
export interface LoadTableRowContext {
    trucks: Array<{
        id: number;
        truck_number?: string | null;
        driver_id?: number | null;
        driver_name?: string | null;
        trailer_number?: string | null;
        asset_type?: string | null;
    }>;
    drivers: Array<{
        id: number;
        driver_name?: string | null;
    }>;
    customers: Array<{
        id: number;
        name: string;
    }>;
}
export function buildDefaultLoadTableColumnOrder(canViewOperationalFinancials: boolean): LoadTableColumnId[] {
    const columns: LoadTableColumnId[] = [
        'loadId',
        'broker',
        'route',
        'pickupDate',
        'deliveryDate',
    ];
    if (canViewOperationalFinancials) {
        columns.push('rate', 'rpm');
    }
    columns.push('status', 'driver', 'truck', 'trailer', 'actions');
    return columns;
}
export const LOAD_TABLE_COLUMN_LABELS: Record<LoadTableColumnId, string> = {
    loadId: 'Load ID',
    broker: 'Broker',
    route: 'Pickup → Delivery',
    pickupDate: 'Pickup Date',
    deliveryDate: 'Delivery Date',
    rate: 'Rate',
    rpm: 'RPM',
    status: 'Status',
    driver: 'Driver',
    truck: 'Truck',
    trailer: 'Trailer',
    actions: 'Actions',
};
function resolveDriverName(load: LoadRecord, truck: LoadTableRowContext['trucks'][number] | undefined, drivers: LoadTableRowContext['drivers']) {
    const driverId = load.driver_id ?? truck?.driver_id ?? null;
    const driver = driverId ? drivers.find((row) => row.id === driverId) : null;
    return (load.driver_name?.trim() ||
        driver?.driver_name?.trim() ||
        truck?.driver_name?.trim() ||
        '');
}
function resolveTruckLabel(load: LoadRecord, truck: LoadTableRowContext['trucks'][number] | undefined) {
    return truck?.truck_number?.trim() || load.truck_number?.trim() || '';
}
function resolveTrailerLabel(load: LoadRecord, truck: LoadTableRowContext['trucks'][number] | undefined) {
    return truck?.trailer_number?.trim() || load.trailer_number?.trim() || '';
}
function resolveBrokerLabel(load: LoadRecord, customers: LoadTableRowContext['customers']) {
    const broker = customers.find((row) => row.id === load.customer_id);
    return broker?.name || load.broker_name || '';
}
function resolveRouteLabel(load: LoadRecord) {
    const manifestStops = resolveManifestStops(load);
    const originStop = manifestStops[0];
    const terminalStop = manifestStops[manifestStops.length - 1];
    const origin = originStop?.locationLine ||
        formatManifestLocationLine(parseLocationFromAddress(load.origin).city, parseLocationFromAddress(load.origin).state);
    const destination = terminalStop?.locationLine ||
        formatManifestLocationLine(parseLocationFromAddress(load.destination).city, parseLocationFromAddress(load.destination).state);
    return `${origin} ${destination} ${load.origin || ''} ${load.destination || ''}`.trim();
}
export function getLoadTableSortValue(load: LoadRecord, columnId: LoadTableColumnId, ctx: LoadTableRowContext): string | number {
    const truck = ctx.trucks.find((row) => row.id === load.truck_id);
    switch (columnId) {
        case 'loadId':
            return load.broker_load_id || String(load.id);
        case 'broker':
            return resolveBrokerLabel(load, ctx.customers).toLowerCase();
        case 'route':
            return resolveRouteLabel(load).toLowerCase();
        case 'pickupDate':
            return (formatLoadDateLabel(getFallbackDate(load, 'pickup')) ||
                formatLoadDateLabel(load.created_at) ||
                '');
        case 'deliveryDate':
            return formatLoadDateLabel(getFallbackDate(load, 'delivery')) || '';
        case 'rate':
            return computeLoadGrossRate(load);
        case 'rpm':
            return computeLoadTotalRpm(load);
        case 'status':
            return resolveLoadDisplayUiStatus(load).toLowerCase();
        case 'driver':
            return resolveDriverName(load, truck, ctx.drivers).toLowerCase();
        case 'truck':
            return resolveTruckLabel(load, truck).toLowerCase();
        case 'trailer':
            return resolveTrailerLabel(load, truck).toLowerCase();
        default:
            return '';
    }
}
export function matchesLoadTableFilters(load: LoadRecord, filters: LoadTableColumnFilters, ctx: LoadTableRowContext): boolean {
    const truck = ctx.trucks.find((row) => row.id === load.truck_id);
    const textMatch = (haystack: string, needle: string) => {
        const query = needle.trim().toLowerCase();
        if (!query)
            return true;
        return haystack.toLowerCase().includes(query);
    };
    if (!textMatch(`${load.broker_load_id || ''} L-${load.id} ${load.id}`, filters.loadId)) {
        return false;
    }
    if (!textMatch(resolveBrokerLabel(load, ctx.customers), filters.broker))
        return false;
    if (!textMatch(resolveRouteLabel(load), filters.route))
        return false;
    if (!matchesLoadDateHorizonFilters(resolveLoadPickupDateFilterKey(load), resolveLoadDeliveryDateFilterKey(load), filters.pickupDate, filters.deliveryDate)) {
        return false;
    }
    if (!textMatch(computeLoadGrossRate(load).toFixed(2), filters.rate))
        return false;
    if (!textMatch(computeLoadTotalRpm(load).toFixed(2), filters.rpm))
        return false;
    const statusFilter = filters.status.trim();
    if (statusFilter && resolveLoadDisplayUiStatus(load) !== statusFilter) {
        return false;
    }
    if (!textMatch(resolveDriverName(load, truck, ctx.drivers), filters.driver))
        return false;
    if (!textMatch(resolveTruckLabel(load, truck), filters.truck))
        return false;
    if (!textMatch(resolveTrailerLabel(load, truck), filters.trailer))
        return false;
    return true;
}
export function sortLoadTableRows(loads: LoadRecord[], columnId: LoadTableColumnId | null, direction: LoadTableSortDirection, ctx: LoadTableRowContext): LoadRecord[] {
    if (!columnId || columnId === 'actions')
        return loads;
    const sorted = [...loads];
    sorted.sort((left, right) => {
        const a = getLoadTableSortValue(left, columnId, ctx);
        const b = getLoadTableSortValue(right, columnId, ctx);
        let result = 0;
        if (typeof a === 'number' && typeof b === 'number') {
            result = a - b;
        }
        else {
            result = String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' });
        }
        return direction === 'asc' ? result : -result;
    });
    return sorted;
}
export function resolveVisibleLoadTableColumns(columnOrder: LoadTableColumnId[], hiddenColumns: ReadonlySet<LoadTableColumnId>, pinnedColumns: ReadonlySet<LoadTableColumnId>, canViewOperationalFinancials: boolean): LoadTableColumnId[] {
    const allowed = new Set(buildDefaultLoadTableColumnOrder(canViewOperationalFinancials));
    const visible = columnOrder.filter((columnId) => allowed.has(columnId) && !hiddenColumns.has(columnId));
    const pinned = visible.filter((columnId) => pinnedColumns.has(columnId));
    const unpinned = visible.filter((columnId) => !pinnedColumns.has(columnId));
    return [...pinned, ...unpinned];
}
