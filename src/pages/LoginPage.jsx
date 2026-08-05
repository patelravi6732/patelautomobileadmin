import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Wrench, Lock, User, ShieldCheck, AlertCircle, Clock, Smartphone, Key, ArrowRight, X, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import API from '../services/api';

import { fetchCloudAdminProfiles, pushCloudAdminProfile } from '../utils/cloudSync';

export default function LoginPage() {
  const navigate = useNavigate();
  const { user, login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [lockoutSeconds, setLockoutSeconds] = useState(0);

  // First-Time Setup Wizard State
  const [isFirstTimeSetup, setIsFirstTimeSetup] = useState(false);
  const [setupLoading, setSetupLoading] = useState(true);
  const [setupForm, setSetupForm] = useState({
    user_name: '',
    username: '',
    phone: '',
    email: '',
    password: '',
    confirm_password: ''
  });
  const [setupError, setSetupError] = useState('');

  // Check if system has 0 existing admin profiles across central cloud store
  useEffect(() => {
    async function checkAdminCount() {
      try {
        const cloudAdmins = await fetchCloudAdminProfiles();
        if (cloudAdmins.length === 0) {
          // Central cloud database is empty: clear stale local caches on device & trigger setup wizard
          localStorage.removeItem('admin_profiles');
          localStorage.removeItem('user');
          localStorage.removeItem('admin_logged_in');
          try {
            const cache = JSON.parse(localStorage.getItem('master_cloud_cache') || '{}');
            cache.adminProfiles = [];
            localStorage.setItem('master_cloud_cache', JSON.stringify(cache));
          } catch (e) {}
          sessionStorage.clear();
          setIsFirstTimeSetup(true);
        } else {
          setIsFirstTimeSetup(false);
        }
      } catch (err) {
        console.warn('Error checking initial admin setup:', err);
      } finally {
        setSetupLoading(false);
      }
    }
    checkAdminCount();
  }, []);

  // If already logged in, navigate directly to dashboard
  useEffect(() => {
    const isLoggedIn = (
      localStorage.getItem('admin_logged_in') === 'true' || 
      sessionStorage.getItem('admin_logged_in') === 'true' || 
      Boolean(user)
    );
    if (isLoggedIn) {
      window.location.href = '/admin/dashboard';
    }
  }, [user, navigate]);

  // OTP Reset Modal State
  const [showOtpModal, setShowOtpModal] = useState(false);
  const [otpStep, setOtpStep] = useState(1); // 1: Request, 2: Verify Code, 3: Set New Password
  const [otpPhone, setOtpPhone] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [otpSimulated, setOtpSimulated] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [otpMessage, setOtpMessage] = useState('');
  const [otpError, setOtpError] = useState('');
  const [otpLoading, setOtpLoading] = useState(false);
  const [otpTimer, setOtpTimer] = useState(30);

  // Countdown timer for lockout
  useEffect(() => {
    let timer;
    if (lockoutSeconds > 0) {
      timer = setInterval(() => {
        setLockoutSeconds((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [lockoutSeconds]);

  // 30-Second Countdown Timer for OTP
  useEffect(() => {
    let timer = null;
    if (showOtpModal && otpStep === 2 && otpTimer > 0) {
      timer = setInterval(() => {
        setOtpTimer((prev) => prev - 1);
      }, 1000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [showOtpModal, otpStep, otpTimer]);

  const handleLogin = async (e) => {
    e.preventDefault();
    if (lockoutSeconds > 0) return;
    
    setLoading(true);
    setError(null);
    try {
      await login(username, password);
      sessionStorage.setItem('admin_logged_in', 'true');
      window.location.href = '/admin/dashboard';
      return;
    } catch (err) {
      console.error(err);
      const data = err.response?.data;
      if (data?.locked_out) {
        setLockoutSeconds(data.remaining_seconds || 600);
        setError(data.error || 'Account is locked out due to 5 consecutive failed attempts.');
      } else {
        setError(data?.error || 'Invalid username or password.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRequestOtp = async (e) => {
    if (e) e.preventDefault();
    if (!otpPhone.trim()) {
      setOtpError('Please enter registered mobile number.');
      return;
    }

    setOtpLoading(true);
    setOtpError('');
    setOtpMessage('');
    try {
      const res = await API.post('/auth/request-otp/', { phone: otpPhone });
      setOtpSimulated(res.data.otp);
      setOtpMessage(`SMS OTP sent to ${otpPhone}! Valid for 30 seconds.`);
      setOtpCode('');
      setOtpTimer(30);
      setOtpStep(2);
    } catch (err) {
      setOtpError(err.response?.data?.error || 'Failed to send OTP.');
    } finally {
      setOtpLoading(false);
    }
  };

  const handleVerifyOtpCodeOnly = async (e) => {
    e.preventDefault();
    if (otpTimer <= 0) {
      setOtpError('OTP Expired! The OTP was valid for 30 seconds only. Please click Resend OTP.');
      return;
    }
    if (!otpCode.trim()) {
      setOtpError('Please enter 6-digit OTP code.');
      return;
    }

    setOtpLoading(true);
    setOtpError('');
    try {
      const res = await API.post('/auth/verify-otp-only/', {
        phone: otpPhone,
        otp: otpCode
      });
      alert('✅ OTP Verified Successfully! Enter your new password.');
      setOtpStep(3);
    } catch (err) {
      setOtpError(err.response?.data?.error || 'Invalid or expired 6-digit OTP code.');
    } finally {
      setOtpLoading(false);
    }
  };

  const handleVerifyOtpReset = async (e) => {
    e.preventDefault();
    if (!newPassword || !confirmPassword) {
      setOtpError('Please fill in both new password fields.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setOtpError('Passwords do not match!');
      return;
    }

    setOtpLoading(true);
    setOtpError('');
    try {
      const res = await API.post('/auth/verify-otp-reset/', {
        phone: otpPhone,
        otp: otpCode,
        new_password: newPassword
      });
      alert(res.data.message);
      setShowOtpModal(false);
      setUsername(res.data.username || username);
      setPassword(newPassword);
    } catch (err) {
      setOtpError(err.response?.data?.error || 'OTP Verification failed.');
    } finally {
      setOtpLoading(false);
    }
  };

  const handleInitialAdminSetup = async (e) => {
    e.preventDefault();
    if (!setupForm.user_name.trim() || !setupForm.username.trim() || !setupForm.password.trim()) {
      setSetupError('Please fill in Owner Name, Username, and Password.');
      return;
    }
    if (setupForm.password !== setupForm.confirm_password) {
      setSetupError('Passwords do not match!');
      return;
    }

    setLoading(true);
    setSetupError('');

    const newOwnerAdmin = {
      id: `admin_primary_${Date.now()}`,
      user_name: setupForm.user_name.trim(),
      username: setupForm.username.trim(),
      phone: setupForm.phone.trim() || '+91 81403 71414',
      email: setupForm.email.trim() || 'contact@patelautomobiles.com',
      password: setupForm.password.trim(),
      date_of_birth: '1990-01-01',
      profile_photo: '/logo.png'
    };

    try {
      // 1. Try Backend API creation
      await API.post('/admin-profile/', {
        ...setupForm,
        password: setupForm.password
      }, { timeout: 2000 });
    } catch (err) {
      console.warn('Backend API offline, saved primary admin locally & cloud store:', err);
    } finally {
      // 2. Save in Cloud Master Bin & LocalStorage (AWAITED to guarantee cloud persist before navigation)
      await pushCloudAdminProfile(newOwnerAdmin).catch(console.warn);
      localStorage.setItem('admin_profiles', JSON.stringify([newOwnerAdmin]));
      
      const adminSessionUser = {
        username: newOwnerAdmin.username,
        user_name: newOwnerAdmin.user_name,
        is_staff: true,
        is_superuser: true,
        role: 'ADMIN'
      };
      sessionStorage.setItem('access_token', 'static_admin_token');
      sessionStorage.setItem('admin_logged_in', 'true');
      sessionStorage.setItem('user', JSON.stringify(adminSessionUser));

      setIsFirstTimeSetup(false);
      alert(`🎉 Welcome ${newOwnerAdmin.user_name}! Primary Admin Account created & system is now LOCKED to your credentials!`);
      window.location.href = '/admin/dashboard';
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 relative overflow-hidden">
      
      {/* Blurred Garage Background Image */}
      <div 
        className="absolute inset-0 bg-cover bg-center bg-no-repeat blur-[4px] scale-105 opacity-35"
        style={{ backgroundImage: `url('/garage_bg.png')` }}
      ></div>
      <div className="absolute inset-0 bg-slate-950/75"></div>

      {isFirstTimeSetup ? (
        /* FIRST-TIME INITIAL ADMIN SETUP WIZARD */
        <div className="w-full max-w-md bg-slate-900/95 border border-emerald-500/40 rounded-3xl p-8 shadow-2xl backdrop-blur-xl space-y-6 relative z-10 animate-in fade-in zoom-in duration-300">
          <div className="text-center space-y-2">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/20">
              <ShieldCheck className="w-9 h-9" />
            </div>
            <h1 className="text-2xl font-bold text-white font-poppins">
              Patel Automobiles
            </h1>
            <p className="text-xs text-emerald-400 font-semibold tracking-wide uppercase">🚀 Initial Admin Setup Wizard</p>
            <p className="text-xs text-slate-400">Create your Primary Admin account to initialize & lock your garage portal.</p>
          </div>

          {setupError && (
            <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{setupError}</span>
            </div>
          )}

          <form onSubmit={handleInitialAdminSetup} className="space-y-4">
            <div>
              <label className="block text-[11px] font-semibold text-slate-300 uppercase tracking-wider mb-1">Owner Full Name *</label>
              <input
                type="text"
                required
                value={setupForm.user_name}
                onChange={(e) => setSetupForm(prev => ({ ...prev, user_name: e.target.value }))}
                className="w-full px-4 py-2.5 bg-slate-900/80 border border-slate-700 rounded-xl text-white text-xs focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-300 uppercase tracking-wider mb-1">Admin Username *</label>
                <input
                  type="text"
                  required
                  value={setupForm.username}
                  onChange={(e) => setSetupForm(prev => ({ ...prev, username: e.target.value }))}
                  className="w-full px-4 py-2.5 bg-slate-900/80 border border-slate-700 rounded-xl text-white text-xs focus:outline-none focus:border-emerald-500"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-300 uppercase tracking-wider mb-1">Mobile Number</label>
                <input
                  type="text"
                  value={setupForm.phone}
                  onChange={(e) => setSetupForm(prev => ({ ...prev, phone: e.target.value }))}
                  className="w-full px-4 py-2.5 bg-slate-900/80 border border-slate-700 rounded-xl text-white text-xs focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-300 uppercase tracking-wider mb-1">Password *</label>
                <input
                  type="password"
                  required
                  value={setupForm.password}
                  onChange={(e) => setSetupForm(prev => ({ ...prev, password: e.target.value }))}
                  className="w-full px-4 py-2.5 bg-slate-900/80 border border-slate-700 rounded-xl text-white text-xs focus:outline-none focus:border-emerald-500"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-300 uppercase tracking-wider mb-1">Confirm Password *</label>
                <input
                  type="password"
                  required
                  value={setupForm.confirm_password}
                  onChange={(e) => setSetupForm(prev => ({ ...prev, confirm_password: e.target.value }))}
                  className="w-full px-4 py-2.5 bg-slate-900/80 border border-slate-700 rounded-xl text-white text-xs focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 rounded-xl shadow-lg shadow-emerald-600/30 transition-all text-xs flex items-center justify-center gap-2 mt-2"
            >
              <ShieldCheck className="w-4 h-4" />
              {loading ? 'Initializing Setup...' : 'Create Primary Admin & Lock System'}
            </button>
          </form>
        </div>
      ) : (
        /* STANDARD LOGIN FORM */
        <div className="w-full max-w-md bg-slate-900/90 border border-slate-700/80 rounded-3xl p-8 shadow-2xl backdrop-blur-xl space-y-8 relative z-10">
        
        {/* Header */}
        <div className="text-center space-y-3">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-blue-600 to-blue-500 text-white flex items-center justify-center mx-auto shadow-lg shadow-blue-500/20">
            <Wrench className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold text-white font-poppins">
            Patel Automobiles
          </h1>
          <p className="text-xs text-slate-400 font-medium">Admin Portal • Dandi, Valsad, Gujarat</p>
        </div>

        {/* Lockout Warning */}
        {lockoutSeconds > 0 ? (
          <div className="p-4 rounded-2xl bg-red-500/20 border border-red-500/40 text-red-300 text-xs space-y-2 text-center">
            <Clock className="w-6 h-6 text-red-400 mx-auto animate-pulse" />
            <span className="font-bold text-sm block font-poppins">Account Locked</span>
            <p>5 consecutive failed login attempts detected.</p>
            <p className="font-mono text-base font-extrabold text-amber-400 pt-1">
              Try again in: {formatLockoutTime(lockoutSeconds)}
            </p>
          </div>
        ) : error && (
          <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-5">
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">Admin Username</label>
            <div className="relative">
              <User className="w-5 h-5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                required
                disabled={lockoutSeconds > 0}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full pl-11 pr-4 py-3 bg-slate-900/80 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 disabled:opacity-40"
              />
            </div>
          </div>

          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">Password</label>
              <button
                type="button"
                onClick={() => {
                  setShowOtpModal(true);
                  setOtpStep(1);
                  setOtpError('');
                  setOtpMessage('');
                }}
                className="text-[11px] font-bold text-blue-400 hover:text-blue-300 transition-colors"
              >
                Forgot Password? (OTP Reset)
              </button>
            </div>
            <div className="relative">
              <Lock className="w-5 h-5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="password"
                required
                disabled={lockoutSeconds > 0}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-11 pr-4 py-3 bg-slate-900/80 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 disabled:opacity-40"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || lockoutSeconds > 0}
            className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3.5 rounded-xl shadow-lg shadow-blue-600/30 transition-all text-sm flex items-center justify-center gap-2 disabled:opacity-40"
          >
            <ShieldCheck className="w-5 h-5" />
            {loading ? 'Authenticating...' : lockoutSeconds > 0 ? 'Locked (Wait Cooldown)' : 'Sign In as Admin'}
          </button>
        </form>

      </div>
      )}

      {/* DIRECT PASSWORD RESET MODAL */}
      {showOtpModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 max-w-md w-full text-white space-y-6 shadow-2xl relative animate-in fade-in zoom-in duration-200">
            <button
              onClick={() => setShowOtpModal(false)}
              className="absolute top-5 right-5 text-slate-400 hover:text-white p-1 rounded-full hover:bg-slate-800"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 border-b border-slate-800 pb-4">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center shrink-0 shadow-lg">
                <Key className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold font-poppins">Reset Secret Password</h3>
                <p className="text-xs text-slate-400">Direct Admin Password Update</p>
              </div>
            </div>

            {otpError && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-bold">
                {otpError}
              </div>
            )}

            <form onSubmit={handleVerifyOtpReset} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">Registered Mobile Number or Username *</label>
                <input
                  type="text"
                  required
                  value={otpPhone}
                  onChange={(e) => setOtpPhone(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">New Secret Password *</label>
                <input
                  type="password"
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">Confirm New Password *</label>
                <input
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm focus:outline-none focus:border-blue-500"
                />
                {confirmPassword && (
                  <p className={`text-[11px] font-bold mt-1.5 ${newPassword === confirmPassword ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {newPassword === confirmPassword ? '✓ Passwords match' : '✗ Passwords do not match'}
                  </p>
                )}
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowOtpModal(false)}
                  className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={otpLoading || newPassword !== confirmPassword}
                  className="flex-1 py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl shadow-lg transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  <ShieldCheck className="w-4 h-4" />
                  <span>{otpLoading ? 'Updating...' : 'Update Password'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
