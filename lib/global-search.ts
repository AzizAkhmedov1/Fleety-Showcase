import type { DriverRecord, LoadRecord, TruckRecord } from './tms-api';
import { extractTrailerMetadata, trailerMetadataSearchTokens } from './trailer-metadata';
export type GlobalSearchTarget = 'loads' | 'fleet' | 'live-ops';
const normalizeStatus = (status?: string | null) => (status || '').trim().toLowerCase().replace(/[\s-]+/g, '_');
export function matchesSearchField(value: string | number | null | undefined, q: string): boolean {
    if (value == null)
        return false;
    const normalized = typeof value === 'string' ? value : String(value);
    return normalized?.toLowerCase()?.includes(q) ?? false;
}
const anyFieldMatchesQuery = (fields: Array<string | number | null | undefined>, q: string): boolean => fields.some((field) => matchesSearchField(field, q));
export const matchesLoadSearchQuery = (load: LoadRecord, query: string, trucks: TruckRecord[], drivers: DriverRecord[]): boolean => {
    if (!query)
        return true;
    const q = query.toLowerCase();
    const assignedTruck = trucks.find((t) => t.id === load.truck_id);
    const primaryDriver = assignedTruck
        ? drivers.find((d) => d.id === assignedTruck.driver_id)
        : null;
    const coDriver = assignedTruck
        ? drivers.find((d) => d.id === assignedTruck.co_driver_id)
        : null;
    const fields = [
        load.id,
        load.broker_load_id,
        load.broker_name,
        load.origin,
        load.destination,
        load.truck_number,
        load.trailer_number,
        assignedTruck?.truck_number,
        assignedTruck?.trailer_number,
        primaryDriver?.driver_name,
        coDriver?.driver_name,
        assignedTruck?.driver_name,
        assignedTruck?.co_driver_name,
        load.id != null ? `l-${load.id}` : null,
    ];
    return anyFieldMatchesQuery(fields, q);
};
export const matchesDriverSearchQuery = (driver: Pick<DriverRecord, 'driver_name' | 'cdl_number' | 'phone_number' | 'email'>, query: string): boolean => {
    if (!query)
        return true;
    const q = query.toLowerCase();
    const fields = [driver.driver_name, driver.cdl_number, driver.phone_number, driver.email];
    return anyFieldMatchesQuery(fields, q);
};
export const matchesTruckSearchQuery = (truck: TruckRecord, drivers: DriverRecord[], query: string): boolean => {
    if (!query)
        return true;
    const q = query.toLowerCase();
    const primaryDriver = truck.driver_id
        ? drivers.find((driver) => driver.id === truck.driver_id)
        : null;
    const coDriver = truck.co_driver_id
        ? drivers.find((driver) => driver.id === truck.co_driver_id)
        : null;
    const fields = [
        truck.truck_number,
        truck.trailer_number,
        truck.vin,
        truck.equipment_type,
        truck.driver_name,
        truck.co_driver_name,
        primaryDriver?.driver_name,
        coDriver?.driver_name,
        truck.trailer_number ? `trl-${truck.trailer_number}` : null,
        ...trailerMetadataSearchTokens(extractTrailerMetadata(truck)),
    ];
    return anyFieldMatchesQuery(fields, q);
};
const hasLoadMatches = (loads: LoadRecord[], query: string, trucks: TruckRecord[], drivers: DriverRecord[]) => loads.some((load) => matchesLoadSearchQuery(load, query, trucks, drivers));
const hasDriverMatches = (drivers: DriverRecord[], query: string) => drivers.some((driver) => matchesDriverSearchQuery(driver, query));
const hasTruckMatches = (trucks: TruckRecord[], drivers: DriverRecord[], query: string) => trucks.some((truck) => matchesTruckSearchQuery(truck, drivers, query));
const hasLiveOpsMatches = (activeLoads: LoadRecord[], query: string, trucks: TruckRecord[], drivers: DriverRecord[]) => activeLoads.some((load) => {
    if (!matchesLoadSearchQuery(load, query, trucks, drivers))
        return false;
    const status = normalizeStatus(load.status);
    return status === 'dispatched' || status === 'in_transit' || status === 'assigned';
});
export const resolveGlobalSearchTarget = (query: string, loads: LoadRecord[], activeLoads: LoadRecord[], trucks: TruckRecord[], drivers: DriverRecord[], pathname: string): GlobalSearchTarget | null => {
    const trimmed = query.trim();
    if (!trimmed)
        return null;
    const loadMatches = hasLoadMatches(loads, trimmed, trucks, drivers);
    const driverMatches = hasDriverMatches(drivers, trimmed);
    const truckMatches = hasTruckMatches(trucks, drivers, trimmed);
    const liveOpsMatches = hasLiveOpsMatches(activeLoads, trimmed, trucks, drivers);
    if (pathname === '/load-management') {
        if (loadMatches)
            return 'loads';
        if (driverMatches || truckMatches)
            return 'fleet';
        return 'loads';
    }
    if (liveOpsMatches)
        return 'live-ops';
    if (loadMatches)
        return 'loads';
    if (driverMatches || truckMatches)
        return 'fleet';
    return null;
};
export const globalSearchTargetToPath = (target: GlobalSearchTarget): string => {
    if (target === 'fleet')
        return '/fleet/assets';
    if (target === 'live-ops')
        return '/live-operations';
    return '/load-management';
};
