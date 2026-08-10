import React, { useState, useEffect, useRef, useMemo } from 'react';
import { BookOpen, Send, CheckCircle2, IndianRupee, Phone, Bike, Search, Camera, AlertCircle, QrCode, Image as ImageIcon, Wrench, Eye, Download, Sparkles, Printer, Calendar, Filter, Trash2 } from 'lucide-react';
import API from '../services/api';
import { useAuth } from '../context/AuthContext';
import { generateBillCanvasDataUrl, generateBillCanvasDataUrlAsync, generateBillCanvasBlob } from '../utils/billCardGenerator';

import { fetchCloudKhataEntries, fetchCloudInvoices, fetchCloudJobs, pushCloudKhataEntry, pushCloudRecycleBinItem, markIdAsDeleted, deleteCloudKhataEntry, fetchCloudDeletedIds, atomicRecordPayment } from '../utils/cloudSync';
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

  const fetchKhata = async (isInitial = false) => {
    if (isInitial) setLoading(true);
    try {
      let backendData = null;
      try {
        const res = await API.get('/khata-book/', { timeout: 1200 });
        backendData = res.data;
      } catch (err) {
        console.warn('Backend API offline for Khata, aggregating from local and cloud stores:', err);
      }

      const deletedIds = await fetchCloudDeletedIds().catch(() => []);

      // Read all records across stores safely
      const localKhata = JSON.parse(localStorage.getItem('khata_entries') || '[]').filter(k => k && !deletedIds.includes(String(k.id)));
      const cloudKhata = (await fetchCloudKhataEntries().catch(() => [])).filter(k => k && !deletedIds.includes(String(k.id)));
      const combinedKhata = [...localKhata, ...cloudKhata];

      const localInvs = JSON.parse(localStorage.getItem('local_invoices') || '[]').filter(i => i && !deletedIds.includes(String(i.id)) && !deletedIds.includes(String(i.invoice_number)));
      const cloudInvs = (await fetchCloudInvoices().catch(() => [])).filter(i => i && !deletedIds.includes(String(i.id)) && !deletedIds.includes(String(i.invoice_number)));
      
      const invMap = new Map();
      [...localInvs, ...cloudInvs].forEach(inv => {
        if (inv && (inv.id || inv.job_id || inv.invoice_number)) {
          const key = String(inv.job_id || inv.id || inv.invoice_number);
          const existing = invMap.get(key);
          if (!existing) {
            invMap.set(key, inv);
          } else {
            const exPending = parseFloat(existing.pending_amount !== undefined ? existing.pending_amount : (parseFloat(existing.grand_total || existing.total_amount || 0) - parseFloat(existing.paid_amount || 0)));
            const curPending = parseFloat(inv.pending_amount !== undefined ? inv.pending_amount : (parseFloat(inv.grand_total || inv.total_amount || 0) - parseFloat(inv.paid_amount || 0)));
            if (curPending < exPending || (inv.paid_amount && !existing.paid_amount)) {
              invMap.set(key, inv);
            }
          }
        }
      });
      const combinedInvs = Array.from(invMap.values());

      const allJobs = JSON.parse(localStorage.getItem('workshop_jobs') || '[]').filter(j => j && !deletedIds.includes(String(j.id)));
      const cloudJobs = (await fetchCloudJobs().catch(() => [])).filter(j => j && !deletedIds.includes(String(j.id)));
      const combinedJobs = [...allJobs, ...cloudJobs];
      const finishedJobs = combinedJobs.filter(j => j && (j.status === 'FINISHED' || j.status === 'COMPLETED'));

      const legacyDebtors = backendData?.debtors || JSON.parse(localStorage.getItem('khata_debtors') || '[]');

      const khataList = [];

      // 1. Process Invoices
      combinedInvs.forEach(inv => {
        if (!inv || deletedIds.includes(String(inv.id)) || deletedIds.includes(String(inv.invoice_number))) return;
        const partsVal = parseFloat(inv.parts_total || 0);
        const labourVal = parseFloat(inv.labour_charge || 0);
        const discountVal = parseFloat(inv.discount_amount || 0);
        const totalVal = parseFloat(inv.grand_total || inv.total_amount || Math.max(0, partsVal + labourVal - discountVal));
        let paidVal = parseFloat(inv.paid_amount || 0);
        const statusStr = String(inv.payment_status || inv.status || '').toUpperCase();
        
        let pendingVal = 0;
        if (inv.pending_amount !== undefined && inv.pending_amount !== null) {
          pendingVal = parseFloat(inv.pending_amount || 0);
        } else {
          pendingVal = Math.max(0, totalVal - paidVal);
        }

        if (statusStr === 'PAID' && pendingVal === 0) return;

        if (pendingVal > 0 || statusStr === 'UNPAID' || statusStr === 'PARTIAL') {
          const actualPending = pendingVal > 0 ? pendingVal : Math.max(0, totalVal - paidVal);
          if (actualPending <= 0 && statusStr === 'PAID') return;

          const itemDate = inv.created_at || inv.date || new Date().toISOString();
          const formattedDate = new Date(itemDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
          khataList.push({
            id: String(inv.id),
            invoice_id: inv.id,
            invoice_number: inv.invoice_number || `INV-${String(inv.id).slice(-4)}`,
            customer_name: inv.customer_name || 'Valued Customer',
            phone: inv.mobile_number || inv.phone || 'N/A',
            mobile_number: inv.mobile_number || inv.phone || 'N/A',
            vehicle_number: inv.vehicle_number || 'GJ-15',
            bike_model: inv.bike_model || 'Two Wheeler',
            total_billed: totalVal,
            total_paid: paidVal,
            pending_amount: actualPending > 0 ? actualPending : Math.max(0, totalVal - paidVal),
            balance: actualPending > 0 ? actualPending : Math.max(0, totalVal - paidVal),
            visit_date: formattedDate,
            raw_date: itemDate,
            parts: inv.parts || [],
            labour_charge: labourVal
          });
        }
      });

      // 2. Process Finished Jobs not in invoices
      finishedJobs.forEach(job => {
        if (!job || deletedIds.includes(String(job.id))) return;
        const alreadyInInvoices = combinedInvs.some(i => String(i.job_id) === String(job.id) || String(i.id) === `inv_${job.id}`);
        if (alreadyInInvoices) return;

        const partsVal = parseFloat(job.parts_total || 0);
        const labourVal = parseFloat(job.labour_charge || 0);
        const discountVal = parseFloat(job.discount_amount || 0);
        const totalVal = parseFloat(job.grand_total || job.live_total || Math.max(0, partsVal + labourVal - discountVal));
        let paidVal = parseFloat(job.paid_amount || 0);
        const statusStr = String(job.payment_status || job.status || '').toUpperCase();
        if (statusStr === 'PAID' && paidVal === 0) paidVal = totalVal;

        const pendingVal = Math.max(0, totalVal - paidVal);
        if (pendingVal > 0) {
          const itemDate = job.finished_at || job.completed_at || job.created_at || new Date().toISOString();
          const formattedDate = new Date(itemDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
          khataList.push({
            id: String(job.id),
            invoice_id: job.id,
            invoice_number: `INV-${String(job.id).slice(-4)}`,
            customer_name: job.customer_name || 'Valued Customer',
            phone: job.mobile_number || job.phone || 'N/A',
            mobile_number: job.mobile_number || job.phone || 'N/A',
            vehicle_number: job.vehicle_number || 'GJ-15',
            bike_model: job.bike_model || 'Two Wheeler',
            total_billed: totalVal,
            total_paid: paidVal,
            pending_amount: pendingVal,
            balance: pendingVal,
            visit_date: formattedDate,
            raw_date: itemDate,
            parts: job.parts || [],
            labour_charge: labourVal
          });
        }
      });

      // 3. Process All Khata Debit Entries
      combinedKhata.forEach(k => {
        if (!k || deletedIds.includes(String(k.id))) return;
        const alreadyInList = khataList.some(item => String(item.id) === String(k.id) || (k.job_id && String(item.id) === String(k.job_id)));
        if (alreadyInList) return;

        const amt = parseFloat(k.amount || 0);
        if (amt > 0 && k.type === 'DEBIT') {
          const itemDate = k.date || new Date().toISOString();
          const formattedDate = new Date(itemDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
          khataList.push({
            id: String(k.id),
            invoice_id: k.job_id || k.id,
            invoice_number: k.job_id ? `INV-${String(k.job_id).slice(-4)}` : `KHATA-${String(k.id).slice(-4)}`,
            customer_name: k.customer_name || 'Valued Customer',
            phone: k.mobile_number || k.phone || 'N/A',
            mobile_number: k.mobile_number || k.phone || 'N/A',
            vehicle_number: k.vehicle_number || 'GJ-15',
            bike_model: k.bike_model || 'Two Wheeler',
            total_billed: amt,
            total_paid: 0,
            pending_amount: amt,
            balance: amt,
            visit_date: formattedDate,
            raw_date: itemDate,
            parts: [],
            labour_charge: 0
          });
        }
      });

      // Strictly deduplicate khataList so no bill/visit appears twice
      const uniqueKhataMap = new Map();
      khataList.forEach(item => {
        const rawId = String(item.invoice_id || item.id || '').replace(/^inv_/, '').replace(/^khata_/, '');
        const veh = (item.vehicle_number || '').replace(/[^A-Za-z0-9]/g, '').toUpperCase();
        const key = rawId ? `id_${rawId}` : `veh_${veh}_${item.total_billed}_${item.visit_date}`;

        if (!uniqueKhataMap.has(key)) {
          uniqueKhataMap.set(key, item);
        } else {
          const existing = uniqueKhataMap.get(key);
          if ((!existing.parts || existing.parts.length === 0) && item.parts && item.parts.length > 0) {
            existing.parts = item.parts;
          }
          if (item.labour_charge && !existing.labour_charge) {
            existing.labour_charge = item.labour_charge;
          }
        }
      });
      const finalKhataList = Array.from(uniqueKhataMap.values());

      setDebtors(finalKhataList);
      setTotalPending(finalKhataList.reduce((sum, item) => sum + item.pending_amount, 0));
    } catch (err) {
      console.error('Error fetching Khata debtors:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchKhata(true);
    const interval = setInterval(() => {
      fetchKhata(false);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  const parseSafelyDate = (dateStr) => {
    if (!dateStr) return new Date();
    if (dateStr instanceof Date) return dateStr;
    const str = String(dateStr).trim();
    if (str.includes('/')) {
      const parts = str.split('/');
      if (parts.length === 3) {
        const p1 = parseInt(parts[0], 10);
        const p2 = parseInt(parts[1], 10);
        const p3 = parseInt(parts[2], 10);
        if (p2 <= 12 && p1 <= 31) {
          return new Date(p3, p2 - 1, p1);
        }
      }
    }
    const d = new Date(str);
    return isNaN(d.getTime()) ? new Date() : d;
  };

  const availableYears = useMemo(() => {
    const currentY = new Date().getFullYear();
    const years = debtors
      .map((d) => parseSafelyDate(d.raw_date || d.visit_date || d.created_at).getFullYear())
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
      if (filterMode === 'ALL') return true;

      const dateObj = parseSafelyDate(d.raw_date || d.visit_date || d.created_at);
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
    if (!customer) return;
    setSelectedCustomer(customer);
    const rawVal = customer.pending_amount !== undefined ? customer.pending_amount : (customer.balance || 0);
    const cleanNum = parseFloat(String(rawVal).replace(/[^0-9.]/g, '')) || 0;
    setPayAmount(cleanNum > 0 ? cleanNum : 0);
  };

  const openStatementModal = (customer) => {
    if (!customer) return;
    setStatementCustomer(customer);
    setShowStatementModal(true);
    setStatementPreviewUrl(null);
  };

  const handleRecordPayment = (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (!selectedCustomer) return;

    const paymentNum = parseFloat(payAmount) || 0;
    if (paymentNum <= 0) {
      alert('⚠️ Please enter a valid payment amount greater than ₹0!');
      return;
    }

    const targetId = String(selectedCustomer.invoice_id || selectedCustomer.id || '');
    const rawId = targetId.replace(/^inv_/, '').replace(/^khata_/, '');
    const vehNum = (selectedCustomer.vehicle_number || '').replace(/[^A-Za-z0-9]/g, '').toUpperCase();
    const invNum = selectedCustomer.invoice_number || '';

    // 1. Update Local Invoices
    const localInvoices = JSON.parse(localStorage.getItem('local_invoices') || '[]');
    let targetUpdatedInv = null;
    const updatedInvoices = localInvoices.map(inv => {
      if (!inv) return inv;
      const curInvId = String(inv.id || '');
      const curJobId = String(inv.job_id || '');
      const curVeh = (inv.vehicle_number || '').replace(/[^A-Za-z0-9]/g, '').toUpperCase();
      const isMatch = (curInvId === targetId || curInvId === `inv_${rawId}` || curJobId === rawId || (invNum && inv.invoice_number === invNum) || (vehNum && curVeh === vehNum && (parseFloat(inv.pending_amount || 0) > 0)));

      if (isMatch) {
        const total = parseFloat(inv.grand_total || inv.total_amount || 0);
        const oldPaid = parseFloat(inv.paid_amount || 0);
        const newPaid = oldPaid + paymentNum;
        const newPending = Math.max(0, total - newPaid);
        const updatedInv = {
          ...inv,
          paid_amount: newPaid,
          pending_amount: newPending,
          payment_status: newPending === 0 ? 'PAID' : 'PARTIAL'
        };
        targetUpdatedInv = updatedInv;
        return updatedInv;
      }
      return inv;
    });
    localStorage.setItem('local_invoices', JSON.stringify(updatedInvoices));

    // 2. Update Local Workshop Jobs
    const localJobs = JSON.parse(localStorage.getItem('workshop_jobs') || '[]');
    let targetUpdatedJob = null;
    const updatedJobs = localJobs.map(j => {
      if (!j) return j;
      const curJobId = String(j.id || '');
      const curVeh = (j.vehicle_number || '').replace(/[^A-Za-z0-9]/g, '').toUpperCase();
      const isMatch = (curJobId === rawId || curJobId === targetId || (vehNum && curVeh === vehNum && (j.status === 'FINISHED' || j.status === 'COMPLETED')));

      if (isMatch) {
        const total = parseFloat(j.grand_total || j.live_total || 0);
        const oldPaid = parseFloat(j.paid_amount || 0);
        const newPaid = oldPaid + paymentNum;
        const newPending = Math.max(0, total - newPaid);
        const updatedJob = {
          ...j,
          paid_amount: newPaid,
          pending_amount: newPending,
          payment_status: newPending === 0 ? 'PAID' : 'PARTIAL'
        };
        targetUpdatedJob = updatedJob;
        return updatedJob;
      }
      return j;
    });
    localStorage.setItem('workshop_jobs', JSON.stringify(updatedJobs));

    // 3. Update Local Khata entries
    const localKhata = JSON.parse(localStorage.getItem('khata_entries') || '[]');
    const creditKhataEntry = {
      id: `khata_credit_${Date.now()}`,
      job_id: rawId || targetId,
      customer_name: selectedCustomer.customer_name,
      mobile_number: selectedCustomer.phone || selectedCustomer.mobile_number,
      vehicle_number: selectedCustomer.vehicle_number,
      bike_model: selectedCustomer.bike_model || 'Two Wheeler',
      type: 'CREDIT',
      amount: paymentNum,
      description: `Payment received of ₹${paymentNum} for ${selectedCustomer.invoice_number || 'Bill'}`,
      date: new Date().toISOString()
    };

    const updatedKhataList = localKhata.map(k => {
      if (!k) return k;
      const curKId = String(k.id || '');
      const curKVeh = (k.vehicle_number || '').replace(/[^A-Za-z0-9]/g, '').toUpperCase();
      if ((curKId === targetId || curKId === `khata_${rawId}` || (vehNum && curKVeh === vehNum && k.type === 'DEBIT'))) {
        const curAmt = parseFloat(k.amount || 0);
        const newAmt = Math.max(0, curAmt - paymentNum);
        return { ...k, amount: newAmt };
      }
      return k;
    });
    localStorage.setItem('khata_entries', JSON.stringify([creditKhataEntry, ...updatedKhataList]));

    // 4. ATOMIC SINGLE CLOUD PAYMENT COMMIT (No race conditions!)
    atomicRecordPayment({
      updatedInvoice: targetUpdatedInv,
      updatedJob: targetUpdatedJob,
      creditKhataEntry: creditKhataEntry,
      paymentAmount: paymentNum,
      targetId: targetId,
      vehicleNumber: selectedCustomer.vehicle_number
    }).catch(console.warn);

    localStorage.setItem('khata_entries', JSON.stringify([creditKhataEntry, ...updatedKhataList]));

    // Push to backend asynchronously without blocking UI
    API.post('/khata-book/record-payment/', {
      invoice_id: selectedCustomer.invoice_id || null,
      customer_id: selectedCustomer.customer_id || null,
      amount: paymentNum
    }, { timeout: 1500 }).catch(console.warn);

    // Instant 0ms UI State Update
    setDebtors(prev => {
      return prev.map(d => {
        const dId = String(d.invoice_id || d.id || '');
        const dVeh = (d.vehicle_number || '').replace(/[^A-Za-z0-9]/g, '').toUpperCase();
        if (dId === targetId || (vehNum && dVeh === vehNum)) {
          const oldPending = parseFloat(d.pending_amount || d.balance || 0);
          const newPending = Math.max(0, oldPending - paymentNum);
          const oldPaid = parseFloat(d.total_paid || 0);
          return {
            ...d,
            pending_amount: newPending,
            balance: newPending,
            total_paid: oldPaid + paymentNum
          };
        }
        return d;
      }).filter(d => (parseFloat(d.pending_amount || d.balance || 0) > 0));
    });

    setTotalPending(prev => Math.max(0, prev - paymentNum));

    alert(`🎉 Payment of ₹${paymentNum} Recorded Successfully!`);
    showToast('🎉 Payment Recorded!', `₹${paymentNum} payment successfully credited!`);
    setSelectedCustomer(null);
    setPayAmount(0);
    fetchKhata();
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
        <div className="fixed inset-0 z-[100] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full space-y-6 shadow-2xl border border-slate-200">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h3 className="text-lg font-bold font-poppins text-slate-900">
                Record Payment for {selectedCustomer.customer_name}
              </h3>
              <button
                type="button"
                onClick={() => setSelectedCustomer(null)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-full hover:bg-slate-100"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleRecordPayment} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Current Pending Dues</label>
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl font-bold font-mono text-lg">
                  ₹{(parseFloat(selectedCustomer?.pending_amount || selectedCustomer?.balance || 0) || 0).toFixed(2)}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Received Payment Amount (₹)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  required
                  autoFocus
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-slate-300 font-mono text-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 text-slate-900 bg-white"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedCustomer(null)}
                  className="flex-1 py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-all"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleRecordPayment}
                  className="flex-1 py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
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
        <div className="fixed inset-0 z-[100] bg-slate-950/80 backdrop-blur-md flex justify-center items-start p-4 sm:p-6 overflow-y-auto">
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

            {/* SINGLE GENERATED HD STATEMENT PHOTO CARD DISPLAY */}
            <div className="bg-slate-950 p-2 sm:p-4 rounded-3xl border border-slate-800 flex flex-col items-center justify-center">
              {statementCustomer && (
                <div className="w-full bg-white text-slate-900 p-6 sm:p-8 rounded-2xl space-y-5 shadow-xl border border-slate-200 text-xs font-sans">
                  {/* HEADER */}
                  <div className="flex justify-between items-start border-b-2 border-amber-500 pb-4">
                    <div className="flex items-center gap-3">
                      <img
                        src={garageInfo?.logo || '/logo.png'}
                        alt="Logo"
                        className="w-12 h-12 rounded-xl object-cover border-2 border-amber-400 shadow-md shrink-0"
                      />
                      <div>
                        <h4 className="text-lg font-black text-slate-900 font-poppins">{garageInfo?.garage_name || 'Patel Automobiles'}</h4>
                        <p className="text-[11px] text-slate-600 font-medium">{garageInfo?.address || 'Near Dandi Pond, Dandi, Valsad, Gujarat - 396385'}</p>
                        <p className="text-[11px] font-bold text-slate-800 font-mono mt-0.5">📞 {garageInfo?.phone || '+91 81403 71414'}</p>
                      </div>
                    </div>
                    <span className="px-3 py-1 bg-rose-600 text-white font-extrabold rounded-full text-[10px] uppercase tracking-wider shrink-0">
                      DUES PENDING
                    </span>
                  </div>

                  {/* CUSTOMER & VEHICLE DETAILS */}
                  <div className="grid grid-cols-2 gap-3 p-3.5 rounded-xl bg-amber-500/5 border border-amber-200">
                    <div>
                      <span className="text-[10px] font-bold text-amber-700 uppercase tracking-wider block">Customer Details</span>
                      <strong className="text-slate-900 text-sm block">{statementCustomer.customer_name}</strong>
                      <span className="text-slate-700 font-bold font-mono text-[11px]">📞 {statementCustomer.phone || statementCustomer.mobile_number || 'N/A'}</span>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-amber-700 uppercase tracking-wider block">Vehicle Details</span>
                      <strong className="text-amber-700 text-sm font-mono block">{statementCustomer.vehicle_number}</strong>
                      <span className="text-slate-600 font-medium text-[11px]">{statementCustomer.bike_model || 'Two Wheeler'}</span>
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
                      {statementCustomer.parts && statementCustomer.parts.length > 0 ? (
                        statementCustomer.parts.map((part, idx) => {
                          if (!part) return null;
                          return (
                            <tr key={idx}>
                              <td className="p-2.5 font-bold text-slate-800">{cleanPartName(part.part_name || part.name || 'Spare Part')}</td>
                              <td className="p-2.5 text-center font-mono">{part.quantity || 1}</td>
                              <td className="p-2.5 text-right font-mono">₹{parseFloat(part.unit_price || part.price || 0).toFixed(2)}</td>
                              <td className="p-2.5 text-right font-mono font-bold">₹{parseFloat(part.subtotal || ((part.price || 0) * (part.quantity || 1)) || 0).toFixed(2)}</td>
                            </tr>
                          );
                        })
                      ) : null}

                      {parseFloat(statementCustomer.labour_charge || 0) > 0 && (
                        <tr>
                          <td className="p-2.5 font-bold text-slate-900">Labour Service Charge</td>
                          <td className="p-2.5 text-center font-mono">1</td>
                          <td className="p-2.5 text-right font-mono">₹{parseFloat(statementCustomer.labour_charge || 0).toFixed(2)}</td>
                          <td className="p-2.5 text-right font-mono font-bold">₹{parseFloat(statementCustomer.labour_charge || 0).toFixed(2)}</td>
                        </tr>
                      )}
                    </tbody>
                  </table>

                  {/* SUMMARY & UPI QR CODE */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center bg-slate-50 p-4 rounded-xl border border-slate-200">
                    {parseFloat(statementCustomer?.pending_amount || statementCustomer?.balance || 0) > 0 && (() => {
                      const pendingAmtStr = (parseFloat(statementCustomer?.pending_amount !== undefined ? statementCustomer.pending_amount : (statementCustomer?.balance || 0)) || 0).toFixed(2);
                      const upiId = garageInfo?.upi_id || 'pritpatel9397@oksbi';
                      const payeeName = garageInfo?.upi_payee_name || garageInfo?.garage_name || 'Patel Automobiles';
                      const rawCustId = String(statementCustomer?.id || statementCustomer?.vehicle_number || 'bill').slice(-8);
                      const fixedUpiUri = `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(payeeName)}&am=${encodeURIComponent(pendingAmtStr)}&cu=INR&tn=${encodeURIComponent(`Dues Payment ${rawCustId}`)}`;
                      const dynamicQrImage = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(fixedUpiUri)}`;
                      const qrSrc = garageInfo?.upi_qr || garageInfo?.upi_qr_code || dynamicQrImage || '/upi_qr.jpg';

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
                              alt={`Fixed Price UPI QR Code ₹${pendingAmtStr}`}
                              onError={(e) => { e.target.onerror = null; e.target.src = '/upi_qr.jpg'; }}
                              className="w-40 h-40 object-contain mx-auto"
                            />
                          </a>
                          <span className="text-[10px] font-black text-slate-900 mt-1 uppercase tracking-wide">
                            Scan & Pay Dues: <strong className="text-rose-600">₹{pendingAmtStr}</strong>
                          </span>
                          <span className="text-[10px] font-mono text-emerald-700 font-extrabold">{upiId}</span>
                        </div>
                      );
                    })()}

                    <div className="space-y-2 text-xs font-bold">
                      <div className="flex justify-between text-slate-700">
                        <span>Total Billed:</span>
                        <span className="font-mono text-slate-900">₹{parseFloat(statementCustomer.total_billed || 0).toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-emerald-700">
                        <span>Paid Amount:</span>
                        <span className="font-mono">₹{parseFloat(statementCustomer.total_paid || 0).toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-rose-700 pt-1 border-t border-slate-200 text-sm">
                        <span>Balance Due:</span>
                        <span className="font-mono font-black text-rose-600">₹{parseFloat(statementCustomer.pending_amount || 0).toFixed(2)}</span>
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
