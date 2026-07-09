import { useEffect, useRef, useState } from 'react';
import type { TmsApi } from '@/lib/tms-api';
import type { DriverDocumentRecord } from '@/lib/tms-api';
import { buildDocumentNotesMap, isDriverDocumentsCacheFresh, readCachedDriverDocuments, writeCachedDriverDocuments, } from '@/lib/driver-documents-cache';
type UseDriverDocumentsQueryResult = {
    documents: DriverDocumentRecord[];
    isInitialLoading: boolean;
    isRevalidating: boolean;
};
export function useDriverDocumentsQuery(driverId: number | null | undefined, token: string, tmsApi: TmsApi): UseDriverDocumentsQueryResult {
    const [documents, setDocuments] = useState<DriverDocumentRecord[]>([]);
    const [isInitialLoading, setIsInitialLoading] = useState(false);
    const [isRevalidating, setIsRevalidating] = useState(false);
    const tmsApiRef = useRef(tmsApi);
    tmsApiRef.current = tmsApi;
    useEffect(() => {
        if (!driverId || !token) {
            setDocuments([]);
            setIsInitialLoading(false);
            setIsRevalidating(false);
            return;
        }
        const cached = readCachedDriverDocuments(driverId, token);
        if (cached) {
            setDocuments(cached.documents);
            if (isDriverDocumentsCacheFresh(cached)) {
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
        let cancelled = false;
        void tmsApiRef.current.fleet
            .driverDocuments(driverId)
            .then((docs) => {
            if (cancelled)
                return;
            writeCachedDriverDocuments(driverId, token, docs);
            setDocuments(docs);
            setIsInitialLoading(false);
            setIsRevalidating(false);
        })
            .catch(() => {
            if (cancelled)
                return;
            if (!cached) {
                setDocuments([]);
            }
            setIsInitialLoading(false);
            setIsRevalidating(false);
        });
        return () => {
            cancelled = true;
        };
    }, [driverId, token]);
    return { documents, isInitialLoading, isRevalidating };
}
export { buildDocumentNotesMap };
