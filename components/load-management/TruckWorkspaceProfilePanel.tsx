'use client';
import TruckDetailModal from '@/components/modals/TruckDetailModal';
import type { DriverRecord, LoadRecord, TruckRecord } from '@/lib/tms-api';
interface TruckWorkspaceProfilePanelProps {
    truckId: number;
    token: string;
    trucks: TruckRecord[];
    drivers: DriverRecord[];
    loads: LoadRecord[];
    onClose: () => void;
    onRefresh: () => Promise<void>;
    onOpenDriver?: (driverId: number) => void;
    onOpenTrailer?: (truckId: number) => void;
}
export default function TruckWorkspaceProfilePanel({ truckId, token, trucks, drivers, loads, onClose, onRefresh, onOpenDriver, onOpenTrailer, }: TruckWorkspaceProfilePanelProps) {
    const truck = trucks.find((record) => record.id === truckId) ?? null;
    if (!truck) {
        return null;
    }
    return (<TruckDetailModal bare workspaceLayout token={token} truck={truck} drivers={drivers} trucks={trucks} loads={loads} onClose={onClose} onOpenDriver={onOpenDriver} onOpenTrailer={onOpenTrailer} onSuccess={onRefresh}/>);
}
