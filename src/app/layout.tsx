
import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { StoreProvider } from "@/store/store-provider";
import { ClientLayout } from "@/components/layout/client-layout";


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
            <ClientLayout>
                {children}
            </ClientLayout>
            <Toaster />
        </StoreProvider>
      </body>
    </html>
  );
}
