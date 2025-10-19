
"use client";

import { AppProvider } from "@/contexts/app-provider";
import { TableDataContextProvider } from "@/store/table-data-context";

export function StoreProvider({ children }: { children: React.ReactNode }) {
  return (
    <TableDataContextProvider>
      <AppProvider>
        {children}
      </AppProvider>
    </TableDataContextProvider>
  );
}
