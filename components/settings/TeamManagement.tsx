'use client';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import toast from 'react-hot-toast';
import { Loader2, Pencil, Plus, Users, X } from 'lucide-react';
import { createApiClient, formatApiError, getTmsSessionRoles, hasValidTmsToken, normalizeBearerToken, } from '@/lib/api-client';
import { createTmsApi, type CompanyUserRecord } from '@/lib/tms-api';
import { useTMSStore } from '@/store/useTMSStore';
const EMPLOYEE_ROLES = ['Admin', 'Dispatcher', 'Accounting', 'Driver'] as const;
type EmployeeRole = (typeof EMPLOYEE_ROLES)[number];
const ROLE_BADGE_CLASS: Record<EmployeeRole, string> = {
    Admin: 'bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/25',
    Dispatcher: 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/25',
    Accounting: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/25',
    Driver: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/25',
};
const DEFAULT_DISPATCHER_COMMISSION_RATE = 3;
interface TeamManagementProps {
    token: string | null;
}
function hasDispatcherRole(roles?: string[]): boolean {
    return (roles ?? []).some((role) => role.toLowerCase() === 'dispatcher');
}
function formatCreatedAt(value?: string | null): string {
    if (!value)
        return '—';
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime()))
        return '—';
    return parsed.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
    });
}
function formatCommissionRateForUser(user: CompanyUserRecord): string {
    if (!hasDispatcherRole(user.roles))
        return '—';
    const rate = user.commission_rate ?? 0;
    return `${rate.toFixed(2)}%`;
}
function parseCommissionRateInput(raw: string): number | null {
    const parsed = parseFloat(raw);
    if (Number.isNaN(parsed) || parsed < 0) {
        return null;
    }
    return Math.round(parsed * 100) / 100;
}
export default function TeamManagement({ token }: TeamManagementProps) {
    const bearerToken = normalizeBearerToken(token);
    const isAdmin = useMemo(() => getTmsSessionRoles().some((role) => role.toLowerCase() === 'admin'), []);
    const { companyUsers, companyUsersLoading, fetchCompanyUsers } = useTMSStore();
    const tmsApi = useMemo(() => createTmsApi(createApiClient(bearerToken || null)), [bearerToken]);
    const [modalOpen, setModalOpen] = useState(false);
    const [editUser, setEditUser] = useState<CompanyUserRecord | null>(null);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [selectedRoles, setSelectedRoles] = useState<EmployeeRole[]>(['Dispatcher']);
    const [commissionRate, setCommissionRate] = useState(String(DEFAULT_DISPATCHER_COMMISSION_RATE));
    const [editCommissionRate, setEditCommissionRate] = useState(String(DEFAULT_DISPATCHER_COMMISSION_RATE));
    const [submitting, setSubmitting] = useState(false);
    const [mounted, setMounted] = useState(false);
    const includesDispatcher = selectedRoles.includes('Dispatcher');
    useEffect(() => {
        setMounted(true);
        return () => setMounted(false);
    }, []);
    const loadRoster = useCallback(async () => {
        if (!hasValidTmsToken(bearerToken))
            return;
        await fetchCompanyUsers();
    }, [bearerToken, fetchCompanyUsers]);
    useEffect(() => {
        void loadRoster();
    }, [loadRoster]);
    const resetForm = () => {
        setEmail('');
        setPassword('');
        setSelectedRoles(['Dispatcher']);
        setCommissionRate(String(DEFAULT_DISPATCHER_COMMISSION_RATE));
    };
    const toggleRole = (role: EmployeeRole) => {
        setSelectedRoles((prev) => {
            const next = prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role];
            if (!next.includes('Dispatcher')) {
                setCommissionRate('0');
            }
            else if (role === 'Dispatcher' && !prev.includes('Dispatcher')) {
                setCommissionRate(String(DEFAULT_DISPATCHER_COMMISSION_RATE));
            }
            return next;
        });
    };
    const openEditDrawer = (user: CompanyUserRecord) => {
        if (!hasDispatcherRole(user.roles))
            return;
        setEditUser(user);
        setEditCommissionRate(String(user.commission_rate ?? DEFAULT_DISPATCHER_COMMISSION_RATE));
    };
    const handleCreateEmployee = async () => {
        const trimmedEmail = email.trim().toLowerCase();
        if (!trimmedEmail) {
            toast.error('Email is required.');
            return;
        }
        if (password.length < 8) {
            toast.error('Password must be at least 8 characters.');
            return;
        }
        if (selectedRoles.length === 0) {
            toast.error('Select at least one role.');
            return;
        }
        const includesDispatcherRole = selectedRoles.includes('Dispatcher');
        let resolvedCommissionRate = 0;
        if (includesDispatcherRole) {
            const parsedRate = parseCommissionRateInput(commissionRate);
            if (parsedRate == null) {
                toast.error('Commission rate must be 0% or higher.');
                return;
            }
            resolvedCommissionRate = parsedRate;
        }
        setSubmitting(true);
        try {
            await tmsApi.system.createUser({
                email: trimmedEmail,
                password,
                roles: selectedRoles,
                commission_rate: resolvedCommissionRate,
            });
            toast.success('Employee account created.');
            setModalOpen(false);
            resetForm();
            await fetchCompanyUsers();
        }
        catch (err: unknown) {
            toast.error(formatApiError(err, 'Failed to create employee.'));
        }
        finally {
            setSubmitting(false);
        }
    };
    const handleUpdateCommissionRate = async () => {
        if (!editUser || !hasDispatcherRole(editUser.roles))
            return;
        const parsedRate = parseCommissionRateInput(editCommissionRate);
        if (parsedRate == null) {
            toast.error('Commission rate must be 0% or higher.');
            return;
        }
        setSubmitting(true);
        try {
            await tmsApi.system.updateUser(editUser.id, { commission_rate: parsedRate });
            toast.success('Commission rate updated.');
            setEditUser(null);
            await fetchCompanyUsers();
        }
        catch (err: unknown) {
            toast.error(formatApiError(err, 'Failed to update commission rate.'));
        }
        finally {
            setSubmitting(false);
        }
    };
    if (!isAdmin) {
        return null;
    }
    return (<div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-zinc-900 dark:text-white flex items-center gap-2">
            <Users size={22} className="text-zinc-500"/>
            Team Management
          </h2>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
            View workspace members and provision new employee logins for your company.
          </p>
        </div>
        <button type="button" onClick={() => setModalOpen(true)} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-zinc-900 dark:bg-white text-white dark:text-black text-sm font-bold hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors">
          <Plus size={16}/>
          Add Employee
        </button>
      </div>

      <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden bg-white dark:bg-[#0B0B0B]">
        {companyUsersLoading ? (<div className="flex items-center justify-center gap-2 py-16 text-sm text-zinc-500">
            <Loader2 size={18} className="animate-spin"/>
            Loading team roster…
          </div>) : companyUsers.length === 0 ? (<p className="py-16 text-center text-sm text-zinc-500 dark:text-zinc-400">
            No employees found for this workspace yet.
          </p>) : (<div className="w-full overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/40">
                <tr>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                    Email
                  </th>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                    Roles
                  </th>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-zinc-500 hidden md:table-cell">
                    Commission Rate (%)
                  </th>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-zinc-500 hidden md:table-cell">
                    Created
                  </th>
                  <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {companyUsers.map((user) => (<tr key={user.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-900/30 transition-colors">
                    <td className="px-4 py-3 font-medium text-zinc-900 dark:text-zinc-100">
                      {user.email}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1.5">
                        {(user.roles ?? []).map((role) => {
                    const badgeClass = ROLE_BADGE_CLASS[role as EmployeeRole] ??
                        'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700';
                    return (<span key={`${user.id}-${role}`} className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${badgeClass}`}>
                              {role}
                            </span>);
                })}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-zinc-700 dark:text-zinc-300 whitespace-nowrap font-medium hidden md:table-cell">
                      {formatCommissionRateForUser(user)}
                    </td>
                    <td className="px-4 py-3 text-zinc-500 dark:text-zinc-400 whitespace-nowrap hidden md:table-cell">
                      {formatCreatedAt(user.created_at)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {hasDispatcherRole(user.roles) ? (<button type="button" onClick={() => openEditDrawer(user)} className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">
                          <Pencil size={14} aria-hidden/>
                          Edit Rate
                        </button>) : (<span className="text-xs text-zinc-400">—</span>)}
                    </td>
                  </tr>))}
              </tbody>
            </table>
          </div>)}
      </div>

      {mounted && modalOpen
            ? createPortal(<div className="fixed inset-0 z-[110] flex items-end md:items-center justify-center p-0 md:p-4">
              <div className="fixed inset-0 w-screen h-[100dvh] min-h-screen bg-zinc-900/60 dark:bg-black/70 backdrop-blur-sm" aria-hidden onClick={() => {
                    setModalOpen(false);
                    resetForm();
                }}/>
              <div className="relative z-10 w-full max-w-full md:max-w-md rounded-t-xl md:rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#161616] shadow-2xl max-h-[calc(100svh-1rem)] flex flex-col overflow-hidden" role="dialog" aria-modal="true" aria-labelledby="add-employee-title">
            <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-200 dark:border-zinc-800 shrink-0">
              <h3 id="add-employee-title" className="text-lg font-bold text-zinc-900 dark:text-white">Add Employee</h3>
              <button type="button" onClick={() => {
                    setModalOpen(false);
                    resetForm();
                }} className="p-2 rounded-lg text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors" aria-label="Close">
                <X size={18}/>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              <div>
                <label className="text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">
                  Email
                </label>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1 w-full border border-zinc-200 dark:border-zinc-800 rounded-xl px-3 py-2.5 text-sm bg-zinc-50 dark:bg-zinc-900 text-zinc-900 dark:text-white outline-none focus:ring-2 focus:ring-zinc-500/30" placeholder="dispatcher@carrier.com" autoComplete="off"/>
              </div>

              <div>
                <label className="text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">
                  Password
                </label>
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="mt-1 w-full border border-zinc-200 dark:border-zinc-800 rounded-xl px-3 py-2.5 text-sm bg-zinc-50 dark:bg-zinc-900 text-zinc-900 dark:text-white outline-none focus:ring-2 focus:ring-zinc-500/30" minLength={8} placeholder="Min. 8 chars, upper, number, symbol" autoComplete="new-password"/>
              </div>

              {includesDispatcher ? (<div>
                  <label className="text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">
                    Commission Rate (%)
                  </label>
                  <input type="number" min="0" step={0.01} value={commissionRate} onChange={(e) => setCommissionRate(e.target.value)} className="mt-1 w-full border border-zinc-200 dark:border-zinc-800 rounded-xl px-3 py-2.5 text-sm bg-zinc-50 dark:bg-zinc-900 text-zinc-900 dark:text-white outline-none focus:ring-2 focus:ring-zinc-500/30"/>
                </div>) : null}

              <div>
                <p className="text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide mb-2">
                  Roles
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {EMPLOYEE_ROLES.map((role) => {
                    const checked = selectedRoles.includes(role);
                    return (<label key={role} className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 cursor-pointer transition-colors ${checked
                            ? 'border-zinc-900 dark:border-white bg-zinc-100 dark:bg-zinc-800'
                            : 'border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-900/40'}`}>
                        <input type="checkbox" checked={checked} onChange={() => toggleRole(role)} className="h-4 w-4 rounded border-zinc-400"/>
                        <span className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">{role}</span>
                      </label>);
                })}
                </div>
              </div>
            </div>

            <div className="flex flex-col-reverse sm:flex-row gap-2 justify-end px-5 py-4 border-t border-zinc-200 dark:border-zinc-800 shrink-0">
              <button type="button" onClick={() => {
                    setModalOpen(false);
                    resetForm();
                }} className="w-full sm:w-auto px-4 py-2 rounded-xl text-sm font-semibold text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">
                Cancel
              </button>
              <button type="button" onClick={() => void handleCreateEmployee()} disabled={submitting} className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-zinc-900 dark:bg-white text-white dark:text-black text-sm font-bold hover:bg-zinc-800 dark:hover:bg-zinc-200 disabled:opacity-60 transition-colors">
                {submitting ? <Loader2 size={16} className="animate-spin"/> : <Plus size={16}/>}
                Create Account
              </button>
            </div>
              </div>
            </div>, document.body)
            : null}

      {mounted && editUser
            ? createPortal(<div className="fixed inset-0 z-[110] flex items-end md:items-center justify-center p-0 md:p-4">
              <div className="fixed inset-0 w-screen h-[100dvh] min-h-screen bg-zinc-900/60 dark:bg-black/70 backdrop-blur-sm" aria-hidden onClick={() => setEditUser(null)}/>
              <div className="relative z-10 w-full max-w-full md:max-w-md rounded-t-xl md:rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#161616] shadow-2xl max-h-[calc(100svh-1rem)] flex flex-col overflow-hidden" role="dialog" aria-modal="true" aria-labelledby="edit-commission-title">
            <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-200 dark:border-zinc-800 shrink-0">
              <div>
                <h3 id="edit-commission-title" className="text-lg font-bold text-zinc-900 dark:text-white">Edit Commission Rate</h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">{editUser.email}</p>
              </div>
              <button type="button" onClick={() => setEditUser(null)} className="p-2 rounded-lg text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors" aria-label="Close">
                <X size={18}/>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5">
              <label className="text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">
                Commission Rate (%)
              </label>
              <input type="number" min="0" step="0.01" value={editCommissionRate} onChange={(e) => setEditCommissionRate(e.target.value)} className="mt-1 w-full border border-zinc-200 dark:border-zinc-800 rounded-xl px-3 py-2.5 text-sm bg-zinc-50 dark:bg-zinc-900 text-zinc-900 dark:text-white outline-none focus:ring-2 focus:ring-zinc-500/30"/>
            </div>

            <div className="flex flex-col-reverse sm:flex-row gap-2 justify-end px-5 py-4 border-t border-zinc-200 dark:border-zinc-800 shrink-0">
              <button type="button" onClick={() => setEditUser(null)} className="w-full sm:w-auto px-4 py-2 rounded-xl text-sm font-semibold text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">
                Cancel
              </button>
              <button type="button" onClick={() => void handleUpdateCommissionRate()} disabled={submitting} className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-zinc-900 dark:bg-white text-white dark:text-black text-sm font-bold hover:bg-zinc-800 dark:hover:bg-zinc-200 disabled:opacity-60 transition-colors">
                {submitting ? <Loader2 size={16} className="animate-spin"/> : null}
                Save Rate
              </button>
            </div>
              </div>
            </div>, document.body)
            : null}
    </div>);
}
