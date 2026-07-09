"use client";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import toast from "react-hot-toast";
import { ChevronDown, ChevronRight, FileText, FolderOpen, Loader2, Wallet } from "lucide-react";
import { createApiClient, hasValidTmsToken, normalizeBearerToken } from "@/lib/api-client";
import { createTmsApi, BillingLoadItem, ARTrackerBuckets } from "@/lib/tms-api";
import { useTMSStore } from "@/store/useTMSStore";
interface BillingCommandCenterProps {
    token: string | null;
    hideTabBar?: boolean;
    activeTab?: BillingTab;
    onActiveTabChange?: (tab: BillingTab) => void;
}
type BillingTab = "queue" | "ar";
const AR_SECTIONS: Array<{
    key: keyof ARTrackerBuckets;
    label: string;
    badgeClass: string;
}> = [
    {
        key: "PENDING_FACTORING",
        label: "Pending",
        badgeClass: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/25",
    },
    {
        key: "FUNDED",
        label: "Funded",
        badgeClass: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/25",
    },
    {
        key: "HELD_DISPUTED",
        label: "Held/Disputed",
        badgeClass: "bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/25",
    },
    {
        key: "DIRECT_BILL",
        label: "Direct Bill",
        badgeClass: "bg-zinc-500/10 text-zinc-700 dark:text-zinc-300 border-zinc-500/25",
    },
];
const fmt = (n: number) => n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const FUNDED_ACTIVE_DAYS = 30;
const ACTIVE_AR_SECTIONS = AR_SECTIONS.filter((section) => section.key !== "FUNDED");
const FUNDED_SECTION = AR_SECTIONS.find((section) => section.key === "FUNDED")!;
const isFundedWithin30Days = (load: BillingLoadItem) => {
    const raw = load.funded_at ?? load.delivered_at;
    if (!raw)
        return true;
    const fundedDate = new Date(raw);
    if (Number.isNaN(fundedDate.getTime()))
        return true;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - FUNDED_ACTIVE_DAYS);
    return fundedDate >= cutoff;
};
const formatFundedDate = (load: BillingLoadItem) => {
    const raw = load.funded_at ?? load.delivered_at;
    if (!raw)
        return "—";
    const d = new Date(raw);
    return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString();
};
export default function BillingCommandCenter({ token, hideTabBar = false, activeTab: controlledActiveTab, onActiveTabChange, }: BillingCommandCenterProps) {
    const bearerToken = normalizeBearerToken(token);
    const api = useMemo(() => createTmsApi(createApiClient(bearerToken || null)), [bearerToken]);
    const { setSettleModalId, setActiveVaultLoad, billingRefreshNonce, lastBillingSettledLoadId } = useTMSStore();
    const [internalActiveTab, setInternalActiveTab] = useState<BillingTab>('queue');
    const activeTab = controlledActiveTab ?? internalActiveTab;
    const setActiveTab = (tab: BillingTab) => {
        if (onActiveTabChange) {
            onActiveTabChange(tab);
        }
        else {
            setInternalActiveTab(tab);
        }
    };
    const [queueLoads, setQueueLoads] = useState<BillingLoadItem[]>([]);
    const [arBuckets, setArBuckets] = useState<ARTrackerBuckets>({
        PENDING_FACTORING: [],
        FUNDED: [],
        HELD_DISPUTED: [],
        DIRECT_BILL: [],
    });
    const [selectedIds, setSelectedIds] = useState<number[]>([]);
    const [loadingQueue, setLoadingQueue] = useState(true);
    const [loadingAr, setLoadingAr] = useState(true);
    const [batchSubmitting, setBatchSubmitting] = useState(false);
    const [historicalLedgerOpen, setHistoricalLedgerOpen] = useState(false);
    const fetchBillingData = useCallback(async (options?: {
        silent?: boolean;
    }) => {
        if (!hasValidTmsToken(bearerToken))
            return;
        const silent = options?.silent ?? false;
        if (!silent) {
            setLoadingQueue(true);
            setLoadingAr(true);
        }
        try {
            const [queueRes, arRes] = await Promise.all([
                api.accounting.billingQueue(),
                api.accounting.arTracker(),
            ]);
            setQueueLoads(queueRes.loads || []);
            setArBuckets(arRes);
            setSelectedIds((prev) => prev.filter((id) => (queueRes.loads || []).some((load) => load.id === id)));
        }
        catch (error) {
            console.error("Billing command center fetch failed:", error);
            setQueueLoads([]);
            setArBuckets({
                PENDING_FACTORING: [],
                FUNDED: [],
                HELD_DISPUTED: [],
                DIRECT_BILL: [],
            });
        }
        finally {
            if (!silent) {
                setLoadingQueue(false);
                setLoadingAr(false);
            }
        }
    }, [api, bearerToken]);
    useEffect(() => {
        if (!hasValidTmsToken(bearerToken)) {
            setLoadingQueue(false);
            setLoadingAr(false);
            return;
        }
        void fetchBillingData();
    }, [bearerToken, fetchBillingData]);
    useEffect(() => {
        if (!hasValidTmsToken(bearerToken))
            return;
        if (billingRefreshNonce === 0)
            return;
        if (lastBillingSettledLoadId != null) {
            setQueueLoads((prev) => prev.filter((load) => load.id !== lastBillingSettledLoadId));
        }
        void fetchBillingData({ silent: true });
    }, [billingRefreshNonce, bearerToken, lastBillingSettledLoadId, fetchBillingData]);
    const allSelected = queueLoads.length > 0 && selectedIds.length === queueLoads.length;
    const toggleSelectAll = () => {
        if (allSelected) {
            setSelectedIds([]);
        }
        else {
            setSelectedIds(queueLoads.map((load) => load.id));
        }
    };
    const toggleRow = (loadId: number) => {
        setSelectedIds((prev) => prev.includes(loadId) ? prev.filter((id) => id !== loadId) : [...prev, loadId]);
    };
    const handleBatchFactor = async () => {
        if (!selectedIds.length) {
            toast.error("Select at least one delivered load to submit.");
            return;
        }
        setBatchSubmitting(true);
        const submittedIds = [...selectedIds];
        const toastId = toast.loading(`Submitting ${submittedIds.length} load(s) to factoring...`);
        try {
            const result = await api.accounting.batchFactor(submittedIds);
            if (result.failed_count > 0) {
                toast.success(`Submitted ${result.submitted_count} load(s). ${result.failed_count} failed.`, { id: toastId });
            }
            else {
                toast.success(`Batch submitted ${result.submitted_count} load(s) to factoring.`, {
                    id: toastId,
                });
            }
            setQueueLoads((prev) => prev.filter((load) => !submittedIds.includes(load.id)));
            setSelectedIds([]);
            await fetchBillingData({ silent: true });
        }
        catch (error: any) {
            toast.error(error.response?.data?.detail || "Batch factoring submission failed.", {
                id: toastId,
            });
        }
        finally {
            setBatchSubmitting(false);
        }
    };
    const activeFundedLoads = useMemo(() => (arBuckets.FUNDED || []).filter(isFundedWithin30Days), [arBuckets.FUNDED]);
    const historicalFundedLoads = useMemo(() => (arBuckets.FUNDED || []).filter((load) => !isFundedWithin30Days(load)), [arBuckets.FUNDED]);
    const arTotal = useMemo(() => {
        const nonFundedTotal = ACTIVE_AR_SECTIONS.reduce((sum, section) => sum + (arBuckets[section.key]?.length || 0), 0);
        return nonFundedTotal + activeFundedLoads.length;
    }, [arBuckets, activeFundedLoads.length]);
    const renderArRows = (rows: BillingLoadItem[], section: (typeof AR_SECTIONS)[number]) => (<tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
      {rows.map((load) => (<tr key={`${section.key}-${load.id}`} className="hover:bg-zinc-50/60 dark:hover:bg-zinc-800/30">
          <td className="p-3 font-mono font-bold text-zinc-900 dark:text-white">
            {load.load_id}
          </td>
          <td className="p-3 text-zinc-600 dark:text-zinc-300">{load.broker_name}</td>
          <td className="p-3 text-zinc-500 dark:text-zinc-400">
            {load.origin} → {load.destination}
          </td>
          <td className="p-3 text-right font-bold text-zinc-900 dark:text-white">
            ${fmt(load.gross_pay)}
          </td>
          <td className="p-3 text-right">
            <span className={`inline-flex px-2 py-0.5 rounded text-[9px] font-bold uppercase border ${section.badgeClass}`}>
              {section.label}
            </span>
          </td>
          <td className="p-3">
            <div className="flex justify-end">
              <button type="button" onClick={() => setActiveVaultLoad(load.id)} title="Open document vault" className="text-[10px] font-bold px-3 py-1.5 rounded-lg border border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors inline-flex items-center gap-1">
                <FolderOpen size={12}/>
                Files
              </button>
            </div>
          </td>
        </tr>))}
    </tbody>);
    const renderArSection = (section: (typeof AR_SECTIONS)[number], rows: BillingLoadItem[], extraHeader?: ReactNode) => {
        if (!rows.length)
            return null;
        return (<div key={section.key} className="border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden">
        <div className="px-4 py-3 bg-zinc-50 dark:bg-[#0B0B0B] border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
          <span className={`inline-flex px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider border ${section.badgeClass}`}>
            {section.label}
          </span>
          <div className="flex items-center gap-3">
            {extraHeader}
            <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">
              {rows.length} load{rows.length !== 1 ? "s" : ""}
            </span>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="text-[9px] uppercase font-bold text-zinc-500 dark:text-zinc-400 bg-white dark:bg-[#161616]">
              <tr>
                <th className="p-3 text-left">Load ID</th>
                <th className="p-3 text-left">Broker</th>
                <th className="p-3 text-left">Lane</th>
                <th className="p-3 text-right">Gross</th>
                <th className="p-3 text-right">Status</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            {renderArRows(rows, section)}
          </table>
        </div>
      </div>);
    };
    return (<section className="relative bg-white dark:bg-[#161616] border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-[#0B0B0B] flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-800 dark:text-zinc-200 flex items-center gap-2">
            <Wallet size={16}/> Invoice Management
          </h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
            Track completed freight records awaiting billing or factoring settlement details.
          </p>
        </div>
        <div className="flex rounded-lg border border-zinc-200 dark:border-zinc-800 overflow-hidden">
          {!hideTabBar && (<>
              <button type="button" onClick={() => setActiveTab('queue')} className={`px-4 py-2 text-xs font-bold uppercase tracking-wider transition-colors ${activeTab === 'queue'
                ? 'bg-zinc-900 text-white dark:bg-white dark:text-black'
                : 'bg-white dark:bg-[#161616] text-zinc-500 hover:bg-zinc-50 dark:hover:bg-zinc-800'}`}>
                Open Billing Queue
              </button>
              <button type="button" onClick={() => setActiveTab('ar')} className={`px-4 py-2 text-xs font-bold uppercase tracking-wider transition-colors ${activeTab === 'ar'
                ? 'bg-zinc-900 text-white dark:bg-white dark:text-black'
                : 'bg-white dark:bg-[#161616] text-zinc-500 hover:bg-zinc-50 dark:hover:bg-zinc-800'}`}>
                Pending Payments
              </button>
            </>)}
        </div>
      </div>

      {activeTab === "queue" && (<>
          {selectedIds.length > 0 && (<div className="sticky top-0 z-10 px-5 py-3 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-100/95 dark:bg-zinc-900/95 backdrop-blur-sm flex items-center justify-between gap-3">
              <span className="text-xs font-semibold text-zinc-600 dark:text-zinc-300">
                {selectedIds.length} load{selectedIds.length !== 1 ? "s" : ""} selected for batch
                factoring
              </span>
              <button type="button" onClick={handleBatchFactor} disabled={batchSubmitting} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 dark:bg-white dark:text-black dark:hover:bg-zinc-200 text-white text-xs font-bold transition-colors disabled:opacity-60">
                {batchSubmitting ? (<Loader2 size={14} className="animate-spin"/>) : null}
                Batch Submit to Factoring ({selectedIds.length} Loads)
              </button>
            </div>)}

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-zinc-50 dark:bg-[#0B0B0B] text-zinc-500 dark:text-zinc-400 text-[10px] uppercase font-bold tracking-wider border-b dark:border-zinc-800">
                <tr>
                  <th className="p-4 w-10">
                    <input type="checkbox" checked={allSelected} onChange={toggleSelectAll} disabled={!queueLoads.length || batchSubmitting} className="rounded border-zinc-300 dark:border-zinc-700 text-zinc-600 focus:ring-zinc-600"/>
                  </th>
                  <th className="p-4 text-left">Load ID</th>
                  <th className="p-4 text-left">Customer / Broker</th>
                  <th className="p-4 text-left">Pickup</th>
                  <th className="p-4 text-left">Delivery</th>
                  <th className="p-4 text-right">Gross Pay</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {loadingQueue ? (<tr>
                    <td colSpan={7} className="p-12 text-center text-zinc-400">
                      <span className="inline-flex items-center gap-2">
                        <Loader2 size={16} className="animate-spin"/>
                        Syncing open billing queue...
                      </span>
                    </td>
                  </tr>) : queueLoads.length === 0 ? (<tr>
                    <td colSpan={7} className="p-12 text-center">
                      <p className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-2">
                        No delivered loads awaiting billing
                      </p>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400 max-w-md mx-auto">
                        Delivered loads with unsettled billing status will appear here for
                        factoring submission.
                      </p>
                    </td>
                  </tr>) : (queueLoads.map((load) => {
                const isSelected = selectedIds.includes(load.id);
                return (<tr key={load.id} className={`transition-colors ${isSelected
                        ? "bg-zinc-50 dark:bg-zinc-800/40"
                        : "hover:bg-zinc-50/60 dark:hover:bg-zinc-800/30"}`}>
                        <td className="p-4">
                          <input type="checkbox" checked={isSelected} onChange={() => toggleRow(load.id)} disabled={batchSubmitting} className="rounded border-zinc-300 dark:border-zinc-700 text-zinc-600 focus:ring-zinc-600"/>
                        </td>
                        <td className="p-4 font-mono text-xs font-bold text-zinc-900 dark:text-white">
                          {load.load_id}
                        </td>
                        <td className="p-4 text-zinc-700 dark:text-zinc-300">
                          {load.broker_name}
                        </td>
                        <td className="p-4 text-zinc-500 dark:text-zinc-400">{load.origin}</td>
                        <td className="p-4 text-zinc-500 dark:text-zinc-400">
                          {load.destination}
                        </td>
                        <td className="p-4 text-right font-bold text-emerald-600 dark:text-emerald-400">
                          ${fmt(load.gross_pay)}
                        </td>
                        <td className="p-4">
                          <div className="flex justify-end gap-2">
                            <button type="button" onClick={() => setSettleModalId(load.id)} className="text-[10px] font-bold px-3 py-1.5 rounded-lg border border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">
                              Settle
                            </button>
                            <button type="button" onClick={() => setActiveVaultLoad(load.id)} className="text-[10px] font-bold px-3 py-1.5 rounded-lg border border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors inline-flex items-center gap-1">
                              <FileText size={12}/>
                              Files
                            </button>
                          </div>
                        </td>
                      </tr>);
            }))}
              </tbody>
            </table>
          </div>
        </>)}

      {activeTab === "ar" && (<div className="p-5 space-y-6">
          {loadingAr ? (<div className="py-16 text-center text-zinc-400">
              <span className="inline-flex items-center gap-2 text-sm">
                <Loader2 size={16} className="animate-spin"/>
                Loading A/R funding tracker...
              </span>
            </div>) : arTotal === 0 && historicalFundedLoads.length === 0 ? (<div className="py-16 text-center px-6">
              <p className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-2">
                No active receivables in the funding pipeline
              </p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 max-w-lg mx-auto">
                Loads submitted to factoring or tracked on direct bill terms will appear here
                with live funding status.
              </p>
            </div>) : (<>
              {ACTIVE_AR_SECTIONS.map((section) => renderArSection(section, arBuckets[section.key] || []))}
              {renderArSection(FUNDED_SECTION, activeFundedLoads, (<span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wide">
                  Last {FUNDED_ACTIVE_DAYS} days
                </span>))}

              {historicalFundedLoads.length > 0 && (<div className="border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden">
                  <button type="button" onClick={() => setHistoricalLedgerOpen((open) => !open)} className="w-full px-4 py-3 bg-zinc-50 dark:bg-[#0B0B0B] hover:bg-zinc-100 dark:hover:bg-zinc-800/60 transition-colors flex items-center gap-2 text-left">
                    {historicalLedgerOpen ? (<ChevronDown size={16} className="text-zinc-500 shrink-0"/>) : (<ChevronRight size={16} className="text-zinc-400 shrink-0"/>)}
                    <span className="text-sm font-bold text-zinc-700 dark:text-zinc-200">
                      📜 View Historical Funded Ledger
                    </span>
                    <span className="ml-auto text-xs font-semibold text-zinc-500 dark:text-zinc-400">
                      {historicalFundedLoads.length} archived
                    </span>
                  </button>

                  <div className={`overflow-hidden transition-all duration-300 ease-in-out ${historicalLedgerOpen ? "max-h-[4000px] opacity-100" : "max-h-0 opacity-0"}`}>
                    <div className="border-t border-zinc-100 dark:border-zinc-800 overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead className="text-[9px] uppercase font-bold text-zinc-500 dark:text-zinc-400 bg-white dark:bg-[#161616]">
                          <tr>
                            <th className="p-3 text-left">Load ID</th>
                            <th className="p-3 text-left">Broker</th>
                            <th className="p-3 text-left">Lane</th>
                            <th className="p-3 text-right">Gross</th>
                            <th className="p-3 text-right">Funded</th>
                            <th className="p-3 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                          {historicalFundedLoads.map((load) => (<tr key={`historical-funded-${load.id}`} className="hover:bg-zinc-50/60 dark:hover:bg-zinc-800/30">
                              <td className="p-3 font-mono font-bold text-zinc-900 dark:text-white">
                                {load.load_id}
                              </td>
                              <td className="p-3 text-zinc-600 dark:text-zinc-300">
                                {load.broker_name}
                              </td>
                              <td className="p-3 text-zinc-500 dark:text-zinc-400">
                                {load.origin} → {load.destination}
                              </td>
                              <td className="p-3 text-right font-bold text-zinc-900 dark:text-white">
                                ${fmt(load.gross_pay)}
                              </td>
                              <td className="p-3 text-right text-zinc-500 dark:text-zinc-400">
                                {formatFundedDate(load)}
                              </td>
                              <td className="p-3">
                                <div className="flex justify-end">
                                  <button type="button" onClick={() => setActiveVaultLoad(load.id)} title="Open document vault" className="text-[10px] font-bold px-3 py-1.5 rounded-lg border border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors inline-flex items-center gap-1">
                                    <FolderOpen size={12}/>
                                    Files
                                  </button>
                                </div>
                              </td>
                            </tr>))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>)}
            </>)}
        </div>)}

      {batchSubmitting && (<div className="absolute inset-0 z-20 flex items-center justify-center bg-white/70 dark:bg-[#0B0B0B]/70 backdrop-blur-sm">
          <div className="flex items-center gap-3 text-sm text-zinc-600 dark:text-zinc-300">
            <Loader2 size={20} className="animate-spin"/>
            Packaging billing bundles and submitting to factoring...
          </div>
        </div>)}
    </section>);
}
