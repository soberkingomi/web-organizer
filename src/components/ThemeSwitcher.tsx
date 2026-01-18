'use client';

import { useTheme } from '@/contexts/ThemeContext';
import { Sun, Moon, Monitor } from 'lucide-react';

export function ThemeSwitcher() {
  const { theme, setTheme } = useTheme();

  const nextTheme = () => {
    if (theme === 'dark') setTheme('light');
    else if (theme === 'light') setTheme('system');
    else setTheme('dark');
  };

  const icon = theme === 'dark' ? Moon : theme === 'light' ? Sun : Monitor;
  const Icon = icon;

  return (
    <button
      onClick={nextTheme}
      className="btn btn-ghost btn-icon"
      title={theme === 'dark' ? '暗色' : theme === 'light' ? '亮色' : '跟随系统'}
    >
      <Icon size={18} />
    </button>
  );
}
