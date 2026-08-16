import React, { useState, useEffect } from 'react';
import { BarChart3, IndianRupee, Package, Users, TrendingUp, AlertCircle, Wrench, ShoppingBag, PieChart, Calendar } from 'lucide-react';
import API from '../services/api';
import { fetchMasterStore } from '../utils/cloudSync';

const computeInstantReports = (startDate = '', endDate = '') => {
  try {
    const localJobs = JSON.parse(localStorage.getItem('workshop_jobs') || '[]');
    const localInvoices = JSON.parse(localStorage.getItem('local_invoices') || '[]');
    const localInventory = JSON.parse(localStorage.getItem('inventory_items') || localStorage.getItem('spare_parts') || localStorage.getItem('local_inventory') || '[]');
    const localCounterSales = JSON.parse(localStorage.getItem('local_counter_sales') || '[]');
    const localCounterKhata = JSON.parse(localStorage.getItem('local_counter_khata') || '[]');
    const localKhataEntries = JSON.parse(localStorage.getItem('khata_entries') || '[]');
    const deletedIds = JSON.parse(localStorage.getItem('deleted_ids') || '[]');
    const recycleItems = JSON.parse(localStorage.getItem('recycle_bin_items') || '[]');

    const deletedTrashIds = [];
    recycleItems.forEach(item => {
      if (item) {
        if (item.id) deletedTrashIds.push(String(item.id));
        if (item.payload) {
          if (item.payload.id) deletedTrashIds.push(String(item.payload.id));
          if (item.payload.invoice_number) deletedTrashIds.push(String(item.payload.invoice_number));
          if (item.payload.job_id) deletedTrashIds.push(String(item.payload.job_id));
          if (item.payload.booking_id) deletedTrashIds.push(String(item.payload.booking_id));
          if (item.payload.sale_id) deletedTrashIds.push(String(item.payload.sale_id));
        }
      }
    });

    const allDeletedList = [...deletedIds, ...deletedTrashIds];
    const cleanRawId = (id) => String(id || '').replace(/^(inv_|job_|khata_|booking_|cs_|ckhata_|trash_)+/gi, '').trim();

    const isDeleted = (id) => {
      if (!id) return false;
      const s = String(id).trim();
      const raw = cleanRawId(s);
      return allDeletedList.some(d => {
        if (!d) return false;
        const dStr = String(d).trim();
        const dRaw = cleanRawId(dStr);
        return s === dStr || (raw && dRaw && raw === dRaw);
      });
    };

    // Khata credit map for existing invoices
    const khataCreditMap = new Map();
    localKhataEntries.forEach(k => {
      if (k && k.type === 'CREDIT' && (parseFloat(k.amount || 0) > 0) && !isDeleted(k.id) && !isDeleted(k.job_id)) {
        const rawJobId = cleanRawId(k.job_id || k.id);
        if (rawJobId) {
          khataCreditMap.set(rawJobId, (khataCreditMap.get(rawJobId) || 0) + parseFloat(k.amount));
        }
        const veh = (k.vehicle_number || '').replace(/[^A-Za-z0-9]/g, '').toUpperCase();
        if (veh) {
          khataCreditMap.set(`veh_${veh}`, (khataCreditMap.get(`veh_${veh}`) || 0) + parseFloat(k.amount));
        }
      }
    });

    const allMap = new Map();
    localInvoices.forEach(inv => {
      if (inv && !isDeleted(inv.id) && !isDeleted(inv.invoice_number) && !isDeleted(inv.job_id)) {
        const rawId = cleanRawId(inv.job_id || inv.id || inv.invoice_number);
        const invNum = inv.invoice_number || '';
        const vehNum = (inv.vehicle_number || '').replace(/[^A-Za-z0-9]/g, '').toUpperCase();
        const dateDay = inv.created_at ? new Date(inv.created_at).toISOString().slice(0, 10) : '';

        const grandVal = parseFloat(inv.grand_total || inv.total_amount || 0);
        const rawPaid = inv.paid_amount !== undefined && inv.paid_amount !== null
          ? parseFloat(inv.paid_amount)
          : (inv.received_amount !== undefined && inv.received_amount !== null
            ? parseFloat(inv.received_amount)
            : (inv.payment_status === 'PAID' ? grandVal : 0));
        
        const extraCredit = Math.max(
          rawId ? (khataCreditMap.get(rawId) || 0) : 0,
          vehNum ? (khataCreditMap.get(`veh_${vehNum}`) || 0) : 0
        );
        const paidVal = Math.min(grandVal, Math.max(rawPaid, extraCredit));
        const pendingVal = Math.max(0, grandVal - paidVal);

        const normalized = {
          ...inv,
          grand_total: grandVal,
          paid_amount: paidVal,
          pending_amount: pendingVal,
          discount_amount: parseFloat(inv.discount_amount || inv.discount || 0),
          payment_status: pendingVal === 0 ? 'PAID' : (paidVal > 0 ? 'PARTIAL' : 'PENDING'),
          created_at: inv.created_at || new Date().toISOString()
        };

        let existingKey = null;
        for (const [k, existing] of allMap.entries()) {
          const exRawId = cleanRawId(existing.job_id || existing.id || existing.invoice_number);
          const exVeh = (existing.vehicle_number || '').replace(/[^A-Za-z0-9]/g, '').toUpperCase();
          const exDateDay = existing.created_at ? new Date(existing.created_at).toISOString().slice(0, 10) : '';
          const exTotal = parseFloat(existing.grand_total || existing.total_amount || 0);

          if (rawId && exRawId && rawId === exRawId) { existingKey = k; break; }
          if (invNum && existing.invoice_number && invNum === existing.invoice_number) { existingKey = k; break; }
          if (vehNum && exVeh && vehNum === exVeh && dateDay && exDateDay && dateDay === exDateDay && Math.abs(grandVal - exTotal) < 1) { existingKey = k; break; }
        }

        if (!existingKey) {
          const newKey = rawId ? `bill_${rawId}` : `${vehNum}_${dateDay}_${grandVal.toFixed(0)}`;
          allMap.set(newKey, normalized);
        } else {
          const prev = allMap.get(existingKey);
          const maxPaid = Math.min(grandVal, Math.max(parseFloat(prev.paid_amount || 0), paidVal));
          const minPending = Math.max(0, grandVal - maxPaid);
          allMap.set(existingKey, {
            ...prev,
            ...normalized,
            paid_amount: maxPaid,
            pending_amount: minPending,
            payment_status: minPending === 0 ? 'PAID' : (maxPaid > 0 ? 'PARTIAL' : 'PENDING')
          });
        }
      }
    });

    const finishedJobs = localJobs.filter(j => j && (j.status === 'FINISHED' || j.status === 'COMPLETED') && !isDeleted(j.id) && !isDeleted(j.vehicle_number));
    finishedJobs.forEach((j, idx) => {
      const strJobId = String(j.id || '');
      const strVehNum = (j.vehicle_number || '').replace(/[^A-Za-z0-9]/g, '').toUpperCase();
      const jDateDay = (j.finished_at || j.completed_at || j.created_at || '').slice(0, 10);
      const partsVal = parseFloat(j.parts_total || 0);
      const labourVal = parseFloat(j.labour_charge || 100);
      const discountVal = parseFloat(j.discount_amount || j.discount || 0);
      const totalVal = parseFloat(j.grand_total || j.total_amount || j.live_total || Math.max(0, partsVal + labourVal - discountVal));

      let alreadyHasInvoice = false;
      for (const inv of allMap.values()) {
        if (!inv) continue;
        const invRawId = cleanRawId(inv.job_id || inv.id || inv.invoice_number);
        const invVeh = (inv.vehicle_number || '').replace(/[^A-Za-z0-9]/g, '').toUpperCase();
        const invDateDay = (inv.created_at || '').slice(0, 10);
        const invTotal = parseFloat(inv.grand_total || inv.total_amount || 0);

        if (strJobId && invRawId && (invRawId === strJobId || invRawId.includes(strJobId))) { alreadyHasInvoice = true; break; }
        if (strVehNum && invVeh && strVehNum === invVeh && jDateDay && invDateDay && jDateDay === invDateDay && Math.abs(totalVal - invTotal) < 1) { alreadyHasInvoice = true; break; }
      }

      if (!alreadyHasInvoice) {
        const rawPaid = j.paid_amount !== undefined ? parseFloat(j.paid_amount) : totalVal;
        const extraCredit = Math.max(
          cleanRawId(strJobId) ? (khataCreditMap.get(cleanRawId(strJobId)) || 0) : 0,
          strVehNum ? (khataCreditMap.get(`veh_${strVehNum}`) || 0) : 0
        );
        const paidVal = Math.min(totalVal, Math.max(rawPaid, extraCredit));
        const pendingVal = Math.max(0, totalVal - paidVal);

        const key = `bill_${strJobId || idx}`;
        allMap.set(key, {
          id: j.id || key,
          invoice_number: `INV-${String(j.id || idx).slice(-4)}`,
          customer_name: j.customer_name || 'Customer',
          mobile_number: j.mobile_number || 'N/A',
          vehicle_number: j.vehicle_number || 'GJ-15',
          bike_model: j.bike_model || 'Two Wheeler',
          grand_total: totalVal,
          total_amount: totalVal,
          paid_amount: paidVal,
          pending_amount: pendingVal,
          discount_amount: discountVal,
          payment_status: pendingVal > 0 ? (paidVal > 0 ? 'PARTIAL' : 'PENDING') : 'PAID',
          created_at: j.finished_at || j.completed_at || j.created_at || new Date().toISOString()
        });
      }
    });

    const allInvoices = Array.from(allMap.values());
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    const isToday = (dateVal) => {
      if (!dateVal) return true;
      const dStr = String(dateVal).trim();
      const now = new Date();
      const todayISO = now.toISOString().split('T')[0];
      const todayLoc = now.toLocaleDateString('en-CA');
      const d = now.getDate();
      const m = new Date().getMonth() + 1;
      const y = new Date().getFullYear();
      const dPad = String(d).padStart(2, '0');
      const mPad = String(m).padStart(2, '0');
      const todayDMY = `${dPad}/${mPad}/${y}`;
      const todayDMYDash = `${dPad}-${mPad}-${y}`;

      if (dStr.startsWith(todayISO) || dStr.startsWith(todayLoc) || dStr.includes(todayDMY) || dStr.includes(todayDMYDash)) return true;

      const parts = dStr.split(/[\/\-T\s]/);
      if (parts.length >= 3) {
        if (parts[0].length === 2 && parts[1].length === 2 && parts[2].length === 4) {
          return parseInt(parts[0], 10) === d && parseInt(parts[1], 10) === m && parseInt(parts[2], 10) === y;
        }
        if (parts[0].length === 4 && parts[1].length <= 2 && parts[2].length <= 2) {
          return parseInt(parts[0], 10) === y && parseInt(parts[1], 10) === m && parseInt(parts[2], 10) === d;
        }
      }

      const parsed = new Date(dateVal);
      if (!isNaN(parsed.getTime())) {
        return parsed.getDate() === d && (parsed.getMonth() + 1) === m && parsed.getFullYear() === y;
      }
      return true;
    };

    const isThisMonth = (dateVal) => {
      if (!dateVal) return true;
      const parsed = new Date(dateVal);
      if (!isNaN(parsed.getTime())) {
        return parsed.getMonth() === currentMonth && parsed.getFullYear() === currentYear;
      }
      return true;
    };

    const cleanCounterSales = localCounterSales.filter(s => s && s.id && !isDeleted(s.id) && !isDeleted(String(s.id).replace(/^cs_/, '')));
    const cleanCounterKhata = localCounterKhata.filter(k => k && k.id && !isDeleted(k.id) && !isDeleted(k.sale_id) && !isDeleted(String(k.id).replace(/^ckhata_/, '')));
    const cleanKhataEntries = localKhataEntries.filter(k => k && k.id && !isDeleted(k.id) && !isDeleted(String(k.id).replace(/^khata_/, '')));

    // 1. Workshop Revenues (Collected Paid Amounts - identical to Dashboard)
    const todayDirectRevenue = allInvoices
      .filter(inv => isToday(inv.created_at || inv.visit_date || inv.date))
      .reduce((acc, inv) => {
        const grandVal = parseFloat(inv.grand_total || inv.total_amount || 0);
        const rawPaid = parseFloat(inv.paid_amount !== undefined && inv.paid_amount !== null ? inv.paid_amount : (inv.received_amount || (inv.payment_status === 'PAID' ? grandVal : 0)));
        const paidVal = Math.min(grandVal, Math.max(0, rawPaid));
        return acc + paidVal;
      }, 0);

    const todayOlderInvoicesKhataCollections = cleanKhataEntries
      .filter(k => {
        if (!k || k.type !== 'CREDIT' || !isToday(k.date || k.created_at)) return false;
        const kJobId = cleanRawId(k.job_id || k.id);
        const kVeh = (k.vehicle_number || '').replace(/[^A-Za-z0-9]/g, '').toUpperCase();
        const isTodayInvoice = allInvoices.some(inv => {
          if (!isToday(inv.created_at || inv.visit_date || inv.date)) return false;
          const invRawId = cleanRawId(inv.job_id || inv.id || inv.invoice_number);
          const invVeh = (inv.vehicle_number || '').replace(/[^A-Za-z0-9]/g, '').toUpperCase();
          return (kJobId && invRawId && kJobId === invRawId) || (kVeh && invVeh && kVeh === invVeh);
        });
        return !isTodayInvoice;
      })
      .reduce((sum, k) => sum + parseFloat(k.amount || 0), 0);

    const workshopDailyRevenue = todayDirectRevenue + todayOlderInvoicesKhataCollections;

    const workshopMonthlyRevenue = allInvoices
      .filter(inv => isThisMonth(inv.created_at || inv.visit_date || inv.date))
      .reduce((acc, inv) => {
        const grandVal = parseFloat(inv.grand_total || inv.total_amount || 0);
        const rawPaid = parseFloat(inv.paid_amount !== undefined && inv.paid_amount !== null ? inv.paid_amount : (inv.received_amount || (inv.payment_status === 'PAID' ? grandVal : 0)));
        const paidVal = Math.min(grandVal, Math.max(0, rawPaid));
        return acc + paidVal;
      }, 0);

    const workshopTotalRevenue = allInvoices
      .reduce((acc, inv) => {
        const grandVal = parseFloat(inv.grand_total || inv.total_amount || 0);
        const rawPaid = parseFloat(inv.paid_amount !== undefined && inv.paid_amount !== null ? inv.paid_amount : (inv.received_amount || (inv.payment_status === 'PAID' ? grandVal : 0)));
        const paidVal = Math.min(grandVal, Math.max(0, rawPaid));
        return acc + paidVal;
      }, 0);

    // 2. Counter Sales Revenues (Collected Paid Amounts - identical to Dashboard)
    const counterDailyRevenue = cleanCounterSales
      .filter(s => isToday(s.created_at || s.date))
      .reduce((acc, s) => acc + parseFloat(s.paid_amount || s.net_total || 0), 0);

    const counterMonthlyRevenue = cleanCounterSales
      .filter(s => isThisMonth(s.created_at || s.date))
      .reduce((acc, s) => acc + parseFloat(s.paid_amount || s.net_total || 0), 0);

    const counterTotalRevenue = cleanCounterSales
      .reduce((sum, s) => sum + parseFloat(s.paid_amount || s.net_total || 0), 0);

    // 3. Combined Total Revenues
    const totalDailyRevenue = workshopDailyRevenue + counterDailyRevenue;
    const totalMonthlyRevenue = workshopMonthlyRevenue + counterMonthlyRevenue;
    const grandTotalRevenue = workshopTotalRevenue + counterTotalRevenue;

    // 4. Inventory Valuation
    const isItemDeleted = (item) => {
      if (!item) return true;
      const itId = String(item.id || '').toLowerCase().trim();
      if (!itId) return false;
      return allDeletedList.some(d => String(d).toLowerCase().trim() === itId);
    };

    const cleanInv = localInventory.filter(i => i && typeof i === 'object' && !isItemDeleted(i));
    const inventoryValue = cleanInv.reduce((acc, item) => {
      const price = parseFloat(item.price || item.selling_price || item.unit_price || 0);
      const stock = parseInt(item.current_stock !== undefined ? item.current_stock : (item.stock_quantity !== undefined ? item.stock_quantity : (item.quantity !== undefined ? item.quantity : 0)), 10);
      return acc + (price * stock);
    }, 0);

    // 5. Total Pending Dues (Workshop + Counter Khata + General Khata)
    const workshopPending = allInvoices.reduce((acc, inv) => {
      const grandVal = parseFloat(inv.grand_total || inv.total_amount || 0);
      const rawPaid = parseFloat(inv.paid_amount !== undefined && inv.paid_amount !== null ? inv.paid_amount : (inv.received_amount || (inv.payment_status === 'PAID' ? grandVal : 0)));
      const paidVal = Math.min(grandVal, Math.max(0, rawPaid));
      const pendingVal = inv.pending_amount !== undefined ? parseFloat(inv.pending_amount) : Math.max(0, grandVal - paidVal);
      return acc + (isNaN(pendingVal) ? 0 : Math.max(0, pendingVal));
    }, 0);

    const counterPending = cleanCounterKhata
      .filter(k => k && String(k.status).toUpperCase() !== 'PAID' && parseFloat(k.pending_amount || 0) > 0)
      .reduce((acc, k) => acc + (parseFloat(k.pending_amount || 0) || 0), 0);

    const generalKhataPending = cleanKhataEntries
      .filter(k => k && String(k.status).toUpperCase() !== 'PAID' && k.type === 'DEBIT' && parseFloat(k.pending_amount || 0) > 0)
      .reduce((acc, k) => acc + (parseFloat(k.pending_amount || 0) || 0), 0);

    const totalPendingDues = workshopPending + counterPending + generalKhataPending;

    return {
      daily_revenue: totalDailyRevenue,
      monthly_revenue: totalMonthlyRevenue,
      grand_total_revenue: grandTotalRevenue,
      workshop_daily: workshopDailyRevenue,
      workshop_monthly: workshopMonthlyRevenue,
      workshop_total: workshopTotalRevenue,
      workshop_invoices_count: allInvoices.length,
      counter_daily: counterDailyRevenue,
      counter_monthly: counterMonthlyRevenue,
      counter_total: counterTotalRevenue,
      counter_sales_count: cleanCounterSales.length,
      total_invoices: allInvoices.length + cleanCounterSales.length,
      inventory_valuation: inventoryValue,
      total_inventory_value: inventoryValue,
      total_inventory_items: cleanInv.length,
      workshop_pending: workshopPending,
      counter_pending: counterPending + generalKhataPending,
      total_pending_payments: totalPendingDues
    };
  } catch (err) {
    console.error(err);
    return {
      daily_revenue: 0,
      monthly_revenue: 0,
      grand_total_revenue: 0,
      workshop_daily: 0,
      workshop_monthly: 0,
      workshop_total: 0,
      workshop_invoices_count: 0,
      counter_daily: 0,
      counter_monthly: 0,
      counter_total: 0,
      counter_sales_count: 0,
      total_invoices: 0,
      inventory_valuation: 0,
      total_inventory_value: 0,
      total_inventory_items: 0,
      workshop_pending: 0,
      counter_pending: 0,
      total_pending_payments: 0
    };
  }
};

