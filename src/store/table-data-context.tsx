
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
    dbSheetUrl: string;
    setDbSheetUrl: (url: string) => void;
    knowledgeBaseUrl: string;
    setKnowledgeBaseUrl: (url: string) => void;
    verifiedUrl: string;
    setVerifiedUrl: (url: string) => void;
    spreadsheetTitle: string | null;
    setSpreadsheetTitle: (title: string | null) => void;
    verifiedDbUrl: string;
    setVerifiedDbUrl: (url: string) => void;
    dbSpreadsheetTitle: string | null;
    setDbSpreadsheetTitle: (title: string | null) => void;
    verifiedKbUrl: string;
    setVerifiedKbUrl: (url: string) => void;
    kbSpreadsheetTitle: string | null;
    setKbSpreadsheetTitle: (title: string | null) => void;
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
    dbSheetUrl: '',
    setDbSheetUrl: () => {},
    knowledgeBaseUrl: '',
    setKnowledgeBaseUrl: () => {},
    verifiedUrl: '',
    setVerifiedUrl: () => {},
    spreadsheetTitle: null,
    setSpreadsheetTitle: () => {},
    verifiedDbUrl: '',
    setVerifiedDbUrl: () => {},
    dbSpreadsheetTitle: null,
    setDbSpreadsheetTitle: () => {},
    verifiedKbUrl: '',
    setVerifiedKbUrl: () => {},
    kbSpreadsheetTitle: null,
    setKbSpreadsheetTitle: () => {},
});

const LOCAL_STORAGE_KEY_CODE_VIEWER = 'isCodeViewerEnabled';
const LOCAL_STORAGE_KEY_SECONDARY_TOOLS = 'areSecondaryToolsEnabled';
const LOCAL_STORAGE_KEY_SHEET_URL = 'gsheetDashboardSheetUrl';
const LOCAL_STORAGE_KEY_DB_SHEET_URL = 'gsheetDashboardDbSheetUrl';
const LOCAL_STORAGE_KEY_KB_SHEET_URL = 'gsheetKnowledgeBaseSheetUrl';
const LOCAL_STORAGE_KEY_MAIN_TITLE = 'gsheetMainSheetTitle';
const LOCAL_STORAGE_KEY_DB_TITLE = 'gsheetDbSheetTitle';
const LOCAL_STORAGE_KEY_KB_TITLE = 'gsheetKbSheetTitle';
const DEFAULT_SHEET_URL = 'https://docs.google.com/spreadsheets/d/1S9oSokUh8SyWlNObCLdwpn2r2iXA8Gy73OnxsZa728E/edit?gid=0#gid=0';


