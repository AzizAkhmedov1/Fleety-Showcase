'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { createApiClient, hasValidTmsToken, normalizeBearerToken } from '@/lib/api-client';
import { createTmsApi } from '@/lib/tms-api';
import { getCarrierId } from '@/lib/auth';
import type { AnalyticsSummary, DriverRecord, EtaBoardRow, FuelEntryRecord, IftaSummary, LoadRecord, TruckRecord, } from '@/lib/tms-api';
const emptyAnalytics: AnalyticsSummary = {
    monthly_gross: 0,
    monthly_net: 0,
    monthly_rpm: 0,
    monthly_gross_rpm: 0,
    monthly_net_rpm: 0,
    monthly_miles: 0,
    monthly_loaded_miles: 0,
    monthly_deadhead_miles: 0,
    monthly_fleet_miles: 0,
};
const emptyIfta: IftaSummary = {
    total_gallons: 0,
    total_fuel_cost: 0,
    fleet_mpg: 0,
    state_breakdown: [],
};
export function useTMSData(token: string | null, timeRange: '30d' | 'all' | null) {
    const bearerToken = normalizeBearerToken(token);
    const client = useMemo(() => createApiClient(bearerToken || null), [bearerToken]);
    const api = useMemo(() => createTmsApi(client), [client]);
    const carrierId = useMemo(() => getCarrierId(bearerToken || null), [bearerToken]);
    const [activeLoads, setActiveLoads] = useState<LoadRecord[]>([]);
    const [drivers, setDrivers] = useState<DriverRecord[]>([]);
    const [trucks, setTrucks] = useState<TruckRecord[]>([]);
    const [fuelHistory, setFuelHistory] = useState<FuelEntryRecord[]>([]);
    const [iftaData, setIftaData] = useState<IftaSummary>(emptyIfta);
    const [analytics, setAnalytics] = useState<AnalyticsSummary>(emptyAnalytics);
    const [companySlug, setCompanySlug] = useState('');
    const [etaBoard, setEtaBoard] = useState<EtaBoardRow[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const patchTruck = useCallback((updatedTruck: TruckRecord) => {
        setTrucks((prev) => prev.map((truck) => (truck.id === updatedTruck.id ? { ...truck, ...updatedTruck } : truck)));
    }, []);
    const refresh = useCallback(async () => {
        if (!hasValidTmsToken(bearerToken) || !timeRange)
            return;
        setLoading(true);
        setError(null);
        try {
            const [activeRes, driversRes, trucksRes, analyticsRes, fuelRes, iftaRes] = await Promise.all([
                api.loads.listActive(),
                api.fleet.drivers(),
                api.fleet.trucks(),
                api.analytics.get(timeRange),
                api.fuel.list(),
                api.ifta.summary(),
            ]);
            setActiveLoads(activeRes);
            setDrivers(driversRes);
            setTrucks(trucksRes);
            setAnalytics(analyticsRes);
            setFuelHistory(fuelRes);
            setIftaData(iftaRes);
            try {
                const company = await api.company.me();
                setCompanySlug((company.slug || '').trim());
            }
            catch {
                setCompanySlug('');
            }
            try {
                const eta = await api.telemetry.etaBoard();
                setEtaBoard(eta.rows || []);
            }
            catch {
                setEtaBoard([]);
            }
        }
        catch (err: any) {
            const detail = err.response?.data?.detail;
            setError(typeof detail === 'string' ? detail : 'Failed to sync with server.');
            throw err;
        }
        finally {
            setLoading(false);
        }
    }, [api, bearerToken, timeRange]);
    const refreshActiveLoads = useCallback(async () => {
        if (!hasValidTmsToken(bearerToken))
            return;
        try {
            const activeRes = await api.loads.listActive();
            setActiveLoads(activeRes);
        }
        catch (err) {
            console.error('Active loads refresh failed:', err);
        }
    }, [api, bearerToken]);
    const refreshFuel = useCallback(async () => {
        if (!hasValidTmsToken(bearerToken))
            return;
        const [fuelRes, iftaRes] = await Promise.all([api.fuel.list(), api.ifta.summary()]);
        setFuelHistory(fuelRes);
        setIftaData(iftaRes);
    }, [api, bearerToken]);
    useEffect(() => {
        if (!hasValidTmsToken(bearerToken) || !timeRange) {
            setActiveLoads([]);
            setDrivers([]);
            setTrucks([]);
            setFuelHistory([]);
            setIftaData(emptyIfta);
            setAnalytics(emptyAnalytics);
            setCompanySlug('');
            setEtaBoard([]);
            setError(null);
            setLoading(false);
            return;
        }
        refresh().catch(() => undefined);
    }, [bearerToken, timeRange, refresh]);
    return {
        api,
        carrierId,
        activeLoads,
        drivers,
        trucks,
        fuelHistory,
        iftaData,
        analytics,
        companySlug,
        etaBoard,
        loading,
        error,
        refresh,
        refreshActiveLoads,
        refreshFuel,
        patchTruck,
        setEtaBoard,
        setCompanySlug,
    };
}
