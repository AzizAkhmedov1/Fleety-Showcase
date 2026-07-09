import type { Config } from "tailwindcss";
const config: Config = {
    darkMode: 'class',
    content: [
        "./app/**/*.{js,ts,jsx,tsx,mdx}",
        "./components/**/*.{js,ts,jsx,tsx,mdx}",
        "./contexts/**/*.{js,ts,jsx,tsx,mdx}",
        "./hooks/**/*.{js,ts,jsx,tsx,mdx}",
        "./lib/**/*.{js,ts,jsx,tsx,mdx}",
        "./store/**/*.{js,ts,jsx,tsx,mdx}",
    ],
    theme: {
        extend: {
            colors: {
                shell: {
                    bg: 'var(--shell-bg)',
                    surface: 'var(--shell-surface)',
                    sidebar: 'var(--shell-sidebar)',
                    border: 'var(--shell-border)',
                    text: 'var(--shell-text)',
                    muted: 'var(--shell-text-muted)',
                },
            },
        },
    },
    plugins: [],
};
export default config;
