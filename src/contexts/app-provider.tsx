
"use client";

import React, { createContext, useState, ReactNode, useContext, useCallback, useEffect } from 'react';

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

const LOCAL_STORAGE_KEY_FILE_A = 'dataWeaverFileA';
const LOCAL_STORAGE_KEY_FILE_B = 'dataWeaverFileB';

export const AppContext = createContext<AppContextType>({
    fileA: null,
    setFileA: () => {},
    fileB: null,
    setFileB: () => {},
    resetState: () => {},
});

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [fileA, setFileA] = useState<TableData | null>(null);
    const [fileB, setFileB] = useState<TableData | null>(null);

    // Load data from localStorage on initial mount
    useEffect(() => {
        try {
            const savedFileA = localStorage.getItem(LOCAL_STORAGE_KEY_FILE_A);
            if (savedFileA) {
                setFileA(JSON.parse(savedFileA));
            }
            const savedFileB = localStorage.getItem(LOCAL_STORAGE_KEY_FILE_B);
            if (savedFileB) {
                setFileB(JSON.parse(savedFileB));
            }
        } catch (error) {
            console.error("Failed to load data from localStorage", error);
            localStorage.removeItem(LOCAL_STORAGE_KEY_FILE_A);
            localStorage.removeItem(LOCAL_STORAGE_KEY_FILE_B);
        }
    }, []);

    const handleSetFileA = useCallback((data: TableData | null) => {
        setFileA(data);
        try {
            // Proactively remove the old key before setting the new one to prevent stale data issues.
            localStorage.removeItem(LOCAL_STORAGE_KEY_FILE_A);
            if (data) {
                localStorage.setItem(LOCAL_STORAGE_KEY_FILE_A, JSON.stringify(data));
            }
        } catch (error) {
            console.error("Failed to save File A to localStorage", error);
        }
    }, []);

    const handleSetFileB = useCallback((data: TableData | null) => {
        setFileB(data);
        try {
            // Proactively remove the old key before setting the new one.
            localStorage.removeItem(LOCAL_STORAGE_KEY_FILE_B);
            if (data) {
                localStorage.setItem(LOCAL_STORAGE_KEY_FILE_B, JSON.stringify(data));
            }
        } catch (error) {
            console.error("Failed to save File B to localStorage", error);
        }
    }, []);

    const resetState = useCallback(() => {
        setFileA(null);
        setFileB(null);
        try {
            localStorage.removeItem(LOCAL_STORAGE_KEY_FILE_A);
            localStorage.removeItem(LOCAL_STORAGE_KEY_FILE_B);
        } catch (error) {
            console.error("Failed to clear localStorage", error);
        }
    }, []);

    const contextValue = {
        fileA,
        setFileA: handleSetFileA,
        fileB,
        setFileB: handleSetFileB,
        resetState,
    };

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
