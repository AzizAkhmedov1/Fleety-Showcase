export const TRUCK_BASELINE_DOCUMENT_CATEGORIES = [
    'Cab Card',
    'Truck Registration',
    'Annual DOT Inspection',
] as const;
export const TRAILER_BASELINE_DOCUMENT_CATEGORIES = [
    'Trailer Registration',
    'FHVWA Inspection',
] as const;
export type AssetEntityType = 'TRUCK' | 'TRAILER' | 'DRIVER';
export function baselineCategoriesForEntity(entityType: AssetEntityType): readonly string[] {
    if (entityType === 'TRAILER')
        return TRAILER_BASELINE_DOCUMENT_CATEGORIES;
    if (entityType === 'TRUCK')
        return TRUCK_BASELINE_DOCUMENT_CATEGORIES;
    return [];
}
