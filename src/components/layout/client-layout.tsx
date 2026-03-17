"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Sheet, SheetTrigger, SheetContent, SheetHeader, SheetTitle, SheetClose } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import {
    Menu, Settings, LayoutDashboard, ListTree, BarChart, Database,
    GitBranch, Files, Combine, RefreshCw, HardHat, LogOut, User,
    PanelLeftClose, PanelLeftOpen,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useContext, useEffect, useRef, useState, useCallback } from "react";
import { TableDataContext } from "@/store/table-data-context";
import { useIsMobile } from "@/hooks/use-mobile";
import React from "react";
import { ThemeSwitch } from "../ui/theme-switch";
import { useAuth } from "@/contexts/AuthContext";
import { useUserPreferences } from "@/hooks/use-user-preferences";
import type { ForwardRefExoticComponent, RefAttributes } from "react";
import type { LucideProps } from "lucide-react";
import {
    type MenuVisibility,
    DEFAULT_MENU_VISIBILITY,
    MENU_VISIBILITY_KEY,
} from "@/app/settings/page";
import { createPortal } from "react-dom";

// ── Types ──────────────────────────────────────────────────────────────────────
type NavItem = {
    href: string;
    label: string;
    icon: ForwardRefExoticComponent<Omit<LucideProps, "ref"> & RefAttributes<SVGSVGElement>>;
    disabled?: boolean;
    visibilityKey?: keyof MenuVisibility;
};

const navItems: Record<string, NavItem[]> = {
    overview: [
        { href: "/dashboard", label: "Dashboard",    icon: LayoutDashboard },
        { href: "/",          label: "Import Data",  icon: ListTree,  visibilityKey: "showImportData" },
        { href: "/db",        label: "Data All Case",icon: Database },
    ],
    reports: [
        { href: "/report-harian",  label: "Daily Report",  icon: BarChart, visibilityKey: "showDailyReport" },
        { href: "/knowledge-base", label: "Knowledge Base", icon: HardHat,  disabled: true, visibilityKey: "showKnowledgeBase" },
    ],
    tools: [
        { href: "/migrasi-murid", label: "Migrasi Murid", icon: GitBranch, visibilityKey: "showMigrasiMurid" },
        { href: "/cek-duplikasi", label: "Cek Duplikasi", icon: Files,     visibilityKey: "showSecondaryTools" },
        { href: "/data-weaver",   label: "Edit NIS",      icon: Combine,   visibilityKey: "showSecondaryTools" },
    ],
};

type NavCategory = keyof typeof navItems;

// ── SidebarTooltip ─────────────────────────────────────────────────────────────
function SidebarTooltip({ label, children }: { label: string; children: React.ReactNode }) {
    const [pos, setPos]  = useState<{ top: number; left: number } | null>(null);
    const triggerRef     = useRef<HTMLDivElement>(null);

    const show = useCallback(() => {
        if (!triggerRef.current) return;
        const rect = triggerRef.current.getBoundingClientRect();
        setPos({ top: rect.top + rect.height / 2, left: rect.left + 60 + 6 });
    }, []);

    const hide = useCallback(() => setPos(null), []);

    return (
        <>
            <div ref={triggerRef} onMouseEnter={show} onMouseLeave={hide} style={{ width: "100%" }}>
                {children}
            </div>
            {pos && createPortal(
                <div style={{
                    position: "fixed",
                    top: pos.top,
                    left: pos.left,
                    transform: "translateY(-50%)",
                    zIndex: 9999,
                    pointerEvents: "none",
                    backgroundColor: "#18181b",
                    color: "#fafafa",
                    border: "1px solid #3f3f46",
                    borderRadius: "6px",
                    padding: "5px 10px",
                    fontSize: "12px",
                    fontWeight: 500,
                    whiteSpace: "nowrap",
                    boxShadow: "0 4px 12px rgba(0,0,0,0.4)",
                    lineHeight: "1.4",
                }}>
                    {label}
                </div>,
                document.body
            )}
        </>
    );
}

