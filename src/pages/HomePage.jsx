import React from 'react';
import { Link } from 'react-router-dom';
import { 
  Wrench, ShieldCheck, Clock, Award, CheckCircle2, Calendar, 
  ArrowRight, PhoneCall, MapPin, Sparkles, Settings
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { getGarageExperienceYears } from '../utils/experienceCalculator';

export default function HomePage() {
  const { garageInfo } = useAuth();
  const expYears = getGarageExperienceYears();

  const whyUs = [
    { icon: ShieldCheck, title: "Genuine Spare Parts", desc: "100% original OEM & OES parts for all two-wheeler models." },
    { icon: Award, title: "Expert Mechanics", desc: `${expYears}+ years of experience in multi-brand two-wheeler diagnostics.` },
    { icon: Clock, title: "Fast Turnaround", desc: "Same-day periodic servicing & quick repair completion." },
    { icon: Sparkles, title: "Transparent Pricing", desc: "Clear itemized billing with zero hidden labor charges." }
  ];

  const services = [
    { title: "General Periodic Servicing", desc: "Engine oil change, air filter cleaning, chain lubrication, brake adjustments & 25-point inspection." },
    { title: "Engine Repair & Overhaul", desc: "Complete engine noise diagnosis, piston replacement, valve timing & clutch assembly repair." },
    { title: "Brake & Suspension Overhaul", desc: "Brake shoe/pad replacement, front fork oil seal changing, shock absorber servicing." },
    { title: "Electrical & Battery Checkup", desc: "Wiring harness inspection, starter motor repair, battery testing & headlight upgrades." }
  ];

  const steps = [
    { num: "01", title: "Book Appointment", desc: "Select your preferred date & time online or give us a call." },
    { num: "02", title: "Bike Inspection", desc: "Our expert mechanic performs a detailed diagnostic check." },
    { num: "03", title: "Expert Repairing", desc: "Staged repair with genuine parts and precision tuning." },
    { num: "04", title: "Test Ride & Handover", desc: "Quality test ride done and bike handed over clean & ready." }
  ];

  return (
    <div className="space-y-24 pb-16">
      
      {/* HERO SECTION WITH BLURRED GARAGE BACKGROUND THEME */}
      <section className="relative overflow-hidden bg-slate-950 text-white pt-20 pb-28 min-h-[550px] flex items-center">
        
        {/* Background Workshop Image with Subtle Blur & Overlay */}
        <div 
          className="absolute inset-0 bg-cover bg-center bg-no-repeat blur-[3px] scale-105 opacity-40"
          style={{ backgroundImage: `url('/garage_bg.png')` }}
        ></div>
        <div className="absolute inset-0 bg-gradient-to-r from-slate-950 via-slate-950/90 to-slate-900/80"></div>
        
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 z-10 w-full">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            
            <div className="lg:col-span-7 space-y-6 text-center lg:text-left">
              <div className="scroll-reveal-left inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold bg-orange-500/20 text-orange-300 border border-orange-500/30 backdrop-blur-md">
                <Sparkles className="w-4 h-4 text-orange-400" />
                Trusted Two-Wheeler Garage in Dandi, Valsad
              </div>

              <h1 className="scroll-reveal-left delay-100 text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight font-poppins text-white leading-tight">
                Complete Care For Your <span className="bg-clip-text text-transparent bg-gradient-to-r from-blue-400 via-sky-300 to-orange-400">Two-Wheeler</span>
              </h1>

              <p className="scroll-reveal-left delay-200 text-lg text-slate-300 max-w-2xl font-normal leading-relaxed">
                Professional motorcycle & scooter servicing, engine diagnostics, brake overhaul, and genuine spare parts replacement under one roof in Dandi, Valsad.
              </p>

              <div className="scroll-reveal-left delay-300 pt-4 flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
                <Link
                  to="/book-service"
                  className="inline-flex items-center justify-center gap-2 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white text-base font-bold px-8 py-4 rounded-xl shadow-lg shadow-orange-500/25 transition-all duration-200 transform hover:-translate-y-1 hover:scale-102"
                >
                  <Calendar className="w-5 h-5" />
                  Book Service Now
                </Link>
                <Link
                  to="/services"
                  className="inline-flex items-center justify-center gap-2 bg-slate-800/80 hover:bg-slate-800 text-slate-200 text-base font-semibold px-6 py-4 rounded-xl border border-slate-700 backdrop-blur-sm transition-all hover:scale-102"
                >
                  Explore Services
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>

              {/* Garage Metrics */}
              <div className="scroll-reveal-left delay-400 pt-8 border-t border-slate-800/80 grid grid-cols-2 gap-4 text-slate-400 text-xs sm:text-sm">
                <div className="p-3 rounded-2xl bg-slate-900/60 border border-slate-800/60 backdrop-blur-sm">
                  <span className="block text-xl font-bold text-white font-poppins">100% Genuine</span>
                  <span>Original Spare Parts</span>
                </div>
                <div className="p-3 rounded-2xl bg-slate-900/60 border border-slate-800/60 backdrop-blur-sm">
                  <span className="block text-xl font-bold text-white font-poppins">{expYears}+ Years</span>
                  <span>Garage Experience</span>
                </div>
              </div>
            </div>

            {/* Visual Hero Card with 3D Float */}
            <div className="lg:col-span-5 scroll-reveal-right">
              <div className="card-3d relative rounded-3xl bg-slate-900/90 border border-slate-700/80 p-8 shadow-2xl space-y-6 backdrop-blur-md">
                <div className="flex items-center justify-between border-b border-slate-700 pb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-blue-600/20 text-blue-400 flex items-center justify-center border border-blue-500/30">
                      <Settings className="w-6 h-6 animate-spin-slow" />
                    </div>
                    <div>
                      <h3 className="font-bold text-white text-base font-poppins">Patel Automobiles</h3>
                      <p className="text-xs text-slate-400">Near Dandi Pond, Dandi, Valsad</p>
                    </div>
                  </div>
                  <span className="px-3 py-1 rounded-full text-xs font-medium bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 animate-pulse">
                    Open Today
                  </span>
                </div>

                <div className="space-y-3">
                  <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 flex items-center justify-between">
                    <span className="text-xs text-slate-300 font-medium">Quick Periodic Service</span>
                    <span className="text-xs font-bold text-orange-400">~ 45 Mins</span>
                  </div>
                  <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 flex items-center justify-between">
                    <span className="text-xs text-slate-300 font-medium">Genuine Parts Stock</span>
                    <span className="text-xs font-bold text-emerald-400">Available</span>
                  </div>
                  <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 flex items-center justify-between">
                    <span className="text-xs text-slate-300 font-medium">Engine &amp; Brake Diagnostics</span>
                    <span className="text-xs font-bold text-sky-400">Available</span>
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-gradient-to-r from-blue-600/20 to-orange-500/20 border border-slate-700 text-center">
                  <p className="text-xs text-slate-300 mb-1">Direct Call Support</p>
                  <a href={`tel:${garageInfo?.phone}`} className="text-lg font-bold text-white hover:text-orange-400 transition-colors flex items-center justify-center gap-2">
                    <PhoneCall className="w-5 h-5 text-emerald-400" />
                    {garageInfo?.phone || '+91 81403 71414'}
                  </a>
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ABOUT GARAGE */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <div className="scroll-reveal-left space-y-6">
            <div className="inline-block px-3 py-1 rounded-md text-xs font-bold uppercase tracking-wider text-blue-600 bg-blue-50">
              About Our Garage
            </div>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 font-poppins leading-tight">
              Dandi, Valsad's Most Dependable Two-Wheeler Workshop
            </h2>
            <p className="text-slate-600 text-base leading-relaxed">
              At <strong>Patel Automobiles</strong>, located in Dandi, Valsad, Gujarat, we take pride in delivering top-grade motorcycle and scooter servicing. Founded with a commitment to honesty, expert craftsmanship, and genuine spare parts, our garage handles all major brands including Hero, Honda, Bajaj, TVS, Yamaha, Suzuki, and Royal Enfield.
            </p>
            <div className="space-y-3">
              {[
                "100% transparent live workshop billing & job cards",
                "Trained mechanics with deep expertise in engine tuning",
                "Advanced diagnostic tools for electrical & fuel system issues",
                "Dedicated customer service and instant WhatsApp payment support"
              ].map((item, idx) => (
                <div key={idx} className="flex items-center gap-3 text-slate-700 font-medium text-sm">
                  <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
                  <span>{item}</span>
                </div>
              ))}
            </div>
            <div className="pt-2">
              <Link to="/about" className="inline-flex items-center gap-2 font-bold text-blue-600 hover:text-blue-700">
                Read More About Us <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>

          <div className="scroll-reveal-right card-3d bg-gradient-to-br from-blue-50 to-orange-50 rounded-3xl p-8 border border-slate-200/80 shadow-sm space-y-6">
            <h3 className="text-xl font-bold text-slate-900 font-poppins">Garage Highlights</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white p-5 rounded-2xl border border-slate-200/60 shadow-xs hover:border-blue-300 transition-colors">
                <span className="text-3xl font-extrabold text-blue-600 font-poppins block">{expYears}+</span>
                <span className="text-xs font-semibold text-slate-500 uppercase mt-1 block">Years Experience</span>
              </div>
              <div className="bg-white p-5 rounded-2xl border border-slate-200/60 shadow-xs hover:border-orange-300 transition-colors">
                <span className="text-3xl font-extrabold text-orange-500 font-poppins block">500+</span>
                <span className="text-xs font-semibold text-slate-500 uppercase mt-1 block">Parts Inventory</span>
              </div>
              <div className="bg-white p-5 rounded-2xl border border-slate-200/60 shadow-xs hover:border-emerald-300 transition-colors">
                <span className="text-3xl font-extrabold text-emerald-600 font-poppins block">100%</span>
                <span className="text-xs font-semibold text-slate-500 uppercase mt-1 block">Genuine Spares</span>
              </div>
              <div className="bg-white p-5 rounded-2xl border border-slate-200/60 shadow-xs hover:border-purple-300 transition-colors">
                <span className="text-3xl font-extrabold text-purple-600 font-poppins block">Same Day</span>
                <span className="text-xs font-semibold text-slate-500 uppercase mt-1 block">Service Handover</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* WHY CHOOSE US */}
      <section className="bg-slate-100/80 py-20 border-y border-slate-200/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          <div className="scroll-reveal text-center space-y-4 max-w-2xl mx-auto">
            <span className="text-xs font-bold uppercase tracking-wider text-blue-600 bg-blue-50 px-3 py-1 rounded-md">Why Choose Patel Automobiles</span>
            <h2 className="text-3xl font-extrabold text-slate-900 font-poppins">Premium Quality &amp; Honest Care</h2>
            <p className="text-slate-600 text-sm">We combine traditional mechanics craftsmanship with modern garage management to ensure your vehicle performs at its absolute peak.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {whyUs.map((item, idx) => {
              const Icon = item.icon;
              return (
                <div key={idx} className={`scroll-reveal delay-${(idx + 1) * 100} card-3d bg-white p-8 rounded-2xl border border-slate-200/80 soft-shadow-hover space-y-4`}>
                  <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                    <Icon className="w-6 h-6" />
                  </div>
                  <h3 className="text-lg font-bold text-slate-900 font-poppins">{item.title}</h3>
                  <p className="text-slate-600 text-sm leading-relaxed">{item.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* SERVICES PREVIEW */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
        <div className="scroll-reveal flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-orange-500 bg-orange-50 px-3 py-1 rounded-md">Our Expertise</span>
            <h2 className="text-3xl font-extrabold text-slate-900 font-poppins mt-2">Popular Garage Services</h2>
          </div>
          <Link to="/services" className="inline-flex items-center gap-2 font-bold text-blue-600 hover:text-blue-700">
            View All Services <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {services.map((srv, idx) => (
            <div key={idx} className={`scroll-reveal delay-${(idx + 1) * 100} card-3d bg-white p-8 rounded-3xl border border-slate-200/80 soft-shadow flex flex-col justify-between space-y-6`}>
              <div className="space-y-3">
                <h3 className="text-xl font-bold text-slate-900 font-poppins">{srv.title}</h3>
                <p className="text-slate-600 text-sm leading-relaxed">{srv.desc}</p>
              </div>
              <Link to="/book-service" className="inline-flex items-center gap-2 text-sm font-bold text-orange-500 hover:text-orange-600">
                Book This Service <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* PROCESS SECTION */}
      <section className="bg-slate-900 text-white py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          <div className="scroll-reveal text-center max-w-2xl mx-auto space-y-4">
            <span className="text-xs font-bold uppercase tracking-wider text-blue-400 bg-blue-500/10 px-3 py-1 rounded-md border border-blue-500/20">How It Works</span>
            <h2 className="text-3xl font-extrabold font-poppins text-white">Simple &amp; Transparent Service Process</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            {steps.map((step, idx) => (
              <div key={idx} className={`scroll-reveal delay-${(idx + 1) * 100} card-3d bg-slate-800/80 p-6 rounded-2xl border border-slate-700/80 space-y-3`}>
                <span className="text-3xl font-extrabold text-blue-400 font-poppins block">{step.num}</span>
                <h3 className="text-lg font-bold text-white font-poppins">{step.title}</h3>
                <p className="text-slate-400 text-xs leading-relaxed">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CONTACT & MAP SECTION */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
        <div className="scroll-reveal card-3d-glow bg-gradient-to-r from-blue-900 to-slate-900 text-white rounded-3xl p-8 lg:p-12 shadow-xl grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <div className="space-y-6">
            <span className="px-3 py-1 rounded-md text-xs font-bold uppercase tracking-wider text-orange-400 bg-orange-500/20">Visit Our Garage</span>
            <h2 className="text-3xl font-extrabold font-poppins leading-tight">Conveniently Located In Dandi, Valsad</h2>
            <p className="text-slate-300 text-sm leading-relaxed">
              Drop by our garage for immediate diagnostic assistance or schedule a service online.
            </p>
            <div className="space-y-4 text-sm text-slate-300">
              <div className="flex items-start gap-3">
                <MapPin className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
                <span>{garageInfo?.address || 'Near Dandi Pond, Dandi, Valsad, Gujarat - 396385'}</span>
              </div>
              <div className="flex items-center gap-3">
                <PhoneCall className="w-5 h-5 text-emerald-400 shrink-0" />
                <span>{garageInfo?.phone || '+91 81403 71414'}</span>
              </div>
            </div>
            <div className="pt-2">
              <Link to="/book-service" className="inline-flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white font-bold px-6 py-3 rounded-xl shadow-md">
                Book Online Now
              </Link>
            </div>
          </div>

          <div className="h-72 rounded-2xl overflow-hidden border border-slate-700 shadow-inner">
            <iframe
              title="Patel Automobiles Dandi Valsad Google Maps Location"
              src="https://maps.google.com/maps?q=Dandi+Beach+Road,+Dandi,+Valsad,+Gujarat+396385&t=&z=14&ie=UTF8&iwloc=&output=embed"
              width="100%"
              height="100%"
              style={{ border: 0 }}
              allowFullScreen=""
              loading="lazy"
            ></iframe>
          </div>
        </div>
      </section>

    </div>
  );
}
