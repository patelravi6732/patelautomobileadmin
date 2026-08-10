import React, { useState, useEffect } from 'react';
import { Package, Plus, Search, AlertTriangle, Edit2, Trash2, RefreshCw, ChevronLeft, ChevronRight } from 'lucide-react';
import API from '../services/api';
import { fetchCloudInventory, pushCloudInventoryItem, deleteCloudInventoryItem, pushCloudRecycleBinItem, fetchCloudDeletedIds, moveToRecycleBin } from '../utils/cloudSync';
import AdminPasswordModal from '../components/AdminPasswordModal';

export default function InventoryPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');

  // Pagination State (20 items per page as requested)
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;
  
  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  
  // Password Protected Action Modals
  const [passwordModal, setPasswordModal] = useState({
    isOpen: false,
    actionType: null, // 'EDIT' or 'DELETE'
    item: null,
    pendingData: null
  });

  // Form State
  const [formData, setFormData] = useState({
    part_name: '',
    category: 'General',
    price: '',
    current_stock: '',
    min_stock_alert: ''
  });

  const categories = [
    'ALL', 'Engine Oil', 'Air Filter', 'Oil Filter', 'Spark Plug', 'Brake Shoe', 
    'Brake Pad', 'Chain Kit', 'Clutch Plate', 'Clutch Cable', 'Accelerator Cable', 
    'Bulbs', 'Battery', 'Tyres', 'General'
  ];

  const fetchInventory = async (isInitial = false) => {
    if (isInitial) setLoading(true);
    let backendItems = [];
    try {
      const res = await API.get('/inventory/', { timeout: 1500 });
      backendItems = res.data || [];
    } catch (err) {
      console.warn('Backend API offline for inventory, using fast local+cloud store:', err);
    }

    const localDeleted = JSON.parse(localStorage.getItem('deleted_ids') || '[]');
    const cloudDeleted = await fetchCloudDeletedIds().catch(() => []);
    const deletedIds = Array.from(new Set([...localDeleted, ...cloudDeleted]));

    const isItemDeleted = (item) => {
      if (!item) return true;
      const itId = String(item.id || '').toLowerCase().trim();
      const itName = String(item.part_name || item.name || '').toLowerCase().trim();
      const itNorm = itName.replace(/[^a-z0-9]/g, '');

      return deletedIds.some(d => {
        if (!d) return false;
        const dStr = String(d).toLowerCase().trim();
        const dNorm = dStr.replace(/[^a-z0-9]/g, '');
        return (itId && dStr && (itId === dStr || itId.replace(/[^a-z0-9]/g, '') === dNorm)) ||
               (itName && dStr && (itName === dStr || itName.includes(dStr) || dStr.includes(itName))) ||
               (itNorm && dNorm && (itNorm === dNorm || itNorm.includes(dNorm) || dNorm.includes(itNorm)));
      });
    };

    const cloudInv = await fetchCloudInventory().catch(() => []);
    const localInv = JSON.parse(localStorage.getItem('inventory_items') || localStorage.getItem('spare_parts') || '[]');

    const allMap = new Map();
    [...localInv, ...cloudInv, ...backendItems].forEach(item => {
      if (item && typeof item === 'object' && (item.id || item.part_name || item.name)) {
        if (!isItemDeleted(item)) {
          const rawId = String(item.id || `inv_${String(item.part_name || item.name).toLowerCase().replace(/[^a-z0-9]/g, '')}`);
          const rawName = String(item.part_name || item.name || '').trim();
          const parsedStock = parseInt(item.current_stock !== undefined ? item.current_stock : (item.stock_quantity !== undefined ? item.stock_quantity : (item.quantity !== undefined ? item.quantity : 0)), 10);
          const parsedMin = item.min_stock_alert !== undefined && item.min_stock_alert !== '' ? parseInt(item.min_stock_alert, 10) : 2;
          
          const newItemObj = {
            id: rawId,
            part_name: rawName || 'Spare Part',
            category: item.category || 'General',
            price: parseFloat(item.price || 0),
            current_stock: parsedStock,
            min_stock_alert: parsedMin,
            updated_at: item.updated_at || null
          };

          const existing = allMap.get(rawId);
          if (!existing) {
            allMap.set(rawId, newItemObj);
          } else {
            if (parsedStock < existing.current_stock) {
              allMap.set(rawId, { ...existing, ...newItemObj, current_stock: parsedStock });
            } else if (newItemObj.price !== existing.price || newItemObj.min_stock_alert !== existing.min_stock_alert) {
              allMap.set(rawId, { ...existing, ...newItemObj });
            }
          }
        }
      }
    });

    const finalInvList = Array.from(allMap.values());
    localStorage.setItem('inventory_items', JSON.stringify(finalInvList));
    localStorage.setItem('spare_parts', JSON.stringify(finalInvList));

    setItems(finalInvList);
    setLoading(false);
  };

  useEffect(() => {
    fetchInventory(true);
    const interval = setInterval(() => {
      fetchInventory(false);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  const openAddModal = () => {
    setEditingItem(null);
    setFormData({
      part_name: '',
      category: 'General',
      price: '',
      current_stock: '',
      min_stock_alert: ''
    });
    setShowAddModal(true);
  };

  const handleOpenEdit = (item) => {
    setEditingItem(item);
    setFormData({
      part_name: item.part_name || item.name || '',
      category: item.category || 'General',
      price: item.price,
      current_stock: item.current_stock,
      min_stock_alert: item.min_stock_alert
    });
    setShowAddModal(true);
  };

  // Triggered when submitting the Add/Edit form
  const handleFormSubmit = (e) => {
    e.preventDefault();
    if (editingItem) {
      setPasswordModal({
        isOpen: true,
        actionType: 'EDIT',
        item: editingItem,
        pendingData: formData
      });
    } else {
      saveNewPart(formData);
    }
  };

  const saveNewPart = async (data) => {
    const newPartObj = {
      id: `inv_${Date.now()}`,
      part_name: data.part_name,
      category: data.category || 'General',
      price: parseFloat(data.price || 0),
      current_stock: parseInt(data.current_stock || 0, 10),
      min_stock_alert: data.min_stock_alert !== '' ? parseInt(data.min_stock_alert, 10) : 2,
      created_at: new Date().toISOString()
    };

    // Save locally and push to cloud bin
    pushCloudInventoryItem(newPartObj).catch(console.warn);
    const existing = JSON.parse(localStorage.getItem('inventory_items') || localStorage.getItem('spare_parts') || '[]');
    const updatedLocal = [newPartObj, ...existing];
    localStorage.setItem('inventory_items', JSON.stringify(updatedLocal));
    localStorage.setItem('spare_parts', JSON.stringify(updatedLocal));

    setItems(prev => [newPartObj, ...prev]);
    setShowAddModal(false);

    try {
      await API.post('/inventory/', data, { timeout: 2000 });
    } catch (err) {
      console.warn('Backend API offline, added spare part locally and cloud store:', err);
    } finally {
      alert('New spare part added to inventory!');
    }
  };

  const handleConfirmPasswordAction = async (adminPassword) => {
    if (passwordModal.actionType === 'EDIT') {
      const targetItem = passwordModal.item;
      const updatedObj = {
        ...targetItem,
        part_name: passwordModal.pendingData.part_name,
        category: passwordModal.pendingData.category || 'General',
        price: parseFloat(passwordModal.pendingData.price || 0),
        current_stock: parseInt(passwordModal.pendingData.current_stock || 0, 10),
        min_stock_alert: passwordModal.pendingData.min_stock_alert !== '' ? parseInt(passwordModal.pendingData.min_stock_alert, 10) : 2
      };

      pushCloudInventoryItem(updatedObj).catch(console.warn);
      const existing = JSON.parse(localStorage.getItem('inventory_items') || JSON.stringify(DEFAULT_SPARE_PARTS));
      const updatedLocal = existing.map(i => (String(i.id) === String(targetItem.id) ? updatedObj : i));
      localStorage.setItem('inventory_items', JSON.stringify(updatedLocal));

      setItems(prev => prev.map(i => (String(i.id) === String(targetItem.id) ? updatedObj : i)));
      setShowAddModal(false);

      try {
        await API.put(`/inventory/${targetItem.id}/`, {
          ...passwordModal.pendingData,
          admin_password: adminPassword
        }, { timeout: 2000 });
      } catch (err) {
        console.warn('Backend API offline, updated spare part locally and cloud store:', err);
      } finally {
        alert('Spare part updated successfully!');
      }
    } else if (passwordModal.actionType === 'DELETE') {
      const targetItem = passwordModal.item;
      const trashObj = {
        id: `trash_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
        item_type: 'Inventory',
        title: targetItem.part_name || targetItem.name || 'Spare Part',
        deleted_by: 'Patel Owner (Admin)',
        deleted_at: new Date().toISOString(),
        details: `Category: ${targetItem.category || 'General'} • Price: ₹${targetItem.price || 0} • Stock: ${targetItem.current_stock || 0} Units`,
        payload: targetItem
      };

      // 1. Atomic Move to Recycle Bin & Purge from Active Inventory (0ms local & cloud)
      moveToRecycleBin(trashObj, targetItem).catch(console.warn);

      const targetNorm = String(targetItem.part_name || targetItem.name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      const targetId = String(targetItem.id || '');
      const isMatch = (i) => {
        if (!i) return false;
        const curId = String(i.id || '');
        const curNorm = String(i.part_name || i.name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
        return (targetId && curId && targetId === curId) || (targetNorm && curNorm && targetNorm === curNorm);
      };

      setItems(prev => prev.filter(i => !isMatch(i)));
      setPasswordModal({ isOpen: false, item: null, actionType: null, pendingData: null });
      try { window.dispatchEvent(new Event('storage')); } catch (e) {}

      try {
        await API.post(`/inventory/${targetItem.id}/delete_with_password/`, {
          admin_password: adminPassword
        }, { timeout: 2000 });
      } catch (err) {
        console.warn('Backend API notice:', err);
      } finally {
        alert(`🗑️ Spare part '${targetItem.part_name || targetItem.name}' moved to Recycle Bin!`);
      }
    }
  };

  const filteredItems = items.filter(item => {
    const pName = item.part_name || item.name || '';
    const matchesSearch = pName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          (item.category || '').toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCat = selectedCategory === 'ALL' || item.category === selectedCategory;
    return matchesSearch && matchesCat;
  });

  // Calculate Pagination
  const totalPages = Math.ceil(filteredItems.length / itemsPerPage) || 1;
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = filteredItems.slice(indexOfFirstItem, indexOfLastItem);

  const totalParts = items.length;
  const totalStockUnits = items.reduce((sum, i) => sum + (parseInt(i.current_stock) || 0), 0);
  const lowStockCount = items.filter(i => i && (parseInt(i.current_stock || 0, 10) <= (i.min_stock_alert !== undefined ? parseInt(i.min_stock_alert, 10) : 2))).length;

  return (
    <div className="space-y-6 w-full max-w-full overflow-x-hidden">
      
      {/* TOP HEADER WITH PROMINENT "+ ADD NEW PART" BUTTON */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-3xl border border-slate-200/80 soft-shadow w-full">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 font-poppins flex items-center gap-2.5">
            <Package className="w-7 h-7 text-blue-600" /> Spare Parts Inventory
          </h1>
          <p className="text-xs text-slate-500 mt-1">Manage garage parts catalog, prices, and stock inventory.</p>
        </div>

        <button
          type="button"
          onClick={openAddModal}
          className="inline-flex items-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-extrabold text-xs px-6 py-3.5 rounded-2xl shadow-lg shadow-blue-600/20 transition-all hover:scale-105 active:scale-95 shrink-0"
        >
          <Plus className="w-4.5 h-4.5 stroke-[3]" /> + Add New Part
        </button>
      </div>

      {/* INVENTORY METRICS SUMMARY CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 w-full">
        <div className="bg-white p-6 rounded-3xl border border-slate-200/80 soft-shadow flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold shrink-0">
            <Package className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Total Parts Listed</span>
            <span className="text-2xl font-extrabold text-slate-900 font-poppins">{totalParts}</span>
          </div>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-slate-200/80 soft-shadow flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center font-bold shrink-0">
            <RefreshCw className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Total Stock Units</span>
            <span className="text-2xl font-extrabold text-slate-900 font-poppins">{totalStockUnits.toLocaleString()}</span>
          </div>
        </div>

        <div className={`bg-white p-6 rounded-3xl border soft-shadow flex items-center gap-4 ${
          lowStockCount > 0 ? 'border-amber-200 bg-amber-50/30' : 'border-slate-200/80'
        }`}>
          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-bold shrink-0 ${
            lowStockCount > 0 ? 'bg-amber-100 text-amber-700' : 'bg-emerald-50 text-emerald-600'
          }`}>
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Low-Stock Alerts</span>
            <span className={`text-2xl font-extrabold font-poppins ${lowStockCount > 0 ? 'text-amber-700' : 'text-slate-900'}`}>
              {lowStockCount}
            </span>
          </div>
        </div>
      </div>

      {/* CONTROLS: SEARCH & CATEGORY FILTER TABS (FLEX WRAP FOR ZERO OVERFLOW) */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200/80 soft-shadow space-y-4 w-full">
        
        {/* Search Bar */}
        <div className="relative w-full">
          <Search className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search spare part name or category..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          />
        </div>

        {/* Category Pills (Wrapping nicely) */}
        <div className="flex flex-wrap items-center gap-2 pt-1">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => {
                setSelectedCategory(cat);
                setCurrentPage(1);
              }}
              className={`px-3 py-1.5 rounded-full text-[11px] font-bold transition-all ${
                selectedCategory === cat
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

      </div>

      {/* PARTS INVENTORY TABLE (RESPONSIVE FULL SCREEN WITH ZERO HORIZONTAL SCROLL) */}
      <div className="bg-white rounded-3xl border border-slate-200/80 soft-shadow overflow-hidden w-full">
        {loading ? (
          <div className="p-12 text-center text-slate-500 font-medium">Loading Spare Parts Inventory...</div>
        ) : filteredItems.length === 0 ? (
          <div className="p-12 text-center text-slate-400 font-medium">No spare parts found matching filters.</div>
        ) : (
          <div className="w-full overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead className="bg-slate-50 text-slate-600 font-bold uppercase tracking-wider text-[11px] border-b border-slate-200">
                <tr>
                  <th className="p-4 sm:p-5 w-5/12">Part Name</th>
                  <th className="p-4 sm:p-5 w-2/12">Category</th>
                  <th className="p-4 sm:p-5 w-2/12">Selling Price</th>
                  <th className="p-4 sm:p-5 w-1/12">Stock</th>
                  <th className="p-4 sm:p-5 w-1/12">Status</th>
                  <th className="p-4 sm:p-5 w-1/12 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {currentItems.map((item) => {
                  const partName = item.part_name || item.name || 'Spare Part';
                  const isLow = item.current_stock <= item.min_stock_alert;

                  return (
                    <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="p-4 sm:p-5 font-bold text-slate-900 font-poppins" title={partName}>
                        <span className="line-clamp-2">{partName}</span>
                      </td>

                      <td className="p-4 sm:p-5">
                        <span className="text-[10px] font-extrabold uppercase px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 inline-block">
                          {item.category || 'General'}
                        </span>
                      </td>

                      <td className="p-4 sm:p-5 font-bold text-slate-900 font-mono text-xs sm:text-sm whitespace-nowrap">
                        ₹{parseFloat(item.price).toFixed(2)}
                      </td>

                      <td className="p-4 sm:p-5 font-mono text-xs sm:text-sm font-bold text-slate-800 whitespace-nowrap">
                        {item.current_stock} Units
                      </td>

                      <td className="p-4 sm:p-5 whitespace-nowrap">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase inline-block ${
                          isLow ? 'bg-amber-100 text-amber-700 border border-amber-300' : 'bg-emerald-100 text-emerald-700'
                        }`}>
                          {isLow ? `● Low` : '● Available'}
                        </span>
                      </td>

                      {/* EDIT & DELETE SINGLE BUTTONS (ALWAYS VISIBLE ON SCREEN RIGHT SIDE) */}
                      <td className="p-4 sm:p-5 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(item)}
                            className="p-2 text-blue-600 hover:bg-blue-50 rounded-xl transition-colors font-bold"
                            title="Edit Spare Part"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setPasswordModal({ isOpen: true, actionType: 'DELETE', item })}
                            className="p-2 text-rose-600 hover:bg-rose-50 rounded-xl transition-colors font-bold"
                            title="Delete Spare Part"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* PAGINATION FOOTER */}
            <div className="p-4 sm:p-5 bg-slate-50 border-t border-slate-200/80 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs font-bold text-slate-600">
              <div>
                Showing {indexOfFirstItem + 1} to {Math.min(indexOfLastItem, filteredItems.length)} of {filteredItems.length} parts
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                  className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-slate-800 font-bold disabled:opacity-40 flex items-center gap-1"
                >
                  <ChevronLeft className="w-4 h-4" /> Previous
                </button>

                <span className="px-3 py-1.5 rounded-xl bg-slate-200 text-slate-900 font-extrabold">
                  Page {currentPage} of {totalPages}
                </span>

                <button
                  type="button"
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                  className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-slate-800 font-bold disabled:opacity-40 flex items-center gap-1"
                >
                  Next <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>

          </div>
        )}
      </div>

      {/* ADD / EDIT PART MODAL */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full space-y-6 shadow-2xl border border-slate-200">
            <h2 className="text-xl font-bold text-slate-900 font-poppins">
              {editingItem ? 'Edit Spare Part Details' : 'Add New Spare Part'}
            </h2>

            <form onSubmit={handleFormSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">Part Name *</label>
                <input
                  type="text"
                  required
                  value={formData.part_name}
                  onChange={(e) => setFormData({ ...formData, part_name: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">Category *</label>
                <select
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 text-xs font-bold bg-slate-50 focus:outline-none"
                >
                  {categories.filter(c => c !== 'ALL').map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">Selling Price (₹) *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={formData.price}
                    onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm font-mono font-bold focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">Current Stock *</label>
                  <input
                    type="number"
                    required
                    value={formData.current_stock}
                    onChange={(e) => setFormData({ ...formData, current_stock: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm font-mono font-bold focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">Low Stock Alert Threshold</label>
                <input
                  type="number"
                  required
                  value={formData.min_stock_alert}
                  onChange={(e) => setFormData({ ...formData, min_stock_alert: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm font-mono focus:outline-none"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-md transition-all"
                >
                  {editingItem ? 'Update Part' : 'Save Part'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PASSWORD MODAL */}
      <AdminPasswordModal
        isOpen={passwordModal.isOpen}
        onClose={() => setPasswordModal({ isOpen: false, actionType: null, item: null, pendingData: null })}
        onConfirm={handleConfirmPasswordAction}
        title={passwordModal.actionType === 'EDIT' ? 'Confirm Edit Part' : 'Delete Spare Part'}
        itemDescription={`Spare Part "${passwordModal.item?.part_name || passwordModal.item?.name}"`}
      />

    </div>
  );
}
