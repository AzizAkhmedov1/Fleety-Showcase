import type { TruckRecord } from '@/lib/tms-api';
export const TRAILER_OWNERSHIP_TYPES = [
    'Company',
    'Lease',
    'Owner Operator',
    'Rental',
] as const;
export type TrailerOwnershipType = (typeof TRAILER_OWNERSHIP_TYPES)[number];
export const TRAILER_STATUS_OPTIONS = [
    'Available',
    'In Transit',
    'Inactive',
    'Reserved',
    'Maintenance',
] as const;
export type TrailerStatusOption = (typeof TRAILER_STATUS_OPTIONS)[number];
export const TRAILER_STATUS_STYLES: Record<TrailerStatusOption, string> = {
    Available: 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20',
    'In Transit': 'bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-500/20',
    Inactive: 'bg-zinc-100 dark:bg-zinc-800/50 text-zinc-600 dark:text-zinc-400 border-zinc-300 dark:border-zinc-700/60',
    Reserved: 'bg-violet-50 dark:bg-violet-500/10 text-violet-700 dark:text-violet-400 border-violet-200 dark:border-violet-500/20',
    Maintenance: 'bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-500/20',
};
export interface TrailerMetadata {
    make: string;
    model: string;
    year: string;
    plateNumber: string;
    vin: string;
    ownershipType: TrailerOwnershipType;
    assignedTruck: string;
    trailerStatus: TrailerStatusOption;
    notes: string;
}
const CUSTOM_KEYS = {
    make: 'make',
    model: 'model',
    year: 'year',
    plateNumber: 'plate_number',
    ownershipType: 'ownership_type',
    assignedTruck: 'assigned_truck',
    trailerStatus: 'trailer_status',
    notes: 'trailer_notes',
} as const;
function readCustomField(customFields: Record<string, string> | undefined, ...keys: string[]): string {
    if (!customFields)
        return '';
    for (const key of keys) {
        const value = customFields[key];
        if (value != null && String(value).trim()) {
            return String(value).trim();
        }
    }
    return '';
}
export function normalizeTrailerStatus(value?: string | null): TrailerStatusOption {
    const raw = (value || '').trim().toLowerCase();
    const match = TRAILER_STATUS_OPTIONS.find((option) => option.toLowerCase() === raw || option.toLowerCase().replace(/\s+/g, '_') === raw.replace(/\s+/g, '_'));
    if (match)
        return match;
    if (raw === 'in transit' || raw === 'in_transit')
        return 'In Transit';
    return 'Available';
}
export function normalizeOwnershipType(value?: string | null): TrailerOwnershipType {
    const raw = (value || '').trim().toLowerCase();
    const match = TRAILER_OWNERSHIP_TYPES.find((option) => option.toLowerCase() === raw || option.toLowerCase().replace(/\s+/g, '_') === raw.replace(/\s+/g, '_'));
    return match ?? 'Company';
}
function normalizeUnitToken(value: string): string {
    return value
        .trim()
        .replace(/^#/, '')
        .replace(/^trl-/i, '')
        .toLowerCase();
}
function readRawAssignedTruck(customFields: Record<string, string> | undefined): string {
    return readCustomField(customFields, CUSTOM_KEYS.assignedTruck, 'Assigned Truck');
}
export function getRawAssignedTruck(truck: TruckRecord): string {
    return readRawAssignedTruck(truck.custom_fields);
}
function formatTruckNumberDisplay(value: string): {
    text: string;
    isUnassigned: boolean;
} {
    const trimmed = value.trim();
    if (trimmed.startsWith('#')) {
        return { text: trimmed, isUnassigned: false };
    }
    return { text: `#${trimmed.replace(/^#/, '')}`, isUnassigned: false };
}
function isPowerUnitRecord(truck: TruckRecord): boolean {
    const assetType = (truck.asset_type || 'truck').toLowerCase();
    if (assetType === 'standalone_trailer' || assetType === 'trailer') {
        return false;
    }
    const unitNumber = (truck.truck_number || '').trim().toUpperCase();
    return !unitNumber.startsWith('TRL-');
}
export function isPowerUnit(truck: TruckRecord): boolean {
    return isPowerUnitRecord(truck);
}
export function filterPowerUnits<T extends TruckRecord>(fleet: T[]): T[] {
    return fleet.filter(isPowerUnitRecord);
}
export function findPowerUnitForTrailer(fleet: TruckRecord[], trailerNumber?: string | null): TruckRecord | null {
    const trailerKey = normalizeUnitToken(trailerNumber || '');
    if (!trailerKey)
        return null;
    for (const unit of fleet) {
        if (!isPowerUnitRecord(unit))
            continue;
        const assigned = (unit.trailer_number || '').trim();
        if (!assigned || assigned.toUpperCase() === 'N/A')
            continue;
        if (normalizeUnitToken(assigned) === trailerKey) {
            return unit;
        }
    }
    return null;
}
export function resolveAssignedTruckDisplay(truck: TruckRecord, metadata: TrailerMetadata, fleet: TruckRecord[] = []): {
    text: string;
    isUnassigned: boolean;
} {
    const isStandaloneTrailer = (truck.asset_type || 'truck').toLowerCase() === 'standalone_trailer';
    const rawFromFields = getRawAssignedTruck(truck).trim();
    if (isStandaloneTrailer) {
        if (!rawFromFields ||
            rawFromFields.toLowerCase() === 'unassigned' ||
            rawFromFields.toLowerCase() === 'none' ||
            rawFromFields === '—') {
            const deployedOn = findPowerUnitForTrailer(fleet, truck.trailer_number);
            if (deployedOn?.truck_number) {
                return formatTruckNumberDisplay(deployedOn.truck_number);
            }
            return { text: 'None', isUnassigned: true };
        }
        const trailerIdentityTokens = new Set<string>();
        if (truck.trailer_number)
            trailerIdentityTokens.add(normalizeUnitToken(truck.trailer_number));
        if (truck.truck_number)
            trailerIdentityTokens.add(normalizeUnitToken(truck.truck_number));
        if (trailerIdentityTokens.has(normalizeUnitToken(rawFromFields))) {
            return { text: 'None', isUnassigned: true };
        }
        return formatTruckNumberDisplay(rawFromFields);
    }
    const candidate = rawFromFields ||
        (truck.truck_number ? `#${truck.truck_number}` : '') ||
        (metadata.assignedTruck || '').trim();
    if (!candidate ||
        candidate.toLowerCase() === 'unassigned' ||
        candidate.toLowerCase() === 'none' ||
        candidate === '—') {
        return { text: 'None', isUnassigned: true };
    }
    return formatTruckNumberDisplay(candidate);
}
export function extractTrailerMetadata(truck: TruckRecord): TrailerMetadata {
    const customFields = truck.custom_fields ?? {};
    const make = readCustomField(customFields, CUSTOM_KEYS.make, 'Make');
    const model = readCustomField(customFields, CUSTOM_KEYS.model, 'Model');
    const year = readCustomField(customFields, CUSTOM_KEYS.year, 'Year');
    const explicitAssignedTruck = readRawAssignedTruck(customFields);
    const assetType = (truck.asset_type || 'truck').toLowerCase();
    const assignedTruckFallback = assetType !== 'standalone_trailer' && truck.truck_number ? `#${truck.truck_number}` : '';
    return {
        make,
        model,
        year,
        plateNumber: readCustomField(customFields, CUSTOM_KEYS.plateNumber, 'Plate Number', 'plate'),
        vin: (truck.vin || '').trim(),
        ownershipType: normalizeOwnershipType(readCustomField(customFields, CUSTOM_KEYS.ownershipType, 'Ownership Type')),
        assignedTruck: explicitAssignedTruck || assignedTruckFallback,
        trailerStatus: normalizeTrailerStatus(readCustomField(customFields, CUSTOM_KEYS.trailerStatus, 'Trailer Status')),
        notes: readCustomField(customFields, CUSTOM_KEYS.notes, 'Notes', 'notes'),
    };
}
export function formatMakeModel(metadata: TrailerMetadata): string {
    const parts = [metadata.make, metadata.model].filter(Boolean);
    return parts.length > 0 ? parts.join(' ') : '—';
}
function hasValidTrailerId(trailerNumber?: string | null): boolean {
    const trimmed = (trailerNumber || '').trim();
    if (!trimmed)
        return false;
    const normalized = trimmed.toLowerCase();
    return (normalized !== 'n/a' &&
        normalized !== 'na' &&
        normalized !== 'none' &&
        normalized !== 'unassigned' &&
        trimmed !== '—');
}
export function isTrailerBoardRecord(truck: TruckRecord): boolean {
    return hasValidTrailerId(truck.trailer_number);
}
function trailerBoardNumberKey(truck: TruckRecord): string | null {
    const num = (truck.trailer_number || '').trim();
    if (!hasValidTrailerId(num))
        return null;
    return num.toLowerCase();
}
function trailerBoardRecordRank(truck: TruckRecord): number {
    const assetType = (truck.asset_type || 'truck').toLowerCase();
    if (assetType === 'standalone_trailer')
        return 0;
    if (getRawAssignedTruck(truck).trim())
        return 1;
    return 2;
}
export function dedupeTrailerBoardRecords(trucks: TruckRecord[]): TruckRecord[] {
    const eligible = trucks.filter(isTrailerBoardRecord);
    const byKey = new Map<string, TruckRecord>();
    for (const truck of eligible) {
        const numKey = trailerBoardNumberKey(truck);
        if (!numKey)
            continue;
        const mapKey = numKey;
        const existing = byKey.get(mapKey);
        if (!existing) {
            byKey.set(mapKey, truck);
            continue;
        }
        const existingRank = trailerBoardRecordRank(existing);
        const nextRank = trailerBoardRecordRank(truck);
        if (nextRank < existingRank ||
            (nextRank === existingRank && truck.id < existing.id)) {
            byKey.set(mapKey, truck);
        }
    }
    return Array.from(byKey.values()).sort((a, b) => {
        const aNum = (a.trailer_number || '').trim();
        const bNum = (b.trailer_number || '').trim();
        return aNum.localeCompare(bNum, undefined, { numeric: true }) || a.id - b.id;
    });
}
export function mergeTrailerMetadataIntoCustomFields(existing: Record<string, string> | undefined, patch: Partial<Pick<TrailerMetadata, 'notes' | 'trailerStatus' | 'ownershipType' | 'plateNumber' | 'assignedTruck' | 'make' | 'model' | 'year'>>): Record<string, string> {
    const base = { ...(existing ?? {}) };
    if (patch.make !== undefined)
        base[CUSTOM_KEYS.make] = patch.make;
    if (patch.model !== undefined)
        base[CUSTOM_KEYS.model] = patch.model;
    if (patch.year !== undefined)
        base[CUSTOM_KEYS.year] = patch.year;
    if (patch.plateNumber !== undefined)
        base[CUSTOM_KEYS.plateNumber] = patch.plateNumber;
    if (patch.ownershipType !== undefined)
        base[CUSTOM_KEYS.ownershipType] = patch.ownershipType;
    if (patch.assignedTruck !== undefined)
        base[CUSTOM_KEYS.assignedTruck] = patch.assignedTruck;
    if (patch.trailerStatus !== undefined)
        base[CUSTOM_KEYS.trailerStatus] = patch.trailerStatus;
    if (patch.notes !== undefined)
        base[CUSTOM_KEYS.notes] = patch.notes;
    return base;
}
export function trailerMetadataSearchTokens(metadata: TrailerMetadata): string[] {
    return [
        metadata.make,
        metadata.model,
        metadata.year,
        metadata.plateNumber,
        metadata.vin,
        metadata.ownershipType,
        metadata.assignedTruck,
        metadata.trailerStatus,
        metadata.notes,
        formatMakeModel(metadata),
    ];
}
