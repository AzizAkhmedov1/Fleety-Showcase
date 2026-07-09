import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { getPresetRange, type LoadManagementDatePreset, } from '@/lib/fleet-financial-metrics';
export const FLEETY_TIME_FILTER_KEY = 'fleety_time_filter';
interface PersistedLoadTimeFilter {
    preset: LoadManagementDatePreset;
    dateFrom: string;
    dateTo: string;
}
interface LoadTimeFilterState extends PersistedLoadTimeFilter {
    applyPreset: (preset: LoadManagementDatePreset) => void;
    applyCustomDate: (field: 'start' | 'end', value: string) => void;
    syncPresetDates: () => void;
}
function defaultMtdRange() {
    return getPresetRange('mtd');
}
function resolveDatesForPreset(preset: LoadManagementDatePreset, dateFrom: string, dateTo: string): Pick<PersistedLoadTimeFilter, 'dateFrom' | 'dateTo'> {
    if (preset === 'all') {
        return { dateFrom: '', dateTo: '' };
    }
    if (preset === 'custom') {
        return { dateFrom, dateTo };
    }
    const range = getPresetRange(preset);
    return { dateFrom: range.start, dateTo: range.end };
}
const mtdDefaults = defaultMtdRange();
export const useLoadTimeFilterStore = create<LoadTimeFilterState>()(persist((set, get) => ({
    preset: 'mtd',
    dateFrom: mtdDefaults.start,
    dateTo: mtdDefaults.end,
    applyPreset: (preset) => {
        const dates = resolveDatesForPreset(preset, get().dateFrom, get().dateTo);
        set({ preset, ...dates });
    },
    applyCustomDate: (field, value) => {
        if (field === 'start') {
            set({ preset: 'custom', dateFrom: value });
            return;
        }
        set({ preset: 'custom', dateTo: value });
    },
    syncPresetDates: () => {
        const { preset, dateFrom, dateTo } = get();
        const dates = resolveDatesForPreset(preset, dateFrom, dateTo);
        set(dates);
    },
}), {
    name: FLEETY_TIME_FILTER_KEY,
    partialize: (state) => ({
        preset: state.preset,
        dateFrom: state.dateFrom,
        dateTo: state.dateTo,
    }),
    merge: (persisted, current) => {
        const stored = persisted as Partial<PersistedLoadTimeFilter> | undefined;
        if (!stored?.preset)
            return current;
        const dates = resolveDatesForPreset(stored.preset, stored.dateFrom ?? '', stored.dateTo ?? '');
        return {
            ...current,
            preset: stored.preset,
            ...dates,
        };
    },
}));
