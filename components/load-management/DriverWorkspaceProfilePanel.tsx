'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { AlertTriangle, ChevronDown, Loader2, Pencil, Receipt, Search, Trash2, X } from 'lucide-react';
import { createApiClient, formatApiError } from '@/lib/api-client';
import ProfileEntityLink from '@/components/entity-detail/ProfileEntityLink';
import { createTmsApi, type DriverProfile, type DriverProfileLoad, type TruckRecord, } from '@/lib/tms-api';
interface DriverWorkspaceProfilePanelProps {
    driverId: number;
    token: string;
    trucks?: TruckRecord[];
    onClose: () => void;
    onRefresh: () => Promise<void>;
    onOpenTruck?: (truckId: number) => void;
    onOpenTrailer?: (truckId: number) => void;
    onRemoveLoad?: (loadId: string) => void;
}
const LOADS_PAGE_SIZE = 8;
const PHONE_MAX_LENGTH = 10;
const DRIVER_STATUS_OPTIONS = ['AVAILABLE', 'ASSIGNED', 'INACTIVE'] as const;
const DRIVER_TYPE_OPTIONS = ['Company Driver', 'Owner Operator'] as const;
type DriverStatusOption = (typeof DRIVER_STATUS_OPTIONS)[number];
type DriverTypeOption = (typeof DRIVER_TYPE_OPTIONS)[number];
interface MetadataDraft {
    cdl_number: string;
    cdl_expiration_date: string;
    phone_number: string;
    email: string;
    medical_card_expiration_date: string;
    twic_expiration_date: string;
    pay_percentage: string;
    driver_type: DriverTypeOption;
}
const sectionTitleClass = 'text-sm font-semibold text-zinc-900 dark:text-zinc-100';
const fieldLabelClass = 'text-xs font-medium text-zinc-700 dark:text-zinc-300';
const fieldValueClass = 'text-sm font-medium text-zinc-900 dark:text-white';
const inputClass = 'w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-1.5 text-sm text-zinc-900 dark:text-white outline-none focus:border-zinc-400 dark:focus:border-zinc-600 transition-colors';
const commentsInputClass = 'w-full bg-transparent border-0 resize-none rounded-lg p-0 text-sm text-zinc-900 dark:text-zinc-100 focus:ring-0 placeholder-zinc-400 focus:outline-none transition-shadow min-h-[80px]';
const dropdownTriggerClass = 'w-full flex items-center justify-between text-sm font-bold text-zinc-900 dark:text-white bg-transparent outline-none cursor-pointer disabled:opacity-50';
const dropdownMenuClass = 'absolute left-0 right-0 z-20 mt-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-2xl p-1.5 flex flex-col gap-0.5';
const dropdownOptionClass = 'w-full px-3 py-2 text-left text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors disabled:opacity-50';
const WORKSPACE_LOAD_CARD_CLASS = 'bg-zinc-500/5 dark:bg-zinc-900/30 border border-zinc-200/80 dark:border-zinc-800/50 rounded-xl p-4 flex items-center justify-between hover:border-zinc-300 dark:hover:border-zinc-700/80 transition-all shrink-0 w-full';
const WORKSPACE_LOAD_ID_CLASS = 'text-zinc-900 dark:text-zinc-100 font-medium text-sm';
const WORKSPACE_LOAD_ROUTE_CLASS = 'text-zinc-500 dark:text-zinc-400 text-xs';
const WORKSPACE_LOAD_PAYOUT_CLASS = 'text-emerald-600 dark:text-emerald-500 font-semibold text-right';
function formatLoadStatus(status: string): string {
    return status
        .trim()
        .toLowerCase()
        .replace(/_/g, ' ')
        .replace(/\b\w/g, (char) => char.toUpperCase());
}
function toDateInputValue(value?: string | null): string {
    if (!value)
        return '';
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime()))
        return value.slice(0, 10);
    return parsed.toISOString().slice(0, 10);
}
function sanitizePhoneNumber(value: string): string {
    return value.replace(/\D/g, '').slice(0, PHONE_MAX_LENGTH);
}
function buildMetadataDraft(profile: DriverProfile): MetadataDraft {
    return {
        cdl_number: profile.cdl_number || '',
        cdl_expiration_date: toDateInputValue(profile.cdl_expiration_date),
        phone_number: sanitizePhoneNumber(profile.phone_number || ''),
        email: profile.email || '',
        medical_card_expiration_date: toDateInputValue(profile.medical_card_expiration_date),
        twic_expiration_date: toDateInputValue(profile.twic_expiration_date),
        pay_percentage: profile.pay_percentage != null ? String(profile.pay_percentage) : '',
        driver_type: profile.driver_type === 'Owner Operator' ? 'Owner Operator' : 'Company Driver',
    };
}
function formatCurrency(value: number): string {
    return value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function formatMacroCurrency(value: number): string {
    return value.toLocaleString(undefined, { maximumFractionDigits: 0 });
}
function formatDisplayDate(value?: string | null): string {
    if (!value)
        return '—';
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime()))
        return value;
    return parsed.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });
}
function resolveDriverStatus(status?: string | null): DriverStatusOption {
    if (status && DRIVER_STATUS_OPTIONS.includes(status as DriverStatusOption)) {
        return status as DriverStatusOption;
    }
    return 'AVAILABLE';
}
function resolveDriverStatusHeaderBadgeClass(status: DriverStatusOption): string {
    const base = 'inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider select-none';
    switch (status) {
        case 'ASSIGNED':
            return `${base} bg-blue-50 text-blue-700 border border-blue-200/80 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-900/40`;
        case 'INACTIVE':
            return `${base} bg-zinc-100 text-zinc-600 border border-zinc-200/80 dark:bg-zinc-900/40 dark:text-zinc-400 dark:border-zinc-800/40`;
        default:
            return `${base} bg-emerald-50 text-emerald-700 border border-emerald-200/80 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-900/40`;
    }
}
function resolveDriverStatusSurfaceClass(status: DriverStatusOption): string {
    switch (status) {
        case 'ASSIGNED':
            return 'bg-blue-50 text-blue-700 border border-blue-200/60 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-900/30';
        case 'INACTIVE':
            return 'bg-zinc-100 text-zinc-600 border border-zinc-200/60 dark:bg-zinc-900/40 dark:text-zinc-400 dark:border-zinc-800/30';
        default:
            return 'bg-emerald-50 text-emerald-700 border border-emerald-200/60 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-900/30';
    }
}
function matchesLoadSearch(load: DriverProfileLoad, query: string): boolean {
    const normalized = query.trim().toLowerCase();
    if (!normalized)
        return true;
    const haystack = [
        load.broker_load_id || `L-${load.id}`,
        load.origin,
        load.destination,
        load.status,
    ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
    return haystack.includes(normalized);
}
function resolveLoadLabel(load: DriverProfileLoad): string {
    return load.broker_load_id || `L-${load.id}`;
}
export default function DriverWorkspaceProfilePanel({ driverId, token, trucks = [], onClose, onRefresh, onOpenTruck, onOpenTrailer, onRemoveLoad, }: DriverWorkspaceProfilePanelProps) {
    const api = useMemo(() => createTmsApi(createApiClient(token)), [token]);
    const [profile, setProfile] = useState<DriverProfile | null>(null);
    const [loading, setLoading] = useState(true);
    const [isEditing, setIsEditing] = useState(false);
    const [saving, setSaving] = useState(false);
    const [updatingStatus, setUpdatingStatus] = useState(false);
    const [updatingType, setUpdatingType] = useState(false);
    const [savingComments, setSavingComments] = useState(false);
    const [draft, setDraft] = useState<MetadataDraft | null>(null);
    const [commentsValue, setCommentsValue] = useState('');
    const [savedComments, setSavedComments] = useState('');
    const [isStatusDropdownOpen, setIsStatusDropdownOpen] = useState(false);
    const [isTypeDropdownOpen, setIsTypeDropdownOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [assignedLoads, setAssignedLoads] = useState<DriverProfileLoad[]>([]);
    const statusDropdownRef = useRef<HTMLDivElement>(null);
    const typeDropdownRef = useRef<HTMLDivElement>(null);
    const loadProfile = useCallback(async () => {
        setLoading(true);
        try {
            const data = await api.fleet.driverProfile(driverId);
            setProfile(data);
            setDraft(buildMetadataDraft(data));
            const nextComments = data.comments || '';
            setCommentsValue(nextComments);
            setSavedComments(nextComments);
        }
        catch (error: unknown) {
            toast.error(formatApiError(error, 'Failed to load driver profile'));
            onClose();
        }
        finally {
            setLoading(false);
        }
    }, [api, driverId, onClose]);
    useEffect(() => {
        setIsEditing(false);
        setSearchQuery('');
        setCurrentPage(1);
        setIsStatusDropdownOpen(false);
        setIsTypeDropdownOpen(false);
        void loadProfile();
    }, [driverId, loadProfile]);
    useEffect(() => {
        setCurrentPage(1);
    }, [searchQuery, driverId]);
    useEffect(() => {
        if (profile && !isEditing) {
            setAssignedLoads(profile.loads);
        }
    }, [profile, isEditing]);
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (statusDropdownRef.current &&
                !statusDropdownRef.current.contains(event.target as Node)) {
                setIsStatusDropdownOpen(false);
            }
            if (typeDropdownRef.current && !typeDropdownRef.current.contains(event.target as Node)) {
                setIsTypeDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);
    const assignedTruck = useMemo(() => {
        if (!profile)
            return null;
        return trucks.find((t) => t.driver_id === profile.id || t.co_driver_id === profile.id) ?? null;
    }, [trucks, profile]);
    const assignedTruckNumber = assignedTruck?.truck_number || profile?.truck_number || null;
    const assignedTrailerNumber = assignedTruck?.trailer_number && assignedTruck.trailer_number !== 'N/A'
        ? assignedTruck.trailer_number
        : profile?.trailer_number && profile.trailer_number !== 'N/A'
            ? profile.trailer_number
            : null;
    const assignedTrailerRecord = useMemo(() => {
        if (!assignedTrailerNumber)
            return null;
        const normalized = assignedTrailerNumber.trim().toLowerCase();
        return (trucks.find((unit) => {
            const assetType = (unit.asset_type || 'truck').toLowerCase();
            if (assetType !== 'standalone_trailer')
                return false;
            return String(unit.trailer_number || '').trim().toLowerCase() === normalized;
        }) ?? null);
    }, [trucks, assignedTrailerNumber]);
    const filteredLoads = useMemo(() => {
        const query = searchQuery.trim();
        if (!query)
            return assignedLoads;
        return assignedLoads.filter((load) => matchesLoadSearch(load, query));
    }, [assignedLoads, searchQuery]);
    const handleRemoveLoad = (loadId: string) => {
        setAssignedLoads((prev) => prev.filter((item) => String(item.id) !== loadId));
        onRemoveLoad?.(loadId);
    };
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
    const handleStatusChange = async (nextStatus: DriverStatusOption) => {
        if (!profile || profile.status === nextStatus) {
            setIsStatusDropdownOpen(false);
            return;
        }
        setUpdatingStatus(true);
        setIsStatusDropdownOpen(false);
        const toastId = toast.loading('Updating status...');
        try {
            await api.fleet.updateDriverStatus(driverId, nextStatus);
            setProfile((current) => (current ? { ...current, status: nextStatus } : current));
            await onRefresh();
            toast.success('Status updated', { id: toastId });
        }
        catch (error: unknown) {
            toast.error(formatApiError(error, 'Failed to update status'), { id: toastId });
        }
        finally {
            setUpdatingStatus(false);
        }
    };
    const handleDriverTypeChange = async (nextType: DriverTypeOption) => {
        if (!profile || !draft || draft.driver_type === nextType) {
            setIsTypeDropdownOpen(false);
            return;
        }
        setUpdatingType(true);
        setIsTypeDropdownOpen(false);
        const toastId = toast.loading('Updating driver type...');
        try {
            await api.fleet.updateDriver(driverId, { driver_type: nextType });
            setDraft((current) => (current ? { ...current, driver_type: nextType } : current));
            setProfile((current) => (current ? { ...current, driver_type: nextType } : current));
            await onRefresh();
            toast.success('Driver type updated', { id: toastId });
        }
        catch (error: unknown) {
            toast.error(formatApiError(error, 'Failed to update driver type'), { id: toastId });
        }
        finally {
            setUpdatingType(false);
        }
    };
    const handleCommentsBlur = async () => {
        const trimmed = commentsValue.trim();
        const normalizedSaved = savedComments.trim();
        if (trimmed === normalizedSaved || savingComments)
            return;
        setSavingComments(true);
        try {
            await api.fleet.updateDriverComments(driverId, trimmed);
            setSavedComments(trimmed);
            setCommentsValue(trimmed);
            setProfile((current) => (current ? { ...current, comments: trimmed || null } : current));
        }
        catch (error: unknown) {
            setCommentsValue(savedComments);
            toast.error(formatApiError(error, 'Failed to save comments'));
        }
        finally {
            setSavingComments(false);
        }
    };
    const handleSave = async () => {
        if (!profile || !draft)
            return;
        const payParsed = draft.pay_percentage.replace(/[^\d.]/g, '');
        const payValue = payParsed ? parseFloat(payParsed) : profile.pay_percentage;
        if (!Number.isFinite(payValue) || payValue < 0 || payValue > 100) {
            toast.error('Pay % must be between 0 and 100');
            return;
        }
        const removedLoadIds = profile.loads
            .filter((load) => !assignedLoads.some((item) => item.id === load.id))
            .map((load) => load.id);
        setSaving(true);
        const toastId = toast.loading('Saving profile...');
        try {
            if (removedLoadIds.length > 0) {
                await Promise.all(removedLoadIds.map((loadId) => api.loads.patch(loadId, { truck_id: null })));
            }
            await api.fleet.updateDriver(driverId, {
                cdl_number: draft.cdl_number.trim() || null,
                cdl_expiration_date: draft.cdl_expiration_date || null,
                phone_number: draft.phone_number.trim() || null,
                email: draft.email.trim() || null,
                medical_card_expiration_date: draft.medical_card_expiration_date || null,
                twic_expiration_date: draft.twic_expiration_date || null,
                pay_percentage: payValue,
            });
            await loadProfile();
            await onRefresh();
            setIsEditing(false);
            toast.success('Profile saved', { id: toastId });
        }
        catch (error: unknown) {
            toast.error(formatApiError(error, 'Failed to save profile'), { id: toastId });
        }
        finally {
            setSaving(false);
        }
    };
    const handleCancelEdit = () => {
        if (profile) {
            setDraft(buildMetadataDraft(profile));
            setAssignedLoads(profile.loads);
        }
        setIsEditing(false);
    };
    if (loading && !profile) {
        return (<div className="flex flex-col items-center justify-center py-24 text-zinc-400 gap-2">
        <Loader2 className="animate-spin" size={28}/>
        <p className="text-sm text-zinc-700 dark:text-zinc-300">Loading driver profile...</p>
      </div>);
    }
    if (!profile || !draft)
        return null;
    const driverStatus = resolveDriverStatus(profile.status);
    return (<div className="flex flex-col flex-1 min-h-0 w-full animate-in fade-in duration-200" aria-label="Driver profile workspace">
      <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 md:p-6 lg:p-8">
        <div className="mx-auto w-full max-w-[1600px] flex flex-col gap-6">
          <div className="flex items-center justify-between w-full min-h-12 gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white truncate">
                {profile.driver_name}
              </h1>
              <span className={`${resolveDriverStatusHeaderBadgeClass(driverStatus)} shrink-0`}>
                {driverStatus}
              </span>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              {isEditing ? (<>
                  <button type="button" disabled={saving} onClick={handleCancelEdit} className="px-4 py-2 text-sm font-medium text-zinc-700 bg-zinc-100 hover:bg-zinc-200 dark:text-zinc-300 dark:bg-zinc-800 dark:hover:bg-zinc-700 rounded-lg transition-colors disabled:opacity-50">
                    Cancel
                  </button>
                  <button type="button" disabled={saving} onClick={() => void handleSave()} className="px-4 py-2 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors disabled:opacity-50">
                    {saving ? 'Saving...' : 'Save'}
                  </button>
                </>) : (<button type="button" onClick={() => {
                if (profile)
                    setAssignedLoads(profile.loads);
                setIsEditing(true);
            }} className="flex items-center gap-2 px-4 py-2 text-sm font-medium border border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 bg-white dark:bg-[#161616] hover:bg-zinc-50 dark:hover:bg-zinc-900 rounded-lg transition-colors">
                  <Pencil size={16} aria-hidden/>
                  Edit
                </button>)}
              <button type="button" onClick={onClose} className="p-2 text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 rounded-lg transition-colors" aria-label="Close driver profile">
                <X size={20}/>
              </button>
            </div>
          </div>

          {profile.expiration_warnings.length > 0 ? (<div className="rounded-xl border border-amber-500/30 bg-amber-950/20 p-4 space-y-2">
              {profile.expiration_warnings.map((warning) => (<p key={warning} className="text-sm text-amber-400 flex items-center gap-2">
                  <AlertTriangle size={14} className="shrink-0"/>
                  {warning}
                </p>))}
            </div>) : null}

          <div className="w-full items-stretch bg-white dark:bg-[#161616] border border-zinc-200 dark:border-zinc-800 rounded-xl grid grid-cols-1 xl:grid-cols-12 gap-0 divide-y xl:divide-y-0 xl:divide-x divide-zinc-200 dark:divide-zinc-800 overflow-hidden">
            <div className="xl:col-span-5 flex flex-col divide-y divide-zinc-200 dark:divide-zinc-800 p-5 xl:p-6">
              <div className="pb-6 first:pt-0">
                <p className={`${sectionTitleClass} mb-3`}>Driver Overview</p>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800/80 rounded-xl p-4 flex flex-col gap-1 relative">
                    <span className={fieldLabelClass}>Status</span>
                    <div ref={statusDropdownRef} className="relative">
                      <button type="button" disabled={updatingStatus} onClick={() => {
            setIsTypeDropdownOpen(false);
            setIsStatusDropdownOpen((open) => !open);
        }} className={`w-full flex items-center justify-between text-sm font-bold outline-none cursor-pointer disabled:opacity-50 rounded-lg px-2.5 py-1.5 transition-colors ${resolveDriverStatusSurfaceClass(driverStatus)}`} aria-expanded={isStatusDropdownOpen} aria-haspopup="listbox">
                        <span>{driverStatus}</span>
                        <ChevronDown size={16} className={`shrink-0 opacity-70 transition-transform duration-200 ${isStatusDropdownOpen ? 'rotate-180' : ''}`} aria-hidden/>
                      </button>
                      {isStatusDropdownOpen ? (<div className={dropdownMenuClass} role="listbox">
                          {DRIVER_STATUS_OPTIONS.map((option) => (<button key={option} type="button" role="option" aria-selected={driverStatus === option} disabled={updatingStatus} onClick={() => void handleStatusChange(option)} className={dropdownOptionClass}>
                              {option}
                            </button>))}
                        </div>) : null}
                    </div>
                  </div>
                  <div className="bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800/80 rounded-xl p-4 flex flex-col gap-1 relative">
                    <span className={fieldLabelClass}>Driver Type</span>
                    <div ref={typeDropdownRef} className="relative">
                      <button type="button" disabled={updatingType} onClick={() => {
            setIsStatusDropdownOpen(false);
            setIsTypeDropdownOpen((open) => !open);
        }} className={dropdownTriggerClass} aria-expanded={isTypeDropdownOpen} aria-haspopup="listbox">
                        <span>{draft.driver_type}</span>
                        <ChevronDown size={16} className={`shrink-0 text-zinc-500 transition-transform duration-200 ${isTypeDropdownOpen ? 'rotate-180' : ''}`} aria-hidden/>
                      </button>
                      {isTypeDropdownOpen ? (<div className={dropdownMenuClass} role="listbox">
                          {DRIVER_TYPE_OPTIONS.map((option) => (<button key={option} type="button" role="option" aria-selected={draft.driver_type === option} disabled={updatingType} onClick={() => void handleDriverTypeChange(option)} className={dropdownOptionClass}>
                              {option}
                            </button>))}
                        </div>) : null}
                    </div>
                  </div>
                </div>
              </div>

              <div className="py-6">
                <p className={`${sectionTitleClass} mb-4`}>Profile Metadata</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
                  {([
            ['CDL', 'cdl_number', 'text'],
            ['CDL Expiration', 'cdl_expiration_date', 'date'],
            ['Phone', 'phone_number', 'tel'],
            ['Email', 'email', 'email'],
            ['Medical Card Exp', 'medical_card_expiration_date', 'date'],
            ['TWIC Card Exp', 'twic_expiration_date', 'date'],
            ['Pay %', 'pay_percentage', 'text'],
        ] as const).map(([label, key, inputType]) => (<div key={key} className="min-w-0">
                      <span className={`${fieldLabelClass} block mb-1`}>{label}</span>
                      {isEditing ? (<input type={inputType} value={draft[key]} onChange={(event) => {
                    const value = key === 'phone_number'
                        ? sanitizePhoneNumber(event.target.value)
                        : key === 'pay_percentage'
                            ? event.target.value.replace(/[^\d.]/g, '')
                            : event.target.value;
                    setDraft((current) => (current ? { ...current, [key]: value } : current));
                }} className={inputClass} inputMode={key === 'phone_number' ? 'numeric' : undefined} maxLength={key === 'phone_number' ? PHONE_MAX_LENGTH : undefined}/>) : (<span className={`${fieldValueClass} ${key === 'cdl_number' ? 'font-mono' : ''}`}>
                          {key.includes('expiration') || key.includes('date')
                    ? formatDisplayDate(draft[key] || profile[key as keyof DriverProfile] as string)
                    : draft[key] || '—'}
                        </span>)}
                    </div>))}
                  <div className="min-w-0 sm:col-span-2">
                    <span className={`${fieldLabelClass} block mb-1`}>Assigned Assets</span>
                    <div className="flex flex-col gap-1">
                      {assignedTruck && onOpenTruck ? (<ProfileEntityLink label={`Truck #${assignedTruckNumber}`} onClick={() => onOpenTruck(assignedTruck.id)}/>) : (<span className={fieldValueClass}>
                          {assignedTruckNumber ? `Truck #${assignedTruckNumber}` : '—'}
                        </span>)}
                      {assignedTrailerNumber && assignedTrailerRecord && onOpenTrailer ? (<ProfileEntityLink label={`Trailer #${assignedTrailerNumber}`} onClick={() => onOpenTrailer(assignedTrailerRecord.id)}/>) : (<span className={fieldValueClass}>
                          {assignedTrailerNumber ? `Trailer #${assignedTrailerNumber}` : '—'}
                        </span>)}
                    </div>
                  </div>
                </div>
              </div>

              <div className="py-6">
                <p className={`${sectionTitleClass} mb-3 flex items-center gap-1.5`}>
                  <Receipt size={14} aria-hidden/>
                  Lifetime Financials
                </p>
                <div className="grid grid-cols-2 gap-4">
                  <div className="min-w-0 sm:col-span-2">
                    <span className={`${fieldLabelClass} block mb-1`}>Gross Revenue</span>
                    <span className="text-xl font-semibold tracking-tight tabular-nums text-emerald-600 dark:text-emerald-400">
                      ${formatMacroCurrency(profile.financials.lifetime_gross_revenue)}
                    </span>
                  </div>
                  <div>
                    <span className={`${fieldLabelClass} block mb-1`}>Loaded Miles</span>
                    <span className={fieldValueClass}>
                      {profile.financials.lifetime_loaded_miles.toLocaleString()}
                    </span>
                  </div>
                  <div>
                    <span className={`${fieldLabelClass} block mb-1`}>Empty Miles</span>
                    <span className={fieldValueClass}>
                      {profile.financials.lifetime_empty_miles.toLocaleString()}
                    </span>
                  </div>
                  <div>
                    <span className={`${fieldLabelClass} block mb-1`}>Total Loads</span>
                    <span className={fieldValueClass}>{profile.financials.load_count}</span>
                  </div>
                </div>
              </div>

              <div className="pt-6 last:pb-0">
                <p className={`${sectionTitleClass} mb-3`}>Comments</p>
                <textarea value={commentsValue} onChange={(event) => setCommentsValue(event.target.value)} onBlur={() => void handleCommentsBlur()} placeholder="Add comments..." disabled={savingComments} className={commentsInputClass}/>
              </div>
            </div>

            <div className="xl:col-span-7 flex flex-col justify-between h-full min-h-[600px] xl:min-h-full p-5 xl:p-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 w-full shrink-0 mb-6">
                <p className={sectionTitleClass}>
                  Active &amp; Historic Loads ({filteredLoads.length})
                </p>
                <div className="relative w-full sm:w-60">
                  <Search size={16} className="absolute left-2.5 top-2.5 text-zinc-400 pointer-events-none" aria-hidden/>
                  <input type="search" placeholder="Filter loads..." value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} aria-label="Filter driver loads" className="h-9 w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 pl-9 text-sm text-zinc-900 dark:text-white outline-none placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:border-zinc-400 dark:focus:border-zinc-600 transition-colors"/>
                </div>
              </div>

              <div className="flex-1 flex flex-col gap-3 mb-4 min-h-0">
                {assignedLoads.length === 0 ? (<div className="flex-1 flex items-center justify-center border border-dashed border-zinc-200 dark:border-zinc-800 rounded-xl text-sm text-zinc-700 dark:text-zinc-300">
                    No loads assigned to this driver yet.
                  </div>) : filteredLoads.length === 0 ? (<div className="flex-1 flex items-center justify-center border border-dashed border-zinc-200 dark:border-zinc-800 rounded-xl text-sm text-zinc-700 dark:text-zinc-300">
                    No loads match your search.
                  </div>) : (<>
                    {paginatedLoads.map((load) => (<div key={load.id} className={WORKSPACE_LOAD_CARD_CLASS}>
                        <div className="flex flex-col gap-1.5 min-w-0 flex-1 pr-4">
                          <div className="flex items-center gap-2 min-w-0 flex-wrap">
                            <span className={`${WORKSPACE_LOAD_ID_CLASS} truncate`}>
                              {resolveLoadLabel(load)}
                            </span>
                            <span className={`${WORKSPACE_LOAD_ID_CLASS} shrink-0`}>
                              {formatLoadStatus(load.status)}
                            </span>
                          </div>
                          <p className={`${WORKSPACE_LOAD_ROUTE_CLASS} break-words line-clamp-2`}>
                            {load.origin} → {load.destination}
                          </p>
                        </div>
                        <div className="flex items-center shrink-0">
                          <div className="flex flex-col items-end gap-1 min-w-[5.5rem]">
                            <span className={`${WORKSPACE_LOAD_PAYOUT_CLASS} tabular-nums`}>
                              ${formatCurrency(load.gross_pay)}
                            </span>
                            <span className={`${WORKSPACE_LOAD_ROUTE_CLASS} text-right tabular-nums`}>
                              {load.total_miles.toLocaleString()} mi
                            </span>
                          </div>
                          {isEditing ? (<button type="button" onClick={() => handleRemoveLoad(String(load.id))} className="p-1.5 rounded-md text-zinc-400 hover:text-red-500 hover:bg-zinc-100 dark:hover:bg-zinc-800/60 transition-colors shrink-0 ml-4 animate-in fade-in zoom-in-95 duration-150" aria-label={`Remove load ${resolveLoadLabel(load)}`}>
                              <Trash2 className="w-4 h-4" aria-hidden/>
                            </button>) : null}
                        </div>
                      </div>))}
                    {paginatedLoads.length < LOADS_PAGE_SIZE ? (<div className="flex-1 min-h-[48px]" aria-hidden/>) : null}
                  </>)}
              </div>

              {totalPages > 1 ? (<div className="flex items-center justify-end gap-2 text-xs shrink-0 mt-auto">
                  <button type="button" disabled={currentPage === 1} onClick={() => setCurrentPage((page) => page - 1)} className="px-3 py-1.5 border border-zinc-200 dark:border-zinc-800 rounded-md disabled:opacity-40 text-zinc-700 dark:text-zinc-300 bg-white dark:bg-[#161616] hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors">
                    Previous
                  </button>
                  <span className="text-zinc-700 dark:text-zinc-300 px-1 tabular-nums">
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
    </div>);
}
