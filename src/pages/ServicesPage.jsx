import React from 'react';
import { Link } from 'react-router-dom';
import { Wrench, ShieldCheck, Zap, Cog, Sparkles, Check, ArrowRight } from 'lucide-react';

export default function ServicesPage() {
  const allServices = [
    {
      title: "General Periodic Servicing",
      features: [
        "Engine Oil Drain & Top-up",
        "Air Filter Cleaning / Replacement",
        "Spark Plug Checking & Cleaning",
        "Drive Chain Inspection, Tightening & Lubrication",
        "Front & Rear Brake Adjustment",
        "Battery Voltage Check",
        "25-Point Safety Inspection"
      ]
    },
    {
      title: "Engine Repair & Overhaul",
      features: [
        "Abnormal Engine Noise Diagnosis",
        "Cylinder Piston & Ring Replacement",
        "Valve Timing & Tappet Clearance Setting",
        "Clutch Plate & Hub Replacement",
        "Engine Gasket & Oil Seal Sealing",
        "Carburetor / FI Throttle Body Cleaning"
      ]
    },
    {
      title: "Brake & Suspension Servicing",
      features: [
        "Front Fork Shock Absorber Oil Changing",
        "Fork Oil Seal Replacement",
        "Disc Brake Pad & Fluid Replacement",
        "Drum Brake Shoe Sanding & Adjustment",
        "Rear Suspension Bushing Check"
      ]
    },
    {
      title: "Electrical & Battery Services",
      features: [
        "Wiring Harness Short Circuit Repair",
        "Self Starter Motor Repair & Carbon Check",
        "Ignition Coil & CDI Testing",
        "Battery Health & Charging Inspection",
        "Headlight & Indicator Switch Repairs"
      ]
    },
    {
      title: "Wheel & Tyre Fitment",
      features: [
        "Tubeless Tyre Puncture Repairs",
        "New Tyre Fitting & Valve Replacement",
        "Wheel Rim Alignment Check",
        "Wheel Axle Bearing Lubrication"
      ]
    },
    {
      title: "Full Bike Restoration",
      features: [
        "Complete Bike Disassembly & Chassis Check",
        "Engine Polish & Tuning",
        "All Cables & Harness Replacement",
        "Body Panel Fitting & Alignment",
        "Full Safety Certification"
      ]
    }
  ];

  return (
    <div className="py-16 space-y-16">
      
      <section className="scroll-reveal max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-4">
        <span className="px-3.5 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider text-orange-500 bg-orange-50">
          Complete Two-Wheeler Care
        </span>
        <h1 className="text-4xl font-extrabold text-slate-900 font-poppins">Our Garage Services</h1>
        <p className="text-slate-600 text-base max-w-2xl mx-auto">
          We service all major two-wheeler brands including Hero, Honda, Bajaj, TVS, Yamaha, Suzuki, and Royal Enfield in Dandi, Valsad.
        </p>
      </section>

      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {allServices.map((srv, idx) => (
            <div key={idx} className={`scroll-reveal delay-${((idx % 3) + 1) * 100} card-3d bg-white rounded-3xl p-8 border border-slate-200/80 soft-shadow flex flex-col justify-between space-y-6`}>
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                  <h3 className="text-xl font-bold text-slate-900 font-poppins">{srv.title}</h3>
                </div>
                
                <div className="space-y-2.5 pt-2">
                  {srv.features.map((feat, fidx) => (
                    <div key={fidx} className="flex items-start gap-2 text-xs text-slate-600">
                      <Check className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                      <span>{feat}</span>
                    </div>
                  ))}
                </div>
              </div>

              <Link
                to="/book-service"
                className="w-full text-center inline-flex items-center justify-center gap-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-sm py-3.5 rounded-xl transition-all hover:scale-102"
              >
                Book Appointment <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          ))}
        </div>
      </section>

    </div>
  );
}
