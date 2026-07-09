'use client';
import { useEffect, useRef, useState, type MouseEvent } from 'react';
import { ChevronDown, ChevronsUpDown, Search, X } from 'lucide-react';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { dateToPaddedUsFilterString, parseUsFilterStringToDate, toPaddedUsDateDisplay, } from '@/lib/load-dates';
import { LOAD_TABLE_COLUMN_LABELS, LOAD_TABLE_STATUS_FILTER_OPTIONS, type LoadTableColumnId, } from '@/lib/load-table-columns';
import { formatTitleCaseLabel } from '@/lib/display-labels';
const HEADER_SHELL_CLASS = 'text-[10px] font-semibold text-zinc-900 dark:text-zinc-100 px-4 py-3 text-left whitespace-nowrap bg-zinc-50 dark:bg-[#0B0B0B]';
const FILTER_INPUT_CLASS = 'w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-3 py-2 text-xs text-zinc-900 dark:text-zinc-100 outline-none focus:border-sky-500 dark:focus:border-sky-500 transition-colors';
const STATUS_FILTER_TRIGGER_CLASS = 'w-full flex items-center justify-between text-xs font-semibold text-zinc-700 dark:text-zinc-300 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg px-2.5 py-1.5 outline-none shadow-sm cursor-pointer disabled:opacity-50';
const STATUS_FILTER_MENU_CLASS = 'absolute left-0 right-0 z-30 mt-1 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-2xl p-1.5 flex flex-col gap-0.5 min-w-[150px]';
const STATUS_FILTER_OPTION_CLASS = 'w-full px-3 py-1.5 text-left text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors';
interface DateFilterPanelProps {
    columnId: 'pickupDate' | 'deliveryDate';
    filterValue: string;
    onFilterChange: (columnId: 'pickupDate' | 'deliveryDate', value: string) => void;
    label: string;
}
function DateFilterPanel({ columnId, filterValue, onFilterChange, label, }: DateFilterPanelProps) {
    const displayText = toPaddedUsDateDisplay(filterValue);
    const selectedDate = parseUsFilterStringToDate(filterValue);
    const handleClear = (event: MouseEvent<HTMLButtonElement>) => {
        event.stopPropagation();
        event.preventDefault();
        onFilterChange(columnId, '');
    };
    const handleSelect = (date: Date | undefined) => {
        if (!date)
            return;
        onFilterChange(columnId, dateToPaddedUsFilterString(date));
    };
    return (<div className="flex flex-col gap-2 min-w-[240px]">
      <div className="flex items-center justify-between gap-2 px-1">
        <span className={`text-xs font-semibold truncate ${displayText ? 'text-zinc-100' : 'text-zinc-500'}`}>
          {displayText ?? 'Select date...'}
        </span>
        {displayText ? (<button type="button" onClick={handleClear} className="shrink-0 p-1 rounded-md transition-colors hover:bg-zinc-800 cursor-pointer" aria-label={`Clear ${label} filter`}>
            <X className="w-3.5 h-3.5 text-zinc-400 dark:text-zinc-500 hover:text-zinc-300" aria-hidden/>
          </button>) : null}
      </div>
      <Calendar mode="single" selected={selectedDate} onSelect={handleSelect}/>
    </div>);
}
interface StatusFilterDropdownProps {
    filterValue: string;
    onFilterChange: (value: string) => void;
}
function StatusFilterDropdown({ filterValue, onFilterChange }: StatusFilterDropdownProps) {
    const [isStatusFilterOpen, setIsStatusFilterOpen] = useState(false);
    const statusFilterRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
        const handleClickOutside = (event: globalThis.MouseEvent) => {
            if (statusFilterRef.current &&
                !statusFilterRef.current.contains(event.target as Node)) {
                setIsStatusFilterOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);
    const displayLabel = filterValue ? formatTitleCaseLabel(filterValue) : 'All statuses';
    const handleSelect = (value: string) => {
        onFilterChange(value);
        setIsStatusFilterOpen(false);
    };
    return (<div ref={statusFilterRef} className="relative">
      <button type="button" onClick={() => setIsStatusFilterOpen((open) => !open)} className={STATUS_FILTER_TRIGGER_CLASS} aria-expanded={isStatusFilterOpen} aria-haspopup="listbox" aria-label="Filter status">
        <span className="truncate">{displayLabel}</span>
        <ChevronDown size={14} className={`shrink-0 text-zinc-500 transition-transform duration-200 ${isStatusFilterOpen ? 'rotate-180' : ''}`} aria-hidden/>
      </button>
      {isStatusFilterOpen ? (<div className={STATUS_FILTER_MENU_CLASS} role="listbox">
          <button type="button" role="option" aria-selected={!filterValue} onClick={() => handleSelect('')} className={STATUS_FILTER_OPTION_CLASS}>
            All statuses
          </button>
          {LOAD_TABLE_STATUS_FILTER_OPTIONS.map((option) => (<button key={option} type="button" role="option" aria-selected={filterValue === option} onClick={() => handleSelect(option)} className={STATUS_FILTER_OPTION_CLASS}>
              {formatTitleCaseLabel(option)}
            </button>))}
        </div>) : null}
    </div>);
}
interface LoadTableColumnHeaderProps {
    columnId: LoadTableColumnId;
    className?: string;
    align?: 'left' | 'right' | 'center';
    filterValue: string;
    onFilterChange: (value: string) => void;
    sortColumn: LoadTableColumnId | null;
    onSort: (columnId: LoadTableColumnId) => void;
}
export default function LoadTableColumnHeader({ columnId, className = '', align = 'left', filterValue, onFilterChange, sortColumn, onSort, }: LoadTableColumnHeaderProps) {
    const label = LOAD_TABLE_COLUMN_LABELS[columnId];
    const isSorted = sortColumn === columnId;
    const alignClass = align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left';
    const isPickupDateColumn = columnId === 'pickupDate';
    const isDeliveryDateColumn = columnId === 'deliveryDate';
    const isDateColumn = isPickupDateColumn || isDeliveryDateColumn;
    const handleDateFilterChange = (targetColumnId: 'pickupDate' | 'deliveryDate', value: string) => {
        if (targetColumnId !== columnId)
            return;
        onFilterChange(value);
    };
    if (columnId === 'actions') {
        return (<th className={`${HEADER_SHELL_CLASS} ${alignClass} ${className}`}>
        <span>{label}</span>
      </th>);
    }
    return (<th className={`${HEADER_SHELL_CLASS} ${alignClass} ${className}`}>
      <Popover>
        <div className="relative flex items-center gap-x-1.5 justify-between min-w-0">
          <button type="button" onClick={() => onSort(columnId)} className="shrink-0 rounded p-0.5 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors" aria-label={`Sort ${label}`}>
            <ChevronsUpDown size={12} className={isSorted ? 'text-violet-500 dark:text-violet-400' : undefined}/>
          </button>
          <span className="min-w-0 flex-1 truncate">{label}</span>
          <PopoverTrigger type="button" className={`shrink-0 rounded p-0.5 transition-colors ${filterValue.trim()
            ? 'text-sky-600 dark:text-sky-400'
            : 'text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200'}`} aria-label={`Filter ${label}`}>
            <Search size={12}/>
          </PopoverTrigger>
        </div>
        <PopoverContent align="center" side="bottom" sideOffset={4} collisionPadding={12} className={isDateColumn
            ? 'w-auto p-3 bg-zinc-950 border border-zinc-800 rounded-xl shadow-2xl z-[90]'
            : 'w-56 p-2'}>
          {columnId === 'status' ? (<StatusFilterDropdown filterValue={filterValue} onFilterChange={onFilterChange}/>) : isPickupDateColumn ? (<DateFilterPanel columnId="pickupDate" filterValue={filterValue} onFilterChange={handleDateFilterChange} label={label}/>) : isDeliveryDateColumn ? (<DateFilterPanel columnId="deliveryDate" filterValue={filterValue} onFilterChange={handleDateFilterChange} label={label}/>) : (<input type="text" value={filterValue} onChange={(event) => onFilterChange(event.target.value)} placeholder="Search" className={FILTER_INPUT_CLASS} aria-label={`Search ${label}`}/>)}
        </PopoverContent>
      </Popover>
    </th>);
}
export { HEADER_SHELL_CLASS };
