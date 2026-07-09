"use client";
import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useResizableDrawer } from "@/hooks/useResizableDrawer";
interface ProfileDrawerShellProps {
    open: boolean;
    onClose: () => void;
    children: React.ReactNode;
}
export default function ProfileDrawerShell({ open, onClose, children, }: ProfileDrawerShellProps) {
    const [mounted, setMounted] = useState(false);
    const { width, isDragging, handleResizeMouseDown } = useResizableDrawer();
    useEffect(() => {
        setMounted(true);
    }, []);
    useEffect(() => {
        if (!open)
            return;
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape")
                onClose();
        };
        document.addEventListener("keydown", onKeyDown);
        return () => document.removeEventListener("keydown", onKeyDown);
    }, [open, onClose]);
    if (!open || !mounted)
        return null;
    return createPortal(<div className="fixed inset-0 z-[94] flex items-start justify-end">
      <button type="button" className="absolute inset-0 bg-black/5 dark:bg-black/30" onClick={onClose} aria-label="Close profile drawer"/>
      <aside className={`absolute top-0 right-0 bottom-0 flex flex-col overflow-hidden bg-white dark:bg-[#161616] border-l border-zinc-200 dark:border-zinc-800 shadow-2xl ${isDragging ? "" : "animate-in slide-in-from-right duration-300"}`} style={{ width: `${width}px`, maxWidth: "100vw" }} aria-label="Profile drawer">
        <div className="absolute left-0 top-0 bottom-0 w-2 cursor-ew-resize hover:bg-sky-500/30 active:bg-sky-500/50 transition-colors z-50" onMouseDown={handleResizeMouseDown} role="separator" aria-orientation="vertical" aria-label="Resize drawer"/>
        <div className="flex flex-col flex-1 min-w-0 overflow-hidden">{children}</div>
      </aside>
    </div>, document.body);
}
