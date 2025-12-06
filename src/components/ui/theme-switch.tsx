
'use client';

import { useTheme } from '@/hooks/use-theme';
import { useEffect, useState } from 'react';

export function ThemeSwitch() {
  const { theme, setTheme } = useTheme();
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  if (!isClient) {
    return <div style={{width: '68px', height: '37.4px'}} />; // Placeholder for SSR
  }
  
  const isDarkMode = theme === 'dark';

  const toggleTheme = () => {
    setTheme(isDarkMode ? 'default' : 'dark');
  };

  return (
    <label className="switch">
        <input 
            type="checkbox" 
            id="theme-switch-checkbox"
            checked={!isDarkMode}
            onChange={toggleTheme}
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
