import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  Wrench, CheckCircle2, Clock, AlertTriangle, IndianRupee, 
  ArrowUpRight, Package, Calendar, Activity, ChevronRight 
} from 'lucide-react';
import API from '../services/api';
import { fetchCloudAdminProfiles } from '../utils/cloudSync';

export default function DashboardPage() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchStats = async () => {
    setLoading(true);
    let backendStats = null;

    // First fetch fresh master store so any new device gets latest jobs, invoices & inventory
    let cloudStore = null;
    try {
      const axios = (await import('axios')).default;
      const res = await axios.get('https://jsonblob.com/api/jsonBlob/019fd0d0-8dfa-755c-9195-7f74e5af7d09?t=' + Date.now(), {
        headers: { 'Accept': 'application/json', 'Cache-Control': 'no-cache' },
        timeout: 3000
      });
      if (res.data) cloudStore = res.data;
    } catch (e) {}

    try {
      const res = await API.get('/dashboard/stats/', { timeout: 1500 });
      backendStats = res.data;
    } catch (err) {
      console.warn('Backend API offline for dashboard stats, computing from cloud & local memory:', err);
    }

    const jobs = Array.isArray(cloudStore?.jobs) ? cloudStore.jobs : JSON.parse(localStorage.getItem('workshop_jobs') || '[]');
    const invoices = Array.isArray(cloudStore?.invoices) ? cloudStore.invoices : JSON.parse(localStorage.getItem('local_invoices') || '[]');
    const inventory = Array.isArray(cloudStore?.inventory) ? cloudStore.inventory : JSON.parse(localStorage.getItem('inventory_items') || localStorage.getItem('spare_parts') || '[]');

    const todayStr = new Date().toISOString().split('T')[0];

    const todayServices = jobs.filter(j => j && (j.created_at || '').startsWith(todayStr)).length;
    const completedServices = jobs.filter(j => j && (j.status === 'FINISHED' || j.status === 'COMPLETED')).length;
    const pendingServices = jobs.filter(j => j && j.status !== 'FINISHED' && j.status !== 'COMPLETED').length;

    const pendingPayments = invoices.reduce((acc, inv) => acc + (parseFloat(inv.pending_amount) || 0), 0);
    
    const todayRevenue = invoices.filter(inv => inv && (inv.created_at || '').startsWith(todayStr))
      .reduce((acc, inv) => acc + (parseFloat(inv.paid_amount || inv.grand_total) || 0), 0);

    const lowStockCount = inventory.filter(i => (parseInt(i.current_stock || 0, 10)) <= (parseInt(i.min_stock_alert || 2, 10))).length;

    setStats({
      today_services: backendStats?.today_services ?? todayServices,
      completed_services: backendStats?.completed_services ?? completedServices,
      pending_services: backendStats?.pending_services ?? pendingServices,
      pending_payments: backendStats?.pending_payments ?? pendingPayments,
      today_revenue: backendStats?.today_revenue ?? todayRevenue,
      low_stock_count: backendStats?.low_stock_count ?? lowStockCount
    });
    setLoading(false);
  };

  useEffect(() => {
    fetchStats();
  }, []);

  if (loading) {
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

  return (
    <div className="space-y-8">
      
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-700 text-white rounded-3xl p-6 sm:p-8 shadow-lg flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold font-poppins">Garage Operations Center</h1>
          <p className="text-blue-100 text-xs sm:text-sm">Real-time overview of active workshop jobs, stock alerts, and customer billing.</p>
        </div>
        <Link
          to="/app/new-service"
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
            <Link to="/app/workshop" className="text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1">
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
                      Live Total: ₹{job.live_total}
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
            <Link to="/app/inventory" className="text-xs font-bold text-red-600 hover:text-red-700">
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
