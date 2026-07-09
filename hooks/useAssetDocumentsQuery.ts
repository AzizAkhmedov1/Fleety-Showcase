import { useCallback, useEffect, useRef, useState } from 'react';
import { invalidateCachedAssetDocuments, isAssetDocumentsCacheFresh, readCachedAssetDocuments, writeCachedAssetDocuments, } from '@/lib/asset-documents-cache';
import type { DriverDocumentRecord, TmsApi } from '@/lib/tms-api';
type UseAssetDocumentsQueryResult = {
    documents: DriverDocumentRecord[];
    isInitialLoading: boolean;
    isRevalidating: boolean;
    refreshDocuments: () => Promise<void>;
    deleteDocument: (documentId: number) => Promise<void>;
};
export function useAssetDocumentsQuery(assetId: number | null | undefined, entityType: 'TRUCK' | 'TRAILER', token: string, tmsApi: TmsApi): UseAssetDocumentsQueryResult {
    const [documents, setDocuments] = useState<DriverDocumentRecord[]>([]);
    const [isInitialLoading, setIsInitialLoading] = useState(false);
    const [isRevalidating, setIsRevalidating] = useState(false);
    const tmsApiRef = useRef(tmsApi);
    tmsApiRef.current = tmsApi;
    const fetchDocuments = useCallback(async (force = false) => {
        if (!assetId || !token) {
            setDocuments([]);
            setIsInitialLoading(false);
            setIsRevalidating(false);
            return;
        }
        const cached = readCachedAssetDocuments(entityType, assetId, token);
        if (cached) {
            setDocuments(cached.documents);
            if (!force && isAssetDocumentsCacheFresh(cached)) {
                setIsInitialLoading(false);
                setIsRevalidating(false);
                return;
            }
            setIsInitialLoading(false);
            setIsRevalidating(true);
        }
        else {
            setIsInitialLoading(true);
            setIsRevalidating(false);
        }
        const loader = tmsApiRef.current.assets.listDocuments(entityType, assetId);
        try {
            const docs = await loader;
            writeCachedAssetDocuments(entityType, assetId, token, docs);
            setDocuments(docs);
        }
        catch {
            if (!cached) {
                setDocuments([]);
            }
        }
        finally {
            setIsInitialLoading(false);
            setIsRevalidating(false);
        }
    }, [assetId, entityType, token]);
    useEffect(() => {
        void fetchDocuments(false);
    }, [fetchDocuments]);
    const refreshDocuments = useCallback(async () => {
        if (!assetId || !token)
            return;
        invalidateCachedAssetDocuments(entityType, assetId, token);
        await fetchDocuments(true);
    }, [assetId, entityType, fetchDocuments, token]);
    const deleteDocument = useCallback(async (documentId: number) => {
        if (!assetId || !token)
            return;
        await tmsApiRef.current.assets.deleteDocument(documentId);
        setDocuments((prev) => {
            const next = prev.filter((doc) => doc.id !== documentId);
            writeCachedAssetDocuments(entityType, assetId, token, next);
            return next;
        });
    }, [assetId, entityType, token]);
    return { documents, isInitialLoading, isRevalidating, refreshDocuments, deleteDocument };
}
