import React from 'react';
import { Link } from 'react-router-dom';
import { Wrench, Phone, MapPin, Mail, Shield } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function Footer() {
  const { garageInfo } = useAuth();

  return (
    <footer className="bg-slate-900 text-slate-300 border-t border-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12">
          
          {/* Brand Col */}
          <div className="space-y-4 md:col-span-1">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold">
                <Wrench className="w-5 h-5" />
              </div>
              <span className="text-xl font-bold text-white tracking-tight font-poppins">
                {garageInfo?.garage_name || 'Patel Automobiles'}
              </span>
            </div>
            <p className="text-sm text-slate-400 leading-relaxed">
              Premium two-wheeler garage &amp; repair services in Dandi, Valsad, Gujarat. Engine overhauls, periodic maintenance, brake servicing &amp; genuine spare parts.
            </p>
            <div className="pt-2">
              <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <Shield className="w-3.5 h-3.5" /> 100% Genuine Spare Parts Guaranteed
              </span>
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="text-sm font-semibold text-white uppercase tracking-wider font-poppins mb-4">
              Quick Links
            </h3>
            <ul className="space-y-2.5 text-sm">
              <li><Link to="/" className="hover:text-white transition-colors">Home</Link></li>
              <li><Link to="/about" className="hover:text-white transition-colors">About Garage</Link></li>
              <li><Link to="/services" className="hover:text-white transition-colors">Services Offered</Link></li>
              <li><Link to="/contact" className="hover:text-white transition-colors">Contact Us</Link></li>
              <li><Link to="/book-service" className="text-orange-400 hover:text-orange-300 font-medium transition-colors">Book Service Appointment</Link></li>
            </ul>
          </div>

          {/* Contact Info */}
          <div>
            <h3 className="text-sm font-semibold text-white uppercase tracking-wider font-poppins mb-4">
              Contact Us
            </h3>
            <ul className="space-y-3 text-sm text-slate-400">
              <li className="flex items-start gap-3">
                <MapPin className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
                <span>{garageInfo?.address || 'Near Dandi Pond, Dandi, Valsad, Gujarat - 396385'}</span>
              </li>
              <li className="flex items-center gap-3">
                <Phone className="w-5 h-5 text-emerald-400 shrink-0" />
                <a href={`tel:${garageInfo?.phone}`} className="hover:text-white transition-colors">{garageInfo?.phone || '+91 81403 71414'}</a>
              </li>
            </ul>
          </div>

          {/* Working Hours */}
          <div>
            <h3 className="text-sm font-semibold text-white uppercase tracking-wider font-poppins mb-4">
              Garage Timings
            </h3>
            <p className="text-sm text-slate-300 font-medium leading-relaxed bg-slate-800/60 p-3 rounded-xl border border-slate-700/80">
              {garageInfo?.timing_text || 'Mon - Sat: 09:00 AM - 08:30 PM, Sun: 09:00 AM - 02:00 PM'}
            </p>
            <p className="pt-3 text-xs text-slate-400">
              Emergency Breakdown Assistance Available During Working Hours.
            </p>
          </div>

        </div>

        <div className="mt-12 pt-8 border-t border-slate-800 text-center text-xs text-slate-400">
          <p>© {new Date().getFullYear()} {garageInfo?.garage_name || 'Patel Automobiles'}, Dandi, Valsad, Gujarat. All Rights Reserved.</p>
        </div>
      </div>
    </footer>
  );
}
