"use client";

import React, { createContext, useState, ReactNode, useContext } from 'react';

export type TableData = {
    headers: string[];
    rows: Record<string, any>[];
};

// ─── Split context menjadi dua ────────────────────────────────────────────────
// Tujuan: ketika isProcessing berubah, hanya komponen yang pakai
// ProcessingContext yang re-render. Komponen yang hanya butuh tableData
// tidak ikut re-render.

interface TableDataContextType {
    tableData: TableData | null;
    setTableData: (data: TableData | null) => void;
}

interface ProcessingContextType {
    isProcessing: boolean;
    setIsProcessing: (processing: boolean) => void;
}

export const TableDataContext = createContext<TableDataContextType & ProcessingContextType>({
    tableData: null,
    setTableData: () => {},
    isProcessing: false,
    setIsProcessing: () => {},
});

const TableDataOnlyContext = createContext<TableDataContextType>({
    tableData: null,
    setTableData: () => {},
});

const ProcessingContext = createContext<ProcessingContextType>({
    isProcessing: false,
    setIsProcessing: () => {},
});

export const TableDataProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [tableData, setTableData] = useState<TableData | null>(null);
    const [isProcessing, setIsProcessing] = useState<boolean>(false);

    // Gabungkan ke satu value untuk backward-compatibility
    // (komponen lama yang pakai TableDataContext langsung tetap jalan)
    const combinedValue = React.useMemo(
        () => ({ tableData, setTableData, isProcessing, setIsProcessing }),
        [tableData, isProcessing]
    );

    return (
        <TableDataContext.Provider value={combinedValue}>
            {children}
        </TableDataContext.Provider>
    );
};