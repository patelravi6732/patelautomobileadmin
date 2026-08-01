import React, { useState, useEffect } from 'react';
import { BarChart3, IndianRupee, Package, Users, TrendingUp, AlertCircle, Wrench } from 'lucide-react';
import API from '../services/api';

export default function ReportsPage() {
  const [reports, setReports] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchReports = async () => {
    try {
      const res = await API.get('/reports/');
      setReports(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
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

          {/* MECHANIC PERFORMANCE TABLE */}
          <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200/80 soft-shadow space-y-6">
            <h2 className="text-lg font-bold text-slate-900 font-poppins flex items-center gap-2">
              <Wrench className="w-5 h-5 text-orange-500" /> Mechanic Productivity Report
            </h2>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-600">
                <thead className="bg-slate-50 uppercase font-bold text-slate-500 font-poppins border-b border-slate-200">
                  <tr>
                    <th className="px-6 py-4">Mechanic Name</th>
                    <th className="px-6 py-4">Total Jobs Assigned</th>
                    <th className="px-6 py-4">Completed Jobs</th>
                    <th className="px-6 py-4">Completion Rate</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {reports?.mechanic_performance?.map((m, idx) => {
                    const rate = m.total_jobs > 0 ? ((m.completed_jobs / m.total_jobs) * 100).toFixed(0) : 0;
                    return (
                      <tr key={idx} className="hover:bg-slate-50">
                        <td className="px-6 py-4 font-bold text-slate-900 font-poppins">{m.assigned_mechanic}</td>
                        <td className="px-6 py-4 font-bold text-slate-700">{m.total_jobs}</td>
                        <td className="px-6 py-4 font-bold text-emerald-600">{m.completed_jobs}</td>
                        <td className="px-6 py-4">
                          <span className="px-3 py-1 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                            {rate}% Completed
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      )}

    </div>
  );
}
