"use client";
import React, { useEffect, useState } from 'react';
import { Sun, Moon } from 'lucide-react';
export default function ThemeToggle() {
    const [isDark, setIsDark] = useState(false);
    useEffect(() => {
        const savedTheme = localStorage.getItem('tms-theme');
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        if (savedTheme === 'dark' || (!savedTheme && prefersDark)) {
            setIsDark(true);
            document.documentElement.classList.add('dark');
        }
        else {
            setIsDark(false);
            document.documentElement.classList.remove('dark');
        }
    }, []);
    const toggleTheme = () => {
        if (isDark) {
            document.documentElement.classList.remove('dark');
            localStorage.setItem('tms-theme', 'light');
            setIsDark(false);
        }
        else {
            document.documentElement.classList.add('dark');
            localStorage.setItem('tms-theme', 'dark');
            setIsDark(true);
        }
    };
    const [mounted, setMounted] = useState(false);
    useEffect(() => setMounted(true), []);
    if (!mounted)
        return null;
    return (<button onClick={toggleTheme} className="p-2.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors shadow-sm border border-zinc-200 dark:border-zinc-800" title="Toggle Dark Mode">
      {isDark ? <Sun size={20}/> : <Moon size={20}/>}
    </button>);
}
