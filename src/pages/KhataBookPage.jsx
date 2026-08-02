import React, { useState, useEffect, useRef, useMemo } from 'react';
import { BookOpen, Send, CheckCircle2, IndianRupee, Phone, Bike, Search, Camera, AlertCircle, QrCode, Image as ImageIcon, Wrench, Eye, Download, Sparkles, Printer, Calendar, Filter, Trash2 } from 'lucide-react';
import API from '../services/api';
import { useAuth } from '../context/AuthContext';
import { generateBillCanvasDataUrl, generateBillCanvasDataUrlAsync, generateBillCanvasBlob } from '../utils/billCardGenerator';

import { fetchCloudKhataEntries, fetchCloudInvoices, fetchCloudJobs, pushCloudKhataEntry, pushCloudRecycleBinItem, markIdAsDeleted, deleteCloudKhataEntry } from '../utils/cloudSync';
import AdminPasswordModal from '../components/AdminPasswordModal';

const monthNames = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export default function KhataBookPage() {
  const [debtors, setDebtors] = useState([]);
  const [totalPending, setTotalPending] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sharingPhoto, setSharingPhoto] = useState(false);
  const [toast, setToast] = useState(null);
  const { garageInfo } = useAuth();

  // Date, Month & Year Filter States
  const [filterMode, setFilterMode] = useState('ALL'); // 'ALL', 'MONTH_YEAR', 'SPECIFIC_DATE'
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedDate, setSelectedDate] = useState('');
  
  // Payment Modal state
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [payAmount, setPayAmount] = useState(0);

  // Statement Photo Modal state
  const [statementCustomer, setStatementCustomer] = useState(null);
  const [showStatementModal, setShowStatementModal] = useState(false);
  const [statementPreviewUrl, setStatementPreviewUrl] = useState(null);
  const statementCaptureRef = useRef(null);
  const offscreenStatementRef = useRef(null);
  // Password protected delete modal state
  const [deleteModal, setDeleteModal] = useState({ isOpen: false, debtor: null });

  const showToast = (title, message, type = 'success') => {
    setToast({ title, message, type });
    setTimeout(() => {
      setToast(null);
    }, 4500);
  };

  const handleDeleteWithPassword = async (adminPassword) => {
    if (!deleteModal.debtor) return;
    const targetDebtor = deleteModal.debtor;
    const targetId = targetDebtor.id;

    // 1. Move to Recycle Bin
    const trashObj = {
      id: `trash_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      item_type: 'Khata Account',
      title: `Khata Account: ${targetDebtor.customer_name} (${targetDebtor.vehicle_number})`,
      deleted_by: 'Patel Owner (Admin)',
      deleted_at: new Date().toISOString(),
      details: `Customer: ${targetDebtor.customer_name} • Phone: ${targetDebtor.phone || targetDebtor.mobile_number} • Bike: ${targetDebtor.vehicle_number} • Pending: ₹${targetDebtor.pending_amount || 0}`,
      payload: targetDebtor
    };

    const existingTrash = JSON.parse(localStorage.getItem('recycle_bin_items') || '[]');
    localStorage.setItem('recycle_bin_items', JSON.stringify([trashObj, ...existingTrash]));
    pushCloudRecycleBinItem(trashObj).catch(console.warn);

    // 2. Mark as deleted & purge locally & cloud
    markIdAsDeleted(targetId).catch(console.warn);
    deleteCloudKhataEntry(targetId).catch(console.warn);

    const localKhata = JSON.parse(localStorage.getItem('khata_entries') || '[]');
    const updatedLocalKhata = localKhata.filter(k => (k.vehicle_number !== targetDebtor.vehicle_number && String(k.id) !== String(targetId)));
    localStorage.setItem('khata_entries', JSON.stringify(updatedLocalKhata));

    const localDebtors = JSON.parse(localStorage.getItem('khata_debtors') || '[]');
    const updatedLocalDebtors = localDebtors.filter(d => (d.vehicle_number !== targetDebtor.vehicle_number && String(d.id) !== String(targetId)));
    localStorage.setItem('khata_debtors', JSON.stringify(updatedLocalDebtors));

    setDebtors(prev => prev.filter(d => String(d.id) !== String(targetId) && d.vehicle_number !== targetDebtor.vehicle_number));
    setDeleteModal({ isOpen: false, debtor: null });

    try {
      await API.post(`/khata-book/${targetId}/delete_with_password/`, {
        admin_password: adminPassword
      }, { timeout: 1500 });
    } catch (err) {
      console.warn('Backend API offline, deleted Khata record locally & cloud store:', err);
    } finally {
      showToast('🗑️ Account Moved to Recycle Bin', `Khata account for ${targetDebtor.customer_name} deleted!`);
      fetchKhata();
    }
  };

  const cleanPartName = (name) => {
    if (!name) return '';
    return name.split(' Genuine Part')[0].split(' - ')[0].trim();
  };

  const fetchKhata = async () => {
    setLoading(true);
    try {
      let backendData = null;
      try {
        const res = await API.get('/khata-book/', { timeout: 1200 });
        backendData = res.data;
      } catch (err) {
        console.warn('Backend API offline for Khata, aggregating from local and cloud stores:', err);
      }

      // Read all records across stores safely
      const localKhata = JSON.parse(localStorage.getItem('khata_entries') || '[]');
      const cloudKhata = await fetchCloudKhataEntries().catch(() => []);
      const combinedKhata = [...localKhata, ...cloudKhata];

      const localInvs = JSON.parse(localStorage.getItem('local_invoices') || '[]');
      const cloudInvs = await fetchCloudInvoices().catch(() => []);
      const combinedInvs = [...localInvs, ...cloudInvs];

      const allJobs = JSON.parse(localStorage.getItem('workshop_jobs') || '[]');
      const cloudJobs = await fetchCloudJobs().catch(() => []);
      const combinedJobs = [...allJobs, ...cloudJobs];

      const legacyDebtors = backendData?.debtors || JSON.parse(localStorage.getItem('khata_debtors') || '[]');

      const debtorMap = new Map();

      // Helper to get or init debtor object
      const getDebtor = (name, phone, vehicle, model) => {
        const cleanVeh = (vehicle || '').replace(/[^A-Za-z0-9]/g, '').toUpperCase();
        const cleanPhone = (phone || '').replace(/\D/g, '').slice(-10);
        const key = cleanVeh || (cleanPhone ? `${name.toLowerCase()}_${cleanPhone}` : name.toLowerCase());

        if (!debtorMap.has(key)) {
          debtorMap.set(key, {
            id: key,
            customer_name: name || 'Valued Customer',
            phone: phone || 'N/A',
            mobile_number: phone || 'N/A',
            vehicle_number: vehicle || 'GJ-15',
            bike_model: model || 'Two Wheeler',
            total_billed: 0,
            total_paid: 0,
            pending_amount: 0,
            balance: 0,
            visit_date: 'N/A',
            notes: ''
          });
        }
        return debtorMap.get(key);
      };

      // 1. Process Workshop Jobs & Invoices for total_billed & total_paid
      [...combinedJobs, ...combinedInvs].forEach(item => {
        if (!item) return;
        const name = item.customer_name || 'Valued Customer';
        const phone = item.mobile_number || item.phone || item.phone_number || '';
        const vehicle = item.vehicle_number || '';
        const model = item.bike_model || '';

        const d = getDebtor(name, phone, vehicle, model);
        const partsVal = parseFloat(item.parts_total || 0);
        const labourVal = parseFloat(item.labour_charge || 100);
        const discountVal = parseFloat(item.discount_amount || 0);
        const totalVal = parseFloat(item.grand_total || item.total_amount || item.live_total || Math.max(0, partsVal + labourVal - discountVal));
        const paidVal = item.paid_amount !== undefined ? parseFloat(item.paid_amount) : totalVal;

        d.total_billed += totalVal;
        d.total_paid += paidVal;
        d.pending_amount += Math.max(0, totalVal - paidVal);

        const itemDate = item.finished_at || item.completed_at || item.created_at || item.date;
        if (itemDate && itemDate !== 'N/A') {
          const formattedDate = new Date(itemDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
          if (d.visit_date === 'N/A' || new Date(itemDate) > new Date(d.visit_date)) {
            d.visit_date = formattedDate;
          }
        }
      });

      // 2. Process Khata Entries (Debit / Credit)
      combinedKhata.forEach(k => {
        if (!k) return;
        const name = k.customer_name || 'Valued Customer';
        const phone = k.mobile_number || k.phone || '';
        const vehicle = k.vehicle_number || '';
        const model = k.bike_model || '';

        const d = getDebtor(name, phone, vehicle, model);
        const amt = parseFloat(k.amount || 0);

        if (k.type === 'DEBIT') {
          d.total_billed += amt;
          d.pending_amount += amt;
        } else if (k.type === 'CREDIT') {
          d.total_paid += amt;
          d.pending_amount = Math.max(0, d.pending_amount - amt);
        }

        if (k.date) {
          const formattedDate = new Date(k.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
          d.visit_date = formattedDate;
        }
      });

      // 3. Process Legacy Debtors if needed
      legacyDebtors.forEach(leg => {
        if (!leg) return;
        const amt = parseFloat(leg.pending_amount || leg.balance || leg.total_pending_amount || 0);
        if (amt > 0) {
          const d = getDebtor(leg.customer_name, leg.phone || leg.mobile_number, leg.vehicle_number, leg.bike_model);
          if (d.pending_amount <= 0) {
            d.pending_amount = amt;
            d.total_billed = Math.max(d.total_billed, parseFloat(leg.total_billed || amt));
            d.total_paid = parseFloat(leg.total_paid || 0);
            if (leg.visit_date && leg.visit_date !== 'N/A') {
              d.visit_date = leg.visit_date;
            }
          }
        }
      });

      const deletedIds = await fetchCloudDeletedIds().catch(() => []);

      const allDebtorsList = Array.from(debtorMap.values()).filter(d => {
        d.balance = d.pending_amount;
        const strId = String(d.id || '');
        const cleanVeh = (d.vehicle_number || '').replace(/[^A-Za-z0-9]/g, '').toUpperCase();
        return !deletedIds.includes(strId) && !deletedIds.includes(cleanVeh);
      });

      const pendingDebtors = allDebtorsList.filter(d => d.pending_amount > 0);
      const finalDebtors = pendingDebtors.length > 0 ? pendingDebtors : allDebtorsList;

      const totalSum = pendingDebtors.reduce((acc, d) => acc + d.pending_amount, 0);

      setDebtors(finalDebtors);
      setTotalPending(totalSum);
    } catch (err) {
      console.error('Error fetching Khata debtors:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchKhata();
  }, []);

  const availableYears = useMemo(() => {
    const currentY = new Date().getFullYear();
    const years = debtors
      .map((d) => new Date(d.visit_date || d.created_at || d.last_visit_date || Date.now()).getFullYear())
      .filter((y) => Number.isInteger(y) && y > 2000);
    const minY = Math.min(currentY, ...years, 2024);
    const maxY = Math.max(currentY + 2, ...years, 2026);
    return Array.from({ length: maxY - minY + 1 }, (_, i) => minY + i);
  }, [debtors]);

  const filtered = useMemo(() => {
    return debtors.filter((d) => {
      // 1. Text Search Filter
      if (search.trim()) {
        const q = search.toLowerCase().trim();
        const name = (d.customer_name || '').toLowerCase();
        const veh = (d.vehicle_number || '').toLowerCase();
        const bike = (d.bike_model || '').toLowerCase();
        const phone = (d.phone || d.mobile_number || '').toLowerCase();
        const invNum = (d.invoice_number || '').toLowerCase();
        if (!name.includes(q) && !veh.includes(q) && !bike.includes(q) && !phone.includes(q) && !invNum.includes(q)) {
          return false;
        }
      }

      // 2. Date Filter Modes
      const dateObj = new Date(d.visit_date || d.created_at || d.last_visit_date || Date.now());
      if (Number.isNaN(dateObj.getTime())) return true;

      if (filterMode === 'MONTH_YEAR') {
        return dateObj.getMonth() === selectedMonth && dateObj.getFullYear() === selectedYear;
      }

      if (filterMode === 'SPECIFIC_DATE' && selectedDate) {
        const yyyy = dateObj.getFullYear();
        const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
        const dd = String(dateObj.getDate()).padStart(2, '0');
        const dStr = `${yyyy}-${mm}-${dd}`;
        return dStr === selectedDate;
      }

      return true;
    });
  }, [debtors, search, filterMode, selectedMonth, selectedYear, selectedDate]);

  const openPaymentModal = (customer) => {
    setSelectedCustomer(customer);
    setPayAmount(parseFloat(customer.pending_amount));
  };

  const openStatementModal = async (customer) => {
    setStatementCustomer(customer);
    setShowStatementModal(true);
    setStatementPreviewUrl(null);
    try {
      const dataUrl = await generateBillCanvasDataUrlAsync(customer, garageInfo);
      setStatementPreviewUrl(dataUrl);
    } catch (err) {
      setStatementPreviewUrl(generateBillCanvasDataUrl(customer, garageInfo));
    }
  };

  const handleRecordPayment = async (e) => {
    e.preventDefault();
    if (!selectedCustomer) return;
    try {
      await API.post('/khata-book/record-payment/', {
        invoice_id: selectedCustomer.invoice_id || null,
        customer_id: selectedCustomer.customer_id || null,
        amount: payAmount
      });
      showToast('Payment Recorded', 'Payment recorded successfully!');
      setSelectedCustomer(null);
      fetchKhata();
    } catch (err) {
      showToast('Payment Failed', 'Failed to record payment', 'error');
    }
  };

  const handleDownloadStatementPhoto = async (customer) => {
    const targetCust = customer || statementCustomer;
    if (!targetCust) return;

    const custName = targetCust.customer_name || 'Customer';
    setSharingPhoto(true);

    try {
      const blob = await generateBillCanvasBlob(targetCust, garageInfo);
      const fileName = `Statement_${custName.replace(/\s+/g, '_')}_${targetCust.vehicle_number || ''}.png`;

      const imgUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = imgUrl;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      showToast(
        '📥 HD Statement Photo Card Downloaded!',
        `Saved '${fileName}' to Downloads. Click 'WhatsApp' to open chat and attach photo!`
      );
    } catch (err) {
      console.error('Download statement photo error:', err);
      showToast('Download Failed', 'Failed to generate Statement Photo Card.', 'error');
    } finally {
      setSharingPhoto(false);
    }
  };

  const handleOpenWhatsAppChat = (customer) => {
    const custPhone = customer.phone || '8140371414';
    let phoneClean = ''.concat(custPhone || '').replace(/\D/g, '');
    if (!phoneClean.startsWith('91') && phoneClean.length === 10) phoneClean = '91' + phoneClean;

    const contactPhone = garageInfo?.phone || '+91 81403 71414';
    const garageName = garageInfo?.garage_name || 'Patel Automobiles';
    const safetyMsg = garageInfo?.safety_message || 'Thank you for choosing us! Wish you a safe & smooth ride. 🛵⛑️';

    let customMsg = `${safetyMsg}\n\n📞 Contact: ${contactPhone}\n— ${garageName}`;
    const encodedMsg = encodeURIComponent(customMsg);
    const targetUrl = `https://wa.me/${phoneClean}?text=${encodedMsg}`;

    window.open(targetUrl, '_blank');
  };

  return (
    <div className="space-y-8 w-full">
      
      {/* HEADER WITH METRICS */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 bg-white p-6 sm:p-8 rounded-3xl border border-slate-200/80 soft-shadow">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 font-poppins flex items-center gap-3">
            <BookOpen className="w-8 h-8 text-amber-500" /> Udhar Khata Book
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 font-medium mt-1">
            Download Statement Photo & Send WhatsApp Message to Customer.
          </p>
        </div>

        <div className="p-4 bg-rose-50 border border-rose-200/80 rounded-2xl flex items-center gap-4 text-rose-700">
          <IndianRupee className="w-8 h-8 text-rose-600 shrink-0" />
          <div>
            <span className="text-[10px] font-extrabold uppercase tracking-wider block text-rose-600/80">Total Outstanding Dues</span>
            <span className="text-2xl font-black font-poppins">₹{totalPending.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
          </div>
        </div>
      </div>

      {/* FILTER BAR FOR DATE, MONTH & YEAR */}
      <section className="bg-white rounded-3xl border border-slate-200/80 soft-shadow p-5 sm:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-wide">Filter Khata Records by Date / Month</h3>
              <p className="text-xs text-slate-500 font-medium">Select Month &amp; Year, Specific Date, or Search Debtor</p>
            </div>
          </div>

          {/* QUICK MODE TOGGLES */}
          <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-2xl border border-slate-200">
            <button
              type="button"
              onClick={() => setFilterMode('ALL')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${filterMode === 'ALL' ? 'bg-amber-500 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
            >
              All Records
            </button>
            <button
              type="button"
              onClick={() => setFilterMode('MONTH_YEAR')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${filterMode === 'MONTH_YEAR' ? 'bg-amber-500 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
            >
              Month &amp; Year
            </button>
            <button
              type="button"
              onClick={() => setFilterMode('SPECIFIC_DATE')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${filterMode === 'SPECIFIC_DATE' ? 'bg-amber-500 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
            >
              Specific Date
            </button>
          </div>
        </div>

        {/* INPUTS ROW */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-3 border-t border-slate-100">
          {/* SEARCH INPUT */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search debtor name, mobile or vehicle..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-2xl border border-slate-200 bg-slate-50 text-xs font-bold text-slate-800 outline-none focus:border-amber-500 focus:bg-white transition-all"
            />
          </div>

          {/* MONTH & YEAR CONTROLS */}
          {filterMode === 'MONTH_YEAR' && (
            <>
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(Number(e.target.value))}
                className="px-4 py-2.5 rounded-2xl border border-slate-200 bg-slate-50 text-xs font-bold text-slate-800 outline-none focus:border-amber-500 transition-all cursor-pointer"
              >
                {monthNames.map((m, idx) => (
                  <option key={idx} value={idx}>{m}</option>
                ))}
              </select>

              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
                className="px-4 py-2.5 rounded-2xl border border-slate-200 bg-slate-50 text-xs font-bold text-slate-800 outline-none focus:border-amber-500 transition-all cursor-pointer"
              >
                {availableYears.map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </>
          )}

          {/* SPECIFIC DATE CONTROL */}
          {filterMode === 'SPECIFIC_DATE' && (
            <div className="sm:col-span-2 flex items-center gap-2">
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-full px-4 py-2.5 rounded-2xl border border-slate-200 bg-slate-50 text-xs font-bold text-slate-800 outline-none focus:border-amber-500 transition-all cursor-pointer"
              />
              {selectedDate && (
                <button
                  type="button"
                  onClick={() => setSelectedDate('')}
                  className="px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-xs rounded-2xl transition-all whitespace-nowrap"
                >
                  Clear Date
                </button>
              )}
            </div>
          )}
        </div>
      </section>

      {/* TABLE */}
      <div className="bg-white rounded-3xl border border-slate-200/80 soft-shadow overflow-hidden w-full space-y-4 p-4 sm:p-6">
        {loading ? (
          <div className="p-12 text-center text-slate-400 font-medium">Loading Khata Book...</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-slate-400 font-medium">No matching debtors found for the selected filter.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead className="bg-slate-50/90 text-slate-600 font-extrabold uppercase tracking-wider text-[11px] border-b border-slate-200/80">
                <tr>
                  <th className="p-4 sm:p-5">Debtor Details</th>
                  <th className="p-4 sm:p-5">Vehicle</th>
                  <th className="p-4 sm:p-5">Total Billed</th>
                  <th className="p-4 sm:p-5">Paid</th>
                  <th className="p-4 sm:p-5">Pending Dues</th>
                  <th className="p-4 sm:p-5">Visit Date</th>
                  <th className="p-4 sm:p-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {filtered.map((d) => (
                  <tr key={d.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="p-4 sm:p-5">
                      <span className="font-extrabold text-slate-900 text-sm block">{d.customer_name}</span>
                      <span className="text-xs text-slate-500 font-mono font-semibold block mt-0.5">📞 {d.phone || d.mobile_number || 'N/A'}</span>
                    </td>
                    <td className="p-4 sm:p-5">
                      <span className="font-black font-mono text-slate-900 block">{d.vehicle_number}</span>
                      {d.bike_model && <span className="text-xs text-slate-500 block">{d.bike_model}</span>}
                    </td>
                    <td className="p-4 sm:p-5 font-bold text-slate-900 font-poppins">
                      ₹{parseFloat(d.total_billed || 0).toFixed(2)}
                    </td>
                    <td className="p-4 sm:p-5 font-bold text-emerald-600 font-poppins">
                      ₹{parseFloat(d.total_paid || 0).toFixed(2)}
                    </td>
                    <td className="p-4 sm:p-5 font-extrabold text-rose-600 font-poppins text-base">
                      ₹{parseFloat(d.pending_amount || 0).toFixed(2)}
                    </td>
                    <td className="p-4 sm:p-5 text-slate-600 text-xs font-medium whitespace-nowrap">
                      📅 {d.visit_date || (d.last_visit ? new Date(d.last_visit).toLocaleString('en-IN') : 'N/A')}
                    </td>
                    <td className="p-4 sm:p-5 text-right">
                      <div className="flex flex-wrap items-center justify-end gap-1.5 max-w-[280px] ml-auto">
                        <button
                          type="button"
                          onClick={() => openStatementModal(d)}
                          className="h-8 px-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-[11px] rounded-lg flex items-center justify-center gap-1 shadow-sm transition-all hover:scale-105"
                          title="View Statement Card Modal"
                        >
                          <Eye className="w-3 h-3" /> View
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDownloadStatementPhoto(d)}
                          disabled={sharingPhoto}
                          className="h-8 px-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-[11px] rounded-lg flex items-center justify-center gap-1 shadow-sm transition-all hover:scale-105"
                          title="Download Statement Photo Card"
                        >
                          <Download className="w-3 h-3" /> Download
                        </button>

                        <button
                          type="button"
                          onClick={() => handleOpenWhatsAppChat(d)}
                          className="h-8 px-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] rounded-lg flex items-center justify-center gap-1 shadow-sm transition-all hover:scale-105"
                          title="Open WhatsApp Chat"
                        >
                          <Send className="w-3 h-3" /> WhatsApp
                        </button>

                        <button
                          type="button"
                          onClick={() => openPaymentModal(d)}
                          className="h-8 px-2.5 bg-amber-500 hover:bg-amber-600 text-white font-bold text-[11px] rounded-lg flex items-center justify-center gap-1 shadow-sm transition-all hover:scale-105"
                        >
                          + Payment
                        </button>

                        <button
                          type="button"
                          onClick={() => setDeleteModal({ isOpen: true, debtor: d })}
                          className="h-8 px-2 bg-red-50 hover:bg-red-100 text-red-600 font-bold text-[11px] rounded-lg border border-red-200 flex items-center justify-center gap-1 transition-all hover:scale-105"
                          title="Delete Khata Account (Password Protected)"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* RECORD PAYMENT MODAL */}
      {selectedCustomer && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full space-y-6 shadow-2xl border border-slate-200">
            <h3 className="text-lg font-bold font-poppins text-slate-900">
              Record Payment for {selectedCustomer.customer_name}
            </h3>

            <form onSubmit={handleRecordPayment} className="space-y-4">


              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Current Pending Dues</label>
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl font-bold font-mono text-lg">
                  ₹{parseFloat(selectedCustomer.pending_amount).toFixed(2)}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Received Payment Amount (₹)</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 font-mono text-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                />
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setSelectedCustomer(null)}
                  className="flex-1 py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-1.5"
                >
                  <CheckCircle2 className="w-4 h-4" /> Save Payment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* HD OUTSTANDING PAYMENT STATEMENT PHOTO CARD MODAL */}
      {showStatementModal && statementCustomer && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex justify-center items-start p-4 sm:p-6 overflow-y-auto">
          <div className="bg-slate-900 text-white rounded-3xl p-6 sm:p-8 max-w-2xl w-full space-y-6 shadow-2xl border border-slate-800 my-4 sm:my-8 relative">
            
            {/* STICKY TOP ACTION BAR */}
            <div className="sticky top-0 z-30 bg-slate-900/95 backdrop-blur-md border-b border-slate-800 pb-4 pt-1 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <h2 className="text-xl font-bold font-poppins flex items-center gap-2 text-white">
                  <ImageIcon className="w-5 h-5 text-amber-400" /> Statement Photo Card
                </h2>
                <p className="text-xs text-slate-400">Patel Automobiles HD Statement Photo Card</p>
              </div>

              <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() => handleDownloadStatementPhoto(statementCustomer)}
                  disabled={sharingPhoto}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-lg transition-all flex items-center gap-1.5"
                >
                  <Download className="w-4 h-4" />
                  <span>Download</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleOpenWhatsAppChat(statementCustomer)}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-lg transition-all flex items-center gap-1.5"
                >
                  <Send className="w-4 h-4" />
                  <span>WhatsApp</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowStatementModal(false)}
                  className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl transition-all"
                >
                  Close
                </button>
              </div>
            </div>

            {/* SINGLE GENERATED HD STATEMENT PHOTO CARD IMAGE DISPLAY */}
            <div className="bg-slate-950 p-4 sm:p-6 rounded-3xl border border-slate-800 flex flex-col items-center justify-center min-h-[350px]">
              {statementPreviewUrl ? (
                <img
                  src={statementPreviewUrl}
                  alt="HD Khata Statement Photo Card"
                  className="max-w-full h-auto rounded-2xl shadow-2xl border border-amber-500/30 object-contain"
                />
              ) : (
                <div className="py-16 text-center text-slate-400 font-medium animate-pulse space-y-3">
                  <Sparkles className="w-10 h-10 text-amber-400 mx-auto animate-spin" />
                  <p className="text-sm font-bold text-slate-200">⚡ Generating HD Statement Photo Card...</p>
                </div>
              )}
            </div>

          </div>
        </div>
      )}

      {/* OFFSCREEN CAPTURE CARD FOR KHATABOOK WHATSAPP PHOTO */}
      {statementCustomer && (
        <div style={{ position: 'fixed', left: '-9999px', top: '0', width: '600px', pointerEvents: 'none', opacity: 0 }}>
          <div
            ref={offscreenStatementRef}
            className="bg-white text-slate-900 p-8 sm:p-10 rounded-3xl max-w-xl mx-auto space-y-6 shadow-2xl border border-slate-200"
          >
            <div className="flex items-center justify-between border-b-2 border-amber-500 pb-4">
              <div className="flex items-center gap-3.5">
                <img
                  src={garageInfo?.logo && garageInfo.logo !== '/logo.png' ? garageInfo.logo : LOGO_BASE64}
                  alt="Logo"
                  className="w-14 h-14 rounded-xl object-cover border-2 border-amber-400 shadow-md shrink-0"
                />
                <div>
                  <h3 className="text-xl font-black text-slate-900 font-poppins">{garageInfo?.garage_name || 'Patel Automobiles'}</h3>
                  <p className="text-xs text-slate-600 font-medium leading-relaxed mt-0.5">
                    {garageInfo?.address || 'Near Dandi Pond, Dandi, Valsad, Gujarat - 396385'}
                  </p>
                  <p className="text-xs font-bold text-slate-800 font-mono mt-0.5 whitespace-nowrap">
                    📞 {garageInfo?.phone || '+91 81403 71414'}
                  </p>
                </div>
              </div>
              <span className="px-3 py-1 rounded-full text-[10px] font-black bg-rose-600 text-white uppercase tracking-wider shrink-0">
                PAYMENT DUE
              </span>
            </div>

            <div className="grid grid-cols-2 gap-4 p-4 rounded-2xl bg-amber-500/5 border border-amber-200 text-xs">
              <div>
                <span className="text-[10px] font-bold text-amber-700 uppercase tracking-wider block">Customer Details</span>
                <span className="font-extrabold text-slate-900 text-sm block">{statementCustomer.customer_name}</span>
                <span className="text-slate-700 font-bold font-mono text-xs block mt-0.5">📞 {statementCustomer.phone}</span>
              </div>
              <div>
                <span className="text-[10px] font-bold text-amber-700 uppercase tracking-wider block">Vehicle Registration</span>
                <span className="font-black text-slate-900 text-sm font-mono block">
                  {statementCustomer.vehicle_number} {statementCustomer.bike_model ? `(${statementCustomer.bike_model})` : ''}
                </span>
              </div>
            </div>

            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-900 text-amber-300 font-bold uppercase tracking-wider text-[10px]">
                  <th className="p-3 rounded-l-xl">Description</th>
                  <th className="p-3 text-center">Qty</th>
                  <th className="p-3 text-right">Price</th>
                  <th className="p-3 text-right rounded-r-xl">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {statementCustomer.parts && statementCustomer.parts.length > 0 ? (
                  statementCustomer.parts.map((p, idx) => {
                    const uPrice = parseFloat(p.unit_price || p.price || 0);
                    const subTot = parseFloat(p.subtotal || (uPrice * p.quantity) || 0);
                    return (
                      <tr key={idx}>
                        <td className="p-3 font-bold">{cleanPartName(p.part_name)}</td>
                        <td className="p-3 text-center font-mono">{p.quantity}</td>
                        <td className="p-3 text-right font-mono">₹{uPrice.toFixed(2)}</td>
                        <td className="p-3 text-right font-mono font-bold">₹{subTot.toFixed(2)}</td>
                      </tr>
                    );
                  })
                ) : null}

                {parseFloat(statementCustomer.labour_charge || 0) > 0 && (
                  <tr>
                    <td className="p-3 font-bold text-slate-900">Labour Service Charge</td>
                    <td className="p-3 text-center font-mono">1</td>
                    <td className="p-3 text-right font-mono">₹{parseFloat(statementCustomer.labour_charge || 0).toFixed(2)}</td>
                    <td className="p-3 text-right font-mono font-bold">₹{parseFloat(statementCustomer.labour_charge || 0).toFixed(2)}</td>
                  </tr>
                )}
              </tbody>
            </table>

            <div className="grid grid-cols-2 gap-4 items-center bg-slate-50 p-4 rounded-2xl border border-amber-200">
              <div className="flex flex-col items-center justify-center p-3 bg-white rounded-2xl border border-slate-300 shadow-sm text-center">
                <a
                  href={`upi://pay?pa=${garageInfo?.upi_id || 'pritpatel9397@oksbi'}&pn=${encodeURIComponent(garageInfo?.upi_payee_name || 'Prit Patel')}&cu=INR`}
                  title="Click to Pay directly via UPI"
                  target="_blank"
                  rel="noreferrer"
                  className="block p-1 bg-white"
                >
                  <img
                    src={(garageInfo?.upi_qr_code && garageInfo.upi_qr_code.trim() !== '' && !garageInfo.upi_qr_code.includes('undefined')) ? garageInfo.upi_qr_code : '/upi_qr.jpg'}
                    alt="UPI QR Code"
                    onError={(e) => { e.target.onerror = null; e.target.src = '/upi_qr.jpg'; }}
                    className="w-48 h-48 sm:w-56 sm:h-56 object-contain"
                  />
                </a>
                <span className="text-[11px] font-black text-slate-900 mt-1 uppercase tracking-wide">Scan &amp; Pay via GPay / UPI</span>
                <span className="text-[11px] font-mono text-emerald-700 font-extrabold">{garageInfo?.upi_id || 'pritpatel9397@oksbi'}</span>
              </div>

              <div className="p-4 rounded-2xl bg-rose-50 border-2 border-rose-200 text-center space-y-1 shadow-sm">
                <span className="text-[11px] font-extrabold uppercase text-rose-700 tracking-wider block">Total Outstanding Dues</span>
                <span className="text-2xl font-black text-rose-600 font-poppins block">
                  ₹{parseFloat(statementCustomer.pending_amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
                <span className="text-[10px] font-bold text-slate-600 block pt-1">Payee: {garageInfo?.upi_payee_name || 'Prit Patel'}</span>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-dashed border-amber-300 text-center bg-amber-500/10 rounded-xl p-3 space-y-1">
              <p className="text-xs font-black text-slate-900 font-poppins">
                🛵 {garageInfo?.safety_message || 'Thank you for choosing us! Wish you a safe & smooth ride. 🛵⛑️'}
              </p>
              <p className="text-[10px] font-bold text-slate-600 tracking-wider">
                {garageInfo?.garage_name || 'Patel Automobiles'} • Dandi, Valsad | 📞 {garageInfo?.phone || '+91 81403 71414'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* BEAUTIFUL TOAST NOTIFICATION BANNER */}
      {toast && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[100] max-w-md w-full px-4 transition-all duration-300">
          <div className="bg-slate-900/95 text-white backdrop-blur-xl p-4 rounded-2xl shadow-2xl border border-emerald-500/40 flex items-start gap-3.5">
            <div className="p-2 bg-emerald-500/20 text-emerald-400 rounded-xl shrink-0">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div className="space-y-0.5 flex-1">
              <h4 className="text-sm font-bold font-poppins text-white flex items-center justify-between">
                <span>{toast.title}</span>
                <button
                  type="button"
                  onClick={() => setToast(null)}
                  className="text-slate-400 hover:text-white text-xs p-1"
                >
                  ✕
                </button>
              </h4>
              <p className="text-xs text-slate-300 leading-relaxed font-medium">
                {toast.message}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ADMIN PASSWORD PROTECTED DELETE MODAL */}
      <AdminPasswordModal
        isOpen={deleteModal.isOpen}
        onClose={() => setDeleteModal({ isOpen: false, debtor: null })}
        onConfirm={handleDeleteWithPassword}
        title="Delete Khata Account"
        itemDescription={deleteModal.debtor ? `${deleteModal.debtor.customer_name} (${deleteModal.debtor.vehicle_number}) • Pending Dues: ₹${deleteModal.debtor.pending_amount}` : ''}
      />

    </div>
  );
}
