'use client';
import React, { useCallback } from 'react';
import { UserCircle } from 'lucide-react';
import { formatTitleCaseLabel } from '@/lib/display-labels';
import StatusDropdown from '@/components/ui/StatusDropdown';
import type { DriverRecord, TruckRecord } from '@/lib/tms-api';
import { TRUCK_STATUS_OPTIONS, TRUCK_STATUS_STYLES, normalizeTruckStatus, } from '@/lib/fleet-truck-status';
import { extractTrailerMetadata, formatMakeModel } from '@/lib/trailer-metadata';
interface ActiveAssetStatusBoardProps {
    filteredTrucks: TruckRecord[];
    totalTruckCount: number;
    allTrucks: TruckRecord[];
    drivers: DriverRecord[];
    searchQuery: string;
    updatingTruckStatusId: number | null;
    onTruckStatusChange: (truckId: number, nextStatus: string) => void | Promise<void>;
    onAssetProfileClick: (truck: TruckRecord) => void;
}
function AssetDriverCell({ primaryName, coName, }: {
    primaryName: string | null | undefined;
    coName: string | null | undefined;
}) {
    if (primaryName) {
        return (<div className="leading-snug">
        <span className="font-semibold">{primaryName}</span>
        {coName ? (<>
            <span className="text-zinc-400 dark:text-zinc-500"> / </span>
            <span className="text-zinc-400 dark:text-zinc-500 font-medium">{coName}</span>
          </>) : null}
      </div>);
    }
    return (<span className="text-amber-600 dark:text-amber-500 font-semibold text-xs bg-amber-50 dark:bg-amber-900/20 px-2 py-0.5 rounded border border-amber-200 dark:border-amber-800/50 transition-colors">
      Needs Driver
    </span>);
}
export default function ActiveAssetStatusBoard({ filteredTrucks, totalTruckCount, allTrucks, drivers, searchQuery, updatingTruckStatusId, onTruckStatusChange, onAssetProfileClick, }: ActiveAssetStatusBoardProps) {
    const getAssetDriverDisplay = useCallback((truck: TruckRecord) => {
        const primaryId = truck.driver_id;
        const coId = truck.co_driver_id;
        const canonicalPrimaryTruckId = primaryId != null
            ? allTrucks
                .filter((t) => t.driver_id === primaryId)
                .reduce<number | null>((best, t) => (best == null || t.id < best ? t.id : best), null)
            : null;
        const primarySuppressed = primaryId != null &&
            canonicalPrimaryTruckId != null &&
            canonicalPrimaryTruckId !== truck.id;
        const primaryName = primarySuppressed
            ? null
            : truck.driver_name || drivers.find((d) => d.id === primaryId)?.driver_name;
        const coIsPrimaryElsewhere = coId != null && allTrucks.some((other) => other.id !== truck.id && other.driver_id === coId);
        const coName = coIsPrimaryElsewhere
            ? null
            : truck.co_driver_name || drivers.find((d) => d.id === coId)?.driver_name;
        return { primaryName, coName };
    }, [allTrucks, drivers]);
    return (<section id="active-asset-board" className="bg-white dark:bg-[#161616] rounded-2xl shadow-sm border border-zinc-200 dark:border-zinc-800 overflow-hidden transition-colors">
      <div className="p-5 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/80 transition-colors">
        <h2 className="font-bold text-base text-zinc-900 dark:text-white">Trucks &amp; Power Status Board</h2>
        {searchQuery.trim() ? (<p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
            Showing {filteredTrucks.length} of {totalTruckCount} units matching &ldquo;{searchQuery.trim()}&rdquo;
          </p>) : null}
      </div>

      {filteredTrucks.length === 0 ? (<div className="p-8 text-center text-zinc-400 dark:text-zinc-500 text-sm dark:bg-[#161616]">
          {searchQuery.trim() ? 'No fleet units match your search.' : 'No trucks registered in system yet.'}
        </div>) : (<div className="w-full overflow-x-auto">
          <table className="w-full text-left dark:bg-[#161616] min-w-[480px] md:min-w-[920px]">
            <thead className="bg-zinc-50 dark:bg-zinc-950 text-zinc-500 dark:text-zinc-400 text-xs font-semibold border-b border-zinc-200 dark:border-zinc-800 transition-colors">
              <tr>
                <th className="p-4 w-36">Unit #</th>
                <th className="p-4 hidden md:table-cell">Make / Model</th>
                <th className="p-4">Assigned Driver</th>
                <th className="p-4 hidden md:table-cell">Ownership</th>
                <th className="p-4">Duty Status</th>
                <th className="p-4 text-right">Profile</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800 text-sm transition-colors dark:bg-[#161616]">
              {filteredTrucks.map((truck) => {
                const { primaryName, coName } = getAssetDriverDisplay(truck);
                const truckStatus = normalizeTruckStatus(truck.status);
                const truckStatusClass = TRUCK_STATUS_STYLES[truckStatus];
                const isUpdatingTruckStatus = updatingTruckStatusId === truck.id;
                const metadata = extractTrailerMetadata(truck);
                return (<tr key={truck.id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-900/60 dark:bg-zinc-950/20 transition-colors">
                    <td className="p-4 font-bold text-zinc-900 dark:text-white">#{truck.truck_number}</td>
                    <td className="p-4 text-zinc-600 dark:text-zinc-200 hidden md:table-cell">{formatMakeModel(metadata)}</td>
                    <td className="p-4 font-medium text-zinc-900 dark:text-zinc-200">
                      <AssetDriverCell primaryName={primaryName} coName={coName}/>
                    </td>
                    <td className="p-4 text-zinc-700 dark:text-zinc-200 hidden md:table-cell">
                      <span className="text-xs font-semibold tracking-wide bg-zinc-100 dark:bg-zinc-800/80 text-zinc-700 dark:text-zinc-200 px-2 py-0.5 rounded-md border border-zinc-200 dark:border-zinc-700">
                        {metadata.ownershipType}
                      </span>
                    </td>
                    <td className="p-4">
                      <StatusDropdown value={truckStatus} options={TRUCK_STATUS_OPTIONS} onSelect={(nextStatus) => void onTruckStatusChange(truck.id, nextStatus)} badgeClass={truckStatusClass} formatLabel={formatTitleCaseLabel} disabled={isUpdatingTruckStatus} minWidthClass="min-w-[168px]"/>
                    </td>
                    <td className="p-4 text-right">
                      <button type="button" onClick={() => onAssetProfileClick(truck)} className="text-xs font-bold bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 hover:text-zinc-900 dark:hover:text-white px-3 py-2 rounded-lg transition-colors inline-flex items-center gap-1 shadow-sm border border-zinc-200 dark:border-zinc-800">
                        <UserCircle size={14}/> View Unit
                      </button>
                    </td>
                  </tr>);
            })}
            </tbody>
          </table>
        </div>)}
    </section>);
}
