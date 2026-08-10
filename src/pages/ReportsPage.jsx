import React, { useState, useEffect } from 'react';
import { BarChart3, IndianRupee, Package, Users, TrendingUp, AlertCircle, Wrench } from 'lucide-react';
import API from '../services/api';
import { fetchCloudDeletedIds, fetchCloudInvoices, fetchCloudInventory } from '../utils/cloudSync';

export default function ReportsPage() {
  const [reports, setReports] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchReports = async (isInitial = false) => {
    if (isInitial) setLoading(true);
    let backendReports = null;
    try {
      const res = await API.get('/reports/metrics/', { timeout: 1500 });
      backendReports = res.data;
    } catch (err) {
      console.warn('Backend API offline for reports, computing from cloud & local memory:', err);
    }

    const deletedIds = await fetchCloudDeletedIds().catch(() => []);
    const isDeleted = (id) => id && deletedIds.includes(String(id));

    const localInvoices = JSON.parse(localStorage.getItem('local_invoices') || '[]');
    const cloudInvoices = await fetchCloudInvoices().catch(() => []);
    const invMap = new Map();
    [...cloudInvoices, ...localInvoices].forEach(inv => {
      if (inv && (inv.id || inv.job_id || inv.invoice_number) && !isDeleted(inv.id) && !isDeleted(inv.invoice_number)) {
        const key = String(inv.id || inv.job_id || inv.invoice_number);
        invMap.set(key, inv);
      }
    });
    const invoices = Array.from(invMap.values());

    const localInventory = JSON.parse(localStorage.getItem('inventory_items') || localStorage.getItem('spare_parts') || '[]');
    const cloudInventory = await fetchCloudInventory().catch(() => []);
    const invItemMap = new Map();
    [...cloudInventory, ...localInventory].forEach(item => {
      if (item && item.id && !isDeleted(item.id) && !isDeleted(item.part_name)) {
        invItemMap.set(String(item.id), item);
      }
    });
    const inventory = Array.from(invItemMap.values());

    const todayStr = new Date().toISOString().split('T')[0];
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();

    const dailyRevenue = invoices.filter(inv => inv && (inv.created_at || '').startsWith(todayStr))
      .reduce((acc, inv) => acc + (parseFloat(inv.paid_amount || inv.grand_total) || 0), 0);

    const monthlyRevenue = invoices.filter(inv => {
      if (!inv || !inv.created_at) return false;
      const d = new Date(inv.created_at);
      return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    }).reduce((acc, inv) => acc + (parseFloat(inv.paid_amount || inv.grand_total) || 0), 0);

    const inventoryValue = inventory.reduce((acc, item) => {
      const price = parseFloat(item.price || 0);
      const stock = parseInt(item.current_stock || 0, 10);
      return acc + (price * stock);
    }, 0);

    const totalPendingDues = invoices.reduce((acc, inv) => acc + (parseFloat(inv.pending_amount) || 0), 0);

    setReports({
      daily_revenue: dailyRevenue,
      monthly_revenue: monthlyRevenue,
      total_invoices: invoices.length,
      inventory_valuation: inventoryValue,
      total_inventory_value: inventoryValue,
      total_pending_payments: totalPendingDues
    });
    setLoading(false);
  };

  useEffect(() => {
    fetchReports(true);
    const interval = setInterval(() => {
      fetchReports(false);
    }, 3000);
    const handleStorage = () => fetchReports(false);
    window.addEventListener('storage', handleStorage);
    return () => {
      clearInterval(interval);
      window.removeEventListener('storage', handleStorage);
    };
  }, []);

  return (
    <div className="space-y-8">
      
      <div>
        <h1 className="text-2xl font-bold text-slate-900 font-poppins">Garage Analytics & Business Reports</h1>
        <p className="text-xs text-slate-500">Executive financial metrics, inventory valuation, and mechanic performance stats.</p>
      </div>

      {loading ? (
        <div className="p-8 text-center text-slate-500 font-medium">Generating Business Reports...</div>
      ) : (
        <div className="space-y-8">
          
          {/* REVENUE & FINANCIAL STATS */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            
            <div className="bg-white p-6 rounded-3xl border border-slate-200/80 soft-shadow space-y-2">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">Daily Revenue</span>
              <span className="text-2xl font-extrabold text-emerald-600 font-poppins block">
                ₹{(reports?.daily_revenue || 0).toLocaleString('en-IN')}
              </span>
            </div>

            <div className="bg-white p-6 rounded-3xl border border-slate-200/80 soft-shadow space-y-2">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">Monthly Revenue</span>
              <span className="text-2xl font-extrabold text-blue-600 font-poppins block">
                ₹{(reports?.monthly_revenue || 0).toLocaleString('en-IN')}
              </span>
            </div>

            <div className="bg-white p-6 rounded-3xl border border-slate-200/80 soft-shadow space-y-2">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">Inventory Valuation</span>
              <span className="text-2xl font-extrabold text-purple-600 font-poppins block">
                ₹{(reports?.total_inventory_value || 0).toLocaleString('en-IN')}
              </span>
            </div>

            <div className="bg-white p-6 rounded-3xl border border-slate-200/80 soft-shadow space-y-2">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">Pending Payment Dues</span>
              <span className="text-2xl font-extrabold text-red-600 font-poppins block">
                ₹{(reports?.total_pending_payments || 0).toLocaleString('en-IN')}
              </span>
            </div>

          </div>



        </div>
      )}

    </div>
  );
}
