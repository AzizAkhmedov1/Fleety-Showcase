import { create } from 'zustand';
import { createApiClient, hasValidTmsToken, readPersistedTmsToken, TMS_TOKEN_UPDATED_EVENT } from '@/lib/api-client';
import { createTmsApi, type CompanyUserRecord, type IftaReportRecord } from '@/lib/tms-api';
export interface TMSState {
    userRoles: string[];
    setUserRoles: (roles: string[]) => void;
    companyUsers: CompanyUserRecord[];
    companyUsersLoading: boolean;
    fetchCompanyUsers: () => Promise<void>;
    iftaReports: IftaReportRecord[];
    iftaReportsLoading: boolean;
    fetchIftaReports: () => Promise<void>;
    searchQuery: string;
    setSearchQuery: (query: string) => void;
    isLoadModalOpen: boolean;
    setIsLoadModalOpen: (isOpen: boolean) => void;
    settleModalId: number | null;
    setSettleModalId: (id: number | null) => void;
    activeVaultLoad: number | null;
    setActiveVaultLoad: (id: number | null) => void;
    activeFuelVault: number | null;
    setActiveFuelVault: (id: number | null) => void;
    activeDriverVault: number | null;
    setActiveDriverVault: (id: number | null) => void;
    activeAssetProfile: number | null;
    setActiveAssetProfile: (id: number | null) => void;
    isEditingProfile: boolean;
    setIsEditingProfile: (isEditing: boolean) => void;
    stagedLoad: any | null;
    setStagedLoad: (load: any | null | ((prev: any | null) => any | null)) => void;
    billingRefreshNonce: number;
    lastBillingSettledLoadId: number | null;
    requestBillingRefresh: (settledLoadId?: number) => void;
    closeAllModals: () => void;
    resetAuthenticatedState: () => void;
}
export const useTMSStore = create<TMSState>((set) => ({
    userRoles: [],
    setUserRoles: (roles) => set({ userRoles: roles }),
    companyUsers: [],
    companyUsersLoading: false,
    fetchCompanyUsers: async () => {
        if (!hasValidTmsToken(readPersistedTmsToken())) {
            set({ companyUsers: [] });
            return;
        }
        set({ companyUsersLoading: true });
        try {
            const api = createTmsApi(createApiClient(readPersistedTmsToken()));
            const users = await api.system.listUsers();
            set({ companyUsers: users });
        }
        catch {
            set({ companyUsers: [] });
        }
        finally {
            set({ companyUsersLoading: false });
        }
    },
    iftaReports: [],
    iftaReportsLoading: false,
    fetchIftaReports: async () => {
        if (!hasValidTmsToken(readPersistedTmsToken())) {
            set({ iftaReports: [] });
            return;
        }
        set({ iftaReportsLoading: true });
        try {
            const api = createTmsApi(createApiClient(readPersistedTmsToken()));
            const reports = await api.ifta.reports();
            set({ iftaReports: reports });
        }
        catch {
            set({ iftaReports: [] });
        }
        finally {
            set({ iftaReportsLoading: false });
        }
    },
    searchQuery: '',
    setSearchQuery: (query) => set({ searchQuery: query }),
    isLoadModalOpen: false,
    setIsLoadModalOpen: (isOpen) => set({ isLoadModalOpen: isOpen }),
    settleModalId: null,
    setSettleModalId: (id) => set({ settleModalId: id }),
    activeVaultLoad: null,
    setActiveVaultLoad: (id) => set({ activeVaultLoad: id }),
    activeFuelVault: null,
    setActiveFuelVault: (id) => set({ activeFuelVault: id }),
    activeDriverVault: null,
    setActiveDriverVault: (id) => set({ activeDriverVault: id }),
    activeAssetProfile: null,
    setActiveAssetProfile: (id) => set({ activeAssetProfile: id }),
    isEditingProfile: false,
    setIsEditingProfile: (isEditing) => set({ isEditingProfile: isEditing }),
    stagedLoad: null,
    setStagedLoad: (load) => set((state) => ({
        stagedLoad: typeof load === 'function' ? load(state.stagedLoad) : load,
    })),
    billingRefreshNonce: 0,
    lastBillingSettledLoadId: null,
    requestBillingRefresh: (settledLoadId) => set((state) => ({
        billingRefreshNonce: state.billingRefreshNonce + 1,
        ...(settledLoadId != null ? { lastBillingSettledLoadId: settledLoadId } : {}),
    })),
    closeAllModals: () => set({
        isLoadModalOpen: false,
        settleModalId: null,
        activeVaultLoad: null,
        activeFuelVault: null,
        activeDriverVault: null,
        activeAssetProfile: null,
        isEditingProfile: false,
        stagedLoad: null
    }),
    resetAuthenticatedState: () => set({
        userRoles: [],
        companyUsers: [],
        companyUsersLoading: false,
        iftaReports: [],
        iftaReportsLoading: false,
        searchQuery: '',
        isLoadModalOpen: false,
        settleModalId: null,
        activeVaultLoad: null,
        activeFuelVault: null,
        activeDriverVault: null,
        activeAssetProfile: null,
        isEditingProfile: false,
        stagedLoad: null,
        billingRefreshNonce: 0,
        lastBillingSettledLoadId: null,
    }),
}));
if (typeof window !== 'undefined') {
    window.addEventListener(TMS_TOKEN_UPDATED_EVENT, () => {
        if (!hasValidTmsToken()) {
            useTMSStore.getState().resetAuthenticatedState();
        }
    });
}
