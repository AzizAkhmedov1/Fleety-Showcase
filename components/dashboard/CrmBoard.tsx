'use client';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent, } from 'react';
import { createPortal } from 'react-dom';
import axios from 'axios';
import { AlertTriangle, Building2, ChevronDown, Mail, MapPin, MoreVertical, Phone, Plus, } from 'lucide-react';
import { useDashboard } from '@/contexts/DashboardContext';
import { customerCreditRatingBadgeClass, formatCorporateName, formatPhoneNumber, } from '@/lib/crm-display';
const CUSTOMER_CREDIT_RATINGS = ['Pending', 'Approved', 'Do Not Use'] as const;
const CUSTOMER_MODAL_FIELD = 'w-full border border-zinc-200 dark:border-zinc-800 p-2.5 rounded-lg mt-1 bg-zinc-50 dark:bg-zinc-900 text-zinc-900 dark:text-white outline-none focus:ring-2 focus:ring-zinc-600';
const CRM_SELECT_FIELD = 'w-full appearance-none border border-zinc-200 dark:border-zinc-800 p-2.5 pr-10 rounded-lg bg-zinc-50 dark:bg-zinc-900 text-zinc-900 dark:text-white outline-none focus:ring-2 focus:ring-zinc-600';
const CRM_MODAL_OVERLAY_CLASS = 'fixed inset-0 z-[100] flex h-screen w-screen items-end justify-center bg-black/40 backdrop-blur-sm p-0 md:items-center md:p-4';
const CRM_ACTION_MENU_ITEM_CLASS = 'w-full flex items-center px-3 py-2 text-left text-sm text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors';
type CrmRowMenu = {
    kind: 'customer';
    id: number;
    status: string;
} | {
    kind: 'facility';
    id: number;
};
export default function CrmBoard() {
    const { customers, facilities, setCustomers, setFacilities, searchQuery } = useDashboard();
    const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
    const [showCustomerModal, setShowCustomerModal] = useState(false);
    const [showFacilityModal, setShowFacilityModal] = useState(false);
    const [rowMenu, setRowMenu] = useState<CrmRowMenu | null>(null);
    const [rowMenuPosition, setRowMenuPosition] = useState<{
        top: number;
        left: number;
    } | null>(null);
    const [menuMounted, setMenuMounted] = useState(false);
    const rowMenuTriggerRef = useRef<HTMLButtonElement | null>(null);
    const rowMenuRef = useRef<HTMLDivElement | null>(null);
    const [newCustomer, setNewCustomer] = useState<any>({
        name: '',
        mc: '',
        phone: '',
        email: '',
        rating: 'Pending',
    });
    const [newFacility, setNewFacility] = useState<any>({
        name: '',
        type: 'General',
        address: '',
        hours: '',
        notes: '',
    });
    useEffect(() => {
        setMenuMounted(true);
    }, []);
    const closeRowMenu = useCallback(() => {
        setRowMenu(null);
        setRowMenuPosition(null);
        rowMenuTriggerRef.current = null;
    }, []);
    const updateRowMenuPosition = useCallback(() => {
        const trigger = rowMenuTriggerRef.current;
        if (!trigger || !rowMenu)
            return;
        const menuWidth = 176;
        const menuHeight = rowMenu.kind === 'customer' ? 132 : 88;
        const rect = trigger.getBoundingClientRect();
        const spaceBelow = window.innerHeight - rect.bottom;
        const opensUp = spaceBelow < menuHeight + 8;
        let top = opensUp ? rect.top - menuHeight - 6 : rect.bottom + 6;
        let left = rect.right - menuWidth;
        left = Math.max(8, Math.min(left, window.innerWidth - menuWidth - 8));
        top = Math.max(8, Math.min(top, window.innerHeight - menuHeight - 8));
        setRowMenuPosition({ top, left });
    }, [rowMenu]);
    useLayoutEffect(() => {
        if (!rowMenu) {
            setRowMenuPosition(null);
            return;
        }
        updateRowMenuPosition();
    }, [rowMenu, updateRowMenuPosition]);
    useEffect(() => {
        if (!rowMenu)
            return;
        const handleReposition = () => updateRowMenuPosition();
        const handlePointerDown = (event: MouseEvent) => {
            const target = event.target as Node;
            if (rowMenuRef.current?.contains(target) || rowMenuTriggerRef.current?.contains(target)) {
                return;
            }
            closeRowMenu();
        };
        const handleEscape = (event: KeyboardEvent) => {
            if (event.key === 'Escape')
                closeRowMenu();
        };
        window.addEventListener('resize', handleReposition);
        window.addEventListener('scroll', handleReposition, true);
        document.addEventListener('mousedown', handlePointerDown);
        document.addEventListener('keydown', handleEscape);
        return () => {
            window.removeEventListener('resize', handleReposition);
            window.removeEventListener('scroll', handleReposition, true);
            document.removeEventListener('mousedown', handlePointerDown);
            document.removeEventListener('keydown', handleEscape);
        };
    }, [rowMenu, updateRowMenuPosition, closeRowMenu]);
    const openRowMenu = (event: ReactMouseEvent<HTMLButtonElement>, menu: CrmRowMenu) => {
        event.stopPropagation();
        rowMenuTriggerRef.current = event.currentTarget;
        setRowMenu((prev) => prev && prev.kind === menu.kind && prev.id === menu.id ? null : menu);
    };
    const resolvedCustomerRating = CUSTOMER_CREDIT_RATINGS.includes(newCustomer.rating)
        ? newCustomer.rating
        : 'Pending';
    const handleSaveCustomer = async () => {
        if (!newCustomer.name?.trim())
            return;
        const payload = {
            ...newCustomer,
            name: newCustomer.name.trim(),
            mc: String(newCustomer.mc || '').replace(/\D/g, '').slice(0, 8),
            phone: String(newCustomer.phone || '').slice(0, 14),
            email: String(newCustomer.email || '').trim(),
            rating: CUSTOMER_CREDIT_RATINGS.includes(newCustomer.rating) ? newCustomer.rating : 'Pending',
        };
        try {
            if (newCustomer.id) {
                const res = await axios.put(`${API_URL}/api/customers/${newCustomer.id}`, payload);
                setCustomers(customers.map((c) => (c.id === newCustomer.id ? res.data : c)));
            }
            else {
                const res = await axios.post(`${API_URL}/api/customers`, payload);
                setCustomers([res.data, ...customers]);
            }
            setNewCustomer({ name: '', mc: '', phone: '', email: '', rating: 'Pending' });
            setShowCustomerModal(false);
        }
        catch {
            return;
        }
    };
    const handleSaveFacility = async () => {
        if (!newFacility.name?.trim())
            return;
        const payload = {
            name: newFacility.name.trim(),
            type: newFacility.type || 'General',
            address: newFacility.address || '',
            hours: (newFacility.hours || '').trim() || null,
            notes: newFacility.notes || '',
        };
        try {
            if (newFacility.id) {
                const res = await axios.put(`${API_URL}/api/facilities/${newFacility.id}`, payload);
                setFacilities(facilities.map((f) => (f.id === newFacility.id ? res.data : f)));
            }
            else {
                const res = await axios.post(`${API_URL}/api/facilities`, payload);
                setFacilities([res.data, ...facilities]);
            }
            setNewFacility({ name: '', type: 'General', address: '', hours: '', notes: '' });
            setShowFacilityModal(false);
        }
        catch {
            return;
        }
    };
    const handleDeleteCustomer = async (id: number) => {
        if (!confirm('Are you sure you want to delete this customer?'))
            return;
        try {
            await axios.delete(`${API_URL}/api/customers/${id}`);
            setCustomers(customers.filter((c) => c.id !== id));
        }
        catch {
            return;
        }
    };
    const handleToggleDNU = async (id: number, currentStatus: string) => {
        const newStatus = currentStatus === 'Active' ? 'DNU' : 'Active';
        try {
            const res = await axios.put(`${API_URL}/api/customers/${id}/status?status=${newStatus}`);
            setCustomers(customers.map((c) => (c.id === id ? res.data : c)));
        }
        catch {
            return;
        }
    };
    const handleDeleteFacility = async (id: number) => {
        if (!confirm('Are you sure you want to delete this facility?'))
            return;
        try {
            await axios.delete(`${API_URL}/api/facilities/${id}`);
            setFacilities(facilities.filter((f) => f.id !== id));
        }
        catch {
            return;
        }
    };
    const filteredCustomers = useMemo(() => {
        const query = searchQuery.trim().toLowerCase();
        if (!query)
            return customers;
        const digitsQuery = query.replace(/\D/g, '');
        return customers.filter((customer) => {
            const name = (customer.name || '').toLowerCase();
            const mc = String(customer.mc || '').toLowerCase();
            const phone = String(customer.phone || '');
            const phoneDigits = phone.replace(/\D/g, '');
            const email = (customer.email || '').toLowerCase();
            return (name.includes(query) ||
                mc.includes(query) ||
                email.includes(query) ||
                phone.toLowerCase().includes(query) ||
                (digitsQuery.length > 0 && phoneDigits.includes(digitsQuery)));
        });
    }, [customers, searchQuery]);
    const filteredFacilities = useMemo(() => {
        const query = searchQuery.trim().toLowerCase();
        if (!query)
            return facilities;
        return facilities.filter((facility) => {
            const name = (facility.name || '').toLowerCase();
            const type = (facility.type || '').toLowerCase();
            const address = (facility.address || '').toLowerCase();
            const notes = (facility.notes || '').toLowerCase();
            return (name.includes(query) ||
                type.includes(query) ||
                address.includes(query) ||
                notes.includes(query));
        });
    }, [facilities, searchQuery]);
    return (<div className="space-y-8 pb-36 animate-in fade-in duration-200">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="bg-white dark:bg-[#161616] p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm flex items-center gap-4 transition-colors">
          <div className="bg-zinc-100 dark:bg-zinc-800 p-4 rounded-xl transition-colors">
            <Building2 className="text-zinc-700 dark:text-zinc-300" size={28}/>
          </div>
          <div>
            <p className="text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">
              Active Brokers
            </p>
            <p className="text-2xl font-black text-zinc-900 dark:text-white">
              {customers.filter((c) => c.status === 'Active').length}
            </p>
          </div>
        </div>
        <div className="bg-white dark:bg-[#161616] p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm flex items-center gap-4 transition-colors">
          <div className="bg-red-50 dark:bg-red-900/30 p-4 rounded-xl transition-colors">
            <AlertTriangle className="text-red-600 dark:text-red-400" size={28}/>
          </div>
          <div>
            <p className="text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">
              DNU (Do Not Use)
            </p>
            <p className="text-2xl font-black text-red-600 dark:text-red-400">
              {customers.filter((c) => c.status === 'DNU').length}
            </p>
          </div>
        </div>
        <div className="bg-white dark:bg-[#161616] p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm flex items-center gap-4 transition-colors">
          <div className="bg-emerald-50 dark:bg-emerald-900/30 p-4 rounded-xl transition-colors">
            <MapPin className="text-emerald-600 dark:text-emerald-400" size={28}/>
          </div>
          <div>
            <p className="text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">
              Saved Facilities
            </p>
            <p className="text-2xl font-black text-zinc-900 dark:text-white">{facilities.length}</p>
          </div>
        </div>
      </div>

      <section className="bg-white dark:bg-[#161616] rounded-2xl shadow-sm border border-zinc-200 dark:border-zinc-800 overflow-hidden transition-colors">
        <div className="p-5 border-b border-zinc-100 dark:border-zinc-800/50 bg-zinc-50/50 dark:bg-zinc-900/50 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 transition-colors">
          <h2 className="font-bold text-lg text-zinc-900 dark:text-white flex items-center gap-2">
            <Building2 className="text-zinc-500" size={20}/> Broker & Customer Directory
          </h2>
          <button type="button" onClick={() => {
            setNewCustomer({ name: '', mc: '', phone: '', email: '', rating: 'Pending' });
            setShowCustomerModal(true);
        }} className="bg-zinc-900 hover:bg-zinc-800 dark:bg-white dark:text-black dark:hover:bg-zinc-200 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 shadow-sm transition-colors shrink-0 self-start sm:self-auto">
            <Plus size={16}/> Add Customer
          </button>
        </div>

        <div className="w-full overflow-x-auto">
          <table className="w-full text-left whitespace-nowrap min-w-[480px] md:min-w-0">
            <thead className="bg-zinc-50 dark:bg-[#161616] text-zinc-500 dark:text-zinc-400 text-xs font-semibold border-b dark:border-zinc-800 transition-colors">
              <tr>
                <th className="p-4">Company Name</th>
                <th className="p-4 hidden md:table-cell">MC Number</th>
                <th className="p-4 hidden md:table-cell">Contact Info</th>
                <th className="p-4 hidden lg:table-cell">Credit Rating</th>
                <th className="p-4">Status</th>
                <th className="p-4 pr-8 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800 text-sm transition-colors">
              {filteredCustomers.map((c) => (<tr key={c.id} className={`hover:bg-zinc-50/50 dark:hover:bg-zinc-800/50 transition-colors ${c.status === 'DNU' ? 'bg-red-50/30 dark:bg-red-900/10' : ''}`}>
                  <td className="p-4 font-bold text-zinc-900 dark:text-white">
                    {formatCorporateName(c.name)}
                  </td>
                  <td className="p-4 font-mono text-zinc-500 dark:text-zinc-400 font-medium hidden md:table-cell">
                    {c.mc}
                  </td>
                  <td className="p-4 hidden md:table-cell">
                    <div className="flex flex-col gap-1">
                      <span className="flex items-center gap-1 text-zinc-700 dark:text-zinc-300 font-medium">
                        <Phone size={12}/> {formatPhoneNumber(c.phone) || '—'}
                      </span>
                      <span className="flex items-center gap-1 text-zinc-500 text-xs">
                        <Mail size={12}/> {c.email}
                      </span>
                    </div>
                  </td>
                  <td className="p-4 hidden lg:table-cell">
                    <span className={`px-2.5 py-1 rounded font-bold text-xs border ${customerCreditRatingBadgeClass(c.rating ?? 'Pending')}`}>
                      {c.rating}
                    </span>
                  </td>
                  <td className="p-4">
                    <span className={`flex items-center gap-1.5 font-bold text-xs ${c.status === 'Active'
                ? 'text-zinc-700 dark:text-zinc-300'
                : 'text-red-600 dark:text-red-400'}`}>
                      <div className={`w-2 h-2 rounded-full ${c.status === 'Active' ? 'bg-emerald-500' : 'bg-red-500'}`}/>
                      {c.status}
                    </span>
                  </td>
                  <td className="p-4 pr-8 text-right">
                    <div className="flex justify-end">
                      <button type="button" aria-label="Customer actions" aria-expanded={rowMenu?.kind === 'customer' && rowMenu.id === c.id} onClick={(event) => openRowMenu(event, {
                kind: 'customer',
                id: c.id,
                status: c.status ?? 'Active',
            })} className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors">
                        <MoreVertical size={16} aria-hidden/>
                      </button>
                    </div>
                  </td>
                </tr>))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="bg-white dark:bg-[#161616] rounded-2xl shadow-sm border border-zinc-200 dark:border-zinc-800 overflow-hidden transition-colors">
        <div className="p-5 border-b border-zinc-100 dark:border-zinc-800/50 bg-zinc-50/50 dark:bg-zinc-900/50 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 transition-colors">
          <h2 className="font-bold text-lg text-zinc-900 dark:text-white flex items-center gap-2">
            <MapPin className="text-emerald-500" size={20}/> Shipper & Receiver Database
          </h2>
          <button type="button" onClick={() => {
            setNewFacility({ name: '', type: 'General', address: '', hours: '', notes: '' });
            setShowFacilityModal(true);
        }} className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 shadow-sm transition-colors shrink-0 self-start sm:self-auto">
            <Plus size={16}/> Add Facility
          </button>
        </div>

        <div className="w-full overflow-x-auto">
          <table className="w-full text-left whitespace-nowrap min-w-[420px] md:min-w-0">
            <thead className="bg-zinc-50 dark:bg-[#161616] text-zinc-500 dark:text-zinc-400 text-xs font-semibold border-b dark:border-zinc-800 transition-colors">
              <tr>
                <th className="p-4">Facility Name</th>
                <th className="p-4 hidden md:table-cell">Type</th>
                <th className="p-4">Address & Hours</th>
                <th className="p-4 hidden lg:table-cell">Facility Notes</th>
                <th className="p-4 pr-8 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800 text-sm transition-colors">
              {filteredFacilities.map((f) => (<tr key={f.id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/50 transition-colors">
                  <td className="p-4 font-bold text-zinc-900 dark:text-white">
                    {formatCorporateName(f.name)}
                  </td>
                  <td className="p-4 hidden md:table-cell">
                    <span className="bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 px-2.5 py-1 rounded font-bold text-xs border border-zinc-200 dark:border-zinc-800">
                      {f.type}
                    </span>
                  </td>
                  <td className="p-4">
                    <div className="flex flex-col gap-1">
                      <span className="font-medium text-zinc-900 dark:text-zinc-200">{f.address}</span>
                      <span className="text-xs text-zinc-500 dark:text-zinc-400">
                        Hours: {f.hours?.trim() || '—'}
                      </span>
                    </div>
                  </td>
                  <td className="p-4 hidden lg:table-cell">
                    <p className="text-zinc-600 dark:text-zinc-400 text-xs max-w-[250px] truncate">
                      {f.notes}
                    </p>
                  </td>
                  <td className="p-4 pr-8 text-right">
                    <div className="flex justify-end">
                      <button type="button" aria-label="Facility actions" aria-expanded={rowMenu?.kind === 'facility' && rowMenu.id === f.id} onClick={(event) => openRowMenu(event, { kind: 'facility', id: f.id })} className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors">
                        <MoreVertical size={16} aria-hidden/>
                      </button>
                    </div>
                  </td>
                </tr>))}
            </tbody>
          </table>
        </div>
      </section>

      {menuMounted && rowMenu && rowMenuPosition
            ? createPortal(<div ref={rowMenuRef} role="menu" className="fixed z-[90] w-44 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-xl p-1 text-sm text-zinc-700 dark:text-zinc-300" style={{ top: rowMenuPosition.top, left: rowMenuPosition.left }}>
              {rowMenu.kind === 'customer' ? (<>
                  <button type="button" role="menuitem" className={CRM_ACTION_MENU_ITEM_CLASS} onClick={() => {
                        const customer = customers.find((entry) => entry.id === rowMenu.id);
                        if (customer) {
                            setNewCustomer(customer);
                            setShowCustomerModal(true);
                        }
                        closeRowMenu();
                    }}>
                    Edit
                  </button>
                  <button type="button" role="menuitem" className={CRM_ACTION_MENU_ITEM_CLASS} onClick={() => {
                        void handleToggleDNU(rowMenu.id, rowMenu.status);
                        closeRowMenu();
                    }}>
                    {rowMenu.status === 'Active' ? 'Mark DNU' : 'Mark Active'}
                  </button>
                  <button type="button" role="menuitem" className={`${CRM_ACTION_MENU_ITEM_CLASS} text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30`} onClick={() => {
                        void handleDeleteCustomer(rowMenu.id);
                        closeRowMenu();
                    }}>
                    Delete
                  </button>
                </>) : (<>
                  <button type="button" role="menuitem" className={CRM_ACTION_MENU_ITEM_CLASS} onClick={() => {
                        const facility = facilities.find((entry) => entry.id === rowMenu.id);
                        if (facility) {
                            setNewFacility(facility);
                            setShowFacilityModal(true);
                        }
                        closeRowMenu();
                    }}>
                    Edit
                  </button>
                  <button type="button" role="menuitem" className={`${CRM_ACTION_MENU_ITEM_CLASS} text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30`} onClick={() => {
                        void handleDeleteFacility(rowMenu.id);
                        closeRowMenu();
                    }}>
                    Delete
                  </button>
                </>)}
            </div>, document.body)
            : null}

      {showCustomerModal && typeof document !== 'undefined'
            ? createPortal(<div className={CRM_MODAL_OVERLAY_CLASS} role="dialog" aria-modal="true" aria-labelledby="add-customer-title">
              <div className="bg-white dark:bg-[#161616] rounded-t-xl md:rounded-2xl w-full max-w-full md:max-w-md border border-zinc-200 dark:border-zinc-800 shadow-xl max-h-[calc(100svh-1rem)] flex flex-col overflow-hidden">
                <div className="shrink-0 px-6 pt-6 pb-4 border-b border-zinc-100 dark:border-zinc-800">
                  <h3 id="add-customer-title" className="text-xl font-bold text-zinc-900 dark:text-white">
                    Add New Customer
                  </h3>
                </div>
                <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
                  <div>
                    <label className="text-xs font-medium text-zinc-400">Company Name</label>
                    <input type="text" value={newCustomer.name || ''} onChange={(e) => setNewCustomer({ ...newCustomer, name: e.target.value })} className={CUSTOMER_MODAL_FIELD}/>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-zinc-400">MC Number</label>
                    <input type="text" inputMode="numeric" pattern="[0-9]*" maxLength={8} value={newCustomer.mc || ''} onChange={(e) => setNewCustomer({
                    ...newCustomer,
                    mc: e.target.value.replace(/\D/g, '').slice(0, 8),
                })} className={CUSTOMER_MODAL_FIELD}/>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-zinc-400">Phone</label>
                    <input type="tel" maxLength={14} value={newCustomer.phone || ''} onChange={(e) => setNewCustomer({
                    ...newCustomer,
                    phone: e.target.value.slice(0, 14),
                })} className={CUSTOMER_MODAL_FIELD}/>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-zinc-400">Email</label>
                    <input type="email" value={newCustomer.email || ''} onChange={(e) => setNewCustomer({ ...newCustomer, email: e.target.value })} className={CUSTOMER_MODAL_FIELD}/>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-zinc-400">Credit Rating</label>
                    <div className="relative w-full mt-1">
                      <select value={resolvedCustomerRating} onChange={(e) => setNewCustomer({ ...newCustomer, rating: e.target.value })} className={CRM_SELECT_FIELD}>
                        {CUSTOMER_CREDIT_RATINGS.map((rating) => (<option key={rating} value={rating}>
                            {rating}
                          </option>))}
                      </select>
                      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 w-4 h-4" aria-hidden/>
                    </div>
                  </div>
                </div>
                <div className="shrink-0 flex flex-col-reverse sm:flex-row gap-2 justify-end px-6 py-4 border-t border-zinc-100 dark:border-zinc-800">
                  <button type="button" onClick={() => setShowCustomerModal(false)} className="w-full sm:w-auto px-4 py-2 text-sm font-bold text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg">
                    Cancel
                  </button>
                  <button type="button" onClick={() => void handleSaveCustomer()} className="w-full sm:w-auto px-4 py-2 text-sm font-bold bg-zinc-900 dark:bg-white dark:text-black text-white rounded-lg hover:bg-zinc-800 dark:hover:bg-zinc-200">
                    Save Customer
                  </button>
                </div>
              </div>
            </div>, document.body)
            : null}

      {showFacilityModal && typeof document !== 'undefined'
            ? createPortal(<div className={CRM_MODAL_OVERLAY_CLASS} role="dialog" aria-modal="true" aria-labelledby="add-facility-title">
              <div className="bg-white dark:bg-[#161616] rounded-t-xl md:rounded-2xl w-full max-w-full md:max-w-md border border-zinc-200 dark:border-zinc-800 shadow-xl max-h-[calc(100svh-1rem)] flex flex-col overflow-hidden">
                <div className="shrink-0 px-6 pt-6 pb-4 border-b border-zinc-100 dark:border-zinc-800">
                  <h3 id="add-facility-title" className="text-xl font-bold text-zinc-900 dark:text-white">
                    Add New Facility
                  </h3>
                </div>
                <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
                  <div>
                    <label className="text-xs font-medium text-zinc-400">Facility Name</label>
                    <input type="text" value={newFacility.name || ''} onChange={(e) => setNewFacility({ ...newFacility, name: e.target.value })} className="w-full border border-zinc-200 dark:border-zinc-800 p-2.5 rounded-lg mt-1 bg-zinc-50 dark:bg-zinc-900 text-zinc-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500"/>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-zinc-400">Type</label>
                    <div className="relative w-full mt-1">
                      <select value={newFacility.type || 'General'} onChange={(e) => setNewFacility({ ...newFacility, type: e.target.value })} className={`${CRM_SELECT_FIELD} focus:ring-emerald-500`}>
                        <option value="General">General</option>
                        <option value="Shipper">Shipper</option>
                        <option value="Receiver">Receiver</option>
                        <option value="Terminal">Terminal</option>
                      </select>
                      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 w-4 h-4" aria-hidden/>
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-zinc-400">Address</label>
                    <input type="text" value={newFacility.address || ''} onChange={(e) => setNewFacility({ ...newFacility, address: e.target.value })} className="w-full border border-zinc-200 dark:border-zinc-800 p-2.5 rounded-lg mt-1 bg-zinc-50 dark:bg-zinc-900 text-zinc-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500"/>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-zinc-400">Hours</label>
                    <input type="text" value={newFacility.hours || ''} onChange={(e) => setNewFacility({ ...newFacility, hours: e.target.value })} className="w-full border border-zinc-200 dark:border-zinc-800 p-2.5 rounded-lg mt-1 bg-zinc-50 dark:bg-zinc-900 text-zinc-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500"/>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-zinc-400">Notes</label>
                    <textarea value={newFacility.notes || ''} onChange={(e) => setNewFacility({ ...newFacility, notes: e.target.value })} className="w-full border border-zinc-200 dark:border-zinc-800 p-2.5 rounded-lg mt-1 bg-zinc-50 dark:bg-zinc-900 text-zinc-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500 min-h-[80px]"/>
                  </div>
                </div>
                <div className="shrink-0 flex flex-col-reverse sm:flex-row gap-2 justify-end px-6 py-4 border-t border-zinc-100 dark:border-zinc-800">
                  <button type="button" onClick={() => setShowFacilityModal(false)} className="w-full sm:w-auto px-4 py-2 text-sm font-bold text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg">
                    Cancel
                  </button>
                  <button type="button" onClick={() => void handleSaveFacility()} className="w-full sm:w-auto px-4 py-2 text-sm font-bold bg-emerald-600 text-white rounded-lg hover:bg-emerald-700">
                    Save Facility
                  </button>
                </div>
              </div>
            </div>, document.body)
            : null}
    </div>);
}
