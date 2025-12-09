
'use client';

import React, { createContext, useState, useEffect, useCallback } from 'react';

const LOCAL_STORAGE_KEY_THEME = 'app-theme';
type Theme = 'dark' | 'light' | 'system';

export type ThemeProviderState = {
  theme: Theme;
  setTheme: (theme: Theme) => void;
};

const initialState: ThemeProviderState = {
  theme: 'system',
  setTheme: () => null,
};

export const ThemeProviderContext = createContext<ThemeProviderState>(initialState);

export function ThemeProvider({
  children,
  defaultTheme = 'dark',
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
    const root = window.document.documentElement;
    
    root.classList.remove('light', 'dark');

    if (newTheme === 'system') {
        const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
        root.classList.add(systemTheme);
    } else {
        root.classList.add(newTheme);
    }
    
    localStorage.setItem(storageKey, newTheme);
    setTheme(newTheme);

  }, [storageKey]);

  // Apply theme on initial load and when theme state changes
  useEffect(() => {
    handleSetTheme(theme);
  }, [theme, handleSetTheme]);

  // Listen for system theme changes
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = () => {
      // If the current theme is 'system', re-apply it to reflect the change.
      if (theme === 'system') {
        handleSetTheme('system');
      }
    };
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [theme, handleSetTheme]);

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
