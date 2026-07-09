export function formatPhoneNumber(phoneStr?: string | null): string {
    if (!phoneStr)
        return '';
    const digits = phoneStr.replace(/\D/g, '').slice(0, 10);
    if (digits.length < 10)
        return '';
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}
export function formatCorporateName(value?: string | null): string {
    const name = (value || '').trim().replace(/\s+/g, ' ');
    if (!name)
        return '';
    return name
        .split(' ')
        .map((word) => {
        if (/^[A-Z0-9]{2,5}$/.test(word))
            return word;
        if (word.length <= 1)
            return word.toUpperCase();
        return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
        .join(' ');
}
export function customerCreditRatingBadgeClass(rating: string): string {
    const value = (rating || 'Pending').trim();
    if (value === 'Do Not Use' || value === 'DNU') {
        return 'bg-red-500/10 text-red-600 border-red-500/20 dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/20';
    }
    if (value.includes('F')) {
        return 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400';
    }
    if (value === 'Approved' || value.includes('A')) {
        return 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400';
    }
    return 'bg-zinc-100 text-zinc-700 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-300';
}
