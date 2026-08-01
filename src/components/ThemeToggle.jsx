import React from 'react';
import { Sun, Moon } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

export default function ThemeToggle({ showLabel = false, className = '' }) {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <button
      onClick={toggleTheme}
      type="button"
      title={`Switch to ${isDark ? 'Light' : 'Dark'} Mode`}
      className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border transition-all duration-300 transform active:scale-95 shadow-xs ${
        isDark 
          ? 'bg-slate-900 text-amber-400 border-slate-700 hover:bg-slate-800 hover:border-amber-500/40 hover:shadow-amber-500/10' 
          : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200 hover:text-slate-900 hover:border-slate-300'
      } ${className}`}
    >
      <div className="relative w-5 h-5 flex items-center justify-center">
        {isDark ? (
          <Moon className="w-4 h-4 text-sky-300 fill-sky-300/20 transform rotate-0 transition-transform duration-300" />
        ) : (
          <Sun className="w-4 h-4 text-amber-500 fill-amber-500/20 transform rotate-0 transition-transform duration-300" />
        )}
      </div>

      {showLabel && (
        <span className="text-xs font-bold font-poppins uppercase tracking-wider">
          {isDark ? 'Dark' : 'Light'}
        </span>
      )}
    </button>
  );
}
