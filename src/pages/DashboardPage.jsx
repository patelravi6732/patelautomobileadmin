import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  Wrench, CheckCircle2, Clock, AlertTriangle, IndianRupee, 
  ArrowUpRight, Package, Calendar, Activity, ChevronRight, ShoppingBag 
} from 'lucide-react';
import API from '../services/api';
import { fetchMasterStore, fetchCloudAdminProfiles, getCleanDeletedIds } from '../utils/cloudSync';

const computeInstantStats = () => {
  try {
    const localJobs = JSON.parse(localStorage.getItem('workshop_jobs') || '[]');
    const localInvoices = JSON.parse(localStorage.getItem('local_invoices') || '[]');
    const localInventory = JSON.parse(localStorage.getItem('inventory_items') || localStorage.getItem('spare_parts') || '[]');
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
          created_at: inv.created_at || new Date().toISOString()
        });
      }
    });

    const finishedJobs = localJobs.filter(j => j && (j.status === 'FINISHED' || j.status === 'COMPLETED') && !isDeleted(j.id) && !isDeleted(j.vehicle_number));
    finishedJobs.forEach((j, idx) => {
      const key = `bill_${j.id || idx}`;
      const strJobId = String(j.id || '');
      const strVehNum = String(j.vehicle_number || '').trim().toLowerCase();

      const alreadyHasInvoice = Array.from(allMap.values()).some(inv => {
        if (!inv) return false;
        const invJobId = String(inv.job_id || inv.id || '');
        const invVeh = String(inv.vehicle_number || '').trim().toLowerCase();
        return (strJobId && invJobId && (invJobId === strJobId || invJobId.includes(strJobId))) ||
               (strVehNum && invVeh && strVehNum === invVeh);
      });

      if (!alreadyHasInvoice && !allMap.has(key) && !allMap.has(strJobId)) {
        const partsVal = parseFloat(j.parts_total || 0);
        const labourVal = parseFloat(j.labour_charge || 100);
        const discountVal = parseFloat(j.discount_amount || 0);
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
          payment_status: pendingVal > 0 ? 'PENDING' : 'PAID',
          created_at: j.finished_at || j.completed_at || j.created_at || new Date().toISOString()
        });
      }
    });

    const allInvoices = Array.from(allMap.values());
    const activeJobs = localJobs.filter(j => j && j.status !== 'FINISHED' && j.status !== 'COMPLETED' && j.status !== 'CANCELLED' && !isDeleted(j.id));
    
    const now = new Date();
    const todayISO = now.toISOString().split('T')[0];

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

    const standaloneTodayInvoicesCount = allInvoices.filter(inv => {
      if (!inv || !isToday(inv.created_at || inv.visit_date || inv.date)) return false;
      const strInvId = String(inv.id || '');
      const strJobId = String(inv.job_id || '');
      const strVeh = String(inv.vehicle_number || '').trim().toLowerCase();

      const belongsToJob = localJobs.some(j => {
        if (!j) return false;
        const jId = String(j.id || '');
        const jVeh = String(j.vehicle_number || '').trim().toLowerCase();
        return (jId && strInvId && (jId === strInvId || strInvId.includes(jId))) ||
               (jId && strJobId && (jId === strJobId || strJobId.includes(jId))) ||
               (jVeh && strVeh && jVeh === strVeh);
      });
      return !belongsToJob;
    }).length;

    const todayServices = localJobs.filter(j => j && !isDeleted(j.id) && isToday(j.created_at || j.finished_at || j.completed_at)).length + standaloneTodayInvoicesCount;

    const completedServices = allInvoices.length;
    const pendingServices = activeJobs.length;

    const todayRevenue = allInvoices
      .filter(inv => isToday(inv.created_at || inv.visit_date || inv.date))
      .reduce((acc, inv) => {
        const grandVal = parseFloat(inv.grand_total || inv.total_amount || 0);
        const rawPaid = parseFloat(inv.paid_amount !== undefined && inv.paid_amount !== null ? inv.paid_amount : (inv.received_amount || (inv.payment_status === 'PAID' ? grandVal : 0)));
        const paidVal = Math.min(grandVal, Math.max(0, rawPaid));
        return acc + paidVal;
      }, 0);

    // 1. Workshop Services Pending Dues
    const workshopPendingDues = allInvoices.reduce((acc, inv) => {
      const grandVal = parseFloat(inv.grand_total || inv.total_amount || 0);
      const rawPaid = parseFloat(inv.paid_amount !== undefined && inv.paid_amount !== null ? inv.paid_amount : (inv.received_amount || (inv.payment_status === 'PAID' ? grandVal : 0)));
      const paidVal = Math.min(grandVal, Math.max(0, rawPaid));
      const pendingVal = inv.pending_amount !== undefined ? parseFloat(inv.pending_amount) : Math.max(0, grandVal - paidVal);
      return acc + (isNaN(pendingVal) ? 0 : Math.max(0, pendingVal));
    }, 0);

    // 2. Counter Khata Debtors Pending Dues
    const localCounterKhata = JSON.parse(localStorage.getItem('local_counter_khata') || '[]');
    const cleanCounterKhata = localCounterKhata.filter(k => k && k.id && !isDeleted(k.id) && !isDeleted(String(k.id).replace(/^ckhata_/, '')));
    const counterKhataPendingDues = cleanCounterKhata
      .filter(k => k && String(k.status).toUpperCase() !== 'PAID' && parseFloat(k.pending_amount || 0) > 0)
      .reduce((sum, k) => sum + (parseFloat(k.pending_amount || 0) || 0), 0);

    // 3. Khata Book (General Khata) Pending Dues
    const localKhataEntries = JSON.parse(localStorage.getItem('khata_entries') || '[]');
    const cleanKhataEntries = localKhataEntries.filter(k => k && k.id && !isDeleted(k.id) && !isDeleted(String(k.id).replace(/^khata_/, '')));
    const generalKhataPendingDues = cleanKhataEntries
      .filter(k => k && String(k.status).toUpperCase() !== 'PAID' && parseFloat(k.pending_amount || 0) > 0)
      .reduce((sum, k) => sum + (parseFloat(k.pending_amount || 0) || 0), 0);

    // TOTAL PENDING PAYMENT DUES (Workshop + Counter Khata + Khata Book)
    const totalPendingDues = workshopPendingDues + counterKhataPendingDues + generalKhataPendingDues;

    const cleanInv = localInventory.filter(i => i && !isDeleted(i.id) && !isDeleted(i.part_name));
    const lowStockItems = cleanInv.filter(i => (parseInt(i.current_stock || 0, 10)) <= (parseInt(i.min_stock_alert !== undefined ? i.min_stock_alert : 2, 10)));

    const recentJobs = [...localJobs].filter(j => !isDeleted(j.id)).sort(
      (a, b) => new Date(b.created_at || b.finished_at || Date.now()) - new Date(a.created_at || a.finished_at || Date.now())
    ).slice(0, 5);

    const localCounterSales = JSON.parse(localStorage.getItem('local_counter_sales') || '[]');
    const cleanCounterSales = localCounterSales.filter(s => s && s.id && !isDeleted(s.id) && !isDeleted(String(s.id).replace(/^cs_/, '')));
    const counterTodayRevenue = cleanCounterSales
      .filter(s => isToday(s.created_at || s.date))
      .reduce((sum, s) => sum + parseFloat(s.paid_amount || s.net_total || 0), 0);
    const counterTotalRevenue = cleanCounterSales
      .reduce((sum, s) => sum + parseFloat(s.paid_amount || s.net_total || 0), 0);

    return {
      today_services: todayServices,
      completed_services: completedServices,
      pending_services: pendingServices,
      pending_payments: totalPendingDues,
      workshop_pending: workshopPendingDues,
      counter_pending: counterKhataPendingDues + generalKhataPendingDues,
      today_revenue: todayRevenue,
      counter_today_revenue: counterTodayRevenue,
      counter_total_revenue: counterTotalRevenue,
      low_stock_count: lowStockItems.length,
      recent_jobs: recentJobs,
      low_stock_items: lowStockItems
    };
  } catch {
    return {
      today_services: 0,
      completed_services: 0,
      pending_services: 0,
      pending_payments: 0,
      today_revenue: 0,
      counter_today_revenue: 0,
      counter_total_revenue: 0,
      low_stock_count: 0,
      recent_jobs: [],
      low_stock_items: []
    };
  }
};

