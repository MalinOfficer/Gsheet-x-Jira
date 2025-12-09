
'use client';

import { useContext } from 'react';
import {
  ThemeProviderContext,
  type ThemeProviderState,
} from './theme-provider';

export const useTheme = (): ThemeProviderState => {
  const context = useContext(ThemeProviderContext);

  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }

  return context;
};
