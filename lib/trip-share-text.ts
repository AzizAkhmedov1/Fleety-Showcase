import { computeLoadGrossRate, computeLoadTotalRpm } from '@/lib/load-financials';
import { resolveManifestStops, type ManifestStopView, } from '@/lib/load-manifest-stops';
type ShareLoad = Record<string, unknown>;
const readString = (value: unknown) => String(value ?? '').trim();
function formatManifestStopShareBlock(stop: ManifestStopView): string {
    const lines = [`${stop.sequence}. ${stop.role}: ${stop.scheduleLabel}`];
    if (stop.referenceLine)
        lines.push(stop.referenceLine);
    if (stop.weightLine)
        lines.push(stop.weightLine);
    if (stop.appointmentLine && !stop.windowLabel)
        lines.push(stop.appointmentLine);
    lines.push(stop.companyName, stop.address);
    if (stop.notes)
        lines.push(stop.notes);
    return lines.filter(Boolean).join('\n');
}
export function formatTemperatureLine(load: ShareLoad) {
    const temp = readString(load.reefer_temperature || (load.requirements as ShareLoad)?.reefer_temperature);
    const mode = readString(load.reefer_mode || (load.requirements as ShareLoad)?.reefer_mode);
    const isDryVan = !temp ||
        mode === 'N/A (Dry Van)' ||
        mode.toLowerCase().includes('dry van') ||
        mode.toLowerCase() === 'n/a';
    if (isDryVan)
        return 'Temperature: N/A (Dry Van)';
    if (temp && mode)
        return `Temperature: ${temp} | Mode: ${mode}`;
    if (temp)
        return `Temperature: ${temp}`;
    return 'Temperature: N/A (Dry Van)';
}
export function buildTripShareText(load: ShareLoad | null | undefined) {
    if (!load)
        return '';
    const manifestStops = resolveManifestStops(load);
    const loadId = readString(load.broker_load_id) || String(load.id ?? '');
    const puNumber = readString(load.pickup_number) || readString(load.pu_number) || '—';
    const temperature = formatTemperatureLine(load);
    const grossRate = computeLoadGrossRate({
        linehaul_rate: Number(load.linehaul_rate) || 0,
        fuel_surcharge: Number(load.fuel_surcharge) || 0,
        accessorial_charge: Number(load.accessorial_charge) || 0,
    });
    const grossPay = grossRate.toFixed(2);
    const miles = Number(load.total_miles ?? 0);
    const rpm = computeLoadTotalRpm({
        linehaul_rate: Number(load.linehaul_rate) || 0,
        fuel_surcharge: Number(load.fuel_surcharge) || 0,
        accessorial_charge: Number(load.accessorial_charge) || 0,
        total_miles: miles,
        rpm: Number(load.rpm) || 0,
    }).toFixed(2);
    const lines = [
        `Load#: ${loadId}`,
        `PU#: ${puNumber}`,
        temperature,
        `Gross Rate: $${grossPay} | Mileage: ${miles} mi | RPM: $${rpm}`,
        '',
    ];
    manifestStops.forEach((stop, index) => {
        if (index > 0)
            lines.push('');
        lines.push(formatManifestStopShareBlock(stop));
    });
    return lines.join('\n');
}
