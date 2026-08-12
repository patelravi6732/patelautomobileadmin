import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Receipt, Printer, Eye, Wrench, Calendar, Phone, MapPin, Trash2, Camera, Sparkles, CheckCircle2, QrCode, Image as ImageIcon, X, Send, Download, Search, Filter } from 'lucide-react';
import html2canvas from 'html2canvas';
import API from '../services/api';
import { useAuth } from '../context/AuthContext';
import { pushCloudRecycleBinItem, fetchCloudInvoices, markIdAsDeleted, fetchCloudDeletedIds, deleteCloudInvoice, deleteCloudJob, pushAuditLog } from '../utils/cloudSync';
import AdminPasswordModal from '../components/AdminPasswordModal';
import { LOGO_BASE64 } from '../assets/logoBase64';
import { sharePhotoToWhatsApp } from '../utils/whatsappPhotoSharer';

import { generateBillCanvasDataUrl, generateBillCanvasDataUrlAsync, generateBillCanvasBlob } from '../utils/billCardGenerator';
import { formatDateDMY } from '../utils/dateFormatter';

const monthNames = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export default function BillingPage() {
  const [invoices, setInvoices] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('local_invoices') || '[]');
    } catch {
      return [];
    }
  });
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [sharingPhoto, setSharingPhoto] = useState(false);
  const [deleteModal, setDeleteModal] = useState({ isOpen: false, invoice: null });
  const { garageInfo } = useAuth();
  const invoiceCaptureRef = useRef(null);
  const offscreenInvoiceRef = useRef(null);

  // Date, Month & Year Filter States
  const [filterMode, setFilterMode] = useState('ALL'); // 'ALL', 'MONTH_YEAR', 'SPECIFIC_DATE'
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedDate, setSelectedDate] = useState('');

  const fetchInvoices = async (isInitial = false) => {
    if (isInitial && (!invoices || invoices.length === 0)) setLoading(true);
    let backendInvs = [];
    try {
      try {
        const res = await API.get('/billing/', { timeout: 800 });
      backendInvs = res.data || [];
    } catch (err) {
      console.warn('Backend API offline for billing, deriving from local & cloud invoices:', err);
    }

    const deletedIds = await fetchCloudDeletedIds().catch(() => []);
    const isDeleted = (id) => id && (deletedIds.includes(String(id)) || deletedIds.includes(String(id).replace(/^inv_/, '').replace(/^job_/, '')));

    const cloudInvs = await fetchCloudInvoices().catch(() => []);
    const rawLocalInvs = JSON.parse(localStorage.getItem('local_invoices') || '[]');
    const localInvs = rawLocalInvs.filter(inv => inv && !isDeleted(inv.id) && !isDeleted(inv.invoice_number) && !isDeleted(inv.job_id));

    // Keep local storage strictly clean of any item deleted on other devices
    if (localInvs.length !== rawLocalInvs.length) {
      localStorage.setItem('local_invoices', JSON.stringify(localInvs));
    }

    const rawJobs = JSON.parse(localStorage.getItem('workshop_jobs') || '[]');
    const finishedJobs = rawJobs.filter(j => j && (j.status === 'FINISHED' || j.status === 'COMPLETED') && !isDeleted(j.id) && !isDeleted(j.vehicle_number));
    if (finishedJobs.length !== rawJobs.filter(j => j && (j.status === 'FINISHED' || j.status === 'COMPLETED')).length) {
      const cleanJobs = rawJobs.filter(j => !isDeleted(j.id));
      localStorage.setItem('workshop_jobs', JSON.stringify(cleanJobs));
    }

    const derivedInvs = finishedJobs.map((j, idx) => {
      const partsVal = parseFloat(j.parts_total || 0);
      const labourVal = parseFloat(j.labour_charge || 100);
      const discountVal = parseFloat(j.discount_amount || 0);
      const totalVal = parseFloat(j.grand_total || j.total_amount || j.live_total || Math.max(0, partsVal + labourVal - discountVal));
      const rawPaid = j.paid_amount !== undefined ? parseFloat(j.paid_amount) : totalVal;
      const paidVal = Math.min(totalVal, Math.max(0, rawPaid));
      const pendingVal = Math.max(0, totalVal - paidVal);

      return {
        id: j.id || `job_${idx}`,
        invoice_number: `INV-${String(j.id || idx).slice(-4)}`,
        customer_name: j.customer_name || 'Valued Customer',
        mobile_number: j.mobile_number || 'N/A',
        vehicle_number: j.vehicle_number || 'GJ-15',
        bike_model: j.bike_model || 'Two Wheeler',
        labour_charge: labourVal,
        parts_total: partsVal,
        grand_total: totalVal,
        total_amount: totalVal,
        paid_amount: paidVal,
        pending_amount: pendingVal,
        discount_amount: discountVal,
        payment_status: pendingVal > 0 ? 'PENDING' : 'PAID',
        created_at: j.finished_at || j.completed_at || j.created_at || new Date().toISOString(),
        parts: j.parts || []
      };
    });

    const allMap = new Map();
    [...cloudInvs, ...localInvs, ...derivedInvs, ...backendInvs].forEach(inv => {
      if (inv && typeof inv === 'object') {
        const strId = String(inv.id || '');
        const rawId = strId.replace(/^inv_/, '').replace(/^job_/, '');
        const invNum = inv.invoice_number || '';
        const vehNum = (inv.vehicle_number || '').replace(/[^A-Za-z0-9]/g, '').toUpperCase();
        const dateMinute = inv.created_at ? new Date(inv.created_at).toISOString().slice(0, 16) : '';

        if (isDeleted(strId) || isDeleted(rawId) || isDeleted(invNum)) {
          return;
        }
        
        const key = rawId ? `bill_${rawId}` : (invNum ? `inv_${invNum}_${vehNum}` : `${vehNum}_${dateMinute}`);

        const partsVal = parseFloat(inv.parts_total || 0);
        const labourVal = parseFloat(inv.labour_charge || 100);
        const discountVal = parseFloat(inv.discount_amount || 0);
        const totalVal = parseFloat(inv.grand_total || inv.total_amount || inv.live_total || Math.max(0, partsVal + labourVal - discountVal));
        const rawPaid = inv.paid_amount !== undefined && inv.paid_amount !== null
          ? parseFloat(inv.paid_amount)
          : (inv.received_amount !== undefined && inv.received_amount !== null
            ? parseFloat(inv.received_amount)
            : (inv.payment_status === 'PAID' ? totalVal : 0));
        const paidVal = Math.min(totalVal, Math.max(0, rawPaid));
        const pendingVal = Math.max(0, totalVal - paidVal);

        const normalizedInv = {
          ...inv,
          grand_total: totalVal,
          total_amount: totalVal,
          paid_amount: paidVal,
          pending_amount: pendingVal,
          payment_status: pendingVal > 0 ? 'PENDING' : 'PAID'
        };

        if (!allMap.has(key)) {
          allMap.set(key, normalizedInv);
        } else {
          allMap.set(key, { ...allMap.get(key), ...normalizedInv });
        }
      }
    });

    const finalInvs = Array.from(allMap.values());
    localStorage.setItem('local_invoices', JSON.stringify(finalInvs));
    setInvoices(finalInvs);
  } catch (err) {
    console.warn('fetchInvoices notice:', err);
  } finally {
    setLoading(false);
  }
  };

  useEffect(() => {
    fetchInvoices(true);
    const interval = setInterval(() => {
      fetchInvoices(false);
    }, 5000);
    const handleStorage = () => fetchInvoices(false);
    window.addEventListener('storage', handleStorage);
    return () => {
      clearInterval(interval);
      window.removeEventListener('storage', handleStorage);
    };
  }, []);

  const availableYears = useMemo(() => {
    const currentY = new Date().getFullYear();
    const years = invoices
      .map((inv) => new Date(inv.created_at || inv.visit_date || Date.now()).getFullYear())
      .filter((y) => Number.isInteger(y) && y > 2000);
    const minY = Math.min(currentY, ...years, 2024);
    const maxY = Math.max(currentY + 2, ...years, 2026);
    return Array.from({ length: maxY - minY + 1 }, (_, i) => minY + i);
  }, [invoices]);

  const filteredInvoices = useMemo(() => {
    return invoices.filter((inv) => {
      // 1. Text Search Filter
      if (search.trim()) {
        const q = search.toLowerCase().trim();
        const name = (inv.customer_name || '').toLowerCase();
        const veh = (inv.vehicle_number || '').toLowerCase();
        const bike = (inv.bike_model || '').toLowerCase();
        const phone = (inv.customer_mobile || inv.mobile_number || '').toLowerCase();
        if (!name.includes(q) && !veh.includes(q) && !bike.includes(q) && !phone.includes(q)) {
          return false;
        }
      }

      // 2. Date Filter Modes
      const dateObj = new Date(inv.created_at || inv.visit_date || Date.now());
      if (Number.isNaN(dateObj.getTime())) return true;

      if (filterMode === 'MONTH_YEAR') {
        return dateObj.getMonth() === selectedMonth && dateObj.getFullYear() === selectedYear;
      }

      if (filterMode === 'SPECIFIC_DATE' && selectedDate) {
        const yyyy = dateObj.getFullYear();
        const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
        const dd = String(dateObj.getDate()).padStart(2, '0');
        const invDateStr = `${yyyy}-${mm}-${dd}`;
        return invDateStr === selectedDate;
      }

      return true;
    });
  }, [invoices, search, filterMode, selectedMonth, selectedYear, selectedDate]);

  const [previewImageUrl, setPreviewImageUrl] = useState(null);
  const [toast, setToast] = useState(null);

  const showToast = (title, message, type = 'success') => {
    setToast({ title, message, type });
    setTimeout(() => {
      setToast(null);
    }, 4500);
  };

  const openInvoiceModal = async (inv) => {
    setSelectedInvoice(inv);
    setShowModal(true);
    setPreviewImageUrl(null);
    try {
      const dataUrl = await generateBillCanvasDataUrlAsync(inv, garageInfo);
      setPreviewImageUrl(dataUrl);
    } catch (err) {
      console.error('Canvas generate error:', err);
      setPreviewImageUrl(generateBillCanvasDataUrl(inv, garageInfo));
    }
  };

  const handlePrint = () => {
    window.print();
  };

  // Helper to clean part name (removes #946 or Genuine Part noise)
  const cleanPartName = (name) => {
    if (!name) return '';
    return name.split(' Genuine Part')[0].split(' - ')[0].trim();
  };

  // Download HD Bill Photo Card to Computer/Mobile Downloads
  const handleDownloadInvoicePhoto = async (inv) => {
    const targetInv = inv || selectedInvoice;
    if (!targetInv) return;

    const custName = targetInv.customer_name || 'Customer';
    setSharingPhoto(true);

    try {
      const blob = await generateBillCanvasBlob(targetInv, garageInfo);
      const fileName = `Bill_${custName.replace(/\s+/g, '_')}_${targetInv.vehicle_number || ''}.png`;

      const imgUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = imgUrl;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      showToast(
        '📥 HD Bill Photo Card Downloaded!',
        `Saved '${fileName}' to Downloads. Click 'WhatsApp' to open chat and attach photo!`
      );
    } catch (err) {
      console.error('Download photo error:', err);
      showToast('Download Failed', 'Failed to generate Bill Photo Card.', 'error');
    } finally {
      setSharingPhoto(false);
    }
  };

  // Direct WhatsApp Chat & Bill Photo Sharer with Custom Safety Greeting
  const handleOpenWhatsAppChat = async (inv) => {
    const targetInv = inv || selectedInvoice;
    if (!targetInv) return;

    try {
      showToast('📲 Preparing WhatsApp Share...', 'Generating Bill Photo Card & Safety Greeting...');
      await sharePhotoToWhatsApp(targetInv, garageInfo);
    } catch (err) {
      console.warn('WhatsApp photo share notice, launching text link fallback:', err);
      const custPhone = targetInv.customer_mobile || targetInv.mobile_number || targetInv.service_job?.mobile_number || '8140371414';
      let phoneClean = ''.concat(custPhone || '').replace(/\D/g, '');
      if (!phoneClean.startsWith('91') && phoneClean.length === 10) phoneClean = '91' + phoneClean;

      const contactPhone = garageInfo?.phone || '+91 81403 71414';
      const garageName = garageInfo?.garage_name || 'Patel Automobiles';
      const safetyMsg = garageInfo?.safety_message || 'Thank you for choosing us! Wish you a safe & smooth ride. 🛵⛑️';

      let customMsg = `${safetyMsg}\n\n📞 Contact: ${contactPhone}\n— ${garageName}`;
      const encodedMsg = encodeURIComponent(customMsg);
      const targetUrl = `https://wa.me/${phoneClean}?text=${encodedMsg}`;

      window.open(targetUrl, '_blank');
    }
  };

  const handleDeleteWithPassword = async (adminPassword) => {
    if (!deleteModal.invoice) return;
    const targetInv = deleteModal.invoice;
    const targetId = targetInv.id;

    // 1. Move to Recycle Bin (local & cloud)
    const trashObj = {
      id: `trash_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      item_type: 'Billing Invoice',
      title: `Invoice: ${targetInv.invoice_number || targetId} (${targetInv.customer_name})`,
      deleted_by: 'Patel Owner (Admin)',
      deleted_at: new Date().toISOString(),
      details: `Customer: ${targetInv.customer_name} • Phone: ${targetInv.mobile_number} • Bike: ${targetInv.vehicle_number} • Total: ₹${targetInv.total_amount || 0}`,
      payload: targetInv
    };

    const existingTrash = JSON.parse(localStorage.getItem('recycle_bin_items') || '[]');
    localStorage.setItem('recycle_bin_items', JSON.stringify([trashObj, ...existingTrash]));
    pushCloudRecycleBinItem(trashObj).catch(console.warn);
    pushAuditLog('DELETE', 'Billing', `Deleted bill #${targetInv.invoice_number || targetId} for ${targetInv.customer_name || 'Customer'}`).catch(console.warn);

    // 2. Mark as permanently deleted & purge from stores
    markIdAsDeleted(targetId).catch(console.warn);
    if (targetInv.invoice_number) markIdAsDeleted(targetInv.invoice_number).catch(console.warn);
    deleteCloudInvoice(targetId).catch(console.warn);
    deleteCloudJob(targetId).catch(console.warn);

    const localInvoices = JSON.parse(localStorage.getItem('local_invoices') || '[]');
    const updatedLocalInvs = localInvoices.filter(inv => String(inv.id) !== String(targetId) && inv.invoice_number !== targetInv.invoice_number);
    localStorage.setItem('local_invoices', JSON.stringify(updatedLocalInvs));

    const rawTargetId = String(targetId).replace(/^inv_/, '').replace(/^job_/, '');
    const targetVeh = (targetInv.vehicle_number || '').replace(/[^A-Za-z0-9]/g, '').toUpperCase();

    const localJobs = JSON.parse(localStorage.getItem('workshop_jobs') || '[]');
    const updatedJobs = localJobs.filter(j => {
      const jId = String(j.id || '');
      const jRaw = jId.replace(/^inv_/, '').replace(/^job_/, '');
      const jVeh = (j.vehicle_number || '').replace(/[^A-Za-z0-9]/g, '').toUpperCase();
      if (jId === String(targetId) || jRaw === rawTargetId) return false;
      return true;
    });
    localStorage.setItem('workshop_jobs', JSON.stringify(updatedJobs));

    setInvoices(prev => prev.filter(inv => String(inv.id) !== String(targetId) && inv.invoice_number !== targetInv.invoice_number));
    setDeleteModal({ isOpen: false, invoice: null });

    try {
      await API.post(`/billing/${targetId}/delete_with_password/`, {
        admin_password: adminPassword
      }, { timeout: 1500 });
    } catch (err) {
      console.warn('Backend API offline, moved invoice to Recycle Bin locally:', err);
    } finally {
      alert('🗑️ Invoice moved to Recycle Bin permanently!');
      fetchInvoices();
    }
  };

  return (
    <div className="space-y-8 w-full">
      
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 sm:p-8 rounded-3xl border border-slate-200/80 soft-shadow">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 font-poppins flex items-center gap-3">
            <Receipt className="w-8 h-8 text-blue-600" /> Billing & Payment Records
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 font-medium mt-1">
            Review completed service payments, share bill details, and manage customer records.
          </p>
          <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-blue-50 border border-blue-100 px-3 py-1.5 text-xs font-bold text-blue-700">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-600" /> {invoices.length} payment record{invoices.length === 1 ? '' : 's'}
          </div>
        </div>
      </div>

      {/* FILTER BAR FOR DATE, MONTH & YEAR */}
      <section className="bg-white rounded-3xl border border-slate-200/80 soft-shadow p-5 sm:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-wide">Filter Bills by Date / Month</h3>
              <p className="text-xs text-slate-500 font-medium">Select Month &amp; Year, Specific Date, or Search Customer</p>
            </div>
          </div>

          {/* QUICK MODE TOGGLES */}
          <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-2xl border border-slate-200">
            <button
              type="button"
              onClick={() => setFilterMode('ALL')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${filterMode === 'ALL' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
            >
              All Bills
            </button>
            <button
              type="button"
              onClick={() => setFilterMode('MONTH_YEAR')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${filterMode === 'MONTH_YEAR' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
            >
              Month &amp; Year
            </button>
            <button
              type="button"
              onClick={() => setFilterMode('SPECIFIC_DATE')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${filterMode === 'SPECIFIC_DATE' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
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
              placeholder="Search customer, vehicle, mobile..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-2xl border border-slate-200 bg-slate-50 text-xs font-bold text-slate-800 outline-none focus:border-blue-500 focus:bg-white transition-all"
            />
          </div>

          {/* MONTH & YEAR CONTROLS */}
          {filterMode === 'MONTH_YEAR' && (
            <>
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(Number(e.target.value))}
                className="px-4 py-2.5 rounded-2xl border border-slate-200 bg-slate-50 text-xs font-bold text-slate-800 outline-none focus:border-blue-500 transition-all cursor-pointer"
              >
                {monthNames.map((m, idx) => (
                  <option key={idx} value={idx}>{m}</option>
                ))}
              </select>

              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
                className="px-4 py-2.5 rounded-2xl border border-slate-200 bg-slate-50 text-xs font-bold text-slate-800 outline-none focus:border-blue-500 transition-all cursor-pointer"
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
                className="w-full px-4 py-2.5 rounded-2xl border border-slate-200 bg-slate-50 text-xs font-bold text-slate-800 outline-none focus:border-blue-500 transition-all cursor-pointer"
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
      <div className="bg-white rounded-3xl border border-slate-200/80 soft-shadow overflow-hidden w-full">
        {loading ? (
          <div className="p-12 text-center text-slate-400 font-medium">Loading payment records...</div>
        ) : filteredInvoices.length === 0 ? (
          <div className="p-12 text-center text-slate-400 font-medium">No matching billing records found for the selected filter.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1020px] text-left text-xs sm:text-sm">
              <thead className="bg-slate-50/90 text-slate-600 font-extrabold uppercase tracking-wider text-[11px] border-b border-slate-200/80">
                <tr>
                  <th className="p-4 sm:p-5">Customer &amp; Vehicle</th>
                  <th className="p-4 sm:p-5">Service Total</th>
                  <th className="p-4 sm:p-5">Discount</th>
                  <th className="p-4 sm:p-5">Net Total</th>
                  <th className="p-4 sm:p-5">Received</th>
                  <th className="p-4 sm:p-5">Payment Status</th>
                  <th className="p-4 sm:p-5">Completed On</th>
                  <th className="p-4 sm:p-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {filteredInvoices.map((inv) => {
                  const partsVal = parseFloat(inv.parts_total || 0);
                  const labourVal = parseFloat(inv.labour_charge || 0);
                  const discountVal = parseFloat(inv.discount_amount || inv.discount || 0);
                  const grossSubtotal = (partsVal + labourVal > 0) ? (partsVal + labourVal) : (parseFloat(inv.grand_total || inv.total_amount || 0) + discountVal);
                  const netTotal = parseFloat(inv.grand_total || inv.total_amount || Math.max(0, grossSubtotal - discountVal));
                  const rawPaid = parseFloat(inv.paid_amount !== undefined && inv.paid_amount !== null ? inv.paid_amount : (inv.received_amount !== undefined && inv.received_amount !== null ? inv.received_amount : (inv.payment_status === 'PAID' ? netTotal : 0)));
                  const clampedPaid = Math.min(netTotal, Math.max(0, rawPaid));
                  const pendingVal = Math.max(0, netTotal - clampedPaid);

                  return (
                    <tr key={inv.id} className="hover:bg-blue-50/40 transition-colors">
                      <td className="p-4 sm:p-5 min-w-56">
                        <span className="font-extrabold text-slate-900 text-sm block">{inv.customer_name}</span>
                        <span className="inline-flex mt-1 rounded-md bg-slate-100 px-2 py-1 text-[11px] text-slate-600 font-mono font-bold">
                          {inv.vehicle_number} <span className="mx-1 text-slate-300">•</span> {inv.bike_model}
                        </span>
                      </td>
                      <td className="p-4 sm:p-5 font-bold text-slate-800 font-poppins text-sm whitespace-nowrap">
                        ₹{grossSubtotal.toFixed(2)}
                      </td>
                      <td className="p-4 sm:p-5 whitespace-nowrap">
                        {discountVal > 0 ? (
                          <span className="px-2.5 py-1 rounded-lg text-xs font-black bg-amber-100 text-amber-800 border border-amber-200">
                            -₹{discountVal.toFixed(2)}
                          </span>
                        ) : (
                          <span className="text-xs text-slate-400 font-semibold">—</span>
                        )}
                      </td>
                      <td className="p-4 sm:p-5 font-black text-slate-900 font-poppins text-base whitespace-nowrap">
                        ₹{netTotal.toFixed(2)}
                      </td>
                      <td className="p-4 sm:p-5 font-black text-emerald-600 font-poppins text-base whitespace-nowrap">
                        ₹{clampedPaid.toFixed(2)}
                      </td>
                      <td className="p-4 sm:p-5">
                        <span className={`px-3 py-1 rounded-full text-[11px] font-extrabold uppercase ${
                          pendingVal <= 0
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                            : clampedPaid > 0
                              ? 'bg-purple-100 text-purple-800 border border-purple-200'
                              : 'bg-amber-100 text-amber-800 border border-amber-200'
                        }`}>
                          {pendingVal <= 0 ? 'PAID' : clampedPaid > 0 ? `PARTIAL (₹${pendingVal.toFixed(0)} Pending)` : 'PENDING'}
                        </span>
                      </td>
                      <td className="p-4 sm:p-5 text-slate-500 font-semibold text-xs whitespace-nowrap">
                        {formatDateDMY(inv.created_at || inv.visit_date)}
                      </td>
                      <td className="p-4 sm:p-5 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => handleDownloadInvoicePhoto(inv)}
                            disabled={sharingPhoto}
                            className="h-9 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 shadow-sm transition-all hover:scale-105 whitespace-nowrap cursor-pointer"
                            title="Download bill photo"
                          >
                            <Download className="w-3.5 h-3.5" /> Download
                          </button>

                          <button
                            type="button"
                            onClick={() => handleOpenWhatsAppChat(inv)}
                            className="h-9 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 shadow-sm transition-all hover:scale-105 whitespace-nowrap"
                            title="Open WhatsApp Chat"
                          >
                            <Send className="w-3.5 h-3.5" /> WhatsApp
                          </button>

                          <button
                            type="button"
                            onClick={() => setDeleteModal({ isOpen: true, invoice: inv })}
                            className="h-9 w-9 bg-slate-100 hover:bg-rose-100 text-slate-500 hover:text-rose-600 rounded-xl flex items-center justify-center transition-colors"
                            title="Delete payment record"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

            {/* PROFESSIONAL INVOICE PHOTO CARD VIEW MODAL */}
      {showModal && selectedInvoice && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex justify-center items-start p-4 sm:p-6 overflow-y-auto">
          <div className="bg-slate-900 text-white rounded-3xl p-6 sm:p-8 max-w-2xl w-full space-y-6 shadow-2xl border border-slate-800 my-4 sm:my-8 relative">
            
            {/* STICKY TOP ACTION BAR */}
            <div className="sticky top-0 z-30 bg-slate-900/95 backdrop-blur-md border-b border-slate-800 pb-4 pt-1 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <h2 className="text-xl font-bold font-poppins flex items-center gap-2 text-white">
                  <ImageIcon className="w-5 h-5 text-amber-400" /> Bill Photo Card
                </h2>
                <p className="text-xs text-slate-400">Patel Automobiles HD Bill Photo Card</p>
              </div>

              <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() => handleDownloadInvoicePhoto(selectedInvoice)}
                  disabled={sharingPhoto}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-lg transition-all flex items-center gap-1.5"
                >
                  <Download className="w-4 h-4" />
                  <span>Download</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleOpenWhatsAppChat(selectedInvoice)}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-lg transition-all flex items-center gap-1.5"
                >
                  <Send className="w-4 h-4" />
                  <span>WhatsApp</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl transition-all"
                >
                  Close
                </button>
              </div>
            </div>

            {/* SINGLE GENERATED HD BILL PHOTO CARD / INTERACTIVE CARD DISPLAY */}
            <div className="bg-slate-950 p-2 sm:p-4 rounded-3xl border border-slate-800 flex flex-col items-center justify-center">
              <div className="w-full bg-white text-slate-900 p-6 sm:p-8 rounded-2xl space-y-5 shadow-xl border border-slate-200 text-xs font-sans">
                {/* HEADER */}
                <div className="flex justify-between items-start border-b-2 border-amber-500 pb-4">
                  <div className="flex items-center gap-3">
                    <img
                      src={garageInfo?.logo && garageInfo.logo !== '/logo.png' ? garageInfo.logo : LOGO_BASE64}
                      alt="Logo"
                      className="w-12 h-12 rounded-xl object-cover border-2 border-amber-400 shadow-md shrink-0"
                    />
                    <div>
                      <h4 className="text-lg font-black text-slate-900 font-poppins">{garageInfo?.garage_name || 'Patel Automobiles'}</h4>
                      <p className="text-[11px] text-slate-600 font-medium">{garageInfo?.address || 'Near Dandi Pond, Dandi, Valsad, Gujarat - 396385'}</p>
                      <p className="text-[11px] font-bold text-slate-800 font-mono mt-0.5">📞 {garageInfo?.phone || '+91 81403 71414'}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className={`px-3 py-1 font-extrabold rounded-full text-[10px] uppercase tracking-wider inline-block ${
                      parseFloat(selectedInvoice.pending_amount || 0) > 0 ? 'bg-rose-600 text-white' : 'bg-emerald-600 text-white'
                    }`}>
                      {parseFloat(selectedInvoice.pending_amount || 0) > 0 ? 'DUES PENDING' : 'PAID IN FULL'}
                    </span>
                    <p className="text-[10px] font-mono text-slate-500 mt-1">Invoice: {selectedInvoice.invoice_number || `INV-${String(selectedInvoice.id).slice(-4)}`}</p>
                  </div>
                </div>

                {/* CUSTOMER & VEHICLE DETAILS */}
                <div className="grid grid-cols-2 gap-3 p-3.5 rounded-xl bg-amber-500/5 border border-amber-200">
                  <div>
                    <span className="text-[10px] font-bold text-amber-700 uppercase tracking-wider block">Customer Details</span>
                    <strong className="text-slate-900 text-sm block">{selectedInvoice.customer_name}</strong>
                    <span className="text-slate-700 font-bold font-mono text-[11px]">📞 {selectedInvoice.mobile_number || selectedInvoice.customer_mobile || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-amber-700 uppercase tracking-wider block">Vehicle Details</span>
                    <strong className="text-amber-700 text-sm font-mono block">{selectedInvoice.vehicle_number}</strong>
                    <span className="text-slate-600 font-medium text-[11px]">{selectedInvoice.bike_model || 'Two Wheeler'}</span>
                  </div>
                </div>

                {/* PARTS & SERVICES TABLE */}
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-900 text-amber-300 font-bold uppercase tracking-wider text-[10px]">
                      <th className="p-2.5 rounded-l-lg">Description</th>
                      <th className="p-2.5 text-center">Qty</th>
                      <th className="p-2.5 text-right">Price</th>
                      <th className="p-2.5 text-right rounded-r-lg">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {selectedInvoice.parts && selectedInvoice.parts.length > 0 ? (
                      selectedInvoice.parts.map((part, idx) => {
                        if (!part) return null;
                        const partQty = parseInt(part.quantity || 1, 10);
                        const partUnitPrice = parseFloat(part.unit_price || part.price || 0);
                        const partTotal = parseFloat(part.staged_total || (partUnitPrice * partQty));
                        return (
                          <tr key={idx}>
                            <td className="p-2.5 font-bold text-slate-800">{cleanPartName(part.part_name || part.name || 'Spare Part')}</td>
                            <td className="p-2.5 text-center font-mono">{partQty}</td>
                            <td className="p-2.5 text-right font-mono">₹{partUnitPrice.toFixed(2)}</td>
                            <td className="p-2.5 text-right font-mono font-bold">₹{partTotal.toFixed(2)}</td>
                          </tr>
                        );
                      })
                    ) : null}

                    {parseFloat(selectedInvoice.labour_charge || 0) > 0 && (
                      <tr>
                        <td className="p-2.5 font-bold text-slate-900">Labour Service Charge</td>
                        <td className="p-2.5 text-center font-mono">1</td>
                        <td className="p-2.5 text-right font-mono">₹{parseFloat(selectedInvoice.labour_charge || 0).toFixed(2)}</td>
                        <td className="p-2.5 text-right font-mono font-bold">₹{parseFloat(selectedInvoice.labour_charge || 0).toFixed(2)}</td>
                      </tr>
                    )}
                  </tbody>
                </table>

                {/* SUMMARY & QR SCANNER */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center bg-slate-50 p-4 rounded-xl border border-slate-200">
                  {parseFloat(selectedInvoice.pending_amount || 0) > 0 ? (() => {
                    const pendingAmtStr = parseFloat(selectedInvoice.pending_amount || 0).toFixed(2);
                    const upiId = garageInfo?.upi_id || '';
                    const payeeName = garageInfo?.upi_payee_name || garageInfo?.garage_name || 'Patel Automobiles';
                    const rawInvId = String(selectedInvoice.invoice_number || selectedInvoice.id || 'bill').slice(-8);
                    const fixedUpiUri = upiId ? `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(payeeName)}&am=${encodeURIComponent(pendingAmtStr)}&cu=INR&tn=${encodeURIComponent(`Invoice ${rawInvId}`)}` : '';
                    const dynamicQrImage = upiId ? `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(fixedUpiUri)}` : '';
                    const qrSrc = (garageInfo?.upi_qr_code && garageInfo.upi_qr_code.trim() !== '' && !garageInfo.upi_qr_code.includes('undefined')) ? garageInfo.upi_qr_code : (dynamicQrImage || '/upi_qr.jpg');

                    return (
                      <div className="flex flex-col items-center justify-center p-3 bg-white rounded-xl border border-slate-300 shadow-sm text-center">
                        <a
                          href={fixedUpiUri}
                          title={`Click to Pay ₹${pendingAmtStr} directly via GPay / UPI`}
                          target="_blank"
                          rel="noreferrer"
                          className="block p-1 bg-white hover:scale-105 transition-transform"
                        >
                          <img
                            src={qrSrc}
                            alt={`UPI QR Scanner ₹${pendingAmtStr}`}
                            onError={(e) => { e.target.onerror = null; e.target.src = '/upi_qr.jpg'; }}
                            className="w-36 h-36 object-contain mx-auto"
                          />
                        </a>
                        <span className="text-[10px] font-black text-slate-900 mt-1 uppercase tracking-wide">
                          Scan & Pay Dues: <strong className="text-rose-600">₹{pendingAmtStr}</strong>
                        </span>
                        <span className="text-[10px] font-mono text-emerald-700 font-extrabold">{upiId}</span>
                      </div>
                    );
                  })() : (
                    <div className="space-y-1 text-xs p-2">
                      <p className="text-slate-500">Date: <strong className="text-slate-800">{formatDateDMY(selectedInvoice.created_at || selectedInvoice.visit_date)}</strong></p>
                      <p className="text-slate-500">Payment Status: <strong className="text-emerald-600 font-extrabold">Paid in Full (No Dues)</strong></p>
                    </div>
                  )}

                  <div className="space-y-2 text-xs font-bold">
                    <div className="flex justify-between text-slate-700">
                      <span>Date:</span>
                      <span className="font-mono text-slate-800">{formatDateDMY(selectedInvoice.created_at || selectedInvoice.visit_date)}</span>
                    </div>
                    <div className="flex justify-between text-slate-700">
                      <span>Grand Total:</span>
                      <span className="font-mono text-slate-900 text-sm">₹{parseFloat(selectedInvoice.grand_total || selectedInvoice.total_amount || 0).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-emerald-700">
                      <span>Paid Amount:</span>
                      <span className="font-mono">₹{parseFloat(selectedInvoice.paid_amount || 0).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-rose-600 pt-1 border-t border-slate-200">
                      <span>Pending Due:</span>
                      <span className="font-mono text-sm font-black">₹{parseFloat(selectedInvoice.pending_amount || 0).toFixed(2)}</span>
                    </div>
                  </div>
                </div>

                {/* SAFETY FOOTER */}
                <div className="pt-3 border-t border-dashed border-amber-300 text-center bg-amber-500/10 rounded-xl p-3 space-y-1">
                  <p className="text-[11px] font-black text-slate-900 font-poppins">
                    {garageInfo?.safety_message || 'Thank you for choosing us! Wish you a safe & smooth ride. 🛵⛑️'}
                  </p>
                  <p className="text-[11px] font-bold text-slate-700 font-mono">
                    📞 Contact: {garageInfo?.phone || '+91 81403 71414'}
                  </p>
                  <p className="text-[11px] font-black text-slate-900 font-poppins">
                    — {garageInfo?.garage_name || 'Patel Automobiles'}
                  </p>
                </div>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* OFFSCREEN CAPTURE CARD FOR WHATSAPP PHOTO */}
      {selectedInvoice && (
        <div style={{ position: 'fixed', left: '-9999px', top: '0', width: '600px', pointerEvents: 'none', opacity: 0 }}>
          <div
            ref={offscreenInvoiceRef}
            className="bg-white text-slate-900 p-8 rounded-2xl max-w-xl mx-auto space-y-6 shadow-xl border border-slate-200"
          >
            <div className="flex justify-between items-start border-b-2 border-amber-500 pb-6">
              <div className="flex items-center gap-3.5">
                <img
                  src={garageInfo?.logo && garageInfo.logo !== '/logo.png' ? garageInfo.logo : LOGO_BASE64}
                  alt="Logo"
                  className="w-14 h-14 rounded-xl object-cover border-2 border-amber-400 shadow-md shrink-0"
                />
                <div>
                  <h2 className="text-2xl font-black text-slate-900 font-poppins tracking-tight">
                    {garageInfo?.garage_name || 'Patel Automobiles'}
                  </h2>
                  <p className="text-xs text-slate-600 font-medium leading-relaxed mt-0.5">
                    {garageInfo?.address || 'Near Dandi Pond, Dandi, Valsad, Gujarat - 396385'}
                  </p>
                  <p className="text-xs font-bold text-slate-800 font-mono mt-0.5 whitespace-nowrap">
                    📞 {garageInfo?.phone || '+91 81403 71414'}
                  </p>
                </div>
              </div>
              <div className="text-right font-mono text-xs text-slate-500 pt-2 shrink-0">
                Date: {formatDateDMY(selectedInvoice.created_at || selectedInvoice.visit_date)}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 p-4 rounded-2xl bg-amber-500/5 border border-amber-200 text-xs">
              <div>
                <span className="text-[10px] font-bold text-amber-700 uppercase tracking-wider block">Customer Details</span>
                <span className="font-extrabold text-slate-900 text-sm block">{selectedInvoice.customer_name}</span>
                <span className="text-slate-700 font-bold font-mono text-xs block mt-0.5 whitespace-nowrap">
                  📞 {selectedInvoice.customer_mobile || selectedInvoice.mobile_number || selectedInvoice.service_job?.mobile_number || garageInfo?.phone || '+91 81403 71414'}
                </span>
              </div>
              <div>
                <span className="text-[10px] font-bold text-amber-700 uppercase tracking-wider block">Vehicle Information</span>
                <span className="font-black text-slate-900 text-sm font-mono block">
                  {selectedInvoice.vehicle_number} ({selectedInvoice.bike_model})
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
                {selectedInvoice.service_job?.parts_used && selectedInvoice.service_job.parts_used.length > 0 ? (
                  selectedInvoice.service_job.parts_used.map((part, idx) => (
                    <tr key={idx}>
                      <td className="p-3 font-bold text-slate-800">{cleanPartName(part.part_name)}</td>
                      <td className="p-3 text-center font-mono">{part.quantity}</td>
                      <td className="p-3 text-right font-mono">₹{parseFloat(part.unit_price || 0).toFixed(2)}</td>
                      <td className="p-3 text-right font-mono font-bold">₹{parseFloat(part.subtotal || 0).toFixed(2)}</td>
                    </tr>
                  ))
                ) : null}

                {parseFloat(selectedInvoice.service_job?.labour_charge || selectedInvoice.labour_charge || 0) > 0 && (
                  <tr>
                    <td className="p-3 font-bold text-slate-900">Labour Service Charge</td>
                    <td className="p-3 text-center font-mono">1</td>
                    <td className="p-3 text-right font-mono">₹{parseFloat(selectedInvoice.service_job?.labour_charge || selectedInvoice.labour_charge || 0).toFixed(2)}</td>
                    <td className="p-3 text-right font-mono font-bold">₹{parseFloat(selectedInvoice.service_job?.labour_charge || selectedInvoice.labour_charge || 0).toFixed(2)}</td>
                  </tr>
                )}
              </tbody>
            </table>

            <div className={`grid ${parseFloat(selectedInvoice.pending_amount || 0) > 0 ? 'grid-cols-2' : 'grid-cols-1'} gap-4 items-center bg-slate-50 p-3.5 rounded-2xl border border-slate-200 pt-4`}>
              {parseFloat(selectedInvoice.pending_amount || 0) > 0 && (() => {
                const pendingAmtStr = parseFloat(selectedInvoice.pending_amount || 0).toFixed(2);
                const upiId = garageInfo?.upi_id || '';
                const payeeName = garageInfo?.upi_payee_name || garageInfo?.garage_name || 'Patel Automobiles';
                const fixedUpiUri = `upi://pay?pa=${upiId}&pn=${encodeURIComponent(payeeName)}&am=${pendingAmtStr}&cu=INR&tn=${encodeURIComponent(`Invoice Payment #${selectedInvoice.id || ''}`)}`;
                const dynamicQrImage = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(fixedUpiUri)}`;

                return (
                  <div className="flex flex-col items-center justify-center p-3 bg-white rounded-2xl border border-slate-300 shadow-sm text-center">
                    <a
                      href={fixedUpiUri}
                      title={`Click to Pay ₹${pendingAmtStr} directly via GPay / UPI`}
                      target="_blank"
                      rel="noreferrer"
                      className="block p-1 bg-white hover:scale-105 transition-transform"
                    >
                      <img
                        src={dynamicQrImage}
                        alt={`Fixed Price UPI QR Code ₹${pendingAmtStr}`}
                        onError={(e) => { e.target.onerror = null; e.target.src = '/upi_qr.jpg'; }}
                        className="w-48 h-48 sm:w-56 sm:h-56 object-contain"
                      />
                    </a>
                    <span className="text-[11px] font-black text-slate-900 mt-1 uppercase tracking-wide">
                      Scan &amp; Pay Fixed Amount: <strong className="text-amber-600">₹{pendingAmtStr}</strong>
                    </span>
                    <span className="text-[11px] font-mono text-emerald-700 font-extrabold">{upiId}</span>
                  </div>
                );
              })()}
              <div className="space-y-1.5 text-xs font-bold">
                <div className="flex justify-between text-slate-700">
                  <span>Grand Total:</span>
                  <span className="font-mono text-slate-900">₹{parseFloat(selectedInvoice.grand_total || 0).toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-emerald-700">
                  <span>Paid Amount:</span>
                  <span className="font-mono">₹{parseFloat(selectedInvoice.paid_amount || 0).toFixed(2)}</span>
                </div>
                {parseFloat(selectedInvoice.pending_amount || 0) > 0 && (
                  <div className="flex justify-between text-amber-700">
                    <span>Balance Due:</span>
                    <span className="font-mono">₹{parseFloat(selectedInvoice.pending_amount || 0).toFixed(2)}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="mt-5 pt-4 border-t border-dashed border-amber-300 text-center bg-amber-500/10 rounded-2xl p-4 space-y-1">
              <p className="text-xs font-black text-slate-900 font-poppins">
                {garageInfo?.safety_message || 'Thank you for choosing us! Wish you a safe & smooth ride. 🛵⛑️'}
              </p>
              <p className="text-xs font-bold text-slate-700 font-mono pt-1">
                📞 Contact: {garageInfo?.phone || '+91 81403 71414'}
              </p>
              <p className="text-xs font-black text-slate-900 font-poppins">
                — {garageInfo?.garage_name || 'Patel Automobiles'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* PASSWORD MODAL */}
      <AdminPasswordModal
        isOpen={deleteModal.isOpen}
        onClose={() => setDeleteModal({ isOpen: false, invoice: null })}
        onConfirm={handleDeleteWithPassword}
        title="Delete Payment Record"
        itemDescription={`payment record for ${deleteModal.invoice?.customer_name || 'customer'}`}
      />

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

    </div>
  );
}