export default function ReportsPage() {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reports, setReports] = useState(() => computeInstantReports('', ''));
  const [loading, setLoading] = useState(false);

  const fetchReports = async () => {
    try {
      await fetchMasterStore(true).catch(() => null);
    } catch (e) {}
    setReports(computeInstantReports(startDate, endDate));
    setLoading(false);
  };

  useEffect(() => {
    fetchReports();
    const interval = setInterval(() => {
      fetchReports();
    }, 4000);
    const handleStorage = () => setReports(computeInstantReports(startDate, endDate));
    window.addEventListener('storage', handleStorage);
    window.addEventListener('master_store_updated', handleStorage);
    window.addEventListener('khata_updated', handleStorage);
    window.addEventListener('invoices_updated', handleStorage);
    window.addEventListener('counter_khata_updated', handleStorage);
    window.addEventListener('counter_sales_updated', handleStorage);
    window.addEventListener('inventory_updated', handleStorage);
    return () => {
      clearInterval(interval);
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('master_store_updated', handleStorage);
      window.removeEventListener('khata_updated', handleStorage);
      window.removeEventListener('invoices_updated', handleStorage);
      window.removeEventListener('counter_khata_updated', handleStorage);
      window.removeEventListener('counter_sales_updated', handleStorage);
      window.removeEventListener('inventory_updated', handleStorage);
    };
  }, [startDate, endDate]);

  return (
    <div className="space-y-8">
      
      {/* HEADER WITH CUSTOM DATE RANGE PICKER */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-3xl border border-slate-200/80 soft-shadow">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 font-poppins flex items-center gap-2.5">
            <BarChart3 className="w-7 h-7 text-blue-600" /> Garage Analytics &amp; Revenue Reports
          </h1>
          <p className="text-xs text-slate-500 mt-1">Executive financial metrics, Workshop Services vs. Spare Parts Counter Sales, and inventory valuation.</p>
        </div>

        {/* DATE RANGE FILTER */}
        <div className="flex flex-wrap items-center gap-2 bg-slate-50 p-2 rounded-2xl border border-slate-200 text-xs">
          <div className="flex items-center gap-1 font-bold text-slate-600 px-1">
            <Calendar className="w-3.5 h-3.5 text-blue-600" /> From:
          </div>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white font-bold text-slate-800 outline-none focus:border-blue-500 cursor-pointer"
          />

          <div className="flex items-center gap-1 font-bold text-slate-600 px-1">
            To:
          </div>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white font-bold text-slate-800 outline-none focus:border-blue-500 cursor-pointer"
          />

          {(startDate || endDate) && (
            <button
              type="button"
              onClick={() => { setStartDate(''); setEndDate(''); }}
              className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold rounded-xl transition-all"
            >
              Clear Filter
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="p-8 text-center text-slate-500 font-medium">Generating Business Reports...</div>
      ) : (
        <div className="space-y-8">
          
          {/* COMBINED EXECUTIVE FINANCIAL METRICS */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            
            <div className="bg-white p-6 rounded-3xl border border-slate-200/80 soft-shadow space-y-2">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Today Total Revenue</span>
              <span className="text-2xl font-black text-emerald-600 font-poppins block">
                ₹{(reports?.daily_revenue || 0).toLocaleString('en-IN')}
              </span>
              <span className="text-[11px] text-slate-400 font-medium block">
                Workshop: ₹{(reports?.workshop_daily || 0).toLocaleString('en-IN')} • Counter: ₹{(reports?.counter_daily || 0).toLocaleString('en-IN')}
              </span>
            </div>

            <div className="bg-white p-6 rounded-3xl border border-slate-200/80 soft-shadow space-y-2">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Monthly Total Revenue</span>
              <span className="text-2xl font-black text-blue-600 font-poppins block">
                ₹{(reports?.monthly_revenue || 0).toLocaleString('en-IN')}
              </span>
              <span className="text-[11px] text-slate-400 font-medium block">
                Workshop: ₹{(reports?.workshop_monthly || 0).toLocaleString('en-IN')} • Counter: ₹{(reports?.counter_monthly || 0).toLocaleString('en-IN')}
              </span>
            </div>

            <div className="bg-white p-6 rounded-3xl border border-slate-200/80 soft-shadow space-y-2">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Live Inventory Valuation</span>
              <span className="text-2xl font-black text-purple-600 font-poppins block">
                ₹{(reports?.total_inventory_value || 0).toLocaleString('en-IN')}
              </span>
              <span className="text-[11px] text-slate-400 font-medium block">
                {reports?.total_inventory_items || 0} unique spare part items in stock
              </span>
            </div>

            <div className="bg-white p-6 rounded-3xl border border-slate-200/80 soft-shadow space-y-2">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Total Pending Dues</span>
              <span className="text-2xl font-black text-rose-600 font-poppins block">
                ₹{(reports?.total_pending_payments || 0).toLocaleString('en-IN')}
              </span>
              <span className="text-[11px] text-slate-400 font-medium block">
                Workshop: ₹{(reports?.workshop_pending || 0).toLocaleString('en-IN')} • Counter: ₹{(reports?.counter_pending || 0).toLocaleString('en-IN')}
              </span>
            </div>

          </div>

          {/* DEDICATED REVENUE BREAKDOWN: WORKSHOP VS COUNTER SALE */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* WORKSHOP SERVICES CARD */}
            <div className="bg-white p-6 rounded-3xl border border-slate-200/80 soft-shadow space-y-5">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-3">
                  <div className="p-3 rounded-2xl bg-blue-50 text-blue-600">
                    <Wrench className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900 font-poppins">Workshop & Repair Services</h3>
                    <p className="text-xs text-slate-500">Bikes serviced and repair jobs billing</p>
                  </div>
                </div>
                <span className="px-3 py-1 bg-blue-50 text-blue-700 font-bold text-xs rounded-xl font-mono">
                  {reports?.workshop_invoices_count || 0} Jobs
                </span>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Today Revenue</span>
                  <span className="text-lg font-black font-mono text-slate-900">
                    ₹{(reports?.workshop_daily || 0).toLocaleString('en-IN')}
                  </span>
                </div>

                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Monthly Revenue</span>
                  <span className="text-lg font-black font-mono text-blue-600">
                    ₹{(reports?.workshop_monthly || 0).toLocaleString('en-IN')}
                  </span>
                </div>
              </div>

              <div className="flex justify-between items-center text-xs text-slate-600 pt-2 border-t border-slate-100">
                <span>Total Lifetime Workshop Revenue:</span>
                <span className="font-mono font-black text-slate-900 text-sm">
                  ₹{(reports?.workshop_total || 0).toLocaleString('en-IN')}
                </span>
              </div>
            </div>

            {/* COUNTER SPARE PARTS CARD */}
            <div className="bg-white p-6 rounded-3xl border border-slate-200/80 soft-shadow space-y-5">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-3">
                  <div className="p-3 rounded-2xl bg-indigo-50 text-indigo-600">
                    <ShoppingBag className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900 font-poppins">Counter Spare Parts Sales</h3>
                    <p className="text-xs text-slate-500">Retail counter sale and parts cash memos</p>
                  </div>
                </div>
                <span className="px-3 py-1 bg-indigo-50 text-indigo-700 font-bold text-xs rounded-xl font-mono">
                  {reports?.counter_sales_count || 0} Invoices
                </span>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Today Revenue</span>
                  <span className="text-lg font-black font-mono text-slate-900">
                    ₹{(reports?.counter_daily || 0).toLocaleString('en-IN')}
                  </span>
                </div>

                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Monthly Revenue</span>
                  <span className="text-lg font-black font-mono text-indigo-600">
                    ₹{(reports?.counter_monthly || 0).toLocaleString('en-IN')}
                  </span>
                </div>
              </div>

              <div className="flex justify-between items-center text-xs text-slate-600 pt-2 border-t border-slate-100">
                <span>Total Lifetime Counter Sales:</span>
                <span className="font-mono font-black text-slate-900 text-sm">
                  ₹{(reports?.counter_total || 0).toLocaleString('en-IN')}
                </span>
              </div>
            </div>

          </div>

        </div>
      )}

    </div>
  );
}
