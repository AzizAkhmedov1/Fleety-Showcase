'use client';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { usePathname } from 'next/navigation';
import toast from 'react-hot-toast';
import BankReconciliation from '@/components/accounting/BankReconciliation';
import InvoicesLedger from '@/components/accounting/Invoices';
import { createApiClient, formatApiError, hasValidTmsToken, readPersistedTmsToken, resolveFiscalPeriodLockMessage, FISCAL_PERIOD_LOCK_BANNER_MESSAGE } from '@/lib/api-client';
import { createTmsApi, type FinancialAccountingCharts, type FinancialAccountingSummary, type FinancialAgingSummary, type FinancialBillRow, type FinancialCashFlow, type FinancialInvoiceRow, type FinancialUninvoicedLoad, type FinancialJournalEntryRow, type FinancialPaymentRow, type FinancialPeriodClosingHealth, type FinancialProfitAndLoss, type FinancialRecentTransaction, type FinancialTrendMetrics, type ChartOfAccountRow, type VendorBillCategory, } from '@/lib/tms-api';
import { DASHBOARD_BEFORE_NAVIGATE_EVENT, DASHBOARD_ROUTES } from '@/lib/dashboard-routes';
import { ArrowDownRight, ArrowUpRight, Banknote, Building2, Calendar, ChevronDown, ChevronLeft, ChevronRight, Download, Loader2, Lock, Plus, Receipt, RefreshCw, Trash2, X, Search, TrendingDown, TrendingUp, Wallet, } from 'lucide-react';
const FuelIftaDashboard = dynamic(() => import('@/components/fuel-ifta/FuelIftaDashboard'), {
    ssr: false,
    loading: () => (<div className="animate-pulse bg-zinc-100 dark:bg-zinc-800 rounded-xl h-[520px] w-full"/>),
});
const Payroll = dynamic(() => import('@/components/Payroll'), {
    ssr: false,
    loading: () => (<div className="animate-pulse bg-zinc-100 dark:bg-zinc-800 rounded-xl h-[360px] w-full"/>),
});
const CARD = 'rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/60';
const PANEL = 'rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#161616]';
const LABEL = 'text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400';
const MUTED = 'text-xs text-zinc-500 dark:text-zinc-400';
const fmt = (n: number) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 });
const moneyRound = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;
const computeFactoringPreview = (amount: number, feePct: number, reservePct: number) => {
    const fee = moneyRound(Math.max(0, amount) * (Math.max(0, feePct) / 100));
    const reserve = moneyRound(Math.max(0, amount) * (Math.max(0, reservePct) / 100));
    const advance = moneyRound(Math.max(0, amount) - fee - reserve);
    return { fee, reserve, advance };
};
function isFiscalPeriodLockMessage(message: string | null | undefined): boolean {
    if (!message)
        return false;
    return message === FISCAL_PERIOD_LOCK_BANNER_MESSAGE || message.startsWith('Transaction Denied:');
}
function LedgerFormErrorBanner({ message }: {
    message: string;
}) {
    const locked = isFiscalPeriodLockMessage(message);
    return (<div className={locked
            ? 'rounded-lg border border-rose-500/40 bg-rose-500/15 px-3 py-2.5 text-xs font-semibold text-rose-700 dark:text-rose-300'
            : 'text-xs text-rose-500 dark:text-rose-400'} role="alert">
      {message}
    </div>);
}
const formatDisplayDate = (iso: string) => {
    const parsed = new Date(`${iso}T00:00:00`);
    if (Number.isNaN(parsed.getTime()))
        return iso;
    return parsed.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });
};
const formatTrendSub = (pct: number) => `${pct >= 0 ? '+' : ''}${pct.toFixed(1)}% vs last week`;
const AGING_COLORS: Record<string, string> = {
    '0-30 Days': '#10b981',
    '31-60 Days': '#3b82f6',
    '61-90 Days': '#f59e0b',
    '90+ Days': '#ef4444',
};
const EMPTY_CASH_FLOW: FinancialCashFlow = {
    weeks: [
        { label: 'W1', inflow: 0, outflow: 0 },
        { label: 'W2', inflow: 0, outflow: 0 },
        { label: 'W3', inflow: 0, outflow: 0 },
        { label: 'W4', inflow: 0, outflow: 0 },
    ],
    total_cash_inflow: 0,
    total_cash_outflow: 0,
    net_cash_flow: 0,
};
type ChartPayload = FinancialAccountingCharts & {
    profit_loss?: FinancialProfitAndLoss;
};
type AgingPayload = FinancialAgingSummary & {
    breakdown?: Record<string, {
        pct?: number;
        amount?: number;
    }>;
};
interface AgingSegment {
    tier: string;
    pct: number;
    amount: number;
    color: string;
}
const AGING_BREAKDOWN_LABELS: Record<string, string> = {
    '0_30': '0-30 Days',
    '31_60': '31-60 Days',
    '61_90': '61-90 Days',
    '90_plus': '90+ Days',
    '90+': '90+ Days',
};
const AGING_BREAKDOWN_COLORS: Record<string, string> = {
    '0_30': '#10b981',
    '31_60': '#3b82f6',
    '61_90': '#f59e0b',
    '90_plus': '#ef4444',
    '90+': '#ef4444',
};
function resolveChartProfitLoss(chartData: ChartPayload | null): FinancialProfitAndLoss | null {
    if (!chartData)
        return null;
    return chartData.profit_loss ?? chartData.profit_and_loss ?? null;
}
function resolveAgingSegments(agingSummary: AgingPayload | null): AgingSegment[] {
    if (!agingSummary)
        return [];
    if (agingSummary.breakdown && Object.keys(agingSummary.breakdown).length > 0) {
        return Object.entries(agingSummary.breakdown).map(([key, val]) => ({
            tier: AGING_BREAKDOWN_LABELS[key] ?? key,
            pct: val?.pct ?? 0,
            amount: val?.amount ?? 0,
            color: AGING_BREAKDOWN_COLORS[key] ?? '#71717a',
        }));
    }
    const buckets = agingSummary.buckets ?? [];
    return buckets.map((seg) => ({
        tier: seg.tier,
        pct: seg.pct ?? 0,
        amount: seg.amount ?? 0,
        color: AGING_COLORS[seg.tier] ?? '#71717a',
    }));
}
function formatRelativeTime(iso: string): string {
    const parsed = new Date(iso);
    if (Number.isNaN(parsed.getTime()))
        return iso || '—';
    const diffMs = Date.now() - parsed.getTime();
    const diffMinutes = Math.floor(diffMs / 60000);
    if (diffMinutes < 1)
        return 'Just now';
    if (diffMinutes < 60)
        return `${diffMinutes}m ago`;
    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24)
        return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays === 1)
        return 'Yesterday';
    if (diffDays < 7)
        return `${diffDays} days ago`;
    return parsed.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