export const TableDataContextProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [tableData, setTableData] = useState<TableData | null>(null);
    const [l3ReportData, setL3ReportData] = useState<L3ReportData>(null);
    const [isProcessing, setIsProcessing] = useState<boolean>(false);
    const [isCodeViewerEnabled, setIsCodeViewerEnabled] = useState<boolean>(false);
    const [areSecondaryToolsEnabled, setAreSecondaryToolsEnabled] = useState<boolean>(false);
    
    // Main URL state
    const [sheetUrl, setSheetUrlState] = useState('');
    const [verifiedUrl, setVerifiedUrlState] = useState('');
    const [spreadsheetTitle, setSpreadsheetTitleState] = useState<string | null>(null);

    // DB URL state
    const [dbSheetUrl, setDbSheetUrlState] = useState('');
    const [verifiedDbUrl, setVerifiedDbUrlState] = useState('');
    const [dbSpreadsheetTitle, setDbSpreadsheetTitleState] = useState<string | null>(null);

    // Knowledge Base URL state
    const [knowledgeBaseUrl, setKnowledgeBaseUrlState] = useState('');
    const [verifiedKbUrl, setVerifiedKbUrlState] = useState('');
    const [kbSpreadsheetTitle, setKbSpreadsheetTitleState] = useState<string | null>(null);

    useEffect(() => {
        try {
            const savedCodeViewer = localStorage.getItem(LOCAL_STORAGE_KEY_CODE_VIEWER);
            if (savedCodeViewer) setIsCodeViewerEnabled(JSON.parse(savedCodeViewer));

            const savedSecondaryTools = localStorage.getItem(LOCAL_STORAGE_KEY_SECONDARY_TOOLS);
            if (savedSecondaryTools) setAreSecondaryToolsEnabled(JSON.parse(savedSecondaryTools));
            
            const savedSheetUrl = localStorage.getItem(LOCAL_STORAGE_KEY_SHEET_URL);
            const savedDbSheetUrl = localStorage.getItem(LOCAL_STORAGE_KEY_DB_SHEET_URL);
            const savedKbSheetUrl = localStorage.getItem(LOCAL_STORAGE_KEY_KB_SHEET_URL);

            // Use default only if localStorage item is null (doesn't exist)
            const initialSheetUrl = savedSheetUrl === null ? DEFAULT_SHEET_URL : savedSheetUrl;
            const initialDbSheetUrl = savedDbSheetUrl === null ? DEFAULT_SHEET_URL : savedDbSheetUrl;
            const initialKbSheetUrl = savedKbSheetUrl === null ? DEFAULT_SHEET_URL : savedKbSheetUrl;

            setSheetUrlState(initialSheetUrl);
            setVerifiedUrl(initialSheetUrl);
            
            setDbSheetUrlState(initialDbSheetUrl);
            setVerifiedDbUrl(initialDbSheetUrl);
            
            setKnowledgeBaseUrlState(initialKbSheetUrl);
            setVerifiedKbUrl(initialKbSheetUrl);

            const savedMainTitle = localStorage.getItem(LOCAL_STORAGE_KEY_MAIN_TITLE);
            if(savedMainTitle) setSpreadsheetTitleState(savedMainTitle);

            const savedDbTitle = localStorage.getItem(LOCAL_STORAGE_KEY_DB_TITLE);
            if(savedDbTitle) setDbSpreadsheetTitleState(savedDbTitle);

            const savedKbTitle = localStorage.getItem(LOCAL_STORAGE_KEY_KB_TITLE);
            if(savedKbTitle) setKbSpreadsheetTitleState(savedKbTitle);

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
    
    const setSheetUrl = useCallback((url: string) => {
        localStorage.setItem(LOCAL_STORAGE_KEY_SHEET_URL, url);
        setSheetUrlState(url);
    }, []);
    
    const setDbSheetUrl = useCallback((url: string) => {
        localStorage.setItem(LOCAL_STORAGE_KEY_DB_SHEET_URL, url);
        setDbSheetUrlState(url);
    }, []);
    
    const setKnowledgeBaseUrl = useCallback((url: string) => {
        localStorage.setItem(LOCAL_STORAGE_KEY_KB_SHEET_URL, url);
        setKnowledgeBaseUrlState(url);
    }, []);

    const setVerifiedUrl = useCallback((url: string) => {
        setVerifiedUrlState(url);
    }, []);

    const setVerifiedDbUrl = useCallback((url: string) => {
        setVerifiedDbUrlState(url);
    }, []);

    const setVerifiedKbUrl = useCallback((url: string) => {
        setVerifiedKbUrlState(url);
    }, []);
    
    const setSpreadsheetTitle = useCallback((title: string | null) => {
        if(title) {
            localStorage.setItem(LOCAL_STORAGE_KEY_MAIN_TITLE, title);
        } else {
            localStorage.removeItem(LOCAL_STORAGE_KEY_MAIN_TITLE);
        }
        setSpreadsheetTitleState(title);
    }, []);
    
    const setDbSpreadsheetTitle = useCallback((title: string | null) => {
        if(title) {
            localStorage.setItem(LOCAL_STORAGE_KEY_DB_TITLE, title);
        } else {
            localStorage.removeItem(LOCAL_STORAGE_KEY_DB_TITLE);
        }
        setDbSpreadsheetTitleState(title);
    }, []);

    const setKbSpreadsheetTitle = useCallback((title: string | null) => {
        if(title) {
            localStorage.setItem(LOCAL_STORAGE_KEY_KB_TITLE, title);
        } else {
            localStorage.removeItem(LOCAL_STORAGE_KEY_KB_TITLE);
        }
        setKbSpreadsheetTitleState(title);
    }, []);


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
            dbSheetUrl,
            setDbSheetUrl,
            knowledgeBaseUrl,
            setKnowledgeBaseUrl,
            verifiedUrl,
            setVerifiedUrl,
            spreadsheetTitle,
            setSpreadsheetTitle,
            verifiedDbUrl,
            setVerifiedDbUrl,
            dbSpreadsheetTitle,
            setDbSpreadsheetTitle,
            verifiedKbUrl,
            setVerifiedKbUrl,
            kbSpreadsheetTitle,
            setKbSpreadsheetTitle,
        }}>
            {children}
        </TableDataContext.Provider>
    );
};
