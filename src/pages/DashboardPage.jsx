import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  Wrench, CheckCircle2, Clock, AlertTriangle, IndianRupee, 
  ArrowUpRight, Package, Calendar, Activity, ChevronRight 
} from 'lucide-react';
import API from '../services/api';
import { fetchMasterStore, fetchCloudAdminProfiles, getCleanDeletedIds } from '../utils/cloudSync';

const computeInstantStats = () => {
  try {
    const isToday = (dateVal) => {
      if (!dateVal) return false;
      const dStr = String(dateVal).trim();
      const todayISO = new Date().toISOString().split('T')[0];
      const todayLoc = new Date().toLocaleDateString('en-CA');
      const d = new Date().getDate();
      const m = new Date().getMonth() + 1;
      const y = new Date().getFullYear();
      const dPad = String(d).padStart(2, '0');
      const mPad = String(m).padStart(2, '0');
      const todayDMY = `${dPad}/${mPad}/${y}`;
      const todayDMYDash = `${dPad}-${mPad}/${y}`;

      if (dStr.startsWith(todayISO) || dStr.startsWith(todayLoc) || dStr.includes(todayDMY) || dStr.includes(todayDMYDash)) return true;
      
      const parsed = new Date(dateVal);
      if (!isNaN(parsed.getTime())) {
        return parsed.getDate() === d && (parsed.getMonth() + 1) === m && parsed.getFullYear() === y;
      }
      return false;
    };

    const localInvoices = JSON.parse(localStorage.getItem('local_invoices') || '[]');
    const localJobs = JSON.parse(localStorage.getItem('workshop_jobs') || '[]');
    const localInventory = JSON.parse(localStorage.getItem('inventory_items') || localStorage.getItem('spare_parts') || '[]');

    const todayServices = Math.max(
      localJobs.filter(j => isToday(j.created_at || j.finished_at || j.completed_at)).length,
      localInvoices.filter(inv => isToday(inv.created_at || inv.visit_date)).length
    );

    const completedServices = Math.max(
      localJobs.filter(j => j.status === 'FINISHED' || j.status === 'COMPLETED').length,
      localInvoices.length
    );

    const pendingServices = localJobs.filter(j => j && j.status !== 'FINISHED' && j.status !== 'COMPLETED' && j.status !== 'CANCELLED').length;
    const pendingPayments = localInvoices.reduce((acc, inv) => acc + (parseFloat(inv.pending_amount) || 0), 0);

    const invoiceRevenue = localInvoices
      .filter(inv => isToday(inv.created_at || inv.visit_date || inv.date))
      .reduce((acc, inv) => acc + (parseFloat(inv.paid_amount !== undefined ? inv.paid_amount : (inv.grand_total || inv.total_amount || 0)) || 0), 0);

    const jobsRevenue = localJobs
      .filter(j => (j.status === 'FINISHED' || j.status === 'COMPLETED') && isToday(j.finished_at || j.completed_at || j.created_at))
      .reduce((acc, j) => acc + (parseFloat(j.paid_amount !== undefined ? j.paid_amount : (j.grand_total || j.live_total || 0)) || 0), 0);

    const totalAllPaid = localInvoices.reduce((acc, inv) => acc + (parseFloat(inv.paid_amount !== undefined ? inv.paid_amount : (inv.grand_total || 0)) || 0), 0);
    const todayRevenue = Math.max(invoiceRevenue, jobsRevenue, totalAllPaid);

    const lowStockItems = localInventory.filter(i => (parseInt(i.current_stock || 0, 10)) <= (parseInt(i.min_stock_alert || 2, 10)));
    const lowStockCount = lowStockItems.length;

    const recentJobs = [...localJobs].sort(
      (a, b) => new Date(b.created_at || b.finished_at || Date.now()) - new Date(a.created_at || a.finished_at || Date.now())
    ).slice(0, 5);

    return {
      today_services: todayServices,
      completed_services: completedServices,
      pending_services: pendingServices,
      pending_payments: pendingPayments,
      today_revenue: todayRevenue,
      low_stock_count: lowStockCount,
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
    const cloudStore = await fetchMasterStore().catch(() => null);
    const deletedIds = await getCleanDeletedIds().catch(() => []);
    const isDeleted = (id) => id && deletedIds.includes(String(id));

    // 1. Invoices
    const localInvoices = JSON.parse(localStorage.getItem('local_invoices') || '[]');
    const cloudInvoices = Array.isArray(cloudStore?.invoices) ? cloudStore.invoices : [];
    const invMap = new Map();
    [...cloudInvoices, ...localInvoices].forEach(inv => {
      if (inv && (inv.id || inv.job_id || inv.invoice_number) && !isDeleted(inv.id) && !isDeleted(inv.invoice_number)) {
        const key = String(inv.id || inv.job_id || inv.invoice_number);
        invMap.set(key, inv);
      }
    });
    const invoices = Array.from(invMap.values());

    // 2. Jobs
    const localJobs = JSON.parse(localStorage.getItem('workshop_jobs') || '[]');
    const cloudJobs = Array.isArray(cloudStore?.jobs) ? cloudStore.jobs : [];
    const jobMap = new Map();
    [...cloudJobs, ...localJobs].forEach(j => {
      if (j && j.id && !isDeleted(j.id)) jobMap.set(String(j.id), j);
    });
    const jobs = Array.from(jobMap.values());

    // 3. Inventory
    const localInventory = JSON.parse(localStorage.getItem('inventory_items') || localStorage.getItem('spare_parts') || '[]');
    const cloudInventory = Array.isArray(cloudStore?.inventory) ? cloudStore.inventory : [];
    const itemMap = new Map();
    [...cloudInventory, ...localInventory].forEach(item => {
      if (item && item.id && !isDeleted(item.id) && !isDeleted(item.part_name)) {
        itemMap.set(String(item.id), item);
      }
    });
    const inventory = Array.from(itemMap.values());

    // Unified Date Helper for IST & UTC matching
    const isToday = (dateVal) => {
      if (!dateVal) return false;
      const dStr = String(dateVal).trim();
      const todayISO = new Date().toISOString().split('T')[0];
      const todayLoc = new Date().toLocaleDateString('en-CA');
      const d = new Date().getDate();
      const m = new Date().getMonth() + 1;
      const y = new Date().getFullYear();
      const dPad = String(d).padStart(2, '0');
      const mPad = String(m).padStart(2, '0');
      const todayDMY = `${dPad}/${mPad}/${y}`;
      const todayDMYDash = `${dPad}-${mPad}-${y}`;

      if (dStr.startsWith(todayISO) || dStr.startsWith(todayLoc) || dStr.includes(todayDMY) || dStr.includes(todayDMYDash)) return true;
      
      const parsed = new Date(dateVal);
      if (!isNaN(parsed.getTime())) {
        return parsed.getDate() === d && (parsed.getMonth() + 1) === m && parsed.getFullYear() === y;
      }
      return false;
    };

    // Calculate Exact Metrics
    const todayServices = Math.max(
      jobs.filter(j => isToday(j.created_at || j.finished_at || j.completed_at)).length,
      invoices.filter(inv => isToday(inv.created_at || inv.visit_date)).length
    );

    const completedServices = Math.max(
      jobs.filter(j => j.status === 'FINISHED' || j.status === 'COMPLETED').length,
      invoices.length
    );

    const pendingServices = jobs.filter(j => j && j.status !== 'FINISHED' && j.status !== 'COMPLETED' && j.status !== 'CANCELLED').length;

    const pendingPayments = invoices.reduce((acc, inv) => acc + (parseFloat(inv.pending_amount) || 0), 0);

    const invoiceRevenue = invoices
      .filter(inv => isToday(inv.created_at || inv.visit_date || inv.date))
      .reduce((acc, inv) => acc + (parseFloat(inv.paid_amount !== undefined ? inv.paid_amount : (inv.grand_total || inv.total_amount || 0)) || 0), 0);

    const jobsRevenue = jobs
      .filter(j => (j.status === 'FINISHED' || j.status === 'COMPLETED') && isToday(j.finished_at || j.completed_at || j.created_at))
      .reduce((acc, j) => acc + (parseFloat(j.paid_amount !== undefined ? j.paid_amount : (j.grand_total || j.live_total || 0)) || 0), 0);

    const totalAllPaid = invoices.reduce((acc, inv) => acc + (parseFloat(inv.paid_amount !== undefined ? inv.paid_amount : (inv.grand_total || 0)) || 0), 0);

    const todayRevenue = Math.max(invoiceRevenue, jobsRevenue, totalAllPaid);

    const lowStockItems = inventory.filter(i => (parseInt(i.current_stock || 0, 10)) <= (parseInt(i.min_stock_alert || 2, 10)));
    const lowStockCount = lowStockItems.length;

    // Recent Jobs List
    const recentJobs = [...jobs].sort(
      (a, b) => new Date(b.created_at || b.finished_at || Date.now()) - new Date(a.created_at || a.finished_at || Date.now())
    ).slice(0, 5);

    setStats({
      today_services: todayServices,
      completed_services: completedServices,
      pending_services: pendingServices,
      pending_payments: pendingPayments,
      today_revenue: todayRevenue,
      low_stock_count: lowStockCount,
      recent_jobs: recentJobs,
      low_stock_items: lowStockItems
    });
    setLoading(false);
  };

  useEffect(() => {
    fetchStats();
    const interval = setInterval(() => {
      fetchStats();
    }, 3000);
    const handleStorage = () => fetchStats();
    window.addEventListener('storage', handleStorage);
    return () => {
      clearInterval(interval);
      window.removeEventListener('storage', handleStorage);
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
    { title: "Pending Payments", value: `₹${(stats?.pending_payments || 0).toLocaleString('en-IN')}`, icon: IndianRupee, color: "text-purple-600", bg: "bg-purple-50", border: "border-purple-100" },
    { title: "Today's Revenue", value: `₹${(stats?.today_revenue || 0).toLocaleString('en-IN')}`, icon: IndianRupee, color: "text-emerald-600", bg: "bg-emerald-50", border: "border-emerald-100" },
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
