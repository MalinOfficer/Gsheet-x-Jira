
"use client";

import React, { createContext, useState, ReactNode } from 'react';

export type TableData = {
    headers: string[];
    rows: Record<string, any>[];
};

interface TableDataContextType {
    tableData: TableData | null;
    setTableData: (data: TableData | null) => void;
    isProcessing: boolean;
    setIsProcessing: (processing: boolean) => void;
}

export const TableDataContext = createContext<TableDataContextType>({
    tableData: null,
    setTableData: () => {},
    isProcessing: false,
    setIsProcessing: () => {},
});

export const TableDataContextProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [tableData, setTableData] = useState<TableData | null>(null);
    const [isProcessing, setIsProcessing] = useState<boolean>(false);

    return (
        <TableDataContext.Provider value={{ 
            tableData, 
            setTableData, 
            isProcessing, 
            setIsProcessing, 
        }}>
            {children}
        </TableDataContext.Provider>
    );
};
