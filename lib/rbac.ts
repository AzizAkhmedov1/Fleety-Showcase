export function canViewLoadNetProfit(roles: string[] | null | undefined): boolean {
    if (!roles?.length)
        return false;
    return roles.some((role) => role === 'Admin' || role === 'Accounting');
}
export function canViewLoadOperationalFinancials(roles: string[] | null | undefined): boolean {
    if (!roles?.length)
        return false;
    return roles.some((role) => role === 'Admin' || role === 'Accounting' || role === 'Dispatcher');
}
export function canViewLoadFinancials(roles: string[] | null | undefined): boolean {
    return canViewLoadNetProfit(roles);
}