// ── Hooks ──────────────────────────────────────────────────────────────────────

// ✅ useMenuVisibility — sync dari DB preferences, fallback ke localStorage
// Prioritas: DB prefs > localStorage > DEFAULT_MENU_VISIBILITY
// ✅ FIX HYDRATION: initial state selalu DEFAULT, baca localStorage di useEffect
function useMenuVisibility(): MenuVisibility {
    const { prefs } = useUserPreferences();

    // ✅ SELALU mulai dengan DEFAULT — server dan client render sama
    const [visibility, setVisibility] = useState<MenuVisibility>(DEFAULT_MENU_VISIBILITY);

    // ✅ Baca localStorage setelah mount (client-only, tidak ada di server)
    useEffect(() => {
        try {
            const saved = localStorage.getItem(MENU_VISIBILITY_KEY);
            if (saved) setVisibility({ ...DEFAULT_MENU_VISIBILITY, ...JSON.parse(saved) });
        } catch {}
    }, []);

    // ✅ Override dari DB preferences saat prefs load — berlaku di semua device
    useEffect(() => {
        if (!prefs.menuVisibility) return;
        const merged = { ...DEFAULT_MENU_VISIBILITY, ...prefs.menuVisibility };
        setVisibility(merged);
        // Sync balik ke localStorage agar sinkron
        try { localStorage.setItem(MENU_VISIBILITY_KEY, JSON.stringify(merged)); } catch {}
    }, [prefs.menuVisibility]);

    // ✅ Listen event dari settings page saat user ubah toggle
    useEffect(() => {
        const handler = (e: Event) => {
            const custom = e as CustomEvent<MenuVisibility>;
            if (custom.detail) setVisibility(custom.detail);
        };
        window.addEventListener("menuVisibilityChange", handler);
        return () => window.removeEventListener("menuVisibilityChange", handler);
    }, []);

    return visibility;
}

// ✅ useSidebarCollapsed — sync dari DB preferences, fallback ke localStorage
// Prioritas: DB prefs > localStorage > false
// ✅ FIX HYDRATION: initial state selalu false, baca localStorage di useEffect
function useSidebarCollapsed() {
    const { prefs, updatePref } = useUserPreferences();

    // ✅ SELALU mulai dengan false — server dan client render sama
    const [collapsed, setCollapsed] = useState<boolean>(false);

    // ✅ Baca localStorage setelah mount (client-only, tidak ada di server)
    useEffect(() => {
        try {
            const saved = localStorage.getItem("sidebar-collapsed");
            if (saved !== null) setCollapsed(JSON.parse(saved));
        } catch {}
    }, []);

    // ✅ Override dari DB preferences saat prefs load
    useEffect(() => {
        if (prefs.sidebarCollapsed === undefined) return;
        setCollapsed(prefs.sidebarCollapsed);
        // Sync ke localStorage
        try { localStorage.setItem("sidebar-collapsed", JSON.stringify(prefs.sidebarCollapsed)); } catch {}
    }, [prefs.sidebarCollapsed]);

    const toggle = useCallback(() => {
        setCollapsed(prev => {
            const next = !prev;
            // ✅ Simpan ke DB via preferences (auto-debounce 1.5 detik)
            updatePref('sidebarCollapsed', next);
            // Langsung sync ke localStorage untuk akses sinkron
            try { localStorage.setItem("sidebar-collapsed", JSON.stringify(next)); } catch {}
            return next;
        });
    }, [updatePref]);

    return { collapsed, toggle };
}

