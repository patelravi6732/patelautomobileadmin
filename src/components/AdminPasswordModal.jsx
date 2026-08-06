import React, { useState } from 'react';
import { Lock, ShieldCheck, X, AlertCircle } from 'lucide-react';

function validateAdminSecurityPassword(inputPassword) {
  const cleanInput = (inputPassword || '').trim();
  if (!cleanInput) return false;

  try {
    const userRaw = localStorage.getItem('user') || sessionStorage.getItem('user');
    if (userRaw) {
      const uObj = JSON.parse(userRaw);
      if (uObj.password && uObj.password.trim() === cleanInput) return true;
    }
  } catch (e) {}

  try {
    const adminProfiles = JSON.parse(localStorage.getItem('admin_profiles') || '[]');
    const isMatch = adminProfiles.some(a => a && a.password && a.password.trim() === cleanInput);
    if (isMatch) return true;
  } catch (e) {}

  if (cleanInput === '@ravipatel2005') return true;

  return false;
}

export default function AdminPasswordModal({ isOpen, onClose, onConfirm, title = "Admin Password Required", itemDescription = "this action", actionLabel = 'Confirm & Proceed' }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    const cleanPass = password.trim();
    if (!cleanPass) {
      setError('Please enter your Admin Security Password');
      return;
    }

    setLoading(true);
    setError('');

    const isValid = validateAdminSecurityPassword(cleanPass);
    if (!isValid) {
      setError('❌ Incorrect Admin Security Password! Access/Deletion denied.');
      setLoading(false);
      return;
    }

    try {
      await onConfirm(cleanPass);
      setPassword('');
      onClose();
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Incorrect Admin Security Password!');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-slate-900 text-white rounded-3xl p-6 sm:p-8 max-w-md w-full space-y-6 shadow-2xl border border-slate-800 relative animate-in fade-in zoom-in duration-200">
        
        <button 
          onClick={onClose}
          className="absolute top-5 right-5 text-slate-400 hover:text-white p-1.5 rounded-full hover:bg-slate-800 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 border-b border-slate-800 pb-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-purple-600 text-white flex items-center justify-center shrink-0 shadow-lg">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white font-poppins">{title}</h3>
            <p className="text-xs text-slate-400">Patel Automobiles Security System</p>
          </div>
        </div>

        <div className="p-4 bg-slate-950/80 border border-slate-800 rounded-2xl text-xs text-slate-300 flex items-start gap-3">
          <Lock className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
          <p className="leading-relaxed">
            Enter Admin Security Password to confirm <strong className="text-white">{itemDescription}</strong>.
          </p>
        </div>

        {error && (
          <div className="p-3 bg-rose-500/10 text-rose-400 text-xs rounded-xl font-bold border border-rose-500/30 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
              Admin Security Password *
            </label>
            <input
              type="password"
              required
              autoFocus
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-sm font-mono focus:outline-none focus:border-blue-500 shadow-inner"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs rounded-xl shadow-lg transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <ShieldCheck className="w-4 h-4" />
              <span>{loading ? 'Authorizing...' : actionLabel}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
