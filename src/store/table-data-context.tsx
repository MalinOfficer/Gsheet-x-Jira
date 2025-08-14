
"use client";

import React, { createContext, useState, ReactNode, useEffect, useRef } from 'react';

export type TableData = {
    headers: string[];
    rows: Record<string, any>[];
};

interface TableDataContextType {
    tableData: TableData | null;
    setTableData: (data: TableData | null) => void;
    isProcessing: boolean;
    setIsProcessing: (processing: boolean) => void;
    showProcessingOverlay: boolean;
}

export const TableDataContext = createContext<TableDataContextType>({
    tableData: null,
    setTableData: () => {},
    isProcessing: false,
    setIsProcessing: () => {},
    showProcessingOverlay: false,
});

const OVERLAY_DELAY = 300; // ms

export const TableDataContextProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [tableData, setTableData] = useState<TableData | null>(null);
    const [isProcessing, setIsProcessing] = useState<boolean>(false);
    const [showProcessingOverlay, setShowProcessingOverlay] = useState<boolean>(false);
    const timerRef = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        if (isProcessing) {
            // Set a timer to show the overlay after a short delay
            timerRef.current = setTimeout(() => {
                setShowProcessingOverlay(true);
            }, OVERLAY_DELAY);
        } else {
            // If processing finishes before the timer, clear the timer
            if (timerRef.current) {
                clearTimeout(timerRef.current);
                timerRef.current = null;
            }
            // Hide the overlay immediately
            setShowProcessingOverlay(false);
        }

        // Cleanup function to clear timer if the component unmounts
        return () => {
            if (timerRef.current) {
                clearTimeout(timerRef.current);
            }
        };
    }, [isProcessing]);

    return (
        <TableDataContext.Provider value={{ 
            tableData, 
            setTableData, 
            isProcessing, 
            setIsProcessing, 
            showProcessingOverlay 
        }}>
            {children}
        </TableDataContext.Provider>
    );
};
