"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetClose, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Menu, BarChart, GanttChartSquare, Settings, ListTree, GitBranch, Files, Combine, CodeXml, FileCog, PackageSearch, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { useContext, useEffect, useState } from "react";
import { TableDataContext } from "@/store/table-data-context";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
  navigationMenuTriggerStyle,
} from "@/components/ui/navigation-menu";
import React from "react";
import { ThemeSwitch } from "@/components/ui/theme-switch";
import { Spinner } from "@/components/ui/spinner";


const primaryNavItems = [
    { href: "/", label: "Import Flow", icon: ListTree },
    { href: "/report-harian", label: "Daily Report", icon: BarChart },
    { href: "/migrasi-murid", label: "Migrasi Murid", icon: GitBranch },
];

const secondaryNavItems = [
    { href: "/cek-duplikasi", label: "Cek Duplikasi", description: "Temukan NIS duplikat atau data tidak valid di beberapa file Excel.", icon: Files },
    { href: "/data-weaver", label: "Data Weaver (edit file bulk)", description: "Gabungkan dua file Excel berdasarkan kolom yang sama.", icon: Combine },
    { href: "/migrasi-produk", label: "Migrasi Product", description: "Alat untuk migrasi data produk.", icon: PackageSearch },
];

const advancedNavItems = [
    { href: "/code-viewer", label: "Code Viewer", description: "Tampilkan dan unduh seluruh kode sumber aplikasi ini.", icon: CodeXml, featureFlag: 'isCodeViewerEnabled' },
]

function NavLinksDesktop() {
    const pathname = usePathname();
    const { isCodeViewerEnabled } = useContext(TableDataContext);

    const visibleAdvancedItems = advancedNavItems.filter(item => {
        if (item.featureFlag === 'isCodeViewerEnabled') return isCodeViewerEnabled;
        return true;
    });

    const allSecondaryItems = [...secondaryNavItems, ...visibleAdvancedItems];


    return (
      <NavigationMenu className="hidden md:flex">
        <NavigationMenuList>
          {primaryNavItems.map((item) => (
            <NavigationMenuItem key={item.label}>
              <Link href={item.href} legacyBehavior passHref>
                <NavigationMenuLink
                  active={pathname === item.href}
                  className={navigationMenuTriggerStyle()}
                >
                  <item.icon className="h-4 w-4 mr-2 shrink-0" />
                  {item.label}
                </NavigationMenuLink>
              </Link>
            </NavigationMenuItem>
          ))}
          {allSecondaryItems.length > 0 && (
            <NavigationMenuItem>
                <NavigationMenuTrigger>
                    More Tools
                </NavigationMenuTrigger>
                <NavigationMenuContent>
                    <ul className="grid w-[400px] gap-3 p-4 md:w-[500px] md:grid-cols-2 lg:w-[600px] ">
                        {allSecondaryItems.map((item) => (
                            <ListItem
                                key={item.label}
                                href={item.href}
                                title={item.label}
                                icon={item.icon}
                            >
                            {item.description}
                            </ListItem>
                        ))}
                    </ul>
                </NavigationMenuContent>
            </NavigationMenuItem>
           )}
        </NavigationMenuList>
      </NavigationMenu>
    )
}

function NavLinksMobile() {
    const pathname = usePathname();
    const { isCodeViewerEnabled } = useContext(TableDataContext);

    const visibleAdvancedItems = advancedNavItems.filter(item => {
        if (item.featureFlag === 'isCodeViewerEnabled') return isCodeViewerEnabled;
        return true;
    });
    
    const allNavItems = [...primaryNavItems, ...secondaryNavItems, ...visibleAdvancedItems];

    return (
        <>
            {allNavItems.map((item) => (
                <SheetClose asChild key={item.label}>
                    <Link
                        href={item.href}
                        className={cn(
                            "flex items-center justify-start rounded-lg px-2 py-1.5 mb-1 text-card-foreground transition-all hover:bg-accent hover:text-accent-foreground",
                            pathname === item.href && "bg-accent text-accent-foreground font-semibold"
                        )}
                    >
                        <item.icon className="h-4 w-4 mr-3 shrink-0" />
                        <span className="truncate">{item.label}</span>
                    </Link>
                </SheetClose>
            ))}
        </>
    );
}

