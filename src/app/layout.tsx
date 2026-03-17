import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { StoreProvider } from "@/store/store-provider";
import { ClientLayout } from "@/components/layout/client-layout";
import Script from "next/script";
import { ThemeProvider } from "@/hooks/theme-provider";
import { AuthProvider } from "@/contexts/AuthContext";

export const metadata: Metadata = {
  title: "GSheet Dashboard & Tools",
  description: "Ubah Google Sheets Anda menjadi dasbor interaktif secara instan dan gunakan alat praktis lainnya.",
};

// ✅ Anti-flicker script — baca theme dari localStorage sebelum React hydrate
// Mencegah flash of wrong theme saat pertama load
const antiFlickerScript = `
(function() {
  try {
    const theme = localStorage.getItem('app-theme');
    if (theme === 'dark' || (!theme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      document.documentElement.classList.add('dark');
    }
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
        <link rel="icon" href="/favicon.ico" sizes="any" />
        {/* ✅ Script dijalankan sebelum render untuk mencegah theme flicker */}
        <script dangerouslySetInnerHTML={{ __html: antiFlickerScript }} />
      </head>
      <body className="font-sans antialiased" suppressHydrationWarning>
        {/*
          Urutan provider penting:
          1. AuthProvider   — paling luar, karena semua komponen butuh user
          2. ThemeProvider  — di dalam auth, agar bisa baca theme dari user preferences
          3. StoreProvider  — state global app
          4. ClientLayout   — layout dengan sidebar & header
        */}
        <AuthProvider>
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
        </AuthProvider>

        {/* ✅ Load xlsx library secara lazy — tidak blokir initial render */}
        <Script
          src="https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js"
          strategy="lazyOnload"
        />
      </body>
    </html>
  );
}