import type { LoadRecord } from '@/lib/tms-api';
import type { LoadInitialStatus } from '@/types/load';
export type { LoadInitialStatus } from '@/types/load';
export type StagedLoadForm = {
    origin: string;
    destination: string;
    rate: string;
    fuel_surcharge: number | string;
    accessorial_charge: number | string;
    broker_name: string;
    broker_address: string;
    broker_email: string;
    broker_phone: string;
    broker_load_id: string;
    truck_id: string;
    dispatcher_id: number | string;
    total_miles: number;
    miles?: number;
    rpm: number;
    stops: unknown[];
    commodities: unknown[];
    requirements: Record<string, unknown>;
    load_notes: string;
    notes?: string;
    pickup_number: string;
    comments: string;
    reefer_temperature: string;
    reefer_mode: string;
    initial_status: LoadInitialStatus;
    customer_id?: number | null;
    id?: number;
};
export const BROKER_UNASSIGNED_LABEL = 'Unassigned';
export function inferInitialStatusFromPickupDate(pickupDate: string | null | undefined): LoadInitialStatus {
    const pickup = (pickupDate || '').trim().slice(0, 10);
    if (!pickup)
        return 'UNASSIGNED';
    const today = new Date().toISOString().slice(0, 10);
    return pickup > today ? 'BOOKED' : 'UNASSIGNED';
}
export function resolveInitialStatusForCreate(explicit: LoadInitialStatus | null | undefined, pickupDate: string | null | undefined): LoadInitialStatus {
    if (explicit === 'BOOKED')
        return 'BOOKED';
    if (explicit === 'UNASSIGNED')
        return 'UNASSIGNED';
    return inferInitialStatusFromPickupDate(pickupDate);
}
export function toLoadCreateStatus(initialStatus: LoadInitialStatus | null | undefined): string {
    return initialStatus === 'BOOKED' ? 'booked' : 'created';
}
export function resolveBrokerNameForPayload(raw: string | null | undefined): string {
    const trimmed = (raw || '').trim();
    if (!trimmed)
        return BROKER_UNASSIGNED_LABEL;
    return trimmed;
}
export function buildLoadCreatePayload(stagedLoad: StagedLoadForm, options: {
    dispatcherId: number | null;
    cleanedStops: unknown[];
    pickupDate: string | null;
    deliveryDate: string | null;
    grossPay: number;
}): Record<string, unknown> {
    return {
        truck_id: stagedLoad.truck_id ? parseInt(String(stagedLoad.truck_id), 10) : null,
        customer_id: stagedLoad.customer_id ?? null,
        rate: options.grossPay,
        fuel_surcharge: parseFloat(String(stagedLoad.fuel_surcharge || 0)) || 0,
        accessorial_charge: parseFloat(String(stagedLoad.accessorial_charge || 0)) || 0,
        origin: (stagedLoad.origin || '').trim(),
        destination: (stagedLoad.destination || '').trim(),
        total_miles: parseFloat(String(stagedLoad.total_miles || 0)) || 0,
        rpm: 0,
        broker_load_id: stagedLoad.broker_load_id || null,
        stops: options.cleanedStops,
        pickup_date: options.pickupDate,
        delivery_date: options.deliveryDate,
        commodities: stagedLoad.commodities || [],
        requirements: {
            ...(stagedLoad.requirements || {}),
            reefer_temperature: stagedLoad.reefer_temperature || '',
            reefer_mode: stagedLoad.reefer_mode || 'N/A (Dry Van)',
        },
        load_notes: stagedLoad.notes || stagedLoad.load_notes || '',
        pickup_number: stagedLoad.pickup_number?.trim() || null,
        comments: stagedLoad.comments?.trim() || null,
        broker_name: resolveBrokerNameForPayload(stagedLoad.broker_name),
        broker_address: stagedLoad.broker_address || '',
        broker_email: stagedLoad.broker_email || '',
        broker_phone: stagedLoad.broker_phone || '',
        dispatcher_id: stagedLoad.dispatcher_id
            ? parseInt(String(stagedLoad.dispatcher_id), 10)
            : options.dispatcherId,
        status: toLoadCreateStatus(resolveInitialStatusForCreate(stagedLoad.initial_status, options.pickupDate)),
    };
}
export function createEmptyStagedLoad(dispatcherId: number | null = null): StagedLoadForm {
    return {
        origin: '',
        destination: '',
        rate: '',
        fuel_surcharge: 0,
        accessorial_charge: 0,
        broker_name: '',
        broker_address: '',
        broker_email: '',
        broker_phone: '',
        broker_load_id: '',
        truck_id: '',
        dispatcher_id: dispatcherId ?? '',
        total_miles: 0,
        rpm: 0,
        stops: [],
        commodities: [],
        requirements: {},
        load_notes: '',
        pickup_number: '',
        comments: '',
        reefer_temperature: '',
        reefer_mode: 'N/A (Dry Van)',
        initial_status: 'UNASSIGNED',
    };
}
export function mapLoadRecordToStagedLoad(load: LoadRecord, dispatcherId: number | null = null): StagedLoadForm {
    const requirements = (load.requirements ?? {}) as Record<string, unknown>;
    const reeferTemperature = String(requirements.reefer_temperature ?? load.requirements?.reefer_temperature ?? '').trim();
    const reeferMode = String(requirements.reefer_mode ?? 'N/A (Dry Van)').trim() || 'N/A (Dry Van)';
    const { reefer_temperature: _rt, reefer_mode: _rm, ...requirementRest } = requirements;
    const statusToken = (load.status || '').trim().toUpperCase().replace(/[\s-]+/g, '_');
    const initialStatus: LoadInitialStatus = statusToken === 'BOOKED' ? 'BOOKED' : 'UNASSIGNED';
    return {
        ...createEmptyStagedLoad(load.dispatcher_id ?? dispatcherId),
        id: load.id,
        broker_load_id: load.broker_load_id ?? '',
        broker_name: load.broker_name ?? '',
        broker_email: load.broker_email ?? '',
        broker_phone: load.broker_phone ?? '',
        origin: load.origin ?? '',
        destination: load.destination ?? '',
        rate: load.linehaul_rate != null ? String(load.linehaul_rate) : '',
        fuel_surcharge: load.fuel_surcharge ?? 0,
        accessorial_charge: load.accessorial_charge ?? 0,
        total_miles: load.total_miles ?? load.miles_traveled ?? 0,
        miles: load.total_miles ?? load.miles_traveled ?? 0,
        rpm: load.rpm ?? 0,
        truck_id: load.truck_id != null ? String(load.truck_id) : '',
        dispatcher_id: load.dispatcher_id ?? dispatcherId ?? '',
        customer_id: load.customer_id ?? null,
        pickup_number: load.pickup_number ?? '',
        comments: load.comments ?? '',
        load_notes: load.load_notes ?? '',
        notes: load.load_notes ?? '',
        stops: load.detailed_stops ?? [],
        commodities: [],
        requirements: requirementRest,
        reefer_temperature: reeferTemperature,
        reefer_mode: reeferMode,
        initial_status: initialStatus,
    };
}
