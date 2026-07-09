'use client';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { ChevronDown, MapPin } from 'lucide-react';
import { editTypeToManifestRole, type EditRouteStop, } from '@/lib/load-edit-stops';
import { formatManifestRoleLabel, getManifestRoleLabelClass, getManifestRoleNodeClass, resolveManifestStops, type ManifestStopRole, } from '@/lib/load-manifest-stops';
import { SECTION_LABEL_CLASS } from '@/lib/display-labels';
import type { LoadRecord } from '@/lib/tms-api';
export const LOAD_INFO_MASTER_SHEET_CLASS = 'grid grid-cols-1 xl:grid-cols-12 gap-0 items-start w-full bg-white dark:bg-[#161616] border border-zinc-200 dark:border-zinc-800 rounded-xl divide-y xl:divide-y-0 xl:divide-x divide-zinc-200 dark:divide-zinc-800 overflow-hidden';
export const LOAD_INFO_COLUMN_CLASS = 'flex flex-col divide-y divide-zinc-200 dark:divide-zinc-800 p-5 xl:p-6 min-w-0';
export const LOAD_INFO_SECTION_SLOT_CLASS = 'w-full py-6 first:pt-0 last:pb-0';
const sectionSlotClass = LOAD_INFO_SECTION_SLOT_CLASS;
const fieldClass = 'w-full min-h-9 border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-[#121214] text-zinc-900 dark:text-white px-3 py-2 rounded-lg text-sm outline-none focus:border-zinc-600 dark:focus:border-zinc-600 transition-colors';
const labelClass = 'text-[10px] font-bold tracking-wide text-zinc-500 dark:text-zinc-400 mb-1';
const metricRowLabelClass = 'text-xs font-semibold text-zinc-500 dark:text-zinc-400';
const currencyInputClass = 'w-full min-h-9 border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-[#121214] text-zinc-900 dark:text-white pl-7 pr-3 py-2 rounded-lg text-sm font-semibold outline-none focus:border-zinc-600 dark:focus:border-zinc-600 transition-colors text-right';
const milesInputClass = 'w-full min-h-9 border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-[#121214] text-zinc-900 dark:text-white pl-3 pr-9 py-2 rounded-lg text-sm font-semibold outline-none focus:border-zinc-600 dark:focus:border-zinc-600 transition-colors text-right';
const formatCurrency = (value: number) => value.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
type CommodityEntry = NonNullable<LoadRecord['commodities']>[number];
export function resolveCommoditySummary(commodities?: LoadRecord['commodities']): string {
    if (!Array.isArray(commodities) || commodities.length === 0)
        return '';
    const first = commodities[0];
    const type = first.type?.trim();
    const description = first.description?.trim();
    const note = first.note?.trim();
    if (type && description && type !== description) {
        return `${type} · ${description}`;
    }
    return type || description || note || '';
}
export function resolveCommodityDraftFromLoad(load: LoadRecord): string {
    return resolveCommoditySummary(load.commodities);
}
export function resolveCommodityWeight(commodities?: LoadRecord['commodities']): number {
    if (!Array.isArray(commodities) || commodities.length === 0)
        return 0;
    const weight = commodities[0]?.weight;
    return typeof weight === 'number' && Number.isFinite(weight) ? weight : 0;
}
export function buildCommoditiesPayload(summary: string, weight: number): CommodityEntry[] {
    const trimmed = summary.trim();
    if (!trimmed && weight <= 0)
        return [];
    return [
        {
            description: trimmed,
            type: trimmed,
            quantity: 0,
            weight: weight > 0 ? weight : 0,
            dimensions: '',
            note: trimmed,
        },
    ];
}
const REEFER_MODE_OPTIONS = ['Continuous', 'Cycle Sentry', 'N/A (Dry Van)'] as const;
export type ReeferModeOption = (typeof REEFER_MODE_OPTIONS)[number];
export function resolveReeferTemperature(load: LoadRecord): string {
    const requirements = (load.requirements ?? {}) as Record<string, unknown>;
    return String(requirements.reefer_temperature ?? '').trim();
}
export function resolveReeferMode(load: LoadRecord): string {
    const requirements = (load.requirements ?? {}) as Record<string, unknown>;
    const mode = String(requirements.reefer_mode ?? '').trim();
    if (mode === 'Start/Stop (On/Off)')
        return 'Cycle Sentry';
    if (REEFER_MODE_OPTIONS.includes(mode as ReeferModeOption))
        return mode;
    return mode || 'N/A (Dry Van)';
}
export function parseTemperatureFahrenheit(raw: string): string {
    const match = raw.match(/-?\d+(?:\.\d+)?/);
    return match ? match[0] : '';
}
export function formatTemperatureDisplay(raw: string): string {
    const value = parseTemperatureFahrenheit(raw);
    if (!value)
        return '—';
    return `${value}°F`;
}
export function buildReeferTemperaturePayload(raw: string): string | null {
    const value = parseTemperatureFahrenheit(raw);
    if (!value)
        return null;
    return `${value}°F`;
}
function formatTotalMiles(miles: number): string {
    if (!Number.isFinite(miles) || miles <= 0)
        return '—';
    return `${Math.round(miles).toLocaleString('en-US')} mi`;
}
function formatWeight(lbs: number): string {
    if (!Number.isFinite(lbs) || lbs <= 0)
        return '—';
    return `${Math.round(lbs).toLocaleString('en-US')} lbs`;
}
function resolveStopCityLabel(address: string, facilityName?: string): string {
    const source = address.trim() || facilityName?.trim() || '';
    if (!source)
        return '—';
    const segments = source.split(',').map((part) => part.trim()).filter(Boolean);
    if (segments.length >= 2) {
        return segments.slice(-2).join(', ');
    }
    return source;
}
interface RouteStopTimelineNodeProps {
    role: ManifestStopRole;
    facilityName: string;
    cityState: string;
    isExpanded: boolean;
    onToggle: () => void;
    children: ReactNode;
}
function RouteStopTimelineNode({ role, facilityName, cityState, isExpanded, onToggle, children, }: RouteStopTimelineNodeProps) {
    const displayFacility = facilityName.trim() || '—';
    return (<div className="flex gap-4 items-start">
      <div className="relative z-10 flex w-5 shrink-0 justify-center pt-0.5">
        <span className={`flex h-5 w-5 items-center justify-center rounded-full ring-2 ring-white dark:ring-[#161616] ${getManifestRoleNodeClass(role)}`} aria-hidden/>
      </div>
      <div className="min-w-0 flex-1">
        <button type="button" onClick={onToggle} aria-expanded={isExpanded} className="flex w-full min-w-0 items-center gap-2 text-left">
          <span className={`shrink-0 text-[10px] font-bold tracking-widest ${getManifestRoleLabelClass(role)}`}>
            {formatManifestRoleLabel(role)}
          </span>
          <span className="min-w-0 truncate text-sm font-semibold text-zinc-800 dark:text-zinc-200">
            {displayFacility}
          </span>
          {!isExpanded ? (<span className="min-w-0 truncate text-sm text-zinc-500 dark:text-zinc-400">
              {cityState}
            </span>) : null}
          <ChevronDown size={14} className={`ml-auto shrink-0 text-zinc-500 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} aria-hidden/>
        </button>
        {isExpanded ? <div className="mt-2 space-y-2">{children}</div> : null}
      </div>
    </div>);
}
interface CurrencyFieldProps {
    value: number;
    onChange: (value: number) => void;
}
function CurrencyField({ value, onChange }: CurrencyFieldProps) {
    return (<div className="relative w-32">
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-zinc-500 dark:text-zinc-400">
        $
      </span>
      <input type="number" step="0.01" min="0" value={Number.isFinite(value) ? value : ''} onChange={(event) => onChange(parseFloat(event.target.value) || 0)} className={currencyInputClass}/>
    </div>);
}
interface MilesFieldProps {
    value: number;
    onChange: (value: number) => void;
}
function MilesField({ value, onChange }: MilesFieldProps) {
    return (<div className="relative w-32">
      <input type="number" step="1" min="0" value={Number.isFinite(value) && value > 0 ? value : ''} onChange={(event) => onChange(parseFloat(event.target.value) || 0)} className={milesInputClass}/>
      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-zinc-500 dark:text-zinc-400">
        mi
      </span>
    </div>);
}
interface WeightFieldProps {
    value: number;
    onChange: (value: number) => void;
}
function WeightField({ value, onChange }: WeightFieldProps) {
    return (<div className="relative w-32">
      <input type="number" step="1" min="0" value={Number.isFinite(value) && value > 0 ? value : ''} onChange={(event) => onChange(parseFloat(event.target.value) || 0)} className={milesInputClass}/>
      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-zinc-500 dark:text-zinc-400">
        lbs
      </span>
    </div>);
}
interface TemperatureFieldProps {
    value: string;
    onChange: (value: string) => void;
}
function TemperatureField({ value, onChange }: TemperatureFieldProps) {
    return (<div className="relative w-32">
      <input type="number" step="0.1" value={value} onChange={(event) => onChange(event.target.value)} className={milesInputClass}/>
      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-zinc-500 dark:text-zinc-400">
        °F
      </span>
    </div>);
}
interface LoadInfoBrokerSectionProps {
    isEditingWorkspace: boolean;
    brokerName: string;
    billingEmail: string;
    brokerAddress: string;
    brokerPhone: string;
    brokerLoadId: string;
    pickupNumber: string;
    onBrokerNameChange: (value: string) => void;
    onBillingEmailChange: (value: string) => void;
    onBrokerAddressChange: (value: string) => void;
    onBrokerPhoneChange: (value: string) => void;
    onBrokerLoadIdChange: (value: string) => void;
    onPickupNumberChange: (value: string) => void;
}
export function LoadInfoBrokerSection({ isEditingWorkspace, brokerName, billingEmail, brokerAddress, brokerPhone, brokerLoadId, pickupNumber, onBrokerNameChange, onBillingEmailChange, onBrokerAddressChange, onBrokerPhoneChange, onBrokerLoadIdChange, onPickupNumberChange, }: LoadInfoBrokerSectionProps) {
    const display = (value: string) => value.trim() || '—';
    return (<div className={sectionSlotClass}>
      <p className={`${SECTION_LABEL_CLASS} mb-3`}>Customer</p>
      {isEditingWorkspace ? (<div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="sm:col-span-2">
            <label className={labelClass}>Customer Name</label>
            <input type="text" value={brokerName} onChange={(event) => onBrokerNameChange(event.target.value)} className={fieldClass}/>
          </div>
          <div>
            <label className={labelClass}>Billing Email</label>
            <input type="text" value={billingEmail} onChange={(event) => onBillingEmailChange(event.target.value)} className={fieldClass}/>
          </div>
          <div>
            <label className={labelClass}>Customer Phone</label>
            <input type="text" value={brokerPhone} onChange={(event) => onBrokerPhoneChange(event.target.value)} className={fieldClass}/>
          </div>
          <div className="sm:col-span-2">
            <label className={labelClass}>Customer Address</label>
            <input type="text" value={brokerAddress} onChange={(event) => onBrokerAddressChange(event.target.value)} className={fieldClass}/>
          </div>
          <div>
            <label className={labelClass}>Load ID</label>
            <input type="text" value={brokerLoadId} onChange={(event) => onBrokerLoadIdChange(event.target.value)} className={fieldClass}/>
          </div>
          <div>
            <label className={labelClass}>Pickup Number (PU#)</label>
            <input type="text" value={pickupNumber} onChange={(event) => onPickupNumberChange(event.target.value)} className={fieldClass}/>
          </div>
        </div>) : (<div className="space-y-3">
          <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">{display(brokerName)}</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <div>
              <p className={labelClass}>Billing Email</p>
              <p className="text-zinc-700 dark:text-zinc-300 break-words">{display(billingEmail)}</p>
            </div>
            <div>
              <p className={labelClass}>Customer Phone</p>
              <p className="text-zinc-700 dark:text-zinc-300 break-words">{display(brokerPhone)}</p>
            </div>
            <div className="sm:col-span-2">
              <p className={labelClass}>Customer Address</p>
              <p className="text-zinc-700 dark:text-zinc-300 break-words">{display(brokerAddress)}</p>
            </div>
            <div>
              <p className={labelClass}>Load ID</p>
              <p className="text-zinc-700 dark:text-zinc-300 break-words">{display(brokerLoadId)}</p>
            </div>
            <div>
              <p className={labelClass}>Pickup Number (PU#)</p>
              <p className="text-zinc-700 dark:text-zinc-300 break-words">{display(pickupNumber)}</p>
            </div>
          </div>
        </div>)}
    </div>);
}
interface LoadInfoRouteSectionProps {
    load: LoadRecord;
    isEditingWorkspace: boolean;
    routeStops: EditRouteStop[];
    pickupReference: string;
    totalMiles: number;
    onRouteStopChange: (id: number, patch: Partial<EditRouteStop>) => void;
    onPickupReferenceChange: (value: string) => void;
    onTotalMilesChange: (value: number) => void;
}
export function LoadInfoRouteSection({ load, isEditingWorkspace, routeStops, pickupReference, totalMiles, onRouteStopChange, onPickupReferenceChange, onTotalMilesChange, }: LoadInfoRouteSectionProps) {
    const manifestStops = useMemo(() => resolveManifestStops(load), [load]);
    const viewTotalMiles = load.total_miles ?? 0;
    const [expandedStops, setExpandedStops] = useState<Record<string, boolean>>({});
    useEffect(() => {
        setExpandedStops({});
    }, [load.id]);
    const isStopExpanded = (stopKey: string) => expandedStops[stopKey] !== false;
    const toggleStopExpanded = (stopKey: string) => {
        setExpandedStops((previous) => ({
            ...previous,
            [stopKey]: !isStopExpanded(stopKey),
        }));
    };
    return (<div className={sectionSlotClass}>
      <p className={`${SECTION_LABEL_CLASS} mb-3`}>Route</p>

      <div className="relative">
        <span className="pointer-events-none absolute top-2.5 bottom-2.5 left-[10px] w-[2px] -translate-x-1/2 bg-zinc-800 dark:bg-zinc-800" aria-hidden/>
        <div className="space-y-5">
          {isEditingWorkspace
            ? routeStops.map((stop) => {
                const role = editTypeToManifestRole(stop.type);
                const isPickup = stop.type === 'pickup';
                const stopKey = `edit-${stop.id}`;
                const cityState = resolveStopCityLabel(stop.address, stop.facility_name);
                return (<RouteStopTimelineNode key={stopKey} role={role} facilityName={stop.facility_name} cityState={cityState} isExpanded={isStopExpanded(stopKey)} onToggle={() => toggleStopExpanded(stopKey)}>
                    <div>
                      <label className={labelClass}>Facility</label>
                      <input type="text" value={stop.facility_name} onChange={(event) => onRouteStopChange(stop.id, { facility_name: event.target.value })} className={fieldClass}/>
                    </div>
                    <div>
                      <label className={labelClass}>Address</label>
                      <input type="text" value={stop.address} onChange={(event) => onRouteStopChange(stop.id, { address: event.target.value })} className={fieldClass}/>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div>
                        <label className={labelClass}>Appointment Date</label>
                        <input type="date" value={stop.appointment_date} onChange={(event) => onRouteStopChange(stop.id, { appointment_date: event.target.value })} className={fieldClass}/>
                      </div>
                      <div>
                        <label className={labelClass}>Appointment Window</label>
                        <input type="text" value={stop.appointment_window} onChange={(event) => onRouteStopChange(stop.id, { appointment_window: event.target.value })} placeholder="7:00 AM - 12:00 PM" className={fieldClass}/>
                      </div>
                    </div>
                    {isPickup ? (<div>
                        <label className={labelClass}>Pickup Reference / PO</label>
                        <input type="text" value={pickupReference} onChange={(event) => onPickupReferenceChange(event.target.value)} className={fieldClass}/>
                      </div>) : null}
                  </RouteStopTimelineNode>);
            })
            : manifestStops.map((stop) => {
                const stopKey = `${load.id}-${stop.sequence}-${stop.role}`;
                const cityState = resolveStopCityLabel(stop.address || stop.locationLine, stop.companyName);
                return (<RouteStopTimelineNode key={stopKey} role={stop.role} facilityName={stop.companyName} cityState={cityState} isExpanded={isStopExpanded(stopKey)} onToggle={() => toggleStopExpanded(stopKey)}>
                    <p className="text-sm text-zinc-700 dark:text-zinc-300 flex items-start gap-1">
                      <MapPin size={13} className="text-zinc-400 shrink-0 mt-0.5" aria-hidden/>
                      <span>{stop.address || stop.locationLine}</span>
                    </p>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 break-words whitespace-normal">
                      {stop.scheduleLabel}
                    </p>
                    {stop.referenceLine ? (<p className="text-xs text-zinc-500 dark:text-zinc-400 break-words whitespace-normal">
                        {stop.referenceLine}
                      </p>) : null}
                    {stop.weightLine ? (<p className="text-xs text-zinc-500 dark:text-zinc-400 break-words whitespace-normal">
                        {stop.weightLine}
                      </p>) : null}
                    {stop.appointmentLine && !stop.windowLabel ? (<p className="text-xs text-zinc-500 dark:text-zinc-400 break-words whitespace-normal">
                        {stop.appointmentLine}
                      </p>) : null}
                  </RouteStopTimelineNode>);
            })}
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between gap-3 border-t border-zinc-200 dark:border-zinc-800 pt-4">
        <span className={metricRowLabelClass}>
          Total Miles
        </span>
        {isEditingWorkspace ? (<MilesField value={totalMiles} onChange={onTotalMilesChange}/>) : (<span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            {formatTotalMiles(viewTotalMiles)}
          </span>)}
      </div>
    </div>);
}
interface LoadInfoCommoditySectionProps {
    commoditySummary: string;
    weight: number;
    targetTemperature: string;
    reeferMode: string;
    isEditingWorkspace: boolean;
    onCommodityChange: (value: string) => void;
    onWeightChange: (value: number) => void;
    onTargetTemperatureChange: (value: string) => void;
    onReeferModeChange: (value: string) => void;
}
export function LoadInfoCommoditySection({ commoditySummary, weight, targetTemperature, reeferMode, isEditingWorkspace, onCommodityChange, onWeightChange, onTargetTemperatureChange, onReeferModeChange, }: LoadInfoCommoditySectionProps) {
    const displaySummary = commoditySummary.trim() || '—';
    const displayReeferMode = reeferMode.trim() || '—';
    return (<div className={sectionSlotClass}>
      <p className={`${SECTION_LABEL_CLASS} mb-3`}>Commodity</p>
      {isEditingWorkspace ? (<input type="text" value={commoditySummary} onChange={(event) => onCommodityChange(event.target.value)} placeholder="Enter commodity cargo details..." className={fieldClass}/>) : (<p className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">{displaySummary}</p>)}
      <div className="mt-4 flex items-center justify-between gap-3 border-t border-zinc-200 dark:border-zinc-800 pt-4">
        <span className={metricRowLabelClass}>
          Weight
        </span>
        {isEditingWorkspace ? (<WeightField value={weight} onChange={onWeightChange}/>) : (<span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            {formatWeight(weight)}
          </span>)}
      </div>
      <div className="mt-4 flex items-center justify-between gap-3 border-t border-zinc-200 dark:border-zinc-800 pt-4">
        <span className={metricRowLabelClass}>
          Target Temperature
        </span>
        {isEditingWorkspace ? (<TemperatureField value={targetTemperature} onChange={onTargetTemperatureChange}/>) : (<span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            {formatTemperatureDisplay(targetTemperature)}
          </span>)}
      </div>
      <div className="mt-4 flex items-center justify-between gap-3 border-t border-zinc-200 dark:border-zinc-800 pt-4">
        <span className={metricRowLabelClass}>
          Reefer Mode
        </span>
        {isEditingWorkspace ? (<select value={reeferMode} onChange={(event) => onReeferModeChange(event.target.value)} className={`${fieldClass} w-40`}>
            {REEFER_MODE_OPTIONS.map((mode) => (<option key={mode} value={mode}>
                {mode}
              </option>))}
          </select>) : (<span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{displayReeferMode}</span>)}
      </div>
    </div>);
}
interface LoadInfoFinancialSummaryProps {
    load: LoadRecord;
    isEditingWorkspace: boolean;
    grossRate: number;
    fuelCost: number;
    accessorialCharge: number;
    driverPay: number;
    onGrossRateChange: (value: number) => void;
    onFuelCostChange: (value: number) => void;
    onAccessorialChange: (value: number) => void;
    onDriverPayChange: (value: number) => void;
    canViewNetProfit: boolean;
}
export function LoadInfoFinancialSummary({ load, isEditingWorkspace, grossRate, fuelCost, accessorialCharge, driverPay, onGrossRateChange, onFuelCostChange, onAccessorialChange, onDriverPayChange, canViewNetProfit, }: LoadInfoFinancialSummaryProps) {
    const totalExpenses = fuelCost + driverPay + (load.toll_cost ?? 0);
    const netProfit = grossRate - totalExpenses;
    return (<div className={sectionSlotClass}>
      <p className={`${SECTION_LABEL_CLASS} mb-3`}>Financial Summary</p>
      <div className="divide-y divide-zinc-200 dark:divide-zinc-800 overflow-hidden">
        <div className="flex items-center justify-between px-3 py-2.5 bg-zinc-50 dark:bg-zinc-900/40">
          <span className="text-xs text-zinc-500 dark:text-zinc-400">Gross Rate</span>
          {isEditingWorkspace ? (<CurrencyField value={grossRate} onChange={onGrossRateChange}/>) : (<span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              {formatCurrency(grossRate)}
            </span>)}
        </div>
        {canViewNetProfit ? (<>
            <div className="flex items-center justify-between px-3 py-2.5">
              <span className="text-xs text-zinc-500 dark:text-zinc-400">Est. Fuel</span>
              {isEditingWorkspace ? (<CurrencyField value={fuelCost} onChange={onFuelCostChange}/>) : (<span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  {formatCurrency(fuelCost)}
                </span>)}
            </div>
            <div className="flex items-center justify-between px-3 py-2.5">
              <span className="text-xs text-zinc-500 dark:text-zinc-400">Accessory / Other</span>
              {isEditingWorkspace ? (<CurrencyField value={accessorialCharge} onChange={onAccessorialChange}/>) : (<span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  {formatCurrency(accessorialCharge)}
                </span>)}
            </div>
            <div className="flex items-center justify-between px-3 py-2.5">
              <span className="text-xs text-zinc-500 dark:text-zinc-400">Driver Pay</span>
              {isEditingWorkspace ? (<CurrencyField value={driverPay} onChange={onDriverPayChange}/>) : (<span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  {formatCurrency(driverPay)}
                </span>)}
            </div>
            <div className="flex items-center justify-between px-3 py-2.5 bg-zinc-50 dark:bg-zinc-900/40">
              <span className="text-xs font-semibold text-zinc-600 dark:text-zinc-400">
                Net Profit
              </span>
              <span className="text-sm text-emerald-600 dark:text-emerald-400 font-bold">
                {formatCurrency(netProfit)}
              </span>
            </div>
          </>) : (<div className="flex items-center justify-between px-3 py-2.5">
            <span className="text-xs text-zinc-500 dark:text-zinc-400">Accessory / Other</span>
            {isEditingWorkspace ? (<CurrencyField value={accessorialCharge} onChange={onAccessorialChange}/>) : (<span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                {formatCurrency(accessorialCharge)}
              </span>)}
          </div>)}
      </div>
    </div>);
}
interface LoadInfoDispatcherNotesSectionProps {
    notes: string;
    onNotesChange: (value: string) => void;
    onBlur: () => void;
}
export function LoadInfoDispatcherNotesSection({ notes, onNotesChange, onBlur, }: LoadInfoDispatcherNotesSectionProps) {
    return (<div className={sectionSlotClass}>
      <p className={`${SECTION_LABEL_CLASS} mb-3`}>Comments</p>
      <textarea value={notes} onChange={(event) => onNotesChange(event.target.value)} onBlur={onBlur} placeholder="Add comments..." className="w-full bg-transparent border-0 resize-none rounded-lg p-0 text-sm text-zinc-900 dark:text-zinc-100 focus:ring-0 placeholder-zinc-400 focus:outline-none transition-shadow min-h-[80px]"/>
    </div>);
}
export default LoadInfoRouteSection;
