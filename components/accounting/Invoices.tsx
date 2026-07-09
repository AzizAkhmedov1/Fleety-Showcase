'use client';
import React, { useCallback, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { Banknote, ChevronLeft, ChevronRight, Loader2, X } from 'lucide-react';
import { formatApiError, resolveFiscalPeriodLockMessage } from '@/lib/api-client';
import { FACTORING_PROFILES, computeBatchFactoringMetrics, type FinancialInvoiceRow, type TmsApi, } from '@/lib/tms-api';
type InvoiceStatus = 'Draft' | 'Sent' | 'Paid' | 'Overdue' | 'Factored';
const STATUS_STYLES: Record<InvoiceStatus, string> = {
    Draft: 'border-zinc-300 bg-zinc-100 text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300',
    Sent: 'border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-400',
    Paid: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
    Overdue: 'border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-400',
    Factored: 'border-violet-500/30 bg-violet-500/10 text-violet-700 dark:text-violet-400',
};
const FACTORING_STATUS_STYLES: Record<string, string> = {
    UNFACTORED: 'border-zinc-500/30 bg-zinc-500/10 text-zinc-600 dark:text-zinc-400',
    SUBMITTED: 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400',
    FUNDED: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
    RECOURSE_CHALLENGED: 'border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-400',
};
const fmt = (n: number) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 });
const formatDisplayDate = (iso: string) => {
    const parsed = new Date(`${iso}T00:00:00`);
    if (Number.isNaN(parsed.getTime()))
        return iso;
    return parsed.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });
};
function resolveInvoiceStatus(status: string): InvoiceStatus {
    if (status === 'Draft' || status === 'Sent' || status === 'Paid' || status === 'Overdue' || status === 'Factored') {
        return status;
    }
    return 'Draft';
}
function isInvoiceEligibleForFactoring(inv: FinancialInvoiceRow): boolean {
    const status = resolveInvoiceStatus(inv.status);
    if (status === 'Paid' || status === 'Factored')
        return false;
    if (inv.is_factored)
        return false;
    const factoringStatus = inv.factoring_status ?? 'UNFACTORED';
    if (factoringStatus !== 'UNFACTORED')
        return false;
    if (inv.balance <= 0 && inv.amount <= 0)
        return false;
    return true;
}
export interface InvoicesLedgerProps {
    invoices: FinancialInvoiceRow[];
    page: number;
    perPage: number;
    total: number;
    onPageChange: (page: number) => void;
    markingPaidInvoiceId: number | null;
    onMarkPaid: (invoiceId: number) => Promise<void>;
    onRefresh: () => Promise<void>;
    client: TmsApi;
}
export default function InvoicesLedger({ invoices, page, perPage, total, onPageChange, markingPaidInvoiceId, onMarkPaid, onRefresh, client, }: InvoicesLedgerProps) {
    const [selectedInvoiceIds, setSelectedInvoiceIds] = useState<number[]>([]);
    const [profileIndex, setProfileIndex] = useState(0);
    const [batchSubmitting, setBatchSubmitting] = useState(false);
    const [batchBanner, setBatchBanner] = useState<string | null>(null);
    const totalPages = Math.max(1, Math.ceil(total / perPage));
    const eligibleIdsOnPage = useMemo(() => invoices.filter(isInvoiceEligibleForFactoring).map((inv) => inv.id), [invoices]);
    const selectedInvoices = useMemo(() => invoices.filter((inv) => selectedInvoiceIds.includes(inv.id)), [invoices, selectedInvoiceIds]);
    const batchPreview = useMemo(() => computeBatchFactoringMetrics(selectedInvoices, profileIndex), [selectedInvoices, profileIndex]);
    const showFactoringPanel = selectedInvoiceIds.length > 0;
    const toggleInvoiceSelection = useCallback((invoiceId: number, checked: boolean) => {
        setSelectedInvoiceIds((current) => {
            if (checked) {
                if (current.includes(invoiceId))
                    return current;
                return [...current, invoiceId];
            }
            return current.filter((id) => id !== invoiceId);
        });
    }, []);
    const toggleSelectAllEligible = useCallback((checked: boolean) => {
        if (!checked) {
            setSelectedInvoiceIds((current) => current.filter((id) => !eligibleIdsOnPage.includes(id)));
            return;
        }
        setSelectedInvoiceIds((current) => Array.from(new Set([...current, ...eligibleIdsOnPage])));
    }, [eligibleIdsOnPage]);
    const allEligibleSelected = eligibleIdsOnPage.length > 0 && eligibleIdsOnPage.every((id) => selectedInvoiceIds.includes(id));
    const handleSubmitFactoringBatch = async () => {
        if (selectedInvoiceIds.length === 0)
            return;
        setBatchSubmitting(true);
        setBatchBanner(null);
        try {
            const result = await client.financials.factorInvoiceBatch({
                invoice_ids: selectedInvoiceIds,
                profile_index: profileIndex,
            });
            setSelectedInvoiceIds([]);
            setBatchBanner(`Batch ${result.tracking_id} submitted — ${result.invoice_count} invoice(s), ${fmt(result.total_advance)} advance.`);
            await onRefresh();
        }
        catch (err) {
            console.error('Failed to submit factoring batch', err);
            toast.error(resolveFiscalPeriodLockMessage(err) ??
                formatApiError(err, 'Unable to submit factoring batch.'));
        }
        finally {
            setBatchSubmitting(false);
        }
    };
    return (<>
      {batchBanner && (<div className="mx-4 mt-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs font-semibold text-emerald-700 dark:text-emerald-300" role="status">
          {batchBanner}
        </div>)}

      <div className="overflow-x-auto flex-1">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-zinc-200 dark:border-zinc-800 text-zinc-500 dark:text-zinc-400">
              <th className="px-4 py-3 font-semibold whitespace-nowrap w-10">
                <input type="checkbox" checked={allEligibleSelected} disabled={eligibleIdsOnPage.length === 0} onChange={(event) => toggleSelectAllEligible(event.target.checked)} className="h-3.5 w-3.5 rounded border-zinc-400 text-violet-600 focus:ring-violet-500" aria-label="Select all eligible invoices"/>
              </th>
              {['Invoice #', 'Load ID', 'Broker', 'Issue Date', 'Amount', 'Status', 'Factoring', 'Actions'].map((col) => (<th key={col} className="px-4 py-3 font-semibold whitespace-nowrap">
                    {col}
                  </th>))}
            </tr>
          </thead>
          <tbody>
            {invoices.length === 0 ? (<tr>
                <td colSpan={9} className="px-4 py-10 text-center text-zinc-500">
                  No invoices match the current filters.
                </td>
              </tr>) : (invoices.map((inv, index) => {
            const status = resolveInvoiceStatus(inv.status);
            const eligible = isInvoiceEligibleForFactoring(inv);
            const factoringStatus = inv.factoring_status ?? 'UNFACTORED';
            return (<tr key={`${inv.id}-${index}`} className="border-b border-zinc-100 dark:border-zinc-800/60 hover:bg-zinc-50 dark:hover:bg-zinc-900/40 transition-colors">
                    <td className="px-4 py-3">
                      {eligible ? (<input type="checkbox" checked={selectedInvoiceIds.includes(inv.id)} onChange={(event) => toggleInvoiceSelection(inv.id, event.target.checked)} className="h-3.5 w-3.5 rounded border-zinc-400 text-violet-600 focus:ring-violet-500" aria-label={`Select invoice ${inv.invoice_number}`}/>) : (<span className="inline-block w-3.5"/>)}
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-semibold text-violet-600 dark:text-violet-400">
                        {inv.invoice_number}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400 tabular-nums whitespace-nowrap">
                      {inv.broker_load_id || (inv.load_id ? `L-${inv.load_id}` : '—')}
                    </td>
                    <td className="px-4 py-3 text-zinc-800 dark:text-zinc-200 whitespace-nowrap">{inv.customer_name}</td>
                    <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400 tabular-nums whitespace-nowrap">
                      {formatDisplayDate(inv.invoice_date)}
                    </td>
                    <td className="px-4 py-3 font-medium text-zinc-900 dark:text-white tabular-nums whitespace-nowrap">
                      <div className="flex flex-col">
                        <span>{fmt(inv.amount)}</span>
                        {inv.is_factored && inv.advance_amount != null && (<span className="text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
                            Adv {fmt(inv.advance_amount)}
                          </span>)}
                        {inv.is_factored && inv.reserve_held_amount != null && inv.reserve_held_amount > 0 && (<span className="text-[10px] font-medium text-amber-600 dark:text-amber-400">
                            Reserve {fmt(inv.reserve_held_amount)}
                          </span>)}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold ${STATUS_STYLES[status]}`}>
                        {status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold ${FACTORING_STATUS_STYLES[factoringStatus] ?? FACTORING_STATUS_STYLES.UNFACTORED}`}>
                        {factoringStatus.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        {status !== 'Paid' && status !== 'Factored' && (<button type="button" title="Mark as Paid" disabled={markingPaidInvoiceId === inv.id} onClick={() => void onMarkPaid(inv.id)} className="inline-flex items-center gap-1 rounded-md border border-emerald-500/30 px-2 py-1 text-[10px] font-semibold text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/10 disabled:opacity-50 transition-colors">
                            {markingPaidInvoiceId === inv.id ? (<Loader2 size={12} className="animate-spin"/>) : (<Banknote size={12}/>)}
                            Mark Paid
                          </button>)}
                      </div>
                    </td>
                  </tr>);
        }))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between gap-3 px-4 py-3 border-t border-zinc-200 dark:border-zinc-800 text-xs text-zinc-500">
        <span>
          Showing {total === 0 ? 0 : (page - 1) * perPage + 1}–{Math.min(page * perPage, total)} of {total}
        </span>
        <div className="flex items-center gap-1">
          <button type="button" disabled={page <= 1} onClick={() => onPageChange(Math.max(1, page - 1))} className="p-1.5 rounded-md border border-zinc-200 dark:border-zinc-700 disabled:opacity-40 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">
            <ChevronLeft size={14}/>
          </button>
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (<button key={p} type="button" onClick={() => onPageChange(p)} className={`min-w-[28px] h-7 rounded-md text-xs font-medium transition-colors ${p === page
                ? 'bg-violet-600 text-white'
                : 'border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800'}`}>
              {p}
            </button>))}
          <button type="button" disabled={page >= totalPages} onClick={() => onPageChange(Math.min(totalPages, page + 1))} className="p-1.5 rounded-md border border-zinc-200 dark:border-zinc-700 disabled:opacity-40 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">
            <ChevronRight size={14}/>
          </button>
        </div>
      </div>

      {showFactoringPanel && (<>
          <div className="fixed inset-0 z-40 bg-black/40" onClick={() => setSelectedInvoiceIds([])} aria-hidden="true"/>
          <aside className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col border-l border-zinc-800 bg-[#161616] shadow-2xl" role="dialog" aria-label="Factoring batch schedule">
            <div className="flex items-center justify-between border-b border-zinc-800 px-5 py-4">
              <div>
                <h3 className="text-sm font-semibold text-white">Factoring Batch</h3>
                <p className="text-xs text-zinc-400">{selectedInvoiceIds.length} invoice(s) selected</p>
              </div>
              <button type="button" onClick={() => setSelectedInvoiceIds([])} className="rounded-md p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-white transition-colors" aria-label="Close factoring panel">
                <X size={16}/>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
              <label className="block space-y-1.5">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
                  Factoring Company Profile
                </span>
                <select value={profileIndex} onChange={(event) => setProfileIndex(Number(event.target.value))} className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white focus:border-violet-500 focus:outline-none">
                  {FACTORING_PROFILES.map((profile) => (<option key={profile.index} value={profile.index}>
                      {profile.name}
                    </option>))}
                </select>
              </label>

              <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4 space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-zinc-400">Gross Invoice Value</span>
                  <span className="font-semibold text-white tabular-nums">{fmt(batchPreview.totalGross)}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-zinc-400">Total Advanced Cash</span>
                  <span className="font-semibold text-emerald-400 tabular-nums">{fmt(batchPreview.totalAdvance)}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-zinc-400">Cumulative Service Fees</span>
                  <span className="font-semibold text-amber-400 tabular-nums">{fmt(batchPreview.totalFees)}</span>
                </div>
                <div className="flex items-center justify-between text-xs border-t border-zinc-800 pt-3">
                  <span className="text-zinc-400">Expected Reserve Withholdings</span>
                  <span className="font-semibold text-violet-400 tabular-nums">{fmt(batchPreview.totalReserve)}</span>
                </div>
              </div>

              <div className="space-y-2">
                {selectedInvoices.map((inv) => {
                const line = batchPreview.lines.find((entry) => entry.invoiceId === inv.id);
                if (!line)
                    return null;
                return (<div key={inv.id} className="rounded-lg border border-zinc-800 bg-zinc-900/40 px-3 py-2 text-[11px] text-zinc-300">
                      <div className="font-semibold text-white">{inv.invoice_number}</div>
                      <div className="mt-1 flex justify-between tabular-nums">
                        <span>Advance</span>
                        <span className="text-emerald-400">{fmt(line.advanceCash)}</span>
                      </div>
                    </div>);
            })}
              </div>
            </div>

            <div className="border-t border-zinc-800 px-5 py-4">
              <button type="button" disabled={batchSubmitting || selectedInvoiceIds.length === 0} onClick={() => void handleSubmitFactoringBatch()} className="w-full rounded-lg bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-violet-500 disabled:opacity-50 transition-colors">
                {batchSubmitting ? (<span className="inline-flex items-center gap-2">
                    <Loader2 size={16} className="animate-spin"/>
                    Submitting Batch…
                  </span>) : ('Submit Factoring Batch')}
              </button>
            </div>
          </aside>
        </>)}
    </>);
}
