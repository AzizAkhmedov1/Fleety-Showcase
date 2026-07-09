'use client';
import { useState } from 'react';
import dynamic from 'next/dynamic';
import { AlertTriangle, CheckCircle, Navigation, Truck, Wrench, } from 'lucide-react';
import { useDashboard } from '@/contexts/DashboardContext';
const DriverPlanningBoard = dynamic(() => import('@/components/DriverPlanningBoard'), {
    ssr: false,
    loading: () => (<div className="animate-pulse bg-zinc-100 dark:bg-zinc-800 rounded-xl h-[420px] w-full"/>),
});
const ActiveAssetStatusBoard = dynamic(() => import('@/components/fleet/ActiveAssetStatusBoard'), { ssr: false });
const TrailerStatusBoard = dynamic(() => import('@/components/fleet/TrailerStatusBoard'), {
    ssr: false,
});
export default function FleetAssetsBoard() {
    const { token, trucks, drivers, fleetTrucks, filteredFleetTrucks, searchQuery, fleetMetrics, fleetWindowStart, fleetWindowEnd, planningBoardRefreshKey, setActiveDriverVault, updatingTruckStatusId, handleTruckStatusChange, handleAssetProfileClick, updateTruck, } = useDashboard();
    const [activeFleetSubTab, setActiveFleetSubTab] = useState<'drivers' | 'trucks' | 'trailers'>('drivers');
    return (<div className="space-y-6 animate-in fade-in duration-200">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-white dark:bg-zinc-900/40 border border-zinc-200 dark:border-zinc-800/80 rounded-xl p-4 shadow-sm transition-colors">
          <div className="flex items-center justify-between">
            <p className="text-zinc-500 dark:text-zinc-400 text-[11px] font-semibold">
              Total Vehicles
            </p>
            <Truck size={16} className="text-zinc-400 dark:text-zinc-500"/>
          </div>
          <p className="text-2xl font-bold text-zinc-900 dark:text-white mt-2">
            {fleetMetrics.totalVehicles}
          </p>
        </div>
        <div className="bg-white dark:bg-zinc-900/40 border border-zinc-200 dark:border-zinc-800/80 rounded-xl p-4 shadow-sm transition-colors">
          <div className="flex items-center justify-between">
            <p className="text-zinc-500 dark:text-zinc-400 text-[11px] font-semibold">
              Active Vehicles
            </p>
            <CheckCircle size={16} className="text-emerald-500 dark:text-emerald-400"/>
          </div>
          <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-2">
            {fleetMetrics.activeVehicles}
          </p>
        </div>
        <div className="bg-white dark:bg-zinc-900/40 border border-zinc-200 dark:border-zinc-800/80 rounded-xl p-4 shadow-sm transition-colors">
          <div className="flex items-center justify-between">
            <p className="text-zinc-500 dark:text-zinc-400 text-[11px] font-semibold">
              In Transit
            </p>
            <Navigation size={16} className="text-blue-500 dark:text-blue-400"/>
          </div>
          <p className="text-2xl font-bold text-blue-600 dark:text-blue-400 mt-2">
            {fleetMetrics.inTransit}
          </p>
        </div>
        <div className="bg-white dark:bg-zinc-900/40 border border-zinc-200 dark:border-zinc-800/80 rounded-xl p-4 shadow-sm transition-colors">
          <div className="flex items-center justify-between">
            <p className="text-zinc-500 dark:text-zinc-400 text-[11px] font-semibold">
              Maintenance Due
            </p>
            <Wrench size={16} className="text-amber-500 dark:text-amber-400"/>
          </div>
          <p className="text-2xl font-bold text-amber-600 dark:text-amber-400 mt-2">
            {fleetMetrics.maintenanceDue}
          </p>
        </div>
        <div className="bg-white dark:bg-zinc-900/40 border border-zinc-200 dark:border-zinc-800/80 rounded-xl p-4 shadow-sm transition-colors">
          <div className="flex items-center justify-between">
            <p className="text-zinc-500 dark:text-zinc-400 text-[11px] font-semibold">
              Out of Service
            </p>
            <AlertTriangle size={16} className="text-rose-500 dark:text-rose-400"/>
          </div>
          <p className="text-2xl font-bold text-rose-600 dark:text-rose-400 mt-2">
            {fleetMetrics.outOfService}
          </p>
        </div>
      </div>

      <nav className="flex gap-6 border-b border-zinc-200 dark:border-zinc-800">
        <button type="button" onClick={() => setActiveFleetSubTab('drivers')} className={`text-sm font-semibold pb-2 transition-colors ${activeFleetSubTab === 'drivers'
            ? 'text-zinc-900 dark:text-white border-b-2 border-blue-500 -mb-[2px]'
            : 'text-zinc-400 hover:text-zinc-300'}`}>
          Drivers
        </button>
        <button type="button" onClick={() => setActiveFleetSubTab('trucks')} className={`text-sm font-semibold pb-2 transition-colors ${activeFleetSubTab === 'trucks'
            ? 'text-zinc-900 dark:text-white border-b-2 border-blue-500 -mb-[2px]'
            : 'text-zinc-400 hover:text-zinc-300'}`}>
          Trucks
        </button>
        <button type="button" onClick={() => setActiveFleetSubTab('trailers')} className={`text-sm font-semibold pb-2 transition-colors ${activeFleetSubTab === 'trailers'
            ? 'text-zinc-900 dark:text-white border-b-2 border-blue-500 -mb-[2px]'
            : 'text-zinc-400 hover:text-zinc-300'}`}>
          Trailers
        </button>
      </nav>

      {activeFleetSubTab === 'drivers' ? (<DriverPlanningBoard token={token || ''} trucks={trucks} searchQuery={searchQuery} onViewDocuments={(driverId) => setActiveDriverVault(driverId)} refreshKey={planningBoardRefreshKey} startDate={fleetWindowStart} endDate={fleetWindowEnd}/>) : null}

      {activeFleetSubTab === 'trucks' ? (<ActiveAssetStatusBoard filteredTrucks={filteredFleetTrucks} totalTruckCount={fleetTrucks.length} allTrucks={trucks} drivers={drivers} searchQuery={searchQuery} updatingTruckStatusId={updatingTruckStatusId} onTruckStatusChange={handleTruckStatusChange} onAssetProfileClick={handleAssetProfileClick}/>) : null}

      {activeFleetSubTab === 'trailers' ? (<TrailerStatusBoard trucks={trucks} updateTruck={updateTruck}/>) : null}
    </div>);
}
