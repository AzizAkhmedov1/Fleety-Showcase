'use client';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { Loader2, RefreshCw, Smartphone } from 'lucide-react';
import { createApiClient, formatApiError, hasValidTmsToken, normalizeBearerToken } from '@/lib/api-client';
import { createTmsApi, type DriverRecord, type MobileDeviceRow, } from '@/lib/tms-api';
interface MobileAppManagementProps {
    token: string | null;
}
const PROVISIONING_STYLES: Record<string, string> = {
    PAIRED: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
    PENDING_HANDSHAKE: 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400',
};
function formatTimestamp(value: string | null | undefined): string {
    if (!value)
        return '—';
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime()))
        return value;
    return parsed.toLocaleString('en-US', {
        month: '2-digit',
        day: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
}
export default function MobileAppManagement({ token }: MobileAppManagementProps) {
    const bearerToken = normalizeBearerToken(token);
    const client = useMemo(() => createTmsApi(createApiClient(bearerToken || null)), [bearerToken]);
    const [devices, setDevices] = useState<MobileDeviceRow[]>([]);
    const [drivers, setDrivers] = useState<DriverRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedDriverId, setSelectedDriverId] = useState<number | ''>('');
    const [generatingForDriverId, setGeneratingForDriverId] = useState<number | null>(null);
    const [latestPairingCode, setLatestPairingCode] = useState<string | null>(null);
    const [latestPairingExpiresAt, setLatestPairingExpiresAt] = useState<string | null>(null);
    const loadData = useCallback(async () => {
        if (!hasValidTmsToken(bearerToken)) {
            setLoading(false);
            return;
        }
        setLoading(true);
        try {
            const [deviceResponse, driverRows] = await Promise.all([
                client.mobile.devices(),
                client.fleet.drivers(),
            ]);
            setDevices(deviceResponse.devices);
            setDrivers(driverRows);
        }
        catch (err) {
            console.error('Failed to load mobile devices', err);
            toast.error(formatApiError(err, 'Unable to load mobile devices.'));
            setDevices([]);
        }
        finally {
            setLoading(false);
        }
    }, [bearerToken, client]);
    useEffect(() => {
        void loadData();
    }, [loadData]);
    const handleGeneratePairingCode = async (driverId: number) => {
        setGeneratingForDriverId(driverId);
        try {
            const result = await client.mobile.createPairingCode(driverId);
            setLatestPairingCode(result.pairing_code);
            setLatestPairingExpiresAt(result.expires_at);
            toast.success(`Pairing code ${result.pairing_code} generated.`);
            await loadData();
        }
        catch (err) {
            console.error('Failed to generate pairing code', err);
            toast.error(formatApiError(err, 'Unable to generate pairing code.'));
        }
        finally {
            setGeneratingForDriverId(null);
        }
    };
    const handleGenerateSelected = async () => {
        if (selectedDriverId === '') {
            toast.error('Select a driver first.');
            return;
        }
        await handleGeneratePairingCode(Number(selectedDriverId));
    };
    if (!hasValidTmsToken(bearerToken)) {
        return (<div className="text-sm text-zinc-500 dark:text-zinc-400">
        Sign in to manage mobile device provisioning.
      </div>);
    }
    return (<div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h2 className="text-xl font-black text-zinc-900 dark:text-white">Mobile App Management</h2>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
            Provision driver devices, monitor telemetry check-ins, and issue pairing codes.
          </p>
        </div>
        <button type="button" onClick={() => void loadData()} disabled={loading} className="inline-flex items-center gap-2 rounded-xl border border-zinc-200 dark:border-zinc-800 px-4 py-2 text-sm font-semibold text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors disabled:opacity-50">
          {loading ? <Loader2 size={16} className="animate-spin"/> : <RefreshCw size={16}/>}
          Refresh
        </button>
      </div>

      <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-[#0B0B0B] p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Smartphone size={18} className="text-violet-500"/>
          <h3 className="text-sm font-bold text-zinc-900 dark:text-white">Issue Pairing Code</h3>
        </div>
        <div className="flex flex-col gap-3 md:flex-row md:items-end">
          <label className="flex-1 space-y-1.5">
            <span className="text-xs font-bold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              Driver
            </span>
            <select value={selectedDriverId} onChange={(event) => setSelectedDriverId(event.target.value ? Number(event.target.value) : '')} className="w-full rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-3 py-2.5 text-sm text-zinc-900 dark:text-white">
              <option value="">Select driver</option>
              {drivers.map((driver) => (<option key={driver.id} value={driver.id}>
                  {driver.driver_name}
                </option>))}
            </select>
          </label>
          <button type="button" disabled={generatingForDriverId != null || selectedDriverId === ''} onClick={() => void handleGenerateSelected()} className="rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-violet-500 disabled:opacity-50 transition-colors">
            {generatingForDriverId != null ? 'Generating…' : 'Generate Code'}
          </button>
        </div>
        {latestPairingCode && (<div className="rounded-xl border border-violet-500/30 bg-violet-500/10 px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-violet-600 dark:text-violet-300">
              Active Setup String
            </p>
            <p className="mt-1 text-2xl font-black tracking-[0.35em] text-violet-700 dark:text-violet-200">
              {latestPairingCode}
            </p>
            <p className="mt-1 text-xs text-violet-700/80 dark:text-violet-300/80">
              Expires {formatTimestamp(latestPairingExpiresAt)}
            </p>
          </div>)}
      </div>

      <div className="overflow-x-auto rounded-2xl border border-zinc-200 dark:border-zinc-800">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/60 text-zinc-500 dark:text-zinc-400">
              {[
            'Driver',
            'Device Signature',
            'Provisioning State',
            'Last Ping',
            'Actions',
        ].map((column) => (<th key={column} className="px-4 py-3 font-semibold whitespace-nowrap">
                  {column}
                </th>))}
            </tr>
          </thead>
          <tbody>
            {loading ? (<tr>
                <td colSpan={5} className="px-4 py-10 text-center text-zinc-500">
                  <span className="inline-flex items-center gap-2">
                    <Loader2 size={16} className="animate-spin"/>
                    Loading devices…
                  </span>
                </td>
              </tr>) : devices.length === 0 ? (<tr>
                <td colSpan={5} className="px-4 py-10 text-center text-zinc-500">
                  No mobile devices provisioned yet.
                </td>
              </tr>) : (devices.map((device) => {
            const signature = [device.device_os, device.device_model].filter(Boolean).join(' · ') || '—';
            const stateStyle = PROVISIONING_STYLES[device.provisioning_state] ??
                PROVISIONING_STYLES.PENDING_HANDSHAKE;
            return (<tr key={device.id} className="border-b border-zinc-100 dark:border-zinc-800/60 hover:bg-zinc-50 dark:hover:bg-zinc-900/40">
                    <td className="px-4 py-3 font-medium text-zinc-900 dark:text-white whitespace-nowrap">
                      {device.driver_name || `Driver #${device.driver_id ?? '—'}`}
                    </td>
                    <td className="px-4 py-3 text-zinc-600 dark:text-zinc-300 whitespace-nowrap">
                      {signature}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold ${stateStyle}`}>
                        {device.provisioning_state.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400 tabular-nums whitespace-nowrap">
                      {formatTimestamp(device.last_ping_at)}
                    </td>
                    <td className="px-4 py-3">
                      {device.driver_id != null && (<button type="button" disabled={generatingForDriverId === device.driver_id} onClick={() => void handleGeneratePairingCode(device.driver_id!)} className="rounded-md border border-violet-500/30 px-2.5 py-1 text-[10px] font-semibold text-violet-700 dark:text-violet-300 hover:bg-violet-500/10 disabled:opacity-50">
                          {generatingForDriverId === device.driver_id ? 'Generating…' : 'New Code'}
                        </button>)}
                    </td>
                  </tr>);
        }))}
          </tbody>
        </table>
      </div>
    </div>);
}
