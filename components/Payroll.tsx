'use client';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { createApiClient, getApiBaseUrl, hasValidTmsToken, readPersistedTmsToken } from '@/lib/api-client';
import { createTmsApi, type DispatcherUnbatchedGroup, type PayrollLedgerRow, type PayrollRecipientType, type TeamDispatcher, } from '@/lib/tms-api';
import { Wallet, Plus, Trash2, FileCheck2, FileText, ChevronLeft, ChevronRight, Users, Briefcase, X, Loader2, } from 'lucide-react';
const DISPATCHER_SYNTHETIC_PAYROLL_ID_OFFSET = 900000000;
function isSyntheticDispatcherPayrollId(recordId: number): boolean {
    return recordId >= DISPATCHER_SYNTHETIC_PAYROLL_ID_OFFSET;
}
function dispatcherUserIdFromSyntheticPayrollId(recordId: number): number {
    return recordId - DISPATCHER_SYNTHETIC_PAYROLL_ID_OFFSET;
}
interface Driver {
    id: number;
    driver_name: string;
}
interface UnbatchedLoad {
    id: number;
    broker_load_id: string | null;
    origin: string;
    destination: string;
    linehaul_rate: number;
    driver_pay_allocated: number;
    created_at: string;
}
interface DeductionRow {
    id: string;
    description: string;
    amount: string;
}
interface AccessorialRow {
    id: string;
    description: string;
    amount: string;
}
interface PayrollProps {
    drivers?: Driver[];
    token?: string;
}
type RoleFilter = 'ALL' | PayrollRecipientType;
const ROLE_FILTER_OPTIONS: {
    value: RoleFilter;
    label: string;
}[] = [
    { value: 'ALL', label: 'All Roles' },
    { value: 'DRIVER', label: 'Drivers' },
    { value: 'DISPATCHER', label: 'Dispatchers' },
    { value: 'STAFF', label: 'Staff' },
];
const formatPeriod = (start: string, end: string) => {
    const startDate = new Date(`${start}T00:00:00`);
    const endDate = new Date(`${end}T00:00:00`);
    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
        return `${start} – ${end}`;
    }
    const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', year: 'numeric' };
    return `${startDate.toLocaleDateString(undefined, opts)} – ${endDate.toLocaleDateString(undefined, opts)}`;
};
const fmt = (n: number) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 });
const defaultPeriodStart = () => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
};
const defaultPeriodEnd = () => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
};
const statusBadgeClass = (status: string) => {
    if (status === 'Settled') {
        return 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20';
    }
    if (status === 'Processing') {
        return 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20';
    }
    return 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20';
};
const roleBadgeClass = (role: string) => {
    if (role === 'DISPATCHER') {
        return 'bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/20';
    }
    if (role === 'STAFF') {
        return 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20';
    }
    return 'bg-zinc-500/10 text-zinc-600 dark:text-zinc-300 border-zinc-500/20';
};
export default function Payroll({ drivers: driversProp, token: tokenProp }: PayrollProps) {
    const token = tokenProp ?? readPersistedTmsToken() ?? '';
    const api = useMemo(() => createTmsApi(createApiClient(token)), [token]);
    const [drivers, setDrivers] = useState<Driver[]>(driversProp ?? []);
    const [dispatchers, setDispatchers] = useState<TeamDispatcher[]>([]);
    const [roleFilter, setRoleFilter] = useState<RoleFilter>('ALL');
    const [selectedDriverId, setSelectedDriverId] = useState<number | ''>('');
    const [unbatchedLoads, setUnbatchedLoads] = useState<UnbatchedLoad[]>([]);
    const [selectedLoadIds, setSelectedLoadIds] = useState<number[]>([]);
    const [accessorials, setAccessorials] = useState<AccessorialRow[]>([]);
    const [deductions, setDeductions] = useState<DeductionRow[]>([]);
    const [periodStart, setPeriodStart] = useState(defaultPeriodStart);
    const [periodEnd, setPeriodEnd] = useState(defaultPeriodEnd);
    const [includeFuelAdvances, setIncludeFuelAdvances] = useState(true);
    const [loadingPool, setLoadingPool] = useState(false);
    const [closingBatch, setClosingBatch] = useState(false);
    const [payrollRows, setPayrollRows] = useState<PayrollLedgerRow[]>([]);
    const [payrollTotal, setPayrollTotal] = useState(0);
    const [payrollPage, setPayrollPage] = useState(1);
    const payrollLimit = 10;
    const [loadingPayroll, setLoadingPayroll] = useState(false);
    const [finalizingId, setFinalizingId] = useState<number | null>(null);
    const [staffUserId, setStaffUserId] = useState<number | ''>('');
    const [staffHours, setStaffHours] = useState('80');
    const [staffBasePayout, setStaffBasePayout] = useState('3200');
    const [creatingStaffBatch, setCreatingStaffBatch] = useState(false);
    const [showDispatcherModal, setShowDispatcherModal] = useState(false);
    const [dispatcherGroups, setDispatcherGroups] = useState<DispatcherUnbatchedGroup[]>([]);
    const [dispatcherPeriod, setDispatcherPeriod] = useState<{
        start: string;
        end: string;
    } | null>(null);
    const [loadingDispatcherPool, setLoadingDispatcherPool] = useState(false);
    const [processingDispatcherId, setProcessingDispatcherId] = useState<number | null>(null);
    useEffect(() => {
        if (driversProp)
            setDrivers(driversProp);
    }, [driversProp]);
    useEffect(() => {
        if (!hasValidTmsToken(token))
            return;
        let cancelled = false;
        const loadLookups = async () => {
            try {
                if (!driversProp) {
                    const driverRows = await api.fleet.drivers();
                    if (!cancelled) {
                        setDrivers(driverRows.map((driver) => ({
                            id: driver.id,
                            driver_name: driver.driver_name,
                        })));
                    }
                }
                const dispatcherRes = await api.users.dispatchers();
                if (!cancelled)
                    setDispatchers(dispatcherRes.dispatchers ?? []);
            }
            catch (err) {
                console.error('Failed to load payroll lookup data', err);
            }
        };
        void loadLookups();
        return () => {
            cancelled = true;
        };
    }, [api, driversProp, token]);
    const activeDrivers = useMemo(() => drivers.filter((driver) => driver.driver_name), [drivers]);
    const staffUsers = useMemo(() => dispatchers.filter((user) => (user.roles ?? []).some((role) => role === 'Accounting' || role === 'Admin')), [dispatchers]);
    const fetchUnbatched = useCallback(async (driverId: number) => {
        setLoadingPool(true);
        try {
            const res = await api.settlements.unbatched(driverId);
            setUnbatchedLoads(res.loads || []);
            setSelectedLoadIds([]);
        }
        catch (err: unknown) {
            console.error(err);
            toast.error('Failed to load unbatched pool.');
            setUnbatchedLoads([]);
            setSelectedLoadIds([]);
        }
        finally {
            setLoadingPool(false);
        }
    }, [api]);
    const fetchPayroll = useCallback(async () => {
        if (!hasValidTmsToken(token)) {
            setPayrollRows([]);
            setPayrollTotal(0);
            return;
        }
        setLoadingPayroll(true);
        try {
            const res = await api.financials.accountingPayroll({
                recipient_type: roleFilter,
                recipient_id: roleFilter === 'DRIVER' && selectedDriverId !== '' ? selectedDriverId : undefined,
                page: payrollPage,
                limit: payrollLimit,
            });
            setPayrollRows(res.data ?? []);
            setPayrollTotal(res.total ?? 0);
        }
        catch (err: unknown) {
            console.error(err);
            toast.error('Failed to load payroll records.');
            setPayrollRows([]);
            setPayrollTotal(0);
        }
        finally {
            setLoadingPayroll(false);
        }
    }, [api, payrollPage, payrollLimit, roleFilter, selectedDriverId, token]);
    useEffect(() => {
        if (selectedDriverId === '' || roleFilter === 'DISPATCHER' || roleFilter === 'STAFF') {
            setUnbatchedLoads([]);
            setSelectedLoadIds([]);
            return;
        }
        void fetchUnbatched(selectedDriverId);
    }, [selectedDriverId, roleFilter, fetchUnbatched]);
    useEffect(() => {
        setPayrollPage(1);
    }, [roleFilter, selectedDriverId]);
    useEffect(() => {
        void fetchPayroll();
    }, [fetchPayroll]);
    const selectedLoads = useMemo(() => unbatchedLoads.filter((load) => selectedLoadIds.includes(load.id)), [unbatchedLoads, selectedLoadIds]);
    const grossAllocated = useMemo(() => selectedLoads.reduce((sum, load) => sum + (load.driver_pay_allocated || 0), 0), [selectedLoads]);
    const totalDeductions = useMemo(() => deductions.reduce((sum, row) => sum + (parseFloat(row.amount) || 0), 0), [deductions]);
    const totalAccessorials = useMemo(() => accessorials.reduce((sum, row) => sum + (parseFloat(row.amount) || 0), 0), [accessorials]);
    const netRemittance = grossAllocated + totalAccessorials - totalDeductions;
    const toggleLoad = (loadId: number) => {
        setSelectedLoadIds((prev) => prev.includes(loadId) ? prev.filter((id) => id !== loadId) : [...prev, loadId]);
    };
    const toggleAll = () => {
        if (selectedLoadIds.length === unbatchedLoads.length) {
            setSelectedLoadIds([]);
        }
        else {
            setSelectedLoadIds(unbatchedLoads.map((load) => load.id));
        }
    };
    const addAccessorial = () => {
        setAccessorials((prev) => [...prev, { id: crypto.randomUUID(), description: '', amount: '' }]);
    };
    const updateAccessorial = (id: string, field: 'description' | 'amount', value: string) => {
        setAccessorials((prev) => prev.map((row) => (row.id === id ? { ...row, [field]: value } : row)));
    };
    const removeAccessorial = (id: string) => {
        setAccessorials((prev) => prev.filter((row) => row.id !== id));
    };
    const addDeduction = () => {
        setDeductions((prev) => [...prev, { id: crypto.randomUUID(), description: '', amount: '' }]);
    };
    const updateDeduction = (id: string, field: 'description' | 'amount', value: string) => {
        setDeductions((prev) => prev.map((row) => (row.id === id ? { ...row, [field]: value } : row)));
    };
    const removeDeduction = (id: string) => {
        setDeductions((prev) => prev.filter((row) => row.id !== id));
    };
    const handleCloseBatch = async () => {
        if (selectedDriverId === '') {
            toast.error('Select a driver before closing a batch.');
            return;
        }
        if (selectedLoadIds.length === 0) {
            toast.error('Select at least one completed load to issue a statement.');
            return;
        }
        if (netRemittance < 0) {
            toast.error('Deductions exceed gross pay and accessorial additions. Adjust before closing.');
            return;
        }
        setClosingBatch(true);
        const toastId = toast.loading('Compiling payroll batch...');
        try {
            const payload = {
                driver_id: selectedDriverId,
                start_date: periodStart,
                end_date: periodEnd,
                load_ids: selectedLoadIds,
                accessorials: accessorials
                    .filter((row) => row.description.trim() && parseFloat(row.amount) > 0)
                    .map((row) => ({
                    description: row.description.trim(),
                    amount: parseFloat(row.amount),
                })),
                deductions: deductions
                    .filter((row) => row.description.trim() && parseFloat(row.amount) > 0)
                    .map((row) => ({
                    description: row.description.trim(),
                    amount: parseFloat(row.amount),
                })),
                include_fuel_advances: includeFuelAdvances,
                commit: true,
            };
            const res = await api.financials.compileDriverSettlement(payload);
            toast.success(`Statement ${res.statement_number} issued — ${res.load_count} load(s) locked (${res.tracking_id}).`, { id: toastId });
            setAccessorials([]);
            setDeductions([]);
            await fetchUnbatched(selectedDriverId);
            await fetchPayroll();
        }
        catch (err: unknown) {
            console.error(err);
            toast.error('Failed to close payroll batch.', { id: toastId });
        }
        finally {
            setClosingBatch(false);
        }
    };
    const handleCreateStaffBatch = async () => {
        if (staffUserId === '') {
            toast.error('Select a staff member.');
            return;
        }
        setCreatingStaffBatch(true);
        const toastId = toast.loading('Creating staff payroll batch...');
        try {
            await api.financials.accountingCreateStaffPayrollBatch({
                user_id: staffUserId,
                hours: parseFloat(staffHours) || 0,
                base_payout: parseFloat(staffBasePayout) || 0,
            });
            toast.success('Staff payroll batch created.', { id: toastId });
            await fetchPayroll();
        }
        catch (err: unknown) {
            console.error(err);
            toast.error('Failed to create staff payroll batch.', { id: toastId });
        }
        finally {
            setCreatingStaffBatch(false);
        }
    };
    const loadDispatcherCommissionPool = useCallback(async () => {
        setLoadingDispatcherPool(true);
        try {
            const res = await api.financials.accountingDispatcherUnbatched();
            setDispatcherGroups(res.groups ?? []);
            setDispatcherPeriod({ start: res.period_start, end: res.period_end });
        }
        catch (err: unknown) {
            console.error(err);
            toast.error('Failed to load dispatcher commission pool.');
            setDispatcherGroups([]);
            setDispatcherPeriod(null);
        }
        finally {
            setLoadingDispatcherPool(false);
        }
    }, [api]);
    const handleOpenDispatcherModal = useCallback(async () => {
        setShowDispatcherModal(true);
        await loadDispatcherCommissionPool();
    }, [loadDispatcherCommissionPool]);
    const handleGenerateDispatcherBatch = async (group: DispatcherUnbatchedGroup) => {
        setProcessingDispatcherId(group.dispatcher_user_id);
        const toastId = toast.loading(`Generating statement for ${group.dispatcher_name}…`);
        try {
            await api.financials.accountingCreateDispatcherPayrollBatch({
                dispatcher_user_id: group.dispatcher_user_id,
                commission_rate: group.commission_rate,
            });
            toast.success(`Dispatcher statement created for ${group.dispatcher_name}.`, { id: toastId });
            await loadDispatcherCommissionPool();
            await fetchPayroll();
        }
        catch (err: unknown) {
            console.error(err);
            toast.error('Failed to generate dispatcher commission statement.', { id: toastId });
        }
        finally {
            setProcessingDispatcherId(null);
        }
    };
    const handleFinalize = async (row: PayrollLedgerRow) => {
        if (isSyntheticDispatcherPayrollId(row.id)) {
            toast.error('Generate a statement batch before approving payout.');
            return;
        }
        setFinalizingId(row.id);
        const toastId = toast.loading(`Releasing payout for ${row.statement_number}...`);
        try {
            await api.financials.accountingFinalizePayroll(row.id, row.recipient_type);
            toast.success(`Payroll released — ${row.statement_number} marked PAID.`, { id: toastId });
            await fetchPayroll();
        }
        catch (err: unknown) {
            console.error(err);
            toast.error('Failed to finalize payroll record.', { id: toastId });
        }
        finally {
            setFinalizingId(null);
        }
    };
    const handleGenerateStatementFromProjection = async (row: PayrollLedgerRow) => {
        if (row.recipient_type !== 'DISPATCHER' ||
            !isSyntheticDispatcherPayrollId(row.id)) {
            return;
        }
        const dispatcherUserId = dispatcherUserIdFromSyntheticPayrollId(row.id);
        setProcessingDispatcherId(dispatcherUserId);
        const toastId = toast.loading(`Generating statement for ${row.recipient_name}…`);
        try {
            await api.financials.accountingCreateDispatcherPayrollBatch({
                dispatcher_user_id: dispatcherUserId,
                commission_rate: row.commission_rate ?? undefined,
            });
            toast.success(`Dispatcher statement created for ${row.recipient_name}.`, { id: toastId });
            await fetchPayroll();
        }
        catch (err: unknown) {
            console.error(err);
            toast.error('Failed to generate dispatcher commission statement.', { id: toastId });
        }
        finally {
            setProcessingDispatcherId(null);
        }
    };
    const handleViewStatement = async (row: PayrollLedgerRow) => {
        if (row.recipient_type !== 'DRIVER' && row.recipient_type !== 'DISPATCHER') {
            toast.error('PDF statements are not available for this payroll type.');
            return;
        }
        if (isSyntheticDispatcherPayrollId(row.id)) {
            toast.error('Generate a statement batch before viewing a PDF.');
            return;
        }
        if (!hasValidTmsToken()) {
            toast.error('Authentication required.');
            return;
        }
        const pdfUrl = `${getApiBaseUrl()}/api/financials/accounting/payroll/${row.id}/pdf?recipient_type=${encodeURIComponent(row.recipient_type)}`;
        try {
            const response = await fetch(pdfUrl, { credentials: 'include' });
            if (!response.ok) {
                toast.error('Unable to open statement PDF.');
                return;
            }
            const blob = await response.blob();
            const objectUrl = URL.createObjectURL(blob);
            window.open(objectUrl, '_blank', 'noopener,noreferrer');
            window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60000);
        }
        catch {
            toast.error('Unable to open statement PDF.');
        }
    };
    const payrollTotalPages = Math.max(1, Math.ceil(payrollTotal / payrollLimit));
    const selectedDriverName = activeDrivers.find((driver) => driver.id === selectedDriverId)?.driver_name || 'Driver';
    const showDriverBatchConsole = roleFilter === 'ALL' || roleFilter === 'DRIVER';
    const renderDriverColumns = () => (<>
      <th className="p-3 text-left">Recipient</th>
      <th className="p-3 text-left">Period</th>
      <th className="p-3 text-left">Truck</th>
      <th className="p-3 text-right">Miles</th>
      <th className="p-3 text-right">Gross</th>
      <th className="p-3 text-right">Deductions</th>
      <th className="p-3 text-right">Net</th>
      <th className="p-3 text-center">Status</th>
      <th className="p-3 text-right pr-5">Actions</th>
    </>);
    const renderDispatcherColumns = () => (<>
      <th className="p-3 text-left">Dispatcher</th>
      <th className="p-3 text-left">Period</th>
      <th className="p-3 text-right">Dispatched Loads</th>
      <th className="p-3 text-right">Total Gross Volume</th>
      <th className="p-3 text-right">Commission Rate</th>
      <th className="p-3 text-right">Net Pay Earned</th>
      <th className="p-3 text-center">Status</th>
      <th className="p-3 text-right pr-5">Actions</th>
    </>);
    const renderStaffColumns = () => (<>
      <th className="p-3 text-left">Staff Member</th>
      <th className="p-3 text-left">Period</th>
      <th className="p-3 text-right">Hours</th>
      <th className="p-3 text-right">Base Payout</th>
      <th className="p-3 text-right">Net Payout</th>
      <th className="p-3 text-center">Status</th>
      <th className="p-3 text-right pr-5">Actions</th>
    </>);
    const renderAllColumns = () => (<>
      <th className="p-3 text-left">Recipient</th>
      <th className="p-3 text-left">Role</th>
      <th className="p-3 text-left">Period</th>
      <th className="p-3 text-right">Gross / Volume</th>
      <th className="p-3 text-right">Net Payout</th>
      <th className="p-3 text-center">Status</th>
      <th className="p-3 text-right pr-5">Actions</th>
    </>);
    const renderDriverRow = (row: PayrollLedgerRow) => {
        const deductionTotal = (row.deductions?.escrow ?? 0) +
            (row.deductions?.insurance ?? 0) +
            (row.deductions?.dispatch_fees ?? 0) +
            (row.deductions?.other ?? 0) +
            (row.fuel_advances ?? 0);
        return (<tr key={`${row.recipient_type}-${row.id}`} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/40 transition-colors">
        <td className="p-3 pl-5">
          <p className="font-semibold text-zinc-900 dark:text-white">{row.recipient_name}</p>
          <p className="font-mono text-[10px] text-zinc-500">{row.statement_number}</p>
        </td>
        <td className="p-3 text-zinc-600 dark:text-zinc-300 whitespace-nowrap">
          {formatPeriod(row.period_start, row.period_end)}
        </td>
        <td className="p-3 text-zinc-600 dark:text-zinc-300">{row.truck_number ? `#${row.truck_number}` : '—'}</td>
        <td className="p-3 text-right tabular-nums">{(row.total_miles ?? 0).toLocaleString()} mi</td>
        <td className="p-3 text-right tabular-nums">{fmt(row.gross_revenue ?? 0)}</td>
        <td className="p-3 text-right text-rose-500 tabular-nums">
          {deductionTotal > 0 ? `-${fmt(deductionTotal)}` : fmt(0)}
        </td>
        <td className="p-3 text-right font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
          {fmt(row.net_payout)}
        </td>
        <td className="p-3 text-center">
          <span className={`inline-flex px-2.5 py-1 rounded-md text-[10px] font-bold uppercase border ${statusBadgeClass(row.status)}`}>
            {row.status}
          </span>
        </td>
        <td className="p-3 pr-5">{renderRowActions(row)}</td>
      </tr>);
    };
    const renderDispatcherRow = (row: PayrollLedgerRow) => (<tr key={`${row.recipient_type}-${row.id}`} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/40 transition-colors">
      <td className="p-3 pl-5">
        <p className="font-semibold text-zinc-900 dark:text-white">{row.recipient_name}</p>
        <p className="font-mono text-[10px] text-zinc-500">{row.statement_number}</p>
      </td>
      <td className="p-3 text-zinc-600 dark:text-zinc-300 whitespace-nowrap">
        {formatPeriod(row.period_start, row.period_end)}
      </td>
      <td className="p-3 text-right tabular-nums">{row.assigned_load_count ?? 0}</td>
      <td className="p-3 text-right tabular-nums">{fmt(row.total_dispatched_volume ?? 0)}</td>
      <td className="p-3 text-right tabular-nums">
        {row.commission_rate != null ? `${(row.commission_rate * 100).toFixed(1)}%` : '—'}
      </td>
      <td className="p-3 text-right font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
        {fmt(row.net_payout)}
      </td>
      <td className="p-3 text-center">
        <span className={`inline-flex px-2.5 py-1 rounded-md text-[10px] font-bold uppercase border ${statusBadgeClass(row.status)}`}>
          {row.status}
        </span>
      </td>
      <td className="p-3 pr-5">{renderRowActions(row)}</td>
    </tr>);
    const renderStaffRow = (row: PayrollLedgerRow) => (<tr key={`${row.recipient_type}-${row.id}`} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/40 transition-colors">
      <td className="p-3 pl-5">
        <p className="font-semibold text-zinc-900 dark:text-white">{row.recipient_name}</p>
        <p className="font-mono text-[10px] text-zinc-500">{row.statement_number}</p>
      </td>
      <td className="p-3 text-zinc-600 dark:text-zinc-300 whitespace-nowrap">
        {formatPeriod(row.period_start, row.period_end)}
      </td>
      <td className="p-3 text-right tabular-nums">{(row.hours ?? 0).toFixed(1)}</td>
      <td className="p-3 text-right tabular-nums">{fmt(row.base_payout ?? 0)}</td>
      <td className="p-3 text-right font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
        {fmt(row.net_payout)}
      </td>
      <td className="p-3 text-center">
        <span className={`inline-flex px-2.5 py-1 rounded-md text-[10px] font-bold uppercase border ${statusBadgeClass(row.status)}`}>
          {row.status}
        </span>
      </td>
      <td className="p-3 pr-5">{renderRowActions(row)}</td>
    </tr>);
    const renderAllRow = (row: PayrollLedgerRow) => (<tr key={`${row.recipient_type}-${row.id}`} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/40 transition-colors">
      <td className="p-3 pl-5">
        <p className="font-semibold text-zinc-900 dark:text-white">{row.recipient_name}</p>
        <p className="font-mono text-[10px] text-zinc-500">{row.statement_number}</p>
      </td>
      <td className="p-3">
        <span className={`inline-flex px-2 py-0.5 rounded-md text-[10px] font-bold uppercase border ${roleBadgeClass(row.recipient_type)}`}>
          {row.recipient_type}
        </span>
      </td>
      <td className="p-3 text-zinc-600 dark:text-zinc-300 whitespace-nowrap">
        {formatPeriod(row.period_start, row.period_end)}
      </td>
      <td className="p-3 text-right tabular-nums">
        {row.recipient_type === 'DISPATCHER'
            ? fmt(row.total_dispatched_volume ?? 0)
            : fmt(row.gross_revenue ?? row.base_payout ?? 0)}
      </td>
      <td className="p-3 text-right font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
        {fmt(row.net_payout)}
      </td>
      <td className="p-3 text-center">
        <span className={`inline-flex px-2.5 py-1 rounded-md text-[10px] font-bold uppercase border ${statusBadgeClass(row.status)}`}>
          {row.status}
        </span>
      </td>
      <td className="p-3 pr-5">{renderRowActions(row)}</td>
    </tr>);
    function renderRowActions(row: PayrollLedgerRow) {
        const isSettled = row.status === 'Settled' || row.status === 'PAID' || row.status === 'Paid';
        const isProjection = row.recipient_type === 'DISPATCHER' && isSyntheticDispatcherPayrollId(row.id);
        const dispatcherUserId = isProjection
            ? dispatcherUserIdFromSyntheticPayrollId(row.id)
            : null;
        const isGeneratingProjection = dispatcherUserId != null && processingDispatcherId === dispatcherUserId;
        if (isProjection) {
            return (<div className="flex items-center justify-end gap-2">
          <button type="button" onClick={() => void handleGenerateStatementFromProjection(row)} disabled={isGeneratingProjection} className="inline-flex items-center gap-1 text-[10px] font-bold bg-zinc-900 dark:bg-white dark:text-black text-white hover:bg-zinc-800 dark:hover:bg-zinc-200 px-2.5 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 transition-colors disabled:opacity-50 whitespace-nowrap">
            {isGeneratingProjection ? (<Loader2 size={12} className="animate-spin"/>) : (<FileCheck2 size={12}/>)}
            {isGeneratingProjection ? 'Generating...' : 'Generate Statement'}
          </button>
        </div>);
        }
        return (<div className="flex items-center justify-end gap-2">
        {(row.recipient_type === 'DRIVER' || row.recipient_type === 'DISPATCHER') && (<button type="button" onClick={() => void handleViewStatement(row)} className="inline-flex items-center gap-1 text-[10px] font-bold bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white hover:bg-zinc-200 dark:hover:bg-zinc-700 px-2.5 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 transition-colors whitespace-nowrap">
            <FileText size={12}/>
            View PDF
          </button>)}
        {!isSettled ? (<button type="button" onClick={() => void handleFinalize(row)} disabled={finalizingId === row.id} className="text-[10px] font-bold bg-zinc-900 dark:bg-white dark:text-black text-white hover:bg-zinc-800 dark:hover:bg-zinc-200 px-2.5 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 transition-colors disabled:opacity-50 whitespace-nowrap">
            {finalizingId === row.id ? 'Approving...' : 'Approve Payout'}
          </button>) : (<span className="text-[10px] font-semibold text-emerald-500 dark:text-emerald-400 uppercase tracking-wider">
            Deposited
          </span>)}
      </div>);
    }
    return (<div className="space-y-6 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-[#161616] border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 shadow-sm flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-zinc-500/10 text-zinc-600 dark:text-zinc-400">
            <Wallet size={22}/>
          </div>
          <div>
            <h2 className="text-lg font-bold text-zinc-900 dark:text-white">Unified Payroll Console</h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Driver settlements, dispatcher commissions, and staff salary batches
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Users size={18} className="text-zinc-400 shrink-0"/>
          <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value as RoleFilter)} className="min-w-[160px] border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-zinc-900 dark:text-white rounded-lg px-3 py-2.5 text-sm font-semibold outline-none focus:ring-2 focus:ring-zinc-600 transition-colors">
            {ROLE_FILTER_OPTIONS.map((option) => (<option key={option.value} value={option.value}>
                {option.label}
              </option>))}
          </select>
          {(roleFilter === 'ALL' || roleFilter === 'DRIVER') && (<select value={selectedDriverId} onChange={(e) => setSelectedDriverId(e.target.value ? parseInt(e.target.value, 10) : '')} className="min-w-[220px] border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-zinc-900 dark:text-white rounded-lg px-3 py-2.5 text-sm font-semibold outline-none focus:ring-2 focus:ring-zinc-600 transition-colors">
              <option value="">All Drivers</option>
              {activeDrivers.map((driver) => (<option key={driver.id} value={driver.id}>
                  {driver.driver_name}
                </option>))}
            </select>)}
          {roleFilter === 'DISPATCHER' && (<button type="button" onClick={() => void handleOpenDispatcherModal()} className="inline-flex items-center gap-1.5 rounded-lg bg-violet-600 hover:bg-violet-500 text-white px-3 py-2.5 text-sm font-semibold transition-colors">
              <Briefcase size={16}/>
              Process Dispatcher Commissions
            </button>)}
        </div>
      </div>

      {roleFilter === 'STAFF' && (<section className="bg-white dark:bg-[#161616] border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 shadow-sm">
          <h3 className="text-sm font-bold text-zinc-700 dark:text-zinc-200 uppercase tracking-wider mb-4">
            Create Staff Payroll Batch
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <select value={staffUserId} onChange={(e) => setStaffUserId(e.target.value ? parseInt(e.target.value, 10) : '')} className="border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 rounded-lg px-3 py-2 text-sm">
              <option value="">Select staff member...</option>
              {staffUsers.map((user) => (<option key={user.id} value={user.id}>
                  {user.first_name || user.last_name
                    ? `${user.first_name ?? ''} ${user.last_name ?? ''}`.trim()
                    : user.email}
                </option>))}
            </select>
            <input type="number" value={staffHours} onChange={(e) => setStaffHours(e.target.value)} placeholder="Hours" className="border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 rounded-lg px-3 py-2 text-sm"/>
            <input type="number" value={staffBasePayout} onChange={(e) => setStaffBasePayout(e.target.value)} placeholder="Base payout" className="border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 rounded-lg px-3 py-2 text-sm"/>
            <button type="button" disabled={creatingStaffBatch} onClick={() => void handleCreateStaffBatch()} className="rounded-lg bg-zinc-900 dark:bg-white dark:text-black text-white font-bold py-2 text-sm disabled:opacity-50">
              {creatingStaffBatch ? 'Creating...' : 'Create Staff Batch'}
            </button>
          </div>
        </section>)}

      {showDriverBatchConsole && (<div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <section className="xl:col-span-2 bg-white dark:bg-[#161616] border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-[#0B0B0B] flex justify-between items-center">
              <h3 className="text-sm font-bold text-zinc-700 dark:text-zinc-200 uppercase tracking-wider">
                Unbatched Completed Loads
              </h3>
            </div>
            {selectedDriverId === '' ? (<div className="p-12 text-center text-zinc-400 dark:text-zinc-500 text-sm">
                Choose a driver to load their unbatched completed freight.
              </div>) : loadingPool ? (<div className="p-12 text-center text-zinc-400 dark:text-zinc-500 text-sm animate-pulse">
                Loading payroll pool...
              </div>) : unbatchedLoads.length === 0 ? (<div className="p-12 text-center text-zinc-400 dark:text-zinc-500 text-sm">
                No unbatched completed loads for {selectedDriverName}.
              </div>) : (<div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-zinc-50 dark:bg-[#0B0B0B] text-zinc-500 dark:text-zinc-400 text-[10px] uppercase font-bold border-b dark:border-zinc-800">
                    <tr>
                      <th className="p-3 pl-5 w-10">
                        <input type="checkbox" checked={selectedLoadIds.length === unbatchedLoads.length && unbatchedLoads.length > 0} onChange={toggleAll} className="rounded border-zinc-300 dark:border-zinc-700 text-zinc-600 focus:ring-zinc-600"/>
                      </th>
                      <th className="p-3 text-left">Load</th>
                      <th className="p-3 text-left">Lane</th>
                      <th className="p-3 text-right">Gross Pay</th>
                      <th className="p-3 text-right pr-5">Driver Alloc.</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y dark:divide-zinc-800">
                    {unbatchedLoads.map((load) => {
                    const isSelected = selectedLoadIds.includes(load.id);
                    return (<tr key={load.id} onClick={() => toggleLoad(load.id)} className={`cursor-pointer transition-colors ${isSelected
                            ? 'bg-zinc-100 dark:bg-zinc-800/50'
                            : 'hover:bg-zinc-50 dark:hover:bg-zinc-800/50'}`}>
                          <td className="p-3 pl-5" onClick={(e) => e.stopPropagation()}>
                            <input type="checkbox" checked={isSelected} onChange={() => toggleLoad(load.id)} className="rounded border-zinc-300 dark:border-zinc-700 text-zinc-600 focus:ring-zinc-600"/>
                          </td>
                          <td className="p-3 font-mono text-xs font-bold text-zinc-900 dark:text-white">
                            {load.broker_load_id || `L-${load.id}`}
                          </td>
                          <td className="p-3 text-zinc-600 dark:text-zinc-300">
                            {load.origin} → {load.destination}
                          </td>
                          <td className="p-3 text-right font-semibold text-zinc-700 dark:text-zinc-200">
                            ${load.linehaul_rate.toFixed(2)}
                          </td>
                          <td className="p-3 text-right pr-5 font-bold text-zinc-600 dark:text-zinc-300">
                            ${load.driver_pay_allocated.toFixed(2)}
                          </td>
                        </tr>);
                })}
                  </tbody>
                </table>
              </div>)}
          </section>

          <div className="space-y-6">
            <section className="bg-white dark:bg-[#161616] border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-[#0B0B0B]">
                <h3 className="text-sm font-bold text-zinc-700 dark:text-zinc-200 uppercase tracking-wider mb-3">
                  Settlement Period
                </h3>
                <div className="grid grid-cols-2 gap-2">
                  <input type="date" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} className="border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-zinc-900 dark:text-white rounded-lg px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-zinc-600"/>
                  <input type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} className="border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-zinc-900 dark:text-white rounded-lg px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-zinc-600"/>
                </div>
              </div>
            </section>

            <section className="bg-white dark:bg-[#161616] border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-[#0B0B0B] flex justify-between items-center">
                <h3 className="text-sm font-bold text-zinc-700 dark:text-zinc-200 uppercase tracking-wider">
                  Accessorial Additions
                </h3>
                <button type="button" onClick={addAccessorial} className="flex items-center gap-1 text-xs font-bold text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white transition-colors">
                  <Plus size={14}/> Add Row
                </button>
              </div>
              <div className="p-4 space-y-3 max-h-[220px] overflow-y-auto">
                {accessorials.length === 0 ? (<p className="text-xs text-zinc-400 dark:text-zinc-500 text-center py-6">
                    No accessorial additions added.
                  </p>) : (accessorials.map((row) => (<div key={row.id} className="flex gap-2 items-start">
                      <input type="text" placeholder="Detention, Layover, Tarping..." value={row.description} onChange={(e) => updateAccessorial(row.id, 'description', e.target.value)} className="flex-1 border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-zinc-900 dark:text-white rounded-lg px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-zinc-600"/>
                      <input type="number" step="0.01" min="0" placeholder="0.00" value={row.amount} onChange={(e) => updateAccessorial(row.id, 'amount', e.target.value)} className="w-24 border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-zinc-900 dark:text-white rounded-lg px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-zinc-600"/>
                      <button type="button" onClick={() => removeAccessorial(row.id)} className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors">
                        <Trash2 size={14}/>
                      </button>
                    </div>)))}
              </div>
            </section>

            <section className="bg-white dark:bg-[#161616] border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-[#0B0B0B] flex justify-between items-center">
                <h3 className="text-sm font-bold text-zinc-700 dark:text-zinc-200 uppercase tracking-wider">
                  Statement Deductions
                </h3>
                <button type="button" onClick={addDeduction} className="flex items-center gap-1 text-xs font-bold text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white transition-colors">
                  <Plus size={14}/> Add Row
                </button>
              </div>
              <div className="p-4 space-y-3 max-h-[280px] overflow-y-auto">
                {deductions.length === 0 ? (<p className="text-xs text-zinc-400 dark:text-zinc-500 text-center py-6">
                    No deductions added.
                  </p>) : (deductions.map((row) => (<div key={row.id} className="flex gap-2 items-start">
                      <input type="text" placeholder="Description" value={row.description} onChange={(e) => updateDeduction(row.id, 'description', e.target.value)} className="flex-1 border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-zinc-900 dark:text-white rounded-lg px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-zinc-600"/>
                      <input type="number" step="0.01" min="0" placeholder="0.00" value={row.amount} onChange={(e) => updateDeduction(row.id, 'amount', e.target.value)} className="w-24 border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-zinc-900 dark:text-white rounded-lg px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-zinc-600"/>
                      <button type="button" onClick={() => removeDeduction(row.id)} className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors">
                        <Trash2 size={14}/>
                      </button>
                    </div>)))}
              </div>
              <div className="px-4 pb-4">
                <label className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
                  <input type="checkbox" checked={includeFuelAdvances} onChange={(e) => setIncludeFuelAdvances(e.target.checked)} className="rounded border-zinc-300 dark:border-zinc-700 text-zinc-600 focus:ring-zinc-600"/>
                  Include fuel card advances from live fuel logs
                </label>
              </div>
            </section>

            <section className="bg-white dark:bg-[#161616] border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 shadow-lg">
              <h3 className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 dark:text-zinc-400 mb-4">
                Statement Summary — {selectedDriverName}
              </h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-zinc-500 dark:text-zinc-400">Gross Driver Pay</span>
                  <span className="text-lg font-bold text-zinc-900 dark:text-white">{fmt(grossAllocated)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-zinc-500 dark:text-zinc-400">Accessorial Additions</span>
                  <span className="text-lg font-bold text-sky-400">+{fmt(totalAccessorials)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-zinc-500 dark:text-zinc-400">Total Deductions</span>
                  <span className="text-lg font-bold text-rose-400">-{fmt(totalDeductions)}</span>
                </div>
                <div className="border-t border-zinc-200 dark:border-zinc-800 pt-3 flex justify-between items-center">
                  <span className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">Net Worker Remittance</span>
                  <span className={`text-2xl font-black ${netRemittance >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {fmt(netRemittance)}
                  </span>
                </div>
              </div>
              <button type="button" onClick={() => void handleCloseBatch()} disabled={closingBatch || selectedDriverId === '' || selectedLoadIds.length === 0} className="mt-5 w-full flex items-center justify-center gap-2 bg-zinc-900 hover:bg-zinc-800 dark:bg-white dark:text-black dark:hover:bg-zinc-200 disabled:bg-zinc-700 disabled:text-zinc-500 text-white font-bold py-3 rounded-xl text-sm transition-all shadow-sm">
                <FileCheck2 size={18}/>
                {closingBatch ? 'Issuing Statement...' : 'Close Batch & Issue Statement'}
              </button>
            </section>
          </div>
        </div>)}

      <section className="bg-white dark:bg-[#161616] border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-[#0B0B0B] flex flex-wrap justify-between items-center gap-2">
          <h3 className="text-sm font-bold text-zinc-700 dark:text-zinc-200 uppercase tracking-wider">
            Payroll Registry
          </h3>
          <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">
            {payrollTotal} record{payrollTotal !== 1 ? 's' : ''}
          </span>
        </div>

        {loadingPayroll ? (<div className="p-10 text-center text-zinc-400 dark:text-zinc-500 text-sm animate-pulse">
            Loading payroll records...
          </div>) : payrollRows.length === 0 ? (<div className="p-10 text-center text-zinc-400 dark:text-zinc-500 text-sm">
            No payroll records found for the selected role filter.
          </div>) : (<>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-zinc-50 dark:bg-[#0B0B0B] text-zinc-500 dark:text-zinc-400 text-[10px] uppercase font-bold border-b dark:border-zinc-800">
                  <tr>
                    {roleFilter === 'DRIVER' && renderDriverColumns()}
                    {roleFilter === 'DISPATCHER' && renderDispatcherColumns()}
                    {roleFilter === 'STAFF' && renderStaffColumns()}
                    {roleFilter === 'ALL' && renderAllColumns()}
                  </tr>
                </thead>
                <tbody className="divide-y dark:divide-zinc-800">
                  {payrollRows.map((row) => {
                if (roleFilter === 'DRIVER')
                    return renderDriverRow(row);
                if (roleFilter === 'DISPATCHER')
                    return renderDispatcherRow(row);
                if (roleFilter === 'STAFF')
                    return renderStaffRow(row);
                return renderAllRow(row);
            })}
                </tbody>
              </table>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-t border-zinc-200 dark:border-zinc-800 text-xs text-zinc-500">
              <span>
                Showing {payrollTotal === 0 ? 0 : (payrollPage - 1) * payrollLimit + 1} to{' '}
                {Math.min(payrollPage * payrollLimit, payrollTotal)} of {payrollTotal}
              </span>
              <div className="flex items-center gap-1">
                <button type="button" disabled={payrollPage <= 1} onClick={() => setPayrollPage((page) => Math.max(1, page - 1))} className="p-1.5 rounded-md border border-zinc-200 dark:border-zinc-700 disabled:opacity-40 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">
                  <ChevronLeft size={14}/>
                </button>
                <span className="px-2 tabular-nums">
                  Page {payrollPage} of {payrollTotalPages}
                </span>
                <button type="button" disabled={payrollPage >= payrollTotalPages} onClick={() => setPayrollPage((page) => Math.min(payrollTotalPages, page + 1))} className="p-1.5 rounded-md border border-zinc-200 dark:border-zinc-700 disabled:opacity-40 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">
                  <ChevronRight size={14}/>
                </button>
              </div>
            </div>
          </>)}
      </section>

      {showDispatcherModal && (<div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/70 backdrop-blur-sm">
          <div className="w-full max-w-4xl max-h-[90vh] flex flex-col rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#161616] shadow-2xl" role="dialog" aria-modal="true" aria-labelledby="dispatcher-commission-title">
            <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-zinc-200 dark:border-zinc-800">
              <div>
                <h2 id="dispatcher-commission-title" className="text-sm font-bold text-zinc-900 dark:text-white">
                  Process Dispatcher Commissions
                </h2>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                  {dispatcherPeriod
                ? `Completed loads for ${formatPeriod(dispatcherPeriod.start, dispatcherPeriod.end)} grouped by booking dispatcher.`
                : 'Review unbatched delivered and settled freight before generating statements.'}
                </p>
              </div>
              <button type="button" onClick={() => setShowDispatcherModal(false)} className="p-1.5 rounded-lg text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors" aria-label="Close">
                <X size={16}/>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
              {loadingDispatcherPool ? (<div className="flex items-center justify-center gap-2 py-16 text-sm text-zinc-500">
                  <Loader2 size={16} className="animate-spin"/>
                  Loading dispatcher commission pool…
                </div>) : dispatcherGroups.length === 0 ? (<p className="py-16 text-center text-sm text-zinc-500 dark:text-zinc-400">
                  No unbatched completed loads with assigned dispatchers for this period.
                </p>) : (dispatcherGroups.map((group) => (<div key={group.dispatcher_user_id} className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/60 dark:bg-zinc-900/40 overflow-hidden">
                    <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-b border-zinc-200 dark:border-zinc-800">
                      <div>
                        <p className="text-sm font-semibold text-zinc-900 dark:text-white">
                          {group.dispatcher_name}
                        </p>
                        <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                          {group.load_count} load{group.load_count === 1 ? '' : 's'} ·{' '}
                          {(group.commission_rate * 100).toFixed(1)}% commission
                        </p>
                      </div>
                      <div className="flex items-center gap-4 text-xs">
                        <div className="text-right">
                          <p className="text-zinc-500">Gross Volume</p>
                          <p className="font-semibold tabular-nums text-zinc-900 dark:text-white">
                            {fmt(group.total_gross_volume)}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-zinc-500">Net Pay</p>
                          <p className="font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
                            {fmt(group.projected_net_pay)}
                          </p>
                        </div>
                        <button type="button" disabled={processingDispatcherId === group.dispatcher_user_id} onClick={() => void handleGenerateDispatcherBatch(group)} className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-900 dark:bg-white dark:text-black text-white px-3 py-2 text-xs font-bold disabled:opacity-50">
                          {processingDispatcherId === group.dispatcher_user_id ? (<Loader2 size={14} className="animate-spin"/>) : (<FileCheck2 size={14}/>)}
                          Generate Statement
                        </button>
                      </div>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead className="text-zinc-500 dark:text-zinc-400 uppercase text-[10px]">
                          <tr className="border-b border-zinc-200 dark:border-zinc-800">
                            <th className="px-4 py-2 text-left font-semibold">Load</th>
                            <th className="px-4 py-2 text-left font-semibold">Lane</th>
                            <th className="px-4 py-2 text-right font-semibold">Linehaul</th>
                            <th className="px-4 py-2 text-right font-semibold pr-4">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                          {group.loads.map((load) => (<tr key={load.id}>
                              <td className="px-4 py-2 font-mono font-semibold text-zinc-800 dark:text-zinc-200">
                                {load.broker_load_id || `L-${load.id}`}
                              </td>
                              <td className="px-4 py-2 text-zinc-600 dark:text-zinc-300">
                                {load.origin} → {load.destination}
                              </td>
                              <td className="px-4 py-2 text-right tabular-nums">
                                {fmt(load.linehaul_rate)}
                              </td>
                              <td className="px-4 py-2 text-right pr-4 capitalize text-zinc-500">
                                {load.status}
                              </td>
                            </tr>))}
                        </tbody>
                      </table>
                    </div>
                  </div>)))}
            </div>
          </div>
        </div>)}
    </div>);
}
