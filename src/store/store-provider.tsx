
"use client";

import { AppProvider } from "@/contexts/app-provider";
import { TableDataContextProvider } from "@/store/table-data-context";

export function StoreProvider({ children }: { children: React.ReactNode }) {
  return (
    <AppProvider>
      <TableDataContextProvider>
        {children}
      </TableDataContextProvider>
    </AppProvider>
  );
}
