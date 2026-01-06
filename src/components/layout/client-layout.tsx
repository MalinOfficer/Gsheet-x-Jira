
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetClose, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Menu, BarChart, GanttChartSquare, Settings, ListTree, GitBranch, Files, Combine, CodeXml, FileCog, PackageSearch, RefreshCw, LayoutDashboard, Database } from "lucide-react";
import { cn } from "@/lib/utils";
import { useContext, useEffect, useState } from "react";
import { TableDataContext } from "@/store/table-data-context";
import { useIsMobile } from "@/hooks/use-mobile";
import React from "react";
import { ThemeSwitch } from "../ui/theme-switch";
import { Spinner } from "../ui/spinner";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../ui/tooltip";


const primaryNavItems = [
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/", label: "Import Data", icon: ListTree },
    { href: "/db", label: "DB", icon: Database },
    { href: "/report-harian", label: "Daily Report", icon: BarChart },
    { href: "/migrasi-murid", label: "Migrasi Murid", icon: GitBranch },
];

const secondaryNavItems = [
    { href: "/cek-duplikasi", label: "Cek Duplikasi", icon: Files, featureFlag: 'areSecondaryToolsEnabled' },
    { href: "/data-weaver", label: "Edit NIS", icon: Combine, featureFlag: 'areSecondaryToolsEnabled' },
    { href: "/migrasi-produk", label: "Migrasi Produk", icon: PackageSearch, featureFlag: 'areSecondaryToolsEnabled' },
];

const advancedNavItems = [
    { href: "/code-viewer", label: "Code Viewer", icon: CodeXml, featureFlag: 'isCodeViewerEnabled' },
]


function NavLinks() {
    const pathname = usePathname();
    const { isCodeViewerEnabled, areSecondaryToolsEnabled } = useContext(TableDataContext);
    
    const isVisible = (item: { featureFlag?: string }) => {
        if (!item.featureFlag) return true;
        if (item.featureFlag === 'isCodeViewerEnabled') return isCodeViewerEnabled;
        if (item.featureFlag === 'areSecondaryToolsEnabled') return areSecondaryToolsEnabled;
        return true;
    }

    const visibleSecondaryItems = secondaryNavItems.filter(isVisible);
    const visibleAdvancedItems = advancedNavItems.filter(isVisible);

    const allVisibleItems = [...primaryNavItems, ...visibleSecondaryItems, ...visibleAdvancedItems];

    return (
        <nav className="grid items-start gap-1 px-2 text-sm font-medium">
            {allVisibleItems.map((item) => (
                <Link
                    key={item.label}
                    href={item.href}
                    className={cn(
                        "flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-all hover:text-primary",
                        pathname === item.href && "bg-muted text-primary"
                    )}
                >
                    <item.icon className="h-4 w-4" />
                    {item.label}
                </Link>
            ))}
        </nav>
    );
}

function ProcessingIndicator() {
    const { isProcessing } = useContext(TableDataContext);
    if (!isProcessing) return null;

    return (
        <div className="flex items-center gap-2 rounded-lg px-3 py-2 text-primary">
            <RefreshCw className="h-4 w-4 animate-spin" />
            <span className="text-sm font-medium">Processing...</span>
        </div>
    );
}


export function ClientLayout({ children }: { children: React.ReactNode }) {
    const { isProcessing, setIsProcessing } = useContext(TableDataContext);
    const pathname = usePathname();
    const [isClient, setIsClient] = useState(false);
    const isMobile = useIsMobile();
    
    const pageTitles: Record<string, string> = {
        "/": "Import Data",
        "/dashboard": "Dashboard",
        "/db": "All Case Database",
        "/report-harian": "Report Center",
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
            "grid h-screen w-full",
            isMobile ? "grid-rows-[auto_1fr]" : "md:grid-cols-[220px_1fr]",
            isProcessing && "pointer-events-none"
        )}>
            {/* --- Desktop Sidebar --- */}
            {!isMobile && (
                <div className="hidden border-r bg-muted/40 md:flex flex-col">
                    <div className="flex h-full max-h-screen flex-col gap-2">
                        <div className="flex h-16 items-center border-b px-4 lg:px-6">
                            <Link href="/" className="flex items-center gap-2 font-semibold text-primary">
                                <GanttChartSquare className="h-6 w-6" />
                                <span className="">Gsheet Case</span>
                            </Link>
                        </div>
                        <div className="flex-1 overflow-y-auto">
                            <NavLinks />
                        </div>
                        <div className="mt-auto p-4 space-y-2">
                            <ProcessingIndicator />
                            <Link href="/settings">
                                <Button variant="secondary" className="w-full">
                                    <Settings className="mr-2 h-4 w-4" />
                                    Settings
                                </Button>
                            </Link>
                        </div>
                    </div>
                </div>
            )}
            
            {/* --- Main Content Area --- */}
            <div className="flex flex-col">
                 {/* --- Mobile/Main Header --- */}
                <header className="flex h-16 items-center gap-4 border-b bg-background px-4 lg:px-6 flex-shrink-0">
                    {/* Hamburger Menu for Mobile */}
                    {isMobile && (
                        <Sheet>
                            <SheetTrigger asChild>
                                <Button variant="outline" size="icon" className="shrink-0">
                                    <Menu className="h-5 w-5" />
                                    <span className="sr-only">Open navigation menu</span>
                                </Button>
                            </SheetTrigger>
                            <SheetContent side="left" className="flex flex-col">
                                <SheetHeader className="mb-4">
                                    <SheetTitle asChild>
                                        <Link href="/" className="flex items-center gap-2 font-semibold text-primary">
                                            <GanttChartSquare className="h-6 w-6" />
                                            <span>Gsheet Case</span>
                                        </Link>
                                    </SheetTitle>
                                </SheetHeader>
                                <NavLinks />
                                <div className="mt-auto">
                                    <ProcessingIndicator />
                                    <SheetClose asChild>
                                        <Link href="/settings">
                                            <Button variant="secondary" className="w-full">
                                                <Settings className="mr-2 h-4 w-4" />
                                                Settings
                                            </Button>
                                        </Link>
                                    </SheetClose>
                                </div>
                            </SheetContent>
                        </Sheet>
                    )}

                    <div className="w-full flex-1">
                       <h1 className="font-semibold">{currentPageTitle}</h1>
                    </div>

                    <ThemeSwitch />
                    
                    {isMobile && (
                        <Link href="/settings">
                             <Button variant="ghost" size="icon">
                                <Settings className="h-5 w-5" />
                            </Button>
                        </Link>
                    )}
                </header>
                <main className="flex-1 flex flex-col bg-muted/20 min-h-0">
                    {children}
                </main>
            </div>
        </div>
    );
}
