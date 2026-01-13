
"use client";

import { AppProvider } from "@/contexts/app-provider";
import { SettingsProvider } from "@/contexts/settings-provider";

export function StoreProvider({ children }: { children: React.ReactNode }) {
  return (
    <SettingsProvider>
      <AppProvider>
        {children}
      </AppProvider>
    </SettingsProvider>
  );
}
