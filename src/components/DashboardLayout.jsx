import React, { useState, useEffect } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, CalendarCheck, PlusCircle, Wrench, Package, 
  Users, History, Receipt, BookOpen, Clock, BarChart3, Settings, 
  LogOut, Menu, X, Shield, ChevronRight, MessageSquare, Trash2,
  Globe, ExternalLink, Smartphone, Download
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import ThemeToggle from './ThemeToggle';
import API from '../services/api';

export default function DashboardLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { user, logout, garageInfo } = useAuth();
  const [adminProfile, setAdminProfile] = useState(null);
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallApp = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setIsInstalled(true);
      }
      setDeferredPrompt(null);
    } else {
      alert('To install Patel Automobiles Admin App:\n\n• Android (Chrome): Tap browser menu (⋮) -> "Add to Home screen" or "Install App".\n• iPhone (Safari): Tap Share (⎋) -> "Add to Home Screen".');
    }
  };

  useEffect(() => {
    API.get('/admin-profile/').then(res => {
      if (res.data && res.data.length > 0) {
        setAdminProfile(res.data[0]);
      }
    }).catch(err => console.error(err));
  }, []);

  const basePrefix = location.pathname.startsWith('/admin') ? '/admin' : '/app';

  const menuItems = [
    { name: 'Dashboard', path: `${basePrefix}/dashboard`, icon: LayoutDashboard },
    { name: 'Bookings', path: `${basePrefix}/bookings`, icon: CalendarCheck },
    { name: 'Messages', path: `${basePrefix}/messages`, icon: MessageSquare },
    { name: 'New Service', path: `${basePrefix}/new-service`, icon: PlusCircle },
    { name: 'Workshop', path: `${basePrefix}/workshop`, icon: Wrench },
    { name: 'Inventory', path: `${basePrefix}/inventory`, icon: Package },
    { name: 'Customers', path: `${basePrefix}/customers`, icon: Users },
    { name: 'Vehicle History', path: `${basePrefix}/vehicle-history`, icon: History },
    { name: 'Billing', path: `${basePrefix}/billing`, icon: Receipt },
    { name: 'Khata Book', path: `${basePrefix}/khata-book`, icon: BookOpen },
    { name: 'Attendance', path: `${basePrefix}/attendance`, icon: Clock },
    { name: 'Reports', path: `${basePrefix}/reports`, icon: BarChart3 },
    { name: 'Settings', path: `${basePrefix}/settings`, icon: Settings },
    { name: 'Recycle Bin', path: `${basePrefix}/recycle-bin`, icon: Trash2 },
  ];

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const isActive = (path) => location.pathname === path;

  // Active Admin Details
  const displayName = adminProfile?.user_name || user?.admin_profile?.user_name || user?.user_name || user?.username || 'Garage Owner (Admin)';
  const displayPhoto = adminProfile?.profile_photo || user?.admin_profile?.profile_photo || garageInfo?.logo || '/logo.png';
  const displayUsername = (adminProfile?.username || user?.username || displayName || 'admin').replace(/^@+/, '');

  return (
    <div className="min-h-screen bg-slate-50 flex">
      
      {/* SIDEBAR (Desktop & Mobile) */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-slate-900 text-slate-300 flex flex-col justify-between border-r border-slate-800 transform transition-transform duration-200 ease-in-out md:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex flex-col h-full">
          
          {/* Header / Logo */}
          <div className="h-20 px-6 flex items-center justify-between border-b border-slate-800">
            <Link to="/app/dashboard" className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-slate-800 text-white flex items-center justify-center font-bold shadow-md overflow-hidden border border-slate-700 shrink-0">
                {garageInfo?.logo ? (
                  <img src={garageInfo.logo} alt="Logo" className="w-full h-full object-cover" />
                ) : (
                  <Wrench className="w-5 h-5 text-blue-400" />
                )}
              </div>
              <div>
                <span className="font-bold text-white text-base tracking-tight font-poppins block leading-none">
                  {garageInfo?.garage_name || 'Patel Automobiles'}
                </span>
                <span className="text-[10px] text-blue-400 font-semibold tracking-wider uppercase mt-1 block">
                  Garage Admin Portal
                </span>
              </div>
            </Link>
            <button
              onClick={() => setSidebarOpen(false)}
              className="md:hidden text-slate-400 hover:text-white"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Navigation Links */}
          <div className="flex-1 px-4 py-6 space-y-1.5 overflow-y-auto scrollbar-none">
            {menuItems.map((item) => {
              const active = isActive(item.path);
              const Icon = item.icon;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-bold transition-all duration-200 ${
                    active
                      ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
                      : 'text-slate-400 hover:bg-slate-800/80 hover:text-slate-100'
                  }`}
                >
                  <Icon className={`w-5 h-5 ${active ? 'text-white' : 'text-slate-400'}`} />
                  <span>{item.name}</span>
                </Link>
              );
            })}
          </div>

          {/* User Profile Footer (Bottom Sidebar) */}
          <div className="p-4 border-t border-slate-800 bg-slate-950/60">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold text-base shadow-md overflow-hidden border border-blue-500/30 shrink-0">
                  {displayPhoto && displayPhoto !== '/logo.png' && !displayPhoto.includes('undefined') ? (
                    <img 
                      src={displayPhoto} 
                      alt={displayName} 
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span>{displayName ? displayName.charAt(0).toUpperCase() : 'A'}</span>
                  )}
                </div>
                <div className="truncate max-w-[110px]">
                  <span className="text-xs font-bold text-white block truncate">
                    {displayName}
                  </span>
                  <span className="text-[10px] text-blue-400 font-semibold block truncate">
                    @{displayUsername}
                  </span>
                </div>
              </div>
              <button
                onClick={handleLogout}
                className="p-2 text-slate-400 hover:text-red-400 hover:bg-slate-800 rounded-lg transition-colors"
                title="Logout"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>

        </div>
      </aside>

      {/* MAIN CONTENT AREA */}
      <div className="flex-1 md:ml-64 flex flex-col min-h-screen max-w-full overflow-x-hidden">
        
        {/* Top Navbar */}
        <header className="h-20 bg-white border-b border-slate-200/80 px-4 sm:px-6 flex items-center justify-between sticky top-0 z-40 shadow-xs">
          <button
            onClick={() => setSidebarOpen(true)}
            className="md:hidden p-2 rounded-xl text-slate-600 hover:bg-slate-100"
          >
            <Menu className="w-6 h-6" />
          </button>

          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2 text-xs text-slate-500 font-medium bg-slate-100 px-3 py-1.5 rounded-full border border-slate-200">
              <Shield className="w-3.5 h-3.5 text-emerald-600" />
              <span>Session Active • Secured</span>
            </div>
          </div>

          <div className="flex items-center gap-3 sm:gap-4">
            <Link
              to="/app/recycle-bin"
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-xl border border-rose-200 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" /> Recycle Bin
            </Link>

            <Link
              to="/app/new-service"
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs rounded-xl shadow-md shadow-blue-600/20 transition-all hover:scale-105 active:scale-95"
            >
              <PlusCircle className="w-4 h-4" />
              <span>New Service Job</span>
            </Link>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 p-4 sm:p-6 overflow-x-hidden">
          <Outlet />
        </main>

      </div>

    </div>
  );
}
