import React from 'react';
import { Link } from 'react-router-dom';
import { Wrench, ShieldCheck, CheckCircle, Zap, Sparkles, PhoneCall, Calendar, ArrowRight, Star, Clock } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { getGarageExperienceYears } from '../utils/experienceCalculator';

export default function AboutPage() {
  const { garageInfo } = useAuth();
  const expYears = getGarageExperienceYears();

  const customerPerks = [
    {
      icon: Zap,
      badge: "Express Bay",
      title: "45-Minute Quick Servicing",
      desc: "Instant periodic servicing with oil change, air filter cleaning, brake tuning, and 25-point inspection done while you wait.",
      color: "from-amber-500 to-orange-500"
    },
    {
      icon: ShieldCheck,
      badge: "100% Genuine",
      title: "Original Spare Parts Assurance",
      desc: "We exclusively fit 100% authentic OEM & OES spare parts for Hero, Honda, Bajaj, TVS, Yamaha, Suzuki, and Royal Enfield.",
      color: "from-blue-600 to-indigo-600"
    },
    {
      icon: Sparkles,
      badge: "WhatsApp Live Updates",
      title: "Live Photo & Repair Status",
      desc: "Receive real-time WhatsApp updates, photos of worn parts before replacement, and transparent itemized bills.",
      color: "from-emerald-500 to-teal-600"
    }
  ];

  return (
    <div className="py-16 space-y-16">
      
      {/* Header */}
      <section className="scroll-reveal max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-4">
        <span className="px-3.5 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider text-blue-600 bg-blue-50 border border-blue-200/80">
          Our Heritage &amp; Passion
        </span>
        <h1 className="text-4xl font-extrabold text-slate-900 font-poppins">
          About {garageInfo?.garage_name || 'Patel Automobiles'}
        </h1>
        <p className="text-slate-600 text-base max-w-2xl mx-auto">
          Providing Dandi, Valsad and surrounding coastal regions of Gujarat with top-quality two-wheeler maintenance and repair for over {expYears} years.
        </p>
      </section>

      {/* Main Story & Logo Image Display */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          
          <div className="scroll-reveal-left space-y-6">
            <h2 className="text-3xl font-extrabold text-slate-900 font-poppins leading-tight">
              Built On Trust, Precision &amp; Quality
            </h2>
            <p className="text-slate-600 text-sm leading-relaxed">
              Patel Automobiles was established in Dandi, Valsad, Gujarat with a singular vision: to bring honest, expert, and transparent garage services to every two-wheeler owner. Whether you ride a daily commuter scooter, a high-performance motorcycle, or a classic cruiser, our technicians treat every vehicle with extreme care.
            </p>
            <p className="text-slate-600 text-sm leading-relaxed">
              We understand that your motorcycle is your daily lifeline for work, travel, and freedom. That's why we enforce strict quality standards, use genuine manufacturer spare parts, and maintain live job cards.
            </p>
            
            <div className="pt-2">
              <div className="card-3d p-4 rounded-2xl bg-white border border-slate-200/80 soft-shadow flex items-center gap-3">
                <ShieldCheck className="w-8 h-8 text-blue-600 shrink-0" />
                <div>
                  <span className="font-bold text-slate-900 text-sm block">100% Genuine</span>
                  <span className="text-xs text-slate-500">Original OEM &amp; OES Spare Parts</span>
                </div>
              </div>
            </div>
          </div>

          {/* LOGO IMAGE DISPLAY CARD WITH 3D TILT */}
          <div className="scroll-reveal-right flex justify-center items-center">
            <div className="card-3d w-full max-w-md bg-slate-900 p-6 rounded-3xl border border-slate-800 shadow-2xl space-y-4 text-center">
              <div className="w-48 h-48 mx-auto rounded-2xl overflow-hidden border-2 border-amber-400/40 shadow-xl bg-slate-950">
                <img
                  src={garageInfo?.logo || '/patel_automobiles_logo.jpg'}
                  alt="Patel Automobiles Logo"
                  className="w-full h-full object-cover"
                />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white font-poppins">Patel Automobiles</h3>
                <p className="text-xs text-amber-400 font-medium mt-0.5">Dandi, Valsad, Gujarat</p>
              </div>
            </div>
          </div>

        </div>
      </section>

      {/* ORIGINAL 3 FEATURE CARDS */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
        
        <div className="scroll-reveal text-center space-y-3 max-w-2xl mx-auto">
          <span className="px-3.5 py-1.5 rounded-full text-xs font-extrabold uppercase tracking-wider text-orange-600 bg-orange-50 border border-orange-200">
            Why Bike Owners Choose Us
          </span>
          <h2 className="text-3xl font-extrabold text-slate-900 font-poppins">
            Why Bring Your Vehicle To Patel Automobiles?
          </h2>
          <p className="text-slate-600 text-sm">
            Experience smooth rides, better mileage, and complete peace of mind with Dandi's premier two-wheeler workshop.
          </p>
        </div>

        {/* Original 3 Feature Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-3 gap-6">
          {customerPerks.map((perk, idx) => {
            const Icon = perk.icon;
            return (
              <div key={idx} className={`scroll-reveal delay-${(idx + 1) * 100} card-3d bg-white rounded-3xl p-6 border border-slate-200/80 soft-shadow hover:shadow-xl transition-all duration-300 flex flex-col justify-between space-y-4 group`}>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${perk.color} text-white flex items-center justify-center shadow-md group-hover:scale-110 transition-transform`}>
                      <Icon className="w-6 h-6" />
                    </div>
                    <span className="text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-1 rounded-full bg-slate-100 text-slate-700">
                      {perk.badge}
                    </span>
                  </div>
                  <h3 className="text-lg font-bold text-slate-900 font-poppins leading-snug">{perk.title}</h3>
                  <p className="text-xs text-slate-600 leading-relaxed">{perk.desc}</p>
                </div>

                <div className="pt-2 border-t border-slate-100 flex items-center gap-1 text-[11px] font-bold text-blue-600">
                  <span>Guaranteed Quality</span>
                  <CheckCircle className="w-3.5 h-3.5 text-emerald-500 ml-auto" />
                </div>
              </div>
            );
          })}
        </div>

        {/* HIGH-IMPACT APPOINTMENT CTA BANNER */}
        <div className="scroll-reveal card-3d-glow bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-950 text-white rounded-3xl p-8 sm:p-12 shadow-2xl relative overflow-hidden flex flex-col lg:flex-row items-center justify-between gap-8 border border-blue-800/50">
          <div className="space-y-3 text-center lg:text-left z-10 max-w-xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold bg-amber-400/20 text-amber-300 border border-amber-400/30">
              <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" /> Rated #1 Two-Wheeler Workshop in Dandi
            </div>
            <h3 className="text-2xl sm:text-3xl font-extrabold font-poppins text-white leading-tight">
              Ready to Give Your Bike Superior Performance &amp; Mileage?
            </h3>
            <p className="text-slate-300 text-xs sm:text-sm leading-relaxed">
              Book your appointment online in under 30 seconds or call our master workshop directly for instant bay allocation!
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-4 shrink-0 z-10 w-full sm:w-auto">
            <Link
              to="/book-service"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-extrabold text-sm px-7 py-4 rounded-2xl shadow-lg shadow-orange-500/30 transition-all hover:scale-105 active:scale-95"
            >
              <Calendar className="w-5 h-5" /> Book Service Appointment <ArrowRight className="w-4 h-4" />
            </Link>

            <a
              href={`tel:${garageInfo?.phone || '+918140371414'}`}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-white/10 hover:bg-white/20 text-white font-bold text-sm px-6 py-4 rounded-2xl border border-white/20 backdrop-blur-sm transition-all"
            >
              <PhoneCall className="w-4 h-4 text-emerald-400" />
              {garageInfo?.phone || '+91 81403 71414'}
            </a>
          </div>
        </div>

      </section>

    </div>
  );
}
