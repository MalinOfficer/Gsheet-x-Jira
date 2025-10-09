
"use client";

import React, { createContext, useState, ReactNode } from 'react';

export type TableData = {
    headers: string[];
    rows: Record<string, any>[];
};

export type L3ReportData = {
    report?: string;
    error?: string;
} | null;

interface TableDataContextType {
    tableData: TableData | null;
    setTableData: (data: TableData | null) => void;
    l3ReportData: L3ReportData;
    setL3ReportData: (data: L3ReportData) => void;
    isProcessing: boolean;
    setIsProcessing: (processing: boolean) => void;
}

export const TableDataContext = createContext<TableDataContextType>({
    tableData: null,
    setTableData: () => {},
    l3ReportData: null,
    setL3ReportData: () => {},
    isProcessing: false,
    setIsProcessing: () => {},
});

export const TableDataContextProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [tableData, setTableData] = useState<TableData | null>(null);
    const [l3ReportData, setL3ReportData] = useState<L3ReportData>(null);
    const [isProcessing, setIsProcessing] = useState<boolean>(false);

    return (
        <TableDataContext.Provider value={{ 
            tableData, 
            setTableData,
            l3ReportData,
            setL3ReportData,
            isProcessing, 
            setIsProcessing, 
        }}>
            {children}
        </TableDataContext.Provider>
    );
};

    