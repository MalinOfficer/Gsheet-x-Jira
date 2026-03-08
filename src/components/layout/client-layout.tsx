"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Sheet, SheetTrigger, SheetContent, SheetHeader, SheetTitle, SheetClose } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Menu, Settings, LayoutDashboard, ListTree, BarChart, Database, GitBranch, Files, Combine, PackageSearch, CodeXml, RefreshCw, HardHat, LogOut, User, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { useContext, useEffect, useRef, useState } from "react";
import { SettingsContext } from "@/contexts/settings-provider";
import { TableDataContext } from "@/store/table-data-context";
import { useIsMobile } from "@/hooks/use-mobile";
import React from "react";
import { ThemeSwitch } from "../ui/theme-switch";
import { useAuth } from "@/contexts/AuthContext";

const navItems = {
    overview: [
        { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
        { href: "/", label: "Import Data", icon: ListTree },
        { href: "/db", label: "Data All Case", icon: Database },
    ],
    reports: [
        { href: "/report-harian", label: "Daily Report", icon: BarChart },
        { href: "/knowledge-base", label: "Knowledge Base", icon: HardHat, disabled: true },
    ],
    tools: [
        { href: "/migrasi-murid", label: "Migrasi Murid", icon: GitBranch },
        { href: "/cek-duplikasi", label: "Cek Duplikasi", icon: Files, featureFlag: 'areSecondaryToolsEnabled' },
        { href: "/data-weaver", label: "Edit NIS", icon: Combine, featureFlag: 'areSecondaryToolsEnabled' },
        { href: "/migrasi-produk", label: "Migrasi Produk", icon: PackageSearch, featureFlag: 'areSecondaryToolsEnabled' },
    ],
    advanced: [
        { href: "/code-viewer", label: "Code Viewer", icon: CodeXml, featureFlag: 'isCodeViewerEnabled' },
    ]
};

type NavCategory = keyof typeof navItems;

function NavLinks({ isMobile = false }: { isMobile?: boolean }) {
    const pathname = usePathname();
    const { isCodeViewerEnabled, areSecondaryToolsEnabled } = useContext(SettingsContext);

    const isVisible = (item: { featureFlag?: string }) => {
        if (!item.featureFlag) return true;
        if (item.featureFlag === 'isCodeViewerEnabled') return isCodeViewerEnabled;
        if (item.featureFlag === 'areSecondaryToolsEnabled') return areSecondaryToolsEnabled;
        return true;
    };

    const Wrapper = isMobile ? SheetClose : 'div';

    return (
        <nav className="grid items-start gap-0">
            {(Object.keys(navItems) as NavCategory[]).map(category => {
                const visibleItems = navItems[category].filter(isVisible);
                if (visibleItems.length === 0) return null;

                return (
                    <div key={category} className="py-3">
                        <h2 className="px-4 pb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                            {category}
                        </h2>
                        {visibleItems.map((item) => {
                            const isActive = pathname === item.href;
                            return (
                                <Wrapper key={item.label} asChild>
                                    <Link
                                        href={item.href}
                                        className={cn(
                                            "flex items-center gap-3 px-4 py-2 text-sm font-medium transition-all duration-200",
                                            "border-r-[3px]",
                                            isActive
                                                ? "border-primary bg-primary/10 text-primary font-semibold"
                                                : "border-transparent text-muted-foreground hover:bg-muted/50 hover:text-foreground",
                                            item.disabled && "pointer-events-none opacity-50"
                                        )}
                                    >
                                        <item.icon className="h-4 w-4" strokeWidth={1.5} />
                                        {item.label}
                                    </Link>
                                </Wrapper>
                            );
                        })}
                    </div>
                );
            })}
        </nav>
    );
}

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

// ── User dropdown di header ───────────────────────────────────────────────────
function UserMenu() {
    const { user, logout } = useAuth();
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        function handleClickOutside(e: MouseEvent) {
            if (ref.current && !ref.current.contains(e.target as Node)) {
                setOpen(false);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    return (
        <div className="relative" ref={ref}>
            {/* Trigger — hanya avatar bulat */}
            <button
                onClick={() => setOpen(prev => !prev)}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 hover:bg-primary/20 transition-colors"
            >
                <User className="h-4 w-4 text-primary" strokeWidth={1.5} />
            </button>

            {/* Dropdown */}
            {open && (
                <div className="absolute right-0 top-full mt-2 w-44 rounded-lg border bg-card shadow-lg z-50 overflow-hidden">
                    {/* Info user */}
                    <div className="px-3 py-2.5 border-b">
                        <p className="text-xs font-semibold text-foreground truncate">{user?.username ?? '—'}</p>
                        <p className="text-[10px] text-muted-foreground capitalize truncate">{user?.role ?? 'user'}</p>
                    </div>
                    {/* Settings */}
                    <Link
                        href="/settings"
                        onClick={() => setOpen(false)}
                        className="flex items-center gap-2.5 w-full px-3 py-2 text-sm text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors"
                    >
                        <Settings className="h-4 w-4" strokeWidth={1.5} />
                        Settings
                    </Link>
                    {/* Logout */}
                    <button
                        onClick={() => { setOpen(false); logout(); }}
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

export function ClientLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const isMobile = useIsMobile();
    const { setIsProcessing } = useContext(TableDataContext);

    const pageTitles: Record<string, string> = {
        "/": "Import Data",
        "/dashboard": "Dashboard",
        "/db": "All Cases",
        "/knowledge-base": "Knowledge Base",
        "/report-harian": "Daily Report",
        "/migrasi-murid": "Migrasi Murid",
        "/cek-duplikasi": "Cek Duplikasi",
        "/data-weaver": "Edit NIS",
        "/migrasi-produk": "Migrasi Produk",
        "/code-viewer": "Code Viewer",
        "/settings": "Settings",
    };

    const currentPageTitle = pageTitles[pathname] || "Gsheet Case";

    useEffect(() => {
        setIsProcessing(false);
    }, [pathname, setIsProcessing]);

    if (pathname === '/migrasi-murid') {
        return (
            <div className="h-full flex flex-col bg-background">
                {children}
            </div>
        );
    }

    return (
        <div className={cn(
            "grid w-full",
            isMobile ? "grid-rows-[auto_1fr]" : "md:grid-cols-[220px_1fr]",
        )}>
            {/* --- Desktop Sidebar --- */}
            {!isMobile && (
                <div className="hidden border-r bg-card md:flex flex-col h-screen sticky top-0">
                    <div className="flex h-14 items-center px-4 border-b flex-shrink-0">
                        <Link href="/" className="flex items-center gap-2 font-bold text-primary text-base">
                            <div className="w-6 h-6 bg-primary rounded flex items-center justify-center text-primary-foreground text-sm">
                                📊
                            </div>
                            <span>Gsheet Case</span>
                        </Link>
                    </div>

                    <div className="flex-1 overflow-y-auto">
                        <NavLinks />
                    </div>

                    {/* Sidebar bottom: Settings tetap ada di sidebar desktop */}
                    <div className="mt-auto flex-shrink-0 border-t p-4">
                        <Link
                            href="/settings"
                            className={cn(
                                "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-all duration-200",
                                pathname === "/settings"
                                    ? "bg-muted text-foreground"
                                    : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                            )}
                        >
                            <Settings className="h-4 w-4" strokeWidth={1.5} />
                            Settings
                        </Link>
                    </div>
                </div>
            )}

            {/* --- Main Content Area --- */}
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
                                {/* Mobile sidebar bottom: Settings */}
                                <div className="mt-auto p-4 border-t">
                                    <SheetClose asChild>
                                        <Link
                                            href="/settings"
                                            className={cn(
                                                "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-all duration-200",
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

                    <div className="w-full flex-1">
                        <h1 className="text-xl font-bold tracking-tight text-foreground">{currentPageTitle}</h1>
                    </div>

                    <ProcessingIndicator />
                    <ThemeSwitch />
                    <UserMenu />  {/* ← hanya avatar bulat, tanpa tombol Settings */}
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