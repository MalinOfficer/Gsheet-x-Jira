
"use client";

import React, { createContext, useState, ReactNode } from 'react';

export type TableData = {
    headers: string[];
    rows: Record<string, any>[];
};

interface TableDataContextType {
    tableData: TableData | null;
    setTableData: (data: TableData | null) => void;
}

export const TableDataContext = createContext<TableDataContextType>({
    tableData: null,
    setTableData: () => {},
});

export const TableDataContextProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [tableData, setTableData] = useState<TableData | null>(null);

    return (
        <TableDataContext.Provider value={{ tableData, setTableData }}>
            {children}
        </TableDataContext.Provider>
    );
};
