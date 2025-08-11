"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Menu, Braces, BarChart, GanttChartSquare } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
    { href: "/", label: "Json Converter", icon: Braces },
    { href: "/report-harian", label: "Report Harian", icon: BarChart },
    { href: "/update-case-l3", label: "Update case L3", icon: GanttChartSquare },
];

function NavLinks() {
    const pathname = usePathname();
    return (
        <>
            {navItems.map((item) => (
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
        </>
    );
}


export function ClientLayout({ children }: { children: React.ReactNode }) {
    return (
        <div className="flex min-h-screen w-full flex-col">
          <header className="sticky top-0 flex h-16 items-center gap-4 border-b bg-background px-4 md:px-6 z-50">
            <nav className="hidden flex-col gap-6 text-lg font-medium md:flex md:flex-row md:items-center md:gap-5 md:text-sm lg:gap-6">
              <Link
                href="/"
                className="flex items-center gap-2 text-lg font-semibold md:text-base mr-4"
              >
                <Braces className="h-6 w-6 text-primary" />
                <span className="sr-only">JSON Tools</span>
              </Link>
              <NavLinks />
            </nav>
            <Sheet>
              <SheetTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  className="shrink-0 md:hidden"
                >
                  <Menu className="h-5 w-5" />
                  <span className="sr-only">Toggle navigation menu</span>
                </Button>
              </SheetTrigger>
              <SheetContent side="left">
                <nav className="grid gap-6 text-lg font-medium">
                  <Link
                    href="/"
                    className="flex items-center gap-2 text-lg font-semibold"
                  >
                    <Braces className="h-6 w-6 text-primary" />
                    <span className="sr-only">JSON Tools</span>
                  </Link>
                  <NavLinks />
                </nav>
              </SheetContent>
            </Sheet>
            <div className="flex w-full items-center gap-4 md:ml-auto md:gap-2 lg:gap-4">
              {/* Future header elements can go here */}
            </div>
          </header>
          <main className="flex-1">{children}</main>
        </div>
    );
}
