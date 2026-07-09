'use client';
import React, { useState } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { Building2, Loader2, Plus, X } from 'lucide-react';
import type { StagedLoadForm } from '@/lib/load-entry-form';
import { BROKER_UNASSIGNED_LABEL } from '@/lib/load-entry-form';
import { FORM_LABEL_CLASS } from '@/lib/display-labels';
export interface CrmCustomerOption {
    id: number;
    name: string;
    mc?: string;
    phone?: string;
    email?: string;
    rating?: string;
    status?: string;
}
export interface TeamDispatcherOption {
    id: number;
    display_name: string;
}
interface QuickAddCustomerDraft {
    name: string;
    mc: string;
    phone: string;
    email: string;
}
const selectClass = 'w-full border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white p-2 rounded-lg text-sm font-semibold outline-none focus:ring-2 focus:ring-zinc-600 transition-colors';
const quickAddFieldClass = 'w-full border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 text-zinc-900 dark:text-white p-2 rounded-lg text-sm font-semibold outline-none focus:border-zinc-700 transition-colors';
const emptyQuickAddDraft = (): QuickAddCustomerDraft => ({
    name: '',
    mc: '',
    phone: '',
    email: '',
});
interface LoadCrmBrokerLinkProps {
    customers: CrmCustomerOption[];
    onCustomersChange: (customers: CrmCustomerOption[]) => void;
    stagedLoad: StagedLoadForm | null;
    setStagedLoad: React.Dispatch<React.SetStateAction<StagedLoadForm | null>>;
    apiUrl: string;
    disabled?: boolean;
}
export function LoadCrmBrokerLink({ customers, onCustomersChange, stagedLoad, setStagedLoad, apiUrl, disabled = false, }: LoadCrmBrokerLinkProps) {
    const [quickAddOpen, setQuickAddOpen] = useState(false);
    const [quickAddDraft, setQuickAddDraft] = useState<QuickAddCustomerDraft>(emptyQuickAddDraft);
    const [savingCustomer, setSavingCustomer] = useState(false);
    const closeQuickAdd = () => {
        setQuickAddOpen(false);
        setQuickAddDraft(emptyQuickAddDraft());
    };
    const handleQuickAddSubmit = async () => {
        const name = quickAddDraft.name.trim();
        if (!name) {
            toast.error('Company name is required.');
            return;
        }
        const payload = {
            name,
            mc: quickAddDraft.mc.replace(/\D/g, '').slice(0, 8),
            phone: quickAddDraft.phone.slice(0, 14),
            email: quickAddDraft.email.trim(),
            rating: 'Pending',
        };
        setSavingCustomer(true);
        const toastId = toast.loading('Creating broker profile...');
        try {
            const res = await axios.post<CrmCustomerOption>(`${apiUrl}/api/customers`, payload);
            const created = res.data;
            onCustomersChange([created, ...customers]);
            if (stagedLoad) {
                setStagedLoad({
                    ...stagedLoad,
                    customer_id: created.id,
                    broker_name: created.name,
                    broker_email: created.email || stagedLoad.broker_email,
                    broker_phone: created.phone || stagedLoad.broker_phone,
                });
            }
            closeQuickAdd();
            toast.success('Broker added and linked to this load.', { id: toastId });
        }
        catch (err: unknown) {
            const detail = axios.isAxiosError(err) && typeof err.response?.data?.detail === 'string'
                ? err.response.data.detail
                : 'Failed to create broker profile.';
            toast.error(detail, { id: toastId });
        }
        finally {
            setSavingCustomer(false);
        }
    };
    return (<>
      <div className="mb-4 bg-zinc-100 dark:bg-zinc-900/60 p-3 rounded-lg border border-zinc-200 dark:border-zinc-800/50">
        <label className={`${FORM_LABEL_CLASS} text-zinc-700 dark:text-zinc-300 mb-2 flex items-center gap-2`}>
          <Building2 size={14} aria-hidden/>
          Link to CRM Broker
        </label>
        <div className="flex items-end gap-2 w-full">
          <select className={`${selectClass} flex-1 min-w-0`} value={stagedLoad?.customer_id || ''} disabled={disabled} onChange={(e) => {
            const selectedId = parseInt(e.target.value, 10);
            const selectedCust = customers.find((c) => c.id === selectedId);
            if (stagedLoad && selectedCust) {
                setStagedLoad({
                    ...stagedLoad,
                    customer_id: selectedCust.id,
                    broker_name: selectedCust.name,
                    broker_email: selectedCust.email || stagedLoad.broker_email,
                    broker_phone: selectedCust.phone || stagedLoad.broker_phone,
                });
            }
            else if (stagedLoad) {
                setStagedLoad({
                    ...stagedLoad,
                    customer_id: null,
                    broker_name: BROKER_UNASSIGNED_LABEL,
                });
            }
        }}>
            <option value="">-- No CRM Link (Manual Entry) --</option>
            {customers.map((customer) => (<option key={customer.id} value={customer.id}>
                {customer.name} (MC: {customer.mc})
              </option>))}
          </select>
          <button type="button" disabled={disabled} onClick={() => setQuickAddOpen(true)} className="shrink-0 flex h-[38px] w-[38px] items-center justify-center rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors" aria-label="Quick add CRM broker">
            <Plus size={18} aria-hidden/>
          </button>
        </div>
      </div>

      {quickAddOpen && (<div className="fixed inset-0 z-[90] flex items-end md:items-center justify-center bg-zinc-900/60 dark:bg-[#0B0B0B]/80 backdrop-blur-sm p-0 md:p-4">
          <div className="bg-white dark:bg-[#161616] rounded-t-xl md:rounded-2xl w-full max-w-full md:max-w-md border border-zinc-200 dark:border-zinc-800 shadow-xl max-h-[calc(100svh-1rem)] flex flex-col overflow-hidden">
            <div className="shrink-0 px-6 pt-6 pb-4 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between gap-3">
              <h3 className="text-lg font-bold text-zinc-900 dark:text-white">Quick Add Broker</h3>
              <button type="button" onClick={closeQuickAdd} className="p-2 text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-700 dark:hover:text-zinc-300 rounded-full transition-colors" aria-label="Close">
                <X size={18} aria-hidden/>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
              <div>
                <label className={FORM_LABEL_CLASS}>
                  Company Name
                </label>
                <input type="text" value={quickAddDraft.name} onChange={(e) => setQuickAddDraft({ ...quickAddDraft, name: e.target.value })} className={quickAddFieldClass} autoFocus/>
              </div>
              <div>
                <label className={FORM_LABEL_CLASS}>
                  MC Number
                </label>
                <input type="text" inputMode="numeric" maxLength={8} value={quickAddDraft.mc} onChange={(e) => setQuickAddDraft({
                ...quickAddDraft,
                mc: e.target.value.replace(/\D/g, '').slice(0, 8),
            })} className={quickAddFieldClass}/>
              </div>
              <div>
                <label className={FORM_LABEL_CLASS}>
                  Contact Phone
                </label>
                <input type="tel" maxLength={14} value={quickAddDraft.phone} onChange={(e) => setQuickAddDraft({
                ...quickAddDraft,
                phone: e.target.value.slice(0, 14),
            })} className={quickAddFieldClass}/>
              </div>
              <div>
                <label className={FORM_LABEL_CLASS}>
                  Billing Email
                </label>
                <input type="email" value={quickAddDraft.email} onChange={(e) => setQuickAddDraft({ ...quickAddDraft, email: e.target.value })} className={quickAddFieldClass}/>
              </div>
            </div>
            <div className="shrink-0 flex flex-col-reverse sm:flex-row gap-2 justify-end px-6 py-4 border-t border-zinc-100 dark:border-zinc-800">
              <button type="button" onClick={closeQuickAdd} disabled={savingCustomer} className="w-full sm:w-auto px-4 py-2 text-sm font-bold text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg disabled:opacity-50 transition-colors">
                Cancel
              </button>
              <button type="button" onClick={() => void handleQuickAddSubmit()} disabled={savingCustomer} className="w-full sm:w-auto px-4 py-2 text-sm font-bold bg-zinc-900 dark:bg-white dark:text-black text-white rounded-lg hover:bg-zinc-800 dark:hover:bg-zinc-200 disabled:opacity-50 transition-colors inline-flex items-center justify-center gap-2">
                {savingCustomer ? (<>
                    <Loader2 size={16} className="animate-spin" aria-hidden/>
                    Saving...
                  </>) : ('Save & Select')}
              </button>
            </div>
          </div>
        </div>)}
    </>);
}
export interface StagedLoadDispatcherFields {
    dispatcher_id?: number | string;
}
interface LoadDispatcherCommissionFieldsProps {
    stagedLoad: StagedLoadDispatcherFields | null;
    setStagedLoad: React.Dispatch<React.SetStateAction<StagedLoadDispatcherFields | null>>;
    teamDispatchers: TeamDispatcherOption[];
    currentUserId: number | null;
}
export function LoadDispatcherCommissionFields({ stagedLoad, setStagedLoad, teamDispatchers, currentUserId, }: LoadDispatcherCommissionFieldsProps) {
    return (<div>
      <label className={FORM_LABEL_CLASS}>
        Booking Dispatcher
      </label>
      <select className="w-full border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white p-2 rounded-lg text-sm focus:ring-1 focus:ring-zinc-600 outline-none font-medium transition-colors" value={stagedLoad?.dispatcher_id || ''} onChange={(e) => {
            if (!stagedLoad)
                return;
            const value = e.target.value;
            setStagedLoad({
                ...stagedLoad,
                dispatcher_id: value ? parseInt(value, 10) : '',
            });
        }}>
        {teamDispatchers.length === 0 ? (<option value={currentUserId || ''}>
            {currentUserId ? 'Current User (You)' : 'Loading dispatchers...'}
          </option>) : (teamDispatchers.map((dispatcher) => (<option key={dispatcher.id} value={dispatcher.id}>
              {dispatcher.display_name}
              {dispatcher.id === currentUserId ? ' (You)' : ''}
            </option>)))}
      </select>
    </div>);
}
