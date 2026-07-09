'use client';
import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
interface CalendarProps {
    mode?: 'single';
    selected?: Date;
    onSelect?: (date: Date | undefined) => void;
    className?: string;
}
const WEEKDAY_LABELS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
function isSameDay(left: Date, right: Date): boolean {
    return (left.getFullYear() === right.getFullYear() &&
        left.getMonth() === right.getMonth() &&
        left.getDate() === right.getDate());
}
export function Calendar({ mode = 'single', selected, onSelect, className = '', }: CalendarProps) {
    const [viewDate, setViewDate] = useState(() => selected ?? new Date());
    useEffect(() => {
        if (selected) {
            setViewDate(selected);
        }
    }, [selected]);
    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();
    const calendarCells = useMemo(() => {
        const firstWeekday = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const daysInPrevMonth = new Date(year, month, 0).getDate();
        const cells: Array<{
            date: Date;
            inMonth: boolean;
        }> = [];
        for (let index = firstWeekday - 1; index >= 0; index -= 1) {
            const day = daysInPrevMonth - index;
            cells.push({ date: new Date(year, month - 1, day), inMonth: false });
        }
        for (let day = 1; day <= daysInMonth; day += 1) {
            cells.push({ date: new Date(year, month, day), inMonth: true });
        }
        while (cells.length % 7 !== 0) {
            const nextDay = cells.length - firstWeekday - daysInMonth + 1;
            cells.push({ date: new Date(year, month + 1, nextDay), inMonth: false });
        }
        return cells;
    }, [month, year]);
    const monthLabel = viewDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    const handleSelect = (date: Date) => {
        if (mode !== 'single')
            return;
        onSelect?.(date);
    };
    return (<div className={className}>
      <div className="flex items-center justify-between mb-3 px-1">
        <button type="button" onClick={() => setViewDate(new Date(year, month - 1, 1))} className="p-1 rounded-md text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors" aria-label="Previous month">
          <ChevronLeft size={16}/>
        </button>
        <span className="text-sm font-semibold text-zinc-100">{monthLabel}</span>
        <button type="button" onClick={() => setViewDate(new Date(year, month + 1, 1))} className="p-1 rounded-md text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors" aria-label="Next month">
          <ChevronRight size={16}/>
        </button>
      </div>
      <div className="grid grid-cols-7 gap-1 mb-1">
        {WEEKDAY_LABELS.map((label) => (<div key={label} className="h-8 flex items-center justify-center text-[10px] font-semibold text-zinc-500">
            {label}
          </div>))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {calendarCells.map(({ date, inMonth }) => {
            const isSelected = selected ? isSameDay(date, selected) : false;
            return (<button key={date.toISOString()} type="button" onClick={() => handleSelect(date)} className={`h-8 w-8 rounded-lg text-xs font-medium transition-colors ${isSelected
                    ? 'bg-sky-600 text-white'
                    : inMonth
                        ? 'text-zinc-200 hover:bg-zinc-800'
                        : 'text-zinc-600 hover:bg-zinc-900'}`}>
              {date.getDate()}
            </button>);
        })}
      </div>
    </div>);
}
export default Calendar;
