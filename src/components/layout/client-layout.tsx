
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Sheet, SheetTrigger, SheetContent, SheetHeader, SheetTitle, SheetClose } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Menu, Settings, GanttChartSquare, LayoutDashboard, ListTree, BarChart, BookOpen, Database, GitBranch, Files, Combine, PackageSearch, CodeXml, RefreshCw, HardHat } from "lucide-react";
import { cn } from "@/lib/utils";
import { useContext, useEffect, useState } from "react";
import { SettingsContext } from "@/contexts/settings-provider";
import { useIsMobile } from "@/hooks/use-mobile";
import React from "react";
import { ThemeSwitch } from "../ui/theme-switch";

const navItems = {
    overview: [
        { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
        { href: "/", label: "Import Data", icon: ListTree },
        { href: "/db", label: "Data ALL Case", icon: Database },
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
        <nav className="grid items-start gap-1 text-sm font-medium">
            {(Object.keys(navItems) as NavCategory[]).map(category => {
                const visibleItems = navItems[category].filter(isVisible);
                if (visibleItems.length === 0) return null;

                return (
                    <div key={category}>
                        <h2 className="mb-3 mt-6 ml-3 text-xs font-bold uppercase tracking-widest text-muted-foreground">
                            {category}
                        </h2>
                        {visibleItems.map((item) => (
                            <Wrapper key={item.label} asChild>
                                <Link
                                    href={item.href}
                                    className={cn(
                                        "flex items-center gap-3 rounded-lg px-4 py-2.5 text-muted-foreground transition-all",
                                        "text-sm font-medium",
                                        pathname === item.href 
                                            ? "bg-blue-100 dark:bg-blue-900/20 text-primary font-semibold" 
                                            : "hover:bg-muted/50 hover:text-foreground",
                                        item.disabled && "pointer-events-none opacity-50"
                                    )}
                                >
                                    <item.icon className="h-5 w-5" strokeWidth={1.5} />
                                    {item.label}
                                </Link>
                            </Wrapper>
                        ))}
                    </div>
                );
            })}
        </nav>
    );
}

function ProcessingIndicator() {
    const { isProcessing } = useContext(SettingsContext);
    if (!isProcessing) return null;

    return (
        <div className="flex items-center gap-2 text-primary">
            <RefreshCw className="h-4 w-4 animate-spin" />
            <span className="hidden sm:inline text-sm font-medium">Processing...</span>
        </div>
    );
}


export function ClientLayout({ children }: { children: React.ReactNode }) {
    const { isProcessing, setIsProcessing } = useContext(SettingsContext);
    const pathname = usePathname();
    const [isClient, setIsClient] = useState(false);
    const isMobile = useIsMobile();
    
    const pageTitles: Record<string, string> = {
        "/": "Import Data",
        "/dashboard": "Dashboard",
        "/db": "All Case Database",
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

    useEffect(() => {
        setIsProcessing(false);
    }, [pathname, setIsProcessing]);

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
            isMobile ? "grid-rows-[auto_1fr]" : "md:grid-cols-[260px_1fr]",
            isProcessing && "pointer-events-none"
        )}>
            {/* --- Desktop Sidebar --- */}
            {!isMobile && (
                <div className="hidden border-r bg-card md:flex flex-col h-screen sticky top-0">
                    <div className="flex h-16 items-center border-b px-6 flex-shrink-0">
                        <Link href="/" className="flex items-center gap-2.5 font-semibold text-primary">
                            <GanttChartSquare className="h-6 w-6" strokeWidth={1.5} />
                            <span className="text-lg">Gsheet Case</span>
                        </Link>
                    </div>
                    
                    <div className="flex-1 overflow-y-auto py-2 px-4">
                        <NavLinks />
                    </div>
                    
                    <div className="mt-auto flex-shrink-0 border-t p-4">
                        <Link
                            href="/settings"
                            className={cn(
                                "flex items-center gap-3 rounded-lg px-4 py-2.5 text-muted-foreground transition-all",
                                "text-sm font-medium",
                                pathname === "/settings" 
                                    ? "bg-blue-100 dark:bg-blue-900/20 text-primary font-semibold" 
                                    : "hover:bg-muted/50 hover:text-foreground"
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
                            <SheetContent side="left" className="flex flex-col p-0">
                                <SheetHeader className="h-16 flex items-center border-b px-6">
                                    <SheetTitle asChild>
                                        <Link href="/" className="flex items-center gap-2.5 font-semibold text-primary">
                                            <GanttChartSquare className="h-6 w-6" strokeWidth={1.5} />
                                            <span className="text-lg">Gsheet Case</span>
                                        </Link>
                                    </SheetTitle>
                                </SheetHeader>
                                <div className="flex-1 overflow-y-auto py-2 px-4">
                                  <NavLinks isMobile={true}/>
                                </div>
                                <div className="mt-auto p-4 space-y-2 border-t">
                                    <SheetClose asChild>
                                        <Link
                                            href="/settings"
                                            className={cn(
                                                "flex items-center gap-3 rounded-lg px-4 py-2.5 text-muted-foreground transition-all",
                                                "text-sm font-medium",
                                                pathname === "/settings" 
                                                    ? "bg-blue-100 dark:bg-blue-900/20 text-primary font-semibold" 
                                                    : "hover:bg-muted/50 hover:text-foreground"
                                            )}
                                        >
                                            <Settings className="mr-3 h-5 w-5" strokeWidth={1.5} />
                                            Settings
                                        </Link>
                                    </SheetClose>
                                </div>
                            </SheetContent>
                        </Sheet>
                    )}

                    <div className="w-full flex-1">
                       <h1 className="font-bold">{currentPageTitle}</h1>
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
                <main className="flex-1 flex flex-col bg-muted/20 overflow-y-auto">
                    {children}
                </main>
            </div>
        </div>
    );
}
