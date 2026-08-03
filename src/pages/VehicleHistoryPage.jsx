import React, { useState } from 'react';
import { Search, Bike, Calendar, CheckCircle2, ShieldCheck, Wrench, Clock, FileText, Sparkles, AlertCircle, ArrowRight, Phone, User, Lock } from 'lucide-react';
import API from '../services/api';
import { useAuth } from '../context/AuthContext';
import { fetchCloudJobs, fetchCloudBookings, fetchCloudInvoices, fetchCloudDeletedIds, fetchCloudKhataEntries } from '../utils/cloudSync';
import { formatDateDMY } from '../utils/dateFormatter';

export default function VehicleHistoryPage() {
  const { garageInfo } = useAuth();
  const [vehicleNumber, setVehicleNumber] = useState('');
  const [searched, setSearched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [historyData, setHistoryData] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);

  // Date Filter States
  const [datePreset, setDatePreset] = useState('ALL'); // 'ALL', 'TODAY', 'THIS_MONTH', 'CUSTOM'
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const handleSearch = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (!vehicleNumber.trim()) {
      setErrorMsg('Please enter your vehicle / bike registration number.');
      return;
    }

    setLoading(true);
    setSearched(true);
    setErrorMsg(null);

    const cleanInputVeh = vehicleNumber.replace(/[^A-Za-z0-9]/g, '').toUpperCase();

    let backendData = null;
    try {
      const res = await API.get(`/vehicle-history/?vehicle_number=${encodeURIComponent(vehicleNumber.trim())}`, { timeout: 1500 });
      backendData = res.data;
    } catch (err) {
      console.warn('Backend API offline or 404 for vehicle history, falling back to local memory & cloud stores:', err);
    }

    if (backendData && backendData.service_history && backendData.service_history.length > 0) {
      setHistoryData({
        vehicle_number: vehicleNumber.toUpperCase(),
        customer_name: backendData.customer?.customer_name || 'Valued Rider',
        bike_model: backendData.service_history[0]?.bike_model || 'Two Wheeler',
        previous_services: backendData.service_history
      });
      setLoading(false);
      return;
    }

    // Comprehensive Fallback Search across Local & Cloud Store
    const deletedIds = await fetchCloudDeletedIds().catch(() => []);

    const allJobs = JSON.parse(localStorage.getItem('workshop_jobs') || '[]');
    const cloudJobs = await fetchCloudJobs().catch(() => []);
    const combinedJobs = [...allJobs, ...cloudJobs];

    const localInvoices = JSON.parse(localStorage.getItem('local_invoices') || '[]');
    const cloudInvoices = await fetchCloudInvoices().catch(() => []);
    const combinedInvoices = [...localInvoices, ...cloudInvoices];

    const localKhata = JSON.parse(localStorage.getItem('khata_entries') || '[]');
    const cloudKhata = await fetchCloudKhataEntries().catch(() => []);
    const combinedKhata = [...localKhata, ...cloudKhata];

    const localBookings = JSON.parse(localStorage.getItem('local_bookings') || '[]');
    const cloudBookings = await fetchCloudBookings().catch(() => []);
    const combinedBookings = [...localBookings, ...cloudBookings];

    const matchedJobs = combinedJobs.filter(j => {
      if (!j || deletedIds.includes(String(j.id))) return false;
      const jVeh = (j.vehicle_number || '').replace(/[^A-Za-z0-9]/g, '').toUpperCase();
      return Boolean(jVeh && cleanInputVeh && (jVeh === cleanInputVeh || jVeh.includes(cleanInputVeh) || cleanInputVeh.includes(jVeh)));
    });

    const matchedInvs = combinedInvoices.filter(i => {
      if (!i || deletedIds.includes(String(i.id))) return false;
      const iVeh = (i.vehicle_number || '').replace(/[^A-Za-z0-9]/g, '').toUpperCase();
      return Boolean(iVeh && cleanInputVeh && (iVeh === cleanInputVeh || iVeh.includes(cleanInputVeh) || cleanInputVeh.includes(iVeh)));
    });

    const matchedKhata = combinedKhata.filter(k => {
      if (!k || deletedIds.includes(String(k.id))) return false;
      const kVeh = (k.vehicle_number || '').replace(/[^A-Za-z0-9]/g, '').toUpperCase();
      return Boolean(kVeh && cleanInputVeh && (kVeh === cleanInputVeh || kVeh.includes(cleanInputVeh) || cleanInputVeh.includes(kVeh)));
    });

    const matchedBookings = combinedBookings.filter(b => {
      if (!b || deletedIds.includes(String(b.id))) return false;
      const bVeh = (b.vehicle_number || '').replace(/[^A-Za-z0-9]/g, '').toUpperCase();
      return Boolean(bVeh && cleanInputVeh && (bVeh === cleanInputVeh || bVeh.includes(cleanInputVeh) || cleanInputVeh.includes(bVeh)));
    });

    if (matchedJobs.length === 0 && matchedInvs.length === 0 && matchedKhata.length === 0 && matchedBookings.length === 0) {
      setHistoryData(null);
      setErrorMsg(`No service history records found matching vehicle ${vehicleNumber.toUpperCase()}. Please verify details.`);
      setLoading(false);
      return;
    }

    const firstMatch = matchedJobs[0] || matchedInvs[0] || matchedKhata[0] || matchedBookings[0];
    const customerName = firstMatch.customer_name || 'Valued Rider';
    const bikeModel = firstMatch.bike_model || 'Two Wheeler';

    const timelineHistory = [...matchedJobs, ...matchedInvs, ...matchedKhata].map((item, idx) => {
      const labour = parseFloat(item.labour_charge || 100);
      const partsVal = parseFloat(item.parts_total || 0);
      const totalBill = parseFloat(item.grand_total || item.live_total || item.total_amount || (partsVal + labour));
      return {
        id: item.id || `hist_${idx}`,
        created_at: item.finished_at || item.created_at || item.date || new Date().toISOString(),
        date: item.date || (item.created_at ? item.created_at.split('T')[0] : new Date().toISOString().split('T')[0]),
        job_card_number: item.job_card_number || item.invoice_number || `JC-${idx + 101}`,
        vehicle_model: item.bike_model || bikeModel,
        complaint: item.complaint || item.complaint_details || 'General Service & Maintenance',
        assigned_mechanic: item.assigned_mechanic || 'Master Technician',
        labour_charge: labour,
        parts_total: partsVal,
        live_total: totalBill,
        status: item.status || 'FINISHED',
        parts: item.parts || []
      };
    });

    setHistoryData({
      vehicle_number: vehicleNumber.toUpperCase(),
      customer_name: customerName,
      bike_model: bikeModel,
      previous_services: timelineHistory
    });
    setLoading(false);
  };

  // Filter Timeline History by Date Presets
  const filteredServices = React.useMemo(() => {
    if (!historyData || !historyData.previous_services) return [];
    const list = historyData.previous_services;
    const now = new Date();

    return list.filter(item => {
      const itemDateStr = item.date || (item.created_at ? item.created_at.split('T')[0] : '');
      if (!itemDateStr) return true;

      if (datePreset === 'TODAY') {
        const todayStr = now.toISOString().split('T')[0];
        return itemDateStr === todayStr;
      } else if (datePreset === 'THIS_MONTH') {
        const itemD = new Date(itemDateStr);
        return itemD.getMonth() === now.getMonth() && itemD.getFullYear() === now.getFullYear();
      } else if (datePreset === 'CUSTOM') {
        if (startDate && itemDateStr < startDate) return false;
        if (endDate && itemDateStr > endDate) return false;
        return true;
      }
      return true;
    });
  }, [historyData, datePreset, startDate, endDate]);

  return (
    <div className="py-12 space-y-12 max-w-5xl mx-auto px-4 sm:px-6">
      
      {/* PAGE HEADER */}
      <div className="text-center space-y-4 max-w-2xl mx-auto">
        <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 border border-emerald-200">
          <Lock className="w-4 h-4 text-emerald-600" /> Instant Bike Registration Search
        </span>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 font-poppins">
          Vehicle Service History Search
        </h1>
        <p className="text-slate-600 text-sm">
          Enter your bike registration plate number to instantly view complete service timeline, replaced parts & digital invoices.
        </p>
      </div>

      {/* SEARCH FORM (ONLY BIKE REGISTRATION NUMBER) */}
      <div className="max-w-xl mx-auto">
        <form onSubmit={handleSearch} className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200/80 soft-shadow space-y-5">
          
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <span className="text-xs font-extrabold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
              <Bike className="w-4 h-4 text-amber-500" /> Bike Passport Search
            </span>
            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
              🔒 Instant Access
            </span>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                Enter Bike Registration Number *
              </label>
              <div className="bg-amber-400 p-1.5 rounded-2xl border-2 border-slate-900 shadow-sm">
                <div className="bg-white rounded-xl px-4 py-2.5 flex items-center gap-3 border border-amber-500">
                  <span className="text-[11px] font-black tracking-tighter text-blue-900 border-r border-slate-200 pr-2.5 flex items-center gap-1">
                    🇮🇳 IND
                  </span>
                  <input
                    type="text"
                    required
                    placeholder="e.g. GJ15XX1234"
                    value={vehicleNumber}
                    onChange={(e) => setVehicleNumber(e.target.value.toUpperCase())}
                    className="w-full text-base font-black text-slate-900 tracking-wider uppercase focus:outline-none font-mono"
                  />
                </div>
              </div>
            </div>
          </div>

          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs font-bold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              {errorMsg}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-4 bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-sm rounded-2xl shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            {loading ? (
              <span>Searching Vehicle Passport...</span>
            ) : (
              <>
                <Search className="w-4 h-4 text-amber-400" /> Search Service History
              </>
            )}
          </button>
        </form>
      </div>

      {/* SEARCH RESULTS */}
      {searched && (
        <div className="space-y-8">
          {loading ? (
            <div className="bg-white p-12 rounded-3xl border border-slate-200 text-center space-y-3">
              <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
              <p className="text-sm font-bold text-slate-600">Fetching verified service records from database...</p>
            </div>
          ) : !historyData || (!historyData.previous_services?.length && !historyData.previous_bills?.length) ? (
            <div className="bg-white p-10 rounded-3xl border border-slate-200 text-center space-y-4 soft-shadow">
              <AlertCircle className="w-12 h-12 text-amber-500 mx-auto" />
              <div className="space-y-1">
                <h3 className="text-lg font-bold text-slate-900 font-poppins">No Service Record Found for '{vehicleNumber}'</h3>
                <p className="text-xs text-slate-500 max-w-md mx-auto">
                  We couldn't find any completed service job or invoice registered under this vehicle number. Please verify your vehicle plate number or contact Patel Automobiles workshop directly.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-8 animate-in fade-in duration-300">
              
              {/* MAIN EXECUTIVE VEHICLE HEALTH PASSPORT CARD (DARK GLASSMORPHIC) */}
              <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-950 text-white rounded-3xl p-6 sm:p-8 shadow-2xl space-y-8 border border-slate-800">
                
                {/* Header Top Strip */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-700/80 pb-6">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="px-3 py-1 rounded-full text-[10px] font-extrabold uppercase bg-amber-400/20 text-amber-300 border border-amber-400/30">
                        ● Patel Automobiles Verified
                      </span>
                      <span className="text-xs text-slate-400 font-mono">Dandi, Valsad</span>
                    </div>
                    <h2 className="text-2xl sm:text-3xl font-extrabold font-mono text-amber-400 tracking-wider">
                      {historyData.vehicle_number}
                    </h2>
                  </div>

                  <div className="text-left sm:text-right">
                    <span className="text-xs text-slate-400 font-medium block">Owner / Customer</span>
                    <span className="text-lg font-bold text-white font-poppins block">
                      {historyData.customer?.customer_name || historyData.previous_services[0]?.customer_name || 'Valued Rider'}
                    </span>
                  </div>
                </div>

                {/* DATE FILTER BAR */}
                <div className="bg-slate-900/90 p-4 rounded-2xl border border-slate-700/80 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <span className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                      <Calendar className="w-4 h-4 text-amber-400" /> Filter Service Records by Date
                    </span>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => setDatePreset('ALL')}
                        className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer ${
                          datePreset === 'ALL' ? 'bg-amber-400 text-slate-950 font-black shadow-md' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                        }`}
                      >
                        All Dates ({historyData.previous_services?.length || 0})
                      </button>
                      <button
                        type="button"
                        onClick={() => setDatePreset('TODAY')}
                        className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer ${
                          datePreset === 'TODAY' ? 'bg-amber-400 text-slate-950 font-black shadow-md' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                        }`}
                      >
                        Today
                      </button>
                      <button
                        type="button"
                        onClick={() => setDatePreset('THIS_MONTH')}
                        className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer ${
                          datePreset === 'THIS_MONTH' ? 'bg-amber-400 text-slate-950 font-black shadow-md' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                        }`}
                      >
                        This Month
                      </button>
                      <button
                        type="button"
                        onClick={() => setDatePreset('CUSTOM')}
                        className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer ${
                          datePreset === 'CUSTOM' ? 'bg-amber-400 text-slate-950 font-black shadow-md' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                        }`}
                      >
                        Specific Date Range 📅
                      </button>
                    </div>
                  </div>

                  {datePreset === 'CUSTOM' && (
                    <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-slate-800 text-xs">
                      <div className="flex items-center gap-2">
                        <span className="text-slate-400 font-bold">From Date:</span>
                        <input
                          type="date"
                          value={startDate}
                          onChange={(e) => setStartDate(e.target.value)}
                          className="bg-slate-950 text-amber-300 px-3 py-1.5 rounded-xl border border-slate-700 font-mono font-bold focus:outline-none"
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-slate-400 font-bold">To Date:</span>
                        <input
                          type="date"
                          value={endDate}
                          onChange={(e) => setEndDate(e.target.value)}
                          className="bg-slate-950 text-amber-300 px-3 py-1.5 rounded-xl border border-slate-700 font-mono font-bold focus:outline-none"
                        />
                      </div>
                      {(startDate || endDate) && (
                        <button
                          type="button"
                          onClick={() => { setStartDate(''); setEndDate(''); }}
                          className="text-amber-400 underline font-bold hover:text-amber-300 cursor-pointer"
                        >
                          Clear Dates
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* SERVICE TIMELINE & WORK LOGS */}
                <div className="space-y-4">
                  <h3 className="text-lg font-bold text-white font-poppins flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <Clock className="w-5 h-5 text-blue-400" /> Service Timeline & Work Logs
                    </span>
                    <span className="text-xs font-mono font-extrabold text-amber-400 bg-amber-400/10 px-3 py-1 rounded-full border border-amber-400/20">
                      Showing {filteredServices.length} Records
                    </span>
                  </h3>

                  <div className="space-y-4">
                    {filteredServices.length === 0 ? (
                      <div className="bg-slate-900 p-8 rounded-2xl border border-slate-800 text-center text-slate-400 text-xs font-bold">
                        No service records found for the selected date filter range.
                      </div>
                    ) : (
                      filteredServices.map((job) => (
                      <div key={job.id} className="bg-slate-900/90 p-6 rounded-2xl border border-slate-700/80 space-y-4">
                        
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center font-bold border border-blue-500/30">
                              <Wrench className="w-5 h-5" />
                            </div>
                            <div>
                              <span className="text-xs font-mono font-bold text-blue-400 block">Job Card #{job.job_card_number}</span>
                              <span className="text-sm font-bold text-white font-poppins">{job.vehicle_model || 'Two Wheeler'}</span>
                            </div>
                          </div>

                          <div className="flex items-center gap-3">
                            <span className="text-xs font-mono text-slate-400">
                              {formatDateDMY(job.created_at || job.date)}
                            </span>
                            <span className={`px-3 py-1 rounded-full text-[10px] font-extrabold uppercase ${
                              job.status === 'FINISHED' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                            }`}>
                              {job.status}
                            </span>
                          </div>
                        </div>

                        {/* PARTS & LABOUR BREAKDOWN */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                          <div className="space-y-2">
                            <span className="font-bold text-slate-400 uppercase tracking-wider block text-[10px]">Assigned Master Mechanic:</span>
                            <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 font-bold text-white">
                              👨‍🔧 {job.assigned_mechanic || 'Patel Owner'}
                            </div>
                          </div>

                          <div className="space-y-2">
                            <span className="font-bold text-slate-400 uppercase tracking-wider block text-[10px]">Replaced Parts & Spares ({job.parts?.length || 0}):</span>
                            {job.parts && job.parts.length > 0 ? (
                              <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                                {job.parts.map((p, pIdx) => (
                                  <div key={pIdx} className="p-2 rounded-lg bg-slate-950/80 border border-slate-800 flex justify-between items-center text-xs">
                                    <span className="font-medium text-slate-200">{p.part_name} (x{p.quantity})</span>
                                    <span className="font-mono font-bold text-amber-400">₹{p.subtotal}</span>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div className="p-3 rounded-xl bg-slate-950/80 text-slate-500 font-medium">Standard Periodic Servicing Only</div>
                            )}
                          </div>
                        </div>

                        {/* BILL SUMMARY STRIP */}
                        <div className="pt-3 border-t border-slate-800 flex justify-between items-center text-xs font-bold">
                          <span className="text-slate-400">Labour Charge: ₹{job.labour_charge}</span>
                          <span className="text-sm font-extrabold text-amber-400 font-poppins">Total Bill Amount: ₹{job.live_total || job.labour_charge}</span>
                        </div>

                      </div>
                    )))}
                  </div>
                </div>

              </div>

              {/* LAST SECTION: ULTRA-PROFESSIONAL BLUE 1-CLICK RE-BOOK SERVICE SLOT CARD */}
              <div className="bg-gradient-to-r from-blue-900/90 via-indigo-900/90 to-blue-950/90 text-white p-6 sm:p-8 rounded-3xl border border-blue-500/40 shadow-2xl space-y-4">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <div className="space-y-1">
                    <span className="text-[10px] uppercase font-bold text-blue-300 tracking-wider flex items-center gap-1.5">
                      <Calendar className="w-4 h-4 text-blue-400" /> 1-Click Priority Service Re-Booking
                    </span>
                    <h3 className="text-xl font-bold font-poppins text-white">Reserve Your Next Workshop Service Slot</h3>
                    <p className="text-xs text-blue-200">Select your preferred date & service package to confirm instant workshop slot.</p>
                  </div>

                  <Link
                    to="/book-service"
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 text-white font-extrabold text-xs px-6 py-4 rounded-2xl shadow-xl shadow-blue-500/30 transition-all hover:scale-105 active:scale-95 shrink-0"
                  >
                    ⚡ Re-Book Service Slot Now <ArrowRight className="w-4 h-4" />
                  </Link>
                </div>
              </div>

            </div>
          )}
        </div>
      )}

    </div>
  );
}
