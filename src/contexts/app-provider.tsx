
"use client";

import React, { createContext, useState, ReactNode, useContext, useCallback } from 'react';

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

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [fileA, setFileA] = useState<TableData | null>(null);
    const [fileB, setFileB] = useState<TableData | null>(null);

    const handleSetFileA = useCallback((data: TableData | null) => {
        setFileA(data);
    }, []);

    const handleSetFileB = useCallback((data: TableData | null) => {
        setFileB(data);
    }, []);

    const resetState = useCallback(() => {
        setFileA(null);
        setFileB(null);
        // Clean up localStorage just in case old data exists from previous versions
        if (typeof window !== 'undefined') {
            localStorage.removeItem('dataWeaverFileA');
            localStorage.removeItem('dataWeaverFileB');
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
