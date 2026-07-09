import type { TruckRecord } from '@/lib/tms-api';
export function resolveTrailerDocumentDriverId(truck: TruckRecord | null): number | null {
    if (!truck)
        return null;
    if (truck.driver_id)
        return truck.driver_id;
    if (truck.active_driver?.id)
        return truck.active_driver.id;
    return null;
}
export function hasTrailerOperationalDriverContext(truck: TruckRecord | null): boolean {
    if (!truck)
        return false;
    return Boolean(truck.driver_id || truck.active_driver?.id);
}
