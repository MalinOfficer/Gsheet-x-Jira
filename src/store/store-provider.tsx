
"use client";

import { AppProvider } from "@/contexts/app-provider";
import { SettingsProvider } from "@/contexts/settings-provider";
import { TableDataProvider } from "./table-data-context";

export function StoreProvider({ children }: { children: React.ReactNode }) {
  return (
    <SettingsProvider>
      <TableDataProvider>
        <AppProvider>
          {children}
        </AppProvider>
      </TableDataProvider>
    </SettingsProvider>
  );
}
