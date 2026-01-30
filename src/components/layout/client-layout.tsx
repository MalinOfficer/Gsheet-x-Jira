
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Sheet, SheetTrigger, SheetContent, SheetHeader, SheetTitle, SheetClose } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Menu, Settings, GanttChartSquare, LayoutDashboard, ListTree, BarChart, BookOpen, Database, GitBranch, Files, Combine, PackageSearch, CodeXml, RefreshCw, HardHat } from "lucide-react";
import { cn } from "@/lib/utils";
import { useContext, useEffect, useState } from "react";
import { SettingsContext } from "@/contexts/settings-provider";
import { TableDataContext } from "@/store/table-data-context";
import { useIsMobile } from "@/hooks/use-mobile";
import React from "react";
import { ThemeSwitch } from "../ui/theme-switch";

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
    const { setIsProcessing } = useContext(TableDataContext);
    
    const isVisible = (item: { featureFlag?: string }) => {
        if (!item.featureFlag) return true;
        if (item.featureFlag === 'isCodeViewerEnabled') return isCodeViewerEnabled;
        if (item.featureFlag === 'areSecondaryToolsEnabled') return areSecondaryToolsEnabled;
        return true;
    };

    const handleHeavyLinkClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
        if (e.currentTarget.pathname === pathname) {
            e.preventDefault();
            return;
        }
        setIsProcessing(true);
    };
    
    const Wrapper = isMobile ? SheetClose : 'div';

    return (
        <nav className="grid items-start gap-0">
            {(Object.keys(navItems) as NavCategory[]).map(category => {
                const visibleItems = navItems[category].filter(isVisible);
                if (visibleItems.length === 0) return null;

                return (
                    <div key={category} className="py-5">
                        <h2 className="px-5 pb-2.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                            {category}
                        </h2>
                        {visibleItems.map((item) => {
                            const isHeavy = item.href === '/dashboard' || item.href === '/db';
                            const isActive = pathname === item.href;

                            return (
                                <Wrapper key={item.label} asChild>
                                    <Link
                                        href={item.href}
                                        onClick={isHeavy ? handleHeavyLinkClick : undefined}
                                        className={cn(
                                            "flex items-center gap-3 px-5 py-2.5 text-sm font-medium transition-all duration-200",
                                            "border-r-[3px]",
                                            isActive
                                                ? "border-primary bg-primary/10 text-primary font-semibold"
                                                : "border-transparent text-muted-foreground hover:bg-muted/50 hover:text-foreground",
                                            item.disabled && "pointer-events-none opacity-50"
                                        )}
                                    >
                                        <item.icon className="h-5 w-5" strokeWidth={1.5} />
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


export function ClientLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const [isClient, setIsClient] = useState(false);
    const isMobile = useIsMobile();
    
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
        setIsClient(true);
    }, []);
    
    const isProcessing = useContext(TableDataContext).isProcessing;


    if (!isClient) {
        return (
             <div className="flex-1 flex flex-col bg-background">
                {children}
            </div>
        );
    }

    if (pathname === '/migrasi-murid') {
        return (
             <div className="h-full flex flex-col bg-background">
                {children}
            </div>
        )
    }
    
    return (
        <div className={cn(
            "grid w-full",
            isMobile ? "grid-rows-[auto_1fr]" : "md:grid-cols-[220px_1fr]",
        )}>
            {/* --- Desktop Sidebar --- */}
            {!isMobile && (
                <div className="hidden border-r bg-card md:flex flex-col h-screen sticky top-0">
                    {/* Sidebar Header */}
                    <div className="flex h-auto items-center px-5 py-5 border-b flex-shrink-0">
                        <Link href="/" className="flex items-center gap-2 font-bold text-primary text-base">
                            <div className="w-6 h-6 bg-primary rounded flex items-center justify-center text-primary-foreground text-sm">
                                📊
                            </div>
                            <span>Gsheet Case</span>
                        </Link>
                    </div>
                    
                    {/* Navigation Links */}
                    <div className="flex-1 overflow-y-auto">
                        <NavLinks />
                    </div>
                    
                    {/* Sidebar Footer */}
                    <div className="mt-auto flex-shrink-0 border-t p-5">
                        <Link
                            href="/settings"
                            className={cn(
                                "flex items-center gap-3 px-2.5 py-2.5 rounded-md text-sm font-medium transition-all duration-200",
                                pathname === "/settings" 
                                    ? "bg-muted text-foreground" 
                                    : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                            )}
                        >
                            <Settings className="h-5 w-5" strokeWidth={1.5} />
                            Settings
                        </Link>
                    </div>
                </div>
            )}
            
            {/* --- Main Content Area --- */}
            <div className="flex flex-col h-screen overflow-hidden">
                 {/* --- Mobile/Main Header --- */}
                <header className="flex h-16 items-center gap-4 border-b bg-background px-4 lg:px-6 flex-shrink-0 z-40">
                    {/* Hamburger Menu for Mobile */}
                    {isMobile && (
                        <Sheet>
                            <SheetTrigger asChild>
                                <Button variant="outline" size="icon" className="shrink-0">
                                    <Menu className="h-5 w-5" />
                                    <span className="sr-only">Open navigation menu</span>
                                </Button>
                            </SheetTrigger>
                            <SheetContent side="left" className="flex flex-col p-0 w-[220px]">
                                <SheetHeader className="h-auto flex items-center border-b px-5 py-5">
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
                                  <NavLinks isMobile={true}/>
                                </div>
                                <div className="mt-auto p-5 border-t">
                                    <SheetClose asChild>
                                        <Link
                                            href="/settings"
                                            className={cn(
                                                "flex items-center gap-3 px-2.5 py-2.5 rounded-md text-sm font-medium transition-all duration-200",
                                                pathname === "/settings" 
                                                    ? "bg-muted text-foreground" 
                                                    : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                                            )}
                                        >
                                            <Settings className="h-5 w-5" strokeWidth={1.5} />
                                            Settings
                                        </Link>
                                    </SheetClose>
                                </div>
                            </SheetContent>
                        </Sheet>
                    )}

                    <div className="w-full flex-1">
                       <h1 className="text-2xl font-bold tracking-tight text-foreground">{currentPageTitle}</h1>
                    </div>
                    
                    <ProcessingIndicator />
                    <ThemeSwitch />
                    
                    {isMobile && (
                        <Link href="/settings">
                             <Button variant="ghost" size="icon">
                                <Settings className="h-5 w-5" />
                            </Button>
                        </Link>
                    )}
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
