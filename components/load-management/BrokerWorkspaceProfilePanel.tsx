'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { ChevronDown, Mail, Pencil, Phone, Search, Trash2, X } from 'lucide-react';
import { createApiClient, formatApiError, getApiBaseUrl } from '@/lib/api-client';
import type { LoadRecord } from '@/lib/tms-api';
import { createTmsApi } from '@/lib/tms-api';
import type { CrmCustomerRecord } from '@/components/crm/CustomerProfileDrawer';
interface BrokerWorkspaceProfilePanelProps {
    customer: CrmCustomerRecord;
    loads?: LoadRecord[];
    token: string;
    onClose: () => void;
    onRefresh: () => Promise<void>;
    onCustomerUpdated: (customer: CrmCustomerRecord) => void;
}
const LOADS_PAGE_SIZE = 5;
const BROKER_STATUS_OPTIONS = ['Active', 'Inactive', 'Suspended'] as const;
const BROKER_RATING_OPTIONS = ['Approved', 'Pending', 'Denied'] as const;
type BrokerStatusOption = (typeof BROKER_STATUS_OPTIONS)[number];
type BrokerRatingOption = (typeof BROKER_RATING_OPTIONS)[number];
const sectionLabelClass = 'text-xs font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500';
const contactInputClass = 'w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-1.5 text-sm text-zinc-900 dark:text-white outline-none focus:border-zinc-400 dark:focus:border-zinc-600 transition-colors';
const dropdownTriggerClass = 'w-full flex items-center justify-between text-sm font-bold text-zinc-900 dark:text-white bg-transparent outline-none cursor-pointer disabled:opacity-50';
const dropdownMenuClass = 'absolute left-0 right-0 z-20 mt-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-2xl p-1.5 flex flex-col gap-0.5';
const dropdownOptionClass = 'w-full px-3 py-2 text-left text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors disabled:opacity-50';
function resolveBrokerStatus(status?: string | null): BrokerStatusOption {
    if (status && BROKER_STATUS_OPTIONS.includes(status as BrokerStatusOption)) {
        return status as BrokerStatusOption;
    }
    return 'Active';
}
function resolveBrokerRating(rating?: string | null): BrokerRatingOption {
    if (rating === 'Do Not Use')
        return 'Denied';
    if (rating && BROKER_RATING_OPTIONS.includes(rating as BrokerRatingOption)) {
        return rating as BrokerRatingOption;
    }
    return 'Pending';
}
function resolveLoadLabel(load: LoadRecord): string {
    return load.broker_load_id || `L-${load.id}`;
}
function matchesLoadSearch(load: LoadRecord, query: string): boolean {
    const normalized = query.trim().toLowerCase();
    if (!normalized)
        return true;
    const haystack = [
        resolveLoadLabel(load),
        load.origin,
        load.destination,
        load.status,
    ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
    return haystack.includes(normalized);
}
export default function BrokerWorkspaceProfilePanel({ customer, loads = [], token, onClose, onRefresh, onCustomerUpdated, }: BrokerWorkspaceProfilePanelProps) {
    const api = useMemo(() => createTmsApi(createApiClient(token)), [token]);
    const http = useMemo(() => createApiClient(token), [token]);
    const apiBaseUrl = getApiBaseUrl();
    const [isEditing, setIsEditing] = useState(false);
    const [savingContact, setSavingContact] = useState(false);
    const [updatingStatus, setUpdatingStatus] = useState(false);
    const [updatingRating, setUpdatingRating] = useState(false);
    const [phone, setPhone] = useState(customer.phone || '');
    const [email, setEmail] = useState(customer.email || '');
    const [mc, setMc] = useState(customer.mc || '');
    const [localLoads, setLocalLoads] = useState<LoadRecord[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [loadToDelete, setLoadToDelete] = useState<string | null>(null);
    const [isUnlinking, setIsUnlinking] = useState(false);
    const [isStatusDropdownOpen, setIsStatusDropdownOpen] = useState(false);
    const [isRatingDropdownOpen, setIsRatingDropdownOpen] = useState(false);
    const statusDropdownRef = useRef<HTMLDivElement>(null);
    const ratingDropdownRef = useRef<HTMLDivElement>(null);
    const brokerStatus = resolveBrokerStatus(customer.status);
    const brokerRating = resolveBrokerRating(customer.rating);
    useEffect(() => {
        setLocalLoads(loads.filter((load) => load.customer_id === customer.id));
    }, [loads, customer.id]);
    useEffect(() => {
        setPhone(customer.phone || '');
        setEmail(customer.email || '');
        setMc(customer.mc || '');
        setIsEditing(false);
        setLoadToDelete(null);
        setSearchQuery('');
        setCurrentPage(1);
        setIsStatusDropdownOpen(false);
        setIsRatingDropdownOpen(false);
    }, [customer]);
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (statusDropdownRef.current &&
                !statusDropdownRef.current.contains(event.target as Node)) {
                setIsStatusDropdownOpen(false);
            }
            if (ratingDropdownRef.current &&
                !ratingDropdownRef.current.contains(event.target as Node)) {
                setIsRatingDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);
    useEffect(() => {
        setCurrentPage(1);
    }, [searchQuery, customer.id]);
    const filteredLoads = useMemo(() => {
        const query = searchQuery.trim();
        if (!query)
            return localLoads;
        return localLoads.filter((load) => matchesLoadSearch(load, query));
    }, [searchQuery, localLoads]);
    const totalPages = Math.max(1, Math.ceil(filteredLoads.length / LOADS_PAGE_SIZE));
    const paginatedLoads = useMemo(() => {
        const start = (currentPage - 1) * LOADS_PAGE_SIZE;
        return filteredLoads.slice(start, start + LOADS_PAGE_SIZE);
    }, [filteredLoads, currentPage]);
    useEffect(() => {
        if (currentPage > totalPages) {
            setCurrentPage(totalPages);
        }
    }, [currentPage, totalPages]);
    const handleSaveContact = async () => {
        setSavingContact(true);
        const toastId = toast.loading('Saving contact details...');
        try {
            const payload = {
                name: customer.name,
                phone: phone.slice(0, 14),
                email: email.trim(),
                mc: mc.replace(/\D/g, '').slice(0, 8),
                rating: customer.rating || brokerRating,
                status: customer.status || brokerStatus,
            };
            const response = await http.put(`${apiBaseUrl}/api/customers/${customer.id}`, payload);
            onCustomerUpdated(response.data);
            setIsEditing(false);
            toast.success('Contact details updated successfully', { id: toastId });
        }
        catch (error: unknown) {
            toast.error(formatApiError(error, 'Failed to update contact details'), { id: toastId });
        }
        finally {
            setSavingContact(false);
        }
    };
    const handleStatusChange = async (newStatus: BrokerStatusOption) => {
        if (newStatus === brokerStatus || updatingStatus) {
            setIsStatusDropdownOpen(false);
            return;
        }
        setUpdatingStatus(true);
        setIsStatusDropdownOpen(false);
        try {
            const response = await http.put(`${apiBaseUrl}/api/customers/${customer.id}/status?status=${encodeURIComponent(newStatus)}`);
            onCustomerUpdated(response.data);
            toast.success('Status updated successfully');
        }
        catch (error: unknown) {
            toast.error(formatApiError(error, 'Failed to update status'));
        }
        finally {
            setUpdatingStatus(false);
        }
    };
    const handleRatingChange = async (newRating: BrokerRatingOption) => {
        if (newRating === brokerRating || updatingRating) {
            setIsRatingDropdownOpen(false);
            return;
        }
        setUpdatingRating(true);
        setIsRatingDropdownOpen(false);
        const persistedRating = newRating === 'Denied' ? 'Do Not Use' : newRating;
        try {
            const response = await http.put(`${apiBaseUrl}/api/customers/${customer.id}`, {
                name: customer.name,
                phone: customer.phone ?? '',
                email: customer.email ?? '',
                mc: customer.mc ?? '',
                rating: persistedRating,
                status: customer.status ?? brokerStatus,
            });
            onCustomerUpdated(response.data);
            toast.success('Credit rating updated successfully');
        }
        catch (error: unknown) {
            toast.error(formatApiError(error, 'Failed to update credit rating'));
        }
        finally {
            setUpdatingRating(false);
        }
    };
    const handleConfirmUnlink = async () => {
        if (!loadToDelete || isUnlinking)
            return;
        const loadId = Number(loadToDelete);
        if (!Number.isFinite(loadId)) {
            setLoadToDelete(null);
            return;
        }
        setIsUnlinking(true);
        const toastId = toast.loading('Moving load to Deleted Loads...');
        try {
            await api.loads.remove(loadId);
            setLocalLoads((previous) => previous.filter((load) => load.id !== loadId));
            await onRefresh();
            toast.success('Load unlinked and moved to deleted loads', { id: toastId });
            setLoadToDelete(null);
        }
        catch (error: unknown) {
            toast.error(formatApiError(error, 'Failed to delete load'), { id: toastId });
        }
        finally {
            setIsUnlinking(false);
        }
    };
    return (<>
      <div className="flex flex-col flex-1 min-h-0 w-full animate-in fade-in duration-200" aria-label="Broker profile workspace">
        <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 md:p-6 lg:p-8">
          <div className="mx-auto w-full max-w-[1600px] flex flex-col gap-6">
            <div className="flex items-center justify-between w-full min-h-12 gap-4">
              <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white truncate min-w-0">
                {customer.name}
              </h1>
              <div className="flex items-center gap-3 shrink-0">
                {isEditing ? (<>
                    <button type="button" disabled={savingContact} onClick={() => {
                setPhone(customer.phone || '');
                setEmail(customer.email || '');
                setMc(customer.mc || '');
                setIsEditing(false);
            }} className="px-4 py-2 text-sm font-medium text-zinc-700 bg-zinc-100 hover:bg-zinc-200 dark:text-zinc-300 dark:bg-zinc-800 dark:hover:bg-zinc-700 rounded-lg transition-colors disabled:opacity-50">
                      Cancel
                    </button>
                    <button type="button" disabled={savingContact} onClick={() => void handleSaveContact()} className="px-4 py-2 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors disabled:opacity-50">
                      {savingContact ? 'Saving...' : 'Save'}
                    </button>
                  </>) : (<button type="button" onClick={() => setIsEditing(true)} className="flex items-center gap-2 px-4 py-2 text-sm font-medium border border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 bg-white dark:bg-[#161616] hover:bg-zinc-50 dark:hover:bg-zinc-900 rounded-lg transition-colors">
                    <Pencil size={16} aria-hidden/>
                    Edit
                  </button>)}
                <button type="button" onClick={onClose} className="p-2 text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 rounded-lg transition-colors" aria-label="Close broker profile">
                  <X size={20}/>
                </button>
              </div>
            </div>

            <div className="w-full bg-white dark:bg-[#161616] border border-zinc-200 dark:border-zinc-800 rounded-xl grid grid-cols-1 xl:grid-cols-12 gap-0 divide-y xl:divide-y-0 xl:divide-x divide-zinc-200 dark:divide-zinc-800 overflow-hidden">
              <div className="xl:col-span-5 flex flex-col divide-y divide-zinc-200 dark:divide-zinc-800 p-5 xl:p-6">
                <div className="pb-6">
                  <p className={`${sectionLabelClass} mb-3`}>Broker Overview</p>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800/80 rounded-xl p-4 flex flex-col gap-1 relative">
                      <span className="text-xs text-zinc-500 dark:text-zinc-400">Status</span>
                      <div ref={statusDropdownRef} className="relative">
                        <button type="button" disabled={updatingStatus} onClick={() => {
            setIsRatingDropdownOpen(false);
            setIsStatusDropdownOpen((open) => !open);
        }} className={dropdownTriggerClass} aria-expanded={isStatusDropdownOpen} aria-haspopup="listbox">
                          <span>{brokerStatus}</span>
                          <ChevronDown size={16} className={`shrink-0 text-zinc-500 transition-transform duration-200 ${isStatusDropdownOpen ? 'rotate-180' : ''}`} aria-hidden/>
                        </button>
                        {isStatusDropdownOpen ? (<div className={dropdownMenuClass} role="listbox">
                            {BROKER_STATUS_OPTIONS.map((option) => (<button key={option} type="button" role="option" aria-selected={brokerStatus === option} disabled={updatingStatus} onClick={() => void handleStatusChange(option)} className={dropdownOptionClass}>
                                {option}
                              </button>))}
                          </div>) : null}
                      </div>
                    </div>
                    <div className="bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800/80 rounded-xl p-4 flex flex-col gap-1 relative">
                      <span className="text-xs text-zinc-500 dark:text-zinc-400">Credit Rating</span>
                      <div ref={ratingDropdownRef} className="relative">
                        <button type="button" disabled={updatingRating} onClick={() => {
            setIsStatusDropdownOpen(false);
            setIsRatingDropdownOpen((open) => !open);
        }} className={dropdownTriggerClass} aria-expanded={isRatingDropdownOpen} aria-haspopup="listbox">
                          <span>{brokerRating}</span>
                          <ChevronDown size={16} className={`shrink-0 text-zinc-500 transition-transform duration-200 ${isRatingDropdownOpen ? 'rotate-180' : ''}`} aria-hidden/>
                        </button>
                        {isRatingDropdownOpen ? (<div className={dropdownMenuClass} role="listbox">
                            {BROKER_RATING_OPTIONS.map((option) => (<button key={option} type="button" role="option" aria-selected={brokerRating === option} disabled={updatingRating} onClick={() => void handleRatingChange(option)} className={dropdownOptionClass}>
                                {option}
                              </button>))}
                          </div>) : null}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="py-6 flex flex-col gap-4">
                  <p className={sectionLabelClass}>Contact Details</p>
                  <div className="flex flex-col gap-4">
                    <div className="flex flex-col gap-1.5">
                      <span className="text-xs text-zinc-500 dark:text-zinc-400 flex items-center gap-1.5">
                        <Phone size={14} aria-hidden/>
                        Phone
                      </span>
                      {isEditing ? (<input type="tel" value={phone} onChange={(event) => setPhone(event.target.value)} className={contactInputClass}/>) : (<span className="text-sm font-medium text-zinc-900 dark:text-white">
                          {phone || '—'}
                        </span>)}
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <span className="text-xs text-zinc-500 dark:text-zinc-400 flex items-center gap-1.5">
                        <Mail size={14} aria-hidden/>
                        Email
                      </span>
                      {isEditing ? (<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} className={contactInputClass}/>) : (<span className="text-sm font-medium text-zinc-900 dark:text-white break-all">
                          {email || '—'}
                        </span>)}
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <span className="text-xs text-zinc-500 dark:text-zinc-400">MC Number</span>
                      {isEditing ? (<input type="text" value={mc} onChange={(event) => setMc(event.target.value)} className={contactInputClass}/>) : (<span className="text-sm font-medium text-zinc-900 dark:text-white">
                          {mc || '—'}
                        </span>)}
                    </div>
                  </div>
                </div>
              </div>

              <div className="xl:col-span-7 flex flex-col p-5 xl:p-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 w-full mb-4">
                  <p className={sectionLabelClass}>
                    Associated Loads ({filteredLoads.length})
                  </p>
                  <div className="relative w-full sm:w-60">
                    <Search size={16} className="absolute left-2.5 top-2.5 text-zinc-400 pointer-events-none" aria-hidden/>
                    <input type="search" placeholder="Search Loads..." value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} aria-label="Search associated loads" className="h-9 w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 pl-9 text-sm text-zinc-900 dark:text-white outline-none placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:border-zinc-400 dark:focus:border-zinc-600 transition-colors"/>
                  </div>
                </div>

                <div className="flex flex-col gap-3 min-h-[340px]">
                  {paginatedLoads.length === 0 ? (<div className="flex items-center justify-center h-40 border border-dashed border-zinc-200 dark:border-zinc-800 rounded-xl text-sm text-zinc-400">
                      {searchQuery ? 'No matching loads found' : 'No associated loads'}
                    </div>) : (paginatedLoads.map((load) => (<div key={load.id} className="group relative flex items-center justify-between border border-zinc-200 dark:border-zinc-800/60 bg-zinc-50/50 dark:bg-zinc-900/20 rounded-xl p-4 hover:border-zinc-300 dark:hover:border-zinc-700 transition-all">
                        <div className="flex flex-col gap-1 pr-8 min-w-0">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-sm font-bold text-zinc-900 dark:text-white truncate">
                              {resolveLoadLabel(load)}
                            </span>
                            <span className="text-[10px] font-medium uppercase tracking-wider px-2 py-0.5 bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 rounded-md shrink-0">
                              {load.status}
                            </span>
                          </div>
                          <p className="text-xs text-zinc-500 dark:text-zinc-400 break-words line-clamp-2">
                            {load.origin || '—'} → {load.destination || '—'}
                          </p>
                        </div>
                        <button type="button" onClick={() => setLoadToDelete(String(load.id))} disabled={isUnlinking || loadToDelete != null} className="p-2 text-zinc-400 hover:text-red-500 rounded-lg opacity-100 sm:opacity-0 group-hover:opacity-100 transition-all disabled:opacity-40" aria-label={`Move load ${resolveLoadLabel(load)} to Deleted Loads`}>
                          <Trash2 size={16} aria-hidden/>
                        </button>
                      </div>)))}
                </div>

                {totalPages > 1 ? (<div className="flex items-center justify-end gap-2 mt-4 text-xs">
                    <button type="button" disabled={currentPage === 1} onClick={() => setCurrentPage((page) => page - 1)} className="px-3 py-1.5 border border-zinc-200 dark:border-zinc-800 rounded-md disabled:opacity-40 text-zinc-700 dark:text-zinc-300 bg-white dark:bg-[#161616] hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors">
                      Previous
                    </button>
                    <span className="text-zinc-500 px-1 tabular-nums">
                      Page {currentPage} of {totalPages}
                    </span>
                    <button type="button" disabled={currentPage === totalPages} onClick={() => setCurrentPage((page) => page + 1)} className="px-3 py-1.5 border border-zinc-200 dark:border-zinc-800 rounded-md disabled:opacity-40 text-zinc-700 dark:text-zinc-300 bg-white dark:bg-[#161616] hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors">
                      Next
                    </button>
                  </div>) : null}
              </div>
            </div>
          </div>
        </div>
      </div>

      {loadToDelete ? (<div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" role="presentation" onClick={() => {
                if (!isUnlinking)
                    setLoadToDelete(null);
            }}>
          <div role="dialog" aria-modal="true" aria-labelledby="broker-load-delete-title" aria-describedby="broker-load-delete-description" className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 max-w-sm w-full shadow-2xl flex flex-col gap-4" onClick={(event) => event.stopPropagation()}>
            <div className="flex flex-col gap-1">
              <h2 id="broker-load-delete-title" className="text-base font-bold text-white">
                Move to Deleted Loads?
              </h2>
              <p id="broker-load-delete-description" className="text-xs text-zinc-400">
                Are you sure you want to move this load to your deleted loads section?
              </p>
            </div>
            <div className="flex items-center justify-end gap-3 mt-2">
              <button type="button" disabled={isUnlinking} onClick={() => setLoadToDelete(null)} className="px-3.5 py-2 text-xs font-medium text-zinc-300 bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-colors disabled:opacity-50">
                Cancel
              </button>
              <button type="button" disabled={isUnlinking} onClick={() => void handleConfirmUnlink()} className="px-3.5 py-2 text-xs font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors disabled:opacity-50">
                {isUnlinking ? 'Confirming...' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>) : null}
    </>);
}
