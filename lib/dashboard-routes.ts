export const DASHBOARD_ROUTES = {
    loadManagement: '/load-management',
    liveOperations: '/live-operations',
    accounting: '/accounting',
    crm: '/crm',
    settings: '/settings',
    fleetAssets: '/fleet/assets',
    fleetFinancials: '/fleet/financials',
    fleetPlanning: '/fleet/planning',
} as const;
export type DashboardRoute = (typeof DASHBOARD_ROUTES)[keyof typeof DASHBOARD_ROUTES];
export const DASHBOARD_PATHS = new Set<string>(Object.values(DASHBOARD_ROUTES));
export function isDashboardPath(pathname: string): boolean {
    return DASHBOARD_PATHS.has(pathname);
}
export function isFleetPath(pathname: string): boolean {
    return pathname.startsWith('/fleet/');
}
export const DASHBOARD_BEFORE_NAVIGATE_EVENT = 'dashboard:before-navigate';
export function dispatchDashboardBeforeNavigate(): void {
    if (typeof window === 'undefined')
        return;
    window.dispatchEvent(new CustomEvent(DASHBOARD_BEFORE_NAVIGATE_EVENT));
}
export function getDashboardPageTitle(pathname: string): string {
    switch (pathname) {
        case DASHBOARD_ROUTES.loadManagement:
            return 'Load Management';
        case DASHBOARD_ROUTES.liveOperations:
            return 'Live Operations';
        case DASHBOARD_ROUTES.fleetAssets:
            return 'Assets';
        case DASHBOARD_ROUTES.fleetFinancials:
            return 'Fleet Financials';
        case DASHBOARD_ROUTES.fleetPlanning:
            return 'Planning';
        case DASHBOARD_ROUTES.accounting:
            return 'Accounting & Invoicing';
        case DASHBOARD_ROUTES.settings:
            return 'Settings & Account';
        case DASHBOARD_ROUTES.crm:
            return 'CRM & Customers';
        default:
            return 'Dashboard';
    }
}