export default function DashboardPage() {
  const [stats, setStats] = useState(() => computeInstantStats());
  const [loading, setLoading] = useState(false);

  const fetchStats = async () => {
    try {
      await fetchMasterStore(true).catch(() => null);
    } catch (e) {}
    setStats(computeInstantStats());
    setLoading(false);
  };

  useEffect(() => {
    fetchStats();
    const interval = setInterval(() => {
      fetchStats();
    }, 4000);
    const handleStorage = () => setStats(computeInstantStats());
    window.addEventListener('storage', handleStorage);
    window.addEventListener('master_store_updated', handleStorage);
    window.addEventListener('khata_updated', handleStorage);
    window.addEventListener('counter_khata_updated', handleStorage);
    window.addEventListener('counter_sales_updated', handleStorage);
    window.addEventListener('inventory_updated', handleStorage);
    return () => {
      clearInterval(interval);
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('master_store_updated', handleStorage);
      window.removeEventListener('khata_updated', handleStorage);
      window.removeEventListener('counter_khata_updated', handleStorage);
      window.removeEventListener('counter_sales_updated', handleStorage);
      window.removeEventListener('inventory_updated', handleStorage);
    };
  }, []);

  if (loading && !stats) {
    return (
      <div className="p-8 text-center text-slate-500 font-medium">
        Loading Garage Metrics...
      </div>
    );
  }

  const metricCards = [
    { title: "Today's Services", value: stats?.today_services || 0, icon: Wrench, color: "text-blue-600", bg: "bg-blue-50", border: "border-blue-100" },
    { title: "Completed Services", value: stats?.completed_services || 0, icon: CheckCircle2, color: "text-emerald-600", bg: "bg-emerald-50", border: "border-emerald-100" },
    { title: "Pending Services", value: stats?.pending_services || 0, icon: Clock, color: "text-amber-600", bg: "bg-amber-50", border: "border-amber-100" },
    { title: "Today's Service Revenue", value: `₹${(stats?.today_revenue || 0).toLocaleString('en-IN')}`, icon: IndianRupee, color: "text-emerald-600", bg: "bg-emerald-50", border: "border-emerald-100" },
    { title: "Today's Counter Sale", value: `₹${(stats?.counter_today_revenue || 0).toLocaleString('en-IN')}`, icon: ShoppingBag, color: "text-indigo-600", bg: "bg-indigo-50", border: "border-indigo-100" },
    { title: "Pending Payments Dues", value: `₹${(stats?.pending_payments || 0).toLocaleString('en-IN')}`, icon: IndianRupee, color: "text-purple-600", bg: "bg-purple-50", border: "border-purple-100" },
    { title: "Low Stock Alert", value: `${stats?.low_stock_count || 0} Items`, icon: AlertTriangle, color: "text-red-600", bg: "bg-red-50", border: "border-red-100" },
  ];

  const basePrefix = typeof window !== 'undefined' && window.location.pathname.startsWith('/admin') ? '/admin' : '/app';

  return (
    <div className="space-y-8">
      
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-700 text-white rounded-3xl p-6 sm:p-8 shadow-lg flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold font-poppins">Garage Operations Center</h1>
          <p className="text-blue-100 text-xs sm:text-sm">Real-time overview of active workshop jobs, stock alerts, and customer billing.</p>
        </div>
        <Link
          to={`${basePrefix}/new-service`}
          className="inline-flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white font-bold text-sm px-5 py-3 rounded-xl shadow-md transition-all shrink-0"
        >
          + Start New Service
        </Link>
      </div>

      {/* METRIC CARDS GRID */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {metricCards.map((card, idx) => {
          const Icon = card.icon;
          return (
            <div key={idx} className={`bg-white p-6 rounded-2xl border ${card.border} soft-shadow flex items-center justify-between`}>
              <div className="space-y-1">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">{card.title}</span>
                <span className="text-2xl font-extrabold text-slate-900 font-poppins block">{card.value}</span>
              </div>
              <div className={`w-12 h-12 rounded-xl ${card.bg} ${card.color} flex items-center justify-center shrink-0`}>
                <Icon className="w-6 h-6" />
              </div>
            </div>
          );
        })}
      </div>

      {/* TWO COLUMN CONTENT */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* RECENT ACTIVITY / JOBS */}
        <div className="lg:col-span-8 bg-white p-6 rounded-3xl border border-slate-200/80 soft-shadow space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Activity className="w-5 h-5 text-blue-600" />
              <h2 className="text-lg font-bold text-slate-900 font-poppins">Recent Workshop Jobs</h2>
            </div>
            <Link to={`${basePrefix}/workshop`} className="text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1">
              Go To Workshop <ChevronRight className="w-4 h-4" />
            </Link>
          </div>

          <div className="divide-y divide-slate-100">
            {stats?.recent_jobs?.length > 0 ? (
              stats.recent_jobs.map((job) => (
                <div key={job.id} className="py-4 flex items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-3">
                      <span className="font-bold text-slate-900 text-sm font-poppins">{job.customer_name}</span>
                      <span className="font-mono text-xs px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-bold">
                        {job.vehicle_number}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500">{job.bike_model} • Mechanic: {job.assigned_mechanic}</p>
                  </div>

                  <div className="text-right space-y-1">
                    <span className={`text-xs font-bold px-2.5 py-1 rounded-full uppercase ${
                      job.status === 'FINISHED' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                      job.status === 'CANCELLED' ? 'bg-red-50 text-red-700 border border-red-200' :
                      'bg-amber-50 text-amber-700 border border-amber-200'
                    }`}>
                      {job.status}
                    </span>
                    <span className="block text-xs font-bold text-slate-900 font-poppins mt-0.5">
                      Live Total: ₹{job.live_total || job.grand_total || 0}
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <p className="py-8 text-center text-xs text-slate-400">No recent workshop activity.</p>
            )}
          </div>
        </div>

        {/* LOW STOCK ALERTS CARD */}
        <div className="lg:col-span-4 bg-white p-6 rounded-3xl border border-slate-200/80 soft-shadow space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-500" />
              <h2 className="text-lg font-bold text-slate-900 font-poppins">Low Stock Alert</h2>
            </div>
            <Link to={`${basePrefix}/inventory`} className="text-xs font-bold text-red-600 hover:text-red-700">
              Manage Inventory
            </Link>
          </div>

          <div className="space-y-3">
            {stats?.low_stock_items?.length > 0 ? (
              stats.low_stock_items.map((item) => (
                <div key={item.id} className="p-3.5 rounded-xl bg-red-50/60 border border-red-100 flex items-center justify-between text-xs">
                  <div>
                    <span className="font-bold text-slate-900 block">{item.part_name}</span>
                    <span className="text-slate-500">{item.category} • ₹{item.price}</span>
                  </div>
                  <span className="font-bold text-red-700 bg-red-100 px-2.5 py-1 rounded-md">
                    Stock: {item.current_stock}
                  </span>
                </div>
              ))
            ) : (
              <div className="p-6 text-center text-xs text-emerald-600 bg-emerald-50 rounded-2xl font-medium border border-emerald-100">
                All inventory stock levels look healthy!
              </div>
            )}
          </div>
        </div>

      </div>

    </div>
  );
}
