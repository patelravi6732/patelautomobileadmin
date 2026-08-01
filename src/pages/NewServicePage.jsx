import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { PlusCircle, User, Phone, Bike, UserCheck, Users } from 'lucide-react';
import API from '../services/api';
import { useAuth } from '../context/AuthContext';
import { pushCloudJob } from '../utils/cloudSync';

export default function NewServicePage() {
  const { garageInfo } = useAuth();
  const navigate = useNavigate();

  const [mechanicOptions, setMechanicOptions] = useState(['Unassigned', 'Amitbhai Mechanic', 'Vishalbhai Mechanic', 'Manojbhai Mechanic']);

  const [formData, setFormData] = useState({
    customer_name: '',
    mobile_number: '',
    vehicle_number: '',
    bike_model: '',
    complaint: '',
    assigned_mechanic: 'Unassigned',
    secondary_mechanic: '',
    labour_charge: 100.00
  });

  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (garageInfo?.mechanics_list) {
      const parsed = garageInfo.mechanics_list.split(',').map(m => m.trim()).filter(Boolean);
      if (parsed.length > 0) {
        setMechanicOptions(parsed);
        setFormData(prev => ({
          ...prev,
          labour_charge: garageInfo.default_labour_charge || 100.00
        }));
      }
    }
  }, [garageInfo]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const cleanPhone = (formData.mobile_number || '').replace(/\D/g, '');
    if (cleanPhone.length !== 10) {
      alert('Mobile number must be compulsory 10 digits.');
      return;
    }

    if (!formData.assigned_mechanic || formData.assigned_mechanic === 'Unassigned') {
      alert('⚠️ Compulsory Mechanic Assignment: Please select a valid mechanic (Amitbhai, Vishalbhai, or Manojbhai) for this service job!');
      return;
    }

    setLoading(true);

    const basePrefix = window.location.pathname.startsWith('/admin') ? '/admin' : '/app';
    const newJobObj = {
      ...formData,
      id: Date.now(),
      parts: [],
      parts_total: 0,
      live_total: parseFloat(formData.labour_charge || 100),
      status: 'IN_PROGRESS',
      created_at: new Date().toISOString()
    };

    pushCloudJob(newJobObj).catch(console.warn);

    const existingJobs = JSON.parse(localStorage.getItem('workshop_jobs') || '[]');
    existingJobs.push(newJobObj);
    localStorage.setItem('workshop_jobs', JSON.stringify(existingJobs));

    try {
      await API.post('/workshop/', formData);
    } catch (err) {
      console.warn('Backend API offline on static host, saved service job locally and pushed to cloud:', err);
    } finally {
      setLoading(false);
      alert('Service job created successfully!');
      navigate(`${basePrefix}/workshop`);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-8 relative">
      
      {/* Background Glow */}
      <div className="absolute -top-10 left-1/2 -translate-x-1/2 w-80 h-80 bg-blue-500/10 blur-[100px] rounded-full pointer-events-none"></div>

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 relative z-10">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 font-poppins">New Workshop Service Job</h1>
        </div>
        <span className="px-3.5 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider text-orange-600 bg-orange-50 border border-orange-200">
          Live Bay Entry
        </span>
      </div>

      {/* JOB CARD CONTAINER */}
      <div className="bg-white p-8 sm:p-10 rounded-3xl border border-slate-200/80 soft-shadow hover:shadow-2xl transition-all duration-300 relative z-10 space-y-8">
        
        <form onSubmit={handleSubmit} className="space-y-6">
          
          {/* Customer Information */}
          <div className="space-y-4">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <User className="w-4 h-4 text-blue-600" /> Customer Information
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Customer Name *</label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    value={formData.customer_name}
                    onChange={(e) => setFormData({ ...formData, customer_name: e.target.value })}
                    className="w-full pl-10 pr-4 py-3.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 text-sm font-medium transition-all shadow-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Mobile Number *</label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="tel"
                    required
                    maxLength={10}
                    minLength={10}
                    pattern="[0-9]{10}"
                    value={formData.mobile_number}
                    onChange={(e) => setFormData({ ...formData, mobile_number: e.target.value.replace(/\D/g, '').slice(0, 10) })}
                    className="w-full pl-10 pr-4 py-3.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 text-sm font-medium transition-all shadow-xs"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Vehicle Information */}
          <div className="space-y-4 pt-4 border-t border-slate-100">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <Bike className="w-4 h-4 text-orange-500" /> Vehicle Information
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Vehicle Number *</label>
                <input
                  type="text"
                  required
                  value={formData.vehicle_number}
                  onChange={(e) => setFormData({ ...formData, vehicle_number: e.target.value.toUpperCase() })}
                  className="w-full px-4 py-3.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 text-sm font-mono tracking-widest font-extrabold uppercase transition-all shadow-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Bike Model *</label>
                <input
                  type="text"
                  required
                  value={formData.bike_model}
                  onChange={(e) => setFormData({ ...formData, bike_model: e.target.value })}
                  className="w-full px-4 py-3.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 text-sm font-medium transition-all shadow-xs"
                />
              </div>
            </div>
          </div>

          {/* Workshop Assignment (Multi-Mechanic Support) */}
          <div className="space-y-4 pt-4 border-t border-slate-100">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <UserCheck className="w-4 h-4 text-purple-600" /> Mechanic Assignment & Rates (Dual Mechanic Support)
            </h3>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  Primary Mechanic (Fixed) *
                </label>
                <select
                  value={formData.assigned_mechanic}
                  onChange={(e) => setFormData({ ...formData, assigned_mechanic: e.target.value })}
                  className="w-full px-4 py-3.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600 text-sm font-medium transition-all shadow-xs"
                >
                  {mechanicOptions.map((mech) => (
                    <option key={mech} value={mech}>{mech}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  Secondary Mechanic (Optional)
                </label>
                <select
                  value={formData.secondary_mechanic}
                  onChange={(e) => setFormData({ ...formData, secondary_mechanic: e.target.value })}
                  className="w-full px-4 py-3.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600 text-sm font-medium transition-all shadow-xs"
                >
                  <option value="">-- None (Single Mechanic) --</option>
                  {mechanicOptions.map((mech) => (
                    <option key={mech} value={mech}>{mech}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Initial Labour Charge (₹) *</label>
              <input
                type="number"
                step="50"
                required
                value={formData.labour_charge}
                onChange={(e) => setFormData({ ...formData, labour_charge: parseFloat(e.target.value) || 0 })}
                className="w-full px-4 py-3.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 text-sm font-bold text-slate-900 transition-all shadow-xs"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full inline-flex items-center justify-center gap-2 bg-gradient-to-r from-blue-600 via-blue-700 to-indigo-700 hover:from-blue-700 hover:to-indigo-800 text-white font-extrabold py-4 rounded-2xl shadow-xl shadow-blue-600/30 hover:shadow-2xl hover:shadow-blue-600/40 text-base transition-all duration-300 hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50"
          >
            <PlusCircle className="w-5 h-5" />
            {loading ? 'Opening Job Card...' : 'Start Service & Send To Workshop Floor'}
          </button>

        </form>
      </div>

    </div>
  );
}
