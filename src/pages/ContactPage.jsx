import React, { useState } from 'react';
import { MapPin, Phone, Mail, Clock, Send, CheckCircle2, Sparkles, MessageSquare, ArrowRight } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

import API from '../services/api';
import { pushCloudMessage } from '../utils/cloudSync';

export default function ContactPage() {
  const { garageInfo } = useAuth();
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    message: ''
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    const cleanPhone = (formData.phone || '').replace(/\D/g, '');
    if (cleanPhone.length !== 10) {
      setError('Phone number must be compulsory 10 digits.');
      return;
    }
    setLoading(true);
    setError(null);
    const nowTime = new Date().toISOString();
    const newMsgObj = {
      id: `msg_${Date.now()}`,
      name: formData.name || 'Valued Customer',
      customer_name: formData.name || 'Valued Customer',
      email: formData.email || '',
      phone: formData.phone || '',
      mobile_number: formData.phone || '',
      message: formData.message || '',
      inquiry: formData.message || '',
      created_at: nowTime,
      date: nowTime,
      is_read: false
    };
    const existing = JSON.parse(localStorage.getItem('local_messages') || localStorage.getItem('contact_messages') || '[]');
    const updatedMessages = [newMsgObj, ...existing];
    localStorage.setItem('local_messages', JSON.stringify(updatedMessages));
    localStorage.setItem('contact_messages', JSON.stringify(updatedMessages));

    try {
      await pushCloudMessage(newMsgObj);
    } catch (err) {
      console.warn('Cloud sync contact message notice:', err);
    }

    try {
      await API.post('/public/contact/', formData);
    } catch (apiErr) {
      console.warn('Backend API offline for contact submission:', apiErr);
    }

    const ownerPhone = '918140371414';
    const waText = encodeURIComponent(
      `💬 *NEW WEBSITE CONTACT INQUIRY (Patel Automobiles)*\n\n` +
      `👤 *Name:* ${formData.name}\n` +
      `📱 *Phone:* ${formData.phone}\n` +
      `📧 *Email:* ${formData.email || 'N/A'}\n` +
      `📝 *Message:* ${formData.message}`
    );
    window.open(`https://wa.me/${ownerPhone}?text=${waText}`, '_blank');

    setLoading(false);
    setSubmitted(true);
  };

  return (
    <div className="py-16 space-y-16 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
      
      {/* Glow Effects */}
      <div className="absolute top-10 left-1/3 w-96 h-96 bg-blue-500/10 blur-[130px] rounded-full pointer-events-none"></div>
      <div className="absolute bottom-10 right-10 w-80 h-80 bg-orange-500/10 blur-[110px] rounded-full pointer-events-none"></div>

      {/* HEADER SECTION */}
      <div className="scroll-reveal text-center space-y-4 relative z-10">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-extrabold uppercase tracking-wider text-blue-600 bg-gradient-to-r from-blue-500/10 to-indigo-500/10 border border-blue-500/20 shadow-sm animate-pulse">
          <Sparkles className="w-3.5 h-3.5" /> 24/7 Breakdown & Inquiry Support
        </div>
        <h1 className="text-4xl sm:text-5xl font-black text-slate-900 font-poppins tracking-tight">
          Get In Touch With {garageInfo?.garage_name || 'Patel Automobiles'}
        </h1>
        <p className="text-slate-600 text-sm max-w-xl mx-auto font-medium">
          Have an inquiry, custom restoration request, or need breakdown support in Dandi, Valsad? Reach out to our expert mechanics anytime.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 relative z-10">
        
        {/* CONTACT INFO CARDS WITH 3D GLASSMorphic STYLING */}
        <div className="scroll-reveal-left lg:col-span-5 space-y-6">
          <div className="card-3d bg-white/90 backdrop-blur-xl p-8 rounded-3xl border border-slate-200/80 shadow-2xl hover:shadow-3xl transition-all duration-300 space-y-6">
            <h2 className="text-xl font-extrabold text-slate-900 font-poppins flex items-center gap-2.5">
              <MessageSquare className="w-5 h-5 text-blue-600" /> Garage Information
            </h2>
            
            <div className="space-y-6 text-sm">
              
              <div className="flex items-start gap-4 p-3 rounded-2xl hover:bg-blue-50/50 transition-colors group">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-blue-600 to-blue-500 text-white flex items-center justify-center shrink-0 shadow-lg shadow-blue-500/30 group-hover:scale-110 transition-transform">
                  <MapPin className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 font-poppins">Garage Address</h3>
                  <p className="text-slate-600 mt-1 text-xs leading-relaxed">
                    {garageInfo?.address || 'Near Dandi Pond, Dandi, Valsad, Gujarat - 396385'}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-4 p-3 rounded-2xl hover:bg-emerald-50/50 transition-colors group">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white flex items-center justify-center shrink-0 shadow-lg shadow-emerald-500/30 group-hover:scale-110 transition-transform">
                  <Phone className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 font-poppins">Phone & Helpline</h3>
                  <a href={`tel:${garageInfo?.phone}`} className="text-slate-700 hover:text-blue-600 text-xs font-semibold mt-1 block">
                    {garageInfo?.phone || '+91 81403 71414'}
                  </a>
                </div>
              </div>

              <div className="flex items-start gap-4 p-3 rounded-2xl hover:bg-purple-50/50 transition-colors group">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-purple-600 to-indigo-500 text-white flex items-center justify-center shrink-0 shadow-lg shadow-purple-500/30 group-hover:scale-110 transition-transform">
                  <Clock className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 font-poppins">Workshop Hours</h3>
                  <p className="text-slate-600 text-xs mt-1 leading-relaxed">
                    {garageInfo?.timing_text || 'Mon - Sat: 08:30 AM - 06:30 PM, Sun: 09:00 AM - 02:00 PM'}
                  </p>
                </div>
              </div>

            </div>
          </div>

          {/* GOOGLE MAPS EMBED WITH GLASS CONTAINER */}
          <div className="card-3d h-64 rounded-3xl overflow-hidden border border-slate-200/80 shadow-xl hover:shadow-2xl transition-all duration-300 relative group">
            <iframe
              title="Garage Location Dandi Valsad"
              src="https://maps.google.com/maps?q=Dandi+Beach+Road,+Dandi,+Valsad,+Gujarat+396385&t=&z=14&ie=UTF8&iwloc=&output=embed"
              width="100%"
              height="100%"
              style={{ border: 0 }}
              allowFullScreen=""
              loading="lazy"
            ></iframe>
          </div>
        </div>

        {/* 3D CONTACT FORM */}
        <div className="scroll-reveal-right lg:col-span-7">
          <div className="card-3d bg-white/90 backdrop-blur-xl p-8 sm:p-12 rounded-3xl border border-slate-200/80 shadow-2xl hover:shadow-3xl transition-all duration-300">
            <h2 className="text-2xl font-extrabold text-slate-900 font-poppins mb-6">Send Us A Message</h2>

            {submitted ? (
              <div className="py-12 text-center space-y-6">
                <div className="w-20 h-20 bg-gradient-to-tr from-emerald-500 to-teal-400 text-white rounded-3xl flex items-center justify-center mx-auto shadow-xl shadow-emerald-500/30 animate-bounce">
                  <CheckCircle2 className="w-10 h-10" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-2xl font-extrabold text-slate-900 font-poppins">Message Sent Successfully!</h3>
                  <p className="text-slate-600 text-sm max-w-md mx-auto font-medium">
                    Thank you <strong>{formData.name}</strong>. Our garage manager at Patel Automobiles (Dandi, Valsad) will get back to you shortly.
                  </p>
                </div>
                <button
                  onClick={() => {
                    setSubmitted(false);
                    setFormData({ name: '', phone: '', message: '' });
                  }}
                  className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm px-8 py-3 rounded-xl shadow-lg shadow-blue-600/30 transition-all hover:scale-105"
                >
                  Send Another Message <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-6">
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">Your Name *</label>
                    <input
                      type="text"
                      required
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full px-4 py-3.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-600 text-sm font-medium transition-all shadow-xs"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">Phone Number *</label>
                    <input
                      type="tel"
                      required
                      maxLength={10}
                      minLength={10}
                      pattern="[0-9]{10}"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value.replace(/\D/g, '').slice(0, 10) })}
                      className="w-full px-4 py-3.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-600 text-sm font-medium transition-all shadow-xs"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">Your Message / Inquiry *</label>
                  <textarea
                    rows={4}
                    required
                    value={formData.message}
                    onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                    className="w-full px-4 py-3.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-600 text-sm font-medium transition-all shadow-xs"
                  ></textarea>
                </div>

                {error && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-600 font-medium">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full inline-flex items-center justify-center gap-2 bg-gradient-to-r from-blue-600 via-blue-700 to-indigo-700 hover:from-blue-700 hover:to-indigo-800 text-white font-extrabold py-4 rounded-2xl shadow-xl shadow-blue-600/30 hover:shadow-2xl hover:shadow-blue-600/40 text-base transition-all duration-300 hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50"
                >
                  <Send className="w-5 h-5" /> {loading ? 'Sending Message...' : 'Send Message Now'}
                </button>

              </form>
            )}
          </div>
        </div>

      </div>

    </div>
  );
}
