"use client";
import React from "react";
export type EntityDetailTabId = "main" | "tasks-files";
const TAB_ITEMS: {
    id: EntityDetailTabId;
    label: string;
}[] = [
    { id: "main", label: "Main" },
    { id: "tasks-files", label: "Tasks & Files" },
];
interface EntityDetailTabsProps {
    activeTab: EntityDetailTabId;
    onChange: (tab: EntityDetailTabId) => void;
}
export default function EntityDetailTabs({ activeTab, onChange }: EntityDetailTabsProps) {
    return (<div className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-900/80 shrink-0">
      <nav className="flex gap-1 px-5 overflow-x-auto" aria-label="Entity detail sections">
        {TAB_ITEMS.map((tab) => {
            const isActive = activeTab === tab.id;
            return (<button key={tab.id} type="button" onClick={() => onChange(tab.id)} className={`relative px-4 py-3 text-xs font-bold uppercase tracking-wider whitespace-nowrap transition-colors ${isActive
                    ? "text-sky-600 dark:text-sky-400"
                    : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200"}`}>
              {tab.label}
              {isActive ? (<span className="absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-sky-600 dark:bg-sky-400"/>) : null}
            </button>);
        })}
      </nav>
    </div>);
}
