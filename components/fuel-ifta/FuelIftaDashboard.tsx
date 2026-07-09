'use client';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { createApiClient, formatApiError, hasValidTmsToken, readPersistedTmsToken } from '@/lib/api-client';
import { createTmsApi, type DriverRecord, type FuelIftaFinancialSummary, type FuelIftaTransactionRow, type FuelSpendDayRow, type IftaQuarterlySummary, type IftaReportRecord, type IftaStateTaxRow, type TruckRecord, } from '@/lib/tms-api';
import { useTMSStore } from '@/store/useTMSStore';
import TruckDetailModal from '@/components/modals/TruckDetailModal';
import { AlertCircle, ArrowDownRight, ArrowUpRight, Calendar, ChevronDown, ChevronLeft, ChevronRight, Download, Droplets, FileText, Filter, Fuel, Gauge, Loader2, Lock, Map as MapIcon, MoreHorizontal, Plus, Search, Tag, Truck, Trash2, UploadCloud, X, } from 'lucide-react';
const CARD = 'rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/60';
const PANEL = 'rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#161616]';
const LABEL = 'text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400';
const MUTED = 'text-xs text-zinc-500 dark:text-zinc-400';
const fmt = (n: number) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 });
const fmtNum = (n: number, decimals = 2) => n.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
function resolveTransactionDriverName(txn: FuelIftaTransactionRow, trucks: TruckRecord[]): string {
    if (txn.driver_name?.trim()) {
        return txn.driver_name.trim();
    }
    if (txn.truck_id != null) {
        const truck = trucks.find((row) => row.id === txn.truck_id);
        if (truck?.driver_name?.trim()) {
            return truck.driver_name.trim();
        }
    }
    return '—';
}
const PERFORMANCE_META = [
    {
        key: 'spend',
        label: 'Total Fuel Spend',
        icon: Fuel,
        accent: 'text-emerald-500',
        iconBg: 'bg-emerald-500/10 border-emerald-500/20',
        badge: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
        format: (v: number) => fmt(v),
        sub: 'Month to date',
        trend: 'up' as const,
    },
    {
        key: 'gallons',
        label: 'Total Gallons',
        icon: Droplets,
        accent: 'text-sky-400',
        iconBg: 'bg-sky-500/10 border-sky-500/20',
        badge: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
        format: (v: number) => fmtNum(v),
        sub: 'Month to date',
        trend: 'up' as const,
    },
    {
        key: 'ppg',
        label: 'Average Price / Gallon',
        icon: Tag,
        accent: 'text-violet-400',
        iconBg: 'bg-violet-500/10 border-violet-500/20',
        badge: 'bg-zinc-500/10 text-zinc-600 dark:text-zinc-300 border-zinc-500/20',
        format: (v: number) => fmt(v),
        sub: 'Month to date',
        trend: 'up' as const,
    },
    {
        key: 'mpg',
        label: 'MPG (Fleet Average)',
        icon: Gauge,
        accent: 'text-amber-400',
        iconBg: 'bg-amber-500/10 border-amber-500/20',
        badge: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
        format: (v: number) => fmtNum(v, 2),
        sub: 'Fleet benchmark',
        trend: 'up' as const,
    },
];
const VEHICLE_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#a78bfa', '#fb7185', '#71717a'];
const FUEL_TYPE_COLORS: Record<string, string> = {
    Diesel: '#10b981',
    Gasoline: '#3b82f6',
    DEF: '#3b82f6',
    Other: '#f59e0b',
};
const EMPTY_IFTA_PANEL = {
    total_miles: 0,
    taxable_miles: 0,
    jurisdictions_traveled: 0,
    est_tax_due: 0,
    credits: 0,
    balance_due: 0,
};
type IftaPanelData = typeof EMPTY_IFTA_PANEL;
type VehicleSpendSlice = {
    truck: string;
    amount: number;
    pct: number;
    color: string;
};
type JurisdictionSlice = {
    state: string;
    code: string;
    miles: number;
};
type FuelTypeSlice = {
    label: string;
    miles: number;
    pct: number;
    color: string;
};
type FuelType = 'Diesel' | 'Gasoline' | 'DEF';
const FUEL_TYPE_STYLES: Record<string, string> = {
    Diesel: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/25',
    Gasoline: 'bg-sky-500/10 text-sky-700 dark:text-sky-400 border-sky-500/25',
    DEF: 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/25',
};
const IFTA_STATUS_STYLES: Record<string, string> = {
    Filed: 'border-emerald-500/25 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
    Pending: 'border-amber-500/25 bg-amber-500/10 text-amber-600 dark:text-amber-400',
    Draft: 'border-zinc-500/25 bg-zinc-500/10 text-zinc-600 dark:text-zinc-400',
};
const REGISTRY_TABS = ['Fuel Transactions', 'Fuel Cards'] as const;
const DATE_RANGE_OPTIONS = ['7 Days', '14 Days', '30 Days', 'This Month'] as const;
type ChartDateRange = (typeof DATE_RANGE_OPTIONS)[number];
const US_STATE_CODES = [
    'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA', 'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY',
    'LA', 'ME', 'MD', 'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ', 'NM', 'NY', 'NC', 'ND',
    'OH', 'OK', 'OR', 'PA', 'RI', 'SC', 'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY',
] as const;
const MODAL_FIELD = 'w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900/60 px-3 py-2 text-xs text-zinc-800 dark:text-zinc-200 focus:outline-none focus:ring-1 focus:ring-sky-500/50';
const RECEIPT_FILTER_OPTIONS = ['All Receipts', 'With Receipt', 'Without Receipt'] as const;
const PURCHASE_TYPE_OPTIONS = ['All Purchase Types', 'Fuel Purchase', 'Bypass Fee'] as const;
function buildPageList(current: number, total: number): number[] {
    if (total <= 5) {
        return Array.from({ length: total }, (_, index) => index + 1);
    }
    const pages = new Set<number>([1, total, current, current - 1, current + 1]);
    return Array.from(pages)
        .filter((page) => page >= 1 && page <= total)
        .sort((a, b) => a - b);
}
const formatFuelDate = (iso: string) => {
    const parsed = new Date(`${iso}T00:00:00`);
    if (Number.isNaN(parsed.getTime()))
        return iso;
    return parsed.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });
};
function currentQuarterLabel(reference = new Date()): string {
    const quarter = Math.floor(reference.getMonth() / 3) + 1;
    return `Q${quarter} ${reference.getFullYear()}`;
}
function buildQuarterOptions(reference = new Date(), count = 6): string[] {
    const options: string[] = [];
    let cursor = new Date(reference.getFullYear(), reference.getMonth(), 1);
    for (let i = 0; i < count; i += 1) {
        options.push(currentQuarterLabel(cursor));
        cursor = new Date(cursor.getFullYear(), cursor.getMonth() - 3, 1);
    }
    return [...new Set(options)];
}
function parseQuarterLabel(label: string): {
    quarter: number;
    year: number;
} {
    const match = label.trim().match(/^Q([1-4])\s+(\d{4})$/i);
    if (!match) {
        const now = new Date();
        return { quarter: Math.floor(now.getMonth() / 3) + 1, year: now.getFullYear() };
    }
    return { quarter: Number(match[1]), year: Number(match[2]) };
}
function quarterDateBounds(quarter: number, year: number): {
    start_date: string;
    end_date: string;
} {
    const startMonth = (quarter - 1) * 3;
    const start = new Date(year, startMonth, 1);
    const end = new Date(year, startMonth + 3, 0);
    const toIso = (value: Date) => value.toISOString().slice(0, 10);
    return { start_date: toIso(start), end_date: toIso(end) };
}
function buildIftaFilingCsv(report: IftaQuarterlySummary): string {
    const header = [
        'State Code',
        'State Name',
        'Total Miles',
        'Taxable Gallons',
        'Paid Gallons',
        'Tax Rate',
        'Net Tax Owed',
        'Available Credits',
    ].join('\t');
    const rows = report.jurisdiction_matrix.map((row) => [
        row.state_code,
        row.state_name,
        row.total_miles.toFixed(1),
        row.taxable_gallons.toFixed(2),
        row.paid_gallons.toFixed(2),
        row.tax_rate.toFixed(4),
        row.net_tax_owed.toFixed(2),
        row.available_credits.toFixed(2),
    ].join('\t'));
    return [header, ...rows].join('\n');
}
function downloadIftaFilingCsv(report: IftaQuarterlySummary): void {
    const csv = buildIftaFilingCsv(report);
    const blob = new Blob([csv], { type: 'text/tab-separated-values;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `IFTA_${report.quarter_label.replace(/\s+/g, '_')}_Filing.csv`;
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 60000);
}
function formatReportTimestamp(iso?: string | null): string {
    if (!iso)
        return '—';
    const parsed = new Date(iso);
    if (Number.isNaN(parsed.getTime()))
        return iso;
    return parsed.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
type IftaJurisdictionFormRow = {
    id: string;
    state: string;
    miles: string;
    gallons_purchased: string;
};
function emptyJurisdictionRow(state = 'PA'): IftaJurisdictionFormRow {
    return {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        state,
        miles: '',
        gallons_purchased: '',
    };
}
function jurisdictionRowsFromTaxRows(rows: IftaStateTaxRow[]): IftaJurisdictionFormRow[] {
    if (rows.length === 0)
        return [emptyJurisdictionRow()];
    return rows.map((row) => ({
        id: `${row.code}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        state: row.code,
        miles: String(row.miles),
        gallons_purchased: String(row.gallons),
    }));
}
function todayIsoDate(): string {
    return new Date().toISOString().slice(0, 10);
}
function deriveIftaDeadlineFromQuarter(quarterLabel: string): string | null {
    const match = quarterLabel.match(/Q([1-4])\s+(\d{4})/i);
    if (!match)
        return null;
    const quarter = Number(match[1]);
    const year = Number(match[2]);
    const filingMonth = quarter * 3 + 1;
    const deadlineYear = filingMonth > 12 ? year + 1 : year;
    const deadlineMonth = filingMonth > 12 ? 1 : filingMonth;
    const deadline = new Date(deadlineYear, deadlineMonth, 0);
    return deadline.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
    });
}
function resolveIftaDeadlineLabel(deadline: string | undefined, quarterLabel: string): string {
    const derived = deriveIftaDeadlineFromQuarter(quarterLabel);
    if (!deadline)
        return derived ?? '—';
    const quarterYear = quarterLabel.match(/(\d{4})/)?.[1];
    const deadlineYear = deadline.match(/(\d{4})/)?.[1];
    if (quarterYear && deadlineYear && quarterYear !== deadlineYear) {
        return derived ?? deadline;
    }
    return deadline;
}
function resolveFuelType(value: string): FuelType {
    if (value === 'Gasoline' || value === 'DEF')
        return value;
    return 'Diesel';
}
function ChartEmptyState({ message }: {
    message: string;
}) {
    return <p className={`${MUTED} py-6 text-center`}>{message}</p>;
}
function TrendBadge({ trend, sub, badgeClass }: {
    trend: 'up' | 'down';
    sub: string;
    badgeClass: string;
}) {
    const Icon = trend === 'up' ? ArrowUpRight : ArrowDownRight;
    return (<span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium ${badgeClass}`}>
      <Icon size={11}/>
      {sub}
    </span>);
}
function FuelSpendChart({ value, onChange, series, }: {
    value: ChartDateRange;
    onChange: (range: ChartDateRange) => void;
    series: FuelSpendDayRow[];
}) {
    const [rangeOpen, setRangeOpen] = useState(false);
    const [hover, setHover] = useState<{
        x: number;
        y: number;
        day: string;
        spend: number;
    } | null>(null);
    const chartSeries = series;
    const W = 320;
    const H = 160;
    const pad = { t: 12, r: 8, b: 24, l: 40 };
    const innerW = W - pad.l - pad.r;
    const innerH = H - pad.t - pad.b;
    const maxVal = Math.max(...chartSeries.map((d) => d.spend), 1);
    const toX = (i: number) => chartSeries.length <= 1 ? pad.l + innerW / 2 : pad.l + (i / (chartSeries.length - 1)) * innerW;
    const toY = (v: number) => pad.t + innerH - (v / maxVal) * innerH;
    const path = chartSeries.length > 0
        ? chartSeries
            .map((d, i) => `${i === 0 ? 'M' : 'L'}${toX(i).toFixed(1)},${toY(d.spend).toFixed(1)}`)
            .join(' ')
        : '';
    return (<div className={`${PANEL} p-4 lg:col-span-3`}>
      <div className="flex items-start justify-between gap-2 mb-3">
        <h3 className="text-sm font-bold text-zinc-900 dark:text-white">Fuel Spend Over Time</h3>
        <div className="relative">
          <button type="button" onClick={() => setRangeOpen((o) => !o)} className="inline-flex items-center gap-1 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900/60 px-2 py-1 text-[10px] font-medium text-zinc-700 dark:text-zinc-300">
            {value}
            <ChevronDown size={12} className={rangeOpen ? 'rotate-180' : ''}/>
          </button>
          {rangeOpen && (<div className="absolute right-0 top-full z-20 mt-1 min-w-[100px] rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-lg py-1">
              {DATE_RANGE_OPTIONS.map((opt) => (<button key={opt} type="button" onClick={() => {
                    onChange(opt);
                    setRangeOpen(false);
                }} className={`block w-full px-2.5 py-1 text-left text-[10px] hover:bg-zinc-100 dark:hover:bg-zinc-800 ${opt === value
                    ? 'text-sky-600 dark:text-sky-400 font-semibold'
                    : 'text-zinc-700 dark:text-zinc-300'}`}>
                  {opt}
                </button>))}
            </div>)}
        </div>
      </div>
      {chartSeries.length === 0 ? (<ChartEmptyState message="No fuel spend recorded for this range."/>) : (<svg viewBox={`0 0 ${W} ${H}`} className="w-full h-[160px]" role="img" aria-label="Fuel spend line chart">
        {[0, 0.33, 0.66, 1].map((pct) => {
                const y = pad.t + innerH * (1 - pct);
                return (<g key={pct}>
              <line x1={pad.l} y1={y} x2={W - pad.r} y2={y} stroke="currentColor" className="text-zinc-200 dark:text-zinc-800" strokeWidth={1}/>
              <text x={pad.l - 4} y={y + 3} textAnchor="end" className="fill-zinc-500 text-[8px]">
                ${Math.round(maxVal * pct / 1000)}k
              </text>
            </g>);
            })}
        {path && <path d={path} fill="none" stroke="#3b82f6" strokeWidth={2} strokeLinejoin="round"/>}
        {chartSeries.map((d, i) => (<g key={d.day}>
            <circle cx={toX(i)} cy={toY(d.spend)} r={5} fill="transparent" className="cursor-pointer" onMouseEnter={() => setHover({ x: toX(i), y: toY(d.spend), day: d.label || d.day, spend: d.spend })} onMouseLeave={() => setHover(null)}/>
            <text x={toX(i)} y={H - 6} textAnchor="middle" className="fill-zinc-500 text-[7px]">
              {(d.label || d.day).replace(/^[A-Za-z]{3}\s+0?/, '')}
            </text>
          </g>))}
        {hover && (<foreignObject x={Math.min(hover.x - 55, W - 120)} y={Math.max(hover.y - 48, 2)} width={110} height={44}>
            <div className="rounded-lg border border-zinc-700 bg-zinc-900/95 px-2 py-1.5 text-[10px] shadow-xl">
              <p className="font-semibold text-white">{hover.day}</p>
              <p className="text-sky-300">{fmt(hover.spend)}</p>
            </div>
          </foreignObject>)}
      </svg>)}
    </div>);
}
function VehicleSpendDonut({ series }: {
    series: VehicleSpendSlice[];
}) {
    const total = series.reduce((sum, slice) => sum + slice.amount, 0);
    let cursor = 0;
    const stops = series.length > 0
        ? series
            .map((v) => {
            const start = cursor;
            cursor += v.pct;
            return `${v.color} ${start}% ${cursor}%`;
        })
            .join(', ')
        : '#52525b 0% 100%';
    return (<div className={`${PANEL} p-4 lg:col-span-3`}>
      <h3 className="text-sm font-bold text-zinc-900 dark:text-white mb-3">Fuel Spend by Vehicle</h3>
      {series.length === 0 ? (<ChartEmptyState message="No vehicle fuel spend recorded this month."/>) : (<div className="flex items-center gap-3">
          <div className="relative h-28 w-28 shrink-0">
            <div className="h-full w-full rounded-full" style={{ background: `conic-gradient(${stops})` }}/>
            <div className="absolute inset-3.5 rounded-full bg-zinc-950 border border-zinc-800 flex flex-col items-center justify-center text-center px-1">
              <span className="text-[8px] uppercase tracking-wider text-zinc-500">Total</span>
              <span className="text-[11px] font-bold text-white leading-tight">{fmt(total)}</span>
            </div>
          </div>
          <ul className="flex-1 space-y-1.5 min-w-0">
            {series.map((v) => (<li key={v.truck} className="flex items-center justify-between gap-1 text-[10px]">
                <span className="inline-flex items-center gap-1.5 text-zinc-600 dark:text-zinc-400 truncate">
                  <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ backgroundColor: v.color }}/>
                  Truck {v.truck}
                </span>
                <span className="shrink-0 font-medium text-zinc-800 dark:text-zinc-200 tabular-nums">
                  {fmt(v.amount)} ({v.pct}%)
                </span>
              </li>))}
          </ul>
        </div>)}
    </div>);
}
function JurisdictionMileage({ jurisdictions, onViewMap, }: {
    jurisdictions: JurisdictionSlice[];
    onViewMap?: () => void;
}) {
    const maxMiles = jurisdictions.length > 0 ? Math.max(...jurisdictions.map((j) => j.miles), 1) : 1;
    return (<div className={`${PANEL} p-4 lg:col-span-3`}>
      <div className="flex items-center justify-between gap-2 mb-3">
        <h3 className="text-sm font-bold text-zinc-900 dark:text-white">IFTA Mileage by Jurisdiction</h3>
        <button type="button" onClick={onViewMap} className="text-[10px] font-semibold text-sky-500 dark:text-sky-400 hover:underline inline-flex items-center gap-1">
          <MapIcon size={12}/>
          View Map
        </button>
      </div>
      {jurisdictions.length === 0 ? (<ChartEmptyState message="No jurisdiction mileage recorded this quarter."/>) : (<ul className="space-y-2.5">
          {jurisdictions.map((j) => (<li key={j.code}>
              <div className="flex items-center justify-between text-[10px] mb-1">
                <span className="text-zinc-600 dark:text-zinc-400">
                  {j.state} ({j.code})
                </span>
                <span className="font-medium text-zinc-800 dark:text-zinc-200 tabular-nums">
                  {j.miles.toLocaleString()} mi
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-zinc-200 dark:bg-zinc-800 overflow-hidden">
                <div className="h-full rounded-full bg-sky-500/80" style={{ width: `${(j.miles / maxMiles) * 100}%` }}/>
              </div>
            </li>))}
        </ul>)}
    </div>);
}
function FuelTypeRing({ fuelTypes, quarterLabel, quarterOptions, onQuarterChange, }: {
    fuelTypes: FuelTypeSlice[];
    quarterLabel: string;
    quarterOptions: string[];
    onQuarterChange: (quarter: string) => void;
}) {
    const [quarterOpen, setQuarterOpen] = useState(false);
    let cursor = 0;
    const stops = fuelTypes.length > 0
        ? fuelTypes
            .map((f) => {
            const start = cursor;
            cursor += f.pct;
            return `${f.color} ${start}% ${cursor}%`;
        })
            .join(', ')
        : '#52525b 0% 100%';
    return (<div className={`${PANEL} p-4 lg:col-span-3`}>
      <div className="flex items-start justify-between gap-2 mb-3">
        <div>
          <h3 className="text-sm font-bold text-zinc-900 dark:text-white">IFTA Quarter</h3>
          <p className={`${MUTED} mt-0.5`}>Mileage by Fuel Type</p>
        </div>
        <div className="relative">
          <button type="button" onClick={() => setQuarterOpen((o) => !o)} className="inline-flex items-center gap-1 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900/60 px-2 py-1 text-[10px] font-medium text-zinc-700 dark:text-zinc-300">
            {quarterLabel}
            <ChevronDown size={12} className={quarterOpen ? 'rotate-180' : ''}/>
          </button>
          {quarterOpen && (<div className="absolute right-0 top-full z-20 mt-1 min-w-[88px] rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-lg py-1">
              {quarterOptions.map((opt) => (<button key={opt} type="button" onClick={() => {
                    onQuarterChange(opt);
                    setQuarterOpen(false);
                }} className={`block w-full px-2.5 py-1 text-left text-[10px] hover:bg-zinc-100 dark:hover:bg-zinc-800 ${opt === quarterLabel
                    ? 'text-sky-600 dark:text-sky-400 font-semibold'
                    : 'text-zinc-700 dark:text-zinc-300'}`}>
                  {opt}
                </button>))}
            </div>)}
        </div>
      </div>
      {fuelTypes.length === 0 ? (<ChartEmptyState message="No fuel-type mileage recorded this quarter."/>) : (<div className="flex items-center gap-3">
          <div className="relative h-24 w-24 shrink-0">
            <div className="h-full w-full rounded-full" style={{
                background: `conic-gradient(${stops})`,
                mask: 'radial-gradient(farthest-side, transparent calc(100% - 14px), #000 calc(100% - 13px))',
                WebkitMask: 'radial-gradient(farthest-side, transparent calc(100% - 14px), #000 calc(100% - 13px))',
            }}/>
          </div>
          <ul className="flex-1 space-y-2">
            {fuelTypes.map((f) => (<li key={f.label} className="flex items-center justify-between gap-2 text-[10px]">
                <span className="inline-flex items-center gap-1.5 text-zinc-600 dark:text-zinc-400">
                  <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: f.color }}/>
                  {f.label}
                </span>
                <span className="font-medium text-zinc-800 dark:text-zinc-200 tabular-nums">
                  {f.miles.toLocaleString()} mi ({f.pct}%)
                </span>
              </li>))}
          </ul>
        </div>)}
    </div>);
}
function IftaSummaryCard({ panel, onViewReport, }: {
    panel: IftaPanelData;
    onViewReport?: () => void;
}) {
    const lines = [
        { label: 'Total Miles', value: `${panel.total_miles.toLocaleString()} mi` },
        { label: 'Taxable Miles', value: `${panel.taxable_miles.toLocaleString()} mi` },
        { label: 'Jurisdictions Traveled', value: panel.jurisdictions_traveled.toLocaleString() },
        { label: 'Est. Tax Due', value: fmt(panel.est_tax_due) },
        { label: 'Credits', value: fmt(panel.credits) },
    ];
    return (<div className={`${CARD} p-4`}>
      <div className="flex items-center justify-between mb-3">
        <p className={`${LABEL}`}>IFTA Summary</p>
        <button type="button" onClick={onViewReport} className="text-[10px] font-semibold text-sky-500 dark:text-sky-400 hover:underline">
          View Report
        </button>
      </div>
      <ul className="space-y-2">
        {lines.map((line) => (<li key={line.label} className="flex items-center justify-between text-xs">
            <span className="text-zinc-500 dark:text-zinc-400">{line.label}</span>
            <span className="font-medium text-zinc-800 dark:text-zinc-200 tabular-nums">{line.value}</span>
          </li>))}
      </ul>
      <div className="flex items-center justify-between mt-3 pt-3 border-t border-zinc-200 dark:border-zinc-800">
        <span className="text-sm font-semibold text-zinc-900 dark:text-white">Balance Due</span>
        <span className="text-sm font-bold text-rose-500 dark:text-rose-400 tabular-nums">{fmt(panel.balance_due)}</span>
      </div>
    </div>);
}
function RecentIftaReports({ reports, loading, onViewAll, onGenerate, onSelect, }: {
    reports: IftaReportRecord[];
    loading?: boolean;
    onViewAll?: () => void;
    onGenerate?: () => void;
    onSelect?: (report: IftaReportRecord) => void;
}) {
    return (<div className={`${CARD} p-4`}>
      <div className="flex items-center justify-between gap-2 mb-3">
        <p className={LABEL}>Recent IFTA Reports</p>
        <div className="flex items-center gap-2">
          <button type="button" onClick={onGenerate} className="inline-flex items-center gap-1 rounded-lg bg-sky-600 hover:bg-sky-500 text-white px-2 py-1 text-[10px] font-semibold transition-colors">
            <Plus size={12}/>
            Generate IFTA Report
          </button>
          <button type="button" onClick={onViewAll} className="text-[10px] font-semibold text-sky-500 dark:text-sky-400 hover:underline">
            View All
          </button>
        </div>
      </div>
      {loading ? (<p className="text-[10px] text-zinc-500 py-4 text-center">Loading reports…</p>) : reports.length === 0 ? (<p className="text-[10px] text-zinc-500 py-4 text-center">No saved IFTA reports yet.</p>) : (<ul className="space-y-2.5">
          {reports.slice(0, 5).map((r) => (<li key={r.id}>
              <button type="button" onClick={() => onSelect?.(r)} className="w-full flex items-center justify-between gap-2 rounded-lg border border-zinc-200/80 dark:border-zinc-800/80 bg-white/50 dark:bg-zinc-950/40 px-3 py-2.5 text-left hover:border-sky-500/40 transition-colors">
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 truncate">{r.title}</p>
                  <p className="text-[10px] text-zinc-500">
                    Q{r.quarter} {r.year} · {formatReportTimestamp(r.created_at)}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  <span className="text-xs font-medium text-zinc-800 dark:text-zinc-200 tabular-nums">
                    {fmt(r.tax_due)}
                  </span>
                  <span className={`rounded-full border px-2 py-0.5 text-[9px] font-semibold ${IFTA_STATUS_STYLES[r.status] ?? IFTA_STATUS_STYLES.Draft}`}>
                    {r.status}
                  </span>
                </div>
              </button>
            </li>))}
        </ul>)}
    </div>);
}
interface FuelIftaDashboardProps {
    embedded?: boolean;
    onLedgerRefresh?: () => void | Promise<void>;
}
export default function FuelIftaDashboard({ embedded = false, onLedgerRefresh }: FuelIftaDashboardProps) {
    const [registryTab, setRegistryTab] = useState<(typeof REGISTRY_TABS)[number]>('Fuel Transactions');
    const [searchInput, setSearchInput] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [vehicleFilter, setVehicleFilter] = useState('All Vehicles');
    const [chartDateRange, setChartDateRange] = useState<ChartDateRange>('7 Days');
    const [selectedQuarter, setSelectedQuarter] = useState(currentQuarterLabel());
    const [periodFilterMode, setPeriodFilterMode] = useState<'range' | 'quarter'>('range');
    const [cardFilter, setCardFilter] = useState('All Fuel Cards');
    const [typeFilter, setTypeFilter] = useState('All Types');
    const [receiptFilter, setReceiptFilter] = useState<(typeof RECEIPT_FILTER_OPTIONS)[number]>('All Receipts');
    const [purchaseTypeFilter, setPurchaseTypeFilter] = useState<(typeof PURCHASE_TYPE_OPTIONS)[number]>('All Purchase Types');
    const [moreFiltersOpen, setMoreFiltersOpen] = useState(false);
    const [page, setPage] = useState(1);
    const [perPage, setPerPage] = useState(7);
    const [exporting, setExporting] = useState(false);
    const [showReceiptModal, setShowReceiptModal] = useState(false);
    const [showImportModal, setShowImportModal] = useState(false);
    const [receiptSubmitting, setReceiptSubmitting] = useState(false);
    const [importSubmitting, setImportSubmitting] = useState(false);
    const [receiptFormError, setReceiptFormError] = useState<string | null>(null);
    const [importFormError, setImportFormError] = useState<string | null>(null);
    const [trucks, setTrucks] = useState<TruckRecord[]>([]);
    const [drivers, setDrivers] = useState<DriverRecord[]>([]);
    const [selectedTruckProfileId, setSelectedTruckProfileId] = useState<number | null>(null);
    const [receiptFile, setReceiptFile] = useState<File | null>(null);
    const [importFile, setImportFile] = useState<File | null>(null);
    const [receiptForm, setReceiptForm] = useState({
        date: todayIsoDate(),
        vehicle_id: '',
        location_state: 'PA',
        fuel_type: 'Diesel',
        gallons: '',
        total_amount: '',
        odometer: '',
    });
    const [dataRefreshKey, setDataRefreshKey] = useState(0);
    const [showMapModal, setShowMapModal] = useState(false);
    const [showReportModal, setShowReportModal] = useState(false);
    const [showFilingsModal, setShowFilingsModal] = useState(false);
    const [showGenerateModal, setShowGenerateModal] = useState(false);
    const [showReportDetailModal, setShowReportDetailModal] = useState(false);
    const [selectedSavedReport, setSelectedSavedReport] = useState<IftaReportRecord | null>(null);
    const [generateSubmitting, setGenerateSubmitting] = useState(false);
    const [generateFormError, setGenerateFormError] = useState<string | null>(null);
    const initialQuarter = parseQuarterLabel(currentQuarterLabel());
    const [generateForm, setGenerateForm] = useState({
        title: `IFTA Q${initialQuarter.quarter} ${initialQuarter.year}`,
        quarter: initialQuarter.quarter,
        year: initialQuarter.year,
    });
    const [jurisdictionRows, setJurisdictionRows] = useState<IftaJurisdictionFormRow[]>([
        emptyJurisdictionRow(),
    ]);
    const { iftaReports, iftaReportsLoading, fetchIftaReports } = useTMSStore();
    const [summary, setSummary] = useState<FuelIftaFinancialSummary | null>(null);
    const [summaryLoading, setSummaryLoading] = useState(false);
    const [summaryError, setSummaryError] = useState<string | null>(null);
    const [summarySweepKey, setSummarySweepKey] = useState(0);
    const [quarterlySummary, setQuarterlySummary] = useState<IftaQuarterlySummary | null>(null);
    const [quarterlyLoading, setQuarterlyLoading] = useState(false);
    const [lockingQuarter, setLockingQuarter] = useState(false);
    const [transactions, setTransactions] = useState<FuelIftaTransactionRow[]>([]);
    const [transactionTotal, setTransactionTotal] = useState(0);
    const [totalPages, setTotalPages] = useState(1);
    const [vehicleMap, setVehicleMap] = useState<Map<string, number>>(new Map());
    const api = useMemo(() => createTmsApi(createApiClient(readPersistedTmsToken())), []);
    const authToken = readPersistedTmsToken() ?? '';
    const selectedTruckProfile = useMemo(() => trucks.find((truck) => truck.id === selectedTruckProfileId) ?? null, [selectedTruckProfileId, trucks]);
    const quarterOptions = useMemo(() => buildQuarterOptions(), []);
    const reloadSummary = useCallback(async () => {
        if (!hasValidTmsToken(readPersistedTmsToken()))
            return;
        setSummaryLoading(true);
        setSummaryError(null);
        try {
            const res = await api.financials.fuelIftaSummary({
                quarter: selectedQuarter,
                date_range: chartDateRange.toLowerCase(),
            });
            setSummary(res);
            setSummarySweepKey((key) => key + 1);
        }
        catch (err) {
            setSummaryError(formatApiError(err, 'Unable to load fuel and IFTA metrics.'));
        }
        finally {
            setSummaryLoading(false);
        }
    }, [api, selectedQuarter, chartDateRange]);
    useEffect(() => {
        if (!hasValidTmsToken(readPersistedTmsToken()))
            return;
        let cancelled = false;
        const loadSummary = async () => {
            setSummaryLoading(true);
            setSummaryError(null);
            try {
                const res = await api.financials.fuelIftaSummary({
                    quarter: selectedQuarter,
                    date_range: chartDateRange.toLowerCase(),
                });
                if (cancelled)
                    return;
                setSummary(res);
                setSummarySweepKey((key) => key + 1);
            }
            catch (err) {
                if (cancelled)
                    return;
                setSummaryError(formatApiError(err, 'Unable to load fuel and IFTA metrics.'));
            }
            finally {
                if (!cancelled) {
                    setSummaryLoading(false);
                }
            }
        };
        void loadSummary();
        return () => {
            cancelled = true;
        };
    }, [api, selectedQuarter, chartDateRange]);
    const parsedSelectedQuarter = useMemo(() => parseQuarterLabel(selectedQuarter || summary?.ifta_quarter_label || currentQuarterLabel()), [selectedQuarter, summary?.ifta_quarter_label]);
    useEffect(() => {
        if (!hasValidTmsToken(readPersistedTmsToken()))
            return;
        let cancelled = false;
        const loadQuarterlySummary = async () => {
            setQuarterlyLoading(true);
            try {
                const res = await api.financials.iftaQuarterlySummary({
                    year: parsedSelectedQuarter.year,
                    quarter: parsedSelectedQuarter.quarter,
                });
                if (!cancelled)
                    setQuarterlySummary(res);
            }
            catch (err) {
                if (!cancelled) {
                    setQuarterlySummary(null);
                    console.error('Failed to load IFTA quarterly summary', err);
                }
            }
            finally {
                if (!cancelled)
                    setQuarterlyLoading(false);
            }
        };
        void loadQuarterlySummary();
        return () => {
            cancelled = true;
        };
    }, [api, parsedSelectedQuarter.year, parsedSelectedQuarter.quarter, summarySweepKey]);
    useEffect(() => {
        if (!hasValidTmsToken(readPersistedTmsToken()))
            return;
        let cancelled = false;
        const loadFleet = async () => {
            try {
                const [truckRows, driverRows] = await Promise.all([
                    api.fleet.trucks(),
                    api.fleet.drivers(),
                ]);
                if (cancelled)
                    return;
                setTrucks(truckRows);
                setDrivers(driverRows);
                setVehicleMap((prev) => {
                    const next = new Map(prev);
                    truckRows.forEach((truck) => {
                        if (truck.truck_number) {
                            next.set(`#${truck.truck_number}`, truck.id);
                        }
                    });
                    return next;
                });
            }
            catch (err) {
                console.error('Failed to load fleet options for fuel receipts', err);
            }
        };
        void loadFleet();
        return () => {
            cancelled = true;
        };
    }, [api]);
    useEffect(() => {
        if (!hasValidTmsToken(readPersistedTmsToken()))
            return;
        void fetchIftaReports();
    }, [fetchIftaReports, dataRefreshKey]);
    useEffect(() => {
        const timer = window.setTimeout(() => {
            setSearchQuery(searchInput.trim());
            setPage(1);
        }, 300);
        return () => window.clearTimeout(timer);
    }, [searchInput]);
    const selectedVehicleId = useMemo(() => {
        if (vehicleFilter === 'All Vehicles')
            return null;
        return vehicleMap.get(vehicleFilter) ?? null;
    }, [vehicleFilter, vehicleMap]);
    const transactionQuery = useMemo(() => ({
        vehicle_id: selectedVehicleId,
        date_range: periodFilterMode === 'range' ? chartDateRange.toLowerCase() : undefined,
        quarter: periodFilterMode === 'quarter' ? selectedQuarter : undefined,
        search: searchQuery || undefined,
        fuel_type: typeFilter !== 'All Types' ? typeFilter : undefined,
        type: purchaseTypeFilter !== 'All Purchase Types' ? purchaseTypeFilter : undefined,
        has_receipt: receiptFilter === 'With Receipt'
            ? true
            : receiptFilter === 'Without Receipt'
                ? false
                : undefined,
        page,
        limit: perPage,
    }), [
        selectedVehicleId,
        periodFilterMode,
        chartDateRange,
        selectedQuarter,
        searchQuery,
        typeFilter,
        purchaseTypeFilter,
        receiptFilter,
        page,
        perPage,
    ]);
    useEffect(() => {
        if (!hasValidTmsToken(readPersistedTmsToken()))
            return;
        let cancelled = false;
        const loadTransactions = async () => {
            try {
                const res = await api.financials.fuelTransactions(transactionQuery);
                if (cancelled)
                    return;
                setTransactions(res.data);
                setTransactionTotal(res.total_count ?? res.total ?? 0);
                setTotalPages(Math.max(1, res.pages ?? 1));
                if (res.page && res.page !== page) {
                    setPage(res.page);
                }
                setVehicleMap((prev) => {
                    const next = new Map(prev);
                    res.data.forEach((row) => {
                        if (row.vehicle && row.truck_id != null) {
                            next.set(row.vehicle, row.truck_id);
                        }
                    });
                    return next;
                });
            }
            catch (err) {
                console.error('Failed to load fuel transactions', err);
                if (!cancelled) {
                    setTransactions([]);
                    setTransactionTotal(0);
                    setTotalPages(1);
                }
            }
        };
        void loadTransactions();
        return () => {
            cancelled = true;
        };
    }, [api, transactionQuery, page, dataRefreshKey]);
    const handleOpenTruckProfile = useCallback((truckId: number | null | undefined) => {
        if (truckId == null)
            return;
        setSelectedTruckProfileId(truckId);
    }, []);
    const handleTruckProfileSuccess = useCallback(async () => {
        try {
            const [truckRows, driverRows] = await Promise.all([
                api.fleet.trucks(),
                api.fleet.drivers(),
            ]);
            setTrucks(truckRows);
            setDrivers(driverRows);
            setDataRefreshKey((prev) => prev + 1);
        }
        catch (err) {
            console.error('Failed to refresh fleet after truck profile update', err);
        }
    }, [api]);
    const handleExport = useCallback(async () => {
        if (!hasValidTmsToken(readPersistedTmsToken()))
            return;
        setExporting(true);
        try {
            const blob = await api.financials.fuelIftaTransactionsExport({
                vehicle_id: selectedVehicleId,
                date_range: periodFilterMode === 'range' ? chartDateRange.toLowerCase() : undefined,
                quarter: periodFilterMode === 'quarter' ? selectedQuarter : undefined,
                search: searchQuery || undefined,
                fuel_type: typeFilter !== 'All Types' ? typeFilter : undefined,
                type: purchaseTypeFilter !== 'All Purchase Types' ? purchaseTypeFilter : undefined,
                has_receipt: receiptFilter === 'With Receipt'
                    ? true
                    : receiptFilter === 'Without Receipt'
                        ? false
                        : undefined,
            });
            const url = URL.createObjectURL(blob);
            const anchor = document.createElement('a');
            anchor.href = url;
            anchor.download = `fuel_transactions_${new Date().toISOString().slice(0, 10)}.csv`;
            document.body.appendChild(anchor);
            anchor.click();
            anchor.remove();
            URL.revokeObjectURL(url);
        }
        catch (err) {
            console.error('Failed to export fuel transactions', err);
        }
        finally {
            setExporting(false);
        }
    }, [api, selectedVehicleId, periodFilterMode, chartDateRange, selectedQuarter, searchQuery, typeFilter, purchaseTypeFilter, receiptFilter]);
    const openReceiptModal = useCallback(() => {
        setReceiptFormError(null);
        setReceiptFile(null);
        setReceiptForm({
            date: todayIsoDate(),
            vehicle_id: '',
            location_state: 'PA',
            fuel_type: 'Diesel',
            gallons: '',
            total_amount: '',
            odometer: '',
        });
        setShowReceiptModal(true);
    }, []);
    const handleSubmitReceipt = useCallback(async () => {
        if (!hasValidTmsToken(readPersistedTmsToken()))
            return;
        const gallons = Number(receiptForm.gallons);
        const totalAmount = Number(receiptForm.total_amount);
        const odometer = Number.parseInt(receiptForm.odometer, 10);
        if (!receiptForm.date) {
            setReceiptFormError('Transaction date is required.');
            return;
        }
        if (!receiptForm.location_state) {
            setReceiptFormError('State is required.');
            return;
        }
        if (!Number.isFinite(gallons) || gallons <= 0) {
            setReceiptFormError('Gallons must be greater than zero.');
            return;
        }
        if (!Number.isFinite(totalAmount) || totalAmount <= 0) {
            setReceiptFormError('Total amount must be greater than zero.');
            return;
        }
        if (!Number.isFinite(odometer) || odometer <= 0) {
            setReceiptFormError('Odometer reading is required and must be greater than zero.');
            return;
        }
        setReceiptSubmitting(true);
        setReceiptFormError(null);
        const toastId = toast.loading('Saving fuel receipt…');
        try {
            const formData = new FormData();
            formData.append('transaction_date', receiptForm.date);
            formData.append('location_state', receiptForm.location_state);
            formData.append('fuel_type', receiptForm.fuel_type);
            formData.append('gallons', String(gallons));
            formData.append('total_amount', String(totalAmount));
            formData.append('odometer', String(odometer));
            if (receiptForm.vehicle_id) {
                formData.append('vehicle_id', receiptForm.vehicle_id);
            }
            if (receiptFile) {
                formData.append('receipt', receiptFile);
            }
            await api.financials.fuelCreateManualTransaction(formData);
            toast.success('Fuel receipt saved.', { id: toastId });
            setShowReceiptModal(false);
            setPage(1);
            setDataRefreshKey((key) => key + 1);
            await reloadSummary();
            await onLedgerRefresh?.();
        }
        catch (err) {
            const message = formatApiError(err, 'Unable to save fuel receipt.');
            setReceiptFormError(message);
            toast.error(message, { id: toastId });
        }
        finally {
            setReceiptSubmitting(false);
        }
    }, [api, onLedgerRefresh, receiptFile, receiptForm, reloadSummary]);
    const openGenerateModal = useCallback(() => {
        const parsed = parseQuarterLabel(selectedQuarter || summary?.ifta_quarter_label || currentQuarterLabel());
        setGenerateFormError(null);
        setGenerateForm({
            title: `IFTA Q${parsed.quarter} ${parsed.year}`,
            quarter: parsed.quarter,
            year: parsed.year,
        });
        setJurisdictionRows(jurisdictionRowsFromTaxRows(summary?.state_tax_rows ?? []));
        setShowGenerateModal(true);
    }, [selectedQuarter, summary?.ifta_quarter_label, summary?.state_tax_rows]);
    const handleGenerateReport = useCallback(async () => {
        if (!hasValidTmsToken(readPersistedTmsToken()))
            return;
        const entries = jurisdictionRows
            .map((row) => ({
            state: row.state.trim().toUpperCase(),
            miles: Number(row.miles),
            gallons_purchased: Number(row.gallons_purchased),
        }))
            .filter((row) => row.state);
        if (!generateForm.title.trim()) {
            setGenerateFormError('Report title is required.');
            return;
        }
        if (entries.length === 0) {
            setGenerateFormError('Add at least one state row.');
            return;
        }
        for (const entry of entries) {
            if (!Number.isFinite(entry.miles) || entry.miles < 0) {
                setGenerateFormError(`Miles must be zero or greater for ${entry.state}.`);
                return;
            }
            if (!Number.isFinite(entry.gallons_purchased) || entry.gallons_purchased < 0) {
                setGenerateFormError(`Gallons purchased must be zero or greater for ${entry.state}.`);
                return;
            }
        }
        const totalGallons = entries.reduce((sum, row) => sum + row.gallons_purchased, 0);
        const totalMiles = entries.reduce((sum, row) => sum + row.miles, 0);
        if (totalGallons <= 0) {
            setGenerateFormError('Total gallons purchased must be greater than zero.');
            return;
        }
        if (totalMiles <= 0) {
            setGenerateFormError('Total miles must be greater than zero.');
            return;
        }
        const bounds = quarterDateBounds(generateForm.quarter, generateForm.year);
        setGenerateSubmitting(true);
        setGenerateFormError(null);
        const toastId = toast.loading('Generating IFTA report…');
        try {
            await api.ifta.createReport({
                title: generateForm.title.trim(),
                quarter: generateForm.quarter,
                year: generateForm.year,
                start_date: bounds.start_date,
                end_date: bounds.end_date,
                jurisdiction_entries: entries,
            });
            toast.success('IFTA report saved.', { id: toastId });
            setShowGenerateModal(false);
            setDataRefreshKey((key) => key + 1);
            await fetchIftaReports();
        }
        catch (err) {
            const message = formatApiError(err, 'Unable to generate IFTA report.');
            setGenerateFormError(message);
            toast.error(message, { id: toastId });
        }
        finally {
            setGenerateSubmitting(false);
        }
    }, [api, fetchIftaReports, generateForm, jurisdictionRows]);
    const openSavedReportDetail = useCallback((report: IftaReportRecord) => {
        setSelectedSavedReport(report);
        setShowReportDetailModal(true);
    }, []);
    const handleImportCardData = useCallback(async () => {
        if (!hasValidTmsToken(readPersistedTmsToken()) || !importFile)
            return;
        setImportSubmitting(true);
        setImportFormError(null);
        const toastId = toast.loading('Importing fuel card statement…');
        try {
            const result = await api.financials.fuelImportCardData(importFile);
            if (result.imported <= 0) {
                const detail = result.errors[0] ?? 'No rows were imported.';
                throw new Error(detail);
            }
            toast.success(`Imported ${result.imported} fuel card transaction${result.imported === 1 ? '' : 's'}.`, {
                id: toastId,
            });
            if (result.skipped > 0) {
                toast(`${result.skipped} row(s) skipped. Check column mapping if needed.`, { icon: '⚠️' });
            }
            setShowImportModal(false);
            setImportFile(null);
            setRegistryTab('Fuel Transactions');
            setPage(1);
            setDataRefreshKey((key) => key + 1);
            await reloadSummary();
            await onLedgerRefresh?.();
        }
        catch (err) {
            const message = formatApiError(err, 'Unable to import fuel card statement.');
            setImportFormError(message);
            toast.error(message, { id: toastId });
        }
        finally {
            setImportSubmitting(false);
        }
    }, [api, importFile, onLedgerRefresh, reloadSummary]);
    const pageNumbers = useMemo(() => buildPageList(page, totalPages), [page, totalPages]);
    const iftaQuarterLabel = selectedQuarter || summary?.ifta_quarter_label || currentQuarterLabel();
    const performanceCards = useMemo(() => {
        const values: Record<string, number> = {
            spend: summary?.total_fuel_spend ?? 0,
            gallons: summary?.total_gallons ?? 0,
            ppg: summary?.avg_price_per_gallon ?? 0,
            mpg: summary?.fleet_avg_mpg ?? 0,
        };
        return PERFORMANCE_META.map((meta) => ({
            ...meta,
            value: meta.format(values[meta.key] ?? 0),
            sub: meta.key === 'mpg' ? `${iftaQuarterLabel} fleet` : chartDateRange,
        }));
    }, [summary, chartDateRange, iftaQuarterLabel]);
    const fuelSpendSeries = useMemo(() => summary?.fuel_spend_series ?? [], [summary?.fuel_spend_series]);
    const stateTaxRows = useMemo(() => summary?.state_tax_rows ?? [], [summary?.state_tax_rows]);
    const vehicleSpendSeries = useMemo((): VehicleSpendSlice[] => {
        const live = summary?.vehicle_spend ?? [];
        return live.map((row, index) => ({
            truck: row.truck,
            amount: row.amount,
            pct: row.pct,
            color: VEHICLE_COLORS[index % VEHICLE_COLORS.length],
        }));
    }, [summary?.vehicle_spend]);
    const jurisdictionSeries = useMemo((): JurisdictionSlice[] => {
        return summary?.jurisdiction_miles ?? [];
    }, [summary?.jurisdiction_miles]);
    const fuelTypeSeries = useMemo((): FuelTypeSlice[] => {
        const live = summary?.fuel_type_miles ?? [];
        return live.map((row) => ({
            label: row.label,
            miles: row.miles,
            pct: row.pct,
            color: FUEL_TYPE_COLORS[row.label] ?? FUEL_TYPE_COLORS.Other,
        }));
    }, [summary?.fuel_type_miles]);
    const iftaPanel = useMemo(() => {
        return summary?.ifta ?? EMPTY_IFTA_PANEL;
    }, [summary?.ifta]);
    const iftaDeadlineLabel = useMemo(() => resolveIftaDeadlineLabel(summary?.ifta_deadline, iftaQuarterLabel), [summary?.ifta_deadline, iftaQuarterLabel]);
    const filingMatrixRows = useMemo(() => quarterlySummary?.jurisdiction_matrix ?? [], [quarterlySummary?.jurisdiction_matrix]);
    const handleDownloadFilingCsv = useCallback(() => {
        if (!quarterlySummary || filingMatrixRows.length === 0) {
            toast.error('No jurisdictional filing data available for this quarter.');
            return;
        }
        downloadIftaFilingCsv(quarterlySummary);
    }, [quarterlySummary, filingMatrixRows.length]);
    const handleLockQuarter = useCallback(async () => {
        setLockingQuarter(true);
        const toastId = toast.loading(`Locking ${iftaQuarterLabel} IFTA quarter…`);
        try {
            const res = await api.financials.iftaLockQuarter({
                year: parsedSelectedQuarter.year,
                quarter: parsedSelectedQuarter.quarter,
            });
            setQuarterlySummary(res);
            toast.success(res.is_locked
                ? `${res.quarter_label} locked (${res.tracking_id ?? 'snapshot saved'}).`
                : `${res.quarter_label} snapshot saved.`, { id: toastId });
        }
        catch (err) {
            toast.error(formatApiError(err, 'Unable to lock IFTA quarter.'), { id: toastId });
        }
        finally {
            setLockingQuarter(false);
        }
    }, [api, iftaQuarterLabel, parsedSelectedQuarter.quarter, parsedSelectedQuarter.year]);
    const vehicles = useMemo(() => {
        const labels = Array.from(vehicleMap.keys()).sort();
        return ['All Vehicles', ...labels];
    }, [vehicleMap]);
    return (<div className="relative z-0 isolate space-y-5">
      {summaryError && (<div role="alert" className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-xs text-amber-700 dark:text-amber-300">
          {summaryError}
        </div>)}
      {!embedded && (<header className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-zinc-900 dark:text-white">Fuel &amp; IFTA Management</h1>
            <p className={`${MUTED} mt-1 max-w-xl`}>
              Track fuel transactions, monitor efficiency and manage IFTA reporting.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <label className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900/60 px-3 py-2 text-xs text-zinc-700 dark:text-zinc-300">
              <Calendar size={14} className="text-zinc-400"/>
              {iftaQuarterLabel} · {chartDateRange}
            </label>
            <button type="button" className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900/60 px-3 py-2 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">
              <Filter size={14}/>
              Filters
              <ChevronDown size={14}/>
            </button>
            <button type="button" onClick={openReceiptModal} className="inline-flex items-center gap-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white px-3 py-2 text-xs font-semibold transition-colors shadow-sm">
              <Plus size={14}/>
              Add Fuel Receipt
            </button>
          </div>
        </header>)}

      <div key={summarySweepKey} className={`space-y-5 animate-in fade-in slide-in-from-bottom-1 duration-300 ${summaryLoading ? 'opacity-70' : ''}`}>
      <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-3">
        {performanceCards.map((m) => {
            const Icon = m.icon;
            return (<div key={m.key} className={`${CARD} p-4 flex flex-col gap-2`}>
              <div className="flex items-center justify-between">
                <span className={LABEL}>{m.label}</span>
                <span className={`flex h-8 w-8 items-center justify-center rounded-lg border ${m.iconBg}`}>
                  <Icon size={15} className={m.accent}/>
                </span>
              </div>
              <p className="text-xl font-bold text-zinc-900 dark:text-white tabular-nums tracking-tight">{m.value}</p>
              <TrendBadge trend={m.trend} sub={m.sub} badgeClass={m.badge}/>
            </div>);
        })}

        <div className={`${CARD} p-4 flex flex-col gap-2 border-rose-500/25 dark:border-rose-500/30 bg-rose-500/5 dark:bg-rose-500/10`}>
          <div className="flex items-center justify-between">
            <span className={LABEL}>IFTA {iftaQuarterLabel}</span>
            <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-rose-500/25 bg-rose-500/10">
              <FileText size={15} className="text-rose-500"/>
            </span>
          </div>
          <p className="text-xl font-bold text-zinc-900 dark:text-white">
            Due in {summary?.ifta_days_remaining ?? 0} days
          </p>
          <span className="inline-flex items-center gap-1 rounded-full border border-rose-500/25 bg-rose-500/10 px-2 py-0.5 text-[10px] font-medium text-rose-600 dark:text-rose-400 w-fit">
            <AlertCircle size={11}/>
            {iftaDeadlineLabel}
          </span>
        </div>
      </section>

      <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-12 gap-4">
        <FuelSpendChart value={chartDateRange} onChange={(range) => {
            setPeriodFilterMode('range');
            setChartDateRange(range);
            setPage(1);
        }} series={fuelSpendSeries}/>
        <VehicleSpendDonut series={vehicleSpendSeries}/>
        <JurisdictionMileage jurisdictions={jurisdictionSeries} onViewMap={() => setShowMapModal(true)}/>
        <FuelTypeRing fuelTypes={fuelTypeSeries} quarterLabel={iftaQuarterLabel} quarterOptions={quarterOptions} onQuarterChange={(quarter) => {
            setPeriodFilterMode('quarter');
            setSelectedQuarter(quarter);
            setPage(1);
        }}/>
      </section>

      <section className={`${PANEL} overflow-hidden`}>
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 px-5 py-4 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-[#0B0B0B]">
          <div>
            <h2 className="text-sm font-bold text-zinc-900 dark:text-white">Quarterly IFTA Filing Matrix</h2>
            <p className={`${MUTED} mt-0.5`}>
              {iftaQuarterLabel}
              {quarterlySummary?.is_locked ? ' · Locked snapshot' : ' · Live compilation'}
              {quarterlySummary?.tracking_id ? ` · ${quarterlySummary.tracking_id}` : ''}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select value={iftaQuarterLabel} onChange={(e) => {
            setPeriodFilterMode('quarter');
            setSelectedQuarter(e.target.value);
            setPage(1);
        }} className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900/60 px-3 py-2 text-xs font-semibold text-zinc-800 dark:text-zinc-200">
              {quarterOptions.map((opt) => (<option key={opt} value={opt}>
                  {opt}
                </option>))}
            </select>
            <button type="button" disabled={quarterlyLoading || filingMatrixRows.length === 0} onClick={handleDownloadFilingCsv} className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900/60 px-3 py-2 text-xs font-semibold text-zinc-800 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors disabled:opacity-50">
              <Download size={14}/>
              Download Jurisdictional Filing CSV
            </button>
            <button type="button" disabled={lockingQuarter || quarterlySummary?.is_locked} onClick={() => void handleLockQuarter()} className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-900 dark:bg-white dark:text-black text-white px-3 py-2 text-xs font-semibold disabled:opacity-50">
              {lockingQuarter ? <Loader2 size={14} className="animate-spin"/> : <Lock size={14}/>}
              {quarterlySummary?.is_locked ? 'Quarter Locked' : 'Lock Quarter'}
            </button>
          </div>
        </div>

        <div className="px-5 py-4 grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-3 border-b border-zinc-200 dark:border-zinc-800">
          {[
            { label: 'Fleet MPG', value: fmtNum(quarterlySummary?.fleet_mpg ?? summary?.fleet_avg_mpg ?? 0, 2) },
            { label: 'Total Miles', value: (quarterlySummary?.total_miles ?? 0).toLocaleString() },
            { label: 'Total Gallons', value: fmtNum(quarterlySummary?.total_gallons ?? 0) },
            { label: 'Tax on Miles', value: fmt(quarterlySummary?.total_tax_due ?? 0) },
            { label: 'Pump Credits', value: fmt(quarterlySummary?.total_credits ?? 0) },
            { label: 'Balance Due', value: fmt(quarterlySummary?.balance_due ?? 0) },
            {
                label: 'Status',
                value: quarterlySummary?.is_locked ? 'Locked' : quarterlyLoading ? 'Loading' : 'Open',
            },
        ].map((item) => (<div key={item.label} className={`${CARD} px-3 py-2.5`}>
              <p className={LABEL}>{item.label}</p>
              <p className="text-sm font-bold text-zinc-900 dark:text-white mt-1 tabular-nums">{item.value}</p>
            </div>))}
        </div>

        <div className="overflow-x-auto">
          {quarterlyLoading ? (<div className="flex items-center justify-center gap-2 py-16 text-sm text-zinc-500">
              <Loader2 size={16} className="animate-spin"/>
              Compiling jurisdictional matrix…
            </div>) : filingMatrixRows.length === 0 ? (<p className={`${MUTED} text-center py-16`}>No jurisdictional mileage or fuel data for this quarter.</p>) : (<table className="w-full text-left text-xs">
              <thead className="bg-zinc-50 dark:bg-[#0B0B0B] text-zinc-500 dark:text-zinc-400 uppercase text-[10px] font-bold border-b border-zinc-200 dark:border-zinc-800">
                <tr>
                  {[
                'State',
                'Total Miles',
                'Taxable Gallons',
                'Paid Gallons',
                'Tax Rate',
                'Net Tax Owed',
                'Credits',
                'Net Liability',
            ].map((col) => (<th key={col} className="px-4 py-3 font-semibold whitespace-nowrap">
                      {col}
                    </th>))}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/80">
                {filingMatrixRows.map((row) => (<tr key={row.state_code} className="hover:bg-zinc-50/70 dark:hover:bg-zinc-900/40">
                    <td className="px-4 py-3 font-semibold text-zinc-900 dark:text-white whitespace-nowrap">
                      {row.state_name} ({row.state_code})
                    </td>
                    <td className="px-4 py-3 tabular-nums">{row.total_miles.toLocaleString()}</td>
                    <td className="px-4 py-3 tabular-nums">{fmtNum(row.taxable_gallons)}</td>
                    <td className="px-4 py-3 tabular-nums">{fmtNum(row.paid_gallons)}</td>
                    <td className="px-4 py-3 tabular-nums">{fmt(row.tax_rate)}</td>
                    <td className="px-4 py-3 tabular-nums text-rose-500">{fmt(row.net_tax_owed)}</td>
                    <td className="px-4 py-3 tabular-nums text-emerald-500">{fmt(row.available_credits)}</td>
                    <td className={`px-4 py-3 tabular-nums font-semibold ${row.net_liability >= 0 ? 'text-rose-500' : 'text-emerald-500'}`}>
                      {fmt(row.net_liability)}
                    </td>
                  </tr>))}
              </tbody>
            </table>)}
        </div>
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className={`${PANEL} lg:col-span-8 flex flex-col overflow-hidden`}>
          <div className="flex items-center justify-between gap-3 px-5 pt-4 border-b border-zinc-200 dark:border-zinc-800">
            <div className="flex items-center gap-1 -mb-px">
              {REGISTRY_TABS.map((tab) => (<button key={tab} type="button" onClick={() => setRegistryTab(tab)} className={`shrink-0 px-3 py-2.5 text-xs font-medium border-b-2 transition-colors whitespace-nowrap ${registryTab === tab
                ? 'border-sky-500 text-sky-600 dark:text-sky-400'
                : 'border-transparent text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'}`}>
                  {tab}
                </button>))}
            </div>
            <div className="flex items-center gap-1 mb-3">
              <button type="button" onClick={openReceiptModal} className="inline-flex items-center gap-1.5 rounded-lg bg-violet-600 hover:bg-violet-500 text-white px-3 py-1.5 text-xs font-semibold transition-colors">
                <Plus size={14}/>
                Add Fuel Receipt
              </button>
              <button type="button" disabled={exporting} onClick={() => void handleExport()} className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 px-3 py-1.5 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors disabled:opacity-50">
                <Download size={14}/>
                {exporting ? 'Exporting…' : 'Export'}
              </button>
              <button type="button" className="p-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors" aria-label="More options">
                <MoreHorizontal size={14}/>
              </button>
            </div>
          </div>

          <div className="px-5 py-3 flex flex-wrap items-center gap-2 border-b border-zinc-100 dark:border-zinc-800/80 bg-zinc-50/50 dark:bg-zinc-900/30">
            <div className="relative flex-1 min-w-[160px] max-w-xs">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400"/>
              <input type="search" value={searchInput} onChange={(e) => setSearchInput(e.target.value)} placeholder="Search transactions…" className="w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900/60 pl-8 pr-3 py-1.5 text-xs text-zinc-800 dark:text-zinc-200 placeholder:text-zinc-400 focus:outline-none focus:ring-1 focus:ring-sky-500/50"/>
            </div>
            <select value={vehicleFilter} onChange={(e) => {
            setVehicleFilter(e.target.value);
            setPage(1);
        }} className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900/60 px-2.5 py-1.5 text-xs text-zinc-700 dark:text-zinc-300 focus:outline-none focus:ring-1 focus:ring-sky-500/50">
              {vehicles.map((v) => (<option key={v} value={v}>
                  {v}
                </option>))}
            </select>
            <select value={cardFilter} onChange={(e) => setCardFilter(e.target.value)} className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900/60 px-2.5 py-1.5 text-xs text-zinc-700 dark:text-zinc-300 focus:outline-none focus:ring-1 focus:ring-sky-500/50">
              <option>All Fuel Cards</option>
              <option>Comdata #4821</option>
              <option>EFS #1092</option>
            </select>
            <select value={typeFilter} onChange={(e) => {
            setTypeFilter(e.target.value);
            setPage(1);
        }} className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900/60 px-2.5 py-1.5 text-xs text-zinc-700 dark:text-zinc-300 focus:outline-none focus:ring-1 focus:ring-sky-500/50">
              <option>All Types</option>
              <option>Diesel</option>
              <option>Gasoline</option>
              <option>DEF</option>
            </select>
            <select value={receiptFilter} onChange={(e) => {
            setReceiptFilter(e.target.value as (typeof RECEIPT_FILTER_OPTIONS)[number]);
            setPage(1);
        }} className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900/60 px-2.5 py-1.5 text-xs text-zinc-700 dark:text-zinc-300 focus:outline-none focus:ring-1 focus:ring-sky-500/50">
              {RECEIPT_FILTER_OPTIONS.map((option) => (<option key={option} value={option}>
                  {option}
                </option>))}
            </select>
            <div className="relative">
              <button type="button" onClick={() => setMoreFiltersOpen((open) => !open)} className="inline-flex items-center gap-1 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900/60 px-2.5 py-1.5 text-xs text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">
                <Filter size={12}/>
                More Filters
                <ChevronDown size={12} className={moreFiltersOpen ? 'rotate-180' : ''}/>
              </button>
              {moreFiltersOpen && (<div className="absolute left-0 top-full z-20 mt-1 min-w-[180px] rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-lg p-3">
                  <p className={`${LABEL} mb-2`}>Purchase Type</p>
                  <select value={purchaseTypeFilter} onChange={(e) => {
                setPurchaseTypeFilter(e.target.value as (typeof PURCHASE_TYPE_OPTIONS)[number]);
                setPage(1);
            }} className="w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900/60 px-2.5 py-1.5 text-xs text-zinc-700 dark:text-zinc-300 focus:outline-none focus:ring-1 focus:ring-sky-500/50">
                    {PURCHASE_TYPE_OPTIONS.map((option) => (<option key={option} value={option}>
                        {option}
                      </option>))}
                  </select>
                </div>)}
            </div>
          </div>

          {registryTab === 'Fuel Transactions' ? (<>
              <div className="overflow-x-auto flex-1">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-zinc-200 dark:border-zinc-800 text-zinc-500 dark:text-zinc-400">
                      {[
                'Date',
                'Vehicle',
                'Driver',
                'Location',
                'Fuel Type',
                'Gallons',
                'Price / Gal',
                'Total Amount',
                'Odometer',
                'Type',
                'Receipt',
            ].map((col) => (<th key={col} className="px-3 py-3 font-semibold whitespace-nowrap">
                          {col}
                        </th>))}
                    </tr>
                  </thead>
                  <tbody>
                    {transactions.map((txn) => {
                const fuelType = resolveFuelType(txn.fuel_type);
                const pillStyle = FUEL_TYPE_STYLES[fuelType] ?? FUEL_TYPE_STYLES.Diesel;
                return (<tr key={txn.id} className="border-b border-zinc-100 dark:border-zinc-800/60 hover:bg-zinc-50 dark:hover:bg-zinc-900/40 transition-colors">
                        <td className="px-3 py-2.5 text-zinc-600 dark:text-zinc-400 tabular-nums whitespace-nowrap">
                          {formatFuelDate(txn.transaction_date)}
                        </td>
                        <td className="px-3 py-2.5 whitespace-nowrap">
                          <button type="button" onClick={() => handleOpenTruckProfile(txn.truck_id)} disabled={txn.truck_id == null} className="inline-flex items-center gap-1 font-semibold text-sky-600 dark:text-sky-400 hover:underline disabled:cursor-default disabled:text-zinc-400 disabled:no-underline dark:disabled:text-zinc-500">
                            <Truck size={12}/>
                            {txn.vehicle ?? '—'}
                          </button>
                        </td>
                        <td className="px-3 py-2.5 text-zinc-800 dark:text-zinc-200 whitespace-nowrap">
                          {resolveTransactionDriverName(txn, trucks)}
                        </td>
                        <td className="px-3 py-2.5 text-zinc-600 dark:text-zinc-400 max-w-[140px] truncate">
                          {txn.location_state ?? txn.location ?? '—'}
                        </td>
                        <td className="px-3 py-2.5">
                          <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold ${pillStyle}`}>
                            {fuelType}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-zinc-800 dark:text-zinc-200 tabular-nums">{fmtNum(txn.gallons)}</td>
                        <td className="px-3 py-2.5 text-zinc-700 dark:text-zinc-300 tabular-nums">{fmt(txn.price_per_gallon)}</td>
                        <td className="px-3 py-2.5 font-medium text-zinc-900 dark:text-white tabular-nums">
                          {fmt(txn.total_amount)}
                        </td>
                        <td className="px-3 py-2.5 text-zinc-600 dark:text-zinc-400 tabular-nums">
                          {(txn.odometer ?? 0).toLocaleString()}
                        </td>
                        <td className="px-3 py-2.5 text-zinc-600 dark:text-zinc-400">{txn.purchase_type}</td>
                        <td className="px-3 py-2.5">
                          <button type="button" title="View receipt" onClick={() => {
                        if (txn.receipt_url)
                            window.open(txn.receipt_url, '_blank', 'noopener,noreferrer');
                    }} className="p-1.5 rounded-md text-zinc-500 hover:text-sky-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">
                            <FileText size={14}/>
                          </button>
                        </td>
                      </tr>);
            })}
                  </tbody>
                </table>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-t border-zinc-200 dark:border-zinc-800 text-xs text-zinc-500">
                <span>
                  Showing {transactionTotal === 0 ? 0 : (page - 1) * perPage + 1} to {Math.min(page * perPage, transactionTotal)} of {transactionTotal} transactions
                </span>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1">
                    <button type="button" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))} className="p-1.5 rounded-md border border-zinc-200 dark:border-zinc-700 disabled:opacity-40 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">
                      <ChevronLeft size={14}/>
                    </button>
                    {pageNumbers.map((p, index) => {
                const prev = pageNumbers[index - 1];
                const showEllipsis = prev != null && p - prev > 1;
                return (<React.Fragment key={p}>
                          {showEllipsis && <span className="px-1">…</span>}
                          <button type="button" onClick={() => setPage(p)} className={`min-w-[28px] h-7 rounded-md text-xs font-medium transition-colors ${p === page
                        ? 'bg-sky-600 text-white'
                        : 'border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800'}`}>
                            {p}
                          </button>
                        </React.Fragment>);
            })}
                    <button type="button" disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))} className="p-1.5 rounded-md border border-zinc-200 dark:border-zinc-700 disabled:opacity-40 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">
                      <ChevronRight size={14}/>
                    </button>
                  </div>
                  <select value={perPage} onChange={(e) => {
                setPerPage(Number(e.target.value));
                setPage(1);
            }} className="rounded-md border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900/60 px-2 py-1 text-xs">
                    <option value={7}>7 / page</option>
                    <option value={10}>10 / page</option>
                    <option value={25}>25 / page</option>
                  </select>
                </div>
              </div>
            </>) : (<div className="flex-1 flex flex-col px-5 py-6 gap-5">
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-zinc-900 dark:text-white">Fleet Fuel Cards</p>
                  <p className={`${MUTED} mt-1 max-w-md`}>
                    Import Comdata, EFS, or WEX CSV statements to auto-post fuel transactions and ledger expenses.
                  </p>
                </div>
                <button type="button" onClick={() => {
                setImportFormError(null);
                setImportFile(null);
                setShowImportModal(true);
            }} className="inline-flex items-center gap-1.5 rounded-lg bg-violet-600 hover:bg-violet-500 text-white px-3 py-2 text-xs font-semibold transition-colors shrink-0">
                  <UploadCloud size={14}/>
                  Import Fuel Card Statement
                </button>
              </div>
              <div className={`${CARD} p-4 grid grid-cols-1 sm:grid-cols-3 gap-3`}>
                {[
                { label: 'Comdata', hint: 'Transaction Date · Unit · State · Gallons · Amount' },
                { label: 'EFS', hint: 'Date · Card # · Truck # · Product · Total' },
                { label: 'WEX', hint: 'Purchase Date · Vehicle · Jurisdiction · Qty · Cost' },
            ].map((provider) => (<div key={provider.label} className="rounded-lg border border-zinc-200 dark:border-zinc-800 px-3 py-3">
                    <p className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">{provider.label}</p>
                    <p className={`${MUTED} mt-1 text-[10px]`}>{provider.hint}</p>
                  </div>))}
              </div>
              <p className={`${MUTED} text-[11px]`}>
                Use <span className="font-medium text-zinc-600 dark:text-zinc-300">+ Add Fuel Receipt</span> above for
                quick cash or reefer fuel overrides with a photo attachment.
              </p>
            </div>)}
        </div>

        <div className="lg:col-span-4 flex flex-col gap-4">
          <IftaSummaryCard panel={iftaPanel} onViewReport={() => setShowReportModal(true)}/>
          <RecentIftaReports reports={iftaReports} loading={iftaReportsLoading} onViewAll={() => setShowFilingsModal(true)} onGenerate={openGenerateModal} onSelect={openSavedReportDetail}/>
        </div>
      </section>
      </div>

      {showReceiptModal && (<div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/70 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#161616] shadow-2xl" role="dialog" aria-modal="true" aria-labelledby="fuel-receipt-title">
            <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-200 dark:border-zinc-800">
              <div>
                <h2 id="fuel-receipt-title" className="text-sm font-bold text-zinc-900 dark:text-white">
                  Add Fuel Receipt
                </h2>
                <p className={`${MUTED} mt-0.5`}>Quick cash or reefer override — posts expense to the ledger.</p>
              </div>
              <button type="button" onClick={() => setShowReceiptModal(false)} className="p-1.5 rounded-lg text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors" aria-label="Close">
                <X size={16}/>
              </button>
            </div>

            <div className="px-5 py-4 space-y-3 max-h-[70vh] overflow-y-auto">
              {receiptFormError && (<p className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-600 dark:text-rose-400">
                  {receiptFormError}
                </p>)}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="block text-xs">
                  <span className={LABEL}>Date</span>
                  <input type="date" value={receiptForm.date} onChange={(e) => setReceiptForm((prev) => ({ ...prev, date: e.target.value }))} className={`${MODAL_FIELD} mt-1`}/>
                </label>
                <label className="block text-xs">
                  <span className={LABEL}>State</span>
                  <select value={receiptForm.location_state} onChange={(e) => setReceiptForm((prev) => ({ ...prev, location_state: e.target.value }))} className={`${MODAL_FIELD} mt-1`}>
                    {US_STATE_CODES.map((code) => (<option key={code} value={code}>
                        {code}
                      </option>))}
                  </select>
                </label>
                <label className="block text-xs sm:col-span-2">
                  <span className={LABEL}>Vehicle</span>
                  <select value={receiptForm.vehicle_id} onChange={(e) => setReceiptForm((prev) => ({ ...prev, vehicle_id: e.target.value }))} className={`${MODAL_FIELD} mt-1`}>
                    <option value="">Unassigned</option>
                    {trucks.map((truck) => (<option key={truck.id} value={truck.id}>
                        #{truck.truck_number}
                      </option>))}
                  </select>
                </label>
                <label className="block text-xs">
                  <span className={LABEL}>Fuel Type</span>
                  <select value={receiptForm.fuel_type} onChange={(e) => setReceiptForm((prev) => ({ ...prev, fuel_type: e.target.value }))} className={`${MODAL_FIELD} mt-1`}>
                    <option value="Diesel">Diesel</option>
                    <option value="Gasoline">Gasoline</option>
                    <option value="DEF">DEF</option>
                  </select>
                </label>
                <label className="block text-xs">
                  <span className={LABEL}>Gallons</span>
                  <input type="number" min={0} step="0.001" value={receiptForm.gallons} onChange={(e) => setReceiptForm((prev) => ({ ...prev, gallons: e.target.value }))} className={`${MODAL_FIELD} mt-1`} required/>
                </label>
                <label className="block text-xs sm:col-span-2">
                  <span className={LABEL}>Total Amount</span>
                  <input type="number" min={0} step="0.01" value={receiptForm.total_amount} onChange={(e) => setReceiptForm((prev) => ({ ...prev, total_amount: e.target.value }))} className={`${MODAL_FIELD} mt-1`} required/>
                </label>
                <label className="block text-xs sm:col-span-2">
                  <span className={LABEL}>Odometer</span>
                  <input type="number" min={1} step={1} value={receiptForm.odometer} onChange={(e) => setReceiptForm((prev) => ({ ...prev, odometer: e.target.value }))} className={`${MODAL_FIELD} mt-1`} required placeholder="Current vehicle mileage"/>
                  <p className={`${MUTED} mt-1 text-[10px]`}>
                    Required for IFTA mileage verification between fuel stops.
                  </p>
                </label>
                <label className="block text-xs sm:col-span-2">
                  <span className={LABEL}>Receipt Photo</span>
                  <input type="file" accept="image/*,.pdf" onChange={(e) => setReceiptFile(e.target.files?.[0] ?? null)} className={`${MODAL_FIELD} mt-1 file:mr-3 file:rounded-md file:border-0 file:bg-zinc-100 file:px-2 file:py-1 file:text-[11px] file:font-medium dark:file:bg-zinc-800`}/>
                  {receiptFile && (<p className={`${MUTED} mt-1 truncate`}>{receiptFile.name}</p>)}
                </label>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-zinc-200 dark:border-zinc-800">
              <button type="button" onClick={() => setShowReceiptModal(false)} className="rounded-lg border border-zinc-200 dark:border-zinc-700 px-3 py-1.5 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">
                Cancel
              </button>
              <button type="button" disabled={receiptSubmitting} onClick={() => void handleSubmitReceipt()} className="inline-flex items-center gap-1.5 rounded-lg bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white px-3 py-1.5 text-xs font-semibold transition-colors">
                {receiptSubmitting ? <Loader2 size={14} className="animate-spin"/> : <Plus size={14}/>}
                Save Receipt
              </button>
            </div>
          </div>
        </div>)}

      {showMapModal && (<div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/70 backdrop-blur-sm">
          <div className="w-full max-w-2xl rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#161616] shadow-2xl max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-200 dark:border-zinc-800">
              <div>
                <h2 className="text-sm font-bold text-zinc-900 dark:text-white">IFTA Jurisdiction Map Data</h2>
                <p className={`${MUTED} mt-0.5`}>{iftaQuarterLabel} — miles &amp; fuel by state</p>
              </div>
              <button type="button" onClick={() => setShowMapModal(false)} className="p-1.5 rounded-lg text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800" aria-label="Close">
                <X size={16}/>
              </button>
            </div>
            <div className="overflow-auto flex-1 px-5 py-4">
              {stateTaxRows.length === 0 ? (<p className={`${MUTED} text-center py-8`}>No jurisdiction data for this quarter.</p>) : (<table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-zinc-200 dark:border-zinc-800 text-zinc-500">
                      {['State', 'Miles', 'Gallons', 'Tax Rate', 'Net Liability'].map((col) => (<th key={col} className="py-2 pr-3 font-semibold">{col}</th>))}
                    </tr>
                  </thead>
                  <tbody>
                    {stateTaxRows.map((row) => (<tr key={row.code} className="border-b border-zinc-100 dark:border-zinc-800/60">
                        <td className="py-2.5 pr-3 font-medium text-zinc-800 dark:text-zinc-200">{row.state} ({row.code})</td>
                        <td className="py-2.5 pr-3 tabular-nums">{row.miles.toLocaleString()}</td>
                        <td className="py-2.5 pr-3 tabular-nums">{fmtNum(row.gallons)}</td>
                        <td className="py-2.5 pr-3 tabular-nums">{fmt(row.tax_rate)}</td>
                        <td className={`py-2.5 pr-3 tabular-nums font-medium ${row.net_liability >= 0 ? 'text-rose-500' : 'text-emerald-500'}`}>
                          {fmt(row.net_liability)}
                        </td>
                      </tr>))}
                  </tbody>
                </table>)}
            </div>
          </div>
        </div>)}

      {showGenerateModal && (<div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/70 backdrop-blur-sm">
          <div className="w-full max-w-3xl rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#161616] shadow-2xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-200 dark:border-zinc-800">
              <div>
                <h2 className="text-sm font-bold text-zinc-900 dark:text-white">Generate IFTA Report</h2>
                <p className={`${MUTED} mt-0.5`}>
                  Pre-filled from live GPS mileage and fuel receipts — edit before filing.
                </p>
              </div>
              <button type="button" onClick={() => setShowGenerateModal(false)} className="p-1.5 rounded-lg text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800" aria-label="Close">
                <X size={16}/>
              </button>
            </div>
            <div className="overflow-auto flex-1 px-5 py-4 space-y-4">
              {generateFormError && (<p className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-600 dark:text-rose-400">
                  {generateFormError}
                </p>)}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <label className="block text-xs sm:col-span-3">
                  <span className={LABEL}>Report Title</span>
                  <input type="text" value={generateForm.title} onChange={(e) => setGenerateForm((prev) => ({ ...prev, title: e.target.value }))} className={`${MODAL_FIELD} mt-1`}/>
                </label>
                <label className="block text-xs">
                  <span className={LABEL}>Year</span>
                  <select value={generateForm.year} onChange={(e) => setGenerateForm((prev) => ({
                ...prev,
                year: Number(e.target.value),
                title: `IFTA Q${prev.quarter} ${e.target.value}`,
            }))} className={`${MODAL_FIELD} mt-1`}>
                    {Array.from({ length: 6 }, (_, index) => new Date().getFullYear() - index).map((year) => (<option key={year} value={year}>
                        {year}
                      </option>))}
                  </select>
                </label>
                <label className="block text-xs sm:col-span-2">
                  <span className={LABEL}>Quarter</span>
                  <select value={generateForm.quarter} onChange={(e) => setGenerateForm((prev) => ({
                ...prev,
                quarter: Number(e.target.value),
                title: `IFTA Q${e.target.value} ${prev.year}`,
            }))} className={`${MODAL_FIELD} mt-1`}>
                    {[1, 2, 3, 4].map((quarter) => (<option key={quarter} value={quarter}>
                        Q{quarter}
                      </option>))}
                  </select>
                </label>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className={LABEL}>Jurisdiction Entries</p>
                  <button type="button" onClick={() => setJurisdictionRows((rows) => [...rows, emptyJurisdictionRow()])} className="inline-flex items-center gap-1 text-[10px] font-semibold text-sky-500 dark:text-sky-400 hover:underline">
                    <Plus size={12}/>
                    Add State Row
                  </button>
                </div>
                <div className="space-y-2">
                  <div className="hidden sm:grid grid-cols-[1fr_1fr_1fr_auto] gap-2 px-1">
                    <span className={LABEL}>State</span>
                    <span className={LABEL}>Total Miles</span>
                    <span className={LABEL}>Gallons Purchased</span>
                    <span className="sr-only">Remove</span>
                  </div>
                  {jurisdictionRows.map((row) => (<div key={row.id} className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_1fr_auto] gap-2 items-center">
                      <select value={row.state} onChange={(e) => setJurisdictionRows((rows) => rows.map((item) => (item.id === row.id ? { ...item, state: e.target.value } : item)))} className={MODAL_FIELD}>
                        {US_STATE_CODES.map((code) => (<option key={code} value={code}>
                            {code}
                          </option>))}
                      </select>
                      <input type="number" min="0" step="0.1" placeholder="Miles" value={row.miles} onChange={(e) => setJurisdictionRows((rows) => rows.map((item) => (item.id === row.id ? { ...item, miles: e.target.value } : item)))} className={MODAL_FIELD}/>
                      <input type="number" min="0" step="0.01" placeholder="Gallons" value={row.gallons_purchased} onChange={(e) => setJurisdictionRows((rows) => rows.map((item) => item.id === row.id ? { ...item, gallons_purchased: e.target.value } : item))} className={MODAL_FIELD}/>
                      <button type="button" disabled={jurisdictionRows.length <= 1} onClick={() => setJurisdictionRows((rows) => rows.filter((item) => item.id !== row.id))} className="p-2 rounded-lg border border-zinc-200 dark:border-zinc-700 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-40" aria-label="Remove state row">
                        <Trash2 size={14}/>
                      </button>
                    </div>))}
                </div>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-zinc-200 dark:border-zinc-800">
              <button type="button" onClick={() => setShowGenerateModal(false)} className="rounded-lg border border-zinc-200 dark:border-zinc-700 px-3 py-2 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800">
                Cancel
              </button>
              <button type="button" disabled={generateSubmitting} onClick={() => void handleGenerateReport()} className="inline-flex items-center gap-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white px-3 py-2 text-xs font-semibold">
                {generateSubmitting ? <Loader2 size={14} className="animate-spin"/> : <FileText size={14}/>}
                {generateSubmitting ? 'Saving…' : 'Generate Report'}
              </button>
            </div>
          </div>
        </div>)}

      {showReportDetailModal && selectedSavedReport && (<div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/70 backdrop-blur-sm">
          <div className="w-full max-w-3xl rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#161616] shadow-2xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-200 dark:border-zinc-800">
              <div>
                <h2 className="text-sm font-bold text-zinc-900 dark:text-white">{selectedSavedReport.title}</h2>
                <p className={`${MUTED} mt-0.5`}>
                  Q{selectedSavedReport.quarter} {selectedSavedReport.year} ·{' '}
                  {formatFuelDate(selectedSavedReport.start_date)} – {formatFuelDate(selectedSavedReport.end_date)}
                </p>
              </div>
              <button type="button" onClick={() => setShowReportDetailModal(false)} className="p-1.5 rounded-lg text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800" aria-label="Close">
                <X size={16}/>
              </button>
            </div>
            <div className="overflow-auto flex-1 px-5 py-4 space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                { label: 'Total Miles', value: `${selectedSavedReport.total_miles.toLocaleString()} mi` },
                { label: 'Total Gallons', value: fmtNum(selectedSavedReport.total_gallons) },
                { label: 'Tax Due', value: fmt(selectedSavedReport.tax_due) },
                { label: 'Status', value: selectedSavedReport.status },
            ].map((item) => (<div key={item.label} className={`${CARD} p-3`}>
                    <p className={LABEL}>{item.label}</p>
                    <p className="text-sm font-bold text-zinc-900 dark:text-white mt-1 tabular-nums">{item.value}</p>
                  </div>))}
              </div>
              <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
                <table className="min-w-full text-xs">
                  <thead className="bg-zinc-50 dark:bg-zinc-900/60 text-zinc-500">
                    <tr>
                      <th className="px-3 py-2 text-left font-semibold">State</th>
                      <th className="px-3 py-2 text-right font-semibold">Miles</th>
                      <th className="px-3 py-2 text-right font-semibold">Gallons</th>
                      <th className="px-3 py-2 text-right font-semibold">Tax Paid</th>
                      <th className="px-3 py-2 text-right font-semibold">Net Tax Due</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedSavedReport.jurisdiction_breakdown.map((row) => (<tr key={row.state} className="border-t border-zinc-200 dark:border-zinc-800">
                        <td className="px-3 py-2 font-medium text-zinc-800 dark:text-zinc-200">{row.state}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{fmtNum(row.miles, 1)}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{fmtNum(row.gallons_purchased)}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{fmt(row.tax_paid)}</td>
                        <td className={`px-3 py-2 text-right tabular-nums font-medium ${row.net_tax_due >= 0 ? 'text-rose-500' : 'text-emerald-500'}`}>
                          {fmt(row.net_tax_due)}
                        </td>
                      </tr>))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>)}

      {showReportModal && (<div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/70 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#161616] shadow-2xl max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-200 dark:border-zinc-800">
              <div>
                <h2 className="text-sm font-bold text-zinc-900 dark:text-white">IFTA Summary Report</h2>
                <p className={`${MUTED} mt-0.5`}>{iftaQuarterLabel} · Fleet MPG {fmtNum(summary?.fleet_avg_mpg ?? 0, 2)}</p>
              </div>
              <button type="button" onClick={() => setShowReportModal(false)} className="p-1.5 rounded-lg text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800" aria-label="Close">
                <X size={16}/>
              </button>
            </div>
            <div className="overflow-auto flex-1 px-5 py-4 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                {[
                { label: 'Total Miles', value: `${iftaPanel.total_miles.toLocaleString()} mi` },
                { label: 'Taxable Miles', value: `${iftaPanel.taxable_miles.toLocaleString()} mi` },
                { label: 'Est. Tax Due', value: fmt(iftaPanel.est_tax_due) },
                { label: 'Credits', value: fmt(iftaPanel.credits) },
                { label: 'Balance Due', value: fmt(iftaPanel.balance_due) },
                { label: 'Jurisdictions', value: String(iftaPanel.jurisdictions_traveled) },
            ].map((item) => (<div key={item.label} className={`${CARD} p-3`}>
                    <p className={LABEL}>{item.label}</p>
                    <p className="text-sm font-bold text-zinc-900 dark:text-white mt-1 tabular-nums">{item.value}</p>
                  </div>))}
              </div>
              {stateTaxRows.length > 0 && (<div>
                  <p className={`${LABEL} mb-2`}>State Tax Detail</p>
                  <ul className="space-y-2">
                    {stateTaxRows.map((row) => (<li key={row.code} className="flex items-center justify-between text-xs rounded-lg border border-zinc-200 dark:border-zinc-800 px-3 py-2">
                        <span className="text-zinc-600 dark:text-zinc-400">{row.state}</span>
                        <span className={`font-medium tabular-nums ${row.net_liability >= 0 ? 'text-rose-500' : 'text-emerald-500'}`}>
                          {fmt(row.net_liability)}
                        </span>
                      </li>))}
                  </ul>
                </div>)}
            </div>
          </div>
        </div>)}

      {showFilingsModal && (<div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/70 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#161616] shadow-2xl max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-200 dark:border-zinc-800">
              <h2 className="text-sm font-bold text-zinc-900 dark:text-white">IFTA Report History</h2>
              <button type="button" onClick={() => setShowFilingsModal(false)} className="p-1.5 rounded-lg text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800" aria-label="Close">
                <X size={16}/>
              </button>
            </div>
            <div className="overflow-auto flex-1 px-5 py-4">
              {iftaReports.length === 0 ? (<p className={`${MUTED} text-center py-8`}>No saved IFTA reports yet.</p>) : (<ul className="space-y-2.5">
                  {iftaReports.map((r) => (<li key={r.id}>
                      <button type="button" onClick={() => {
                        setShowFilingsModal(false);
                        openSavedReportDetail(r);
                    }} className="w-full flex items-center justify-between gap-2 rounded-lg border border-zinc-200/80 dark:border-zinc-800/80 px-3 py-2.5 text-left hover:border-sky-500/40 transition-colors">
                        <div>
                          <p className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">{r.title}</p>
                          <p className="text-[10px] text-zinc-500">
                            Q{r.quarter} {r.year} · {formatReportTimestamp(r.created_at)}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs font-medium tabular-nums">{fmt(r.tax_due)}</p>
                          <span className={`inline-block rounded-full border px-2 py-0.5 text-[9px] font-semibold ${IFTA_STATUS_STYLES[r.status] ?? IFTA_STATUS_STYLES.Draft}`}>
                            {r.status}
                          </span>
                        </div>
                      </button>
                    </li>))}
                </ul>)}
            </div>
          </div>
        </div>)}

      {showImportModal && (<div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/70 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#161616] shadow-2xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-200 dark:border-zinc-800">
              <div>
                <h2 className="text-sm font-bold text-zinc-900 dark:text-white">Import Fuel Card Statement</h2>
                <p className={`${MUTED} mt-0.5`}>Upload a Comdata, EFS, or WEX CSV export.</p>
              </div>
              <button type="button" onClick={() => setShowImportModal(false)} className="p-1.5 rounded-lg text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800" aria-label="Close">
                <X size={16}/>
              </button>
            </div>
            <div className="px-5 py-4 space-y-3">
              {importFormError && (<p className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-600 dark:text-rose-400">
                  {importFormError}
                </p>)}
              <label className="block text-xs">
                <span className={LABEL}>CSV Statement</span>
                <input type="file" accept=".csv,text/csv" onChange={(e) => setImportFile(e.target.files?.[0] ?? null)} className={`${MODAL_FIELD} mt-1 file:mr-3 file:rounded-md file:border-0 file:bg-zinc-100 file:px-2 file:py-1 file:text-[11px] file:font-medium dark:file:bg-zinc-800`}/>
                {importFile && <p className={`${MUTED} mt-1 truncate`}>{importFile.name}</p>}
              </label>
              <p className={`${MUTED} text-[10px]`}>
                Required columns: transaction date, gallons, total amount. Optional: card #, truck/unit, driver,
                state, product type.
              </p>
            </div>
            <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-zinc-200 dark:border-zinc-800">
              <button type="button" onClick={() => setShowImportModal(false)} className="rounded-lg border border-zinc-200 dark:border-zinc-700 px-3 py-1.5 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800">
                Cancel
              </button>
              <button type="button" disabled={importSubmitting || !importFile} onClick={() => void handleImportCardData()} className="inline-flex items-center gap-1.5 rounded-lg bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white px-3 py-1.5 text-xs font-semibold transition-colors">
                {importSubmitting ? <Loader2 size={14} className="animate-spin"/> : <UploadCloud size={14}/>}
                Import CSV
              </button>
            </div>
          </div>
        </div>)}

      <TruckDetailModal token={authToken} truck={selectedTruckProfile} drivers={drivers} trucks={trucks} onClose={() => setSelectedTruckProfileId(null)} onSuccess={handleTruckProfileSuccess}/>
    </div>);
}
