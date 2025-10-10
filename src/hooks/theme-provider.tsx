
'use client';

import React, { createContext, useState, useEffect, useCallback } from 'react';

const LOCAL_STORAGE_KEY_THEME = 'app-theme';
type Theme = 'dark' | 'light' | 'system' | 'default';

export type ThemeProviderState = {
  theme: Theme;
  setTheme: (theme: Theme) => void;
};

const initialState: ThemeProviderState = {
  theme: 'default',
  setTheme: () => null,
};

export const ThemeProviderContext = createContext<ThemeProviderState>(initialState);

export function ThemeProvider({
  children,
  defaultTheme = 'default',
  storageKey = LOCAL_STORAGE_KEY_THEME,
  ...props
}: {
  children: React.ReactNode;
  defaultTheme?: Theme;
  storageKey?: string;
}) {
  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof window === 'undefined') {
      return defaultTheme;
    }
    return (localStorage.getItem(storageKey) as Theme | null) || defaultTheme;
  });

  const handleSetTheme = useCallback((newTheme: Theme) => {
    localStorage.setItem(storageKey, newTheme);

    const root = window.document.documentElement;
    root.classList.remove('default', 'dark');
    root.classList.add(newTheme);

    setTheme(newTheme);
  }, [storageKey]);

  // This effect ensures that if the theme is changed in another tab,
  // this tab will update its state.
  useEffect(() => {
    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === storageKey) {
        const newTheme = (event.newValue as Theme) || defaultTheme;
        handleSetTheme(newTheme);
      }
    };
    window.addEventListener('storage', handleStorageChange);
    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [storageKey, defaultTheme, handleSetTheme]);

  const value = {
    theme,
    setTheme: handleSetTheme,
  };

  return (
    <ThemeProviderContext.Provider {...props} value={value}>
      {children}
    </ThemeProviderContext.Provider>
  );
}
