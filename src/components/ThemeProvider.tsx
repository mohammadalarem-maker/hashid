import React, { createContext, useContext, useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import defaultAppIcon from '../assets/images/app_icon_1781726496895.jpg';

interface ThemeContextType {
  isDarkMode: boolean;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}

export default function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    // 1. Check local storage
    let saved: string | null = null;
    try {
      saved = localStorage.getItem('theme-mode');
    } catch {}
    if (saved === 'dark') return true;
    if (saved === 'light') return false;
    return false; // Default to light
  });

  const [logoUrl, setLogoUrl] = useState<string>(defaultAppIcon);

  useEffect(() => {
    // Listen to firestore settings
    const unsub = onSnapshot(doc(db, 'settings', 'global'), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        if (data.logoUrl) {
          setLogoUrl(data.logoUrl);
        }
        
        // If the user hasn't explicitly toggled local theme, sync with Firestore isDarkMode
        let saved: string | null = null;
        try {
          saved = localStorage.getItem('theme-mode');
        } catch {}
        if (!saved && data.isDarkMode !== undefined) {
          setIsDarkMode(data.isDarkMode);
        }
      }
    }, (err) => {
      console.warn("Theme dynamic settings snapshot listener received an expected notice (usually pre-authentication):", err.message);
    });
    return () => unsub();
  }, []);

  // Set CSS variables and dark mode class on update
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      // Luxurious dark brown (البني الداكن الفخم)
      document.documentElement.style.setProperty('--primary', '#E2A85C'); // Sparkling rich gold
      document.documentElement.style.setProperty('--secondary', '#B3803E'); // Dark brass
      document.documentElement.style.setProperty('--background', '#180F0A'); // Cocoa background
      document.documentElement.style.setProperty('--surface', '#231610'); // Dark warm cocoa surface
      document.documentElement.style.setProperty('--text', '#F2E8E1'); // Warm cream text
      try {
        localStorage.setItem('theme-mode', 'dark');
      } catch {}
    } else {
      document.documentElement.classList.remove('dark');
      // Standard light branding
      document.documentElement.style.setProperty('--primary', '#541919'); // Maroon main
      document.documentElement.style.setProperty('--secondary', '#B3803E'); // Golden secondary
      document.documentElement.style.setProperty('--background', '#FBF9F6'); // Light warm beige
      document.documentElement.style.setProperty('--surface', '#FFFFFF');
      document.documentElement.style.setProperty('--text', '#2B1B12'); // Rich charcoal text
      try {
        localStorage.setItem('theme-mode', 'light');
      } catch {}
    }
  }, [isDarkMode]);

  const toggleTheme = () => {
    setIsDarkMode(prev => !prev);
  };

  return (
    <ThemeContext.Provider value={{ isDarkMode, toggleTheme }}>
      {/* Universal Watermark Overlay (5% opacity, doesn't catch pointer events) */}
      <div 
        id="app-watermark-overlay"
        className="fixed inset-0 pointer-events-none z-0 flex items-center justify-center opacity-[0.04] dark:opacity-[0.02] transition-opacity duration-300 print:opacity-[0.03]"
        style={{
          backgroundImage: `url(${logoUrl})`,
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
          backgroundSize: '400px',
        }}
      />
      <div className="relative z-10 w-full min-h-screen">
        {children}
      </div>
    </ThemeContext.Provider>
  );
}
