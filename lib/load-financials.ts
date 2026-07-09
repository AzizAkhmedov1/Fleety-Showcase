export interface LoadGrossRateFields {
    linehaul_rate?: number | null;
    fuel_surcharge?: number | null;
    accessorial_charge?: number | null;
    total_miles?: number | null;
    rpm?: number | null;
}
export function computeLoadGrossRate(load: LoadGrossRateFields): number {
    return ((load.linehaul_rate ?? 0) + (load.fuel_surcharge ?? 0) + (load.accessorial_charge ?? 0));
}
export function computeLoadTotalRpm(load: LoadGrossRateFields): number {
    const miles = load.total_miles ?? 0;
    const gross = computeLoadGrossRate(load);
    if (miles > 0 && gross > 0)
        return gross / miles;
    return load.rpm ?? 0;
}
