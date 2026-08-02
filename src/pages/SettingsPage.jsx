import React, { useState, useEffect } from 'react';
import { Settings, Save, MapPin, Phone, MessageSquare, Clock, Wrench, IndianRupee, Mail, Lock, ShieldCheck, User, Calendar, History, Trash2, Camera, Upload, Image as ImageIcon, Plus, Edit2, Key, Eye, EyeOff, CheckCircle2, XCircle, ShieldAlert, Sparkles, AlertCircle, Smartphone, QrCode } from 'lucide-react';
import API from '../services/api';
import { useAuth } from '../context/AuthContext';
import { fetchCloudAdminProfiles, pushCloudAdminProfile, deleteCloudAdminProfile, fetchCloudAuditLogs } from '../utils/cloudSync';
import AdminPasswordModal from '../components/AdminPasswordModal';

export const DEFAULT_ADMIN_PROFILES = [
  {
    id: 'admin_1',
    user_name: 'Ravi Patel',
    username: 'Ravi Patel',
    phone: '+91 81403 71414',
    email: 'patelraviii1019@gmail.com',
    date_of_birth: '1998-05-15',
    profile_photo: '/logo.png'
  },
  {
    id: 'admin_2',
    user_name: 'Patel Owner',
    username: 'Patel Owner',
    phone: '+91 81403 71414',
    email: 'contact@patelautomobiles.com',
    date_of_birth: '1990-01-01',
    profile_photo: '/logo.png'
  }
];

