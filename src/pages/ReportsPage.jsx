import React, { useState, useEffect } from 'react';
import { BarChart3, IndianRupee, Package, Users, TrendingUp, AlertCircle, Wrench } from 'lucide-react';
import API from '../services/api';
import { fetchCloudDeletedIds, fetchCloudInvoices, fetchCloudInventory } from '../utils/cloudSync';

const computeInstantReports = () => {
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
      if (!allMap.has(key) && !allMap.has(String(j.id))) {
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
    const now = new Date();
    const todayISO = now.toISOString().split('T')[0];
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    const isToday = (dateVal) => {
      if (!dateVal) return false;
      const dStr = String(dateVal).trim();
      if (dStr.startsWith(todayISO)) return true;
      const parsed = new Date(dateVal);
      if (!isNaN(parsed.getTime())) {
        return parsed.getDate() === now.getDate() && parsed.getMonth() === currentMonth && parsed.getFullYear() === currentYear;
      }
      return false;
    };

    const isThisMonth = (dateVal) => {
      if (!dateVal) return false;
      const parsed = new Date(dateVal);
      if (!isNaN(parsed.getTime())) {
        return parsed.getMonth() === currentMonth && parsed.getFullYear() === currentYear;
      }
      return false;
    };

    const dailyRevenue = allInvoices
      .filter(inv => isToday(inv.created_at))
      .reduce((acc, inv) => acc + (parseFloat(inv.paid_amount) || 0), 0);

    const monthlyRevenue = allInvoices
      .filter(inv => isThisMonth(inv.created_at))
      .reduce((acc, inv) => acc + (parseFloat(inv.paid_amount) || 0), 0);

    const cleanInv = localInventory.filter(i => i && !isDeleted(i.id) && !isDeleted(i.part_name));
    const inventoryValue = cleanInv.reduce((acc, item) => {
      const price = parseFloat(item.price || 0);
      const stock = parseInt(item.current_stock || 0, 10);
      return acc + (price * stock);
    }, 0);

    const totalPendingDues = allInvoices.reduce((acc, inv) => acc + (parseFloat(inv.pending_amount) || 0), 0);

    return {
      daily_revenue: dailyRevenue,
      monthly_revenue: monthlyRevenue,
      total_invoices: allInvoices.length,
      inventory_valuation: inventoryValue,
      total_inventory_value: inventoryValue,
      total_pending_payments: totalPendingDues
    };
  } catch {
    return {
      daily_revenue: 0,
      monthly_revenue: 0,
      total_invoices: 0,
      inventory_valuation: 0,
      total_inventory_value: 0,
      total_pending_payments: 0
    };
  }
};

export default function ReportsPage() {
  const [reports, setReports] = useState(() => computeInstantReports());
  const [loading, setLoading] = useState(false);

  const fetchReports = async () => {
    try {
      await fetchMasterStore().catch(() => null);
    } catch (e) {}
    setReports(computeInstantReports());
    setLoading(false);
  };

  useEffect(() => {
    fetchReports();
    const interval = setInterval(() => {
      fetchReports();
    }, 5000);
    const handleStorage = () => setReports(computeInstantReports());
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
