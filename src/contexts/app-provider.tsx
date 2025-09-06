
"use client";

import React, { createContext, useState, ReactNode, useContext, useEffect, useCallback } from 'react';

export type TableData = {
    headers: string[];
    rows: Record<string, any>[];
    fileName: string;
};

interface AppContextType {
    fileA: TableData | null;
    setFileA: (data: TableData | null) => void;
    fileB: TableData | null;
    setFileB: (data: TableData | null) => void;
    resetState: () => void;
}

export const AppContext = createContext<AppContextType>({
    fileA: null,
    setFileA: () => {},
    fileB: null,
    setFileB: () => {},
    resetState: () => {},
});

const LOCAL_STORAGE_KEY_FILE_A = 'dataWeaverFileA';
const LOCAL_STORAGE_KEY_FILE_B = 'dataWeaverFileB';

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [fileA, setFileA] = useState<TableData | null>(null);
    const [fileB, setFileB] = useState<TableData | null>(null);
    const [isInitialized, setIsInitialized] = useState(false);

    useEffect(() => {
        try {
            const storedFileA = localStorage.getItem(LOCAL_STORAGE_KEY_FILE_A);
            if (storedFileA) {
                setFileA(JSON.parse(storedFileA));
            }
            const storedFileB = localStorage.getItem(LOCAL_STORAGE_KEY_FILE_B);
            if (storedFileB) {
                setFileB(JSON.parse(storedFileB));
            }
        } catch (error) {
            console.error("Failed to parse data from localStorage", error);
            localStorage.removeItem(LOCAL_STORAGE_KEY_FILE_A);
            localStorage.removeItem(LOCAL_STORAGE_KEY_FILE_B);
        }
        setIsInitialized(true);
    }, []);

    const handleSetFileA = useCallback((data: TableData | null) => {
        setFileA(data);
        if (data) {
            localStorage.setItem(LOCAL_STORAGE_KEY_FILE_A, JSON.stringify(data));
        } else {
            localStorage.removeItem(LOCAL_STORAGE_KEY_FILE_A);
        }
    }, []);

    const handleSetFileB = useCallback((data: TableData | null) => {
        setFileB(data);
        if (data) {
            localStorage.setItem(LOCAL_STORAGE_KEY_FILE_B, JSON.stringify(data));
        } else {
            localStorage.removeItem(LOCAL_STORAGE_KEY_FILE_B);
        }
    }, []);

    const resetState = useCallback(() => {
        setFileA(null);
        setFileB(null);
        localStorage.removeItem(LOCAL_STORAGE_KEY_FILE_A);
        localStorage.removeItem(LOCAL_STORAGE_KEY_FILE_B);
    }, []);

    const contextValue = {
        fileA,
        setFileA: handleSetFileA,
        fileB,
        setFileB: handleSetFileB,
        resetState,
    };
    
    // Render children only after state has been initialized from localStorage
    if (!isInitialized) {
        return null; 
    }

    return (
        <AppContext.Provider value={contextValue}>
            {children}
        </AppContext.Provider>
    );
};

export const useApp = () => {
    const context = useContext(AppContext);
    if (!context) {
        throw new Error('useApp must be used within an AppProvider');
    }
    return context;
}
