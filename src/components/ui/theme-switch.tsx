
'use client';

import { useTheme } from '@/hooks/use-theme';
import { useEffect, useState } from 'react';
import './theme-switch.css';

export function ThemeSwitch() {
  const { theme, setTheme } = useTheme();
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  if (!isClient) {
    return <div style={{width: '4em', height: '2.2em'}} />; // Placeholder for SSR
  }
  
  const isDarkMode = theme === 'dark';

  const toggleTheme = () => {
    setTheme(isDarkMode ? 'light' : 'dark');
  };

  return (
    <label className="switch">
        <input 
            type="checkbox" 
            id="theme-switch-checkbox"
            checked={!isDarkMode}
            onChange={toggleTheme}
            aria-label="Toggle theme"
        />
        <span className="slider">
            <div className="star star_1"></div>
            <div className="star star_2"></div>
            <div className="star star_3"></div>
            <img className="cloud" src="https://i.ibb.co/rpJ1ZTP/cloud.png" alt="cloud" />
        </span>
    </label>
  );
}
