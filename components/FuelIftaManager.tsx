'use client';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import toast from 'react-hot-toast';
import { Activity, DollarSign, Droplet, FileText, Loader2, Save, UploadCloud, } from 'lucide-react';
import { createApiClient, getApiBaseUrl, hasValidTmsToken, normalizeBearerToken } from '@/lib/api-client';
import { createTmsApi, type FuelEntryRecord, type IftaSummary, type LedgerLine } from '@/lib/tms-api';
import { US_STATES } from '@/lib/us-states';
import FuelIfta from '@/components/FuelIfta';
interface Driver {
    id: number;
    driver_name: string;
}
interface FleetTruck {
    id: number;
    truck_number: string;
    driver_id?: number | null;
}
interface FuelIftaManagerProps {
    trucks: FleetTruck[];
    drivers: Driver[];
    token: string | null;
    fuelHistory: FuelEntryRecord[];
    iftaData: IftaSummary;
    refreshFuel: () => Promise<void>;
}
export default function FuelIftaManager({ trucks, drivers, token, fuelHistory, iftaData, refreshFuel, }: FuelIftaManagerProps) {
    const API_URL = getApiBaseUrl();
    const bearerToken = normalizeBearerToken(token);
    const api = useMemo(() => createTmsApi(createApiClient(bearerToken || null)), [bearerToken]);
    const fuelFileInputRef = useRef<HTMLInputElement>(null);
    const [fuelForm, setFuelForm] = useState({ truck_id: '', state: 'PA', gallons: '', total_cost: '' });
    const [pendingFuelFile, setPendingFuelFile] = useState<File | null>(null);
    const [receiptPreview, setReceiptPreview] = useState<string | null>(null);
    const [fuelParsing, setFuelParsing] = useState(false);
    const [ledgerLines, setLedgerLines] = useState<LedgerLine[]>([]);
    const [ledgerLoading, setLedgerLoading] = useState(false);
    const iftaLedgerLines = useMemo(() => ledgerLines.filter((line) => line.transaction_type === 'expense'), [ledgerLines]);
    const refreshLedger = useCallback(async () => {
        if (!hasValidTmsToken(bearerToken))
            return;
        setLedgerLoading(true);
        try {
            const res = await api.accounting.ledger({});
            setLedgerLines(res.lines || []);
        }
        catch {
            setLedgerLines([]);
        }
        finally {
            setLedgerLoading(false);
        }
    }, [api, bearerToken]);
    useEffect(() => {
        if (hasValidTmsToken(bearerToken)) {
            void refreshLedger();
        }
    }, [bearerToken, refreshLedger]);
    useEffect(() => {
        return () => {
            if (receiptPreview)
                URL.revokeObjectURL(receiptPreview);
        };
    }, [receiptPreview]);
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
    const clearReceiptFile = () => {
        if (receiptPreview)
            URL.revokeObjectURL(receiptPreview);
        setReceiptPreview(null);
        setPendingFuelFile(null);
        setFuelParsing(false);
        if (fuelFileInputRef.current)
            fuelFileInputRef.current.value = '';
    };
    const handleLogFuel = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!fuelForm.truck_id) {
            toast.error('Select a unit number.');
            return;
        }
        if (!fuelForm.state) {
            toast.error('State purchased is required.');
            return;
        }
        const gallons = parseFloat(fuelForm.gallons);
        const totalCost = parseFloat(fuelForm.total_cost);
        if (!fuelForm.gallons || Number.isNaN(gallons) || gallons <= 0) {
            toast.error('Enter a valid gallons amount.');
            return;
        }
        if (!fuelForm.total_cost || Number.isNaN(totalCost) || totalCost <= 0) {
            toast.error('Enter a valid total cost.');
            return;
        }
        if (!pendingFuelFile) {
            toast.error('Attach a fuel receipt file before saving.');
            return;
        }
        const payload = {
            truck_id: parseInt(fuelForm.truck_id, 10),
            state: fuelForm.state,
            gallons,
            total_cost: totalCost,
        };
        const toastId = toast.loading('Saving fuel record...');
        try {
            const created = await api.fuel.create(payload);
            await api.fuel.uploadDocument(created.id, pendingFuelFile);
            clearReceiptFile();
            setFuelForm({ truck_id: '', state: 'PA', gallons: '', total_cost: '' });
            await refreshFuel();
            await refreshLedger();
            toast.success('Fuel receipt saved to vault.', { id: toastId });
        }
        catch (err: unknown) {
            const detail = err && typeof err === 'object' && 'response' in err
                ? (err as {
                    response?: {
                        data?: {
                            detail?: string;
                        };
                    };
                }).response?.data?.detail
                : null;
            toast.error(typeof detail === 'string' ? detail : 'Error logging fuel.', { id: toastId });
        }
    };
    const processFuelDocument = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files || e.target.files.length === 0)
            return;
        const selectedFile = e.target.files[0];
        const allowed = ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg'];
        if (!allowed.includes(selectedFile.type) && !selectedFile.name.match(/\.(pdf|png|jpe?g)$/i)) {
            toast.error('Upload a PDF, PNG, or JPG receipt.');
            if (fuelFileInputRef.current)
                fuelFileInputRef.current.value = '';
            return;
        }
        if (receiptPreview)
            URL.revokeObjectURL(receiptPreview);
        setReceiptPreview(URL.createObjectURL(selectedFile));
        setPendingFuelFile(selectedFile);
        setFuelParsing(true);
        try {
            const parsed = await api.fuel.parse(selectedFile);
            setFuelForm((prev) => ({
                ...prev,
                ...(parsed.state && US_STATES.includes(parsed.state.toUpperCase() as (typeof US_STATES)[number])
                    ? { state: parsed.state.toUpperCase() }
                    : {}),
                ...(parsed.gallons != null && parsed.gallons > 0 ? { gallons: String(parsed.gallons) } : {}),
                ...(parsed.total_cost != null && parsed.total_cost > 0
                    ? { total_cost: String(parsed.total_cost) }
                    : {}),
            }));
            const hasValues = parsed.state || parsed.gallons || parsed.total_cost;
            if (hasValues) {
                toast.success('Receipt parsed — review and confirm fields below.');
            }
            else {
                toast('Could not read receipt — enter details manually.', { icon: 'ℹ️' });
            }
        }
        catch {
            toast.error('AI parsing failed — enter details manually.');
        }
        finally {
            setFuelParsing(false);
            if (fuelFileInputRef.current)
                fuelFileInputRef.current.value = '';
        }
    };
    return (<div className="space-y-8 animate-in fade-in duration-200">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white dark:bg-[#161616] p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm flex items-center gap-4 transition-colors">
          <div className="bg-zinc-100 dark:bg-zinc-800 p-4 rounded-xl transition-colors">
            <Droplet className="text-zinc-700 dark:text-zinc-300" size={28}/>
          </div>
          <div>
            <p className="text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">
              Total Gallons (MTD)
            </p>
            <p className="text-2xl font-black text-zinc-900 dark:text-white">
              {iftaData.total_gallons.toFixed(2)} gal
            </p>
          </div>
        </div>
        <div className="bg-white dark:bg-[#161616] p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm flex items-center gap-4 transition-colors">
          <div className="bg-emerald-50 dark:bg-emerald-900/30 p-4 rounded-xl transition-colors">
            <DollarSign className="text-emerald-600 dark:text-emerald-400" size={28}/>
          </div>
          <div>
            <p className="text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">
              Total Fuel Spend (MTD)
            </p>
            <p className="text-2xl font-black text-emerald-700 dark:text-emerald-400">
              ${iftaData.total_fuel_cost.toFixed(2)}
            </p>
          </div>
        </div>
        <div className="bg-white dark:bg-[#161616] p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm flex items-center gap-4 transition-colors">
          <div className="bg-zinc-100 dark:bg-zinc-800 p-4 rounded-xl transition-colors">
            <Activity className="text-zinc-700 dark:text-zinc-300" size={28}/>
          </div>
          <div>
            <p className="text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">
              Fleet Average MPG
            </p>
            <p className="text-2xl font-black text-zinc-900 dark:text-white">{iftaData.fleet_mpg.toFixed(2)}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <section className="lg:col-span-1 bg-white dark:bg-[#161616] rounded-2xl shadow-sm p-6 border border-zinc-200 dark:border-zinc-800 transition-colors">
          <h2 className="text-lg font-bold mb-4 flex items-center gap-2 text-zinc-900 dark:text-white">
            <FileText className="text-zinc-500 dark:text-zinc-300" size={20}/>
            Log Fuel Receipt
          </h2>

          <input type="file" accept=".pdf,.png,.jpg,.jpeg" className="hidden" ref={fuelFileInputRef} onChange={processFuelDocument}/>

          {pendingFuelFile && receiptPreview ? (<div className="mb-6 rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden bg-zinc-50 dark:bg-[#0B0B0B]/50 transition-colors">
              <div className="relative aspect-[4/3] bg-zinc-100 dark:bg-zinc-900">
                {pendingFuelFile.type === 'application/pdf' ? (<iframe src={receiptPreview} title="Fuel receipt preview" className="w-full h-full border-0 bg-white"/>) : (<Image src={receiptPreview} alt="Fuel receipt preview" fill unoptimized sizes="(max-width: 1024px) 100vw, 33vw" className="object-contain"/>)}
                {fuelParsing && (<div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/60 backdrop-blur-[1px]">
                    <Loader2 className="animate-spin text-white" size={28}/>
                    <p className="text-xs font-semibold text-zinc-200">AI parsing...</p>
                  </div>)}
              </div>
              <div className="flex items-center justify-between gap-3 px-3 py-2.5 border-t border-zinc-200 dark:border-zinc-800">
                <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate min-w-0">{pendingFuelFile.name}</p>
                <button type="button" onClick={clearReceiptFile} className="shrink-0 text-xs font-bold text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors">
                  Remove File
                </button>
              </div>
            </div>) : (<div className="mb-6 border-2 border-dashed rounded-xl flex flex-col items-center justify-center p-6 cursor-pointer border-zinc-200 dark:border-zinc-800 hover:border-zinc-500 dark:hover:border-zinc-700 bg-zinc-100/50 dark:bg-[#0B0B0B]/20 transition-colors" onClick={() => fuelFileInputRef.current?.click()}>
              <UploadCloud className="text-zinc-500 dark:text-zinc-300 mb-2" size={24}/>
              <p className="font-semibold text-sm text-zinc-900 dark:text-zinc-400">Attach Receipt</p>
              <p className="text-xs text-zinc-500 dark:text-zinc-300/80">
                PDF, PNG, or JPG — AI will pre-fill fields below
              </p>
            </div>)}

          <form onSubmit={handleLogFuel} className="space-y-4">
            <div>
              <label className="text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase">Unit Number</label>
              <select required className="w-full border border-zinc-200 dark:border-zinc-800 p-2.5 rounded-lg text-sm mt-1 focus:ring-1 focus:ring-zinc-600 outline-none bg-zinc-50 dark:bg-zinc-900 text-zinc-900 dark:text-white transition-colors" value={fuelForm.truck_id} onChange={(e) => setFuelForm({ ...fuelForm, truck_id: e.target.value })}>
                <option value="">-- Select Truck --</option>
                {trucks.map((t) => (<option key={t.id} value={t.id}>
                    #{t.truck_number}
                  </option>))}
              </select>
            </div>
            <div>
              <label className="text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase">State Purchased</label>
              <select required disabled={fuelParsing} className="w-full border border-zinc-200 dark:border-zinc-800 p-2.5 rounded-lg text-sm mt-1 focus:ring-1 focus:ring-zinc-600 outline-none bg-zinc-50 dark:bg-zinc-900 text-zinc-900 dark:text-white transition-colors disabled:opacity-60" value={fuelForm.state} onChange={(e) => setFuelForm({ ...fuelForm, state: e.target.value })}>
                {US_STATES.map((s) => (<option key={s} value={s}>
                    {s}
                  </option>))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase">Gallons</label>
                <input type="number" step="0.01" required disabled={fuelParsing} placeholder={fuelParsing ? 'AI parsing...' : ''} className="w-full border border-zinc-200 dark:border-zinc-800 p-2.5 rounded-lg text-sm mt-1 focus:ring-1 focus:ring-zinc-600 outline-none font-bold bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white transition-colors disabled:opacity-60 placeholder:text-zinc-400 dark:placeholder:text-zinc-500" value={fuelForm.gallons} onChange={(e) => setFuelForm({ ...fuelForm, gallons: e.target.value })}/>
              </div>
              <div>
                <label className="text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase">Total Cost ($)</label>
                <input type="number" step="0.01" required disabled={fuelParsing} placeholder={fuelParsing ? 'AI parsing...' : ''} className="w-full border border-zinc-200 dark:border-zinc-800 p-2.5 rounded-lg text-sm mt-1 focus:ring-1 focus:ring-zinc-600 outline-none font-bold bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white transition-colors disabled:opacity-60 placeholder:text-zinc-400 dark:placeholder:text-zinc-500" value={fuelForm.total_cost} onChange={(e) => setFuelForm({ ...fuelForm, total_cost: e.target.value })}/>
              </div>
            </div>
            <button type="submit" disabled={fuelParsing} className="w-full py-3 flex items-center justify-center gap-2 bg-white text-zinc-950 hover:bg-zinc-100 rounded-xl text-sm font-bold shadow-sm transition-colors duration-200 mt-4 disabled:opacity-50 disabled:cursor-not-allowed">
              {fuelParsing ? <Loader2 size={16} className="animate-spin"/> : <Save size={16}/>}
              Save Fuel Record
            </button>
          </form>
        </section>

        <FuelIfta fuelHistory={fuelHistory}/>
      </div>

      <section className="bg-white dark:bg-[#161616] rounded-2xl shadow-sm border border-zinc-200 dark:border-zinc-800 overflow-hidden transition-colors">
        <div className="p-5 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50 flex justify-between items-center transition-colors">
          <h2 className="font-bold text-base text-zinc-900 dark:text-white">Unified Accounting Ledger</h2>
          <span className="text-xs font-bold bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 px-2 py-1 rounded transition-colors">
            {iftaLedgerLines.length} Transactions
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-zinc-50 dark:bg-[#161616] text-zinc-500 dark:text-zinc-400 text-xs font-bold uppercase tracking-wider border-b dark:border-zinc-800 transition-colors">
              <tr>
                <th className="p-4">Date</th>
                <th className="p-4">Type</th>
                <th className="p-4">Reference</th>
                <th className="p-4">Asset Reference</th>
                <th className="p-4 text-right">Amount</th>
                <th className="p-4 text-right">Document</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800 text-sm transition-colors">
              {ledgerLoading ? (<tr>
                  <td colSpan={6} className="p-8 text-center text-zinc-400 dark:text-zinc-500 animate-pulse">
                    Syncing ledger...
                  </td>
                </tr>) : iftaLedgerLines.length === 0 ? (<tr>
                  <td colSpan={6} className="p-8 text-center text-zinc-400 dark:text-zinc-500">
                    No synced transactions found.
                  </td>
                </tr>) : (iftaLedgerLines.map((line) => {
            const assignedTruck = trucks.find((t) => t.id === line.truck_id);
            const driverLabel = line.driver_name || drivers.find((d) => d.id === line.driver_id)?.driver_name || 'Unassigned';
            const isRevenue = line.transaction_type === 'revenue';
            return (<tr key={line.id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/50 transition-colors">
                      <td className="p-4 text-zinc-500 dark:text-zinc-400">
                        {line.transaction_date ? new Date(line.transaction_date).toLocaleDateString() : '—'}
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
                        <span className="font-semibold">{driverLabel}</span>
                        <span className="text-zinc-400 dark:text-zinc-500"> · </span>
                        <span className="font-mono text-xs">
                          #{line.truck_number || assignedTruck?.truck_number || '—'}
                        </span>
                      </td>
                      <td className={`p-4 text-right font-bold ${isRevenue ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500 dark:text-rose-400'}`}>
                        {line.amount < 0 ? '-' : ''}${Math.abs(line.amount).toFixed(2)}
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
    </div>);
}
