'use client';

import { useState, useEffect } from 'react';
import { LoginForm } from '@/components/LoginForm';
import { FileBrowser } from '@/components/FileBrowser';
import { ThemeProvider } from '@/contexts/ThemeContext';

export default function Home() {
  const [config, setConfig] = useState<any>(null);

  useEffect(() => {
    const stored = localStorage.getItem('cmcc_config');
    if (stored) {
       setConfig(JSON.parse(stored));
    }
  }, []);

  const handleLogin = (cfg: any) => {
    setConfig(cfg);
  };

  const handleLogout = () => {
    localStorage.removeItem('cmcc_config');
    setConfig(null);
  };

  return (
    <ThemeProvider>
      <main>
        {!config ? (
          <LoginForm onLogin={handleLogin} />
        ) : (
          <FileBrowser config={config} onLogout={handleLogout} />
        )}
      </main>
    </ThemeProvider>
  );
}
