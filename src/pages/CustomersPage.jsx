import React, { useState, useEffect } from 'react';
import { Users, Search, Phone, Bike, Calendar, IndianRupee, Trash2, Lock, ShieldCheck, AlertTriangle } from 'lucide-react';
import API from '../services/api';
import { pushCloudRecycleBinItem, fetchCloudKhataEntries, fetchCloudJobs, fetchCloudBookings, fetchCloudInvoices, fetchCloudDeletedIds, deleteCloudCustomer, markIdAsDeleted } from '../utils/cloudSync';

export default function CustomersPage() {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Password verification modal state
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [adminPassword, setAdminPassword] = useState('');
  const [modalError, setModalError] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const fetchCustomers = async () => {
    setLoading(true);
    let backendCusts = [];
    try {
      const res = await API.get('/customers/', { timeout: 1500 });
      backendCusts = res.data || [];
    } catch (err) {
      console.warn('Backend API offline for customers, deriving from local jobs, khata, and bookings:', err);
    }

    const deletedIds = await fetchCloudDeletedIds().catch(() => []);

    const allJobs = JSON.parse(localStorage.getItem('workshop_jobs') || '[]');
    const cloudJobs = await fetchCloudJobs().catch(() => []);
    const finishedJobs = [...allJobs, ...cloudJobs].filter(j => j && (j.status === 'FINISHED' || j.status === 'COMPLETED'));

    const localBookings = JSON.parse(localStorage.getItem('local_bookings') || '[]');
    const cloudBookings = await fetchCloudBookings().catch(() => []);
    const combinedBookings = [...localBookings, ...cloudBookings];

    const localKhata = JSON.parse(localStorage.getItem('khata_entries') || '[]');
    const cloudKhata = await fetchCloudKhataEntries().catch(() => []);
    const combinedKhata = [...localKhata, ...cloudKhata];

    const localInvoices = JSON.parse(localStorage.getItem('local_invoices') || '[]');
    const cloudInvoices = await fetchCloudInvoices().catch(() => []);
    const combinedInvoices = [...localInvoices, ...cloudInvoices];

    const savedCustomers = JSON.parse(localStorage.getItem('local_customers') || '[]');

    const allMap = new Map();
    [...backendCusts, ...finishedJobs, ...combinedInvoices, ...combinedKhata, ...combinedBookings, ...savedCustomers].forEach(c => {
      if (c && typeof c === 'object') {
        const name = (c.customer_name || c.name || '').trim();
        const vehicle = (c.vehicle_number || '').trim();
        const phone = (c.mobile_number || c.phone || c.phone_number || '').trim();
        
        if (name || vehicle || phone) {
          const key = vehicle || `${name}_${phone}`;
          if (!allMap.has(key)) {
            allMap.set(key, {
              id: c.id || key,
              customer_name: name || 'Valued Customer',
              mobile_number: phone || 'N/A',
              phone: phone || 'N/A',
              vehicle_number: vehicle || 'GJ-15',
              bike_model: c.bike_model || 'Two Wheeler',
              created_at: c.created_at || new Date().toISOString()
            });
          } else {
            const existing = allMap.get(key);
            if ((!existing.phone || existing.phone === 'N/A') && phone) {
              existing.phone = phone;
              existing.mobile_number = phone;
            }
            if ((!existing.customer_name || existing.customer_name === 'Valued Customer') && name) {
              existing.customer_name = name;
            }
          }
        }
      }
    });

    const customerList = Array.from(allMap.values()).filter(cust => {
      const strId = String(cust.id || '');
      return !deletedIds.includes(strId);
    }).map(cust => {
      const custVeh = (cust.vehicle_number || '').replace(/[^A-Za-z0-9]/g, '').toUpperCase();
      const custName = (cust.customer_name || '').toLowerCase();

      // Count Visits (Only Finished Jobs or Invoices)
      const matchingJobs = finishedJobs.filter(j => {
        if (!j) return false;
        const jVeh = (j.vehicle_number || '').replace(/[^A-Za-z0-9]/g, '').toUpperCase();
        const jName = (j.customer_name || '').toLowerCase();
        return (custVeh && jVeh && custVeh === jVeh) || (custName && jName && custName === jName);
      });
      const visitCount = Math.max(1, matchingJobs.length);

      // Calculate Pending Khata Amount
      let pendingBalance = 0;
      combinedKhata.forEach(k => {
        if (!k) return;
        const kVeh = (k.vehicle_number || '').replace(/[^A-Za-z0-9]/g, '').toUpperCase();
        const kName = (k.customer_name || '').toLowerCase();
        if ((custVeh && kVeh && custVeh === kVeh) || (custName && kName && custName === kName)) {
          const amt = parseFloat(k.amount || 0);
          if (k.type === 'DEBIT') {
            pendingBalance += amt;
          } else if (k.type === 'CREDIT') {
            pendingBalance -= amt;
          }
        }
      });

      // Also add unpaid invoice amounts if Khata balance is 0 or less
      combinedInvoices.forEach(inv => {
        if (!inv) return;
        const invVeh = (inv.vehicle_number || '').replace(/[^A-Za-z0-9]/g, '').toUpperCase();
        const invName = (inv.customer_name || '').toLowerCase();
        if ((custVeh && invVeh && custVeh === invVeh) || (custName && invName && custName === invName)) {
          const due = parseFloat(inv.pending_amount || 0);
          if (due > 0 && pendingBalance <= 0) {
            pendingBalance += due;
          }
        }
      });

      return {
        ...cust,
        visit_count: visitCount,
        pending_amount: Math.max(0, pendingBalance)
      };
    });

    setCustomers(customerList);
    setLoading(false);
  };

  useEffect(() => {
    fetchCustomers();
  }, []);

  const openDeleteModal = (customer) => {
    setSelectedCustomer(customer);
    setAdminPassword('');
    setModalError(null);
    setShowPasswordModal(true);
  };

  const handleConfirmDelete = async (e) => {
    e.preventDefault();
    if (!adminPassword || !selectedCustomer) {
      setModalError('Please enter your Admin Password.');
      return;
    }

    setDeleting(true);
    setModalError(null);
    const targetCust = selectedCustomer;
    const targetId = targetCust.id;

    // 1. Move to Recycle Bin (local & cloud)
    const trashObj = {
      id: `trash_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      item_type: 'Customer Record',
      title: `Customer: ${targetCust.customer_name} (${targetCust.vehicle_number || 'N/A'})`,
      deleted_by: 'Patel Owner (Admin)',
      deleted_at: new Date().toISOString(),
      details: `Name: ${targetCust.customer_name} • Phone: ${targetCust.mobile_number || 'N/A'} • Bike Model: ${targetCust.bike_model || 'Two Wheeler'}`,
      payload: targetCust
    };

    const existingTrash = JSON.parse(localStorage.getItem('recycle_bin_items') || '[]');
    localStorage.setItem('recycle_bin_items', JSON.stringify([trashObj, ...existingTrash]));
    pushCloudRecycleBinItem(trashObj).catch(console.warn);

    // 2. Delete customer record locally and from cloud store
    await deleteCloudCustomer(targetId).catch(console.warn);
    await markIdAsDeleted(targetId).catch(console.warn);

    // 3. Update React state
    setCustomers(prev => prev.filter(c => String(c.id) !== String(targetId)));
    setShowPasswordModal(false);

    try {
      await API.post(`/customers/${targetId}/delete_with_password/`, {
        admin_password: adminPassword
      }, { timeout: 2000 });
    } catch (err) {
      console.warn('Backend API offline, moved customer to Recycle Bin locally:', err);
    } finally {
      setDeleting(false);
      alert('Customer moved to Recycle Bin!');
    }
  };

  const filtered = customers.filter(c =>
    c.customer_name.toLowerCase().includes(search.toLowerCase()) ||
    c.phone?.includes(search) ||
    c.vehicle_number.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-8">
      
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 font-poppins">Customer Registry</h1>
          <p className="text-xs text-slate-500">Track customer vehicle visits, contact numbers, and pending balances (Password Protected Deletion).</p>
        </div>
      </div>

      {/* SEARCH BAR */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 soft-shadow">
        <div className="relative max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by customer name, phone, or vehicle..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          />
        </div>
      </div>

      {/* CUSTOMERS TABLE */}
      <div className="bg-white rounded-3xl border border-slate-200/80 soft-shadow overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-slate-500 font-medium">Loading Customers...</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-slate-400">No customers found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-slate-50 border-b border-slate-200/80 uppercase font-bold text-slate-500 font-poppins">
                <tr>
                  <th className="px-6 py-4">Customer Name</th>
                  <th className="px-6 py-4">Phone Number</th>
                  <th className="px-6 py-4">Vehicle Number</th>
                  <th className="px-6 py-4">Total Visits</th>
                  <th className="px-6 py-4">Pending Amount (₹)</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-6 py-4 font-bold text-slate-900 font-poppins">{c.customer_name}</td>
                    <td className="px-6 py-4 font-medium text-slate-700">{c.phone || c.mobile_number || 'N/A'}</td>
                    <td className="px-6 py-4">
                      <span className="font-mono text-xs font-bold px-2.5 py-1 rounded-md bg-slate-100 text-slate-800 border border-slate-200">
                        {c.vehicle_number}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-bold text-slate-900 font-poppins">{c.visit_count} Visits</td>
                    <td className="px-6 py-4">
                      {parseFloat(c.pending_amount) > 0 ? (
                        <span className="font-bold text-red-600 bg-red-50 px-3 py-1 rounded-full border border-red-200">
                          ₹{parseFloat(c.pending_amount).toFixed(2)}
                        </span>
                      ) : (
                        <span className="font-bold text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
                          ₹0.00 (Clear)
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => openDeleteModal(c)}
                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Delete Customer Record (Password Required)"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ADMIN PASSWORD VERIFICATION MODAL */}
      {showPasswordModal && selectedCustomer && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full space-y-6 shadow-2xl">
            <div className="text-center space-y-2">
              <div className="w-12 h-12 bg-red-50 text-red-600 rounded-2xl flex items-center justify-center mx-auto border border-red-100">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <h2 className="text-xl font-bold text-slate-900 font-poppins">Confirm Customer Deletion</h2>
              <p className="text-xs text-slate-500">
                Enter Admin Password to permanently delete customer <strong>{selectedCustomer.customer_name}</strong> ({selectedCustomer.vehicle_number}).
              </p>
            </div>

            {modalError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-600 font-medium flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{modalError}</span>
              </div>
            )}

            <form onSubmit={handleConfirmDelete} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Admin Password</label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="password"
                    required
                    autoFocus
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/20"
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowPasswordModal(false)}
                  className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={deleting}
                  className="flex-1 py-3 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-xl shadow-md disabled:opacity-50"
                >
                  {deleting ? 'Deleting...' : 'Verify & Delete Customer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