// ── NavLinks ───────────────────────────────────────────────────────────────────
function NavLinks({ isMobile = false, collapsed = false }: { isMobile?: boolean; collapsed?: boolean }) {
    const pathname       = usePathname();
    const menuVisibility = useMenuVisibility();

    const isVisible = (item: NavItem) =>
        !item.visibilityKey || menuVisibility[item.visibilityKey] === true;

    return (
        <nav className="grid items-start gap-0">
            {(Object.keys(navItems) as NavCategory[]).map(category => {
                const visibleItems = navItems[category].filter(isVisible);
                if (visibleItems.length === 0) return null;

                return (
                    <div key={category} className="py-3">
                        <div className={cn(
                            "transition-all duration-300 overflow-hidden",
                            collapsed ? "h-0 opacity-0" : "h-6 opacity-100 mb-1"
                        )}>
                            <h2 className="px-4 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                                {category}
                            </h2>
                        </div>

                        {visibleItems.map((item) => {
                            const isActive = pathname === item.href;

                            if (isMobile) {
                                return (
                                    <SheetClose key={item.label} asChild>
                                        <Link
                                            href={item.href}
                                            className={cn(
                                                "flex items-center gap-3 px-4 py-2 text-sm font-medium transition-all duration-200 border-r-[3px]",
                                                isActive
                                                    ? "border-primary bg-primary/10 text-primary font-semibold"
                                                    : "border-transparent text-muted-foreground hover:bg-muted/50 hover:text-foreground",
                                                item.disabled && "pointer-events-none opacity-50"
                                            )}
                                        >
                                            <item.icon className="h-4 w-4 shrink-0" strokeWidth={1.5} />
                                            {item.label}
                                        </Link>
                                    </SheetClose>
                                );
                            }

                            if (collapsed) {
                                return (
                                    <SidebarTooltip key={item.label} label={item.label}>
                                        <Link
                                            href={item.href}
                                            style={{
                                                display: "flex",
                                                alignItems: "center",
                                                justifyContent: "center",
                                                width: 60,
                                                height: 36,
                                                borderRight: isActive ? "3px solid var(--primary)" : "3px solid transparent",
                                                background: isActive ? "var(--primary-10, rgba(99,102,241,0.1))" : "transparent",
                                                color: isActive ? "var(--primary)" : "inherit",
                                                pointerEvents: item.disabled ? "none" : "auto",
                                                opacity: item.disabled ? 0.5 : 1,
                                            }}
                                        >
                                            <item.icon style={{ width: 16, height: 16, flexShrink: 0 }} strokeWidth={1.5} />
                                        </Link>
                                    </SidebarTooltip>
                                );
                            }

                            return (
                                <Link
                                    key={item.label}
                                    href={item.href}
                                    className={cn(
                                        "flex items-center gap-3 px-4 py-2 text-sm font-medium transition-all duration-200 border-r-[3px]",
                                        isActive
                                            ? "border-primary bg-primary/10 text-primary font-semibold"
                                            : "border-transparent text-muted-foreground hover:bg-muted/50 hover:text-foreground",
                                        item.disabled && "pointer-events-none opacity-50"
                                    )}
                                >
                                    <item.icon className="h-4 w-4 shrink-0" strokeWidth={1.5} />
                                    <span className="whitespace-nowrap">{item.label}</span>
                                </Link>
                            );
                        })}
                    </div>
                );
            })}
        </nav>
    );
}

// ── ProcessingIndicator ────────────────────────────────────────────────────────
function ProcessingIndicator() {
    const { isProcessing } = useContext(TableDataContext);
    if (!isProcessing) return null;
    return (
        <div className="flex items-center gap-2 text-primary">
            <RefreshCw className="h-4 w-4 animate-spin" />
            <span className="hidden sm:inline text-sm font-medium">Processing...</span>
        </div>
    );
}

