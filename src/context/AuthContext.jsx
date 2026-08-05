import React, { createContext, useContext, useState, useEffect } from 'react';
import API from '../services/api';
import { fetchCloudGarageInfo, pushCloudGarageInfo } from '../utils/cloudSync';

export const DEFAULT_GARAGE_INFO = {
  garage_name: 'Patel Automobiles',
  address: 'Near Dandi Pond, Dandi, Valsad, Gujarat - 396385',
  phone: '+91 81403 71414',
  whatsapp_number: '+91 81403 71414',
  logo: '/logo.png',
  upi_id: 'pritpatel9397@oksbi',
  upi_payee_name: 'Prit Patel',
  timing_text: 'Mon - Sat: 08:30 AM - 06:30 PM, Sun: 09:00 AM - 02:00 PM',
  mechanics_list: 'Amitbhai Mechanic, Vishalbhai Mechanic, Manojbhai Mechanic',
  default_labour_charge: 100.00
};

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    const saved = sessionStorage.getItem('user');
    return saved ? JSON.parse(saved) : null;
  });
  const [loading, setLoading] = useState(true);
  const [garageInfo, setGarageInfo] = useState(() => {
    const saved = localStorage.getItem('garage_info');
    return saved ? JSON.parse(saved) : DEFAULT_GARAGE_INFO;
  });

  const fetchGarageInfo = async () => {
    const cloudInfo = await fetchCloudGarageInfo().catch(() => null);
    const localSaved = JSON.parse(localStorage.getItem('garage_info') || 'null');
    let backendInfo = null;

    try {
      const res = await API.get('/public/info/', { timeout: 1500 });
      if (res.data && res.data.phone) {
        backendInfo = res.data;
      }
    } catch (err) {
      console.warn('Backend API offline, using cloud + local garage info:', err);
    }

    const merged = {
      ...DEFAULT_GARAGE_INFO,
      ...(backendInfo || {}),
      ...(localSaved || {}),
      ...(cloudInfo || {})
    };

    if (cloudInfo?.timing_text) merged.timing_text = cloudInfo.timing_text;
    else if (localSaved?.timing_text) merged.timing_text = localSaved.timing_text;

    if (cloudInfo?.phone) merged.phone = cloudInfo.phone;
    else if (localSaved?.phone) merged.phone = localSaved.phone;

    setGarageInfo(merged);
    localStorage.setItem('garage_info', JSON.stringify(merged));
  };

  const updateGarageSettings = async (newInfo) => {
    const updated = { ...garageInfo, ...newInfo };
    setGarageInfo(updated);
    localStorage.setItem('garage_info', JSON.stringify(updated));
    window.dispatchEvent(new Event('garage_info_updated'));
    await pushCloudGarageInfo(updated).catch(console.warn);
  };

  const fetchCurrentUser = async () => {
    const savedUser = sessionStorage.getItem('user');
    const isLoggedIn = sessionStorage.getItem('admin_logged_in') === 'true';

    if (savedUser && isLoggedIn) {
      try {
        const parsed = JSON.parse(savedUser);
        setUser(parsed);
      } catch (e) {
        setUser(null);
        sessionStorage.removeItem('user');
        sessionStorage.removeItem('admin_logged_in');
      }
    } else {
      setUser(null);
      sessionStorage.removeItem('user');
      sessionStorage.removeItem('admin_logged_in');
    }
    setLoading(false);
  };

  useEffect(() => {
    // Clean legacy persistent local storage user sessions so every session starts locked
    localStorage.removeItem('user');
    localStorage.removeItem('admin_logged_in');

    fetchGarageInfo();
    fetchCurrentUser();

    const handleStorageChange = (e) => {
      if (e.key === 'garage_info' || e.type === 'garage_info_updated') {
        const saved = localStorage.getItem('garage_info');
        if (saved) {
          try { setGarageInfo(JSON.parse(saved)); } catch (err) {}
        }
      }
    };
    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('garage_info_updated', handleStorageChange);

    const syncInterval = setInterval(() => {
      fetchGarageInfo();
    }, 3000);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('garage_info_updated', handleStorageChange);
      clearInterval(syncInterval);
    };
  }, []);

  const login = async (username, password) => {
    const cleanUser = (username || '').trim();
    const cleanPass = (password || '').trim();

    try {
      const res = await API.post('/auth/token/', { username: cleanUser, password: cleanPass });
      sessionStorage.setItem('access_token', res.data.access);
      sessionStorage.setItem('refresh_token', res.data.refresh);
      sessionStorage.setItem('admin_logged_in', 'true');
      
      const userRes = await API.get('/auth/me/');
      setUser(userRes.data);
      sessionStorage.setItem('user', JSON.stringify(userRes.data));
      return userRes.data;
    } catch (err) {
      console.warn('Backend Auth API offline or static host, checking registered cloud & local admin profiles:', err);
      const cloudAdmins = await fetchCloudAdminProfiles().catch(() => []);
      const localAdmins = JSON.parse(localStorage.getItem('admin_profiles') || '[]');
      const allAdmins = [...cloudAdmins, ...localAdmins];

      const matchedAdmin = allAdmins.find(a => 
        a && (
          (a.username && a.username.trim().toLowerCase() === cleanUser.toLowerCase()) ||
          (a.user_name && a.user_name.trim().toLowerCase() === cleanUser.toLowerCase())
        )
      );

      if (!matchedAdmin) {
        throw new Error(`Invalid credentials! No registered admin account exists for '${cleanUser}'. Please create your Admin account using the Setup Wizard.`);
      }

      const activeUser = {
        username: matchedAdmin.username || cleanUser,
        user_name: matchedAdmin.user_name || cleanUser,
        role: 'ADMIN',
        phone: matchedAdmin.phone || ''
      };

      sessionStorage.setItem('access_token', 'static_admin_token');
      sessionStorage.setItem('admin_logged_in', 'true');
      sessionStorage.setItem('user', JSON.stringify(activeUser));
      setUser(activeUser);
      return activeUser;
    }
  };

  const logout = () => {
    sessionStorage.removeItem('access_token');
    sessionStorage.removeItem('refresh_token');
    sessionStorage.removeItem('user');
    sessionStorage.removeItem('admin_logged_in');
    localStorage.removeItem('user');
    localStorage.removeItem('admin_logged_in');
    setUser(null);
  };

  const isAdmin = user?.role === 'ADMIN' || user?.profile?.role === 'ADMIN';
  const isStaff = user?.role === 'STAFF' || user?.profile?.role === 'STAFF';

  return (
    <AuthContext.Provider
      value={{
        user,
        role: user?.role || user?.profile?.role || 'STAFF',
        isAdmin,
        isStaff,
        login,
        logout,
        loading,
        garageInfo,
        fetchGarageInfo,
        updateGarageSettings,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
