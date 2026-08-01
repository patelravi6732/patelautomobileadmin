import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Wrench, Calendar, Menu, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const location = useLocation();
  const { garageInfo } = useAuth();

  const navLinks = [
    { name: 'Home', path: '/' },
    { name: 'About Us', path: '/about' },
    { name: 'Services', path: '/services' },
    { name: 'Contact', path: '/contact' },
  ];

  const isActive = (path) => location.pathname === path;

  return (
    <nav className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-slate-200/80 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-20 items-center">
          
          {/* Logo */}
          <Link to="/" className="flex items-center gap-3 group">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-blue-600 to-blue-500 text-white flex items-center justify-center shadow-md shadow-blue-500/20 group-hover:scale-105 transition-transform duration-200">
              {garageInfo?.logo && garageInfo.logo !== '/logo.png' ? (
                <img src={garageInfo.logo} alt="Logo" className="w-full h-full object-cover rounded-xl" />
              ) : (
                <Wrench className="w-6 h-6 stroke-[2.5]" />
              )}
            </div>
            <div>
              <span className="text-xl font-bold text-slate-900 tracking-tight font-poppins block leading-none">
                {garageInfo?.garage_name || 'Patel Automobiles'}
              </span>
              <span className="text-xs font-medium text-orange-500 tracking-wide uppercase mt-1 block">
                Two-Wheeler Garage • Dandi, Valsad
              </span>
            </div>
          </Link>

          {/* Desktop Nav Links */}
          <div className="hidden md:flex items-center gap-8">
            {navLinks.map((link) => (
              <Link
                key={link.path}
                to={link.path}
                className={`text-sm font-semibold transition-colors duration-150 ${
                  isActive(link.path)
                    ? 'text-blue-600 font-bold'
                    : 'text-slate-600 hover:text-blue-600'
                }`}
              >
                {link.name}
              </Link>
            ))}
          </div>

          {/* Action Buttons */}
          <div className="hidden md:flex items-center gap-3">
            <Link
              to="/book-service"
              className="inline-flex items-center gap-2 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white text-sm font-semibold px-5 py-2.5 rounded-xl shadow-md shadow-orange-500/20 hover:shadow-lg hover:shadow-orange-500/30 transition-all duration-200 transform hover:-translate-y-0.5"
            >
              <Calendar className="w-4 h-4" />
              Book Service
            </Link>
          </div>

          {/* Mobile Menu Button */}
          <div className="md:hidden flex items-center gap-2">
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="p-2 rounded-xl text-slate-600 hover:bg-slate-100"
            >
              {isOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>

        </div>
      </div>

      {/* Mobile Menu Dropdown */}
      {isOpen && (
        <div className="md:hidden bg-white border-b border-slate-200 px-4 pt-2 pb-6 space-y-3">
          {navLinks.map((link) => (
            <Link
              key={link.path}
              to={link.path}
              onClick={() => setIsOpen(false)}
              className={`block px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
                isActive(link.path)
                  ? 'bg-blue-50 text-blue-600 font-bold'
                  : 'text-slate-700 hover:bg-slate-50'
              }`}
            >
              {link.name}
            </Link>
          ))}
          <div className="pt-2">
            <Link
              to="/book-service"
              onClick={() => setIsOpen(false)}
              className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-orange-500 to-amber-500 text-white text-sm font-semibold px-5 py-3 rounded-xl shadow-md"
            >
              <Calendar className="w-4 h-4" />
              Book Service
            </Link>
          </div>
        </div>
      )}
    </nav>
  );
}