// ── UserMenu ───────────────────────────────────────────────────────────────────
function UserMenu() {
    const { user, logout }          = useAuth();
    const { clearPrefsCache }       = useUserPreferences();
    const [open, setOpen]           = useState(false);
    const ref                       = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const handleLogout = useCallback(() => {
        setOpen(false);
        clearPrefsCache(); // ✅ Clear preferences cache sebelum logout
        logout();
    }, [clearPrefsCache, logout]);

    return (
        <div className="relative" ref={ref}>
            <button
                onClick={() => setOpen(prev => !prev)}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 hover:bg-primary/20 transition-colors"
            >
                <User className="h-4 w-4 text-primary" strokeWidth={1.5} />
            </button>
            {open && (
                <div className="absolute right-0 top-full mt-2 w-44 rounded-lg border bg-card shadow-lg z-50 overflow-hidden">
                    <div className="px-3 py-2.5 border-b">
                        <p className="text-xs font-semibold text-foreground truncate">{user?.username ?? "—"}</p>
                        <p className="text-[10px] text-muted-foreground capitalize truncate">{user?.role ?? "user"}</p>
                    </div>
                    <Link
                        href="/settings"
                        onClick={() => setOpen(false)}
                        className="flex items-center gap-2.5 w-full px-3 py-2 text-sm text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors"
                    >
                        <Settings className="h-4 w-4" strokeWidth={1.5} />
                        Settings
                    </Link>
                    <button
                        onClick={handleLogout}
                        className="flex items-center gap-2.5 w-full px-3 py-2 text-sm text-muted-foreground hover:bg-red-500/10 hover:text-red-500 transition-colors"
                    >
                        <LogOut className="h-4 w-4" strokeWidth={1.5} />
                        Logout
                    </button>
                </div>
            )}
        </div>
    );
}

