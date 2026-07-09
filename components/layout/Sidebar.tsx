'use client';
import { useEffect, useRef, useState, type MouseEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { BarChart3, Building2, Calculator, ChevronDown, ChevronLeft, ChevronRight, LogOut, Radio, Settings, Users, X, } from 'lucide-react';
import FleetyIcon from '@/components/icons/FleetyIcon';
import { performTmsLogout } from '@/lib/api-client';
import { DASHBOARD_ROUTES, dispatchDashboardBeforeNavigate } from '@/lib/dashboard-routes';
interface SidebarProps {
    etaAlertCount: number;
    activeDrawerLoadId?: number | null;
    onCloseLoadDrawer?: () => void;
}
interface SidebarNavContentProps {
    etaAlertCount: number;
    isCollapsed: boolean;
    onNavigate?: () => void;
    activeDrawerLoadId?: number | null;
    onCloseLoadDrawer?: () => void;
}
interface MobileNavDrawerProps extends SidebarProps {
    open: boolean;
    onClose: () => void;
}
const navButtonClass = (isActive: boolean, isCollapsed: boolean) => `w-full flex items-center rounded-xl text-sm font-semibold transition-colors ${isCollapsed ? 'justify-center px-2 py-2.5' : 'gap-3 px-3 py-2.5'} ${isActive
    ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white'
    : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800/50'}`;
const fleetAccordionSubLinkClass = (isActive: boolean) => `relative block w-full text-left text-sm rounded-lg py-2 pl-8 pr-3 transition-colors ${isActive
    ? 'bg-zinc-100 dark:bg-zinc-800 text-sky-600 dark:text-sky-400 font-semibold border-l-2 border-sky-500'
    : 'text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100/70 dark:hover:bg-zinc-800/40 hover:text-zinc-900 dark:hover:text-zinc-200'}`;
const fleetFlyoutLinkClass = (isActive: boolean) => `block w-full text-left text-sm rounded-md px-3 py-2 transition-colors ${isActive
    ? 'bg-zinc-100 dark:bg-zinc-800 text-sky-600 dark:text-sky-400 font-semibold'
    : 'text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100/70 dark:hover:bg-zinc-800/40 hover:text-zinc-900 dark:hover:text-zinc-200'}`;
function shouldPreserveBrowserNavigation(event: MouseEvent<HTMLAnchorElement | HTMLButtonElement>): boolean {
    return (event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey ||
        event.button !== 0);
}
interface SidebarNavLinkProps {
    href: string;
    isActive: boolean;
    isCollapsed: boolean;
    title: string;
    className?: string;
    onNavigate?: () => void;
    onClick?: (event: MouseEvent<HTMLAnchorElement | HTMLButtonElement>) => void;
    children: ReactNode;
}
function SidebarNavLink({ href, isActive, isCollapsed, title, className, onNavigate, onClick, children, }: SidebarNavLinkProps) {
    const router = useRouter();
    const pathname = usePathname();
    const handleClick = (event: MouseEvent<HTMLAnchorElement | HTMLButtonElement>) => {
        if (onClick) {
            onClick(event);
            return;
        }
        if (shouldPreserveBrowserNavigation(event)) {
            onNavigate?.();
            return;
        }
        event.preventDefault();
        onNavigate?.();
        if (pathname !== href) {
            dispatchDashboardBeforeNavigate();
            router.push(href);
        }
    };
    return (<Link href={href} onClick={handleClick} className={className ?? navButtonClass(isActive, isCollapsed)} title={title}>
      {children}
    </Link>);
}
function SidebarNavContent({ etaAlertCount, isCollapsed, onNavigate, activeDrawerLoadId = null, onCloseLoadDrawer, }: SidebarNavContentProps) {
    const pathname = usePathname();
    const router = useRouter();
    const isLoadManagementActive = pathname === DASHBOARD_ROUTES.loadManagement;
    const isLiveOpsActive = pathname === DASHBOARD_ROUTES.liveOperations;
    const isFleetAssetsActive = pathname === DASHBOARD_ROUTES.fleetAssets;
    const isFleetFinancialsActive = pathname === DASHBOARD_ROUTES.fleetFinancials;
    const isPlanningActive = pathname === DASHBOARD_ROUTES.fleetPlanning;
    const isAccountingActive = pathname === DASHBOARD_ROUTES.accounting;
    const isCrmActive = pathname === DASHBOARD_ROUTES.crm;
    const isSettingsActive = pathname === DASHBOARD_ROUTES.settings;
    const isFleetTab = isFleetAssetsActive || isFleetFinancialsActive || isPlanningActive;
    const [fleetExpanded, setFleetExpanded] = useState(isFleetTab);
    const [showFlyout, setShowFlyout] = useState(false);
    const [flyoutAnchor, setFlyoutAnchor] = useState<{
        top: number;
        left: number;
    } | null>(null);
    const [mounted, setMounted] = useState(false);
    const fleetTriggerRef = useRef<HTMLDivElement>(null);
    const flyoutCloseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    useEffect(() => {
        setMounted(true);
    }, []);
    useEffect(() => {
        return () => {
            if (flyoutCloseTimerRef.current) {
                clearTimeout(flyoutCloseTimerRef.current);
            }
        };
    }, []);
    useEffect(() => {
        if (isFleetTab) {
            setFleetExpanded(true);
        }
    }, [isFleetTab]);
    useEffect(() => {
        if (!isCollapsed) {
            setShowFlyout(false);
        }
    }, [isCollapsed]);
    const fleetParentActive = isFleetTab;
    const updateFlyoutAnchor = () => {
        const rect = fleetTriggerRef.current?.getBoundingClientRect();
        if (!rect)
            return;
        setFlyoutAnchor({ top: rect.top, left: rect.right + 8 });
    };
    const openFleetFlyout = () => {
        if (flyoutCloseTimerRef.current) {
            clearTimeout(flyoutCloseTimerRef.current);
            flyoutCloseTimerRef.current = null;
        }
        updateFlyoutAnchor();
        setShowFlyout(true);
    };
    const scheduleFleetFlyoutClose = () => {
        flyoutCloseTimerRef.current = setTimeout(() => {
            setShowFlyout(false);
            flyoutCloseTimerRef.current = null;
        }, 120);
    };
    const handleLoadManagementClick = (event: MouseEvent<HTMLAnchorElement | HTMLButtonElement>) => {
        if (shouldPreserveBrowserNavigation(event)) {
            onNavigate?.();
            return;
        }
        event.preventDefault();
        if (pathname === DASHBOARD_ROUTES.loadManagement && activeDrawerLoadId != null) {
            onCloseLoadDrawer?.();
            onNavigate?.();
            return;
        }
        onNavigate?.();
        if (pathname !== DASHBOARD_ROUTES.loadManagement) {
            dispatchDashboardBeforeNavigate();
            router.push(DASHBOARD_ROUTES.loadManagement);
        }
    };
    const navigateFromSidebar = (href: string) => {
        if (pathname === href) {
            return;
        }
        dispatchDashboardBeforeNavigate();
        router.push(href);
    };
    const closeFlyoutAndNavigate = (href: string) => (event: MouseEvent<HTMLAnchorElement | HTMLButtonElement>) => {
        if (shouldPreserveBrowserNavigation(event)) {
            setShowFlyout(false);
            onNavigate?.();
            return;
        }
        event.preventDefault();
        setShowFlyout(false);
        onNavigate?.();
        navigateFromSidebar(href);
    };
    return (<div className="flex flex-col flex-1 min-h-0 w-full">
      <div className={`flex-1 min-h-0 py-4 ${isCollapsed ? 'overflow-visible' : 'overflow-y-auto'}`}>
        <div className={isCollapsed ? 'px-2 overflow-visible' : 'px-4 pb-2'}>
          {!isCollapsed ? (<p className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2">Main Menu</p>) : null}
          <nav className={`space-y-1 ${isCollapsed ? 'overflow-visible' : ''}`}>
            <SidebarNavLink href={DASHBOARD_ROUTES.loadManagement} isActive={isLoadManagementActive} isCollapsed={isCollapsed} title="Load Management" onNavigate={onNavigate} onClick={handleLoadManagementClick} className={navButtonClass(isLoadManagementActive, isCollapsed)}>
              <BarChart3 size={18} className="shrink-0"/>
              {!isCollapsed ? <span>Load Management</span> : null}
            </SidebarNavLink>

            <SidebarNavLink href={DASHBOARD_ROUTES.liveOperations} isActive={isLiveOpsActive} isCollapsed={isCollapsed} title="Live Operations" onNavigate={onNavigate} className={`${navButtonClass(isLiveOpsActive, isCollapsed)} relative ${!isCollapsed ? 'justify-between' : ''}`}>
              <span className={`flex items-center ${isCollapsed ? '' : 'gap-3'}`}>
                <Radio size={18} className="shrink-0"/>
                {!isCollapsed ? <span>Live Operations</span> : null}
              </span>
              {etaAlertCount > 0 ? (<span className={isCollapsed
                ? 'absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-rose-500 border border-rose-400/50'
                : 'px-1.5 py-0.5 rounded-full bg-rose-500/15 text-rose-400 text-[10px] font-black border border-rose-500/30 animate-pulse'}>
                  {isCollapsed ? null : etaAlertCount}
                </span>) : null}
            </SidebarNavLink>

            {isCollapsed ? (<div ref={fleetTriggerRef} className="relative overflow-visible" onMouseEnter={openFleetFlyout} onMouseLeave={scheduleFleetFlyoutClose}>
                <div className={navButtonClass(fleetParentActive, isCollapsed)} title="Fleet Management" aria-label="Fleet Management" role="presentation">
                  <Users size={18} className="shrink-0"/>
                </div>

                {mounted && showFlyout && flyoutAnchor
                ? createPortal(<div style={{ position: 'fixed', top: flyoutAnchor.top, left: flyoutAnchor.left }} className="w-52 z-[100] rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#161616] shadow-xl p-1 flex flex-col animate-in fade-in slide-in-from-left-2 duration-150" role="menu" aria-label="Fleet Management" onMouseEnter={openFleetFlyout} onMouseLeave={scheduleFleetFlyoutClose}>
                        <Link href={DASHBOARD_ROUTES.fleetAssets} role="menuitem" onClick={closeFlyoutAndNavigate(DASHBOARD_ROUTES.fleetAssets)} className={fleetFlyoutLinkClass(isFleetAssetsActive)}>
                          Assets
                        </Link>
                        <Link href={DASHBOARD_ROUTES.fleetFinancials} role="menuitem" onClick={closeFlyoutAndNavigate(DASHBOARD_ROUTES.fleetFinancials)} className={fleetFlyoutLinkClass(isFleetFinancialsActive)}>
                          Fleet Financials
                        </Link>
                        <Link href={DASHBOARD_ROUTES.fleetPlanning} role="menuitem" onClick={closeFlyoutAndNavigate(DASHBOARD_ROUTES.fleetPlanning)} className={fleetFlyoutLinkClass(isPlanningActive)}>
                          Planning
                        </Link>
                      </div>, document.body)
                : null}
              </div>) : (<div className="relative">
                {fleetExpanded ? (<div className="absolute left-[1.125rem] top-11 bottom-2 w-px bg-zinc-200 dark:bg-zinc-800" aria-hidden/>) : null}

                <button type="button" onClick={() => setFleetExpanded((open) => !open)} className={`${navButtonClass(fleetParentActive, false)} justify-between`} aria-expanded={fleetExpanded}>
                  <span className="flex items-center gap-3">
                    <Users size={18} className="shrink-0"/>
                    <span>Fleet Management</span>
                  </span>
                  <ChevronDown size={16} className={`shrink-0 text-zinc-400 transition-transform duration-200 ${fleetExpanded ? 'rotate-180' : ''}`} aria-hidden/>
                </button>

                {fleetExpanded ? (<div className="mt-1 space-y-0.5">
                    <SidebarNavLink href={DASHBOARD_ROUTES.fleetAssets} isActive={isFleetAssetsActive} isCollapsed={false} title="Assets" onNavigate={onNavigate} className={fleetAccordionSubLinkClass(isFleetAssetsActive)}>
                      Assets
                    </SidebarNavLink>
                    <SidebarNavLink href={DASHBOARD_ROUTES.fleetFinancials} isActive={isFleetFinancialsActive} isCollapsed={false} title="Fleet Financials" onNavigate={onNavigate} className={fleetAccordionSubLinkClass(isFleetFinancialsActive)}>
                      Fleet Financials
                    </SidebarNavLink>
                    <SidebarNavLink href={DASHBOARD_ROUTES.fleetPlanning} isActive={isPlanningActive} isCollapsed={false} title="Planning" onNavigate={onNavigate} className={fleetAccordionSubLinkClass(isPlanningActive)}>
                      Planning
                    </SidebarNavLink>
                  </div>) : null}
              </div>)}

            <SidebarNavLink href={DASHBOARD_ROUTES.accounting} isActive={isAccountingActive} isCollapsed={isCollapsed} title="Accounting" onNavigate={onNavigate}>
              <Calculator size={18} className="shrink-0"/>
              {!isCollapsed ? <span>Accounting</span> : null}
            </SidebarNavLink>

            <SidebarNavLink href={DASHBOARD_ROUTES.crm} isActive={isCrmActive} isCollapsed={isCollapsed} title="CRM & Customers" onNavigate={onNavigate}>
              <Building2 size={18} className="shrink-0"/>
              {!isCollapsed ? <span>CRM &amp; Customers</span> : null}
            </SidebarNavLink>

            <SidebarNavLink href={DASHBOARD_ROUTES.settings} isActive={isSettingsActive} isCollapsed={isCollapsed} title="Settings & Account" onNavigate={onNavigate}>
              <Settings size={18} className="shrink-0"/>
              {!isCollapsed ? <span>Settings &amp; Account</span> : null}
            </SidebarNavLink>
          </nav>
        </div>
      </div>

      <div className={`mt-auto shrink-0 w-full border-t border-zinc-100 dark:border-zinc-800 ${isCollapsed ? 'p-2' : 'p-4'}`}>
        <button type="button" onClick={() => void performTmsLogout()} className={`w-full flex items-center rounded-xl text-sm font-semibold text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800/50 transition-colors ${isCollapsed ? 'justify-center p-2.5' : 'justify-center gap-2 px-4 py-2.5'}`} title="Sign Out">
          <LogOut size={16} className="shrink-0"/>
          {!isCollapsed ? <span>Sign Out</span> : null}
        </button>
      </div>
    </div>);
}
export function MobileNavDrawer({ open, onClose, etaAlertCount, activeDrawerLoadId, onCloseLoadDrawer, }: MobileNavDrawerProps) {
    const [mounted, setMounted] = useState(false);
    useEffect(() => {
        setMounted(true);
    }, []);
    useEffect(() => {
        if (!open)
            return;
        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => {
            document.body.style.overflow = previousOverflow;
        };
    }, [open]);
    useEffect(() => {
        if (!open)
            return;
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape')
                onClose();
        };
        document.addEventListener('keydown', onKeyDown);
        return () => document.removeEventListener('keydown', onKeyDown);
    }, [open, onClose]);
    if (!mounted || !open)
        return null;
    return createPortal(<div className="fixed inset-0 z-50 md:hidden">
      <button type="button" className="absolute inset-0 bg-black/50 backdrop-blur-[1px]" onClick={onClose} aria-label="Close navigation menu"/>
      <aside className="absolute inset-y-0 left-0 w-72 max-w-[85vw] flex flex-col bg-white dark:bg-[#121212] border-r border-zinc-200 dark:border-zinc-800 shadow-2xl animate-in slide-in-from-left duration-200" aria-label="Mobile navigation">
        <div className="h-14 shrink-0 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between px-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="bg-zinc-800 p-2 rounded-lg shrink-0">
              <FleetyIcon className="h-5 w-5" aria-hidden/>
            </div>
            <h1 className="text-lg font-black text-zinc-900 dark:text-white tracking-tight truncate">
              Fleety
            </h1>
          </div>
          <button type="button" onClick={onClose} className="p-2 rounded-lg text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors" aria-label="Close menu">
            <X size={20}/>
          </button>
        </div>
        <div className="flex flex-col flex-1 min-h-0">
          <SidebarNavContent etaAlertCount={etaAlertCount} isCollapsed={false} onNavigate={onClose} activeDrawerLoadId={activeDrawerLoadId} onCloseLoadDrawer={onCloseLoadDrawer}/>
        </div>
      </aside>
    </div>, document.body);
}
const FLEETY_SIDEBAR_COLLAPSED_KEY = 'fleety_sidebar_collapsed';
export default function Sidebar({ etaAlertCount, activeDrawerLoadId, onCloseLoadDrawer, }: SidebarProps) {
    const [isCollapsed, setIsCollapsed] = useState(false);
    useEffect(() => {
        try {
            const stored = localStorage.getItem(FLEETY_SIDEBAR_COLLAPSED_KEY);
            if (stored === null)
                return;
            const parsed: unknown = JSON.parse(stored);
            if (parsed === true) {
                setIsCollapsed(true);
            }
        }
        catch {
            return;
        }
    }, []);
    const toggleCollapsed = () => {
        setIsCollapsed((prev) => {
            const nextState = !prev;
            try {
                localStorage.setItem(FLEETY_SIDEBAR_COLLAPSED_KEY, JSON.stringify(nextState));
            }
            catch {
                return nextState;
            }
            return nextState;
        });
    };
    return (<aside className={`sticky top-0 hidden md:flex h-screen shrink-0 flex-col z-30 bg-white dark:bg-[#121212] border-r border-zinc-200 dark:border-zinc-800 shadow-sm transition-all duration-300 ${isCollapsed ? 'w-16 overflow-visible' : 'w-64'}`}>
      <button type="button" onClick={toggleCollapsed} className="absolute top-16 -translate-y-1/2 -right-3 z-50 h-6 w-6 rounded-full border border-zinc-700 bg-zinc-900 hover:bg-zinc-800 text-zinc-400 flex items-center justify-center shadow-md cursor-pointer" aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'} title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
        {isCollapsed ? <ChevronRight size={14}/> : <ChevronLeft size={14}/>}
      </button>

      <div className={`h-16 shrink-0 border-b border-zinc-200 dark:border-zinc-800 flex items-center ${isCollapsed ? 'justify-center px-2' : 'px-4'}`}>
        <div className={`flex items-center min-w-0 ${isCollapsed ? '' : 'gap-3'}`}>
          <div className="bg-zinc-800 p-2 rounded-lg shrink-0">
            <FleetyIcon className="h-6 w-6" aria-hidden/>
          </div>
          {!isCollapsed ? (<h1 className="text-xl font-black text-zinc-900 dark:text-white tracking-tight truncate">
              Fleety
            </h1>) : null}
        </div>
      </div>

      <div className="flex flex-col flex-1 min-h-0">
        <SidebarNavContent etaAlertCount={etaAlertCount} isCollapsed={isCollapsed} activeDrawerLoadId={activeDrawerLoadId} onCloseLoadDrawer={onCloseLoadDrawer}/>
      </div>
    </aside>);
}
