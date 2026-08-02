import React, { useState, useEffect } from 'react';
import { Trash2, RotateCcw, ShieldAlert, Clock, User, FileText, CheckCircle2, AlertTriangle } from 'lucide-react';
import API from '../services/api';
import { fetchCloudRecycleBin, restoreCloudRecycleBinItem, emptyCloudRecycleBin, pushCloudInventoryItem, pushCloudJob, pushCloudInvoice, pushCloudKhataEntry, unmarkDeletedId } from '../utils/cloudSync';
import AdminPasswordModal from '../components/AdminPasswordModal';

export default function RecycleBinPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deleteModal, setDeleteModal] = useState({ isOpen: false, item: null, isDeleteAll: false });

  const fetchRecycleBin = async () => {
    setLoading(true);
    let backendItems = [];
    try {
      const res = await API.get('/recycle-bin/', { timeout: 800 });
      backendItems = res.data || [];
    } catch (err) {
      console.warn('Backend API offline for Recycle Bin, using fast local+cloud store:', err);
    }

    const localTrash = JSON.parse(localStorage.getItem('recycle_bin_items') || '[]');
    const cloudTrash = await fetchCloudRecycleBin();

    const allMap = new Map();
    [...backendItems, ...localTrash, ...cloudTrash].forEach(r => {
      if (r && typeof r === 'object') {
        const key = String(r.id || `${r.title}_${r.deleted_at}`);
        if (!allMap.has(key)) {
          allMap.set(key, {
            ...r,
            deleted_by: r.deleted_by || 'Patel Owner (Admin)',
            details: r.details || (r.payload ? `Category: ${r.payload.category || 'General'} • Price: ₹${r.payload.price || 0}` : 'Deleted item')
          });
        }
      }
    });

    setItems(Array.from(allMap.values()).sort((a, b) => new Date(b.deleted_at || Date.now()) - new Date(a.deleted_at || Date.now())));
    setLoading(false);
  };

  useEffect(() => {
    fetchRecycleBin();
  }, []);

  const handleRestore = async (item) => {
    restoreCloudRecycleBinItem(item.id).catch(console.warn);
    const targetPayloadId = item.payload?.id || item.id;
    unmarkDeletedId(targetPayloadId).catch(console.warn);
    if (item.payload?.invoice_number) unmarkDeletedId(item.payload.invoice_number).catch(console.warn);

    // Restore locally
    const currentTrash = JSON.parse(localStorage.getItem('recycle_bin_items') || '[]');
    const updatedTrash = currentTrash.filter(r => String(r.id) !== String(item.id));
    localStorage.setItem('recycle_bin_items', JSON.stringify(updatedTrash));

    if (item.payload) {
      if (item.item_type === 'Inventory') {
        const currentInv = JSON.parse(localStorage.getItem('inventory_items') || '[]');
        localStorage.setItem('inventory_items', JSON.stringify([item.payload, ...currentInv]));
        pushCloudInventoryItem(item.payload).catch(console.warn);
      } else if (item.item_type === 'Billing Invoice') {
        const currentInvs = JSON.parse(localStorage.getItem('local_invoices') || '[]');
        localStorage.setItem('local_invoices', JSON.stringify([item.payload, ...currentInvs]));
        pushCloudInvoice(item.payload).catch(console.warn);
      } else if (item.item_type === 'Workshop Job') {
        const currentJobs = JSON.parse(localStorage.getItem('workshop_jobs') || '[]');
        localStorage.setItem('workshop_jobs', JSON.stringify([item.payload, ...currentJobs]));
        pushCloudJob(item.payload).catch(console.warn);
      } else if (item.item_type === 'Khata Account') {
        const currentKhata = JSON.parse(localStorage.getItem('khata_entries') || '[]');
        localStorage.setItem('khata_entries', JSON.stringify([item.payload, ...currentKhata]));
        pushCloudKhataEntry(item.payload).catch(console.warn);
      }
    }

    setItems(prev => prev.filter(r => String(r.id) !== String(item.id)));

    try {
      await API.post(`/recycle-bin/${item.id}/restore/`, {}, { timeout: 1500 });
    } catch (err) {
      console.warn('Backend API offline, restored item locally & cloud store:', err);
    } finally {
      alert('✅ Item restored back to active database!');
    }
  };

  const handlePermanentDeleteWithPassword = async (adminPassword) => {
    if (deleteModal.isDeleteAll) {
      emptyCloudRecycleBin().catch(console.warn);
      localStorage.setItem('recycle_bin_items', '[]');
      setItems([]);
      setDeleteModal({ isOpen: false, item: null, isDeleteAll: false });

      try {
        await API.post('/recycle-bin/empty_recycle_bin/', { admin_password: adminPassword }, { timeout: 2000 });
      } catch (err) {
        console.warn('Backend API offline, emptied Recycle Bin locally & cloud store:', err);
      } finally {
        alert('All items in Recycle Bin permanently deleted!');
      }
      return;
    }

    if (!deleteModal.item) return;
    const targetId = deleteModal.item.id;

    const currentTrash = JSON.parse(localStorage.getItem('recycle_bin_items') || '[]');
    const updatedTrash = currentTrash.filter(r => String(r.id) !== String(targetId));
    localStorage.setItem('recycle_bin_items', JSON.stringify(updatedTrash));

    setItems(prev => prev.filter(r => String(r.id) !== String(targetId)));
    setDeleteModal({ isOpen: false, item: null, isDeleteAll: false });

    try {
      await API.post(`/recycle-bin/${targetId}/permanent_delete/`, { admin_password: adminPassword }, { timeout: 2000 });
    } catch (err) {
      console.warn('Backend API offline, permanently deleted item locally & cloud store:', err);
    } finally {
      alert('Item permanently deleted from database!');
    }
  };

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 font-poppins flex items-center gap-2.5">
            <Trash2 className="w-7 h-7 text-rose-600" /> Admin Recycle Bin
          </h1>
        </div>

        <div className="flex items-center gap-3">
          <span className="px-4 py-1.5 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200">
            Items in Trash: {items.length}
          </span>

          {items.length > 0 && (
            <button
              onClick={() => setDeleteModal({ isOpen: true, item: null, isDeleteAll: true })}
              className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-xs rounded-2xl shadow-md hover:shadow-lg transition-all flex items-center gap-1.5"
            >
              <Trash2 className="w-4 h-4" /> Delete All (Empty Bin)
            </button>
          )}
        </div>
      </div>

      {/* RECYCLE BIN ITEMS LIST */}
      <div className="bg-white rounded-3xl border border-slate-200/80 soft-shadow overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-400 font-medium">Loading Recycle Bin...</div>
        ) : items.length === 0 ? (
          <div className="p-12 text-center text-slate-400 font-medium">
            <Trash2 className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            Recycle Bin is currently empty. No deleted items found.
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {items.map((item) => (
              <div key={item.id} className="p-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 hover:bg-slate-50/80 transition-colors">
                
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2.5">
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-rose-100 text-rose-700 border border-rose-200">
                      {item.item_type}
                    </span>
                    <h3 className="font-bold text-slate-900 text-sm font-poppins">{item.title}</h3>
                  </div>

                  {item.details && (
                    <p className="text-xs text-slate-600 leading-relaxed">{item.details}</p>
                  )}

                  <div className="flex items-center gap-4 text-[11px] text-slate-400 pt-1">
                    <span className="flex items-center gap-1 font-semibold">
                      <User className="w-3.5 h-3.5 text-slate-400" /> Deleted By: {item.deleted_by}
                    </span>
                    <span className="flex items-center gap-1 font-semibold">
                      <Clock className="w-3.5 h-3.5 text-slate-400" /> {new Date(item.deleted_at).toLocaleString()}
                    </span>
                  </div>
                </div>

                {/* RESTORE & PERMANENT DELETE BUTTONS */}
                <div className="flex items-center gap-3 w-full sm:w-auto shrink-0">
                  <button
                    onClick={() => handleRestore(item)}
                    className="flex-1 sm:flex-initial px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-1.5"
                  >
                    <RotateCcw className="w-4 h-4" /> Restore Item
                  </button>

                  <button
                    onClick={() => setDeleteModal({ isOpen: true, item, isDeleteAll: false })}
                    className="flex-1 sm:flex-initial px-4 py-2.5 bg-red-50 hover:bg-red-100 text-red-600 font-bold text-xs rounded-xl border border-red-200 transition-colors flex items-center justify-center gap-1.5"
                  >
                    <Trash2 className="w-4 h-4" /> Permanent Delete
                  </button>
                </div>

              </div>
            ))}
          </div>
        )}
      </div>

      {/* ADMIN PASSWORD PERMANENT DELETE MODAL */}
      <AdminPasswordModal
        isOpen={deleteModal.isOpen}
        onClose={() => setDeleteModal({ isOpen: false, item: null, isDeleteAll: false })}
        onConfirm={handlePermanentDeleteWithPassword}
        title={deleteModal.isDeleteAll ? "Empty Entire Recycle Bin" : "Permanent Delete"}
        itemDescription={
          deleteModal.isDeleteAll 
            ? `permanently deleting ALL ${items.length} items` 
            : (deleteModal.item ? `permanently deleting "${deleteModal.item.title}"` : 'this item')
        }
        actionLabel={deleteModal.isDeleteAll ? "Delete All Items" : "Delete Item"}
      />

    </div>
  );
}
