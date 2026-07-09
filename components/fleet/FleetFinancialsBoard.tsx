'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Calendar, ChevronDown, DollarSign, Droplet, Gauge, Truck } from 'lucide-react';
import type { TruckPerformanceMetrics, TruckRecord } from '@/lib/tms-api';
import { FLEET_WINDOW_PRESETS, detectFleetWindowPreset, getPresetRange, type FleetWindowPreset, } from '@/lib/fleet-financial-metrics';
interface FleetFinancialsBoardProps {
    trucks: TruckRecord[];
    windowStart: string;
    windowEnd: string;
    setWindowStart: (value: string) => void;
    setWindowEnd: (value: string) => void;
}
const PRESET_OPTIONS = FLEET_WINDOW_PRESETS;
function presetButtonClass(isActive: boolean): string {
    return isActive
        ? 'bg-blue-600 text-white font-semibold shadow-sm'
        : 'bg-zinc-100 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-800';
}
interface UnitFinancialRow {
    truck: TruckRecord;
    unitNumber: string;
    grossRevenue: number;
    totalMiles: number;
    avgMpg: number;
    fuelSpent: number;
    maintenanceFees: number;
}
const METRIC_FIELD_ALIASES = {
    grossRevenue: ['gross_revenue', 'Gross Revenue', 'grossRevenue', 'revenue'],
    totalMiles: ['total_miles', 'Total Miles', 'totalMiles', 'telemetry_miles', 'miles'],
    avgMpg: ['avg_mpg', 'Avg MPG', 'avgMpg', 'mpg', 'average_mpg'],
    fuelSpent: ['fuel_spent', 'Fuel Spent', 'fuelSpent', 'fuel_cost', 'total_fuel'],
    maintenanceFees: [
        'maintenance_costs',
        'maintenance_cost',
        'Maintenance Costs',
        'maintenanceFees',
        'work_orders',
        'work_order_total',
        'repair_costs',
    ],
} as const;
function formatWindowLabel(start: string, end: string): string {
    if (!start && !end)
        return 'All time';
    if (start && end)
        return `${start} → ${end}`;
    return start || end;
}
function formatCurrency(value: number): string {
    return value.toLocaleString(undefined, {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });
}
function formatRpm(revenue: number, miles: number): string {
    if (miles <= 0)
        return '$0.00/mi';
    return `${formatCurrency(revenue / miles)}/mi`;
}
function parseNumeric(value: unknown): number | null {
    if (typeof value === 'number' && Number.isFinite(value))
        return value;
    if (typeof value === 'string') {
        const parsed = Number.parseFloat(value.replace(/[$,\s]/g, ''));
        if (Number.isFinite(parsed))
            return parsed;
    }
    return null;
}
function readMetricValue(metrics: TruckPerformanceMetrics | undefined, customFields: Record<string, string> | undefined, aliases: readonly string[]): number {
    for (const key of aliases) {
        const fromMetrics = metrics?.[key as keyof TruckPerformanceMetrics];
        const parsedMetric = parseNumeric(fromMetrics);
        if (parsedMetric != null)
            return parsedMetric;
        const fromCustom = customFields?.[key];
        const parsedCustom = parseNumeric(fromCustom);
        if (parsedCustom != null)
            return parsedCustom;
    }
    return 0;
}
function extractUnitFinancials(truck: TruckRecord): Omit<UnitFinancialRow, 'truck' | 'unitNumber'> {
    const metrics = truck.performance_metrics;
    const customFields = truck.custom_fields;
    return {
        grossRevenue: readMetricValue(metrics, customFields, METRIC_FIELD_ALIASES.grossRevenue),
        totalMiles: readMetricValue(metrics, customFields, METRIC_FIELD_ALIASES.totalMiles),
        avgMpg: readMetricValue(metrics, customFields, METRIC_FIELD_ALIASES.avgMpg),
        fuelSpent: readMetricValue(metrics, customFields, METRIC_FIELD_ALIASES.fuelSpent),
        maintenanceFees: readMetricValue(metrics, customFields, METRIC_FIELD_ALIASES.maintenanceFees),
    };
}
export default function FleetFinancialsBoard({ trucks, windowStart, windowEnd, setWindowStart, setWindowEnd, }: FleetFinancialsBoardProps) {
    const [activePreset, setActivePreset] = useState<FleetWindowPreset>(() => detectFleetWindowPreset(windowStart, windowEnd));
    const [showFinancialsDateDropdown, setShowFinancialsDateDropdown] = useState(false);
    const financialsDateFilterMenuRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
        setActivePreset(detectFleetWindowPreset(windowStart, windowEnd));
    }, [windowStart, windowEnd]);
    useEffect(() => {
        if (!showFinancialsDateDropdown)
            return;
        const handlePointerDown = (event: MouseEvent) => {
            if (financialsDateFilterMenuRef.current?.contains(event.target as Node))
                return;
            setShowFinancialsDateDropdown(false);
        };
        document.addEventListener('mousedown', handlePointerDown);
        return () => document.removeEventListener('mousedown', handlePointerDown);
    }, [showFinancialsDateDropdown]);
    const handleWindowStartChange = (value: string) => {
        setActivePreset('custom');
        setWindowStart(value);
    };
    const handleWindowEndChange = (value: string) => {
        setActivePreset('custom');
        setWindowEnd(value);
    };
    const openDatePicker = (event: React.MouseEvent<HTMLInputElement>) => {
        event.stopPropagation();
        const input = event.currentTarget;
        if (typeof input.showPicker === 'function') {
            try {
                input.showPicker();
            }
            catch {
            }
        }
    };
    const applyPreset = (preset: FleetWindowPreset) => {
        setActivePreset(preset);
        if (preset === 'custom')
            return;
        if (preset === 'all') {
            setWindowStart('');
            setWindowEnd('');
            return;
        }
        const range = getPresetRange(preset);
        setWindowStart(range.start);
        setWindowEnd(range.end);
    };
    const powerUnits = useMemo(() => trucks.filter((t) => t.asset_type !== 'standalone_trailer'), [trucks]);
    const ledgerRows = useMemo<UnitFinancialRow[]>(() => powerUnits.map((truck) => {
        const financials = extractUnitFinancials(truck);
        return {
            truck,
            unitNumber: truck.truck_number ? `#${truck.truck_number}` : `#${truck.id}`,
            ...financials,
        };
    }), [powerUnits]);
    const fleetTotals = useMemo(() => {
        return ledgerRows.reduce((acc, row) => {
            acc.grossRevenue += row.grossRevenue;
            acc.totalMiles += row.totalMiles;
            acc.fuelSpent += row.fuelSpent;
            acc.maintenanceFees += row.maintenanceFees;
            return acc;
        }, { grossRevenue: 0, totalMiles: 0, fuelSpent: 0, maintenanceFees: 0 });
    }, [ledgerRows]);
    const fleetRpm = formatRpm(fleetTotals.grossRevenue, fleetTotals.totalMiles);
    const fuelAndMaintenance = fleetTotals.fuelSpent + fleetTotals.maintenanceFees;
    return (<section id="fleet-financials-board" className="bg-white dark:bg-[#161616] rounded-2xl shadow-sm border border-zinc-200 dark:border-zinc-800 overflow-hidden transition-colors">
      <div className="p-5 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/80 transition-colors">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h2 className="font-bold text-base text-zinc-900 dark:text-white">Fleet Financials &amp; Telemetry</h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
              Performance window: {formatWindowLabel(windowStart, windowEnd)} · {powerUnits.length} power unit
              {powerUnits.length === 1 ? '' : 's'} tracked
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:items-end">
            <div className="flex flex-wrap gap-2">
              {PRESET_OPTIONS.map((preset) => (<button key={preset.id} type="button" onClick={() => applyPreset(preset.id)} className={`text-xs px-3 py-1.5 rounded-lg transition-colors ${presetButtonClass(activePreset === preset.id)}`}>
                  {preset.label}
                </button>))}
            </div>

            {activePreset === 'custom' ? (<div className="relative shrink-0" ref={financialsDateFilterMenuRef}>
                <button type="button" onClick={() => setShowFinancialsDateDropdown((open) => !open)} aria-expanded={showFinancialsDateDropdown} aria-haspopup="dialog" className="bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-2 text-sm font-medium hover:bg-zinc-100 dark:hover:bg-zinc-800/80 transition-all flex items-center gap-2 text-zinc-700 dark:text-zinc-200 shadow-sm">
                  <Calendar className="w-4 h-4 text-zinc-400" aria-hidden/>
                  <span>Date Filter</span>
                  <ChevronDown className={`w-4 h-4 text-zinc-400 transition-transform duration-200 ${showFinancialsDateDropdown ? 'rotate-180' : ''}`} aria-hidden/>
                </button>

                {showFinancialsDateDropdown && (<div className="absolute right-0 mt-2 z-50" onMouseDown={(e) => e.stopPropagation()}>
                    <div className="flex items-center gap-2 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-2.5 shadow-xl select-none">
                      <Calendar className="w-4 h-4 text-zinc-400 shrink-0 ml-1.5" aria-hidden/>
                      <input type="date" value={windowStart || ''} onChange={(e) => handleWindowStartChange(e.target.value)} onClick={openDatePicker} className="bg-transparent text-sm font-medium text-zinc-900 dark:text-zinc-100 outline-none cursor-pointer [color-scheme:dark] [&::-webkit-calendar-picker-indicator]:hidden w-[105px] text-center" aria-label="Fleet financials window start date"/>
                      <span className="text-zinc-400 dark:text-zinc-500 text-[10px] font-bold tracking-widest uppercase px-2 shrink-0">
                        to
                      </span>
                      <input type="date" value={windowEnd || ''} onChange={(e) => handleWindowEndChange(e.target.value)} onClick={openDatePicker} className="bg-transparent text-sm font-medium text-zinc-900 dark:text-zinc-100 outline-none cursor-pointer [color-scheme:dark] [&::-webkit-calendar-picker-indicator]:hidden w-[105px] text-center mr-1.5" aria-label="Fleet financials window end date"/>
                    </div>
                  </div>)}
              </div>) : null}
          </div>
        </div>
      </div>

      <div className="p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <article className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/40 p-4">
          <div className="flex items-center gap-2 text-zinc-500 dark:text-zinc-400 mb-2">
            <DollarSign size={16} aria-hidden/>
            <span className="text-xs font-bold uppercase tracking-wider">Revenue (Window)</span>
          </div>
          <p className="text-2xl font-bold text-zinc-900 dark:text-white">
            {formatCurrency(fleetTotals.grossRevenue)}
          </p>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">Linehaul &amp; accessorial rollup</p>
        </article>
        <article className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/40 p-4">
          <div className="flex items-center gap-2 text-zinc-500 dark:text-zinc-400 mb-2">
            <Gauge size={16} aria-hidden/>
            <span className="text-xs font-bold uppercase tracking-wider">Fleet RPM</span>
          </div>
          <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{fleetRpm}</p>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
            {fleetTotals.totalMiles.toLocaleString()} combined miles
          </p>
        </article>
        <article className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/40 p-4">
          <div className="flex items-center gap-2 text-zinc-500 dark:text-zinc-400 mb-2">
            <Droplet size={16} aria-hidden/>
            <span className="text-xs font-bold uppercase tracking-wider">Fuel &amp; Maintenance</span>
          </div>
          <p className="text-2xl font-bold text-zinc-900 dark:text-white">{formatCurrency(fuelAndMaintenance)}</p>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
            Fuel {formatCurrency(fleetTotals.fuelSpent)} · Maint {formatCurrency(fleetTotals.maintenanceFees)}
          </p>
        </article>
        <article className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/40 p-4">
          <div className="flex items-center gap-2 text-zinc-500 dark:text-zinc-400 mb-2">
            <Truck size={16} aria-hidden/>
            <span className="text-xs font-bold uppercase tracking-wider">Active Assets</span>
          </div>
          <p className="text-2xl font-bold text-zinc-900 dark:text-white">{powerUnits.length}</p>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">Units in financial scope</p>
        </article>
      </div>

      <div className="px-5 pb-5">
        <div className="bg-white dark:bg-[#161616] border border-zinc-200 dark:border-zinc-800 rounded-xl mt-6 overflow-hidden">
          {ledgerRows.length === 0 ? (<div className="p-8 text-center text-sm text-zinc-500 dark:text-zinc-400">
              No power units available for financial tracking.
            </div>) : (<div className="overflow-x-auto">
              <table className="w-full text-left min-w-[900px]">
                <thead className="bg-zinc-50 dark:bg-zinc-900/50 text-zinc-500 dark:text-zinc-400 text-xs font-bold uppercase tracking-wider border-b border-zinc-200 dark:border-zinc-800">
                  <tr>
                    <th className="p-4">Unit #</th>
                    <th className="p-4">Gross Revenue</th>
                    <th className="p-4">Total Miles</th>
                    <th className="p-4">Avg MPG</th>
                    <th className="p-4">Fuel Spent</th>
                    <th className="p-4">Maintenance Fees</th>
                  </tr>
                </thead>
                <tbody>
                  {ledgerRows.map((row) => (<tr key={row.truck.id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-900/60 text-zinc-900 dark:text-zinc-200 border-b border-zinc-100 dark:border-zinc-800/60 transition-colors">
                      <td className="p-4 font-bold text-zinc-900 dark:text-white">{row.unitNumber}</td>
                      <td className="p-4 text-emerald-600 dark:text-emerald-400 font-semibold">
                        {formatCurrency(row.grossRevenue)}
                      </td>
                      <td className="p-4">{row.totalMiles.toLocaleString()} mi</td>
                      <td className="p-4">{row.avgMpg > 0 ? row.avgMpg.toFixed(2) : '—'}</td>
                      <td className="p-4">{formatCurrency(row.fuelSpent)}</td>
                      <td className="p-4">{formatCurrency(row.maintenanceFees)}</td>
                    </tr>))}
                </tbody>
              </table>
            </div>)}
        </div>
      </div>
    </section>);
}
