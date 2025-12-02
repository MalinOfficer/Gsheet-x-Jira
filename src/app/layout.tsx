
import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { StoreProvider } from "@/store/store-provider";
import { ClientLayout } from "@/components/layout/client-layout";
import Script from "next/script";
import { ThemeProvider } from "@/hooks/theme-provider";

export const metadata: Metadata = {
  title: "GSheet Dashboard & Tools",
  description: "Ubah Google Sheets Anda menjadi dasbor interaktif secara instan dan gunakan alat praktis lainnya.",
};

const ANTI_FLICKER_SCRIPT = `
(function() {
  try {
    const theme = localStorage.getItem('app-theme') || 'dark';
    const root = document.documentElement;
    root.classList.add(theme);
  } catch (e) {}
})();
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: ANTI_FLICKER_SCRIPT }} />
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
      </head>
      <body className="font-body antialiased overflow-hidden" suppressHydrationWarning>
        <ThemeProvider
            defaultTheme="dark"
            storageKey="app-theme"
        >
            <StoreProvider>
                <ClientLayout>
                    {children}
                </ClientLayout>
                <Toaster />
            </StoreProvider>
        </ThemeProvider>
        <Script src="https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js" strategy="lazyOnload" />
      </body>
    </html>
  );
}