type InvoiceStatus = 'Draft' | 'Finalized' | 'Paid' | 'Factored' | 'Sent' | 'Partial' | 'Overdue';
const INVOICE_STATUS_OPTIONS = ['All', 'Draft', 'Finalized', 'Paid', 'Factored', 'Sent', 'Partial', 'Overdue'] as const;
type BillStatus = 'Unpaid' | 'Partially Paid' | 'Paid';
const LEDGER_TABS = ['Invoices', 'Payments', 'Bills', 'Journal Entries', 'Bank Transactions'] as const;
const LEDGER_TAB_EXPORT_MAP: Partial<Record<(typeof LEDGER_TABS)[number], 'invoices' | 'payments' | 'bills' | 'journal_entries'>> = {
    Invoices: 'invoices',
    Payments: 'payments',
    Bills: 'bills',
    'Journal Entries': 'journal_entries',
};
const CHART_RANGE_OPTIONS = ['This Month', 'Last Month', 'This Quarter', 'YTD'] as const;
const BILL_CATEGORIES: VendorBillCategory[] = [
    'Maintenance',
    'Office Supply',
    'Insurance',
    'Fuel',
    'Software',
    'Other',
];
const BILL_STATUS_OPTIONS = ['All', 'Unpaid', 'Partially Paid', 'Paid'] as const;
interface JournalLineFormRow {
    account_id: number;
    debit_amount: string;
    credit_amount: string;
}
const SECTION_TABS = [
    { id: 'financial' as const, label: 'Financial Overview' },
    { id: 'payroll' as const, label: 'Payroll' },
    { id: 'fuel' as const, label: 'Fuel & IFTA Compliance' },
];
const STATUS_STYLES: Record<InvoiceStatus, string> = {
    Draft: 'bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 border-zinc-500/25',
    Finalized: 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border-indigo-500/25',
    Paid: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/25',
    Factored: 'bg-violet-500/10 text-violet-700 dark:text-violet-400 border-violet-500/25',
    Sent: 'bg-sky-500/10 text-sky-700 dark:text-sky-400 border-sky-500/25',
    Partial: 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/25',
    Overdue: 'bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/25',
};
const BILL_STATUS_STYLES: Record<BillStatus, string> = {
    Unpaid: 'bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/25',
    'Partially Paid': 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/25',
    Paid: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/25',
};
const todayIsoDate = () => new Date().toISOString().slice(0, 10);
const buildCloseMonthOptions = () => {
    const options: {
        value: string;
        label: string;
        year: number;
        month: number;
    }[] = [];
    const now = new Date();
    for (let offset = 0; offset < 24; offset += 1) {
        const anchor = new Date(now.getFullYear(), now.getMonth() - offset, 1);
        const year = anchor.getFullYear();
        const month = anchor.getMonth() + 1;
        options.push({
            value: `${year}-${String(month).padStart(2, '0')}`,
            label: anchor.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
            year,
            month,
        });
    }
    return options;
};
const downloadBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
};
const currentMonthFilterValue = () => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
};
interface ChartSeriesPoint {
    day: number;
    label: string;
    revenue: number;
    expenses: number;
}
function timelineToSeries(timeline: FinancialAccountingCharts['timeline']): ChartSeriesPoint[] {
    return timeline.map((point) => {
        const parsed = new Date(`${point.date}T00:00:00`);
        const day = parsed.getDate();
        const label = Number.isNaN(parsed.getTime())
            ? point.date
            : parsed.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        return { day, label, revenue: point.revenue, expenses: point.expenses };
    });
}
function buildPnlLines(pnl: FinancialProfitAndLoss | null) {
    const totalRevenue = pnl?.total_revenue ?? 0;
    const costOfSales = pnl?.cost_of_sales ?? 0;
    const grossProfit = pnl?.gross_profit ?? 0;
    const grossMarginPct = pnl?.gross_margin_pct ?? 0;
    const fuelIftaExpenses = pnl?.fuel_ifta_expenses ?? 0;
    const operatingExpenses = pnl?.operating_expenses ?? 0;
    const netProfit = pnl?.net_profit ?? 0;
    const netMarginPct = pnl?.net_margin_pct ?? 0;
    return [
        { label: 'Total Revenue', value: totalRevenue, bold: false },
        { label: 'Total Cost of Sales', value: costOfSales, bold: false },
        {
            label: 'Gross Profit',
            value: grossProfit,
            bold: true,
            badge: `${grossMarginPct.toFixed(1)}% Gross Margin`,
            badgeClass: 'bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/25',
        },
        { label: 'Fuel & IFTA', value: fuelIftaExpenses, bold: false },
        { label: 'Operating Expenses', value: operatingExpenses, bold: false },
        {
            label: 'Net Profit',
            value: netProfit,
            bold: true,
            badge: `${netMarginPct.toFixed(1)}% Net Margin`,
            badgeClass: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/25',
        },
    ];
}
function buildMetricCards(summary: FinancialAccountingSummary | null) {
    const trends: FinancialTrendMetrics | undefined = summary?.trends;
    return [
        {
            key: 'revenue',
            label: 'Total Revenue',
            value: summary?.total_revenue ?? 0,
            sub: trends ? formatTrendSub(trends.revenue_pct) : '—',
            trend: (trends && trends.revenue_pct >= 0 ? 'up' : 'down') as 'up' | 'down',
            icon: TrendingUp,
            accent: 'text-emerald-500',
            badge: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
        },
        {
            key: 'expenses',
            label: 'Total Expenses',
            value: summary?.total_expenses ?? 0,
            sub: trends ? formatTrendSub(trends.expenses_pct) : '—',
            trend: (trends && trends.expenses_pct > 0 ? 'down' : 'up') as 'up' | 'down',
            icon: TrendingDown,
            accent: 'text-rose-500',
            badge: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20',
        },
        {
            key: 'net',
            label: 'Net Profit',
            value: summary?.net_profit ?? 0,
            sub: trends ? formatTrendSub(trends.net_profit_pct) : '—',
            trend: (trends && trends.net_profit_pct >= 0 ? 'up' : 'down') as 'up' | 'down',
            icon: Wallet,
            accent: 'text-violet-400',
            badge: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
        },
        {
            key: 'ar',
            label: 'Accounts Receivable',
            value: summary?.accounts_receivable ?? 0,
            sub: `Due from ${summary?.ar_customers ?? 0} customers`,
            trend: 'neutral' as const,
            icon: Receipt,
            accent: 'text-sky-400',
            badge: 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20',
        },
        {
            key: 'ap',
            label: 'Accounts Payable',
            value: summary?.accounts_payable ?? 0,
            sub: 'Unlinked driver pay',
            trend: 'neutral' as const,
            icon: Building2,
            accent: 'text-amber-400',
            badge: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
        },
        {
            key: 'cash',
            label: 'Cash Balance',
            value: summary?.cash_balance ?? 0,
            sub: 'Updated just now',
            trend: 'neutral' as const,
            icon: Banknote,
            accent: 'text-emerald-400',
            badge: 'bg-zinc-500/10 text-zinc-600 dark:text-zinc-300 border-zinc-500/20',
        },
    ];
}
function TrendBadge({ trend, sub, badgeClass }: {
    trend: 'up' | 'down' | 'neutral';
    sub: string;
    badgeClass: string;
}) {
    if (trend === 'neutral') {
        return (<span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium ${badgeClass}`}>
        {sub}
      </span>);
    }
    const Icon = trend === 'up' ? ArrowUpRight : ArrowDownRight;
    return (<span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium ${badgeClass}`}>
      <Icon size={11}/>
      {sub}
    </span>);
}
function RevenueExpensesChart({ series, rangeType, onRangeTypeChange, chartLoading, }: {
    series: ChartSeriesPoint[];
    rangeType: string;
    onRangeTypeChange: (range: (typeof CHART_RANGE_OPTIONS)[number]) => void;
    chartLoading?: boolean;
}) {
    const [periodOpen, setPeriodOpen] = useState(false);
    const [hover, setHover] = useState<{
        x: number;
        y: number;
        label: string;
        revenue: number;
        expenses: number;
    } | null>(null);
    const W = 560;
    const H = 200;
    const pad = { t: 16, r: 12, b: 28, l: 44 };
    const innerW = W - pad.l - pad.r;
    const innerH = H - pad.t - pad.b;
    const maxVal = Math.max(1, ...series.flatMap((d) => [d.revenue, d.expenses])) * 1.1;
    const toX = (i: number) => series.length <= 1 ? pad.l + innerW / 2 : pad.l + (i / (series.length - 1)) * innerW;
    const toY = (v: number) => pad.t + innerH - (v / maxVal) * innerH;
    const revenuePath = series.length > 0
        ? series.map((d, i) => `${i === 0 ? 'M' : 'L'}${toX(i).toFixed(1)},${toY(d.revenue).toFixed(1)}`).join(' ')
        : '';
    const expensePath = series.length > 0
        ? series.map((d, i) => `${i === 0 ? 'M' : 'L'}${toX(i).toFixed(1)},${toY(d.expenses).toFixed(1)}`).join(' ')
        : '';
    return (<div className={`${PANEL} p-5 lg:col-span-6`}>
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <h3 className="text-sm font-bold text-zinc-900 dark:text-white">Revenue vs Expenses</h3>
          <p className={`${MUTED} mt-0.5`}>Daily performance — {rangeType}</p>
        </div>
        <div className="relative">
          <button type="button" onClick={() => setPeriodOpen((o) => !o)} disabled={chartLoading} className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900/60 px-3 py-1.5 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors disabled:opacity-60">
            {rangeType}
            {chartLoading ? (<Loader2 size={14} className="animate-spin"/>) : (<ChevronDown size={14} className={`transition-transform ${periodOpen ? 'rotate-180' : ''}`}/>)}
          </button>
          {periodOpen && (<div className="absolute right-0 top-full z-20 mt-1 min-w-[140px] rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-lg py-1">
              {CHART_RANGE_OPTIONS.map((opt) => (<button key={opt} type="button" onClick={() => {
                    onRangeTypeChange(opt);
                    setPeriodOpen(false);
                }} className={`block w-full px-3 py-1.5 text-left text-xs transition-colors ${opt === rangeType
                    ? 'text-violet-600 dark:text-violet-400 bg-violet-500/10'
                    : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800'}`}>
                  {opt}
                </button>))}
            </div>)}
        </div>
      </div>

      <div className="flex items-center gap-4 mb-3">
        <span className="inline-flex items-center gap-1.5 text-xs text-zinc-600 dark:text-zinc-400">
          <span className="h-2 w-2 rounded-full bg-violet-400"/> Revenue
        </span>
        <span className="inline-flex items-center gap-1.5 text-xs text-zinc-600 dark:text-zinc-400">
          <span className="h-2 w-2 rounded-full bg-rose-400"/> Expenses
        </span>
      </div>

      <div className="relative w-full overflow-x-auto">
        {series.length === 0 ? (<div className="flex h-[200px] items-center justify-center text-xs text-zinc-500">No chart data available</div>) : (<svg viewBox={`0 0 ${W} ${H}`} className="w-full min-w-[320px] h-[200px]" role="img" aria-label="Revenue vs expenses line chart">
          {[0, 0.25, 0.5, 0.75, 1].map((pct) => {
                const y = pad.t + innerH * (1 - pct);
                const val = Math.round(maxVal * pct);
                return (<g key={pct}>
                <line x1={pad.l} y1={y} x2={W - pad.r} y2={y} stroke="currentColor" className="text-zinc-200 dark:text-zinc-800" strokeWidth={1}/>
                <text x={pad.l - 6} y={y + 4} textAnchor="end" className="fill-zinc-400 text-[9px]">
                  ${(val / 1000).toFixed(0)}k
                </text>
              </g>);
            })}
          <path d={revenuePath} fill="none" stroke="#a78bfa" strokeWidth={2} strokeLinejoin="round"/>
          <path d={expensePath} fill="none" stroke="#fb7185" strokeWidth={2} strokeLinejoin="round" strokeDasharray="4 3"/>
          {series.map((d, i) => {
                if (i % 5 !== 0 && i !== series.length - 1)
                    return null;
                return (<text key={`text-${d.day}-${i}`} x={toX(i)} y={H - 6} textAnchor="middle" className="fill-zinc-500 text-[8px]">
                {d.day}
              </text>);
            })}
          {series.map((d, i) => (<circle key={`hit-${d.day}-${i}`} cx={toX(i)} cy={toY(d.revenue)} r={6} fill="transparent" className="cursor-pointer" onMouseEnter={() => setHover({ x: toX(i), y: toY(d.revenue), label: d.label, revenue: d.revenue, expenses: d.expenses })} onMouseLeave={() => setHover(null)}/>))}
          {hover && (<g>
              <line x1={hover.x} y1={pad.t} x2={hover.x} y2={pad.t + innerH} stroke="#a78bfa" strokeWidth={1} strokeDasharray="3 3" opacity={0.5}/>
              <foreignObject x={Math.min(hover.x - 70, W - 150)} y={Math.max(hover.y - 72, 4)} width={140} height={64}>
                <div className="rounded-lg border border-zinc-700 bg-zinc-900/95 px-2.5 py-2 text-[10px] shadow-xl">
                  <p className="font-semibold text-white mb-1">{hover.label}</p>
                  <p className="text-violet-300">Rev: {fmt(hover.revenue)}</p>
                  <p className="text-rose-300">Exp: {fmt(hover.expenses)}</p>
                </div>
              </foreignObject>
            </g>)}
        </svg>)}
      </div>
    </div>);
}
function ProfitLossPanel({ lines, }: {
    lines: ReturnType<typeof buildPnlLines>;
}) {
    return (<div className={`${PANEL} p-5 lg:col-span-3 flex flex-col`}>
      <h3 className="text-sm font-bold text-zinc-900 dark:text-white mb-4">Profit &amp; Loss Summary</h3>
      <div className="flex-1 space-y-3">
        {lines.map((line) => (<div key={line.label} className={`flex items-center justify-between gap-2 py-2 border-b border-zinc-100 dark:border-zinc-800/80 last:border-0 ${line.bold ? 'pt-3' : ''}`}>
            <div className="min-w-0">
              <p className={`text-sm ${line.bold ? 'font-semibold text-zinc-900 dark:text-white' : 'text-zinc-600 dark:text-zinc-400'}`}>
                {line.label}
              </p>
              {line.badge && (<span className={`inline-flex mt-1 rounded-full border px-2 py-0.5 text-[10px] font-medium ${line.badgeClass}`}>
                  {line.badge}
                </span>)}
            </div>
            <p className={`shrink-0 text-sm tabular-nums ${line.bold ? 'font-bold text-zinc-900 dark:text-white' : 'text-zinc-700 dark:text-zinc-300'}`}>
              {fmt(line.value)}
            </p>
          </div>))}
      </div>
    </div>);
}
function CashFlowPanel({ cashFlow }: {
    cashFlow: FinancialCashFlow;
}) {
    const maxBar = Math.max(...cashFlow.weeks.flatMap((w) => [w.inflow, w.outflow]), 1);
    return (<div className={`${PANEL} p-5 lg:col-span-3 flex flex-col`}>
      <h3 className="text-sm font-bold text-zinc-900 dark:text-white mb-4">Cash Flow</h3>
      <div className="flex items-end justify-between gap-3 h-36 mb-1 px-1">
        {cashFlow.weeks.map((w) => (<div key={w.label} className="flex-1 flex flex-col items-center justify-end h-full gap-1">
            <div className="flex items-end justify-center gap-1 h-28 w-full">
              <div className="w-3 rounded-t-sm bg-emerald-500/80" style={{ height: `${(w.inflow / maxBar) * 100}%`, minHeight: 4 }} title={`In: ${fmt(w.inflow)}`}/>
              <div className="w-3 rounded-t-sm bg-rose-500/70" style={{ height: `${(w.outflow / maxBar) * 100}%`, minHeight: 4 }} title={`Out: ${fmt(w.outflow)}`}/>
            </div>
            <span className="text-[10px] text-zinc-500">{w.label}</span>
          </div>))}
      </div>
      <div className="space-y-2.5 mt-auto">
        <div className="flex justify-between text-sm">
          <span className="text-zinc-500 dark:text-zinc-400">Cash Inflow</span>
          <span className="font-medium text-emerald-600 dark:text-emerald-400 tabular-nums">
            {fmt(cashFlow.total_cash_inflow)}
          </span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-zinc-500 dark:text-zinc-400">Cash Outflow</span>
          <span className="font-medium text-rose-600 dark:text-rose-400 tabular-nums">
            {fmt(cashFlow.total_cash_outflow)}
          </span>
        </div>
        <div className="flex justify-between text-sm pt-2 border-t border-zinc-200 dark:border-zinc-800">
          <span className="font-semibold text-zinc-900 dark:text-white">Net Cash Flow</span>
          <span className="font-bold text-violet-500 dark:text-violet-400 tabular-nums">
            {fmt(cashFlow.net_cash_flow)}
          </span>
        </div>
      </div>
    </div>);
}
function AgingDonut({ agingSummary }: {
    agingSummary: FinancialAgingSummary | null;
}) {
    const segments = resolveAgingSegments(agingSummary);
    const totalAr = agingSummary?.total_ar ?? 0;
    let cursor = 0;
    const stops = segments.length > 0
        ? segments
            .map((seg) => {
            const start = cursor;
            cursor += seg.pct;
            return `${seg.color} ${start}% ${cursor}%`;
        })
            .join(', ')
        : '#71717a 0% 100%';
    return (<div className={`${CARD} p-4`}>
      <p className={`${LABEL} mb-4`}>Aging Summary</p>
      <div className="flex flex-col sm:flex-row items-center gap-4">
        <div className="relative h-32 w-32 shrink-0">
          <div className="h-full w-full rounded-full" style={{ background: `conic-gradient(${stops})` }}/>
          <div className="absolute inset-4 rounded-full bg-zinc-950 border border-zinc-800 flex flex-col items-center justify-center text-center px-1">
            <span className="text-[10px] uppercase tracking-wider text-zinc-500">Outstanding</span>
            <span className="text-sm font-bold text-white leading-tight">{fmt(totalAr)}</span>
          </div>
        </div>
        <ul className="flex-1 space-y-2 w-full">
          {segments.map((seg) => (<li key={seg.tier} className="flex items-center justify-between gap-2 text-xs">
              <span className="inline-flex items-center gap-2 text-zinc-600 dark:text-zinc-400">
                <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: seg.color }}/>
                {seg.tier}
              </span>
              <span className="font-medium text-zinc-800 dark:text-zinc-200 tabular-nums">{seg.pct}%</span>
            </li>))}
        </ul>
      </div>
    </div>);
}
function RecentTransactionsFeed({ transactions }: {
    transactions: FinancialRecentTransaction[];
}) {
    return (<div className={`${CARD} p-4 flex flex-col min-h-0`}>
      <p className={`${LABEL} mb-3`}>Recent Transactions</p>
      <div className="flex-1 overflow-y-auto max-h-64 space-y-2 pr-1 scrollbar-thin">
        {transactions.length === 0 ? (<p className={`${MUTED} text-center py-6`}>No recent transactions recorded.</p>) : (transactions.map((txn) => (<div key={txn.id} className="flex items-center justify-between gap-2 rounded-lg border border-zinc-200/80 dark:border-zinc-800/80 bg-white/50 dark:bg-zinc-950/40 px-3 py-2">
            <div className="min-w-0">
              <p className="text-xs font-medium text-zinc-800 dark:text-zinc-200 truncate">{txn.title}</p>
              <p className="text-[10px] text-zinc-500">{txn.timestamp}</p>
            </div>
            <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold tabular-nums ${txn.type === 'REVENUE'
                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                : 'bg-rose-500/10 text-rose-600 dark:text-rose-400'}`}>
              {txn.type === 'REVENUE' ? '+' : ''}
              {fmt(Math.abs(txn.amount))}
            </span>
          </div>)))}
      </div>
    </div>);
}
export default function AccountingDashboard() {
    const pathname = usePathname();
    const [currentSection, setCurrentSection] = useState<'financial' | 'payroll' | 'fuel'>('financial');
    const [ledgerTab, setLedgerTab] = useState<(typeof LEDGER_TABS)[number]>('Invoices');
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('All');
    const [customerFilter, setCustomerFilter] = useState('All');
    const [dateFilter, setDateFilter] = useState(currentMonthFilterValue);
    const [page, setPage] = useState(1);
    const perPage = 10;
    const [chartRangeType, setChartRangeType] = useState<(typeof CHART_RANGE_OPTIONS)[number]>('This Month');
    const chartRangeRef = useRef(chartRangeType);
    chartRangeRef.current = chartRangeType;
    const [chartLoading, setChartLoading] = useState(false);
    const [summary, setSummary] = useState<FinancialAccountingSummary | null>(null);
    const [chartData, setChartData] = useState<FinancialAccountingCharts | null>(null);
    const [agingSummary, setAgingSummary] = useState<FinancialAgingSummary | null>(null);
    const [invoices, setInvoices] = useState<FinancialInvoiceRow[]>([]);
    const [invoiceTotal, setInvoiceTotal] = useState(0);
    const [bills, setBills] = useState<FinancialBillRow[]>([]);
    const [billTotal, setBillTotal] = useState(0);
    const [payments, setPayments] = useState<FinancialPaymentRow[]>([]);
    const [paymentTotal, setPaymentTotal] = useState(0);
    const [journalEntries, setJournalEntries] = useState<FinancialJournalEntryRow[]>([]);
    const [journalTotal, setJournalTotal] = useState(0);
    const [journalStartDate, setJournalStartDate] = useState('');
    const [journalEndDate, setJournalEndDate] = useState('');
    const [recentTransactions, setRecentTransactions] = useState<FinancialRecentTransaction[]>([]);
    const [cashFlow, setCashFlow] = useState<FinancialCashFlow>(EMPTY_CASH_FLOW);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [showBillModal, setShowBillModal] = useState(false);
    const [showInvoiceModal, setShowInvoiceModal] = useState(false);
    const [invoiceSubmitting, setInvoiceSubmitting] = useState(false);
    const [invoiceFormError, setInvoiceFormError] = useState<string | null>(null);
    const [uninvoicedLoads, setUninvoicedLoads] = useState<FinancialUninvoicedLoad[]>([]);
    const [loadingUninvoicedLoads, setLoadingUninvoicedLoads] = useState(false);
    const [markingPaidInvoiceId, setMarkingPaidInvoiceId] = useState<number | null>(null);
    const [invoiceForm, setInvoiceForm] = useState({
        load_id: '',
        broker_name: '',
        invoice_number: '',
        amount: '',
        is_factored: false,
        factoring_fee_percentage: '2.50',
        reserve_percentage: '10.00',
    });
    const [billSubmitting, setBillSubmitting] = useState(false);
    const [payingBillId, setPayingBillId] = useState<number | null>(null);
    const [billFormError, setBillFormError] = useState<string | null>(null);
    const [billForm, setBillForm] = useState({
        vendor_name: '',
        category: 'Maintenance' as VendorBillCategory,
        bill_date: todayIsoDate(),
        due_date: todayIsoDate(),
        amount: '',
    });
    const [showJournalModal, setShowJournalModal] = useState(false);
    const [journalSubmitting, setJournalSubmitting] = useState(false);
    const [journalFormError, setJournalFormError] = useState<string | null>(null);
    const [chartOfAccounts, setChartOfAccounts] = useState<ChartOfAccountRow[]>([]);
    const [journalForm, setJournalForm] = useState<{
        memo: string;
        transaction_date: string;
        lines: JournalLineFormRow[];
    }>({
        memo: '',
        transaction_date: todayIsoDate(),
        lines: [
            { account_id: 0, debit_amount: '', credit_amount: '' },
            { account_id: 0, debit_amount: '', credit_amount: '' },
        ],
    });
    const closeMonthOptions = useMemo(() => buildCloseMonthOptions(), []);
    const [showPeriodModal, setShowPeriodModal] = useState(false);
    const [periodHealth, setPeriodHealth] = useState<FinancialPeriodClosingHealth | null>(null);
    const [periodHealthLoading, setPeriodHealthLoading] = useState(false);
    const [periodLockValue, setPeriodLockValue] = useState(closeMonthOptions[1]?.value ?? closeMonthOptions[0]?.value ?? '');
    const [periodLockSubmitting, setPeriodLockSubmitting] = useState(false);
    const [periodActionError, setPeriodActionError] = useState<string | null>(null);
    const [taxExportLoading, setTaxExportLoading] = useState<'tax' | 'trial_balance' | null>(null);
    const [ledgerExportLoading, setLedgerExportLoading] = useState(false);
    const [ledgerSyncLoading, setLedgerSyncLoading] = useState(false);
    const client = useMemo(() => createTmsApi(createApiClient(readPersistedTmsToken())), []);
    const defaultJournalLines = useCallback((accounts: ChartOfAccountRow[]): JournalLineFormRow[] => {
        const expenseAccount = accounts.find((account) => account.account_code === '5400') ??
            accounts.find((account) => account.account_type === 'Expense') ??
            accounts[0];
        const adjustmentAccount = accounts.find((account) => account.account_code === '6200') ??
            accounts.find((account) => account.id !== expenseAccount?.id) ??
            accounts[0];
        return [
            { account_id: expenseAccount?.id ?? 0, debit_amount: '', credit_amount: '' },
            { account_id: adjustmentAccount?.id ?? 0, debit_amount: '', credit_amount: '' },
        ];
    }, []);
    const loadChartOfAccounts = useCallback(async () => {
        if (!hasValidTmsToken(readPersistedTmsToken())) {
            setChartOfAccounts([]);
            return [];
        }
        try {
            const res = await client.financials.accountingChartOfAccounts();
            const accounts = res.data ?? [];
            setChartOfAccounts(accounts);
            return accounts;
        }
        catch (err) {
            console.error('Failed to load chart of accounts', err);
            setChartOfAccounts([]);
            return [];
        }
    }, [client]);
    const fetchDashboardData = useCallback(async () => {
        if (!hasValidTmsToken(readPersistedTmsToken())) {
            setLoading(false);
            return;
        }
        setLoading(true);
        setError(null);
        try {
            const rangeType = chartRangeRef.current;
            const [summaryRes, chartRes, agingRes, recentRes, cashFlowRes] = await Promise.all([
                client.financials.accountingSummary(rangeType),
                client.financials.accountingCharts(rangeType),
                client.financials.accountingAgingSummary(),
                client.financials.accountingRecentTransactions(8),
                client.financials.accountingCashFlow(),
            ]);
            setSummary(summaryRes);
            setChartData(chartRes);
            setAgingSummary(agingRes);
            setRecentTransactions(recentRes.data ?? []);
            setCashFlow(cashFlowRes ?? EMPTY_CASH_FLOW);
        }
        catch (err) {
            console.error('Failed to load accounting dashboard data', err);
            setError('Unable to load financial dashboard data.');
            setSummary(null);
            setChartData(null);
            setAgingSummary(null);
            setRecentTransactions([]);
            setCashFlow(EMPTY_CASH_FLOW);
        }
        finally {
            setLoading(false);
        }
    }, [client]);
    const fetchChartData = useCallback(async (rangeType: (typeof CHART_RANGE_OPTIONS)[number]) => {
        if (!hasValidTmsToken(readPersistedTmsToken()))
            return;
        setChartLoading(true);
        try {
            const [summaryRes, chartRes] = await Promise.all([
                client.financials.accountingSummary(rangeType),
                client.financials.accountingCharts(rangeType),
            ]);
            setSummary(summaryRes);
            setChartData(chartRes);
        }
        catch (err) {
            console.error('Failed to load accounting chart data', err);
            toast.error('Unable to refresh chart range.');
        }
        finally {
            setChartLoading(false);
        }
    }, [client]);
    const handleChartRangeChange = useCallback((rangeType: (typeof CHART_RANGE_OPTIONS)[number]) => {
        setChartRangeType(rangeType);
        void fetchChartData(rangeType);
    }, [fetchChartData]);
    const fetchInvoices = useCallback(async () => {
        if (!hasValidTmsToken(readPersistedTmsToken()))
            return;
        try {
            const res = await client.financials.accountingInvoices({
                search: search.trim() || undefined,
                status: statusFilter,
                customer: customerFilter !== 'All' ? customerFilter : undefined,
                month: dateFilter || undefined,
                page,
                limit: perPage,
            });
            setInvoices(res.data);
            setInvoiceTotal(res.total);
        }
        catch (err) {
            console.error('Failed to load invoices', err);
            setInvoices([]);
            setInvoiceTotal(0);
        }
    }, [client, search, statusFilter, customerFilter, dateFilter, page, perPage]);
    const fetchBills = useCallback(async () => {
        if (!hasValidTmsToken(readPersistedTmsToken()))
            return;
        try {
            const res = await client.financials.accountingBills({
                search: search.trim() || undefined,
                status: statusFilter,
                page,
                limit: perPage,
            });
            setBills(res.data);
            setBillTotal(res.total);
        }
        catch (err) {
            console.error('Failed to load bills', err);
            setBills([]);
            setBillTotal(0);
        }
    }, [client, search, statusFilter, page, perPage]);
    const fetchPayments = useCallback(async () => {
        if (!hasValidTmsToken(readPersistedTmsToken()))
            return;
        try {
            const res = await client.financials.accountingPayments({
                search: search.trim() || undefined,
                page,
                limit: perPage,
            });
            setPayments(res.data);
            setPaymentTotal(res.total);
        }
        catch (err) {
            console.error('Failed to load payments', err);
            setPayments([]);
            setPaymentTotal(0);
        }
    }, [client, search, page, perPage]);
    const fetchJournalEntries = useCallback(async () => {
        if (!hasValidTmsToken(readPersistedTmsToken()))
            return;
        try {
            const res = await client.financials.accountingJournalEntries({
                search: search.trim() || undefined,
                start_date: journalStartDate || undefined,
                end_date: journalEndDate || undefined,
                page,
                limit: perPage,
            });
            setJournalEntries(res.data);
            setJournalTotal(res.total);
        }
        catch (err) {
            console.error('Failed to load journal entries', err);
            setJournalEntries([]);
            setJournalTotal(0);
        }
    }, [client, search, journalStartDate, journalEndDate, page, perPage]);
    useEffect(() => {
        const releaseHeavySection = () => {
            setCurrentSection((prev) => (prev === 'fuel' ? 'financial' : prev));
        };
        window.addEventListener(DASHBOARD_BEFORE_NAVIGATE_EVENT, releaseHeavySection);
        return () => window.removeEventListener(DASHBOARD_BEFORE_NAVIGATE_EVENT, releaseHeavySection);
    }, []);
    useEffect(() => {
        if (pathname !== DASHBOARD_ROUTES.accounting) {
            setCurrentSection('financial');
        }
    }, [pathname]);
    useEffect(() => {
        void fetchDashboardData();
    }, [fetchDashboardData]);
    useEffect(() => {
        const timer = window.setTimeout(() => {
            if (ledgerTab === 'Invoices') {
                void fetchInvoices();
            }
            else if (ledgerTab === 'Bills') {
                void fetchBills();
            }
            else if (ledgerTab === 'Payments') {
                void fetchPayments();
            }
            else if (ledgerTab === 'Journal Entries') {
                void fetchJournalEntries();
            }
        }, search ? 300 : 0);
        return () => window.clearTimeout(timer);
    }, [
        fetchInvoices,
        fetchBills,
        fetchPayments,
        fetchJournalEntries,
        ledgerTab,
        page,
        statusFilter,
        search,
        customerFilter,
        dateFilter,
        journalStartDate,
        journalEndDate,
    ]);
    const metricCards = useMemo(() => buildMetricCards(summary), [summary]);
    const chartSeries = useMemo(() => timelineToSeries(chartData?.timeline ?? []), [chartData?.timeline]);
    const pnlLines = useMemo(() => buildPnlLines(summary?.profit_loss ?? resolveChartProfitLoss(chartData)), [summary?.profit_loss, chartData]);
    const customers = useMemo(() => {
        const names = new Set(invoices.map((invoice) => invoice.customer_name).filter(Boolean));
        if (customerFilter !== 'All') {
            names.add(customerFilter);
        }
        return ['All', ...Array.from(names).sort((a, b) => a.localeCompare(b))];
    }, [invoices, customerFilter]);
    const totalPages = Math.max(1, Math.ceil((ledgerTab === 'Bills'
        ? billTotal
        : ledgerTab === 'Payments'
            ? paymentTotal
            : ledgerTab === 'Journal Entries'
                ? journalTotal
                : invoiceTotal) / perPage));
    const activeLedgerTotal = ledgerTab === 'Bills'
        ? billTotal
        : ledgerTab === 'Payments'
            ? paymentTotal
            : ledgerTab === 'Journal Entries'
                ? journalTotal
                : invoiceTotal;
    const journalLineTotals = useMemo(() => {
        const debit = journalForm.lines.reduce((sum, line) => sum + (Number.parseFloat(line.debit_amount) || 0), 0);
        const credit = journalForm.lines.reduce((sum, line) => sum + (Number.parseFloat(line.credit_amount) || 0), 0);
        const roundedDebit = Math.round(debit * 100) / 100;
        const roundedCredit = Math.round(credit * 100) / 100;
        return {
            debit: roundedDebit,
            credit: roundedCredit,
            balanced: roundedDebit > 0 && roundedDebit === roundedCredit,
        };
    }, [journalForm.lines]);
    const resolveInvoiceStatus = (status: string): InvoiceStatus => {
        const normalized = status.trim().toLowerCase();
        if (normalized === 'draft')
            return 'Draft';
        if (normalized === 'finalized')
            return 'Finalized';
        if (normalized === 'paid')
            return 'Paid';
        if (normalized === 'factored')
            return 'Factored';
        if (normalized === 'sent')
            return 'Sent';
        if (normalized === 'partial')
            return 'Partial';
        if (normalized === 'overdue')
            return 'Overdue';
        return 'Draft';
    };
    const openInvoiceModal = async () => {
        setInvoiceFormError(null);
        setInvoiceForm({
            load_id: '',
            broker_name: '',
            invoice_number: '',
            amount: '',
            is_factored: false,
            factoring_fee_percentage: '2.50',
            reserve_percentage: '10.00',
        });
        setShowInvoiceModal(true);
        setLoadingUninvoicedLoads(true);
        try {
            const res = await client.financials.accountingUninvoicedLoads();
            setUninvoicedLoads(res.loads ?? []);
        }
        catch (err) {
            console.error('Failed to load uninvoiced loads', err);
            setUninvoicedLoads([]);
            setInvoiceFormError('Unable to load uninvoiced loads.');
        }
        finally {
            setLoadingUninvoicedLoads(false);
        }
    };
    const handleInvoiceLoadChange = (loadId: string) => {
        const selected = uninvoicedLoads.find((load) => String(load.id) === loadId);
        setInvoiceForm((prev) => ({
            ...prev,
            load_id: loadId,
            broker_name: selected?.broker_name?.trim() || prev.broker_name,
            amount: selected ? String(selected.gross_amount) : prev.amount,
        }));
    };
    const factoringPreview = useMemo(() => {
        const amount = Number.parseFloat(invoiceForm.amount);
        const feePct = Number.parseFloat(invoiceForm.factoring_fee_percentage);
        const reservePct = Number.parseFloat(invoiceForm.reserve_percentage);
        if (!Number.isFinite(amount) || amount <= 0) {
            return { fee: 0, reserve: 0, advance: 0 };
        }
        return computeFactoringPreview(amount, Number.isFinite(feePct) ? feePct : 0, Number.isFinite(reservePct) ? reservePct : 0);
    }, [
        invoiceForm.amount,
        invoiceForm.factoring_fee_percentage,
        invoiceForm.reserve_percentage,
    ]);
    const handleCreateInvoice = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setInvoiceFormError(null);
        const loadId = Number.parseInt(invoiceForm.load_id, 10);
        const amount = Number.parseFloat(invoiceForm.amount);
        if (!Number.isFinite(loadId) || loadId <= 0) {
            setInvoiceFormError('Select a load to invoice.');
            return;
        }
        if (!Number.isFinite(amount) || amount <= 0) {
            setInvoiceFormError('Enter a valid invoice amount.');
            return;
        }
        let feePct: number | undefined;
        let reservePct: number | undefined;
        if (invoiceForm.is_factored) {
            feePct = Number.parseFloat(invoiceForm.factoring_fee_percentage);
            reservePct = Number.parseFloat(invoiceForm.reserve_percentage);
            if (!Number.isFinite(feePct) || feePct < 0 || feePct > 100) {
                setInvoiceFormError('Enter a valid factoring fee percentage (0–100).');
                return;
            }
            if (!Number.isFinite(reservePct) || reservePct < 0 || reservePct > 100) {
                setInvoiceFormError('Enter a valid reserve percentage (0–100).');
                return;
            }
            if (feePct + reservePct > 100) {
                setInvoiceFormError('Fee and reserve percentages cannot exceed 100%.');
                return;
            }
            if (factoringPreview.advance < 0) {
                setInvoiceFormError('Factoring advance cannot be negative.');
                return;
            }
        }
        setInvoiceSubmitting(true);
        try {
            await client.financials.accountingCreateInvoice({
                load_id: loadId,
                broker_name: invoiceForm.broker_name.trim() || undefined,
                invoice_number: invoiceForm.invoice_number.trim() || undefined,
                amount,
                is_factored: invoiceForm.is_factored,
                factoring_fee_percentage: invoiceForm.is_factored ? feePct : undefined,
                reserve_percentage: invoiceForm.is_factored ? reservePct : undefined,
            });
            setShowInvoiceModal(false);
            setPage(1);
            await Promise.all([fetchInvoices(), fetchDashboardData()]);
            toast.success(invoiceForm.is_factored
                ? 'Invoice factored and ledger posted.'
                : 'Invoice created.');
        }
        catch (err) {
            console.error('Failed to create invoice', err);
            setInvoiceFormError(resolveFiscalPeriodLockMessage(err) ??
                formatApiError(err, 'Unable to create invoice. Please try again.'));
        }
        finally {
            setInvoiceSubmitting(false);
        }
    };
    const handleMarkInvoicePaid = async (invoiceId: number) => {
        setMarkingPaidInvoiceId(invoiceId);
        try {
            await client.financials.accountingUpdateInvoice(invoiceId, { status: 'Paid', balance: 0 });
            await Promise.all([fetchInvoices(), fetchDashboardData()]);
            toast.success('Invoice marked as paid.');
        }
        catch (err) {
            console.error('Failed to mark invoice paid', err);
            toast.error(resolveFiscalPeriodLockMessage(err) ?? formatApiError(err, 'Unable to mark invoice as paid.'));
        }
        finally {
            setMarkingPaidInvoiceId(null);
        }
    };
    const resolveBillStatus = (status: string): BillStatus => {
        if (status === 'Unpaid' || status === 'Partially Paid' || status === 'Paid')
            return status;
        return 'Unpaid';
    };
    const openBillModal = () => {
        setBillFormError(null);
        setBillForm({
            vendor_name: '',
            category: 'Maintenance',
            bill_date: todayIsoDate(),
            due_date: todayIsoDate(),
            amount: '',
        });
        setShowBillModal(true);
    };
    const handleCreateBill = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setBillFormError(null);
        const amount = Number.parseFloat(billForm.amount);
        if (!billForm.vendor_name.trim()) {
            setBillFormError('Vendor name is required.');
            return;
        }
        if (!Number.isFinite(amount) || amount <= 0) {
            setBillFormError('Enter a valid bill amount.');
            return;
        }
        if (billForm.due_date < billForm.bill_date) {
            setBillFormError('Due date cannot be before bill date.');
            return;
        }
        setBillSubmitting(true);
        try {
            await client.financials.accountingCreateBill({
                vendor_name: billForm.vendor_name.trim(),
                category: billForm.category,
                bill_date: billForm.bill_date,
                due_date: billForm.due_date,
                amount,
            });
            setShowBillModal(false);
            setPage(1);
            await Promise.all([fetchBills(), fetchDashboardData()]);
        }
        catch (err) {
            console.error('Failed to record bill', err);
            setBillFormError(resolveFiscalPeriodLockMessage(err) ??
                formatApiError(err, 'Unable to record bill. Please try again.'));
        }
        finally {
            setBillSubmitting(false);
        }
    };
    const handlePayBill = async (billId: number) => {
        setPayingBillId(billId);
        try {
            await client.financials.accountingPayBill(billId);
            await Promise.all([fetchBills(), fetchPayments(), fetchDashboardData()]);
        }
        catch (err) {
            console.error('Failed to pay bill', err);
            toast.error(resolveFiscalPeriodLockMessage(err) ?? formatApiError(err, 'Unable to pay vendor bill.'));
        }
        finally {
            setPayingBillId(null);
        }
    };
    const openJournalModal = async () => {
        setJournalFormError(null);
        const accounts = chartOfAccounts.length > 0 ? chartOfAccounts : await loadChartOfAccounts();
        setJournalForm({
            memo: '',
            transaction_date: todayIsoDate(),
            lines: defaultJournalLines(accounts),
        });
        setShowJournalModal(true);
    };
    const addJournalLine = () => {
        const fallbackAccountId = chartOfAccounts.find((account) => account.account_code === '5900')?.id ??
            chartOfAccounts[0]?.id ??
            0;
        setJournalForm((prev) => ({
            ...prev,
            lines: [
                ...prev.lines,
                { account_id: fallbackAccountId, debit_amount: '', credit_amount: '' },
            ],
        }));
    };
    const removeJournalLine = (index: number) => {
        setJournalForm((prev) => ({
            ...prev,
            lines: prev.lines.filter((_, lineIndex) => lineIndex !== index),
        }));
    };
    const updateJournalLine = (index: number, patch: Partial<JournalLineFormRow>) => {
        setJournalForm((prev) => ({
            ...prev,
            lines: prev.lines.map((line, lineIndex) => lineIndex === index ? { ...line, ...patch } : line),
        }));
    };
    const handleCreateJournalEntry = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setJournalFormError(null);
        if (!journalForm.memo.trim()) {
            setJournalFormError('Memo is required.');
            return;
        }
        if (journalForm.lines.length < 2) {
            setJournalFormError('Add at least two journal lines.');
            return;
        }
        if (!journalLineTotals.balanced) {
            setJournalFormError('Debits and credits must balance before posting.');
            return;
        }
        const lines = journalForm.lines.map((line) => {
            const debit = Number.parseFloat(line.debit_amount) || 0;
            const credit = Number.parseFloat(line.credit_amount) || 0;
            return {
                account_id: line.account_id,
                debit_amount: Math.round(debit * 100) / 100,
                credit_amount: Math.round(credit * 100) / 100,
            };
        });
        for (const line of lines) {
            if (!line.account_id) {
                setJournalFormError('Select an account for every journal line.');
                return;
            }
            if (line.debit_amount <= 0 && line.credit_amount <= 0) {
                setJournalFormError('Each line needs a debit or credit amount.');
                return;
            }
            if (line.debit_amount > 0 && line.credit_amount > 0) {
                setJournalFormError('Each line can only have a debit or a credit, not both.');
                return;
            }
        }
        setJournalSubmitting(true);
        try {
            await client.financials.accountingCreateJournalEntry({
                memo: journalForm.memo.trim(),
                transaction_date: journalForm.transaction_date,
                lines,
            });
            setShowJournalModal(false);
            setPage(1);
            await Promise.all([fetchJournalEntries(), fetchDashboardData()]);
        }
        catch (err) {
            console.error('Failed to create journal entry', err);
            setJournalFormError(resolveFiscalPeriodLockMessage(err) ??
                formatApiError(err, 'Unable to post journal entry. Verify debits equal credits.'));
        }
        finally {
            setJournalSubmitting(false);
        }
    };
    const loadPeriodClosingHealth = useCallback(async () => {
        setPeriodHealthLoading(true);
        setPeriodActionError(null);
        try {
            const health = await client.financials.accountingPeriodClosingHealth();
            setPeriodHealth(health);
        }
        catch (err) {
            console.error('Failed to load period closing health', err);
            setPeriodHealth(null);
            setPeriodActionError('Unable to load period closing health.');
        }
        finally {
            setPeriodHealthLoading(false);
        }
    }, [client]);
    const openPeriodModal = () => {
        setPeriodActionError(null);
        setShowPeriodModal(true);
        void loadPeriodClosingHealth();
    };
    const handleClosePeriod = async () => {
        const selected = closeMonthOptions.find((option) => option.value === periodLockValue);
        if (!selected) {
            setPeriodActionError('Select a calendar month to close.');
            return;
        }
        setPeriodLockSubmitting(true);
        setPeriodActionError(null);
        try {
            await client.financials.accountingClosePeriod({
                year: selected.year,
                month: selected.month,
            });
            await loadPeriodClosingHealth();
        }
        catch (err) {
            console.error('Failed to close accounting period', err);
            setPeriodActionError('Unable to close the selected period.');
        }
        finally {
            setPeriodLockSubmitting(false);
        }
    };
    const handleTaxExport = async (reportType: 'tax' | 'trial_balance') => {
        setTaxExportLoading(reportType);
        setPeriodActionError(null);
        try {
            const blob = await client.financials.accountingTaxSummaryExport({
                report_type: reportType,
                trailing_months: 3,
            });
            downloadBlob(blob, reportType === 'trial_balance' ? 'trial_balance.csv' : 'logistics_tax_summary.csv');
            toast.success('Tax report exported.');
        }
        catch (err) {
            console.error('Failed to export tax report', err);
            setPeriodActionError('Tax export failed. Please try again.');
            toast.error('Tax export failed. Please try again.');
        }
        finally {
            setTaxExportLoading(null);
        }
    };
    const refreshActiveLedgerTab = useCallback(async () => {
        if (ledgerTab === 'Invoices') {
            await fetchInvoices();
        }
        else if (ledgerTab === 'Bills') {
            await fetchBills();
        }
        else if (ledgerTab === 'Payments') {
            await fetchPayments();
        }
        else if (ledgerTab === 'Journal Entries') {
            await fetchJournalEntries();
        }
    }, [fetchBills, fetchInvoices, fetchJournalEntries, fetchPayments, ledgerTab]);
    const handleSyncLedger = async () => {
        setLedgerSyncLoading(true);
        try {
            await Promise.all([fetchDashboardData(), refreshActiveLedgerTab()]);
            toast.success('Ledger synced.');
        }
        catch (err) {
            console.error('Failed to sync ledger', err);
            toast.error('Unable to sync ledger. Please try again.');
        }
        finally {
            setLedgerSyncLoading(false);
        }
    };
    const handleLedgerExport = async () => {
        const exportTab = LEDGER_TAB_EXPORT_MAP[ledgerTab];
        if (!exportTab) {
            toast.error('Bank transaction CSV export is not available yet.');
            return;
        }
        setLedgerExportLoading(true);
        try {
            const { blob, filename } = await client.financials.accountingLedgerExport({
                tab: exportTab,
                search: search.trim() || undefined,
                status: ledgerTab === 'Invoices' || ledgerTab === 'Bills' ? statusFilter : undefined,
                customer: ledgerTab === 'Invoices' ? customerFilter : undefined,
                month: ledgerTab === 'Invoices' ? dateFilter : undefined,
                start_date: ledgerTab === 'Journal Entries' ? journalStartDate : undefined,
                end_date: ledgerTab === 'Journal Entries' ? journalEndDate : undefined,
            });
            downloadBlob(blob, filename);
            toast.success('CSV export downloaded.');
        }
        catch (err) {
            console.error('Failed to export ledger data', err);
            toast.error(formatApiError(err, 'Export failed. Please try again.'));
        }
        finally {
            setLedgerExportLoading(false);
        }
    };
    return (<div className="space-y-5 animate-in fade-in duration-200">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <nav className="flex items-center gap-1 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/60 p-1 w-fit">
          {SECTION_TABS.map((tab) => (<button key={tab.id} type="button" onClick={() => setCurrentSection(tab.id)} className={`rounded-lg px-4 py-2 text-xs font-semibold transition-colors whitespace-nowrap ${currentSection === tab.id
                ? 'bg-white dark:bg-zinc-800 text-violet-600 dark:text-violet-400 shadow-sm'
                : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'}`}>
              {tab.label}
            </button>))}
        </nav>
        {currentSection === 'financial' && (<button type="button" onClick={openPeriodModal} className="inline-flex items-center gap-2 rounded-xl border border-violet-500/25 bg-violet-500/10 hover:bg-violet-500/15 text-violet-700 dark:text-violet-300 px-4 py-2 text-xs font-semibold transition-colors w-fit">
            <Lock size={14}/>
            Period Closing &amp; Tax Center
          </button>)}
      </div>

      {currentSection === 'fuel' ? (<FuelIftaDashboard key="fuel-ifta-panel" embedded onLedgerRefresh={fetchDashboardData}/>) : currentSection === 'payroll' ? (<Payroll />) : (<>
      
      <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6 gap-3">
        {metricCards.map((m) => {
                const Icon = m.icon;
                return (<div key={m.key} className={`${CARD} p-4 flex flex-col gap-2`}>
              <div className="flex items-center justify-between">
                <span className={LABEL}>{m.label}</span>
                <Icon size={16} className={m.accent}/>
              </div>
              <p className="text-xl font-bold text-zinc-900 dark:text-white tabular-nums tracking-tight">
                {fmt(m.value)}
              </p>
              <TrendBadge trend={m.trend} sub={m.sub} badgeClass={m.badge}/>
            </div>);
            })}
      </section>

      
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <RevenueExpensesChart series={chartSeries} rangeType={chartData?.range_type ?? chartRangeType} onRangeTypeChange={handleChartRangeChange} chartLoading={chartLoading}/>
        <ProfitLossPanel lines={pnlLines}/>
        <CashFlowPanel cashFlow={cashFlow}/>
      </section>

      
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        
        <div className={`${PANEL} lg:col-span-8 flex flex-col overflow-hidden`}>
          <div className="flex items-center justify-between gap-3 px-5 pt-4 border-b border-zinc-200 dark:border-zinc-800">
            <div className="flex items-center gap-1 overflow-x-auto scrollbar-none -mb-px">
              {LEDGER_TABS.map((tab) => (<button key={tab} type="button" onClick={() => {
                    setLedgerTab(tab);
                    setPage(1);
                    if (tab === 'Bills')
                        setStatusFilter('All');
                    if (tab === 'Invoices')
                        setStatusFilter('All');
                }} className={`shrink-0 px-3 py-2.5 text-xs font-medium border-b-2 transition-colors whitespace-nowrap ${ledgerTab === tab
                    ? 'border-violet-500 text-violet-600 dark:text-violet-400'
                    : 'border-transparent text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'}`}>
                  {tab}
                </button>))}
            </div>
            <div className="flex items-center gap-2 shrink-0 mb-3">
              {ledgerTab === 'Bills' && (<button type="button" onClick={openBillModal} className="inline-flex items-center gap-1.5 rounded-lg bg-violet-600 hover:bg-violet-500 text-white px-3 py-1.5 text-xs font-semibold transition-colors">
                  <Plus size={14}/>
                  Record Bill
                </button>)}
              {ledgerTab === 'Invoices' && (<button type="button" onClick={() => void openInvoiceModal()} className="inline-flex items-center gap-1.5 rounded-lg bg-violet-600 hover:bg-violet-500 text-white px-3 py-1.5 text-xs font-semibold transition-colors">
                  <Plus size={14}/>
                  Create Invoice
                </button>)}
              {ledgerTab === 'Journal Entries' && (<button type="button" onClick={openJournalModal} className="inline-flex items-center gap-1.5 rounded-lg bg-violet-600 hover:bg-violet-500 text-white px-3 py-1.5 text-xs font-semibold transition-colors">
                  <Plus size={14}/>
                  New Journal Entry
                </button>)}
              <button type="button" onClick={() => void handleSyncLedger()} disabled={ledgerSyncLoading} title="Sync ledger" className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 px-3 py-1.5 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors disabled:opacity-60">
                {ledgerSyncLoading ? (<Loader2 size={14} className="animate-spin"/>) : (<RefreshCw size={14}/>)}
                Sync Ledger
              </button>
              <button type="button" onClick={() => void handleLedgerExport()} disabled={ledgerExportLoading} className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 px-3 py-1.5 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors disabled:opacity-60">
                {ledgerExportLoading ? (<Loader2 size={14} className="animate-spin"/>) : (<Download size={14}/>)}
                Export CSV
              </button>
            </div>
          </div>

          <div className="px-5 py-3 flex flex-wrap items-center gap-2 border-b border-zinc-100 dark:border-zinc-800/80 bg-zinc-50/50 dark:bg-zinc-900/30">
            <div className="relative flex-1 min-w-[180px] max-w-xs">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400"/>
              <input type="search" value={search} onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
            }} placeholder={ledgerTab === 'Bills'
                ? 'Search vendors…'
                : ledgerTab === 'Payments'
                    ? 'Search payments…'
                    : ledgerTab === 'Journal Entries'
                        ? 'Search memo or accounts…'
                        : 'Search invoices…'} className="w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900/60 pl-8 pr-3 py-1.5 text-xs text-zinc-800 dark:text-zinc-200 placeholder:text-zinc-400 focus:outline-none focus:ring-1 focus:ring-violet-500/50"/>
            </div>
            {ledgerTab === 'Journal Entries' && (<>
                <label className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900/60 px-2.5 py-1.5 text-xs text-zinc-700 dark:text-zinc-300">
                  <Calendar size={13} className="text-zinc-400"/>
                  <input type="date" value={journalStartDate} onChange={(e) => {
                    setJournalStartDate(e.target.value);
                    setPage(1);
                }} className="bg-transparent border-0 p-0 text-xs focus:outline-none focus:ring-0"/>
                </label>
                <label className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900/60 px-2.5 py-1.5 text-xs text-zinc-700 dark:text-zinc-300">
                  <span className="text-zinc-400">to</span>
                  <input type="date" value={journalEndDate} onChange={(e) => {
                    setJournalEndDate(e.target.value);
                    setPage(1);
                }} className="bg-transparent border-0 p-0 text-xs focus:outline-none focus:ring-0"/>
                </label>
              </>)}
            {(ledgerTab === 'Invoices' || ledgerTab === 'Bills') && (<select value={statusFilter} onChange={(e) => {
                    setStatusFilter(e.target.value);
                    setPage(1);
                }} className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900/60 px-2.5 py-1.5 text-xs text-zinc-700 dark:text-zinc-300 focus:outline-none focus:ring-1 focus:ring-violet-500/50">
                {(ledgerTab === 'Bills' ? BILL_STATUS_OPTIONS : INVOICE_STATUS_OPTIONS).map((s) => (<option key={s} value={s}>
                      {s === 'All' ? 'Status' : s}
                    </option>))}
              </select>)}
            {ledgerTab === 'Invoices' && (<select value={customerFilter} onChange={(e) => {
                    setCustomerFilter(e.target.value);
                    setPage(1);
                }} className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900/60 px-2.5 py-1.5 text-xs text-zinc-700 dark:text-zinc-300 focus:outline-none focus:ring-1 focus:ring-violet-500/50">
                {customers.map((c) => (<option key={c} value={c}>
                    {c === 'All' ? 'Customers' : c}
                  </option>))}
              </select>)}
            {ledgerTab === 'Invoices' && (<label className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900/60 px-2.5 py-1.5 text-xs text-zinc-700 dark:text-zinc-300 cursor-pointer">
                <Calendar size={13} className="text-zinc-400"/>
                <input type="month" value={dateFilter} onChange={(e) => {
                    setDateFilter(e.target.value);
                    setPage(1);
                }} className="bg-transparent border-0 p-0 text-xs focus:outline-none focus:ring-0 w-[108px]"/>
              </label>)}
          </div>

          {ledgerTab === 'Invoices' ? (<InvoicesLedger invoices={invoices} page={page} perPage={perPage} total={invoiceTotal} onPageChange={setPage} markingPaidInvoiceId={markingPaidInvoiceId} onMarkPaid={handleMarkInvoicePaid} onRefresh={fetchInvoices} client={client}/>) : ledgerTab === 'Bills' ? (<>
              <div className="overflow-x-auto flex-1">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-zinc-200 dark:border-zinc-800 text-zinc-500 dark:text-zinc-400">
                      {['Vendor', 'Category', 'Bill Date', 'Due Date', 'Amount', 'Balance', 'Status', 'Actions'].map((col) => (<th key={col} className="px-4 py-3 font-semibold whitespace-nowrap">
                            {col}
                          </th>))}
                    </tr>
                  </thead>
                  <tbody>
                    {bills.length === 0 ? (<tr>
                        <td colSpan={8} className="px-4 py-10 text-center text-zinc-500">
                          No vendor bills recorded yet.
                        </td>
                      </tr>) : (bills.map((bill, index) => {
                    const status = resolveBillStatus(bill.status);
                    const canPay = status !== 'Paid' && bill.balance > 0;
                    return (<tr key={`${bill.id}-${index}`} className="border-b border-zinc-100 dark:border-zinc-800/60 hover:bg-zinc-50 dark:hover:bg-zinc-900/40 transition-colors">
                            <td className="px-4 py-3 font-medium text-zinc-900 dark:text-white whitespace-nowrap">
                              {bill.vendor_name}
                            </td>
                            <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400 whitespace-nowrap">{bill.category}</td>
                            <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400 tabular-nums whitespace-nowrap">
                              {formatDisplayDate(bill.bill_date)}
                            </td>
                            <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400 tabular-nums whitespace-nowrap">
                              {formatDisplayDate(bill.due_date)}
                            </td>
                            <td className="px-4 py-3 font-medium text-zinc-900 dark:text-white tabular-nums whitespace-nowrap">
                              {fmt(bill.amount)}
                            </td>
                            <td className="px-4 py-3 text-zinc-700 dark:text-zinc-300 tabular-nums whitespace-nowrap">
                              {fmt(bill.balance)}
                            </td>
                            <td className="px-4 py-3">
                              <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold ${BILL_STATUS_STYLES[status]}`}>
                                {status}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              {canPay ? (<button type="button" disabled={payingBillId === bill.id} onClick={() => void handlePayBill(bill.id)} className="inline-flex items-center gap-1 rounded-md bg-violet-600 hover:bg-violet-500 disabled:opacity-60 text-white px-2.5 py-1 text-[10px] font-semibold transition-colors">
                                  {payingBillId === bill.id ? (<Loader2 size={12} className="animate-spin"/>) : (<Banknote size={12}/>)}
                                  Pay Bill
                                </button>) : (<span className="text-[10px] text-zinc-400">Settled</span>)}
                            </td>
                          </tr>);
                }))}
                  </tbody>
                </table>
              </div>
              <div className="flex items-center justify-between gap-3 px-4 py-3 border-t border-zinc-200 dark:border-zinc-800 text-xs text-zinc-500">
                <span>
                  Showing {activeLedgerTotal === 0 ? 0 : (page - 1) * perPage + 1}–{Math.min(page * perPage, activeLedgerTotal)} of {activeLedgerTotal}
                </span>
                <div className="flex items-center gap-1">
                  <button type="button" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))} className="p-1.5 rounded-md border border-zinc-200 dark:border-zinc-700 disabled:opacity-40 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">
                    <ChevronLeft size={14}/>
                  </button>
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (<button key={p} type="button" onClick={() => setPage(p)} className={`min-w-[28px] h-7 rounded-md text-xs font-medium transition-colors ${p === page
                        ? 'bg-violet-600 text-white'
                        : 'border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800'}`}>
                      {p}
                    </button>))}
                  <button type="button" disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))} className="p-1.5 rounded-md border border-zinc-200 dark:border-zinc-700 disabled:opacity-40 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">
                    <ChevronRight size={14}/>
                  </button>
                </div>
              </div>
            </>) : ledgerTab === 'Payments' ? (<>
              <div className="overflow-x-auto flex-1">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-zinc-200 dark:border-zinc-800 text-zinc-500 dark:text-zinc-400">
                      {['Date', 'Direction', 'Counterparty', 'Source', 'Reference', 'Amount'].map((col) => (<th key={col} className="px-4 py-3 font-semibold whitespace-nowrap">
                          {col}
                        </th>))}
                    </tr>
                  </thead>
                  <tbody>
                    {payments.length === 0 ? (<tr>
                        <td colSpan={6} className="px-4 py-10 text-center text-zinc-500">
                          No payment events recorded yet.
                        </td>
                      </tr>) : (payments.map((payment) => (<tr key={payment.id} className="border-b border-zinc-100 dark:border-zinc-800/60 hover:bg-zinc-50 dark:hover:bg-zinc-900/40 transition-colors">
                          <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400 tabular-nums whitespace-nowrap">
                            {formatDisplayDate(payment.payment_date)}
                          </td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold ${payment.direction === 'incoming'
                        ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/25'
                        : 'bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/25'}`}>
                              {payment.direction === 'incoming' ? 'Incoming' : 'Outgoing'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-zinc-800 dark:text-zinc-200 whitespace-nowrap">
                            {payment.counterparty}
                          </td>
                          <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400 whitespace-nowrap">
                            {payment.source_type}
                          </td>
                          <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400 max-w-[180px] truncate">
                            {payment.reference}
                          </td>
                          <td className={`px-4 py-3 font-semibold tabular-nums whitespace-nowrap ${payment.direction === 'incoming'
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-rose-600 dark:text-rose-400'}`}>
                            {payment.direction === 'incoming' ? '+' : '-'}
                            {fmt(payment.amount)}
                          </td>
                        </tr>)))}
                  </tbody>
                </table>
              </div>
              <div className="flex items-center justify-between gap-3 px-4 py-3 border-t border-zinc-200 dark:border-zinc-800 text-xs text-zinc-500">
                <span>
                  Showing {activeLedgerTotal === 0 ? 0 : (page - 1) * perPage + 1}–{Math.min(page * perPage, activeLedgerTotal)} of {activeLedgerTotal}
                </span>
                <div className="flex items-center gap-1">
                  <button type="button" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))} className="p-1.5 rounded-md border border-zinc-200 dark:border-zinc-700 disabled:opacity-40 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">
                    <ChevronLeft size={14}/>
                  </button>
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (<button key={p} type="button" onClick={() => setPage(p)} className={`min-w-[28px] h-7 rounded-md text-xs font-medium transition-colors ${p === page
                        ? 'bg-violet-600 text-white'
                        : 'border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800'}`}>
                      {p}
                    </button>))}
                  <button type="button" disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))} className="p-1.5 rounded-md border border-zinc-200 dark:border-zinc-700 disabled:opacity-40 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">
                    <ChevronRight size={14}/>
                  </button>
                </div>
              </div>
            </>) : ledgerTab === 'Journal Entries' ? (<>
              <div className="overflow-x-auto flex-1">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-zinc-200 dark:border-zinc-800 text-zinc-500 dark:text-zinc-400">
                      {['Entry Date', 'Memo / Description', 'Account', 'Debit', 'Credit'].map((col) => (<th key={col} className="px-4 py-3 font-semibold whitespace-nowrap">
                          {col}
                        </th>))}
                    </tr>
                  </thead>
                  <tbody>
                    {journalEntries.length === 0 ? (<tr>
                        <td colSpan={5} className="px-4 py-10 text-center text-zinc-500">
                          No journal entries posted yet.
                        </td>
                      </tr>) : (journalEntries.flatMap((entry) => entry.lines.map((line, lineIndex) => (<tr key={`${entry.id}-${line.id}-${lineIndex}`} className="border-b border-zinc-100 dark:border-zinc-800/60 hover:bg-zinc-50 dark:hover:bg-zinc-900/40 transition-colors">
                            {lineIndex === 0 && (<>
                                <td rowSpan={entry.lines.length} className="px-4 py-3 text-zinc-600 dark:text-zinc-400 tabular-nums whitespace-nowrap align-top">
                                  {formatDisplayDate(entry.transaction_date)}
                                  <p className="text-[10px] text-zinc-400 mt-1">{entry.entry_number}</p>
                                </td>
                                <td rowSpan={entry.lines.length} className="px-4 py-3 text-zinc-800 dark:text-zinc-200 align-top max-w-[220px]">
                                  <p className="font-medium">{entry.memo}</p>
                                  <div className="flex flex-wrap gap-1 mt-1.5">
                                    {entry.account_tags.map((tag, tagIndex) => (<span key={`${entry.id}-${tag}-${tagIndex}`} className="inline-flex rounded-full border border-violet-500/20 bg-violet-500/10 px-2 py-0.5 text-[10px] font-medium text-violet-700 dark:text-violet-300">
                                        {tag}
                                      </span>))}
                                  </div>
                                </td>
                              </>)}
                            <td className="px-4 py-3 text-zinc-700 dark:text-zinc-300 whitespace-nowrap">
                              {line.account_category}
                            </td>
                            <td className="px-4 py-3 font-medium text-zinc-900 dark:text-white tabular-nums whitespace-nowrap">
                              {line.debit_amount > 0 ? fmt(line.debit_amount) : '—'}
                            </td>
                            <td className="px-4 py-3 font-medium text-zinc-900 dark:text-white tabular-nums whitespace-nowrap">
                              {line.credit_amount > 0 ? fmt(line.credit_amount) : '—'}
                            </td>
                          </tr>))))}
                  </tbody>
                </table>
              </div>
              <div className="flex items-center justify-between gap-3 px-4 py-3 border-t border-zinc-200 dark:border-zinc-800 text-xs text-zinc-500">
                <span>
                  Showing {activeLedgerTotal === 0 ? 0 : (page - 1) * perPage + 1}–{Math.min(page * perPage, activeLedgerTotal)} of {activeLedgerTotal}
                </span>
                <div className="flex items-center gap-1">
                  <button type="button" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))} className="p-1.5 rounded-md border border-zinc-200 dark:border-zinc-700 disabled:opacity-40 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">
                    <ChevronLeft size={14}/>
                  </button>
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (<button key={p} type="button" onClick={() => setPage(p)} className={`min-w-[28px] h-7 rounded-md text-xs font-medium transition-colors ${p === page
                        ? 'bg-violet-600 text-white'
                        : 'border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800'}`}>
                      {p}
                    </button>))}
                  <button type="button" disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))} className="p-1.5 rounded-md border border-zinc-200 dark:border-zinc-700 disabled:opacity-40 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">
                    <ChevronRight size={14}/>
                  </button>
                </div>
              </div>
            </>) : ledgerTab === 'Bank Transactions' ? (<BankReconciliation variant="workspace"/>) : (<div className="flex-1 flex flex-col items-center justify-center py-16 px-6 text-center">
              <Receipt size={32} className="text-zinc-400 mb-3"/>
              <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">{ledgerTab}</p>
              <p className={`${MUTED} mt-1 max-w-xs`}>Mock workspace — connect backend ledger APIs to populate this view.</p>
            </div>)}
        </div>

        
        <div className="lg:col-span-4 flex flex-col gap-4">
          <AgingDonut agingSummary={agingSummary}/>
          <RecentTransactionsFeed transactions={recentTransactions}/>
        </div>
      </section>

      
      <BankReconciliation variant="footer"/>

      {showBillModal && (<div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/70 backdrop-blur-sm">
          <div className={`${PANEL} w-full max-w-md p-5 shadow-xl`} role="dialog" aria-modal="true" aria-labelledby="record-bill-title">
            <div className="flex items-start justify-between gap-3 mb-4">
              <div>
                <h3 id="record-bill-title" className="text-sm font-bold text-zinc-900 dark:text-white">
                  Record Bill
                </h3>
                <p className={`${MUTED} mt-0.5`}>Track vendor overhead and accounts payable.</p>
              </div>
              <button type="button" onClick={() => setShowBillModal(false)} className="p-1.5 rounded-md text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">
                <X size={16}/>
              </button>
            </div>

            <form onSubmit={(e) => void handleCreateBill(e)} className="space-y-3">
              <label className="block">
                <span className={LABEL}>Vendor</span>
                <input type="text" value={billForm.vendor_name} onChange={(e) => setBillForm((prev) => ({ ...prev, vendor_name: e.target.value }))} className="mt-1 w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900/60 px-3 py-2 text-sm text-zinc-800 dark:text-zinc-200 focus:outline-none focus:ring-1 focus:ring-violet-500/50" placeholder="Vendor name" required/>
              </label>

              <label className="block">
                <span className={LABEL}>Category</span>
                <select value={billForm.category} onChange={(e) => setBillForm((prev) => ({
                    ...prev,
                    category: e.target.value as VendorBillCategory,
                }))} className="mt-1 w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900/60 px-3 py-2 text-sm text-zinc-800 dark:text-zinc-200 focus:outline-none focus:ring-1 focus:ring-violet-500/50">
                  {BILL_CATEGORIES.map((category) => (<option key={category} value={category}>
                      {category}
                    </option>))}
                </select>
              </label>

              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className={LABEL}>Bill Date</span>
                  <input type="date" value={billForm.bill_date} onChange={(e) => setBillForm((prev) => ({ ...prev, bill_date: e.target.value }))} className="mt-1 w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900/60 px-3 py-2 text-sm text-zinc-800 dark:text-zinc-200 focus:outline-none focus:ring-1 focus:ring-violet-500/50" required/>
                </label>
                <label className="block">
                  <span className={LABEL}>Due Date</span>
                  <input type="date" value={billForm.due_date} onChange={(e) => setBillForm((prev) => ({ ...prev, due_date: e.target.value }))} className="mt-1 w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900/60 px-3 py-2 text-sm text-zinc-800 dark:text-zinc-200 focus:outline-none focus:ring-1 focus:ring-violet-500/50" required/>
                </label>
              </div>

              <label className="block">
                <span className={LABEL}>Amount</span>
                <input type="number" min="0.01" step="0.01" value={billForm.amount} onChange={(e) => setBillForm((prev) => ({ ...prev, amount: e.target.value }))} className="mt-1 w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900/60 px-3 py-2 text-sm text-zinc-800 dark:text-zinc-200 focus:outline-none focus:ring-1 focus:ring-violet-500/50" placeholder="0.00" required/>
              </label>

              {billFormError && <LedgerFormErrorBanner message={billFormError}/>}

              <div className="flex items-center justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowBillModal(false)} className="rounded-lg border border-zinc-200 dark:border-zinc-700 px-3 py-2 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">
                  Cancel
                </button>
                <button type="submit" disabled={billSubmitting} className="inline-flex items-center gap-1.5 rounded-lg bg-violet-600 hover:bg-violet-500 disabled:opacity-60 text-white px-4 py-2 text-xs font-semibold transition-colors">
                  {billSubmitting ? <Loader2 size={14} className="animate-spin"/> : <Plus size={14}/>}
                  Save Bill
                </button>
              </div>
            </form>
          </div>
        </div>)}

      {showInvoiceModal && (<div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/70 backdrop-blur-sm">
          <div className={`${PANEL} w-full max-w-lg p-5 shadow-xl max-h-[90vh] overflow-y-auto`} role="dialog" aria-modal="true" aria-labelledby="create-invoice-title">
            <div className="flex items-start justify-between gap-3 mb-4">
              <div>
                <h3 id="create-invoice-title" className="text-sm font-bold text-zinc-900 dark:text-white">
                  Create Invoice
                </h3>
                <p className={`${MUTED} mt-0.5`}>Bill a delivered load and track broker receivables.</p>
              </div>
              <button type="button" onClick={() => setShowInvoiceModal(false)} className="p-1.5 rounded-md text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">
                <X size={16}/>
              </button>
            </div>

            <form onSubmit={(e) => void handleCreateInvoice(e)} className="space-y-3">
              <label className="block">
                <span className={LABEL}>Load</span>
                <select value={invoiceForm.load_id} onChange={(e) => handleInvoiceLoadChange(e.target.value)} className="mt-1 w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900/60 px-3 py-2 text-sm text-zinc-800 dark:text-zinc-200 focus:outline-none focus:ring-1 focus:ring-violet-500/50" required disabled={loadingUninvoicedLoads}>
                  <option value="">
                    {loadingUninvoicedLoads ? 'Loading loads…' : 'Select delivered load'}
                  </option>
                  {uninvoicedLoads.map((load) => (<option key={load.id} value={load.id}>
                      {load.broker_load_id || `L-${load.id}`} · {load.origin} → {load.destination} · {fmt(load.gross_amount)}
                    </option>))}
                </select>
              </label>

              <label className="block">
                <span className={LABEL}>Broker</span>
                <input type="text" value={invoiceForm.broker_name} onChange={(e) => setInvoiceForm((prev) => ({ ...prev, broker_name: e.target.value }))} className="mt-1 w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900/60 px-3 py-2 text-sm text-zinc-800 dark:text-zinc-200 focus:outline-none focus:ring-1 focus:ring-violet-500/50" placeholder="Broker / customer name"/>
              </label>

              <label className="block">
                <span className={LABEL}>Invoice #</span>
                <input type="text" value={invoiceForm.invoice_number} onChange={(e) => setInvoiceForm((prev) => ({ ...prev, invoice_number: e.target.value }))} className="mt-1 w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900/60 px-3 py-2 text-sm text-zinc-800 dark:text-zinc-200 focus:outline-none focus:ring-1 focus:ring-violet-500/50" placeholder="Auto-generated if blank"/>
              </label>

              <label className="block">
                <span className={LABEL}>Amount</span>
                <input type="number" min="0.01" step="0.01" value={invoiceForm.amount} onChange={(e) => setInvoiceForm((prev) => ({ ...prev, amount: e.target.value }))} className="mt-1 w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900/60 px-3 py-2 text-sm text-zinc-800 dark:text-zinc-200 focus:outline-none focus:ring-1 focus:ring-violet-500/50" placeholder="0.00" required/>
              </label>

              <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 p-3 space-y-3">
                <label className="flex items-center justify-between gap-3 cursor-pointer">
                  <span className="text-xs font-semibold text-zinc-800 dark:text-zinc-100">
                    Route Through Factoring Provider
                  </span>
                  <button type="button" role="switch" aria-checked={invoiceForm.is_factored} onClick={() => setInvoiceForm((prev) => ({ ...prev, is_factored: !prev.is_factored }))} className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border transition-colors ${invoiceForm.is_factored
                    ? 'bg-violet-600 border-violet-500'
                    : 'bg-zinc-300 dark:bg-zinc-700 border-zinc-400/40 dark:border-zinc-600'}`}>
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${invoiceForm.is_factored ? 'translate-x-6' : 'translate-x-1'}`}/>
                  </button>
                </label>

                {invoiceForm.is_factored && (<div className="space-y-3 animate-in fade-in duration-200">
                    <div className="grid grid-cols-2 gap-3">
                      <label className="block">
                        <span className={LABEL}>Factoring Fee %</span>
                        <input type="number" min="0" max="100" step="0.01" value={invoiceForm.factoring_fee_percentage} onChange={(e) => setInvoiceForm((prev) => ({
                        ...prev,
                        factoring_fee_percentage: e.target.value,
                    }))} className="mt-1 w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900/60 px-3 py-2 text-sm text-zinc-800 dark:text-zinc-200 focus:outline-none focus:ring-1 focus:ring-violet-500/50"/>
                      </label>
                      <label className="block">
                        <span className={LABEL}>Reserve Holdback %</span>
                        <input type="number" min="0" max="100" step="0.01" value={invoiceForm.reserve_percentage} onChange={(e) => setInvoiceForm((prev) => ({
                        ...prev,
                        reserve_percentage: e.target.value,
                    }))} className="mt-1 w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900/60 px-3 py-2 text-sm text-zinc-800 dark:text-zinc-200 focus:outline-none focus:ring-1 focus:ring-violet-500/50"/>
                      </label>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <div className="rounded-lg border border-rose-500/25 bg-rose-500/10 px-3 py-2">
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-rose-600 dark:text-rose-400">
                          Factoring Fee
                        </p>
                        <p className="mt-1 text-sm font-bold tabular-nums text-rose-700 dark:text-rose-300">
                          {fmt(factoringPreview.fee)}
                        </p>
                      </div>
                      <div className="rounded-lg border border-amber-500/25 bg-amber-500/10 px-3 py-2">
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-400">
                          Reserve Held
                        </p>
                        <p className="mt-1 text-sm font-bold tabular-nums text-amber-800 dark:text-amber-300">
                          {fmt(factoringPreview.reserve)}
                        </p>
                      </div>
                      <div className="rounded-lg border border-emerald-500/25 bg-emerald-500/10 px-3 py-2">
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                          Cash Advance
                        </p>
                        <p className="mt-1 text-sm font-bold tabular-nums text-emerald-800 dark:text-emerald-300">
                          {fmt(factoringPreview.advance)}
                        </p>
                      </div>
                    </div>
                  </div>)}
              </div>

              {invoiceFormError && <LedgerFormErrorBanner message={invoiceFormError}/>}

              <div className="flex items-center justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowInvoiceModal(false)} className="rounded-lg border border-zinc-200 dark:border-zinc-700 px-3 py-2 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">
                  Cancel
                </button>
                <button type="submit" disabled={invoiceSubmitting || loadingUninvoicedLoads || uninvoicedLoads.length === 0} className="inline-flex items-center gap-1.5 rounded-lg bg-violet-600 hover:bg-violet-500 disabled:opacity-60 text-white px-4 py-2 text-xs font-semibold transition-colors">
                  {invoiceSubmitting ? <Loader2 size={14} className="animate-spin"/> : <Plus size={14}/>}
                  {invoiceForm.is_factored ? 'Factor Invoice' : 'Create Invoice'}
                </button>
              </div>
            </form>
          </div>
        </div>)}

      {showJournalModal && (<div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/70 backdrop-blur-sm">
          <div className={`${PANEL} w-full max-w-2xl p-5 shadow-xl max-h-[90vh] overflow-y-auto`} role="dialog" aria-modal="true" aria-labelledby="journal-entry-title">
            <div className="flex items-start justify-between gap-3 mb-4">
              <div>
                <h3 id="journal-entry-title" className="text-sm font-bold text-zinc-900 dark:text-white">
                  New Journal Entry
                </h3>
                <p className={`${MUTED} mt-0.5`}>
                  Post balanced manual adjustments to the general ledger.
                </p>
              </div>
              <button type="button" onClick={() => setShowJournalModal(false)} className="p-1.5 rounded-md text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">
                <X size={16}/>
              </button>
            </div>

            <form onSubmit={(e) => void handleCreateJournalEntry(e)} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="block sm:col-span-2">
                  <span className={LABEL}>Memo</span>
                  <input type="text" value={journalForm.memo} onChange={(e) => setJournalForm((prev) => ({ ...prev, memo: e.target.value }))} className="mt-1 w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900/60 px-3 py-2 text-sm text-zinc-800 dark:text-zinc-200 focus:outline-none focus:ring-1 focus:ring-violet-500/50" placeholder="Monthly depreciation, equity injection, etc." required/>
                </label>
                <label className="block">
                  <span className={LABEL}>Entry Date</span>
                  <input type="date" value={journalForm.transaction_date} onChange={(e) => setJournalForm((prev) => ({ ...prev, transaction_date: e.target.value }))} className="mt-1 w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900/60 px-3 py-2 text-sm text-zinc-800 dark:text-zinc-200 focus:outline-none focus:ring-1 focus:ring-violet-500/50" required/>
                </label>
                <div className="flex items-end">
                  <div className={`w-full rounded-lg border px-3 py-2 text-xs ${journalLineTotals.balanced
                    ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                    : 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300'}`}>
                    Debits {fmt(journalLineTotals.debit)} · Credits {fmt(journalLineTotals.credit)}
                    {journalLineTotals.balanced ? ' · Balanced' : ' · Out of balance'}
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className={LABEL}>Lines</span>
                  <button type="button" onClick={addJournalLine} className="inline-flex items-center gap-1 text-[11px] font-semibold text-violet-600 dark:text-violet-400 hover:underline">
                    <Plus size={12}/>
                    Add Line
                  </button>
                </div>

                <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
                  <div className="grid grid-cols-12 gap-2 px-3 py-2 bg-zinc-50 dark:bg-zinc-900/50 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                    <span className="col-span-5">Account</span>
                    <span className="col-span-3">Debit</span>
                    <span className="col-span-3">Credit</span>
                    <span className="col-span-1"/>
                  </div>
                  {journalForm.lines.map((line, index) => (<div key={`journal-line-${index}`} className="grid grid-cols-12 gap-2 px-3 py-2 border-t border-zinc-200 dark:border-zinc-800">
                      <select value={line.account_id || ''} onChange={(e) => updateJournalLine(index, {
                        account_id: Number.parseInt(e.target.value, 10) || 0,
                    })} className="col-span-5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900/60 px-2 py-1.5 text-xs text-zinc-800 dark:text-zinc-200 focus:outline-none focus:ring-1 focus:ring-violet-500/50">
                        <option value="" disabled>
                          Select account
                        </option>
                        {chartOfAccounts.map((account) => (<option key={account.id} value={account.id}>
                            {account.display_label}
                          </option>))}
                      </select>
                      <input type="number" min="0" step="0.01" value={line.debit_amount} onChange={(e) => updateJournalLine(index, {
                        debit_amount: e.target.value,
                        credit_amount: e.target.value ? '' : line.credit_amount,
                    })} className="col-span-3 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900/60 px-2 py-1.5 text-xs text-zinc-800 dark:text-zinc-200 focus:outline-none focus:ring-1 focus:ring-violet-500/50" placeholder="0.00"/>
                      <input type="number" min="0" step="0.01" value={line.credit_amount} onChange={(e) => updateJournalLine(index, {
                        credit_amount: e.target.value,
                        debit_amount: e.target.value ? '' : line.debit_amount,
                    })} className="col-span-3 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900/60 px-2 py-1.5 text-xs text-zinc-800 dark:text-zinc-200 focus:outline-none focus:ring-1 focus:ring-violet-500/50" placeholder="0.00"/>
                      <button type="button" disabled={journalForm.lines.length <= 2} onClick={() => removeJournalLine(index)} className="col-span-1 flex items-center justify-center p-1.5 rounded-md text-zinc-400 hover:text-rose-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-30 transition-colors" title="Remove line">
                        <Trash2 size={14}/>
                      </button>
                    </div>))}
                </div>
              </div>

              {journalFormError && <LedgerFormErrorBanner message={journalFormError}/>}

              <div className="flex items-center justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowJournalModal(false)} className="rounded-lg border border-zinc-200 dark:border-zinc-700 px-3 py-2 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">
                  Cancel
                </button>
                <button type="submit" disabled={journalSubmitting || !journalLineTotals.balanced} className="inline-flex items-center gap-1.5 rounded-lg bg-violet-600 hover:bg-violet-500 disabled:opacity-60 text-white px-4 py-2 text-xs font-semibold transition-colors">
                  {journalSubmitting ? (<Loader2 size={14} className="animate-spin"/>) : (<Plus size={14}/>)}
                  Post Entry
                </button>
              </div>
            </form>
          </div>
        </div>)}

      {showPeriodModal && (<div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/70 backdrop-blur-sm">
          <div className={`${PANEL} w-full max-w-lg p-5 shadow-xl`} role="dialog" aria-modal="true" aria-labelledby="period-closing-title">
            <div className="flex items-start justify-between gap-3 mb-4">
              <div>
                <h3 id="period-closing-title" className="text-sm font-bold text-zinc-900 dark:text-white">
                  Period Closing &amp; Tax Center
                </h3>
                <p className={`${MUTED} mt-0.5`}>
                  Verify ledger health, seal closed months, and export tax-ready reports.
                </p>
              </div>
              <button type="button" onClick={() => setShowPeriodModal(false)} className="p-1.5 rounded-md text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">
                <X size={16}/>
              </button>
            </div>

            {periodHealthLoading ? (<div className="flex items-center justify-center py-10 text-zinc-400">
                <Loader2 size={22} className="animate-spin"/>
              </div>) : (<div className="space-y-4">
                <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-900/40 p-4 space-y-2">
                  <p className={LABEL}>Closing Checklist</p>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-zinc-600 dark:text-zinc-300">Unreconciled Bank Lines</span>
                    <span className={`font-semibold tabular-nums ${(periodHealth?.unreconciled_bank_lines ?? 0) === 0
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-amber-600 dark:text-amber-400'}`}>
                      {periodHealth?.unreconciled_bank_lines ?? 0}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-zinc-600 dark:text-zinc-300">Unpaid Bills</span>
                    <span className="font-semibold tabular-nums text-zinc-800 dark:text-zinc-200">
                      {periodHealth?.unpaid_bills ?? 0} · {fmt(periodHealth?.unpaid_bill_total ?? 0)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-zinc-600 dark:text-zinc-300">Closed Periods</span>
                    <span className="font-semibold tabular-nums text-zinc-800 dark:text-zinc-200">
                      {periodHealth?.locked_periods.length ?? 0}
                    </span>
                  </div>
                  {!periodHealth?.ready_to_close && (<p className="text-[11px] text-amber-600 dark:text-amber-400 pt-1">
                      Reconcile all bank lines before sealing a period for best audit hygiene.
                    </p>)}
                </div>

                <label className="block">
                  <span className={LABEL}>Seal Calendar Month</span>
                  <select value={periodLockValue} onChange={(e) => setPeriodLockValue(e.target.value)} className="mt-1 w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900/60 px-3 py-2 text-sm text-zinc-800 dark:text-zinc-200 focus:outline-none focus:ring-1 focus:ring-violet-500/50">
                    {closeMonthOptions.map((option) => (<option key={option.value} value={option.value}>
                        {option.label}
                      </option>))}
                  </select>
                </label>

                <button type="button" onClick={() => void handleClosePeriod()} disabled={periodLockSubmitting} className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-violet-600 hover:bg-violet-500 disabled:opacity-60 text-white px-4 py-2.5 text-xs font-semibold transition-colors">
                  {periodLockSubmitting ? (<Loader2 size={14} className="animate-spin"/>) : (<Lock size={14}/>)}
                  Permanently Close Selected Month
                </button>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <button type="button" onClick={() => void handleTaxExport('tax')} disabled={taxExportLoading !== null} className="inline-flex items-center justify-center gap-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900/60 hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-60 px-3 py-2 text-xs font-semibold text-zinc-800 dark:text-zinc-200 transition-colors">
                    {taxExportLoading === 'tax' ? (<Loader2 size={14} className="animate-spin"/>) : (<Download size={14}/>)}
                    Logistics Tax Summary
                  </button>
                  <button type="button" onClick={() => void handleTaxExport('trial_balance')} disabled={taxExportLoading !== null} className="inline-flex items-center justify-center gap-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900/60 hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-60 px-3 py-2 text-xs font-semibold text-zinc-800 dark:text-zinc-200 transition-colors">
                    {taxExportLoading === 'trial_balance' ? (<Loader2 size={14} className="animate-spin"/>) : (<Download size={14}/>)}
                    Trial Balance CSV
                  </button>
                </div>

                {(periodHealth?.locked_periods.length ?? 0) > 0 && (<div className="rounded-xl border border-zinc-200 dark:border-zinc-800 px-3 py-2">
                    <p className={`${LABEL} mb-2`}>Recently Closed</p>
                    <div className="space-y-1 max-h-24 overflow-y-auto">
                      {periodHealth?.locked_periods.slice(0, 6).map((period) => (<p key={`${period.year}-${period.month}`} className="text-[11px] text-zinc-500">
                          {period.label}
                        </p>))}
                    </div>
                  </div>)}
              </div>)}

            {periodActionError && (<p className="mt-3 text-xs text-rose-500 dark:text-rose-400">{periodActionError}</p>)}
          </div>
        </div>)}
        </>)}
    </div>);
}
