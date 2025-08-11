
"use client";

import { TableDataContextProvider } from "./table-data-context";

export function StoreProvider({ children }: { children: React.ReactNode }) {
  return (
    <TableDataContextProvider>
      {children}
    </TableDataContextProvider>
  );
}
