'use client';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { createApiClient, readPersistedTmsToken } from '@/lib/api-client';
import { createTmsApi, type BankTransactionRow, type LedgerCandidateRow, } from '@/lib/tms-api';
import { ArrowLeftRight, Check, Droplet, Landmark, Loader2, RefreshCw, } from 'lucide-react';
const PANEL = 'rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#161616]';
const MUTED = 'text-xs text-zinc-500 dark:text-zinc-400';
const fmt = (n: number) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 });
const formatDisplayDate = (iso: string) => {
    const parsed = new Date(`${iso}T00:00:00`);
    if (Number.isNaN(parsed.getTime()))
        return iso;
    return parsed.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};
const confidenceBadgeClass = (confidence: string) => {
    if (confidence === 'EXACT') {
        return 'bg-green-500/15 text-green-700 dark:text-green-400 border-green-500/30';
    }
    if (confidence === 'HIGH') {
        return 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30';
    }
    return 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30';
};
interface BankReconciliationProps {
    variant?: 'footer' | 'workspace';
}
export default function BankReconciliation({ variant = 'footer' }: BankReconciliationProps) {
    const api = useMemo(() => createTmsApi(createApiClient(readPersistedTmsToken())), []);
    const [connected, setConnected] = useState(false);
    const [bankSource, setBankSource] = useState('');
    const [bankRows, setBankRows] = useState<BankTransactionRow[]>([]);
    const [ledgerCandidates, setLedgerCandidates] = useState<LedgerCandidateRow[]>([]);
    const [selectedBankId, setSelectedBankId] = useState<number | null>(null);
    const [loading, setLoading] = useState(true);
    const [connecting, setConnecting] = useState(false);
    const [matchingId, setMatchingId] = useState<number | null>(null);
    const [error, setError] = useState<string | null>(null);
    const loadFeed = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            let payload = await api.financials.accountingBankTransactions();
            if (payload.connected && payload.data.length > 0) {
                try {
                    await api.financials.accountingBankAutoMatch();
                    payload = await api.financials.accountingBankTransactions();
                }
                catch { }
            }
            setConnected(payload.connected);
            setBankSource(payload.source);
            setBankRows(payload.data);
            setLedgerCandidates(payload.ledger_candidates);
            setSelectedBankId((prev) => {
                if (payload.data.length === 0)
                    return null;
                if (prev && payload.data.some((row) => row.id === prev))
                    return prev;
                return payload.data[0]?.id ?? null;
            });
        }
        catch {
            setError('Unable to load bank reconciliation feed.');
        }
        finally {
            setLoading(false);
        }
    }, [api]);
    useEffect(() => {
        void loadFeed();
    }, [loadFeed]);
    const selectedBank = useMemo(() => bankRows.find((row) => row.id === selectedBankId) ?? null, [bankRows, selectedBankId]);
    const activeLedgerId = useMemo(() => {
        if (!selectedBank)
            return null;
        return selectedBank.suggested_ledger_id ?? null;
    }, [selectedBank]);
    const handleConnect = async () => {
        setConnecting(true);
        setError(null);
        try {
            const publicToken = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
                ? `public-sandbox-${crypto.randomUUID()}`
                : `public-sandbox-${Date.now()}`;
            const result = await api.financials.accountingBankConnect({
                public_token: publicToken,
                institution_name: 'Sandbox Bank',
                account_mask: '0000',
            });
            setConnected(result.connected);
            setBankSource(result.source);
            await loadFeed();
        }
        catch {
            setError('Bank link verification failed. Confirm your public token and try again.');
        }
        finally {
            setConnecting(false);
        }
    };
    const handleApproveStagedMatch = async (bankRow: BankTransactionRow) => {
        setMatchingId(bankRow.id);
        setError(null);
        try {
            const result = await api.financials.accountingBankApproveMatch({
                bank_transaction_id: bankRow.id,
            });
            setBankRows((prev) => prev.filter((row) => row.id !== bankRow.id));
            if (result.ledger_transaction_id) {
                setLedgerCandidates((prev) => prev.filter((row) => row.id !== result.ledger_transaction_id));
            }
            setSelectedBankId((prev) => (prev === bankRow.id ? null : prev));
        }
        catch {
            setError('Unable to approve staged match. Verify the ledger entry is still available.');
        }
        finally {
            setMatchingId(null);
        }
    };
    const handleAcceptMatch = async (bankRow: BankTransactionRow, ledgerId: number) => {
        setMatchingId(bankRow.id);
        setError(null);
        try {
            await api.financials.accountingBankMatch({
                bank_transaction_id: bankRow.id,
                ledger_transaction_id: ledgerId,
            });
            setBankRows((prev) => prev.filter((row) => row.id !== bankRow.id));
            setLedgerCandidates((prev) => prev.filter((row) => row.id !== ledgerId));
            setSelectedBankId((prev) => (prev === bankRow.id ? null : prev));
        }
        catch {
            setError('Match failed. Verify amounts are within the $5.00 tolerance.');
        }
        finally {
            setMatchingId(null);
        }
    };
    const showSplitPane = connected;
    const isWorkspace = variant === 'workspace';
    if (isWorkspace && !connected && !loading) {
        return (<div className="flex-1 flex flex-col items-center justify-center py-16 px-6 text-center">
        <Landmark size={32} className="text-violet-500/70 mb-3"/>
        <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Bank Transactions</p>
        <p className={`${MUTED} mt-1 max-w-sm`}>
          Start a secure aggregator link handshake to attach this workspace bank feed. Statement
          lines appear after the provider syncs.
        </p>
        <button type="button" onClick={() => void handleConnect()} disabled={connecting} className="mt-4 inline-flex items-center gap-2 rounded-lg bg-violet-600 hover:bg-violet-500 disabled:opacity-60 text-white px-4 py-2 text-sm font-semibold transition-colors">
          {connecting ? <Loader2 size={16} className="animate-spin"/> : <Droplet size={16}/>}
          {connecting ? 'Verifying link token…' : 'Initialize Bank Link'}
        </button>
      </div>);
    }
    return (<section className={`${PANEL} relative overflow-hidden ${isWorkspace
            ? 'flex-1 flex flex-col border-0 rounded-none bg-transparent dark:bg-transparent'
            : 'p-5 border-violet-500/20 dark:border-violet-500/25 bg-gradient-to-r from-violet-500/5 via-transparent to-emerald-500/5'}`}>
      {connecting && (<div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-zinc-900/70 backdrop-blur-sm">
          <Loader2 size={28} className="animate-spin text-violet-400 mb-3"/>
          <p className="text-sm font-medium text-white">Verifying link token…</p>
          <p className={`${MUTED} mt-1 text-zinc-300`}>Authenticating aggregator handshake</p>
        </div>)}

      {!isWorkspace && (<div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-violet-500/10 border border-violet-500/20">
              <Landmark size={22} className="text-violet-500 dark:text-violet-400"/>
            </div>
            <div>
              <h3 className="text-sm font-bold text-zinc-900 dark:text-white">Bank Reconciliation</h3>
              <p className={`${MUTED} mt-0.5 max-w-lg`}>
                {connected
                ? `Linked to ${bankSource || 'bank feed'} — ${bankRows.length} unreconciled line${bankRows.length === 1 ? '' : 's'}`
                : 'Initialize a secure bank link to reconcile aggregator statement lines against the ledger'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {connected && (<button type="button" onClick={() => void loadFeed()} disabled={loading} className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 px-3 py-2 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">
                <RefreshCw size={14} className={loading ? 'animate-spin' : ''}/>
                Refresh
              </button>)}
            {!connected && (<button type="button" onClick={() => void handleConnect()} disabled={connecting} className="inline-flex items-center gap-2 rounded-lg bg-violet-600 hover:bg-violet-500 disabled:opacity-60 text-white px-4 py-2.5 text-sm font-semibold transition-colors shadow-sm">
                {connecting ? (<Loader2 size={16} className="animate-spin opacity-80"/>) : (<Droplet size={16} className="opacity-80"/>)}
                {connecting ? 'Verifying link token…' : 'Initialize Bank Link'}
              </button>)}
          </div>
        </div>)}

      {error && (<p className="mt-3 text-xs text-rose-500 dark:text-rose-400">{error}</p>)}

      {showSplitPane && (<div className={`${isWorkspace ? 'flex-1 mt-0' : 'mt-5'} grid grid-cols-1 lg:grid-cols-2 gap-4 min-h-0`}>
          
          <div className="flex flex-col rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/40 overflow-hidden min-h-[280px]">
            <div className="px-4 py-3 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                  Bank Statement
                </p>
                <p className="text-[11px] text-zinc-400 mt-0.5">{bankSource}</p>
              </div>
              <span className="text-[11px] font-medium text-violet-600 dark:text-violet-400 tabular-nums">
                {bankRows.length} open
              </span>
            </div>
            <div className="flex-1 overflow-y-auto divide-y divide-zinc-200/80 dark:divide-zinc-800/80">
              {loading && bankRows.length === 0 ? (<div className="flex items-center justify-center py-12 text-zinc-400">
                  <Loader2 size={20} className="animate-spin"/>
                </div>) : bankRows.length === 0 ? (<div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                  <Landmark size={24} className="text-zinc-400 mb-2"/>
                  <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                    No bank transactions on file
                  </p>
                  <p className={`${MUTED} mt-1`}>
                    Linked accounts stay empty until your aggregator syncs statement lines.
                  </p>
                </div>) : (bankRows.map((row) => {
                const isSelected = row.id === selectedBankId;
                const ledgerId = row.suggested_ledger_id;
                const staged = row.staged_match;
                return (<div key={row.id} role="button" tabIndex={0} onClick={() => setSelectedBankId(row.id)} onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ')
                            setSelectedBankId(row.id);
                    }} className={`w-full text-left px-4 py-3 transition-colors cursor-pointer ${isSelected
                        ? 'bg-violet-500/10 border-l-2 border-l-violet-500'
                        : 'hover:bg-zinc-100/80 dark:hover:bg-zinc-800/50 border-l-2 border-l-transparent'}`}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100 truncate">
                            {row.description}
                          </p>
                          <p className={`${MUTED} mt-0.5`}>{formatDisplayDate(row.date)}</p>
                        </div>
                        <p className={`text-sm font-semibold tabular-nums shrink-0 ${row.amount >= 0
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-rose-600 dark:text-rose-400'}`}>
                          {fmt(row.amount)}
                        </p>
                      </div>
                      {staged && (<div className="mt-2 flex flex-wrap items-center gap-2">
                          <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-semibold ${confidenceBadgeClass(staged.confidence)}`}>
                            Match Found: {staged.target_description}
                          </span>
                          <button type="button" onClick={(e) => {
                            e.stopPropagation();
                            void handleApproveStagedMatch(row);
                        }} disabled={matchingId === row.id} className="inline-flex items-center gap-1.5 rounded-md bg-violet-600 hover:bg-violet-500 disabled:opacity-60 text-white px-2.5 py-1 text-[11px] font-semibold transition-colors">
                            {matchingId === row.id ? (<Loader2 size={12} className="animate-spin"/>) : (<Check size={12}/>)}
                            Approve Match
                          </button>
                        </div>)}
                      {!staged && ledgerId && isSelected && (<button type="button" onClick={(e) => {
                            e.stopPropagation();
                            void handleAcceptMatch(row, ledgerId);
                        }} disabled={matchingId === row.id} className="mt-2 inline-flex items-center gap-1.5 rounded-md bg-violet-600 hover:bg-violet-500 disabled:opacity-60 text-white px-2.5 py-1 text-[11px] font-semibold transition-colors">
                          {matchingId === row.id ? (<Loader2 size={12} className="animate-spin"/>) : (<Check size={12}/>)}
                          Accept Match
                        </button>)}
                    </div>);
            }))}
            </div>
          </div>

          
          <div className="flex flex-col rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/40 overflow-hidden min-h-[280px]">
            <div className="px-4 py-3 border-b border-zinc-200 dark:border-zinc-800 flex items-center gap-2">
              <ArrowLeftRight size={14} className="text-zinc-400"/>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                  Ledger Matches
                </p>
                <p className="text-[11px] text-zinc-400 mt-0.5">Closest date &amp; amount pairs</p>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto divide-y divide-zinc-200/80 dark:divide-zinc-800/80">
              {ledgerCandidates.length === 0 ? (<div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                  <p className={`${MUTED}`}>No open ledger entries available for matching.</p>
                </div>) : (ledgerCandidates.map((ledger) => {
                const isSuggested = ledger.id === activeLedgerId;
                const bankRow = selectedBank;
                return (<div key={ledger.id} className={`px-4 py-3 transition-colors ${isSuggested
                        ? 'bg-emerald-500/10 border-l-2 border-l-emerald-500'
                        : 'border-l-2 border-l-transparent'}`}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100 truncate">
                            {ledger.label}
                          </p>
                          <p className={`${MUTED} mt-0.5`}>
                            {formatDisplayDate(ledger.transaction_date)} · {ledger.type}
                          </p>
                        </div>
                        <p className={`text-sm font-semibold tabular-nums shrink-0 ${ledger.signed_amount >= 0
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-rose-600 dark:text-rose-400'}`}>
                          {fmt(ledger.signed_amount)}
                        </p>
                      </div>
                      {isSuggested && bankRow && (<div className="mt-2 flex items-center justify-between gap-2">
                          <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
                            Suggested match
                            {bankRow.suggested_ledger_signed_amount != null &&
                            Math.abs(bankRow.amount - (bankRow.suggested_ledger_signed_amount ?? 0)) > 0 && (<span className="text-amber-600 dark:text-amber-400 ml-1">
                                  (Δ{' '}
                                  {fmt(Math.abs(bankRow.amount -
                                (bankRow.suggested_ledger_signed_amount ?? 0)))}
                                  )
                                </span>)}
                          </span>
                          <button type="button" onClick={() => void handleAcceptMatch(bankRow, ledger.id)} disabled={matchingId === bankRow.id} className="inline-flex items-center gap-1.5 rounded-md bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white px-2.5 py-1 text-[11px] font-semibold transition-colors">
                            {matchingId === bankRow.id ? (<Loader2 size={12} className="animate-spin"/>) : (<Check size={12}/>)}
                            Accept Match
                          </button>
                        </div>)}
                    </div>);
            }))}
            </div>
          </div>
        </div>)}
    </section>);
}
