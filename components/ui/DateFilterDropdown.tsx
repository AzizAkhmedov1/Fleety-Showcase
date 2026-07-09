'use client';
import React, { useState } from 'react';
import { Calendar as CalendarIcon, ChevronDown } from 'lucide-react';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { formatUsDate, toIsoDate } from '@/lib/fleet-financial-metrics';
import { parseUsFilterStringToDate } from '@/lib/load-dates';
export type DateFilterPresetOption<T extends string = string> = {
    id: T;
    label: string;
};
type DateFilterDropdownProps<T extends string = string> = {
    menuRef: React.RefObject<HTMLDivElement | null>;
    isOpen: boolean;
    onToggle: () => void;
    presets: DateFilterPresetOption<T>[];
    activePreset: T;
    dateFrom: string;
    dateTo: string;
    onPresetSelect: (preset: T) => void;
    onCustomDateChange: (field: 'start' | 'end', value: string) => void;
    menuAriaLabel: string;
    buttonLabel: string;
    align?: 'left' | 'right';
    customPresetId?: T;
    startDateAriaLabel?: string;
    endDateAriaLabel?: string;
};
const presetOptionClass = (isActive: boolean) => isActive
    ? 'bg-zinc-100 dark:bg-zinc-800 text-sky-600 dark:text-sky-400 font-semibold text-left px-3 py-2 text-xs rounded-md w-full'
    : 'w-full text-left px-3 py-2 text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800/60 hover:text-zinc-900 dark:hover:text-zinc-200 rounded-md transition-colors';
const BOUNDARY_TRIGGER_CLASS = 'flex-1 min-w-0 w-full flex items-center justify-center bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg px-2 py-1.5 text-xs text-zinc-900 dark:text-zinc-100 font-semibold focus:outline-none transition-all cursor-pointer h-[32px]';
type CustomDateBoundaryFieldProps = {
    isoValue: string;
    ariaLabel: string;
    onSelect: (isoValue: string) => void;
};
function CustomDateBoundaryField({ isoValue, ariaLabel, onSelect }: CustomDateBoundaryFieldProps) {
    const [open, setOpen] = useState(false);
    const displayText = formatUsDate(isoValue) || '—';
    const selectedDate = parseUsFilterStringToDate(isoValue);
    const handleSelect = (date: Date | undefined) => {
        if (!date)
            return;
        onSelect(toIsoDate(date));
        setOpen(false);
    };
    return (<div className="flex flex-1 min-w-0 w-full">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger type="button" aria-label={ariaLabel} onMouseDown={(event) => event.stopPropagation()} className={BOUNDARY_TRIGGER_CLASS}>
          <span className={`tabular-nums truncate ${displayText === '—' ? 'text-zinc-500 dark:text-zinc-500' : ''}`}>
            {displayText}
          </span>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-3 bg-zinc-950 border border-zinc-800 rounded-xl shadow-2xl z-50" align="center" side="bottom" sideOffset={6} onMouseDown={(event) => event.stopPropagation()}>
          <Calendar mode="single" selected={selectedDate} onSelect={handleSelect}/>
        </PopoverContent>
      </Popover>
    </div>);
}
export default function DateFilterDropdown<T extends string = string>({ menuRef, isOpen, onToggle, presets, activePreset, dateFrom, dateTo, onPresetSelect, onCustomDateChange, menuAriaLabel, buttonLabel, align = 'right', customPresetId = 'custom' as T, startDateAriaLabel = 'Filter start date', endDateAriaLabel = 'Filter end date', }: DateFilterDropdownProps<T>) {
    const showCustomRange = activePreset === customPresetId;
    return (<div className="relative shrink-0" ref={menuRef}>
      <button type="button" onClick={onToggle} aria-expanded={isOpen} aria-haspopup="menu" className="bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-2 text-sm font-medium hover:bg-zinc-100 dark:hover:bg-zinc-800/80 transition-all flex items-center gap-2 text-zinc-700 dark:text-zinc-200 shadow-sm">
        <CalendarIcon className="w-4 h-4 text-zinc-400" aria-hidden/>
        <span>{buttonLabel}</span>
        <ChevronDown className={`w-4 h-4 text-zinc-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} aria-hidden/>
      </button>

      {isOpen ? (<div className={`absolute ${align === 'left' ? 'left-0' : 'right-0'} mt-2 w-72 z-50 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#161616] shadow-xl p-1 flex flex-col space-y-0.5 animate-in fade-in slide-in-from-top-2 duration-150 overflow-hidden`} role="menu" aria-label={menuAriaLabel} onMouseDown={(event) => event.stopPropagation()}>
          {presets.map((preset) => (<button key={preset.id} type="button" role="menuitem" onClick={() => onPresetSelect(preset.id)} className={presetOptionClass(activePreset === preset.id)}>
              {preset.label}
            </button>))}

          {showCustomRange ? (<div className="w-full flex items-center justify-between gap-2 p-3 border-t border-zinc-100 dark:border-zinc-800/80 min-w-0">
              <CustomDateBoundaryField isoValue={dateFrom} ariaLabel={startDateAriaLabel} onSelect={(value) => onCustomDateChange('start', value)}/>
              <span className="text-[9px] uppercase tracking-widest text-zinc-500 font-bold shrink-0">
                to
              </span>
              <CustomDateBoundaryField isoValue={dateTo} ariaLabel={endDateAriaLabel} onSelect={(value) => onCustomDateChange('end', value)}/>
            </div>) : null}
        </div>) : null}
    </div>);
}
export function resolveDateFilterButtonLabel<T extends string>(presets: DateFilterPresetOption<T>[], activePreset: T, dateFrom: string, dateTo: string, customPresetId: T = 'custom' as T): string {
    if (activePreset === customPresetId) {
        if (dateFrom && dateTo) {
            return `${formatUsDate(dateFrom)} – ${formatUsDate(dateTo)}`;
        }
        return presets.find((preset) => preset.id === customPresetId)?.label ?? 'Custom';
    }
    return presets.find((preset) => preset.id === activePreset)?.label ?? 'Date Filter';
}
