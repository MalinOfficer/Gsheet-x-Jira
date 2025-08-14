
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Menu, Braces, BarChart, GanttChartSquare, Settings, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useContext } from "react";
import { TableDataContext } from "@/store/table-data-context";

const navItems = [
    { href: "/", label: "JSON Converter", icon: Braces },
    { href: "/report-harian", label: "Daily Report", icon: BarChart },
    { href: "/update-case-l3", label: "Update Cases", icon: GanttChartSquare },
];

function NavLinks() {
    const pathname = usePathname();
    const { setIsProcessing } = useContext(TableDataContext);

    const handleLinkClick = (href: string) => {
        if (pathname !== href) {
            setIsProcessing(true);
        }
    };

    return (
        <>
            {navItems.map((item) => (
                <Link
                    key={item.label}
                    href={item.href}
                    onClick={() => handleLinkClick(item.href)}
                    className={cn(
                        "flex items-center gap-3 rounded-lg px-3 py-2 text-card-foreground transition-all hover:bg-accent hover:text-accent-foreground",
                        pathname === item.href && "bg-accent text-accent-foreground font-semibold"
                    )}
                >
                    <item.icon className="h-4 w-4" />
                    {item.label}
                </Link>
            ))}
        </>
    );
}

function LoadingOverlay() {
    return (
        <div className="fixed inset-0 z-[101] bg-background/80 backdrop-blur-sm flex items-center justify-center">
            <div className="flex flex-col items-center gap-2">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-muted-foreground">Processing your request...</p>
            </div>
        </div>
    );
}

export function ClientLayout({ children }: { children: React.ReactNode }) {
    const { showProcessingOverlay } = useContext(TableDataContext);

    return (
        <div className={cn("flex min-h-screen w-full")}>
             {showProcessingOverlay && <LoadingOverlay />}
            {/* Sidebar for Desktop */}
            <aside className="hidden md:flex flex-col w-64 border-r bg-card text-card-foreground">
                <div className="flex h-16 items-center border-b px-6">
                    <Link href="/" className="flex items-center gap-2 font-semibold text-primary">
                        <GanttChartSquare className="h-6 w-6" />
                        <span>GSheet Tools</span>
                    </Link>
                </div>
                <nav className="flex-1 flex flex-col gap-1 p-4 text-sm font-medium">
                    <NavLinks />
                </nav>
                 <div className="mt-auto p-4">
                    <Link
                        href="/settings"
                        className={cn(
                            "flex items-center gap-3 rounded-lg px-3 py-2 text-card-foreground transition-all hover:bg-accent hover:text-accent-foreground",
                            usePathname() === "/settings" && "bg-accent text-accent-foreground font-semibold"
                        )}
                    >
                        <Settings className="h-4 w-4" />
                        Settings
                    </Link>
                </div>
            </aside>

            <div className="flex flex-col flex-1">
                {/* Header for Mobile */}
                <header className="sticky top-0 z-40 flex h-16 items-center gap-4 border-b bg-card px-4 md:hidden">
                    <Sheet>
                        <SheetTrigger asChild>
                            <Button variant="outline" size="icon" className="shrink-0">
                                <Menu className="h-5 w-5" />
                                <span className="sr-only">Open navigation menu</span>
                            </Button>
                        </SheetTrigger>
                        <SheetContent side="left" className="flex flex-col">
                            <nav className="grid gap-2 text-lg font-medium">
                                <Link
                                    href="/"
                                    className="flex items-center gap-2 text-lg font-semibold mb-4 text-primary"
                                >
                                    <GanttChartSquare className="h-6 w-6" />
                                    <span>GSheet Tools</span>
                                </Link>
                                <NavLinks />
                            </nav>
                            <div className="mt-auto">
                                <Link
                                    href="/settings"
                                    className={cn(
                                        "flex items-center gap-3 rounded-lg px-3 py-2 text-card-foreground transition-all hover:bg-accent hover:text-accent-foreground",
                                         usePathname() === "/settings" && "bg-accent text-accent-foreground font-semibold"
                                    )}
                                >
                                    <Settings className="h-5 w-5" />
                                    Settings
                                </Link>
                            </div>
                        </SheetContent>
                    </Sheet>
                     <div className="flex w-full items-center justify-start gap-4">
                        <Link href="/" className="flex items-center gap-2 font-semibold text-primary">
                            <GanttChartSquare className="h-6 w-6" />
                            <span className="text-base">GSheet Tools</span>
                        </Link>
                    </div>
                </header>
                <main className="flex-1 flex flex-col bg-background">{children}</main>
            </div>
        </div>
    );
}
