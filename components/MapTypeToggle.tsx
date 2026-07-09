"use client";
import { Layers } from "lucide-react";
export type MapViewType = "roadmap" | "satellite";
export const MAP_ACTION_BUTTON_CLASS = "w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs font-bold text-zinc-900 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50 dark:hover:bg-zinc-800";
interface MapTypeToggleProps {
    mapType: MapViewType;
    onToggle: () => void;
    className?: string;
}
export default function MapTypeToggle({ mapType, onToggle, className = "" }: MapTypeToggleProps) {
    const isSatellite = mapType === "satellite";
    return (<button type="button" onClick={onToggle} className={`${MAP_ACTION_BUTTON_CLASS} flex items-center justify-center gap-1.5 ${className}`} aria-pressed={isSatellite} aria-label={isSatellite ? "Switch to roadmap view" : "Switch to hybrid satellite view"}>
      <Layers size={14}/>
      {isSatellite ? "Roadmap View" : "Satellite View"}
    </button>);
}
