import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { AssetEntityType } from '@/lib/asset-document-categories';
import type { EntityCustomFolderRecord, EntityCustomFolderScope, TmsApi } from '@/lib/tms-api';
const CUSTOM_FOLDER_STALE_TIME_MS = 60000;
type FolderCacheEntry = {
    folders: EntityCustomFolderRecord[];
    fetchedAt: number;
};
const folderCache = new Map<string, FolderCacheEntry>();
function isValidAssetId(value: unknown): value is number {
    return typeof value === 'number' && Number.isFinite(value) && value > 0;
}
function resolveFolderScope(entityType: AssetEntityType, assetId: number | null | undefined): EntityCustomFolderScope | null {
    if (!isValidAssetId(assetId)) {
        return null;
    }
    if (entityType === 'TRUCK') {
        return { truckId: assetId };
    }
    if (entityType === 'TRAILER') {
        return { trailerId: assetId };
    }
    if (entityType === 'DRIVER') {
        return { driverId: assetId };
    }
    return null;
}
function cacheKey(entityType: AssetEntityType, assetId: number, token: string): string {
    return `${entityType}:${assetId}:${token}`;
}
export function useEntityCustomFolders(entityType: AssetEntityType, assetId: number | null | undefined, token: string, tmsApi: TmsApi) {
    const [folders, setFolders] = useState<EntityCustomFolderRecord[]>([]);
    const [loading, setLoading] = useState(false);
    const tmsApiRef = useRef(tmsApi);
    tmsApiRef.current = tmsApi;
    const scope = useMemo(() => resolveFolderScope(entityType, assetId), [assetId, entityType]);
    const loadFolders = useCallback(async (force = false) => {
        if (!token || !scope) {
            setFolders([]);
            return;
        }
        const key = cacheKey(entityType, assetId as number, token);
        const cached = folderCache.get(key);
        if (cached && !force && Date.now() - cached.fetchedAt <= CUSTOM_FOLDER_STALE_TIME_MS) {
            setFolders(cached.folders);
            return;
        }
        setLoading(true);
        try {
            const rows = await tmsApiRef.current.assets.customFolders(entityType, scope);
            folderCache.set(key, { folders: rows, fetchedAt: Date.now() });
            setFolders(rows);
        }
        finally {
            setLoading(false);
        }
    }, [assetId, entityType, scope, token]);
    useEffect(() => {
        void loadFolders(false);
    }, [loadFolders]);
    const createFolder = useCallback(async (folderName: string) => {
        if (!scope) {
            throw new Error('Asset scope unavailable');
        }
        const created = await tmsApiRef.current.assets.createCustomFolder(entityType, folderName, scope);
        setFolders((prev) => {
            if (prev.some((folder) => folder.folder_name === created.folder_name)) {
                return prev;
            }
            const next = [...prev, created].sort((a, b) => a.folder_name.localeCompare(b.folder_name));
            if (isValidAssetId(assetId)) {
                folderCache.set(cacheKey(entityType, assetId, token), {
                    folders: next,
                    fetchedAt: Date.now(),
                });
            }
            return next;
        });
        return created;
    }, [assetId, entityType, scope, token]);
    const deleteFolder = useCallback(async (folderId: number) => {
        await tmsApiRef.current.assets.deleteCustomFolder(folderId);
        setFolders((prev) => {
            const next = prev.filter((folder) => folder.id !== folderId);
            if (isValidAssetId(assetId)) {
                folderCache.set(cacheKey(entityType, assetId, token), {
                    folders: next,
                    fetchedAt: Date.now(),
                });
            }
            return next;
        });
    }, [assetId, entityType, token]);
    return { folders, loading, createFolder, deleteFolder, reloadFolders: () => loadFolders(true) };
}
