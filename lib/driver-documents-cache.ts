import type { DriverDocumentRecord } from '@/lib/tms-api';
export const DRIVER_DOCUMENTS_STALE_TIME_MS = 60000;
type DriverDocumentsCacheEntry = {
    documents: DriverDocumentRecord[];
    fetchedAt: number;
};
const driverDocumentsCache = new Map<string, DriverDocumentsCacheEntry>();
function buildDriverDocumentsCacheKey(driverId: number, token: string): string {
    return `${driverId}:${token}`;
}
export function readCachedDriverDocuments(driverId: number, token: string): DriverDocumentsCacheEntry | null {
    return driverDocumentsCache.get(buildDriverDocumentsCacheKey(driverId, token)) ?? null;
}
export function writeCachedDriverDocuments(driverId: number, token: string, documents: DriverDocumentRecord[]): void {
    driverDocumentsCache.set(buildDriverDocumentsCacheKey(driverId, token), {
        documents,
        fetchedAt: Date.now(),
    });
}
export function isDriverDocumentsCacheFresh(entry: DriverDocumentsCacheEntry): boolean {
    return Date.now() - entry.fetchedAt <= DRIVER_DOCUMENTS_STALE_TIME_MS;
}
export function buildDocumentNotesMap(documents: DriverDocumentRecord[]): Record<string, string> {
    return Object.fromEntries(documents.filter((doc) => doc.notes).map((doc) => [String(doc.id), doc.notes as string]));
}
