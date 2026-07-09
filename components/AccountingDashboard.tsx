"use client";
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import toast from 'react-hot-toast';
import axios from 'axios';
import { createApiClient, getApiBaseUrl, hasValidTmsToken, normalizeBearerToken } from '@/lib/api-client';
import { createTmsApi, type FuelEntryRecord, type IftaSummary, type LedgerLine, type LoadDocumentRecord } from '@/lib/tms-api';
import { ChevronDown, ChevronRight, Plus, Trash2, Truck, Receipt, SlidersHorizontal, Calendar, FileText, Calculator, } from 'lucide-react';
import BillingCommandCenter from './BillingCommandCenter';
import Payroll from './Payroll';
import FuelIftaManager from './FuelIftaManager';
export type AccountingViewTab = 'ledger' | 'settlements' | 'fuel-ifta';
type BillingTab = 'queue' | 'ar';
const ACCOUNTING_VIEW_TABS: Array<{
    id: AccountingViewTab;
    label: string;
}> = [
    { id: 'ledger', label: 'Ledger & Invoicing' },
    { id: 'settlements', label: 'Driver Settlements' },
    { id: 'fuel-ifta', label: 'Fuel & IFTA' },
];
const BILLING_SUB_TABS: Array<{
    id: BillingTab;
    label: string;
}> = [
    { id: 'queue', label: 'Open Billing Queue' },
    { id: 'ar', label: 'Pending Payments' },
];
function parseAccountingViewTab(value: string | null): AccountingViewTab {
    if (value === 'settlements' || value === 'fuel-ifta')
        return value;
    return 'ledger';
}
interface Driver {
    id: number;
    driver_name: string;
}
interface FleetTruck {
    id: number;
    truck_number: string;
    trailer_number?: string;
    driver_id?: number | null;
}
interface AccountingLoad {
    id: number;
    load_id: string;
    driver_name: string;
    truck_number: string | null;
    trailer_number: string | null;
    origin: string;
    destination: string;
    gross_rate: number;
    pickup_date?: string | null;
    created_at?: string | null;
    payment_status?: string | null;
    document_file_path?: string | null;
    document_url?: string | null;
    has_rc_document?: boolean;
}
interface CustomFee {
    id: number;
    name: string;
    percentage: number;
}
interface AccountingDashboardProps {
    trucks: FleetTruck[];
    drivers: Driver[];
    token: string | null;
    fuelHistory: FuelEntryRecord[];
    iftaData: IftaSummary;
    refreshFuel: () => Promise<void>;
}
const toInputDate = (d: Date) => d.toISOString().slice(0, 10);
const getWeekWindow = () => {
    const now = new Date();
    const diffToMonday = (now.getDay() + 6) % 7;
    const monday = new Date(now);
    monday.setDate(now.getDate() - diffToMonday);
    monday.setHours(0, 0, 0, 0);
    const nextMonday = new Date(monday);
    nextMonday.setDate(monday.getDate() + 7);
    return { start: toInputDate(monday), end: toInputDate(nextMonday) };
};
const fmt = (n: number) => n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const getMonday = (d: Date) => {
    const copy = new Date(d);
    const diff = (copy.getDay() + 6) % 7;
    copy.setDate(copy.getDate() - diff);
    copy.setHours(0, 0, 0, 0);
    return copy;
};
const formatWeekLabel = (monday: Date) => `Week of ${monday.toLocaleDateString(undefined, { month: 'short', day: '2-digit', year: 'numeric' })}`;
const formatDayLabel = (d: Date) => d.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: '2-digit' });
export default function AccountingDashboard({ trucks, drivers, token, fuelHistory, iftaData, refreshFuel, }: AccountingDashboardProps) {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const accountingBasePath = pathname.startsWith('/accounting') ? '/accounting' : '/';
    const viewTab = parseAccountingViewTab(searchParams.get('tab'));
    const [billingTab, setBillingTab] = useState<BillingTab>('queue');
    const setViewTab = useCallback((nextTab: AccountingViewTab) => {
        const params = new URLSearchParams(searchParams.toString());
        if (nextTab === 'ledger') {
            params.delete('tab');
        }
        else {
            params.set('tab', nextTab);
        }
        const query = params.toString();
        router.replace(query ? `${accountingBasePath}?${query}` : accountingBasePath, { scroll: false });
    }, [accountingBasePath, router, searchParams]);
    const selectLedgerBillingTab = (tab: BillingTab) => {
        setBillingTab(tab);
        setViewTab('ledger');
    };
    const API_URL = getApiBaseUrl();
    const bearerToken = normalizeBearerToken(token);
    const api = useMemo(() => createTmsApi(createApiClient(bearerToken || null)), [bearerToken]);
    const initialWindow = useMemo(() => getWeekWindow(), []);
    const [startDate, setStartDate] = useState(initialWindow.start);
    const [endDate, setEndDate] = useState(initialWindow.end);
    const [selectedTruckId, setSelectedTruckId] = useState<number | null>(null);
    const [loads, setLoads] = useState<AccountingLoad[]>([]);
    const [ledgerLines, setLedgerLines] = useState<LedgerLine[]>([]);
    const [selectedLoadIds, setSelectedLoadIds] = useState<number[]>([]);
    const [loading, setLoading] = useState(false);
    const [ledgerLoading, setLedgerLoading] = useState(false);
    const [customFees, setCustomFees] = useState<CustomFee[]>([
        { id: 1, name: 'Driver Pay', percentage: 25 },
        { id: 2, name: 'Dispatcher', percentage: 5 },
    ]);
    const [newFeeName, setNewFeeName] = useState('');
    const [newFeePct, setNewFeePct] = useState('');
    const [nextFeeId, setNextFeeId] = useState(3);
    const [expandedWeeks, setExpandedWeeks] = useState<Set<string>>(new Set());
    const [expandedDays, setExpandedDays] = useState<Set<string>>(new Set());
    const activeTrucks = useMemo(() => [...trucks].sort((a, b) => String(a.truck_number).localeCompare(String(b.truck_number))), [trucks]);
    const driverNameById = useMemo(() => {
        const map = new Map<number, string>();
        drivers.forEach((d) => map.set(d.id, d.driver_name));
        return map;
    }, [drivers]);
    const selectedTruck = activeTrucks.find((t) => t.id === selectedTruckId) || null;
    const fetchLedger = useCallback(async (truck: FleetTruck | null) => {
        if (!hasValidTmsToken(bearerToken))
            return;
        setLedgerLoading(true);
        try {
            const res = await api.accounting.ledger({
                start_date: startDate ? `${startDate}T00:00:00` : null,
                end_date: endDate ? `${endDate}T23:59:59` : null,
                truck_id: truck?.id ?? null,
            });
            setLedgerLines(res?.lines ?? []);
        }
        catch (err: unknown) {
            console.error(err);
            setLedgerLines([]);
            const isNetworkFailure = (axios.isAxiosError(err) &&
                (err.message === 'Network Error' || err.code === 'ERR_NETWORK')) ||
                (err instanceof Error && err.message === 'Network Error');
            if (isNetworkFailure) {
                toast.error('Unable to connect to the accounting server. Please verify your backend is running.');
            }
        }
        finally {
            setLedgerLoading(false);
        }
    }, [api, bearerToken, startDate, endDate]);
    const fetchForTruck = useCallback(async (truck: FleetTruck) => {
        if (!hasValidTmsToken(bearerToken))
            return;
        setLoading(true);
        try {
            const [res] = await Promise.all([
                api.accounting.calculate({
                    truck_id: truck.id,
                    search_query: truck.truck_number,
                    start_date: startDate ? `${startDate}T00:00:00` : null,
                    end_date: endDate ? `${endDate}T23:59:59` : null,
                    custom_fees: [],
                }),
                fetchLedger(truck),
            ]);
            const fetchedLoads: AccountingLoad[] = res.loads || [];
            setLoads(fetchedLoads);
            setSelectedLoadIds(fetchedLoads.map((l) => l.id));
            const weekKeys = new Set<string>();
            const dayKeys = new Set<string>();
            fetchedLoads.forEach((load) => {
                const activityRaw = load.pickup_date || load.created_at;
                if (!activityRaw)
                    return;
                const pickup = new Date(activityRaw);
                const monday = getMonday(pickup);
                weekKeys.add(monday.toISOString().slice(0, 10));
                dayKeys.add(pickup.toISOString().slice(0, 10));
            });
            setExpandedWeeks(weekKeys);
            setExpandedDays(dayKeys);
        }
        catch (err: any) {
            console.error(err);
            toast.error(err.response?.data?.detail || 'Failed to load rate confirmations.');
            setLoads([]);
            setSelectedLoadIds([]);
        }
        finally {
            setLoading(false);
        }
    }, [api, bearerToken, startDate, endDate, fetchLedger]);
    useEffect(() => {
        if (!hasValidTmsToken(bearerToken))
            return;
        const truck = activeTrucks.find((t) => t.id === selectedTruckId);
        if (!truck)
            return;
        fetchForTruck(truck);
    }, [bearerToken, selectedTruckId, startDate, endDate, fetchForTruck, activeTrucks]);
    useEffect(() => {
        if (activeTrucks.length > 0 && selectedTruckId === null) {
            setSelectedTruckId(activeTrucks[0].id);
        }
    }, [activeTrucks, selectedTruckId]);
    const groupedLedger = useMemo(() => {
        const weeks: Record<string, {
            monday: Date;
            days: Record<string, {
                date: Date;
                loads: AccountingLoad[];
            }>;
        }> = {};
        loads.forEach((load) => {
            const activityRaw = load.pickup_date || load.created_at;
            if (!activityRaw)
                return;
            const pickup = new Date(activityRaw);
            const monday = getMonday(pickup);
            const weekKey = monday.toISOString().slice(0, 10);
            const dayKey = pickup.toISOString().slice(0, 10);
            if (!weeks[weekKey]) {
                weeks[weekKey] = { monday, days: {} };
            }
            if (!weeks[weekKey].days[dayKey]) {
                weeks[weekKey].days[dayKey] = { date: pickup, loads: [] };
            }
            weeks[weekKey].days[dayKey].loads.push(load);
        });
        return Object.entries(weeks)
            .sort(([a], [b]) => b.localeCompare(a))
            .map(([weekKey, week]) => ({
            weekKey,
            monday: week.monday,
            days: Object.entries(week.days)
                .sort(([a], [b]) => b.localeCompare(a))
                .map(([dayKey, day]) => ({ dayKey, date: day.date, loads: day.loads })),
        }));
    }, [loads]);
    const selectedLoads = useMemo(() => loads.filter((l) => selectedLoadIds.includes(l.id)), [loads, selectedLoadIds]);
    const allLoadsSelected = loads.length > 0 && selectedLoadIds.length === loads.length;
    const totals = useMemo(() => {
        const totalGross = selectedLoads.reduce((sum, l) => sum + (l.gross_rate || 0), 0);
        const feeLines = customFees.map((fee) => ({
            ...fee,
            amount: totalGross * (fee.percentage / 100),
        }));
        const totalDeductions = feeLines.reduce((sum, f) => sum + f.amount, 0);
        const netMargin = totalGross - totalDeductions;
        return { totalGross, feeLines, totalDeductions, netMargin };
    }, [selectedLoads, customFees]);
    const toggleLoadSelection = (loadId: number) => {
        setSelectedLoadIds((prev) => prev.includes(loadId) ? prev.filter((id) => id !== loadId) : [...prev, loadId]);
    };
    const toggleSelectAll = () => {
        if (allLoadsSelected) {
            setSelectedLoadIds([]);
        }
        else {
            setSelectedLoadIds(loads.map((l) => l.id));
        }
    };
    const openLedgerDocument = (line: LedgerLine) => {
        if (!line.has_document) {
            toast.error('No document attached to this transaction.');
            return;
        }
        const url = line.document_url?.startsWith('http')
            ? line.document_url
            : `${API_URL}${line.document_url || `/${(line.document_file_path || '').replace(/^\/+/, '')}`}`;
        window.open(url, '_blank', 'noopener,noreferrer');
    };
    const openRcDocument = async (load: AccountingLoad) => {
        if (load.document_url) {
            const url = load.document_url.startsWith('http')
                ? load.document_url
                : `${API_URL}${load.document_url}`;
            window.open(url, '_blank', 'noopener,noreferrer');
            return;
        }
        try {
            const docs = await api.loads.documents(load.id);
            const rcDoc = docs.find((d: LoadDocumentRecord) => (d.document_type || '').toLowerCase().includes('rate')) || docs[0];
            if (!rcDoc) {
                toast.error('No rate confirmation document uploaded for this load.');
                return;
            }
            const url = rcDoc.file_url?.startsWith('http')
                ? rcDoc.file_url
                : `${API_URL}${rcDoc.file_url || rcDoc.file_path || ''}`;
            window.open(url, '_blank', 'noopener,noreferrer');
        }
        catch {
            toast.error('Unable to open rate confirmation document.');
        }
    };
    const toggleWeek = (weekKey: string) => {
        setExpandedWeeks((prev) => {
            const next = new Set(prev);
            if (next.has(weekKey))
                next.delete(weekKey);
            else
                next.add(weekKey);
            return next;
        });
    };
    const toggleDay = (dayKey: string) => {
        setExpandedDays((prev) => {
            const next = new Set(prev);
            if (next.has(dayKey))
                next.delete(dayKey);
            else
                next.add(dayKey);
            return next;
        });
    };
    const addCustomFee = () => {
        const name = newFeeName.trim();
        const pct = parseFloat(newFeePct);
        if (!name) {
            toast.error('Enter a fee description.');
            return;
        }
        if (Number.isNaN(pct) || pct < 0) {
            toast.error('Enter a valid percentage.');
            return;
        }
        setCustomFees((prev) => [...prev, { id: nextFeeId, name, percentage: pct }]);
        setNextFeeId((id) => id + 1);
        setNewFeeName('');
        setNewFeePct('');
    };
    const removeCustomFee = (id: number) => {
        setCustomFees((prev) => prev.filter((f) => f.id !== id));
    };
    const updateFeePercentage = (id: number, raw: string) => {
        const pct = parseFloat(raw);
        setCustomFees((prev) => prev.map((f) => (f.id === id ? { ...f, percentage: Number.isNaN(pct) ? 0 : Math.max(0, pct) } : f)));
    };
    const tabButtonClass = (isActive: boolean) => `px-4 py-2 text-xs font-bold uppercase tracking-wider transition-colors ${isActive
        ? 'bg-zinc-900 text-white dark:bg-white dark:text-black'
        : 'bg-white dark:bg-[#161616] text-zinc-500 hover:bg-zinc-50 dark:hover:bg-zinc-800'}`;
    return (<div className="space-y-4 animate-in fade-in duration-200">
      <section className="bg-white dark:bg-[#161616] border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-[#0B0B0B] flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-800 dark:text-zinc-200 flex items-center gap-2">
              <Calculator size={16}/> Accounting Workspace
            </h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
              Invoicing, settlements, fuel compliance, and ledger operations in one view.
            </p>
          </div>
          <div className="flex flex-wrap rounded-lg border border-zinc-200 dark:border-zinc-800 overflow-hidden">
            {BILLING_SUB_TABS.map((tab) => (<button key={tab.id} type="button" onClick={() => selectLedgerBillingTab(tab.id)} className={tabButtonClass(viewTab === 'ledger' && billingTab === tab.id)}>
                {tab.label}
              </button>))}
            {ACCOUNTING_VIEW_TABS.filter((tab) => tab.id !== 'ledger').map((tab) => (<button key={tab.id} type="button" onClick={() => setViewTab(tab.id)} className={tabButtonClass(viewTab === tab.id)}>
                {tab.label}
              </button>))}
          </div>
        </div>
      </section>

      {viewTab === 'settlements' && (<Payroll drivers={drivers} token={bearerToken || ''}/>)}

      {viewTab === 'fuel-ifta' && (<FuelIftaManager trucks={trucks} drivers={drivers} token={token} fuelHistory={fuelHistory} iftaData={iftaData} refreshFuel={refreshFuel}/>)}

      {viewTab === 'ledger' && (<>
      <BillingCommandCenter token={token} hideTabBar activeTab={billingTab} onActiveTabChange={setBillingTab}/>

      
      <div className="bg-white dark:bg-[#161616] border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-3 shadow-sm flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2 text-zinc-600 dark:text-zinc-300">
          <Calendar size={16} className="text-zinc-500"/>
          <span className="text-xs font-bold uppercase tracking-wider">Payroll Window</span>
        </div>
        <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="px-3 py-1.5 text-xs border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-zinc-900 dark:text-white rounded-lg outline-none focus:ring-2 focus:ring-zinc-600"/>
        <span className="text-zinc-400 text-xs">to</span>
        <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="px-3 py-1.5 text-xs border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-zinc-900 dark:text-white rounded-lg outline-none focus:ring-2 focus:ring-zinc-600"/>
        {selectedTruck && (<span className="ml-auto text-xs font-semibold text-zinc-500 dark:text-zinc-400">
            Viewing Unit <span className="text-zinc-600 dark:text-zinc-300">#{selectedTruck.truck_number}</span>
            {selectedTruck.driver_id ? ` · ${driverNameById.get(selectedTruck.driver_id) || 'Unassigned'}` : ''}
          </span>)}
      </div>

      
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 min-h-[640px]">
        
        <aside className="xl:col-span-2 bg-white dark:bg-[#161616] border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-sm overflow-hidden flex flex-col">
          <div className="px-4 py-3 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-[#0B0B0B]">
            <h3 className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 flex items-center gap-1.5">
              <Truck size={14}/> Fleet Units
            </h3>
          </div>
          <div className="flex-1 overflow-y-auto max-h-[600px]">
            {activeTrucks.length === 0 ? (<p className="p-4 text-xs text-zinc-400 text-center">No active trucks registered.</p>) : (activeTrucks.map((truck) => {
                const isActive = truck.id === selectedTruckId;
                const driverLabel = truck.driver_id
                    ? driverNameById.get(truck.driver_id) || 'Unassigned'
                    : 'No Driver';
                return (<button key={truck.id} onClick={() => setSelectedTruckId(truck.id)} className={`w-full text-left px-4 py-3 border-b border-zinc-100 dark:border-zinc-800 transition-colors ${isActive
                        ? 'bg-zinc-100 dark:bg-zinc-800 border-l-2 border-l-zinc-500'
                        : 'hover:bg-zinc-50 dark:hover:bg-zinc-800/50 border-l-2 border-l-transparent'}`}>
                    <p className={`text-sm font-bold ${isActive ? 'text-zinc-900 dark:text-white' : 'text-zinc-900 dark:text-white'}`}>
                      #{truck.truck_number}
                    </p>
                    <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5 truncate">{driverLabel}</p>
                  </button>);
            }))}
          </div>
        </aside>

        
        <section className="xl:col-span-7 bg-white dark:bg-[#161616] border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-sm overflow-hidden flex flex-col">
          <div className="px-5 py-3 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-[#0B0B0B] flex justify-between items-center">
            <h3 className="text-sm font-bold text-zinc-700 dark:text-zinc-200 uppercase tracking-wider flex items-center gap-2">
              <Receipt size={16}/> Rate Confirmation Ledger
            </h3>
            <div className="flex items-center gap-3">
              {loads.length > 0 && (<label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={allLoadsSelected} onChange={toggleSelectAll} className="rounded border-zinc-300 dark:border-zinc-700 text-zinc-600 focus:ring-zinc-600"/>
                  <span className="text-[10px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase">
                    Select All
                  </span>
                </label>)}
              <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">
                {selectedLoadIds.length}/{loads.length} RC{loads.length !== 1 ? 's' : ''} selected
              </span>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto max-h-[600px]">
            {!selectedTruck ? (<p className="p-10 text-center text-sm text-zinc-400">Select a fleet unit to load rate confirmations.</p>) : loading ? (<p className="p-10 text-center text-sm text-zinc-400 animate-pulse">Loading ledger for #{selectedTruck.truck_number}...</p>) : groupedLedger.length === 0 ? (<p className="p-10 text-center text-sm text-zinc-400">
                No rate confirmations for #{selectedTruck.truck_number} in this payroll window.
              </p>) : (<div className="divide-y dark:divide-zinc-800">
                {groupedLedger.map(({ weekKey, monday, days }) => {
                    const weekOpen = expandedWeeks.has(weekKey);
                    return (<div key={weekKey}>
                      <button onClick={() => toggleWeek(weekKey)} className="w-full flex items-center gap-2 px-5 py-3 bg-zinc-50/80 dark:bg-[#0B0B0B]/80 hover:bg-zinc-100 dark:hover:bg-zinc-800/60 transition-colors text-left">
                        {weekOpen ? <ChevronDown size={16} className="text-zinc-500"/> : <ChevronRight size={16} className="text-zinc-400"/>}
                        <span className="text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-200">
                          {formatWeekLabel(monday)}
                        </span>
                        <span className="ml-auto text-[10px] font-semibold text-zinc-400">
                          {days.reduce((n, d) => n + d.loads.length, 0)} loads
                        </span>
                      </button>

                      <div className={`overflow-hidden transition-all duration-300 ease-in-out ${weekOpen ? 'max-h-[4000px] opacity-100' : 'max-h-0 opacity-0'}`}>
                        {days.map(({ dayKey, date, loads: dayLoads }) => {
                            const dayOpen = expandedDays.has(dayKey);
                            return (<div key={dayKey} className="border-t border-zinc-100 dark:border-zinc-800">
                              <button onClick={() => toggleDay(dayKey)} className="w-full flex items-center gap-2 pl-8 pr-5 py-2.5 hover:bg-zinc-50 dark:hover:bg-zinc-800/40 transition-colors text-left">
                                {dayOpen ? <ChevronDown size={14} className="text-zinc-500"/> : <ChevronRight size={14} className="text-zinc-400"/>}
                                <span className="text-xs font-semibold text-zinc-600 dark:text-zinc-300">
                                  {formatDayLabel(date)}
                                </span>
                                <span className="ml-auto text-[10px] text-zinc-400">{dayLoads.length} RC</span>
                              </button>

                              <div className={`overflow-hidden transition-all duration-300 ease-in-out ${dayOpen ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0'}`}>
                                <table className="w-full text-xs">
                                  <thead className="bg-zinc-50 dark:bg-[#0B0B0B] text-zinc-500 dark:text-zinc-400 text-[9px] uppercase font-bold">
                                    <tr>
                                      <th className="p-2 pl-8 w-8">
                                        <input type="checkbox" checked={dayLoads.every((l) => selectedLoadIds.includes(l.id))} onChange={() => {
                                    const dayIds = dayLoads.map((l) => l.id);
                                    const allDaySelected = dayIds.every((id) => selectedLoadIds.includes(id));
                                    if (allDaySelected) {
                                        setSelectedLoadIds((prev) => prev.filter((id) => !dayIds.includes(id)));
                                    }
                                    else {
                                        setSelectedLoadIds((prev) => [...new Set([...prev, ...dayIds])]);
                                    }
                                }} className="rounded border-zinc-300 dark:border-zinc-700 text-zinc-600 focus:ring-zinc-600"/>
                                      </th>
                                      <th className="p-2 text-left">Load ID</th>
                                      <th className="p-2 text-left">Asset Reference</th>
                                      <th className="p-2 text-left">Lane</th>
                                      <th className="p-2 text-right">Gross</th>
                                      <th className="p-2 text-right pr-5">Document</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y dark:divide-zinc-800/60">
                                    {dayLoads.map((load) => {
                                    const isSelected = selectedLoadIds.includes(load.id);
                                    const hasDoc = load.has_rc_document || !!load.document_url || !!load.document_file_path;
                                    return (<tr key={load.id} className={`transition-colors ${isSelected
                                            ? 'bg-zinc-50 dark:bg-zinc-800/40'
                                            : 'hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30'}`}>
                                          <td className="p-2 pl-8">
                                            <input type="checkbox" checked={isSelected} onChange={() => toggleLoadSelection(load.id)} className="rounded border-zinc-300 dark:border-zinc-700 text-zinc-600 focus:ring-zinc-600"/>
                                          </td>
                                          <td className="p-2 font-mono font-bold text-zinc-900 dark:text-white">
                                            {load.load_id}
                                          </td>
                                          <td className="p-2 text-zinc-600 dark:text-zinc-300">
                                            <span className="font-semibold">{load.driver_name}</span>
                                            <span className="text-zinc-400 dark:text-zinc-500"> · </span>
                                            <span className="font-mono text-[11px]">
                                              #{load.truck_number || '—'}
                                            </span>
                                          </td>
                                          <td className="p-2 text-zinc-500 dark:text-zinc-400">
                                            {load.origin} → {load.destination}
                                          </td>
                                          <td className={`p-2 text-right font-bold ${isSelected ? 'text-zinc-900 dark:text-white' : 'text-zinc-400 dark:text-zinc-500'}`}>
                                            ${fmt(load.gross_rate)}
                                          </td>
                                          <td className="p-2 pr-5 text-right">
                                            <button type="button" onClick={() => hasDoc && openRcDocument(load)} disabled={!hasDoc} className={`text-[10px] font-bold px-2 py-1 rounded-md border transition-colors inline-flex items-center gap-1 ${hasDoc
                                            ? 'border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                                            : 'border-zinc-200 dark:border-zinc-800 text-zinc-300 dark:text-zinc-600 cursor-not-allowed'}`}>
                                              <FileText size={12}/>
                                              View
                                            </button>
                                          </td>
                                        </tr>);
                                })}
                                  </tbody>
                                </table>
                              </div>
                            </div>);
                        })}
                      </div>
                    </div>);
                })}
              </div>)}
          </div>
        </section>

        
        <div className="xl:col-span-3 space-y-4">
          <section className="bg-white dark:bg-[#161616] border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-[#0B0B0B]">
              <h3 className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 flex items-center gap-1.5">
                <SlidersHorizontal size={14}/> Custom Fee Engine
              </h3>
            </div>

            <div className="p-4 space-y-3">
              <div className="flex gap-2 items-end">
                <div className="flex-1">
                  <label className="text-[9px] font-bold uppercase text-zinc-400 mb-1 block">Fee Name</label>
                  <input type="text" value={newFeeName} onChange={(e) => setNewFeeName(e.target.value)} placeholder="Escrow, Safety Fee..." className="w-full px-2.5 py-1.5 text-xs border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-zinc-900 dark:text-white rounded-lg outline-none focus:ring-2 focus:ring-zinc-600"/>
                </div>
                <div className="w-20">
                  <label className="text-[9px] font-bold uppercase text-zinc-400 mb-1 block">Rate</label>
                  <div className="relative">
                    <input type="number" min={0} step={0.5} value={newFeePct} onChange={(e) => setNewFeePct(e.target.value)} placeholder="0" className="w-full pr-5 pl-2 py-1.5 text-xs font-bold text-right border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-zinc-900 dark:text-white rounded-lg outline-none focus:ring-2 focus:ring-zinc-600"/>
                    <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[10px] text-zinc-400">%</span>
                  </div>
                </div>
                <button onClick={addCustomFee} className="p-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 dark:bg-white dark:text-black dark:hover:bg-zinc-200 text-white transition-colors" title="Add custom fee">
                  <Plus size={16}/>
                </button>
              </div>

              <div className="space-y-2 max-h-[220px] overflow-y-auto">
                {customFees.length === 0 ? (<p className="text-xs text-zinc-400 text-center py-4">No fees configured.</p>) : (customFees.map((fee) => (<div key={fee.id} className="flex items-center gap-2 p-2 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-[#0B0B0B]/50">
                      <span className="flex-1 text-xs font-semibold text-zinc-700 dark:text-zinc-200 truncate">
                        {fee.name}
                      </span>
                      <div className="relative w-16">
                        <input type="number" min={0} step={0.5} value={fee.percentage} onChange={(e) => updateFeePercentage(fee.id, e.target.value)} className="w-full pr-4 pl-1 py-1 text-[11px] font-bold text-right border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#161616] text-zinc-900 dark:text-white rounded outline-none focus:ring-1 focus:ring-zinc-600"/>
                        <span className="absolute right-1 top-1/2 -translate-y-1/2 text-[9px] text-zinc-400">%</span>
                      </div>
                      <button onClick={() => removeCustomFee(fee.id)} className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors" title="Remove fee">
                        <Trash2 size={14}/>
                      </button>
                    </div>)))}
              </div>
            </div>
          </section>

          <section className="bg-white dark:bg-[#161616] border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4 shadow-lg">
            <h3 className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 dark:text-zinc-400 mb-3">
              Live Margin Statement
            </h3>
            <div className="space-y-2.5">
              <div className="flex justify-between items-center">
                <span className="text-xs text-zinc-500 dark:text-zinc-400">
                  Gross Pipeline Revenue ({selectedLoadIds.length} RC{selectedLoadIds.length !== 1 ? 's' : ''})
                </span>
                <span className="text-base font-bold text-emerald-400">${fmt(totals.totalGross)}</span>
              </div>
              {totals.feeLines.map((fee) => (<div key={fee.id} className="flex justify-between items-center">
                  <span className="text-xs text-zinc-500 dark:text-zinc-400">
                    Less: {fee.name} ({fee.percentage}%)
                  </span>
                  <span className="text-xs font-bold text-rose-400">-${fmt(fee.amount)}</span>
                </div>))}
              <div className="border-t border-zinc-200 dark:border-zinc-800 pt-2.5 flex justify-between items-center">
                <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">Net Retained Company Margin</span>
                <span className={`text-xl font-black ${totals.netMargin >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  ${fmt(totals.netMargin)}
                </span>
              </div>
            </div>
          </section>
        </div>
      </div>

      <section className="bg-white dark:bg-[#161616] border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-[#0B0B0B] flex justify-between items-center">
          <h3 className="text-sm font-bold text-zinc-700 dark:text-zinc-200 uppercase tracking-wider flex items-center gap-2">
            <Receipt size={16}/> Transaction History
          </h3>
          <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">
            {ledgerLines.length} transaction{ledgerLines.length !== 1 ? 's' : ''}
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-zinc-50 dark:bg-[#161616] text-zinc-500 dark:text-zinc-400 text-xs font-bold uppercase tracking-wider border-b dark:border-zinc-800">
              <tr>
                <th className="p-4">Date</th>
                <th className="p-4">Type</th>
                <th className="p-4">Reference</th>
                <th className="p-4">Asset Reference</th>
                <th className="p-4 text-right">Amount</th>
                <th className="p-4 text-right">Document</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {ledgerLoading ? (<tr>
                  <td colSpan={6} className="p-8 text-center text-zinc-400 animate-pulse">
                    Syncing ledger transactions...
                  </td>
                </tr>) : ledgerLines.length === 0 ? (<tr>
                  <td colSpan={6} className="p-8 text-center text-zinc-400">
                    No transaction history logged for this selected timeline window.
                  </td>
                </tr>) : (ledgerLines.map((line) => {
                const isRevenue = line.transaction_type === 'revenue';
                return (<tr key={line.id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/40 transition-colors">
                      <td className="p-4 text-zinc-500 dark:text-zinc-400">
                        {line.transaction_date
                        ? new Date(line.transaction_date).toLocaleDateString()
                        : '—'}
                      </td>
                      <td className="p-4">
                        <span className={`text-[10px] font-bold uppercase px-2 py-1 rounded-md border ${isRevenue
                        ? 'border-emerald-500/30 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10'
                        : 'border-rose-500/30 text-rose-600 dark:text-rose-400 bg-rose-500/10'}`}>
                          {isRevenue ? 'Revenue' : 'Expense'}
                        </span>
                      </td>
                      <td className="p-4 font-mono font-bold text-zinc-900 dark:text-white">{line.reference}</td>
                      <td className="p-4 text-zinc-600 dark:text-zinc-300">
                        <span className="font-semibold">{line.driver_name}</span>
                        <span className="text-zinc-400 dark:text-zinc-500"> · </span>
                        <span className="font-mono text-xs">#{line.truck_number || '—'}</span>
                      </td>
                      <td className={`p-4 text-right font-bold ${isRevenue ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500 dark:text-rose-400'}`}>
                        {line.amount < 0 ? '-' : ''}${fmt(Math.abs(line.amount))}
                      </td>
                      <td className="p-4 text-right">
                        <button type="button" onClick={() => openLedgerDocument(line)} disabled={!line.has_document} className={`text-xs font-bold px-3 py-1.5 rounded-lg border transition-colors inline-flex items-center gap-1 ${line.has_document
                        ? 'border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                        : 'border-zinc-200 dark:border-zinc-800 text-zinc-300 dark:text-zinc-600 cursor-not-allowed'}`}>
                          <FileText size={14}/>
                          {line.source_kind === 'fuel' ? 'Receipt' : 'Document'}
                        </button>
                      </td>
                    </tr>);
            }))}
            </tbody>
          </table>
        </div>
      </section>
        </>)}
    </div>);
}
