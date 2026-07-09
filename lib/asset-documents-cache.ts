import type { DriverDocumentRecord } from '@/lib/tms-api';
import type { AssetEntityType } from '@/lib/asset-document-categories';
export const ASSET_DOCUMENTS_STALE_TIME_MS = 60000;
type AssetDocumentsCacheEntry = {
    documents: DriverDocumentRecord[];
    fetchedAt: number;
};
const assetDocumentsCache = new Map<string, AssetDocumentsCacheEntry>();
function buildAssetDocumentsCacheKey(entityType: AssetEntityType, assetId: number, token: string): string {
    return `${entityType}:${assetId}:${token}`;
}
export function readCachedAssetDocuments(entityType: AssetEntityType, assetId: number, token: string): AssetDocumentsCacheEntry | null {
    return assetDocumentsCache.get(buildAssetDocumentsCacheKey(entityType, assetId, token)) ?? null;
}
export function writeCachedAssetDocuments(entityType: AssetEntityType, assetId: number, token: string, documents: DriverDocumentRecord[]): void {
    assetDocumentsCache.set(buildAssetDocumentsCacheKey(entityType, assetId, token), {
        documents,
        fetchedAt: Date.now(),
    });
}
export function isAssetDocumentsCacheFresh(entry: AssetDocumentsCacheEntry): boolean {
    return Date.now() - entry.fetchedAt <= ASSET_DOCUMENTS_STALE_TIME_MS;
}
export function invalidateCachedAssetDocuments(entityType: AssetEntityType, assetId: number, token: string): void {
    assetDocumentsCache.delete(buildAssetDocumentsCacheKey(entityType, assetId, token));
}
