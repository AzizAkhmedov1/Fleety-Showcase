'use client';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { formatTitleCaseLabel } from '@/lib/display-labels';
interface StatusDropdownProps {
    value: string;
    options: readonly string[];
    onSelect: (value: string) => void;
    badgeClass: string;
    formatLabel?: (value: string) => string;
    disabled?: boolean;
    align?: 'left' | 'right';
    minWidthClass?: string;
}
interface MenuPosition {
    top: number;
    left: number;
    width: number;
}
const defaultFormatLabel = (value: string) => formatTitleCaseLabel(value);
const ITEM_HEIGHT_PX = 36;
const MENU_PADDING_PX = 8;
const GAP_PX = 4;
function parseMinWidthPx(minWidthClass: string): number {
    const match = minWidthClass.match(/min-w-\[(\d+)px\]/);
    return match ? Number.parseInt(match[1], 10) : 140;
}
export default function StatusDropdown({ value, options, onSelect, badgeClass, formatLabel = defaultFormatLabel, disabled = false, align = 'left', minWidthClass = 'min-w-[140px]', }: StatusDropdownProps) {
    const [open, setOpen] = useState(false);
    const [mounted, setMounted] = useState(false);
    const [menuPosition, setMenuPosition] = useState<MenuPosition | null>(null);
    const triggerRef = useRef<HTMLButtonElement>(null);
    const menuRef = useRef<HTMLDivElement>(null);
    const updatePosition = useCallback(() => {
        const trigger = triggerRef.current;
        if (!trigger)
            return;
        const rect = trigger.getBoundingClientRect();
        const menuHeight = options.length * ITEM_HEIGHT_PX + MENU_PADDING_PX;
        const width = Math.max(rect.width, parseMinWidthPx(minWidthClass));
        const spaceBelow = window.innerHeight - rect.bottom;
        const spaceAbove = rect.top;
        const opensUp = spaceBelow < menuHeight && spaceAbove >= spaceBelow;
        let top = opensUp ? rect.top - menuHeight - GAP_PX : rect.bottom + GAP_PX;
        let left = align === 'right' ? rect.right - width : rect.left;
        left = Math.max(8, Math.min(left, window.innerWidth - width - 8));
        top = Math.max(8, Math.min(top, window.innerHeight - menuHeight - 8));
        setMenuPosition({ top, left, width });
    }, [align, minWidthClass, options.length]);
    useEffect(() => {
        setMounted(true);
    }, []);
    useLayoutEffect(() => {
        if (!open) {
            setMenuPosition(null);
            return;
        }
        updatePosition();
    }, [open, updatePosition]);
    useEffect(() => {
        if (!open)
            return;
        const handleReposition = () => updatePosition();
        window.addEventListener('resize', handleReposition);
        window.addEventListener('scroll', handleReposition, true);
        return () => {
            window.removeEventListener('resize', handleReposition);
            window.removeEventListener('scroll', handleReposition, true);
        };
    }, [open, updatePosition]);
    useEffect(() => {
        if (!open)
            return;
        const handleClickOutside = (event: MouseEvent) => {
            const target = event.target as Node;
            if (triggerRef.current?.contains(target) || menuRef.current?.contains(target)) {
                return;
            }
            setOpen(false);
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [open]);
    const resolvedValue = options.includes(value) ? value : options[0];
    const menu = open && menuPosition ? (<div ref={menuRef} data-status-dropdown-menu className="fixed z-50 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg shadow-lg py-1 overflow-hidden" style={{
            top: menuPosition.top,
            left: menuPosition.left,
            width: menuPosition.width,
            minWidth: menuPosition.width,
        }}>
        {options.map((option) => {
            const isCurrent = resolvedValue === option;
            return (<button key={option} type="button" onClick={() => {
                    if (!isCurrent)
                        onSelect(option);
                    setOpen(false);
                }} disabled={isCurrent || disabled} className={`w-full text-left px-3 py-1.5 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors disabled:opacity-50 disabled:cursor-default ${isCurrent ? 'bg-zinc-50 dark:bg-zinc-800/60' : ''}`}>
              {formatLabel(option)}
            </button>);
        })}
      </div>) : null;
    return (<div className="relative inline-block" data-status-dropdown>
      <button ref={triggerRef} type="button" onClick={() => setOpen((prev) => !prev)} disabled={disabled} className={`px-2.5 py-1 rounded-full text-xs font-semibold tracking-wide text-center border inline-block whitespace-nowrap hover:scale-105 transition-transform cursor-pointer disabled:opacity-60 disabled:cursor-wait disabled:hover:scale-100 ${badgeClass}`}>
        {formatLabel(resolvedValue)}
      </button>
      {mounted && menu ? createPortal(menu, document.body) : null}
    </div>);
}
