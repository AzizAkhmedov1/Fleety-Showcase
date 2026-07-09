import type { AssetEntityType } from '@/lib/asset-document-categories';
import type { TruckRecord } from '@/lib/tms-api';
export type AssetUploadRouteSegment = 'trucks' | 'trailers';
export type AssetUploadTarget = {
    assetId: number;
    routeSegment: AssetUploadRouteSegment;
    uploadPath: string;
};
export function isValidAssetRecordId(value: unknown): value is number {
    return typeof value === 'number' && Number.isFinite(value) && value > 0;
}
export function resolveAssetUploadTarget(assetEntityType: AssetEntityType, record: TruckRecord | null | undefined): AssetUploadTarget | null {
    if (!record || !isValidAssetRecordId(record.id)) {
        return null;
    }
    if (assetEntityType === 'TRAILER') {
        const uploadPath = `/api/assets/trailers/${record.id}/documents`;
        return {
            assetId: record.id,
            routeSegment: 'trailers',
            uploadPath,
        };
    }
    if (assetEntityType === 'TRUCK') {
        const uploadPath = `/api/assets/trucks/${record.id}/documents`;
        return {
            assetId: record.id,
            routeSegment: 'trucks',
            uploadPath,
        };
    }
    return null;
}
export function resolveAssetDocumentsPath(assetEntityType: AssetEntityType, assetId: number): string | null {
    if (!isValidAssetRecordId(assetId)) {
        return null;
    }
    if (assetEntityType === 'TRAILER') {
        return `/api/assets/trailers/${assetId}/documents`;
    }
    if (assetEntityType === 'TRUCK') {
        return `/api/assets/trucks/${assetId}/documents`;
    }
    return null;
}
