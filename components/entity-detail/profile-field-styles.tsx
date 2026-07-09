"use client";
import React from "react";
export const PROFILE_FALLBACK_CLASS = "text-zinc-500 font-medium";
export const PROFILE_GHOST_INPUT_CLASS = "w-full bg-transparent border border-transparent text-zinc-900 dark:text-zinc-100 rounded-md px-1 py-0.5 -ml-1 text-sm outline-none transition-colors hover:bg-zinc-100/60 dark:hover:bg-zinc-800/40 focus:bg-white dark:focus:bg-zinc-900/80 focus:border-zinc-200 dark:focus:border-zinc-700 focus:ring-1 focus:ring-sky-500/30";
export const PROFILE_GHOST_SELECT_CLASS = "w-full bg-transparent border border-transparent text-zinc-900 dark:text-zinc-100 rounded-md px-1 py-0.5 -ml-1 text-xs outline-none transition-colors hover:bg-zinc-100/60 dark:hover:bg-zinc-800/40 focus:bg-white dark:focus:bg-zinc-900/80 focus:border-zinc-200 dark:focus:border-zinc-700 focus:ring-1 focus:ring-sky-500/30";
export const PROFILE_GHOST_TEXTAREA_CLASS = "w-full bg-transparent border border-transparent text-zinc-900 dark:text-zinc-100 rounded-md px-1 py-1 -ml-1 text-sm outline-none transition-colors resize-y min-h-[72px] hover:bg-zinc-100/60 dark:hover:bg-zinc-800/40 focus:bg-white dark:focus:bg-zinc-900/80 focus:border-zinc-200 dark:focus:border-zinc-700 focus:ring-1 focus:ring-sky-500/30";
export const PROFILE_GHOST_FIELD_CLASS = "w-full bg-transparent border border-transparent text-zinc-900 dark:text-zinc-100 rounded-md px-1 py-0.5 -ml-1 text-sm outline-none transition-colors hover:bg-zinc-100/60 dark:hover:bg-zinc-800/40 focus:bg-white dark:focus:bg-zinc-900/80 focus:border-zinc-200 dark:focus:border-zinc-700 focus:ring-1 focus:ring-sky-500/30";
export const PROFILE_ENTITY_LINK_CLASS = "text-sky-600 dark:text-sky-400 font-semibold hover:text-sky-500 dark:hover:text-sky-300 hover:underline underline-offset-2 transition-colors text-left";
const EMPTY_PROFILE_VALUES = new Set(["", "—", "-", "n/a", "na", "none", "not set", "not linked"]);
export function isEmptyProfileValue(value?: string | null): boolean {
    if (!value)
        return true;
    return EMPTY_PROFILE_VALUES.has(value.trim().toLowerCase());
}
export function ProfileFieldFallback({ label = "Not Set", }: {
    label?: "Not Set" | "None";
}) {
    return <span className={PROFILE_FALLBACK_CLASS}>{label}</span>;
}
export function ProfileFieldValue({ value, fallback = "Not Set", className = "text-zinc-900 dark:text-zinc-100", }: {
    value?: string | null;
    fallback?: "Not Set" | "None";
    className?: string;
}) {
    if (isEmptyProfileValue(value)) {
        return <ProfileFieldFallback label={fallback}/>;
    }
    return <span className={className}>{value}</span>;
}
