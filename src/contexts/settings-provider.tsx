
"use client";

import React, { createContext, useState, ReactNode, useCallback, useEffect } from 'react';

interface SettingsContextType {
    // Feature toggles
    isCodeViewerEnabled: boolean;
    toggleCodeViewer: () => void;
    areSecondaryToolsEnabled: boolean;
    toggleSecondaryTools: () => void;
    
    // URL and Title management
    sheetUrl: string;
    setSheetUrl: (url: string) => void;
    dbSheetUrl: string;
    setDbSheetUrl: (url: string) => void;
    
    verifiedUrl: string;
    setVerifiedUrl: (url: string) => void;
    spreadsheetTitle: string | null;
    setSpreadsheetTitle: (title: string | null) => void;
    
    verifiedDbUrl: string;
    setVerifiedDbUrl: (url: string) => void;
    dbSpreadsheetTitle: string | null;
    setDbSpreadsheetTitle: (title: string | null) => void;
}

export const SettingsContext = createContext<SettingsContextType>({
    isCodeViewerEnabled: false,
    toggleCodeViewer: () => {},
    areSecondaryToolsEnabled: false,
    toggleSecondaryTools: () => {},
    sheetUrl: '',
    setSheetUrl: () => {},
    dbSheetUrl: '',
    setDbSheetUrl: () => {},
    verifiedUrl: '',
    setVerifiedUrl: () => {},
    spreadsheetTitle: null,
    setSpreadsheetTitle: () => {},
    verifiedDbUrl: '',
    setVerifiedDbUrl: () => {},
    dbSpreadsheetTitle: null,
    setDbSpreadsheetTitle: () => {},
});

const LOCAL_STORAGE_KEY_CODE_VIEWER = 'isCodeViewerEnabled';
const LOCAL_STORAGE_KEY_SECONDARY_TOOLS = 'areSecondaryToolsEnabled';
const LOCAL_STORAGE_KEY_SHEET_URL = 'gsheetDashboardSheetUrl';
const LOCAL_STORAGE_KEY_DB_SHEET_URL = 'gsheetDashboardDbSheetUrl';
const LOCAL_STORAGE_KEY_MAIN_TITLE = 'gsheetMainSheetTitle';
const LOCAL_STORAGE_KEY_DB_TITLE = 'gsheetDbSheetTitle';
const DEFAULT_SHEET_URL = 'https://docs.google.com/spreadsheets/d/1S9oSokUh8SyWlNObCLdwpn2r2iXA8Gy73OnxsZa728E/edit?gid=0#gid=0';

export const SettingsProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [isCodeViewerEnabled, setIsCodeViewerEnabled] = useState<boolean>(false);
    const [areSecondaryToolsEnabled, setAreSecondaryToolsEnabled] = useState<boolean>(false);
    
    // State for URLs and their verified titles
    const [sheetUrl, setSheetUrlState] = useState('');
    const [verifiedUrl, setVerifiedUrlState] = useState('');
    const [spreadsheetTitle, setSpreadsheetTitleState] = useState<string | null>(null);

    const [dbSheetUrl, setDbSheetUrlState] = useState('');
    const [verifiedDbUrl, setVerifiedDbUrlState] = useState('');
    const [dbSpreadsheetTitle, setDbSpreadsheetTitleState] = useState<string | null>(null);


    useEffect(() => {
        try {
            const savedCodeViewer = localStorage.getItem(LOCAL_STORAGE_KEY_CODE_VIEWER);
            if (savedCodeViewer) setIsCodeViewerEnabled(JSON.parse(savedCodeViewer));

            const savedSecondaryTools = localStorage.getItem(LOCAL_STORAGE_KEY_SECONDARY_TOOLS);
            if (savedSecondaryTools) setAreSecondaryToolsEnabled(JSON.parse(savedSecondaryTools));
            
            const savedSheetUrl = localStorage.getItem(LOCAL_STORAGE_KEY_SHEET_URL);
            const savedDbSheetUrl = localStorage.getItem(LOCAL_STORAGE_KEY_DB_SHEET_URL);

            const initialSheetUrl = savedSheetUrl === null ? DEFAULT_SHEET_URL : savedSheetUrl;
            const initialDbSheetUrl = savedDbSheetUrl === null ? DEFAULT_SHEET_URL : savedDbSheetUrl;

            setSheetUrlState(initialSheetUrl);
            setVerifiedUrl(initialSheetUrl);
            
            setDbSheetUrlState(initialDbSheetUrl);
            setVerifiedDbUrl(initialDbSheetUrl);
            

            const savedMainTitle = localStorage.getItem(LOCAL_STORAGE_KEY_MAIN_TITLE);
            if(savedMainTitle) setSpreadsheetTitleState(savedMainTitle);

            const savedDbTitle = localStorage.getItem(LOCAL_STORAGE_KEY_DB_TITLE);
            if(savedDbTitle) setDbSpreadsheetTitleState(savedDbTitle);

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
    

    const setVerifiedUrl = useCallback((url: string) => {
        setVerifiedUrlState(url);
    }, []);

    const setVerifiedDbUrl = useCallback((url: string) => {
        setVerifiedDbUrlState(url);
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

    const toggleCodeViewer = createToggle(setIsCodeViewerEnabled, LOCAL_STORAGE_KEY_CODE_VIEWER);
    const toggleSecondaryTools = createToggle(setAreSecondaryToolsEnabled, LOCAL_STORAGE_KEY_SECONDARY_TOOLS);

    return (
        <SettingsContext.Provider value={{ 
            isCodeViewerEnabled,
            toggleCodeViewer,
            areSecondaryToolsEnabled,
            toggleSecondaryTools,
            sheetUrl,
            setSheetUrl,
            dbSheetUrl,
            setDbSheetUrl,
            verifiedUrl,
            setVerifiedUrl,
            spreadsheetTitle,
            setSpreadsheetTitle,
            verifiedDbUrl,
            setVerifiedDbUrl,
            dbSpreadsheetTitle,
            setDbSpreadsheetTitle,
        }}>
            {children}
        </SettingsContext.Provider>
    );
};
