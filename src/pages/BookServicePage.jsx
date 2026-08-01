import React, { useState } from 'react';
import { Calendar, Clock, Bike, User, Phone, AlertCircle, CheckCircle2, Wrench, Sparkles, ShieldCheck, ArrowRight } from 'lucide-react';
import API from '../services/api';
import { pushCloudBooking } from '../utils/cloudSync';

export default function BookServicePage() {
  const [formData, setFormData] = useState({
    customer_name: '',
    mobile_number: '',
    vehicle_number: '',
    bike_model: '',
    complaint: '',
    preferred_date: new Date().toISOString().split('T')[0],
    preferred_time: '10:00 AM'
  });

  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState(null);

  const complaintChips = [
    'Engine Oil Replacement & Tuning',
    'Tyre Replacement',
    'Puncture Repair',
    'Front & Rear Brake Inspection',
    'Chain Tightening & Lube',
    'Battery & Self Start Check',
    'Clutch & Throttle Cable Adjustment'
  ];

  const timeSlots = [
    '09:00 AM - 10:00 AM',
    '10:00 AM - 11:00 AM',
    '11:00 AM - 12:00 PM',
    '02:00 PM - 03:00 PM',
    '04:00 PM - 05:00 PM',
    '06:00 PM - 07:00 PM'
  ];
  const handleSubmit = async (e) => {
    e.preventDefault();
    const cleanPhone = (formData.mobile_number || '').replace(/\D/g, '');
    if (cleanPhone.length !== 10) {
      setError('Mobile number must be compulsory 10 digits.');
      return;
    }
    setLoading(true);
    setError(null);

    const newBookingObj = {
      ...formData,
      id: Date.now(),
      created_at: new Date().toISOString(),
      status: 'PENDING'
    };

    // Push to global cloud sync buffer so Admin receives booking from ANY device
    pushCloudBooking(newBookingObj).catch(console.warn);

    try {
      await API.post('/public/bookings/', formData);
    } catch (err) {
      console.warn('Backend API offline/unreachable on static host, saving booking locally:', err);
      const existing = JSON.parse(localStorage.getItem('local_bookings') || '[]');
      existing.push(newBookingObj);
      localStorage.setItem('local_bookings', JSON.stringify(existing));
    } finally {
      setLoading(false);
      setSuccess(true);
    }
  };

  return (
    <div className="py-10 max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8 relative">
      
      {/* Glow Effects */}
      <div className="absolute top-10 left-1/2 -translate-x-1/2 w-96 h-96 bg-blue-500/10 blur-[120px] rounded-full pointer-events-none"></div>
      <div className="absolute top-40 right-10 w-72 h-72 bg-orange-500/10 blur-[100px] rounded-full pointer-events-none"></div>

      {/* HEADER SECTION WITH 4-TYRE MECHANIC AVATAR */}
      <div className="scroll-reveal bg-white rounded-3xl p-6 border border-slate-200/80 shadow-lg flex flex-col sm:flex-row items-center gap-6 relative z-10">
        <div className="w-28 h-28 shrink-0 rounded-2xl overflow-hidden border-2 border-orange-500/30 shadow-md card-3d">
          <img 
            src="/mechanic_tyres.jpg" 
            alt="Patel Automobiles Two-Wheeler Mechanic Sitting on 4 Tyres"
            className="w-full h-full object-cover"
          />
        </div>
        <div className="space-y-2 text-center sm:text-left flex-1">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[11px] font-extrabold uppercase tracking-wider text-orange-600 bg-orange-50 border border-orange-200">
            <Sparkles className="w-3.5 h-3.5" /> Instant Bay Reservation
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 font-poppins tracking-tight">
            Book Garage Service
          </h1>
          <p className="text-slate-600 text-xs font-medium leading-relaxed">
            Reserve your slot at <strong>Patel Automobiles</strong> (Dandi, Valsad). Our mechanics keep a dedicated bay ready for your arrival.
          </p>
        </div>
      </div>

      {/* 3D GLASSMorphic CARD CONTAINER */}
      <div className="scroll-reveal delay-100 card-3d bg-white/90 backdrop-blur-xl p-6 sm:p-8 rounded-3xl border border-slate-200/80 shadow-xl hover:shadow-2xl transition-all duration-300 relative z-10">
        
        {success ? (
          <div className="py-12 text-center space-y-6">
            <div className="w-20 h-20 bg-gradient-to-tr from-emerald-500 to-teal-400 text-white rounded-3xl flex items-center justify-center mx-auto shadow-xl shadow-emerald-500/30 scale-105 animate-bounce">
              <CheckCircle2 className="w-10 h-10" />
            </div>
            <div className="space-y-2">
              <h2 className="text-3xl font-extrabold text-slate-900 font-poppins">Booking Confirmed!</h2>
              <p className="text-slate-600 text-sm max-w-md mx-auto font-medium">
                Thank you <strong>{formData.customer_name}</strong>. Your service reservation for bike <strong>{formData.vehicle_number}</strong> has been received.
              </p>
            </div>
            <div className="p-5 bg-gradient-to-r from-slate-900 to-slate-800 rounded-2xl text-xs text-white max-w-md mx-auto space-y-2 shadow-lg border border-slate-700 text-left">
              <div className="flex justify-between items-center border-b border-slate-700 pb-2">
                <span className="text-slate-400">Customer Name:</span>
                <span className="font-bold text-white">{formData.customer_name}</span>
              </div>
              <div className="flex justify-between items-center border-b border-slate-700 pb-2">
                <span className="text-slate-400">Vehicle Number:</span>
                <span className="font-mono font-bold text-amber-400">{formData.vehicle_number}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Date & Slot:</span>
                <span className="font-bold text-emerald-400">{formData.preferred_date} ({formData.preferred_time})</span>
              </div>
            </div>
            <div className="flex justify-center pt-2">
              <button
                onClick={() => {
                  setSuccess(false);
                  setFormData({
                    customer_name: '',
                    mobile_number: '',
                    vehicle_number: '',
                    bike_model: '',
                    complaint: '',
                    preferred_date: new Date().toISOString().split('T')[0],
                    preferred_time: '10:00 AM'
                  });
                }}
                className="inline-flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs sm:text-sm px-8 py-3.5 rounded-xl shadow-lg shadow-blue-600/30 transition-all hover:scale-105"
              >
                Book Another Service <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-10">
            
            {error && (
              <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-600 text-xs flex items-center gap-3">
                <AlertCircle className="w-5 h-5 shrink-0 text-red-500" />
                <span className="font-medium">{error}</span>
              </div>
            )}

            {/* STEP 1: CUSTOMER DETAILS */}
            <div className="space-y-5">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="text-lg font-bold text-slate-900 font-poppins flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center font-extrabold text-sm shadow-sm">
                    1
                  </div>
                  Customer Information
                </h3>
                <span className="text-xs font-semibold text-slate-400">Step 1 of 3</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Customer Name *
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      required
                      value={formData.customer_name}
                      onChange={(e) => setFormData({ ...formData, customer_name: e.target.value })}
                      className="w-full pl-10 pr-4 py-3.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-600 text-sm font-medium transition-all shadow-xs"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Mobile Number *
                  </label>
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
                      className="w-full pl-10 pr-4 py-3.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-600 text-sm font-medium transition-all shadow-xs"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* STEP 2: VEHICLE & SERVICE DETAILS */}
            <div className="space-y-5">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="text-lg font-bold text-slate-900 font-poppins flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-orange-100 text-orange-600 flex items-center justify-center font-extrabold text-sm shadow-sm">
                    2
                  </div>
                  Vehicle & Service Details
                </h3>
                <span className="text-xs font-semibold text-slate-400">Step 2 of 3</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Vehicle Registration Number *
                  </label>
                  <div className="relative">
                    <Bike className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      required
                      value={formData.vehicle_number}
                      onChange={(e) => setFormData({ ...formData, vehicle_number: e.target.value.toUpperCase() })}
                      className="w-full pl-10 pr-4 py-3.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500 text-sm font-mono tracking-widest font-extrabold uppercase transition-all shadow-xs"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Bike / Scooter Model *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.bike_model}
                    onChange={(e) => setFormData({ ...formData, bike_model: e.target.value })}
                    className="w-full px-4 py-3.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-600 text-sm font-medium transition-all shadow-xs"
                  />
                </div>
              </div>

              <div className="space-y-3">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Service Requirement / Complaint *
                </label>
                
                {/* QUICK CHIPS */}
                <div className="flex flex-wrap gap-2 mb-2">
                  {complaintChips.map((chip) => (
                    <button
                      type="button"
                      key={chip}
                      onClick={() => setFormData({ ...formData, complaint: chip })}
                      className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-orange-50 hover:text-orange-600 border border-slate-200 text-xs font-semibold text-slate-700 transition-all hover:scale-105 active:scale-95"
                    >
                      + {chip}
                    </button>
                  ))}
                </div>

                <textarea
                  rows={3}
                  required
                  value={formData.complaint}
                  onChange={(e) => setFormData({ ...formData, complaint: e.target.value })}
                  className="w-full px-4 py-3.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-600 text-sm font-medium transition-all shadow-xs"
                ></textarea>
              </div>
            </div>

            {/* STEP 3: SCHEDULE DATE & TIME */}
            <div className="space-y-5">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="text-lg font-bold text-slate-900 font-poppins flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center font-extrabold text-sm shadow-sm">
                    3
                  </div>
                  Schedule Preferred Bay Timing
                </h3>
                <span className="text-xs font-semibold text-slate-400">Step 3 of 3</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Preferred Date *
                  </label>
                  <div className="relative">
                    <Calendar className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="date"
                      required
                      min={new Date().toISOString().split('T')[0]}
                      value={formData.preferred_date}
                      onChange={(e) => setFormData({ ...formData, preferred_date: e.target.value })}
                      className="w-full pl-10 pr-4 py-3.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600 text-sm font-medium transition-all shadow-xs"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Preferred Time Slot *
                  </label>
                  <div className="relative">
                    <Clock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <select
                      value={formData.preferred_time}
                      onChange={(e) => setFormData({ ...formData, preferred_time: e.target.value })}
                      className="w-full pl-10 pr-4 py-3.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600 text-sm font-medium transition-all shadow-xs"
                    >
                      {timeSlots.map((slot, idx) => (
                        <option key={idx} value={slot}>{slot}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            </div>

            {/* SUBMIT BUTTON WITH GLOW & ANIMATION */}
            <button
              type="submit"
              disabled={loading}
              className="w-full inline-flex items-center justify-center gap-2 bg-gradient-to-r from-orange-500 via-amber-500 to-orange-600 hover:from-orange-600 hover:to-amber-600 text-white font-extrabold py-4 rounded-2xl shadow-xl shadow-orange-500/30 hover:shadow-2xl hover:shadow-orange-500/40 text-base transition-all duration-300 hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50"
            >
              <ShieldCheck className="w-5 h-5" />
              {loading ? 'Submitting Reservation...' : 'Confirm Service Booking'}
            </button>

          </form>
        )}

      </div>

    </div>
  );
}
