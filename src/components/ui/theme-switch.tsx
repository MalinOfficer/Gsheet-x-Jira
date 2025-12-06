
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
    return null; 
  }
  
  const isDarkMode = theme === 'dark';

  const toggleTheme = () => {
    setTheme(isDarkMode ? 'default' : 'dark');
  };

  return (
    <div className="theme-switch">
      <input
        type="checkbox"
        id="theme-switch-checkbox"
        className="theme-switch__checkbox"
        checked={isDarkMode}
        onChange={toggleTheme}
      />
      <label htmlFor="theme-switch-checkbox" className="theme-switch__container">
        <div className="theme-switch__circle-container">
          <div className="theme-switch__sun-moon-container">
            <div className="theme-switch__moon">
              <div className="theme-switch__spot"></div>
              <div className="theme-switch__spot"></div>
              <div className="theme-switch__spot"></div>
            </div>
          </div>
        </div>
        <div className="theme-switch__clouds"></div>
        <div className="theme-switch__stars-container">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 130 130">
                <path d="M64.9,4.3c-1.3,0-2.3,1-2.3,2.3v11.5c0,1.3,1,2.3,2.3,2.3s2.3-1,2.3-2.3V6.6C67.2,5.3,66.2,4.3,64.9,4.3z"/>
                <path d="M109.9,20.1c-0.9-0.9-2.3-0.9-3.2,0l-8.1,8.1c-0.9,0.9-0.9,2.3,0,3.2c0.4,0.4,1,0.6,1.6,0.6s1.2-0.2,1.6-0.6l8.1-8.1C110.8,22.4,110.8,21,109.9,20.1z"/>
                <path d="M123.4,65c0-1.3-1-2.3-2.3-2.3H109.6c-1.3,0-2.3,1-2.3,2.3s1,2.3,2.3,2.3h11.5C122.4,67.3,123.4,66.3,123.4,65z"/>
                <path d="M109.9,109.9c-0.9-0.9-2.3-0.9-3.2,0c-0.9,0.9-0.9,2.3,0,3.2l8.1,8.1c0.4,0.4,1,0.6,1.6,0.6s1.2-0.2,1.6-0.6c0.9-0.9,0.9-2.3,0-3.2L109.9,109.9z"/>
                <path d="M64.9,125.7c-1.3,0-2.3,1-2.3,2.3s1,2.3,2.3,2.3v0c1.3,0,2.3-1,2.3-2.3S66.2,125.7,64.9,125.7z"/>
                <path d="M20.1,109.9l-8.1,8.1c-0.9,0.9-0.9,2.3,0,3.2c0.4,0.4,1,0.6,1.6,0.6s1.2-0.2,1.6-0.6l8.1-8.1c0.9-0.9,0.9-2.3,0-3.2C22.4,109,21,109,20.1,109.9z"/>
                <path d="M6.6,62.7H20.1c1.3,0,2.3-1,2.3-2.3s-1-2.3-2.3-2.3H6.6c-1.3,0-2.3,1-2.3,2.3S5.3,62.7,6.6,62.7z"/>
                <path d="M20.1,20.1c-0.9-0.9-2.3-0.9-3.2,0c-0.9,0.9-0.9,2.3,0,3.2l8.1,8.1c0.4,0.4,1,0.6,1.6,0.6c0.6,0,1.2-0.2,1.6-0.6c0.9-0.9,0.9-2.3,0-3.2L20.1,20.1z"/>
            </svg>
        </div>
      </label>
    </div>
  );
}
