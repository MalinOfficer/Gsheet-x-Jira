
"use client";

import React, { createContext, useState, ReactNode, useCallback, useEffect } from 'react';

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
    isCodeViewerEnabled: boolean;
    toggleCodeViewer: () => void;
    areSecondaryToolsEnabled: boolean;
    toggleSecondaryTools: () => void;
    sheetUrl: string;
    setSheetUrl: (url: string) => void;
    verifiedUrl: string;
    setVerifiedUrl: (url: string) => void;
    spreadsheetTitle: string | null;
    setSpreadsheetTitle: (title: string | null) => void;
}

export const TableDataContext = createContext<TableDataContextType>({
    tableData: null,
    setTableData: () => {},
    l3ReportData: null,
    setL3ReportData: () => {},
    isProcessing: false,
    setIsProcessing: () => {},
    isCodeViewerEnabled: false,
    toggleCodeViewer: () => {},
    areSecondaryToolsEnabled: false,
    toggleSecondaryTools: () => {},
    sheetUrl: '',
    setSheetUrl: () => {},
    verifiedUrl: '',
    setVerifiedUrl: () => {},
    spreadsheetTitle: null,
    setSpreadsheetTitle: () => {},
});

const LOCAL_STORAGE_KEY_CODE_VIEWER = 'isCodeViewerEnabled';
const LOCAL_STORAGE_KEY_SECONDARY_TOOLS = 'areSecondaryToolsEnabled';

export const TableDataContextProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [tableData, setTableData] = useState<TableData | null>(null);
    const [l3ReportData, setL3ReportData] = useState<L3ReportData>(null);
    const [isProcessing, setIsProcessing] = useState<boolean>(false);
    const [isCodeViewerEnabled, setIsCodeViewerEnabled] = useState<boolean>(false);
    const [areSecondaryToolsEnabled, setAreSecondaryToolsEnabled] = useState<boolean>(false);
    
    // Verification-related state
    const [sheetUrl, setSheetUrl] = useState('');
    const [verifiedUrl, setVerifiedUrl] = useState('');
    const [spreadsheetTitle, setSpreadsheetTitle] = useState<string | null>(null);

    useEffect(() => {
        try {
            const savedCodeViewer = localStorage.getItem(LOCAL_STORAGE_KEY_CODE_VIEWER);
            if (savedCodeViewer) {
                setIsCodeViewerEnabled(JSON.parse(savedCodeViewer));
            }
            const savedSecondaryTools = localStorage.getItem(LOCAL_STORAGE_KEY_SECONDARY_TOOLS);
            if (savedSecondaryTools) {
                setAreSecondaryToolsEnabled(JSON.parse(savedSecondaryTools));
            }
        } catch (error) {
            console.error("Failed to parse settings from localStorage", error);
        }
    }, []);

    const createToggle = (
        setter: React.Dispatch<React.SetStateAction<boolean>>,
        key: string
    ) => {
        return useCallback(() => {
            setter(prev => {
                const newValue = !prev;
                try {
                    localStorage.setItem(key, JSON.stringify(newValue));
                } catch (error) {
                     console.error(`Failed to save ${key} to localStorage`, error);
                }
                return newValue;
            });
        }, [setter, key]);
    };

    const toggleCodeViewer = createToggle(setIsCodeViewerEnabled, LOCAL_STORAGE_KEY_CODE_VIEWER);
    const toggleSecondaryTools = createToggle(setAreSecondaryToolsEnabled, LOCAL_STORAGE_KEY_SECONDARY_TOOLS);

    return (
        <TableDataContext.Provider value={{ 
            tableData, 
            setTableData,
            l3ReportData,
            setL3ReportData,
            isProcessing, 
            setIsProcessing,
            isCodeViewerEnabled,
            toggleCodeViewer,
            areSecondaryToolsEnabled,
            toggleSecondaryTools,
            sheetUrl,
            setSheetUrl,
            verifiedUrl,
            setVerifiedUrl,
            spreadsheetTitle,
            setSpreadsheetTitle,
        }}>
            {children}
        </TableDataContext.Provider>
    );
};
    