// ── ClientLayout ───────────────────────────────────────────────────────────────
export function ClientLayout({ children }: { children: React.ReactNode }) {
    const pathname                  = usePathname();
    const isMobile                  = useIsMobile();
    const { setIsProcessing }       = useContext(TableDataContext);
    const { collapsed, toggle }     = useSidebarCollapsed();

    const pageTitles: Record<string, string> = {
        "/":              "Import Data",
        "/dashboard":     "Dashboard",
        "/db":            "All Cases",
        "/knowledge-base":"Knowledge Base",
        "/report-harian": "Daily Report",
        "/migrasi-murid": "Migrasi Murid",
        "/cek-duplikasi": "Cek Duplikasi",
        "/data-weaver":   "Edit NIS",
        "/settings":      "Settings",
    };

    useEffect(() => {
        setIsProcessing(false);
    }, [pathname, setIsProcessing]);

    if (pathname === "/login") return <>{children}</>;
    if (pathname === "/migrasi-murid") {
        return <div className="h-full flex flex-col bg-background">{children}</div>;
    }

    return (
        <div className={cn(
            "grid w-full",
            isMobile ? "grid-rows-[auto_1fr]" : "grid-cols-[auto_1fr]",
        )}>
            {/* ── Desktop Sidebar ── */}
            {!isMobile && (
                <div className={cn(
                    "hidden md:flex flex-col h-screen sticky top-0 border-r bg-card",
                    "transition-all duration-300 ease-in-out",
                    collapsed ? "w-[60px] overflow-visible" : "w-[220px] overflow-hidden",
                )}>
                    {/* ── Logo row ── */}
                    <div style={{ height: 56, flexShrink: 0, borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", overflow: "visible" }}>
                        {collapsed ? (
                            <div style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "center", width: "100%", height: "100%", overflow: "visible" }}>
                                <Link href="/" style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
                                    <div style={{ width: 26, height: 26, background: "var(--primary)", borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15 }}>
                                        📊
                                    </div>
                                </Link>
                                <button
                                    onClick={toggle}
                                    aria-label="Expand sidebar"
                                    style={{
                                        position: "absolute",
                                        right: -12,
                                        top: "50%",
                                        transform: "translateY(-50%)",
                                        width: 20,
                                        height: 20,
                                        borderRadius: "50%",
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        background: "var(--card, #fff)",
                                        border: "1px solid var(--border)",
                                        cursor: "pointer",
                                        zIndex: 10,
                                        boxShadow: "0 1px 4px rgba(0,0,0,0.12)",
                                    }}
                                    className="text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                                >
                                    <PanelLeftOpen style={{ width: 11, height: 11 }} strokeWidth={2} />
                                </button>
                            </div>
                        ) : (
                            <div style={{ display: "flex", alignItems: "center", width: "100%", padding: "0 12px", gap: 8 }}>
                                <Link href="/" className="flex items-center gap-2 font-bold text-primary text-base flex-1 min-w-0">
                                    <div className="w-6 h-6 bg-primary rounded flex items-center justify-center text-primary-foreground text-sm shrink-0">
                                        📊
                                    </div>
                                    <span className="truncate">Gsheet Case</span>
                                </Link>
                                <button
                                    onClick={toggle}
                                    className="shrink-0 flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                                    aria-label="Collapse sidebar"
                                >
                                    <PanelLeftClose className="h-4 w-4" strokeWidth={1.5} />
                                </button>
                            </div>
                        )}
                    </div>

                    {/* ── Nav scroll area ── */}
                    <div className="flex-1 overflow-y-auto overflow-x-hidden">
                        <NavLinks collapsed={collapsed} />
                    </div>

                    {/* ── Settings footer ── */}
                    <div className="flex-shrink-0 border-t p-3">
                        {collapsed ? (
                            <SidebarTooltip label="Settings">
                                <Link
                                    href="/settings"
                                    className={cn(
                                        "flex items-center justify-center w-full py-2 rounded-md transition-colors",
                                        pathname === "/settings"
                                            ? "bg-muted text-foreground"
                                            : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                                    )}
                                >
                                    <Settings className="h-4 w-4" strokeWidth={1.5} />
                                </Link>
                            </SidebarTooltip>
                        ) : (
                            <Link
                                href="/settings"
                                className={cn(
                                    "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                                    pathname === "/settings"
                                        ? "bg-muted text-foreground"
                                        : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                                )}
                            >
                                <Settings className="h-4 w-4 shrink-0" strokeWidth={1.5} />
                                <span>Settings</span>
                            </Link>
                        )}
                    </div>
                </div>
            )}

            {/* ── Main content ── */}
            <div className="flex flex-col h-screen overflow-hidden">
                <header className="flex h-14 items-center gap-3 border-b bg-background px-4 lg:px-6 flex-shrink-0 z-40">
                    {isMobile && (
                        <Sheet>
                            <SheetTrigger asChild>
                                <Button variant="outline" size="icon" className="shrink-0">
                                    <Menu className="h-5 w-5" />
                                    <span className="sr-only">Open navigation menu</span>
                                </Button>
                            </SheetTrigger>
                            <SheetContent side="left" className="flex flex-col p-0 w-[220px]">
                                <SheetHeader className="h-auto flex items-center border-b px-4 py-4">
                                    <SheetTitle asChild>
                                        <Link href="/" className="flex items-center gap-2 font-bold text-primary text-base">
                                            <div className="w-6 h-6 bg-primary rounded flex items-center justify-center text-primary-foreground text-sm">
                                                📊
                                            </div>
                                            <span>Gsheet Case</span>
                                        </Link>
                                    </SheetTitle>
                                </SheetHeader>
                                <div className="flex-1 overflow-y-auto">
                                    <NavLinks isMobile={true} />
                                </div>
                                <div className="mt-auto p-4 border-t">
                                    <SheetClose asChild>
                                        <Link
                                            href="/settings"
                                            className={cn(
                                                "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                                                pathname === "/settings"
                                                    ? "bg-muted text-foreground"
                                                    : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                                            )}
                                        >
                                            <Settings className="h-4 w-4" strokeWidth={1.5} />
                                            Settings
                                        </Link>
                                    </SheetClose>
                                </div>
                            </SheetContent>
                        </Sheet>
                    )}

                    <div className="flex-1">
                        <h1 className="text-xl font-bold tracking-tight text-foreground">
                            {pageTitles[pathname] || "Gsheet Case"}
                        </h1>
                    </div>

                    <ProcessingIndicator />
                    <ThemeSwitch />
                    <UserMenu />
                </header>

                <main className="flex-1 flex flex-col bg-muted/20 overflow-hidden">
                    <div className="h-full w-full overflow-y-auto flex flex-col">
                        {children}
                    </div>
                </main>
            </div>
        </div>
    );
}