'use client';
import { useEffect, useState } from 'react';
import { useLoadTimeFilterStore } from '@/store/useLoadTimeFilterStore';
export function useLoadTimeFilterHydrated(): boolean {
    const [hydrated, setHydrated] = useState(false);
    useEffect(() => {
        const finishHydration = () => {
            useLoadTimeFilterStore.getState().syncPresetDates();
            setHydrated(true);
        };
        const persistApi = useLoadTimeFilterStore.persist;
        if (persistApi.hasHydrated()) {
            finishHydration();
            return;
        }
        return persistApi.onFinishHydration(finishHydration);
    }, []);
    return hydrated;
}
