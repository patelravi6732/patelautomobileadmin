import React, { useState, useEffect } from 'react';
import { BarChart3, IndianRupee, Package, Users, TrendingUp, AlertCircle, Wrench, ShoppingBag, PieChart, Tag, Percent, ArrowDownRight } from 'lucide-react';
import API from '../services/api';
import { fetchCloudDeletedIds, fetchCloudInvoices, fetchCloudInventory } from '../utils/cloudSync';

const computeInstantReports = () => {
  try {
    const localJobs = JSON.parse(localStorage.getItem('workshop_jobs') || '[]');
    const localInvoices = JSON.parse(localStorage.getItem('local_invoices') || '[]');
    const localInventory = JSON.parse(localStorage.getItem('local_inventory') || localStorage.getItem('inventory_items') || localStorage.getItem('spare_parts') || '[]');
    const localCounterSales = JSON.parse(localStorage.getItem('local_counter_sales') || '[]');
    const localCounterKhata = JSON.parse(localStorage.getItem('local_counter_khata') || '[]');
    const deletedIds = JSON.parse(localStorage.getItem('deleted_ids') || '[]');

    const isDeleted = (id) => id && (deletedIds.includes(String(id)) || deletedIds.includes(String(id).replace(/^inv_/, '').replace(/^job_/, '')));

    const allMap = new Map();
    localInvoices.forEach(inv => {
      if (inv && !isDeleted(inv.id) && !isDeleted(inv.invoice_number)) {
        const key = String(inv.id || inv.invoice_number || inv.job_id);
        allMap.set(key, {
          ...inv,
          grand_total: parseFloat(inv.grand_total || inv.total_amount || 0),
          paid_amount: parseFloat(inv.paid_amount !== undefined ? inv.paid_amount : (inv.grand_total || inv.total_amount || 0)),
          pending_amount: parseFloat(inv.pending_amount !== undefined ? inv.pending_amount : 0),
          discount_amount: parseFloat(inv.discount_amount || inv.discount || 0),
          created_at: inv.created_at || new Date().toISOString()
        });
      }
    });

    const finishedJobs = localJobs.filter(j => j && (j.status === 'FINISHED' || j.status === 'COMPLETED') && !isDeleted(j.id) && !isDeleted(j.vehicle_number));
    finishedJobs.forEach((j, idx) => {
      const key = `bill_${j.id || idx}`;
      if (!allMap.has(key) && !allMap.has(String(j.id))) {
        const partsVal = parseFloat(j.parts_total || 0);
        const labourVal = parseFloat(j.labour_charge || 100);
        const discountVal = parseFloat(j.discount_amount || j.discount || 0);
        const totalVal = parseFloat(j.grand_total || j.total_amount || j.live_total || Math.max(0, partsVal + labourVal - discountVal));
        const paidVal = j.paid_amount !== undefined ? parseFloat(j.paid_amount) : totalVal;
        const pendingVal = j.pending_amount !== undefined ? parseFloat(j.pending_amount) : Math.max(0, totalVal - paidVal);

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
          payment_status: pendingVal > 0 ? 'PENDING' : 'PAID',
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

    // 1. Workshop Revenues & Discounts
    const workshopDailyRevenue = allInvoices
      .filter(inv => isToday(inv.created_at || inv.visit_date || inv.date))
      .reduce((acc, inv) => acc + parseFloat(inv.paid_amount || inv.grand_total || 0), 0);

    const workshopMonthlyRevenue = allInvoices
      .filter(inv => isThisMonth(inv.created_at || inv.visit_date || inv.date))
      .reduce((acc, inv) => acc + parseFloat(inv.paid_amount || inv.grand_total || 0), 0);

    const workshopTotalRevenue = allInvoices
      .reduce((acc, inv) => acc + parseFloat(inv.paid_amount || inv.grand_total || 0), 0);

    const workshopDailyDiscount = allInvoices
      .filter(inv => isToday(inv.created_at || inv.visit_date || inv.date))
      .reduce((acc, inv) => acc + parseFloat(inv.discount_amount || inv.discount || 0), 0);

    const workshopMonthlyDiscount = allInvoices
      .filter(inv => isThisMonth(inv.created_at || inv.visit_date || inv.date))
      .reduce((acc, inv) => acc + parseFloat(inv.discount_amount || inv.discount || 0), 0);

    const workshopTotalDiscount = allInvoices
      .reduce((acc, inv) => acc + parseFloat(inv.discount_amount || inv.discount || 0), 0);

    const workshopGrossTotal = allInvoices
      .reduce((acc, inv) => acc + parseFloat(inv.grand_total || inv.total_amount || 0) + parseFloat(inv.discount_amount || inv.discount || 0), 0);

    // 2. Counter Sales Revenues & Discounts
    const counterDailyRevenue = cleanCounterSales
      .filter(s => isToday(s.created_at || s.date))
      .reduce((acc, s) => acc + parseFloat(s.paid_amount || s.net_total || 0), 0);

    const counterMonthlyRevenue = cleanCounterSales
      .filter(s => isThisMonth(s.created_at || s.date))
      .reduce((acc, s) => acc + parseFloat(s.paid_amount || s.net_total || 0), 0);

    const counterTotalRevenue = cleanCounterSales
      .reduce((sum, s) => sum + parseFloat(s.paid_amount || s.net_total || 0), 0);

    const counterDailyDiscount = cleanCounterSales
      .filter(s => isToday(s.created_at || s.date))
      .reduce((acc, s) => acc + parseFloat(s.discount || s.discount_amount || 0), 0);

    const counterMonthlyDiscount = cleanCounterSales
      .filter(s => isThisMonth(s.created_at || s.date))
      .reduce((acc, s) => acc + parseFloat(s.discount || s.discount_amount || 0), 0);

    const counterTotalDiscount = cleanCounterSales
      .reduce((sum, s) => sum + parseFloat(s.discount || s.discount_amount || 0), 0);

    const counterGrossTotal = cleanCounterSales
      .reduce((sum, s) => sum + parseFloat(s.subtotal || s.total_amount || (parseFloat(s.net_total || 0) + parseFloat(s.discount || 0))), 0);

    // 3. Combined Total Revenues & Discounts
    const totalDailyRevenue = workshopDailyRevenue + counterDailyRevenue;
    const totalMonthlyRevenue = workshopMonthlyRevenue + counterMonthlyRevenue;
    const grandTotalRevenue = workshopTotalRevenue + counterTotalRevenue;

    const totalDailyDiscount = workshopDailyDiscount + counterDailyDiscount;
    const totalMonthlyDiscount = workshopMonthlyDiscount + counterMonthlyDiscount;
    const grandTotalDiscount = workshopTotalDiscount + counterTotalDiscount;

    const grandGrossTotal = workshopGrossTotal + counterGrossTotal;

    // 4. Inventory Valuation
    const cleanInv = localInventory.filter(i => i && !isDeleted(i.id) && !isDeleted(i.part_name));
    const inventoryValue = cleanInv.reduce((acc, item) => {
      const price = parseFloat(item.selling_price || item.unit_price || item.price || 0);
      const stock = parseInt(item.current_stock || item.stock_quantity || item.quantity || 0, 10);
      return acc + (price * stock);
    }, 0);

    // 5. Total Pending Dues (Workshop + Counter Khata)
    const workshopPending = allInvoices.reduce((acc, inv) => {
      const grandVal = parseFloat(inv.grand_total || inv.total_amount || 0);
      const rawPaid = parseFloat(inv.paid_amount !== undefined && inv.paid_amount !== null ? inv.paid_amount : (inv.received_amount || (inv.payment_status === 'PAID' ? grandVal : 0)));
      const paidVal = Math.min(grandVal, Math.max(0, rawPaid));
      return acc + Math.max(0, grandVal - paidVal);
    }, 0);

    const counterPending = cleanCounterKhata
      .filter(k => k && k.status !== 'CLEARED')
      .reduce((acc, k) => acc + parseFloat(k.pending_amount || 0), 0);

    const totalPendingDues = workshopPending + counterPending;

    return {
      daily_revenue: totalDailyRevenue,
      monthly_revenue: totalMonthlyRevenue,
      grand_total_revenue: grandTotalRevenue,
      daily_discount: totalDailyDiscount,
      monthly_discount: totalMonthlyDiscount,
      grand_total_discount: grandTotalDiscount,
      grand_gross_total: grandGrossTotal,
      workshop_daily: workshopDailyRevenue,
      workshop_monthly: workshopMonthlyRevenue,
      workshop_total: workshopTotalRevenue,
      workshop_daily_discount: workshopDailyDiscount,
      workshop_monthly_discount: workshopMonthlyDiscount,
      workshop_total_discount: workshopTotalDiscount,
      workshop_gross_total: workshopGrossTotal,
      workshop_invoices_count: allInvoices.length,
      counter_daily: counterDailyRevenue,
      counter_monthly: counterMonthlyRevenue,
      counter_total: counterTotalRevenue,
      counter_daily_discount: counterDailyDiscount,
      counter_monthly_discount: counterMonthlyDiscount,
      counter_total_discount: counterTotalDiscount,
      counter_gross_total: counterGrossTotal,
      counter_sales_count: cleanCounterSales.length,
      total_invoices: allInvoices.length + cleanCounterSales.length,
      inventory_valuation: inventoryValue,
      total_inventory_value: inventoryValue,
      total_inventory_items: cleanInv.length,
      workshop_pending: workshopPending,
      counter_pending: counterPending,
      total_pending_payments: totalPendingDues
    };
  } catch (err) {
    console.error(err);
    return {
      daily_revenue: 0,
      monthly_revenue: 0,
      grand_total_revenue: 0,
      daily_discount: 0,
      monthly_discount: 0,
      grand_total_discount: 0,
      grand_gross_total: 0,
      workshop_daily: 0,
      workshop_monthly: 0,
      workshop_total: 0,
      workshop_daily_discount: 0,
      workshop_monthly_discount: 0,
      workshop_total_discount: 0,
      workshop_gross_total: 0,
      workshop_invoices_count: 0,
      counter_daily: 0,
      counter_monthly: 0,
      counter_total: 0,
      counter_daily_discount: 0,
      counter_monthly_discount: 0,
      counter_total_discount: 0,
      counter_gross_total: 0,
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
  const [reports, setReports] = useState(() => computeInstantReports());
  const [loading, setLoading] = useState(false);

  const fetchReports = async () => {
    try {
      await fetchMasterStore(true).catch(() => null);
    } catch (e) {}
    setReports(computeInstantReports());
    setLoading(false);
  };

  useEffect(() => {
    fetchReports();
    const interval = setInterval(() => {
      fetchReports();
    }, 4000);
    const handleStorage = () => setReports(computeInstantReports());
    window.addEventListener('storage', handleStorage);
    window.addEventListener('master_store_updated', handleStorage);
    return () => {
      clearInterval(interval);
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('master_store_updated', handleStorage);
    };
  }, []);

  return (
    <div className="space-y-8">
      
      <div>
        <h1 className="text-2xl font-bold text-slate-900 font-poppins flex items-center gap-2.5">
          <BarChart3 className="w-7 h-7 text-blue-600" /> Garage Analytics, Revenue & Discount Reports
        </h1>
        <p className="text-xs text-slate-500">Executive financial metrics, Workshop Services vs. Spare Parts Counter Sales, Discounts given, and inventory valuation.</p>
      </div>

      {loading ? (
        <div className="p-8 text-center text-slate-500 font-medium">Generating Business Reports...</div>
      ) : (
        <div className="space-y-8">
          
          {/* COMBINED EXECUTIVE FINANCIAL METRICS */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-5">
            
            <div className="bg-white p-5 rounded-3xl border border-slate-200/80 soft-shadow space-y-1.5">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Today Total Revenue</span>
              <span className="text-2xl font-black text-emerald-600 font-poppins block">
                ₹{(reports?.daily_revenue || 0).toLocaleString('en-IN')}
              </span>
              <span className="text-[11px] text-slate-400 font-medium block">
                Workshop: ₹{(reports?.workshop_daily || 0).toLocaleString('en-IN')} • Counter: ₹{(reports?.counter_daily || 0).toLocaleString('en-IN')}
              </span>
            </div>

            <div className="bg-white p-5 rounded-3xl border border-orange-200/80 bg-orange-50/20 soft-shadow space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-orange-700 uppercase tracking-wider block">Total Discount Given</span>
                <span className="p-1 rounded-lg bg-orange-100 text-orange-600">
                  <Tag className="w-3.5 h-3.5" />
                </span>
              </div>
              <span className="text-2xl font-black text-orange-600 font-poppins block">
                ₹{(reports?.grand_total_discount || 0).toLocaleString('en-IN')}
              </span>
              <span className="text-[11px] text-orange-600 font-semibold block">
                Today: ₹{(reports?.daily_discount || 0).toLocaleString('en-IN')} • Month: ₹{(reports?.monthly_discount || 0).toLocaleString('en-IN')}
              </span>
            </div>

            <div className="bg-white p-5 rounded-3xl border border-slate-200/80 soft-shadow space-y-1.5">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Monthly Total Revenue</span>
              <span className="text-2xl font-black text-blue-600 font-poppins block">
                ₹{(reports?.monthly_revenue || 0).toLocaleString('en-IN')}
              </span>
              <span className="text-[11px] text-slate-400 font-medium block">
                Workshop: ₹{(reports?.workshop_monthly || 0).toLocaleString('en-IN')} • Counter: ₹{(reports?.counter_monthly || 0).toLocaleString('en-IN')}
              </span>
            </div>

            <div className="bg-white p-5 rounded-3xl border border-slate-200/80 soft-shadow space-y-1.5">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Live Inventory Valuation</span>
              <span className="text-2xl font-black text-purple-600 font-poppins block">
                ₹{(reports?.total_inventory_value || 0).toLocaleString('en-IN')}
              </span>
              <span className="text-[11px] text-slate-400 font-medium block">
                {reports?.total_inventory_items || 0} unique spare part items in stock
              </span>
            </div>

            <div className="bg-white p-5 rounded-3xl border border-slate-200/80 soft-shadow space-y-1.5">
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

              <div className="p-3.5 bg-orange-50/50 rounded-2xl border border-orange-100 space-y-2">
                <div className="flex justify-between items-center text-xs font-semibold text-orange-900">
                  <span>Workshop Discounts Given:</span>
                  <span className="font-bold text-orange-700">₹{(reports?.workshop_total_discount || 0).toLocaleString('en-IN')} Total</span>
                </div>
                <div className="flex justify-between items-center text-[11px] text-orange-600">
                  <span>Today: <strong>₹{(reports?.workshop_daily_discount || 0).toLocaleString('en-IN')}</strong></span>
                  <span>This Month: <strong>₹{(reports?.workshop_monthly_discount || 0).toLocaleString('en-IN')}</strong></span>
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

              <div className="p-3.5 bg-orange-50/50 rounded-2xl border border-orange-100 space-y-2">
                <div className="flex justify-between items-center text-xs font-semibold text-orange-900">
                  <span>Counter Sale Discounts Given:</span>
                  <span className="font-bold text-orange-700">₹{(reports?.counter_total_discount || 0).toLocaleString('en-IN')} Total</span>
                </div>
                <div className="flex justify-between items-center text-[11px] text-orange-600">
                  <span>Today: <strong>₹{(reports?.counter_daily_discount || 0).toLocaleString('en-IN')}</strong></span>
                  <span>This Month: <strong>₹{(reports?.counter_monthly_discount || 0).toLocaleString('en-IN')}</strong></span>
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

          {/* DEDICATED FINANCIAL AUDIT & DISCOUNT SUMMARY TABLE */}
          <div className="bg-white p-6 rounded-3xl border border-slate-200/80 soft-shadow space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <PieChart className="w-5 h-5 text-blue-600" />
                <h3 className="text-base font-bold text-slate-900 font-poppins">Complete Financial & Discount Audit</h3>
              </div>
              <span className="text-xs text-slate-500 font-medium">Detailed side-by-side reconciliation</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200/80 text-slate-500 font-bold uppercase tracking-wider bg-slate-50/70">
                    <th className="py-3 px-4 rounded-l-xl">Department / Operation</th>
                    <th className="py-3 px-4">Count</th>
                    <th className="py-3 px-4">Gross Bill (Before Disc)</th>
                    <th className="py-3 px-4 text-orange-600">Total Discount Given</th>
                    <th className="py-3 px-4 text-emerald-600">Net Revenue Collected</th>
                    <th className="py-3 px-4 text-rose-600 rounded-r-xl">Pending Dues</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                  <tr className="hover:bg-slate-50/50 transition-colors">
                    <td className="py-3.5 px-4 font-bold text-slate-900 flex items-center gap-2">
                      <Wrench className="w-4 h-4 text-blue-600 shrink-0" /> Workshop Repair Services
                    </td>
                    <td className="py-3.5 px-4 font-mono">{reports?.workshop_invoices_count || 0} Bills</td>
                    <td className="py-3.5 px-4 font-mono font-bold">₹{(reports?.workshop_gross_total || 0).toLocaleString('en-IN')}</td>
                    <td className="py-3.5 px-4 font-mono font-bold text-orange-600">- ₹{(reports?.workshop_total_discount || 0).toLocaleString('en-IN')}</td>
                    <td className="py-3.5 px-4 font-mono font-bold text-emerald-600">₹{(reports?.workshop_total || 0).toLocaleString('en-IN')}</td>
                    <td className="py-3.5 px-4 font-mono font-bold text-rose-600">₹{(reports?.workshop_pending || 0).toLocaleString('en-IN')}</td>
                  </tr>

                  <tr className="hover:bg-slate-50/50 transition-colors">
                    <td className="py-3.5 px-4 font-bold text-slate-900 flex items-center gap-2">
                      <ShoppingBag className="w-4 h-4 text-indigo-600 shrink-0" /> Counter Spare Parts Sales
                    </td>
                    <td className="py-3.5 px-4 font-mono">{reports?.counter_sales_count || 0} Invoices</td>
                    <td className="py-3.5 px-4 font-mono font-bold">₹{(reports?.counter_gross_total || 0).toLocaleString('en-IN')}</td>
                    <td className="py-3.5 px-4 font-mono font-bold text-orange-600">- ₹{(reports?.counter_total_discount || 0).toLocaleString('en-IN')}</td>
                    <td className="py-3.5 px-4 font-mono font-bold text-emerald-600">₹{(reports?.counter_total || 0).toLocaleString('en-IN')}</td>
                    <td className="py-3.5 px-4 font-mono font-bold text-rose-600">₹{(reports?.counter_pending || 0).toLocaleString('en-IN')}</td>
                  </tr>

                  <tr className="bg-slate-900 text-white font-bold text-xs rounded-xl">
                    <td className="py-4 px-4 rounded-l-xl flex items-center gap-2 text-amber-400 font-extrabold font-poppins">
                      ⭐ Combined Total Garage Operations
                    </td>
                    <td className="py-4 px-4 font-mono font-bold text-slate-300">{reports?.total_invoices || 0} Records</td>
                    <td className="py-4 px-4 font-mono font-extrabold text-white">₹{(reports?.grand_gross_total || 0).toLocaleString('en-IN')}</td>
                    <td className="py-4 px-4 font-mono font-extrabold text-amber-400">- ₹{(reports?.grand_total_discount || 0).toLocaleString('en-IN')}</td>
                    <td className="py-4 px-4 font-mono font-extrabold text-emerald-400">₹{(reports?.grand_total_revenue || 0).toLocaleString('en-IN')}</td>
                    <td className="py-4 px-4 font-mono font-extrabold text-rose-400 rounded-r-xl">₹{(reports?.total_pending_payments || 0).toLocaleString('en-IN')}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

        </div>
      )}

    </div>
  );
}
