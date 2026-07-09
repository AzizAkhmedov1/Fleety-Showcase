'use client';
import { X } from 'lucide-react';
import { toPaddedUsDateDisplay } from '@/lib/load-dates';
import { formatTitleCaseLabel } from '@/lib/display-labels';
import { type LoadTableColumnFilters, type LoadTableColumnId, } from '@/lib/load-table-columns';
type FilterableColumnId = Exclude<LoadTableColumnId, 'actions'>;
const FILTER_BADGE_ORDER: FilterableColumnId[] = [
    'pickupDate',
    'deliveryDate',
    'status',
    'broker',
    'loadId',
    'route',
    'rate',
    'rpm',
    'driver',
    'truck',
    'trailer',
];
const BADGE_CLASS = 'inline-flex items-center gap-1 bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700/60 text-zinc-800 dark:text-zinc-200 pl-2 pr-1 py-1 rounded-md text-xs font-semibold shadow-sm select-none hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors';
const CLEAR_CLASS = 'w-3.5 h-3.5 text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors p-0.5 rounded hover:bg-zinc-200 dark:hover:bg-zinc-700/80 cursor-pointer';
function resolveFilterBadgeLabel(columnId: FilterableColumnId, rawValue: string): string {
    const value = rawValue.trim();
    if (!value)
        return '';
    switch (columnId) {
        case 'pickupDate': {
            const display = toPaddedUsDateDisplay(value) ?? value;
            return `PU: ${display}`;
        }
        case 'deliveryDate': {
            const display = toPaddedUsDateDisplay(value) ?? value;
            return `DEL: ${display}`;
        }
        case 'status':
            return `Status: ${formatTitleCaseLabel(value)}`;
        case 'broker':
            return `Broker: ${value}`;
        case 'loadId':
            return `Load ID: ${value}`;
        case 'route':
            return `Route: ${value}`;
        case 'rate':
            return `Rate: ${value}`;
        case 'rpm':
            return `RPM: ${value}`;
        case 'driver':
            return `Driver: ${value}`;
        case 'truck':
            return `Truck: ${value}`;
        case 'trailer':
            return `Trailer: ${value}`;
        default:
            return `${columnId}: ${value}`;
    }
}
interface LoadTableToolbarProps {
    filters: LoadTableColumnFilters;
    onFilterChange: (columnId: FilterableColumnId, value: string) => void;
}
export default function LoadTableToolbar({ filters, onFilterChange }: LoadTableToolbarProps) {
    const activeFilters = FILTER_BADGE_ORDER.flatMap((columnId) => {
        const value = filters[columnId]?.trim();
        if (!value)
            return [];
        return [{ columnId, label: resolveFilterBadgeLabel(columnId, value) }];
    });
    if (activeFilters.length === 0)
        return null;
    return (<div className="flex items-center flex-wrap gap-1.5 ml-3 animate-in fade-in duration-200">
      {activeFilters.map(({ columnId, label }) => (<span key={columnId} className={BADGE_CLASS}>
          {label}
          <button type="button" onClick={() => onFilterChange(columnId, '')} className={CLEAR_CLASS} aria-label={`Clear ${label}`}>
            <X className="w-3 h-3" aria-hidden/>
          </button>
        </span>))}
    </div>);
}
