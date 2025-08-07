import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Menu, Braces } from "lucide-react";
import { StoreProvider } from "@/store/store-provider";

export const metadata: Metadata = {
  title: "GSheet Dashboard & Tools",
  description: "Instantly turn your Google Sheets into interactive dashboards and use other handy tools.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;700&display=swap" rel="stylesheet" />
      </head>
      <body className="font-body antialiased">
        <StoreProvider>
            <div className="flex min-h-screen w-full flex-col">
              <header className="sticky top-0 flex h-16 items-center gap-4 border-b bg-background px-4 md:px-6 z-50">
                <nav className="hidden flex-col gap-6 text-lg font-medium md:flex md:flex-row md:items-center md:gap-5 md:text-sm lg:gap-6">
                  <Link
                    href="/"
                    className="flex items-center gap-2 text-lg font-semibold md:text-base"
                  >
                    <Braces className="h-6 w-6" />
                    <span className="sr-only">JSON Tools</span>
                  </Link>
                  <Link
                    href="/"
                    className="text-foreground transition-colors hover:text-foreground"
                  >
                    JSON to Table
                  </Link>
                  <Link
                    href="/report-harian"
                    className="text-muted-foreground transition-colors hover:text-foreground"
                  >
                    Report Harian
                  </Link>
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
                        <Braces className="h-6 w-6" />
                        <span className="sr-only">JSON Tools</span>
                      </Link>
                      <Link href="/" className="hover:text-foreground">
                        JSON to Table
                      </Link>
                      <Link
                        href="/report-harian"
                        className="text-muted-foreground hover:text-foreground"
                      >
                        Report Harian
                      </Link>
                    </nav>
                  </SheetContent>
                </Sheet>
                <div className="flex w-full items-center gap-4 md:ml-auto md:gap-2 lg:gap-4">
                  {/* Future header elements can go here */}
                </div>
              </header>
              <main className="flex-1">{children}</main>
            </div>
            <Toaster />
        </StoreProvider>
      </body>
    </html>
  );
}