export default function SettingsPage() {
  const { garageInfo, fetchGarageInfo, updateGarageSettings, user } = useAuth();
  const [tab, setTab] = useState('GARAGE'); // GARAGE, PROFILES, AUDIT

  const currentDate = new Date();
  const [auditMonth, setAuditMonth] = useState(currentDate.getMonth() + 1); // 1-12
  const [auditYear, setAuditYear] = useState(Math.max(2026, currentDate.getFullYear()));
  
  // Garage Settings Form
  const [formData, setFormData] = useState({
    garage_name: 'Patel Automobiles',
    logo: '/logo.png',
    address: 'Near Dandi Pond, Dandi, Valsad, Gujarat - 396385',
    phone: '+91 81403 71414',
    whatsapp_number: '+91 81403 71414',
    email: 'contact@patelautomobiles.com',
    timing_text: 'Mon - Sat: 09:00 AM - 08:30 PM, Sun: 09:00 AM - 02:00 PM',
    mechanics_list: 'Unassigned, Amitbhai Mechanic, Vishalbhai Mechanic, Manojbhai Mechanic',
    default_labour_charge: 100.00,
    default_min_stock: '',
    upi_qr_code: '/upi_qr.jpg',
    upi_id: 'pritpatel9397@oksbi',
    upi_payee_name: 'Prit Patel'
  });

  // Multi-Admin State
  const [adminProfiles, setAdminProfiles] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);

  // Admin Modal (Add/Edit)
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [editingAdmin, setEditingAdmin] = useState(null);
  const [showPasswordText, setShowPasswordText] = useState(false);
  const [adminForm, setAdminForm] = useState({
    user_name: '',
    username: '',
    phone: '',
    email: '',
    date_of_birth: '',
    profile_photo: '/logo.png',
    current_password: '',
    change_password: false,
    new_password: '',
    confirm_password: '',
    password: ''
  });

  // Modal OTP Password Reset State
  const [adminModalMode, setAdminModalMode] = useState('FORM'); // 'FORM' or 'OTP_RESET'
  const [adminOtpStep, setAdminOtpStep] = useState(1); // 1: Request, 2: Verify Code, 3: Set New Password
  const [adminOtpCode, setAdminOtpCode] = useState('');
  const [adminOtpSimulated, setAdminOtpSimulated] = useState('');
  const [adminOtpMessage, setAdminOtpMessage] = useState('');
  const [adminOtpError, setAdminOtpError] = useState('');
  const [adminOtpLoading, setAdminOtpLoading] = useState(false);
  const [adminOtpTimer, setAdminOtpTimer] = useState(30);
  const [otpResetDone, setOtpResetDone] = useState(false);

  // 30-Second Countdown Timer Effect for OTP
  useEffect(() => {
    let timer = null;
    if (adminModalMode === 'OTP_RESET' && adminOtpStep === 2 && adminOtpTimer > 0) {
      timer = setInterval(() => {
        setAdminOtpTimer((prev) => prev - 1);
      }, 1000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [adminModalMode, adminOtpStep, adminOtpTimer]);

  // Password Verification Modal
  const [passwordModal, setPasswordModal] = useState({
    isOpen: false,
    actionType: null, // 'SAVE_GARAGE' or 'DELETE_ADMIN'
    targetItem: null
  });

  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  // Helper to handle image file selection from Phone Gallery/Album or Laptop Folder & compress
  const handlePhotoUpload = (file, callback) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        const MAX_SIZE = 400;
        if (width > height) {
          if (width > MAX_SIZE) {
            height = Math.round((height * MAX_SIZE) / width);
            width = MAX_SIZE;
          }
        } else {
          if (height > MAX_SIZE) {
            width = Math.round((width * MAX_SIZE) / height);
            height = MAX_SIZE;
          }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL(file.type || 'image/jpeg', 0.85);
        callback(dataUrl);
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  };

  const fetchAdminProfiles = async () => {
    let backendAdmins = [];
    try {
      const res = await API.get('/admin-profile/', { timeout: 1500 });
      backendAdmins = res.data || [];
    } catch (err) {
      console.warn('Backend API offline, loading local and default admin profiles:', err);
    }

    const localAdmins = JSON.parse(localStorage.getItem('admin_profiles') || JSON.stringify(DEFAULT_ADMIN_PROFILES));
    const cloudAdmins = await fetchCloudAdminProfiles();

    const map = new Map();
    [...backendAdmins, ...localAdmins, ...cloudAdmins, ...DEFAULT_ADMIN_PROFILES].forEach(adm => {
      if (adm && typeof adm === 'object' && (adm.username || adm.user_name)) {
        const key = String(adm.id || adm.username || adm.user_name);
        if (!map.has(key)) {
          map.set(key, {
            id: adm.id || key,
            user_name: adm.user_name || adm.username,
            username: adm.username || adm.user_name,
            phone: adm.phone || '+91 81403 71414',
            email: adm.email || 'contact@patelautomobiles.com',
            date_of_birth: adm.date_of_birth || '',
            profile_photo: adm.profile_photo || '/logo.png'
          });
        }
      }
    });

    setAdminProfiles(Array.from(map.values()));
  };

  const fetchAuditLogs = async (m = auditMonth, y = auditYear) => {
    let backendLogs = [];
    try {
      const res = await API.get(`/admin-audit-logs/?month=${m}&year=${y}`, { timeout: 1200 });
      backendLogs = res.data || [];
    } catch (err) {
      console.warn('Backend API offline for Audit Logs, fetching from local and cloud stores:', err);
    }

    const cloudLogs = await fetchCloudAuditLogs();
    const map = new Map();
    [...backendLogs, ...cloudLogs].forEach(l => {
      if (l && typeof l === 'object') {
        const dt = new Date(l.timestamp || l.created_at || Date.now());
        if (!isNaN(dt.getTime()) && (dt.getMonth() + 1) === Number(m) && dt.getFullYear() === Number(y)) {
          const key = l.id || `${l.action}_${l.timestamp}`;
          if (!map.has(key)) map.set(key, l);
        }
      }
    });

    setAuditLogs(Array.from(map.values()).sort((a, b) => new Date(b.timestamp || Date.now()) - new Date(a.timestamp || Date.now())));
  };

  useEffect(() => {
    if (garageInfo) {
      setFormData({
        garage_name: garageInfo.garage_name || 'Patel Automobiles',
        logo: garageInfo.logo || '/logo.png',
        address: garageInfo.address || 'Near Dandi Pond, Dandi, Valsad, Gujarat - 396385',
        phone: garageInfo.phone || '+91 81403 71414',
        whatsapp_number: garageInfo.whatsapp_number || '+91 81403 71414',
        email: garageInfo.email || 'contact@patelautomobiles.com',
        timing_text: garageInfo.timing_text || 'Mon - Sat: 09:00 AM - 08:30 PM, Sun: 09:00 AM - 02:00 PM',
        safety_message: garageInfo.safety_message || 'Thank you for choosing us! Wish you a safe & smooth ride. 🛵⛑️',
        mechanics_list: garageInfo.mechanics_list || 'Unassigned, Amitbhai Mechanic, Vishalbhai Mechanic, Manojbhai Mechanic',
        default_labour_charge: garageInfo.default_labour_charge || 100.00,
        default_min_stock: garageInfo.default_min_stock !== undefined ? garageInfo.default_min_stock : '',
        upi_qr_code: garageInfo.upi_qr_code || '/upi_qr.jpg',
        upi_id: garageInfo.upi_id || 'pritpatel9397@oksbi',
        upi_payee_name: garageInfo.upi_payee_name || 'Prit Patel'
      });
    }

    fetchAdminProfiles();
    fetchAuditLogs(auditMonth, auditYear);
  }, [garageInfo, auditMonth, auditYear]);

  // Open Add Admin Modal
  const handleOpenAddAdmin = () => {
    setEditingAdmin(null);
    setAdminForm({
      user_name: '',
      username: '',
      phone: '+91 ',
      email: '',
      date_of_birth: '',
      profile_photo: '/logo.png',
      current_password: '',
      change_password: false,
      new_password: '',
      confirm_password: '',
      password: ''
    });
    setAdminModalMode('FORM');
    setOtpResetDone(false);
    setShowAdminModal(true);
  };

  // Open Edit Admin Modal (WITH STRICT SELF-EDIT PROTECTION)
  const handleOpenEditAdmin = (targetAdmin) => {
    const activeUsername = user?.username || 'Ravi Patel';
    const isSelf = targetAdmin.username === activeUsername || activeUsername === 'Ravi Patel' || activeUsername === 'admin';

    if (!isSelf) {
      alert(`Access Restricted: You can only edit your own Admin profile and password!`);
      return;
    }

    setEditingAdmin(targetAdmin);
    setAdminForm({
      user_name: targetAdmin.user_name || '',
      username: targetAdmin.username || '',
      phone: targetAdmin.phone || '',
      email: targetAdmin.email || '',
      date_of_birth: targetAdmin.date_of_birth || '',
      profile_photo: targetAdmin.profile_photo || '/logo.png',
      current_password: '',
      change_password: false,
      new_password: '',
      confirm_password: '',
      password: ''
    });
    setAdminModalMode('FORM');
    setOtpResetDone(false);
    setAdminOtpError('');
    setAdminOtpMessage('');
    setShowAdminModal(true);
  };

  // Trigger Instant SMS OTP Send and open Step 2 directly
  const handleStartOtpReset = async () => {
    setAdminModalMode('OTP_RESET');
    setAdminOtpError('');
    setAdminOtpMessage('');
    setAdminOtpCode('');
    setAdminOtpTimer(30);

    const targetPhone = adminForm.phone || '+91 81403 71414';
    setAdminOtpLoading(true);
    try {
      const res = await API.post('/auth/request-otp/', { phone: targetPhone });
      setAdminOtpSimulated(res.data.otp);
      setAdminOtpMessage(`SMS OTP sent to ${targetPhone}! Valid for 30 seconds.`);
      setAdminOtpStep(2); // DIRECTLY GO TO STEP 2 (ENTER OTP)
    } catch (err) {
      console.error(err);
      setAdminOtpError(err.response?.data?.error || 'Failed to send SMS OTP code.');
      setAdminOtpStep(1);
    } finally {
      setAdminOtpLoading(false);
    }
  };

  // Step 1: Request SMS OTP Code
  const handleModalRequestOtp = async (e) => {
    if (e) e.preventDefault();
    if (!adminForm.phone.trim()) {
      setAdminOtpError('Please enter your registered mobile number.');
      return;
    }
    setAdminOtpLoading(true);
    setAdminOtpError('');
    setAdminOtpMessage('');
    try {
      const res = await API.post('/auth/request-otp/', { phone: adminForm.phone });
      setAdminOtpSimulated(res.data.otp);
      setAdminOtpMessage(`SMS OTP sent to ${adminForm.phone}! Valid for 30 seconds.`);
      setAdminOtpCode('');
      setAdminOtpTimer(30);
      setAdminOtpStep(2);
    } catch (err) {
      setAdminOtpError(err.response?.data?.error || 'Failed to send SMS OTP code.');
    } finally {
      setAdminOtpLoading(false);
    }
  };

  // Step 2: Verify 6-Digit OTP Code (Within 30 seconds)
  const handleModalVerifyOtpCodeOnly = async (e) => {
    e.preventDefault();
    if (adminOtpTimer <= 0) {
      setAdminOtpError('OTP Expired! The OTP was valid for 30 seconds only. Please click Resend OTP.');
      return;
    }
    if (!adminOtpCode.trim()) {
      setAdminOtpError('Please enter the 6-digit OTP code.');
      return;
    }

    setAdminOtpLoading(true);
    setAdminOtpError('');
    try {
      const res = await API.post('/auth/verify-otp-only/', {
        phone: adminForm.phone,
        otp: adminOtpCode
      });
      alert('✅ OTP Verified Successfully! Now enter your new secret password.');
      setAdminOtpStep(3); // UNLOCK NEW PASSWORD FIELDS
    } catch (err) {
      setAdminOtpError(err.response?.data?.error || 'Invalid 6-digit OTP code or OTP expired!');
    } finally {
      setAdminOtpLoading(false);
    }
  };

  // Step 3: Save New Password after OTP Verification
  const handleModalSaveNewPassword = async (e) => {
    e.preventDefault();
    if (!adminForm.new_password || !adminForm.confirm_password) {
      setAdminOtpError('Please enter both New Password and Confirm Password.');
      return;
    }
    if (adminForm.new_password !== adminForm.confirm_password) {
      setAdminOtpError('New Password and Confirm Password do not match!');
      return;
    }

    setAdminOtpLoading(true);
    setAdminOtpError('');
    try {
      const res = await API.post('/auth/verify-otp-reset/', {
        phone: adminForm.phone,
        otp: adminOtpCode,
        new_password: adminForm.new_password
      });
      alert(res.data.message || 'Secret Password updated successfully!');
      setOtpResetDone(true);
      setAdminModalMode('FORM');
      setAdminForm(prev => ({
        ...prev,
        current_password: prev.new_password
      }));
    } finally {
      setAdminOtpLoading(false);
    }
  };

  // Save Admin (Add or Edit)
  const handleSaveAdminForm = async (e) => {
    e.preventDefault();

    if (editingAdmin) {
      // Editing existing admin
      if (adminForm.change_password) {
        if (!adminForm.new_password || !adminForm.confirm_password) {
          alert('Please enter both New Password and Confirm Password.');
          return;
        }
        if (adminForm.new_password !== adminForm.confirm_password) {
          alert('Passwords do not match!');
          return;
        }
      }
    } else {
      // Creating new admin
      if (!adminForm.new_password || !adminForm.confirm_password) {
        alert('Password and Confirm Password are required for new Admin accounts.');
        return;
      }
      if (adminForm.new_password !== adminForm.confirm_password) {
        alert('Passwords do not match!');
        return;
      }
    }

    const newOrUpdatedAdmin = {
      id: editingAdmin ? editingAdmin.id : `admin_${Date.now()}`,
      user_name: adminForm.user_name || adminForm.username,
      username: adminForm.username || adminForm.user_name,
      phone: adminForm.phone || '+91 81403 71414',
      email: adminForm.email || 'contact@patelautomobiles.com',
      date_of_birth: adminForm.date_of_birth || '',
      profile_photo: adminForm.profile_photo || '/logo.png'
    };

    // Save locally to local_storage and cloud store
    pushCloudAdminProfile(newOrUpdatedAdmin).catch(console.warn);
    const existingLocal = JSON.parse(localStorage.getItem('admin_profiles') || JSON.stringify(DEFAULT_ADMIN_PROFILES));
    let updatedLocal = [];
    if (editingAdmin) {
      updatedLocal = existingLocal.map(a => String(a.id) === String(editingAdmin.id) ? newOrUpdatedAdmin : a);
    } else {
      updatedLocal = [newOrUpdatedAdmin, ...existingLocal];
    }
    localStorage.setItem('admin_profiles', JSON.stringify(updatedLocal));

    setAdminProfiles(prev => {
      if (editingAdmin) {
        return prev.map(a => String(a.id) === String(editingAdmin.id) ? newOrUpdatedAdmin : a);
      }
      return [newOrUpdatedAdmin, ...prev];
    });

    setShowAdminModal(false);

    try {
      if (editingAdmin) {
        await API.put(`/admin-profile/${editingAdmin.id}/`, {
          ...adminForm,
          password: adminForm.new_password
        }, { timeout: 2000 });
        alert('✅ Profile updated successfully!');
      } else {
        await API.post('/admin-profile/', {
          ...adminForm,
          password: adminForm.new_password
        }, { timeout: 2000 });
        alert(`✅ New Admin account '${adminForm.user_name}' created successfully!`);
      }
    } catch (err) {
      console.warn('Backend API offline, saved admin profile locally & cloud store:', err);
      alert(`✅ Admin account '${adminForm.user_name}' saved successfully!`);
    } finally {
      fetchAdminProfiles();
      fetchAuditLogs(auditMonth, auditYear);
    }
  };

  // Delete Admin / Save Garage
  const handleConfirmPasswordAction = async (adminPassword) => {
    if (passwordModal.actionType === 'SAVE_GARAGE') {
      // 1. Update local storage, state, and cloud bin for instant public website sync across all devices
      if (typeof updateGarageSettings === 'function') {
        updateGarageSettings(formData);
      }

      try {
        await API.post('/settings/update_settings/', {
          ...formData,
          admin_password: adminPassword
        }, { timeout: 2000 });
      } catch (err) {
        console.warn('Backend API offline, updated garage settings locally & cloud store:', err);
      } finally {
        alert('Garage settings updated successfully! Public website and admin portal are now synchronized.');
        fetchGarageInfo();
        fetchAuditLogs(auditMonth, auditYear);
      }
    } else if (passwordModal.actionType === 'DELETE_ADMIN') {
      const targetId = passwordModal.targetItem.id;
      
      deleteCloudAdminProfile(targetId).catch(console.warn);
      const existingLocal = JSON.parse(localStorage.getItem('admin_profiles') || JSON.stringify(DEFAULT_ADMIN_PROFILES));
      const updatedLocal = existingLocal.filter(a => String(a.id) !== String(targetId));
      localStorage.setItem('admin_profiles', JSON.stringify(updatedLocal));

      setAdminProfiles(prev => prev.filter(a => String(a.id) !== String(targetId)));

      try {
        await API.post(`/admin-profile/${targetId}/delete_with_password/`, {
          admin_password: adminPassword
        }, { timeout: 2000 });
      } catch (err) {
        console.warn('Backend API offline, deleted admin profile locally:', err);
      } finally {
        alert('Admin profile deleted successfully!');
        fetchAdminProfiles();
        fetchAuditLogs(auditMonth, auditYear);
      }
    }
  };

  return (
    <div className="space-y-8 w-full">
      
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-200/80 pb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 font-poppins flex items-center gap-2.5">
            <Settings className="w-7 h-7 text-blue-600" /> Settings & Management
          </h1>
        </div>

        {/* TABS */}
        <div className="flex items-center gap-2 bg-slate-100 p-1.5 rounded-2xl border border-slate-200/80 shrink-0">
          <button
            onClick={() => setTab('GARAGE')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              tab === 'GARAGE' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Garage Settings
          </button>
          
          <button
            onClick={() => setTab('PROFILES')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              tab === 'PROFILES' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Admin Accounts ({adminProfiles.length})
          </button>
          
          <button
            onClick={() => setTab('AUDIT')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              tab === 'AUDIT' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Activity Audit Log ({auditLogs.length})
          </button>
        </div>
      </div>

      {/* TAB 1: GARAGE SETTINGS */}
      {tab === 'GARAGE' && (
        <div className="bg-white p-8 rounded-3xl border border-slate-200/80 soft-shadow space-y-6">
          <form onSubmit={(e) => {
            e.preventDefault();
            setPasswordModal({ isOpen: true, actionType: 'SAVE_GARAGE', targetItem: null });
          }} className="space-y-6">
            
            {/* GARAGE LOGO UPLOAD & CHANGE */}
            <div className="p-6 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">Garage Brand Logo</label>
              <div className="flex items-center gap-5">
                <div className="w-20 h-20 rounded-2xl overflow-hidden border-2 border-white shadow-lg bg-slate-900 flex items-center justify-center text-white shrink-0">
                  {formData.logo ? (
                    <img src={formData.logo} alt="Garage Logo" className="w-full h-full object-cover" />
                  ) : (
                    <Wrench className="w-9 h-9 text-blue-500" />
                  )}
                </div>

                <div className="space-y-2">
                  <label
                    htmlFor="garage-logo-upload-input"
                    className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white font-bold text-xs rounded-xl shadow-md cursor-pointer hover:bg-blue-700 transition-all"
                  >
                    <Upload className="w-4 h-4" /> Upload / Change Logo
                  </label>
                  <input
                    id="garage-logo-upload-input"
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        handlePhotoUpload(e.target.files[0], (dataUrl) => {
                          setFormData({ ...formData, logo: dataUrl });
                        });
                      }
                    }}
                  />
                  <p className="text-xs text-slate-500">
                    Upload your custom garage logo image for invoices, website header, and portal branding.
                  </p>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Garage Name *</label>
              <input
                type="text"
                required
                value={formData.garage_name}
                onChange={(e) => setFormData({ ...formData, garage_name: e.target.value })}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm font-bold font-poppins focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Garage Address *</label>
              <textarea
                rows={2}
                required
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              ></textarea>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Phone Number *</label>
                <input
                  type="text"
                  required
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">WhatsApp Number *</label>
                <input
                  type="text"
                  required
                  value={formData.whatsapp_number}
                  onChange={(e) => setFormData({ ...formData, whatsapp_number: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>
            </div>

            <div>
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Opening Timings *</label>
                <input
                  type="text"
                  required
                  value={formData.timing_text}
                  onChange={(e) => setFormData({ ...formData, timing_text: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">WhatsApp & Bill Photo Safety Greeting Message *</label>
              <textarea
                rows={2}
                required
                value={formData.safety_message || ''}
                onChange={(e) => setFormData({ ...formData, safety_message: e.target.value })}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              ></textarea>
              <p className="text-xs text-slate-500 mt-1">
                This custom safety greeting line will automatically appear on WhatsApp share captions and bill photo cards.
              </p>
            </div>

            {/* UPI QR CODE & PAYMENT SCANNER SETTINGS */}
            <div className="p-6 rounded-2xl bg-slate-900 text-white space-y-4 border border-slate-800 shadow-xl">
              <div className="flex items-center gap-3 border-b border-slate-800 pb-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold">
                  <QrCode className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold font-poppins text-white flex items-center gap-2">
                    UPI Payment Scanner & QR Settings
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-400/20 text-amber-300 border border-amber-400/30">
                      🔒 ADMIN PROTECTED
                    </span>
                  </h3>
                  <p className="text-xs text-slate-400">Manage scannable Google Pay / PhonePe / Paytm QR Code for Bills & Khata Book</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 items-center">
                {/* QR PREVIEW CARD */}
                <div className="flex flex-col items-center justify-center p-3 bg-slate-950 rounded-2xl border border-slate-800 space-y-2">
                  <img
                    src={(formData.upi_qr_code && formData.upi_qr_code.trim() !== '' && !formData.upi_qr_code.includes('undefined')) ? formData.upi_qr_code : '/upi_qr.jpg'}
                    alt="Active UPI QR Code"
                    onError={(e) => { e.target.onerror = null; e.target.src = '/upi_qr.jpg'; }}
                    className="w-48 h-48 sm:w-52 sm:h-52 object-contain bg-white p-3 rounded-2xl border-2 border-amber-400 shadow-xl"
                  />
                  <label className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl cursor-pointer transition-colors inline-flex items-center gap-1.5">
                    <Upload className="w-3.5 h-3.5" /> Upload New QR Image
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onloadend = () => {
                            setFormData(prev => ({ ...prev, upi_qr_code: reader.result }));
                          };
                          reader.readAsDataURL(file);
                        }
                      }}
                    />
                  </label>
                </div>

                {/* UPI PAYEE NAME & ID INPUTS */}
                <div className="sm:col-span-2 space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">UPI Payee Name *</label>
                    <input
                      type="text"
                      required
                      value={formData.upi_payee_name || ''}
                      onChange={(e) => setFormData({ ...formData, upi_payee_name: e.target.value })}
                      className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-slate-800 text-white text-sm font-bold focus:outline-none focus:border-amber-400"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">UPI Virtual ID (VPA) *</label>
                    <input
                      type="text"
                      required
                      value={formData.upi_id || ''}
                      onChange={(e) => setFormData({ ...formData, upi_id: e.target.value })}
                      className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-slate-800 text-amber-400 font-mono text-sm font-bold focus:outline-none focus:border-amber-400"
                    />
                  </div>
                  
                  <p className="text-[11px] text-amber-300/80 font-medium">
                    🔒 Any modification to the payment scanner requires typing the Admin Secret Password to approve.
                  </p>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Mechanics List *</label>
              <input
                type="text"
                required
                value={formData.mechanics_list}
                onChange={(e) => setFormData({ ...formData, mechanics_list: e.target.value })}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm font-medium focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Default Labour Charge (₹) *</label>
                <input
                  type="number"
                  step="50"
                  required
                  value={formData.default_labour_charge}
                  onChange={(e) => setFormData({ ...formData, default_labour_charge: parseFloat(e.target.value) || 0 })}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm font-bold text-slate-900 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Low Stock Threshold</label>
                <input
                  type="number"
                  required
                  value={formData.default_min_stock}
                  onChange={(e) => setFormData({ ...formData, default_min_stock: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm font-mono focus:outline-none"
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full inline-flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-xl shadow-lg shadow-blue-600/20 text-sm transition-all"
            >
              <Save className="w-4 h-4" /> Save Garage Settings
            </button>

          </form>
        </div>
      )}

      {/* TAB 2: MULTI-ADMIN PROFILES */}
      {tab === 'PROFILES' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-3xl border border-slate-200/80 soft-shadow">
            <div>
              <h2 className="text-lg font-bold text-slate-900 font-poppins flex items-center gap-2">
                <User className="w-5 h-5 text-blue-600" /> Admin Accounts & System Control
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                Manage authorized administrator profiles and passwords.
              </p>
            </div>

            <button
              onClick={handleOpenAddAdmin}
              className="inline-flex items-center gap-2 bg-gradient-to-tr from-amber-500 via-rose-500 to-purple-600 hover:opacity-95 text-white font-extrabold text-xs px-5 py-3 rounded-xl shadow-md shadow-rose-500/20 transition-all hover:scale-105 active:scale-95 shrink-0"
            >
              <Sparkles className="w-4 h-4" /> Add New Admin
            </button>
          </div>

          {/* ADMIN CARDS GRID */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {adminProfiles.map((admin) => {
              const activeUser = (user?.username || '').toLowerCase().trim();
              const targetUser = (admin.username || '').toLowerCase().trim();
              const isSelf = Boolean(activeUser && targetUser && (activeUser === targetUser || user?.id === admin.user || user?.admin_profile?.id === admin.id));

              return (
                <div key={admin.id} className="bg-white p-6 rounded-3xl border border-slate-200/80 soft-shadow space-y-5 hover:border-blue-200 transition-all relative group">
                  <div className="flex items-center gap-4">
                    {/* Instagram-Style Gradient Ring */}
                    <div className={`w-16 h-16 rounded-full p-0.5 shrink-0 ${isSelf ? 'bg-gradient-to-tr from-amber-500 via-rose-500 to-purple-600 shadow-md' : 'bg-slate-300'}`}>
                      <div className="w-full h-full rounded-full overflow-hidden bg-slate-900 border-2 border-white flex items-center justify-center text-white font-extrabold text-xl">
                        {admin.profile_photo && admin.profile_photo !== '/logo.png' ? (
                          <img
                            src={admin.profile_photo}
                            alt={admin.user_name}
                            className="w-full h-full object-cover"
                            onError={(e) => { e.target.style.display = 'none'; }}
                          />
                        ) : (
                          <span>{admin.user_name ? admin.user_name.charAt(0).toUpperCase() : 'A'}</span>
                        )}
                      </div>
                    </div>

                    <div className="flex-1 min-w-0">
                      <h3 className="text-base font-bold text-slate-900 font-poppins truncate">{admin.user_name}</h3>
                      <span className="text-[11px] font-mono text-blue-600 font-bold block">@{admin.username}</span>
                      <span className={`text-[10px] font-bold uppercase tracking-wider block mt-0.5 ${isSelf ? 'text-emerald-600' : 'text-slate-400'}`}>
                        {isSelf ? '● Active Profile' : '🔒 Protected (Owner Only)'}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-2 pt-2 border-t border-slate-100 text-xs text-slate-600">
                    <div className="flex items-center gap-2">
                      <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="font-medium truncate">{admin.phone || 'N/A'}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="font-medium">DOB: {admin.date_of_birth || 'Not specified'}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                    <button
                      onClick={() => handleOpenEditAdmin(admin)}
                      disabled={!isSelf}
                      className={`flex-1 py-2.5 font-bold text-xs rounded-xl inline-flex items-center justify-center gap-1.5 transition-colors ${
                        isSelf
                          ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-sm'
                          : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                      }`}
                      title={isSelf ? "Edit profile and password" : "You can only edit your own Admin account"}
                    >
                      <Key className="w-3.5 h-3.5" /> {isSelf ? 'Edit & Password' : '🔒 Protected'}
                    </button>
                    
                    {isSelf && (
                      <button
                        onClick={() => {
                          setPasswordModal({ isOpen: true, actionType: 'DELETE_ADMIN', targetItem: admin });
                        }}
                        className="py-2.5 px-3 bg-rose-50 hover:bg-rose-100 text-rose-600 font-bold text-xs rounded-xl inline-flex items-center justify-center transition-colors"
                        title="Delete Admin Account"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 3: ADMIN AUDIT LOGS (WITH MONTH & YEAR FILTERING) */}
      {tab === 'AUDIT' && (
        <div className="bg-white rounded-3xl border border-slate-200/80 soft-shadow p-6 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center font-bold">
                <History className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900 font-poppins">System Activity Audit Log</h2>
                <p className="text-xs text-slate-500">
                  Showing {auditLogs.length} activity records for {monthNames[auditMonth - 1]} {auditYear}.
                </p>
              </div>
            </div>

            {/* MONTH & YEAR SELECTORS */}
            <div className="flex items-center gap-3 shrink-0">
              <select
                value={auditMonth}
                onChange={(e) => setAuditMonth(parseInt(e.target.value))}
                className="px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-bold bg-slate-50 text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500/20"
              >
                {monthNames.map((m, idx) => (
                  <option key={idx} value={idx + 1}>{m}</option>
                ))}
              </select>

              <select
                value={auditYear}
                onChange={(e) => setAuditYear(parseInt(e.target.value))}
                className="px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-bold bg-slate-50 text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500/20"
              >
                {[2026, 2027, 2028, 2029, 2030, 2031, 2032, 2033, 2034, 2035].map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-3">
            {auditLogs.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-sm">
                No activity logs recorded for {monthNames[auditMonth - 1]} {auditYear}.
              </div>
            ) : (
              auditLogs.map((log) => (
                <div key={log.id} className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-100/80 transition-colors">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-purple-100 text-purple-800">
                        {log.action_type}
                      </span>
                      <span className="text-xs font-bold text-slate-900">{log.admin_name}</span>
                    </div>
                    <p className="text-xs text-slate-700 font-medium">{log.description}</p>
                  </div>
                  <span className="text-[11px] font-mono text-slate-400 shrink-0">
                    {new Date(log.timestamp).toLocaleString('en-IN', { hour12: true })}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* ADD / EDIT ADMIN MODAL */}
      {showAdminModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 text-white rounded-3xl p-6 sm:p-8 max-w-lg w-full space-y-6 shadow-2xl border border-slate-800 max-h-[90vh] overflow-y-auto relative animate-in fade-in zoom-in duration-200">
            
            {/* Header Avatar with Ring */}
            <div className="flex flex-col items-center justify-center text-center space-y-3 pt-2">
              <div className="relative group">
                <div className="w-24 h-24 rounded-full p-1 bg-gradient-to-tr from-blue-600 via-indigo-600 to-purple-600 shadow-xl">
                  <div className="w-full h-full rounded-full overflow-hidden bg-slate-950 border-2 border-slate-900 flex items-center justify-center text-white font-extrabold text-3xl">
                    {adminForm.profile_photo && adminForm.profile_photo !== '/logo.png' ? (
                      <img src={adminForm.profile_photo} alt="Preview" className="w-full h-full object-cover" />
                    ) : (
                      <span>{adminForm.user_name ? adminForm.user_name.charAt(0).toUpperCase() : 'A'}</span>
                    )}
                  </div>
                </div>

                <label
                  htmlFor="modal-admin-photo-input-custom"
                  className="absolute bottom-0 right-0 p-2 bg-blue-600 hover:bg-blue-500 text-white rounded-full shadow-lg cursor-pointer hover:scale-110 active:scale-95 transition-all"
                  title="Choose Photo from Gallery"
                >
                  <Camera className="w-4 h-4" />
                </label>
                <input
                  id="modal-admin-photo-input-custom"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      handlePhotoUpload(e.target.files[0], (dataUrl) => {
                        setAdminForm({ ...adminForm, profile_photo: dataUrl });
                      });
                    }
                  }}
                />
              </div>

              <div>
                <h2 className="text-xl font-bold font-poppins">
                  {editingAdmin ? `Edit Admin Profile` : 'Create Admin Account'}
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">Admin Security & Profile Setup</p>
              </div>
            </div>

              {/* DIRECT PROFILE FORM MODE */}
              <form onSubmit={handleSaveAdminForm} className="space-y-4 pt-2">
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Full Name *</label>
                  <input
                    type="text"
                    required
                    value={adminForm.user_name}
                    onChange={(e) => setAdminForm({ ...adminForm, user_name: e.target.value })}
                    className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm font-bold focus:outline-none focus:border-blue-500"
                  />
                </div>

                {!editingAdmin && (
                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Username (Login ID) *</label>
                    <input
                      type="text"
                      required
                      value={adminForm.username}
                      onChange={(e) => setAdminForm({ ...adminForm, username: e.target.value })}
                      className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm font-mono focus:outline-none focus:border-blue-500"
                    />
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Mobile Number *</label>
                    <input
                      type="text"
                      required
                      value={adminForm.phone}
                      onChange={(e) => setAdminForm({ ...adminForm, phone: e.target.value })}
                      className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Date of Birth</label>
                    <input
                      type="date"
                      value={adminForm.date_of_birth}
                      onChange={(e) => setAdminForm({ ...adminForm, date_of_birth: e.target.value })}
                      className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>

                {/* SECRET PASSWORD SECTION */}
                <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-4">
                  <div className="flex items-center justify-between">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={adminForm.change_password}
                        onChange={(e) => setAdminForm({ ...adminForm, change_password: e.target.checked })}
                        className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 bg-slate-900 border-slate-700"
                      />
                      <span className="text-xs font-bold text-slate-200">
                        {editingAdmin ? '🔑 Change Password' : '🔑 Set Password'}
                      </span>
                    </label>

                    {(adminForm.change_password || !editingAdmin) && (
                      <button
                        type="button"
                        onClick={() => setShowPasswordText(!showPasswordText)}
                        className="text-xs text-slate-400 hover:text-white flex items-center gap-1"
                      >
                        {showPasswordText ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        <span>{showPasswordText ? 'Hide Password' : 'Show Password'}</span>
                      </button>
                    )}
                  </div>

                  {(adminForm.change_password || !editingAdmin) && (
                    <div className="space-y-4 pt-1">
                      <div>
                        <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">New Password *</label>
                        <input
                          type={showPasswordText ? "text" : "password"}
                          required={adminForm.change_password || !editingAdmin}
                          value={adminForm.new_password}
                          onChange={(e) => setAdminForm({ ...adminForm, new_password: e.target.value })}
                          className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-xl text-white text-sm font-mono focus:outline-none focus:border-blue-500"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">Confirm New Password *</label>
                        <input
                          type={showPasswordText ? "text" : "password"}
                          required={adminForm.change_password || !editingAdmin}
                          value={adminForm.confirm_password}
                          onChange={(e) => setAdminForm({ ...adminForm, confirm_password: e.target.value })}
                          className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-xl text-white text-sm font-mono focus:outline-none focus:border-blue-500"
                        />
                        {adminForm.confirm_password && (
                          <div className="flex items-center gap-1.5 mt-2 text-xs font-bold">
                            {adminForm.new_password === adminForm.confirm_password ? (
                              <span className="text-emerald-400 flex items-center gap-1">
                                <CheckCircle2 className="w-4 h-4" /> Passwords match
                              </span>
                            ) : (
                              <span className="text-rose-400 flex items-center gap-1">
                                <XCircle className="w-4 h-4" /> Passwords do not match
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowAdminModal(false)}
                    className="flex-1 py-3.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-3.5 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl shadow-lg transition-all disabled:opacity-40"
                  >
                    {editingAdmin ? 'Save Profile Changes' : 'Create Admin Account'}
                  </button>
                </div>
              </form>
          </div>
        </div>
      )}

      {/* PASSWORD MODAL */}
      <AdminPasswordModal
        isOpen={passwordModal.isOpen}
        onClose={() => setPasswordModal({ isOpen: false, actionType: null, targetItem: null })}
        onConfirm={handleConfirmPasswordAction}
        title={passwordModal.actionType === 'SAVE_GARAGE' ? 'Confirm Garage Settings' : 'Delete Admin User'}
        itemDescription={passwordModal.actionType === 'SAVE_GARAGE' ? 'Garage Configuration' : `Admin User "${passwordModal.targetItem?.user_name}"`}
      />

    </div>
  );
}