function ProcessingIndicator() {
    const { isProcessing } = useContext(TableDataContext);
    if (!isProcessing) return null;

    return (
        <div className="flex items-center gap-3 rounded-lg px-3 py-2 text-primary">
            <Spinner className="w-5 h-5" style={{width: '20px', height: '20px'}}/>
            <span className="text-sm font-medium">Processing...</span>
        </div>
    );
}


export function ClientLayout({ children }: { children: React.ReactNode }) {
    const { isProcessing, setIsProcessing } = useContext(TableDataContext);
    const pathname = usePathname();
    const [isClient, setIsClient] = useState(false);
    const isMobile = useIsMobile();

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
    
    return (
        <div className={cn("grid h-screen w-full grid-rows-[auto_1fr]", isProcessing && "pointer-events-none")}>
             <header className="sticky top-0 z-40 flex h-16 items-center justify-between gap-4 border-b bg-card px-4 md:px-6">
                <div className="flex items-center gap-4">
                    {/* Hamburger Menu for Mobile */}
                    <Sheet>
                        <SheetTrigger asChild>
                            <Button variant="outline" size="icon" className="shrink-0 md:hidden">
                                <Menu className="h-5 w-5" />
                                <span className="sr-only">Open navigation menu</span>
                            </Button>
                        </SheetTrigger>
                        <SheetContent side="left" className="flex flex-col">
                            <SheetHeader className="mb-4">
                                <SheetTitle asChild>
                                    <Link
                                        href="/"
                                        className="flex items-center gap-2 font-semibold text-primary"
                                    >
                                        <GanttChartSquare className="h-6 w-6" />
                                        <span>Gsheet Tools V3</span>
                                    </Link>
                                </SheetTitle>
                            </SheetHeader>
                            <nav className="grid gap-2 text-base font-medium">
                                <NavLinksMobile />
                                <ProcessingIndicator />
                            </nav>
                            <div className="mt-auto">
                                <SheetClose asChild>
                                     <Link
                                        href="/settings"
                                        className={cn(
                                            "flex items-center justify-start rounded-lg px-3 py-2 text-card-foreground transition-all hover:bg-accent hover:text-accent-foreground",
                                            pathname === "/settings" && "bg-accent text-accent-foreground font-semibold"
                                        )}
                                    >
                                        <Settings className="h-5 w-5 mr-3" />
                                        Settings
                                    </Link>
                                </SheetClose>
                            </div>
                        </SheetContent>
                    </Sheet>
                    
                    {/* Desktop Logo */}
                    <Link href="/" className="hidden md:flex items-center gap-2 font-semibold text-primary">
                        <GanttChartSquare className="h-6 w-6" />
                        <span className="text-lg">Gsheet Tools V3</span>
                    </Link>
                    
                    {/* Desktop Navigation */}
                    <NavLinksDesktop />
                </div>

                {/* Right side of header */}
                <div className="flex items-center gap-4">
                    <div className="hidden md:block">
                        <ProcessingIndicator />
                    </div>
                    <ThemeSwitch />
                     <Link
                        href="/settings"
                        className={cn(
                            "flex items-center justify-center rounded-full h-9 w-9 text-card-foreground transition-all hover:bg-accent hover:text-accent-foreground",
                             pathname === "/settings" && "bg-accent text-accent-foreground"
                        )}
                    >
                        <Settings className="h-5 w-5" />
                        <span className="sr-only">Settings</span>
                    </Link>
                </div>
            </header>
            <main className="bg-background min-h-0 overflow-auto">{children}</main>
        </div>
    );
}


const ListItem = React.forwardRef<
  React.ElementRef<"a">,
  React.ComponentPropsWithoutRef<"a"> & { icon?: React.ElementType }
>(({ className, title, children, icon: Icon, ...props }, ref) => {
  return (
    <li>
      <NavigationMenuLink asChild>
        <a
          ref={ref}
          className={cn(
            "block select-none space-y-1 rounded-md p-3 leading-none no-underline outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground",
            className
          )}
          {...props}
        >
          <div className="flex items-center gap-2">
            {Icon && <Icon className="h-5 w-5" />}
            <div className="text-sm font-medium leading-none">{title}</div>
          </div>
          <p className="line-clamp-2 text-sm leading-snug text-muted-foreground">
            {children}
          </p>
        </a>
      </NavigationMenuLink>
    </li>
  );
});
ListItem.displayName = "ListItem"
    