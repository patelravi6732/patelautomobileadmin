import React, { useState, useEffect } from 'react';
import { 
  Wrench, Plus, Trash2, CheckCircle2, XCircle, AlertCircle, CalendarClock,
  IndianRupee, Package, Bike, User, Phone, Check, Receipt, UserCheck, Users, Lock, Search, ChevronDown, Edit2, Tag
} from 'lucide-react';
import API from '../services/api';
import { fetchCloudJobs, updateCloudJobStatus, deleteCloudJob, fetchCloudInventory, pushCloudJob, pushCloudRecycleBinItem, pushCloudKhataEntry, pushCloudInvoice, updateCloudBookingStatus, fetchCloudDeletedIds, fetchCloudBookings, atomicFinishWorkshopJob, pushCloudInventoryItem, DEFAULT_SPARE_PARTS } from '../utils/cloudSync';
import { useAuth } from '../context/AuthContext';
import AdminPasswordModal from '../components/AdminPasswordModal';

export default function WorkshopPage() {
  const { garageInfo } = useAuth();
  const [jobs, setJobs] = useState(() => {
    try { return JSON.parse(localStorage.getItem('workshop_jobs') || '[]'); } catch (e) { return []; }
  });
  const [onlineBookings, setOnlineBookings] = useState(() => {
    try { return JSON.parse(localStorage.getItem('workshop_online_bookings') || '[]'); } catch (e) { return []; }
  });
  const [inventory, setInventory] = useState(() => {
    try {
      const local = JSON.parse(localStorage.getItem('inventory_items') || localStorage.getItem('spare_parts') || '[]');
      return (Array.isArray(local) && local.length > 0) ? local : DEFAULT_SPARE_PARTS;
    } catch {
      return DEFAULT_SPARE_PARTS;
    }
  });
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState('ACTIVE'); // ACTIVE or FINISHED
  const [mechanicOptions, setMechanicOptions] = useState(['Unassigned', 'Amitbhai Mechanic', 'Vishalbhai Mechanic', 'Manojbhai Mechanic']);
  
  // Modal states
  const [selectedJob, setSelectedJob] = useState(null);
  const [showPartModal, setShowPartModal] = useState(false);
  const [showFinishModal, setShowFinishModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);

  // Custom Part Mode in Add Part Modal
  const [customPartMode, setCustomPartMode] = useState(false);
  const [customPartName, setCustomPartName] = useState('');
  const [customPartPrice, setCustomPartPrice] = useState('');

  // Admin Password Delete Modals
  const [deleteJobModal, setDeleteJobModal] = useState({ isOpen: false, job: null });
  const [deletePartModal, setDeletePartModal] = useState({ isOpen: false, jobId: null, part: null });
  
  // Form states
  const [assignedMechanic, setAssignedMechanic] = useState('');
  const [secondaryMechanic, setSecondaryMechanic] = useState('');
  const [selectedPartId, setSelectedPartId] = useState('');
  const [partQty, setPartQty] = useState(1);
  const [partSearchQuery, setPartSearchQuery] = useState('');
  const [paidAmount, setPaidAmount] = useState(0);
  const [finishLabourCharge, setFinishLabourCharge] = useState(0);
  const [discountAmount, setDiscountAmount] = useState(0);
  const [editingLabourJobId, setEditingLabourJobId] = useState(null);
  const [labourInputs, setLabourInputs] = useState({});

  const formatMoney = (val) => {
    const num = parseFloat(val || 0);
    if (isNaN(num)) return '0';
    return Number.isInteger(num) ? num.toString() : num.toFixed(2);
  };

  const formatCompletionDateTime = (value) => {
    if (!value) return 'Completion time not recorded';
    const completionDate = new Date(value);
    if (Number.isNaN(completionDate.getTime())) return 'Completion time not recorded';

    const date = new Intl.DateTimeFormat('en-GB', {
      day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata'
    }).format(completionDate);
    const time = new Intl.DateTimeFormat('en-US', {
      hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata'
    }).format(completionDate);
    return `${date} • ${time}`;
  };

  useEffect(() => {
    if (garageInfo?.mechanics_list) {
      const parsed = garageInfo.mechanics_list.split(',').map(m => m.trim()).filter(Boolean);
      if (parsed.length > 0) {
        setMechanicOptions(parsed);
      }
    }
  }, [garageInfo]);

  const fetchData = async (isInitial = false) => {
    if (isInitial) setLoading(true);
    let backendJobs = [];
    let invData = [];
    let cloudJobs = [];
    let cloudInv = [];
    let deletedIds = [];

    try {
      const [jobsRes, invRes] = await Promise.all([
        API.get('/workshop/', { timeout: 1500 }).catch(() => ({ data: [] })),
        API.get('/inventory/', { timeout: 1500 }).catch(() => ({ data: [] }))
      ]);
      backendJobs = jobsRes.data || [];
      invData = invRes.data || [];
    } catch (err) {}

    let cloudBookings = [];
    try {
      [cloudJobs, cloudInv, deletedIds, cloudBookings] = await Promise.all([
        fetchCloudJobs().catch(() => []),
        fetchCloudInventory().catch(() => []),
        fetchCloudDeletedIds().catch(() => []),
        fetchCloudBookings().catch(() => [])
      ]);
    } catch (e) {}

    const localJobs = JSON.parse(localStorage.getItem('workshop_jobs') || '[]');
    const localBookings = JSON.parse(localStorage.getItem('local_bookings') || '[]');
    const cachedBookings = JSON.parse(localStorage.getItem('workshop_online_bookings') || '[]');
    
    // 1. Process Workshop Jobs (localJobs first so deleted parts or edited jobs never revert)
    const allMap = new Map();
    [...localJobs, ...cloudJobs, ...backendJobs].forEach(j => {
      if (j && typeof j === 'object' && j.id) {
        const uniqueKey = String(j.id);
        if (!deletedIds.includes(uniqueKey) && !deletedIds.includes(String(j.id))) {
          const sanitizedJob = {
            ...j,
            parts: Array.isArray(j.parts) ? j.parts : [],
            parts_total: parseFloat(j.parts_total || 0),
            labour_charge: parseFloat(j.labour_charge || 0),
            live_total: parseFloat(j.live_total || j.grand_total || (parseFloat(j.parts_total || 0) + parseFloat(j.labour_charge || 0))),
            status: (j.status === 'FINISHED' || j.status === 'COMPLETED') ? 'FINISHED' : (j.status || 'IN_PROGRESS')
          };
          if (!allMap.has(uniqueKey)) {
            allMap.set(uniqueKey, sanitizedJob);
          }
        }
      }
    });

    // 2. Process Persistent Bookings Memory (Prevents network flickering)
    const allBookingsMap = new Map();
    [...cloudBookings, ...localBookings, ...cachedBookings].forEach(b => {
      if (b && typeof b === 'object' && (b.id || b.vehicle_number)) {
        const key = String(b.id || `${b.vehicle_number}_${b.preferred_date}`);
        if (!deletedIds.includes(key) && !deletedIds.includes(String(b.id))) {
          if (!allBookingsMap.has(key)) {
            allBookingsMap.set(key, b);
          }
        }
      }
    });

    const persistentBookings = Array.from(allBookingsMap.values());
    localStorage.setItem('workshop_online_bookings', JSON.stringify(persistentBookings));
    setOnlineBookings(persistentBookings);

    persistentBookings.forEach(b => {
      if (b && typeof b === 'object' && (b.id || b.vehicle_number)) {
        const bookingJobId = `job_booking_${b.id || b.vehicle_number}`;
        const bookingKey = String(b.id || `${b.vehicle_number}_${b.preferred_date}`);
        const normVeh = String(b.vehicle_number || '').replace(/[^A-Za-z0-9]/g, '').toUpperCase();

        // 1. Skip if booking was converted, completed, finished, cancelled, or rejected
        if (['CONVERTED', 'COMPLETED', 'FINISHED', 'REJECTED', 'CANCELLED'].includes(String(b.status || '').toUpperCase())) {
          return;
        }

        // 2. Skip if deleted
        if (deletedIds.includes(bookingKey) || deletedIds.includes(String(b.id)) || deletedIds.includes(bookingJobId)) {
          return;
        }

        // 3. Skip if an active job for this exact vehicle already exists on workshop floor (No duplicates!)
        const alreadyHasActiveJob = Array.from(allMap.values()).some(j => {
          if (!j || j.status === 'FINISHED' || j.status === 'COMPLETED' || j.status === 'CANCELLED') return false;
          const jVeh = String(j.vehicle_number || '').replace(/[^A-Za-z0-9]/g, '').toUpperCase();
          return normVeh && jVeh && normVeh === jVeh;
        });

        if (alreadyHasActiveJob || allMap.has(bookingJobId)) {
          return;
        }

        allMap.set(bookingJobId, {
          id: bookingJobId,
          booking_id: b.id,
          customer_name: b.customer_name || 'Online Customer',
          mobile_number: b.mobile_number || b.phone || 'N/A',
          vehicle_number: b.vehicle_number || 'GJ-15',
          bike_model: b.bike_model || 'Two Wheeler',
          complaint: b.complaint ? `[Online Booking] ${b.complaint}` : `Online Service Booking (${b.preferred_date || 'Today'} ${b.preferred_time || ''})`,
          assigned_mechanic: 'Unassigned',
          parts: [],
          parts_total: 0,
          labour_charge: garageInfo?.default_labour_charge || 100,
          live_total: garageInfo?.default_labour_charge || 100,
          status: b.status === 'ACCEPTED' ? 'IN_PROGRESS' : 'PENDING_BOOKING',
          is_online_booking: true,
          created_at: b.created_at || new Date().toISOString()
        });
      }
    });

    const mergedJobs = Array.from(allMap.values()).sort(
      (a, b) => new Date(b.created_at || Date.now()) - new Date(a.created_at || Date.now())
    );
    setJobs(mergedJobs);

    const localDeleted = JSON.parse(localStorage.getItem('deleted_ids') || '[]');
    const allDeletedIds = Array.from(new Set([...localDeleted, ...deletedIds]));

    const isItemDeleted = (item) => {
      if (!item) return true;
      const itId = String(item.id || '').toLowerCase().trim();
      const itName = String(item.part_name || item.name || '').toLowerCase().trim();
      const itNorm = itName.replace(/[^a-z0-9]/g, '');

      return allDeletedIds.some(d => {
        if (!d) return false;
        const dStr = String(d).toLowerCase().trim();
        const dNorm = dStr.replace(/[^a-z0-9]/g, '');
        return (itId && dStr && (itId === dStr || itId.replace(/[^a-z0-9]/g, '') === dNorm)) ||
               (itName && dStr && (itName === dStr || itNorm === dNorm));
      });
    };

    const allInvMap = new Map();
    let localInv = JSON.parse(localStorage.getItem('inventory_items') || localStorage.getItem('spare_parts') || '[]');
    if (!Array.isArray(localInv) || localInv.length === 0) {
      localInv = DEFAULT_SPARE_PARTS;
    }
    const resolvedCloudInv = (Array.isArray(cloudInv) && cloudInv.length > 0) ? cloudInv : DEFAULT_SPARE_PARTS;

    [...localInv, ...resolvedCloudInv, ...invData].forEach(item => {
      if (item && typeof item === 'object' && (item.id || item.part_name || item.name)) {
        if (!isItemDeleted(item)) {
          const rawId = String(item.id || `inv_${String(item.part_name || item.name).toLowerCase().replace(/[^a-z0-9]/g, '')}`);
          const rawName = String(item.part_name || item.name || '').trim();
          const parsedStock = parseInt(item.current_stock !== undefined ? item.current_stock : (item.stock_quantity !== undefined ? item.stock_quantity : (item.quantity !== undefined ? item.quantity : 0)), 10);
          const parsedMin = item.min_stock_alert !== undefined && item.min_stock_alert !== '' ? parseInt(item.min_stock_alert, 10) : 2;
          
          const cleanItem = {
            id: rawId,
            part_name: rawName || 'Spare Part',
            category: item.category || 'General',
            price: parseFloat(item.price || 0),
            current_stock: parsedStock,
            min_stock_alert: parsedMin,
            updated_at: item.updated_at || null
          };

          const existing = allInvMap.get(rawId);
          if (!existing) {
            allInvMap.set(rawId, cleanItem);
          } else {
            if (parsedStock < existing.current_stock) {
              allInvMap.set(rawId, { ...existing, ...cleanItem, current_stock: parsedStock });
            } else if (cleanItem.price !== existing.price || cleanItem.min_stock_alert !== existing.min_stock_alert) {
              allInvMap.set(rawId, { ...existing, ...cleanItem });
            }
          }
        }
      }
    });

    let unifiedInv = Array.from(allInvMap.values());
    if (unifiedInv.length === 0) {
      unifiedInv = DEFAULT_SPARE_PARTS;
    }
    localStorage.setItem('inventory_items', JSON.stringify(unifiedInv));
    localStorage.setItem('spare_parts', JSON.stringify(unifiedInv));
    setInventory(unifiedInv);
    setLoading(false);
  };

  useEffect(() => {
    fetchData(true);
    const interval = setInterval(() => {
      fetchData(false);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  const openAssignModal = (job) => {
    setSelectedJob(job);
    const validPrimary = (job.assigned_mechanic && job.assigned_mechanic !== 'Unassigned') 
      ? job.assigned_mechanic 
      : (mechanicOptions.filter(m => m !== 'Unassigned')[0] || 'Patel Owner');
    setAssignedMechanic(validPrimary);
    setSecondaryMechanic(job.secondary_mechanic || '');
    setShowAssignModal(true);
  };

  const handleAssignMechanic = async (e) => {
    e.preventDefault();
    if (!selectedJob) return;
    if (!assignedMechanic || assignedMechanic === 'Unassigned') {
      alert('⚠️ Primary Mechanic assignment is COMPULSORY! Please select a valid mechanic.');
      return;
    }

    const updatedJob = {
      ...selectedJob,
      assigned_mechanic: assignedMechanic,
      secondary_mechanic: secondaryMechanic
    };

    setJobs(prev => prev.map(j => (String(j.id) === String(selectedJob.id) ? updatedJob : j)));
    
    const localJobs = JSON.parse(localStorage.getItem('workshop_jobs') || '[]');
    const updatedLocal = localJobs.map(j => (String(j.id) === String(selectedJob.id) ? updatedJob : j));
    if (!updatedLocal.some(j => String(j.id) === String(selectedJob.id))) {
      updatedLocal.push(updatedJob);
    }
    localStorage.setItem('workshop_jobs', JSON.stringify(updatedLocal));
    pushCloudJob(updatedJob).catch(console.warn);

    setShowAssignModal(false);

    try {
      await API.post(`/workshop/${selectedJob.id}/assign_mechanic/`, {
        assigned_mechanic: assignedMechanic,
        secondary_mechanic: secondaryMechanic
      }, { timeout: 2000 });
    } catch (err) {
      console.warn('Backend API offline, assigned mechanic locally & cloud store:', err);
    } finally {
      alert(`Mechanic '${assignedMechanic}' assigned successfully!`);
    }
  };

  const openAddPartModal = (job) => {
    setSelectedJob(job);
    setPartSearchQuery('');
    setCustomPartMode(false);
    setCustomPartName('');
    setCustomPartPrice('');
    const curInv = (inventory && inventory.length > 0) ? inventory : DEFAULT_SPARE_PARTS;
    if (!inventory || inventory.length === 0) setInventory(curInv);
    const firstItem = curInv[0];
    const firstKey = firstItem ? String(firstItem.id || firstItem.part_name || firstItem.name) : '';
    setSelectedPartId(firstKey);
    setPartQty(1);
    setShowPartModal(true);
  };

  const handleAddPart = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (!selectedJob) {
      alert('⚠️ Please select a bike first!');
      return;
    }

    let partName = '';
    let unitPrice = 0;
    let invId = null;
    let isCatalogItem = false;
    let partObj = null;

    if (customPartMode) {
      partName = customPartName.trim();
      unitPrice = parseFloat(customPartPrice) || 0;
      if (!partName) {
        alert('⚠️ Please enter a spare part name.');
        return;
      }
      if (unitPrice <= 0) {
        alert('⚠️ Please enter a valid part price (₹) greater than 0.');
        return;
      }
      invId = `inv_custom_${Date.now()}`;
    } else {
      const targetKey = String(selectedPartId || '').trim();
      const targetNorm = targetKey.toLowerCase().replace(/[^a-z0-9]/g, '');
      const curInv = (inventory && inventory.length > 0) ? inventory : DEFAULT_SPARE_PARTS;

      partObj = curInv.find(p => {
        if (!p) return false;
        const pKey = String(p.id || p.part_name || p.name || '').trim();
        const pNorm = String(p.part_name || p.name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
        return (targetKey && pKey === targetKey) || (targetNorm && pNorm && targetNorm === pNorm);
      }) || curInv[0];

      if (!partObj) {
        alert('⚠️ Please select a valid spare part from the list.');
        return;
      }

      partName = partObj.part_name || partObj.name || 'Spare Part';
      unitPrice = parseFloat(partObj.price || 0);
      invId = partObj.id || `inv_${targetNorm}`;
      isCatalogItem = true;
    }

    const qty = parseInt(partQty || 1, 10);
    const stagedTotal = unitPrice * qty;

    const newPartEntry = {
      id: Date.now(),
      inventory_id: invId,
      part_id: invId,
      part_name: partName,
      price: unitPrice,
      unit_price: unitPrice,
      quantity: qty,
      staged_total: stagedTotal,
      status: 'CONFIRMED',
      is_confirmed: true,
      is_deducted: true
    };

    // 1. Update Job parts
    const existingParts = Array.isArray(selectedJob.parts) ? selectedJob.parts : [];
    const updatedParts = [...existingParts, newPartEntry];
    const newPartsTotal = updatedParts.reduce((acc, p) => acc + parseFloat(p.staged_total || (parseFloat(p.price || p.unit_price || 0) * parseInt(p.quantity || 1, 10))), 0);
    const newLiveTotal = newPartsTotal + parseFloat(selectedJob.labour_charge || 0);

    const updatedJob = {
      ...selectedJob,
      parts: updatedParts,
      parts_total: newPartsTotal,
      live_total: newLiveTotal
    };

    setJobs(prev => prev.map(j => (String(j.id) === String(selectedJob.id) ? updatedJob : j)));
    
    // 2. Deduct Inventory stock IMMEDIATELY if catalog item
    let updatedTargetItem = null;
    if (isCatalogItem && partObj) {
      const localInv = JSON.parse(localStorage.getItem('inventory_items') || localStorage.getItem('spare_parts') || '[]');
      const baseInv = inventory && inventory.length > 0 ? inventory : (localInv.length > 0 ? localInv : DEFAULT_SPARE_PARTS);
      const partNormName = String(partName).toLowerCase().replace(/[^a-z0-9]/g, '');

      const updatedInv = baseInv.map(invItem => {
        if (!invItem) return invItem;
        const curNormName = String(invItem.part_name || invItem.name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
        const curId = String(invItem.id || '');
        const isMatch = (partNormName && curNormName && (partNormName === curNormName || partNormName.includes(curNormName) || curNormName.includes(partNormName))) || (partObj.id && curId && String(partObj.id) === curId);

        if (isMatch) {
          const currentQty = parseInt(invItem.current_stock !== undefined ? invItem.current_stock : 10, 10);
          const newQty = Math.max(0, currentQty - qty);
          const updatedObj = {
            ...invItem,
            current_stock: newQty,
            stock_quantity: newQty,
            quantity: newQty
          };
          updatedTargetItem = updatedObj;
          return updatedObj;
        }
        return invItem;
      });

      localStorage.setItem('inventory_items', JSON.stringify(updatedInv));
      localStorage.setItem('spare_parts', JSON.stringify(updatedInv));
      setInventory(updatedInv);
      try { window.dispatchEvent(new Event('storage')); } catch (e) {}
    }

    // 3. Save to local storage and push to cloud
    const localJobs = JSON.parse(localStorage.getItem('workshop_jobs') || '[]');
    const updatedLocal = localJobs.map(j => (String(j.id) === String(selectedJob.id) ? updatedJob : j));
    if (!updatedLocal.some(j => String(j.id) === String(selectedJob.id))) {
      updatedLocal.push(updatedJob);
    }
    localStorage.setItem('workshop_jobs', JSON.stringify(updatedLocal));
    pushCloudJob(updatedJob).catch(console.warn);

    if (updatedTargetItem) {
      pushCloudInventoryItem(updatedTargetItem).catch(console.warn);
    }

    setShowPartModal(false);

    try {
      if (partObj && partObj.id) {
        await API.post(`/workshop/${selectedJob.id}/add_staged_part/`, {
          inventory_id: partObj.id,
          quantity: qty
        }, { timeout: 2000 });
      }
    } catch (err) {
      console.warn('Backend API notice:', err);
    } finally {
      alert(`✅ Part '${partName}' Added!\n\n${qty}x @ ₹${unitPrice} = ₹${stagedTotal}\nCurrent Live Bill: ₹${newLiveTotal.toFixed(2)}`);
    }
  };

  const openDeletePartModal = (jobId, part) => {
    setDeletePartModal({ isOpen: true, jobId, part });
  };

  const handleDeletePartWithPassword = async (adminPassword) => {
    if (!deletePartModal.part || !deletePartModal.jobId) return;
    const { jobId, part } = deletePartModal;

    const targetJob = jobs.find(j => String(j.id) === String(jobId));
    if (!targetJob) return;

    const updatedParts = (targetJob.parts || []).filter(p => String(p.id) !== String(part.id));
    const newPartsTotal = updatedParts.reduce((acc, p) => acc + parseFloat(p.staged_total || (parseFloat(p.price || p.unit_price || 0) * parseInt(p.quantity || 1, 10))), 0);
    const newLiveTotal = newPartsTotal + parseFloat(targetJob.labour_charge || 0);

    const updatedJob = {
      ...targetJob,
      parts: updatedParts,
      parts_total: newPartsTotal,
      live_total: newLiveTotal
    };

    setJobs(prev => prev.map(j => (String(j.id) === String(jobId) ? updatedJob : j)));

    const localJobs = JSON.parse(localStorage.getItem('workshop_jobs') || '[]');
    const updatedLocal = localJobs.map(j => (String(j.id) === String(jobId) ? updatedJob : j));
    localStorage.setItem('workshop_jobs', JSON.stringify(updatedLocal));
    pushCloudJob(updatedJob).catch(console.warn);

    // If the removed part was already CONFIRMED & DEDUCTED, restore stock back to Inventory
    if (part.is_deducted || part.status === 'CONFIRMED') {
      try {
        const qtyToRestore = parseInt(part.quantity || 1, 10);
        const pId = String(part.inventory_id || part.part_id || part.id || '').replace(/[^a-z0-9]/g, '');
        const pName = String(part.part_name || part.name || '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase().trim();

        const localInv = JSON.parse(localStorage.getItem('inventory_items') || localStorage.getItem('spare_parts') || '[]');
        const cloudInv = await fetchCloudInventory().catch(() => []);
        const allInvMap = new Map();
        [...cloudInv, ...localInv].forEach(item => {
          if (item && (item.id || item.part_name || item.name)) {
            const rawName = String(item.part_name || item.name || '').trim();
            const key = rawName.toLowerCase().replace(/[^a-z0-9]/g, '');
            if (!allInvMap.has(key)) allInvMap.set(key, item);
          }
        });

        let invList = Array.from(allInvMap.values());
        invList = invList.map(invItem => {
          if (!invItem) return invItem;
          const invId = String(invItem.id || '').replace(/[^a-z0-9]/g, '');
          const invName = String(invItem.part_name || invItem.name || '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase().trim();
          const isMatch = (pId && invId && pId === invId) || (pName && invName && (pName === invName || pName.includes(invName) || invName.includes(pName)));

          if (isMatch) {
            const currentQty = parseInt(invItem.current_stock !== undefined ? invItem.current_stock : (invItem.stock_quantity !== undefined ? invItem.stock_quantity : (invItem.quantity !== undefined ? invItem.quantity : 0)), 10);
            const newQty = currentQty + qtyToRestore;
            const updatedItem = {
              ...invItem,
              current_stock: newQty,
              stock_quantity: newQty,
              quantity: newQty
            };
            pushCloudInventoryItem(updatedItem).catch(console.warn);
            return updatedItem;
          }
          return invItem;
        });

        localStorage.setItem('inventory_items', JSON.stringify(invList));
        localStorage.setItem('spare_parts', JSON.stringify(invList));
        setInventory(invList);
        try { window.dispatchEvent(new Event('storage')); } catch (e) {}
      } catch (err) {
        console.warn('Stock restoration notice:', err);
      }
    }

    setDeletePartModal({ isOpen: false, jobId: null, part: null });

    try {
      await API.post(`/workshop/${jobId}/remove_staged_part/`, { part_id: part.id }, { timeout: 2000 });
    } catch (err) {
      console.warn('Backend API offline, removed part locally & cloud store:', err);
    } finally {
      alert(`🗑️ Spare Part '${part.part_name || part.name}' removed from Job Card successfully.`);
    }
  };

  const handleConfirmParts = async (jobId) => {
    const targetJob = jobs.find(j => String(j.id) === String(jobId));
    if (!targetJob) return;

    const allParts = targetJob.parts || [];
    if (allParts.length === 0) {
      alert('ℹ️ No spare parts added to this bike yet!');
      return;
    }

    // Deduct stock strictly for parts that are STAGED or not yet deducted
    const partsToConfirm = allParts.filter(p => p && (!p.is_deducted || p.status !== 'CONFIRMED'));
    
    if (partsToConfirm.length === 0) {
      alert('ℹ️ All spare parts on this bike are already Confirmed & Deducted from Inventory!');
      return;
    }

    const updatedParts = allParts.map(p => ({ ...p, status: 'CONFIRMED', is_confirmed: true, is_deducted: true }));
    const updatedJob = { ...targetJob, parts: updatedParts };

    setJobs(prev => prev.map(j => (String(j.id) === String(jobId) ? updatedJob : j)));
    
    const localJobs = JSON.parse(localStorage.getItem('workshop_jobs') || '[]');
    const updatedLocalJobs = localJobs.map(j => (String(j.id) === String(jobId) ? updatedJob : j));
    localStorage.setItem('workshop_jobs', JSON.stringify(updatedLocalJobs));
    pushCloudJob(updatedJob).catch(console.warn);

    // Deduct stock from Inventory items in real-time
    try {
      const localInv = JSON.parse(localStorage.getItem('inventory_items') || localStorage.getItem('spare_parts') || '[]');
      const cloudInv = await fetchCloudInventory().catch(() => []);
      const allInvMap = new Map();
      [...cloudInv, ...localInv].forEach(item => {
        if (item && (item.id || item.part_name || item.name)) {
          const rawName = String(item.part_name || item.name || '').trim();
          const key = rawName.toLowerCase().replace(/[^a-z0-9]/g, '');
          if (!allInvMap.has(key)) allInvMap.set(key, item);
        }
      });

      let invList = Array.from(allInvMap.values());
      let invChanged = false;

      partsToConfirm.forEach(pToUse => {
        if (!pToUse) return;
        const pId = String(pToUse.inventory_id || pToUse.part_id || pToUse.id || '').replace(/[^a-z0-9]/g, '');
        const pName = String(pToUse.part_name || pToUse.name || '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase().trim();
        const usedQty = parseInt(pToUse.quantity || 1, 10);

        invList = invList.map(invItem => {
          if (!invItem) return invItem;
          const invId = String(invItem.id || '').replace(/[^a-z0-9]/g, '');
          const invName = String(invItem.part_name || invItem.name || '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase().trim();

          const isMatch = (pId && invId && pId === invId) || (pName && invName && (pName === invName || pName.includes(invName) || invName.includes(pName)));

          if (isMatch) {
            invChanged = true;
            const currentQty = parseInt(invItem.current_stock !== undefined ? invItem.current_stock : (invItem.stock_quantity !== undefined ? invItem.stock_quantity : (invItem.quantity !== undefined ? invItem.quantity : 0)), 10);
            const newQty = Math.max(0, currentQty - usedQty);
            const updatedItem = {
              ...invItem,
              current_stock: newQty,
              stock_quantity: newQty,
              quantity: newQty,
              updated_at: new Date().toISOString()
            };
            pushCloudInventoryItem(updatedItem).catch(console.warn);
            return updatedItem;
          }
          return invItem;
        });
      });

      if (invChanged) {
        localStorage.setItem('inventory_items', JSON.stringify(invList));
        localStorage.setItem('spare_parts', JSON.stringify(invList));
        setInventory(invList);
        try { window.dispatchEvent(new Event('storage')); } catch (e) {}
      }
    } catch (invErr) {
      console.warn('Error deducting stock on confirm parts:', invErr);
    }

    try {
      await API.post(`/workshop/${jobId}/confirm_parts/`, {}, { timeout: 2000 });
    } catch (err) {
      console.warn('Backend API offline, confirmed parts locally & cloud store:', err);
    } finally {
      alert(`✅ Spare Parts Confirmed!\n\n${partsToConfirm.length} item(s) confirmed and stock deducted from Inventory successfully.`);
    }
  };

  const handleSilentUpdateLabourCharge = (jobId, newLabour) => {
    const num = parseFloat(newLabour) || 0;
    setJobs(prev => prev.map(j => {
      if (String(j.id) === String(jobId)) {
        const partsTotal = parseFloat(j.parts_total || 0);
        const updated = {
          ...j,
          labour_charge: num,
          live_total: partsTotal + num
        };
        pushCloudJob(updated).catch(console.warn);
        const localJobs = JSON.parse(localStorage.getItem('workshop_jobs') || '[]');
        const updatedLocal = localJobs.map(lj => (String(lj.id) === String(jobId) ? updated : lj));
        localStorage.setItem('workshop_jobs', JSON.stringify(updatedLocal));
        return updated;
      }
      return j;
    }));
  };

  const handleUpdateLabourCharge = async (jobId, amount) => {
    try {
      await API.post(`/workshop/${jobId}/update_labour_charge/`, {
        labour_charge: amount
      });
      setEditingLabourJobId(null);
      fetchData();
    } catch (err) {
      console.warn('Backend API offline, updated labour charge locally');
    }
  };

  const openFinishModal = (job) => {
    if (!job.assigned_mechanic || job.assigned_mechanic === 'Unassigned') {
      alert('⚠️ Mechanic assignment is COMPULSORY! Please select a mechanic for this bike before finishing the bill.');
      openAssignModal(job);
      return;
    }
    const currentLabourInput = labourInputs[job.id];
    const initialLabour = currentLabourInput !== undefined 
      ? (parseFloat(currentLabourInput) || 0) 
      : parseFloat(job.labour_charge || 0);

    const updatedJobWithCurrentLabour = {
      ...job,
      labour_charge: initialLabour,
      live_total: parseFloat(job.parts_total || 0) + initialLabour
    };

    setSelectedJob(updatedJobWithCurrentLabour);
    setFinishLabourCharge(initialLabour);
    setDiscountAmount('');
    const subtotal = parseFloat(job.parts_total || 0) + initialLabour;
    setPaidAmount(parseFloat(job.paid_amount || 0));
    setShowFinishModal(true);
  };

  const handleFinishBill = async (e) => {
    e.preventDefault();
    if (!selectedJob) return;
    const numericDiscount = parseFloat(discountAmount.toString().replace(/[^0-9.]/g, '')) || 0;
    const finishLabourNum = parseFloat(finishLabourCharge) || 0;
    const partsTotalNum = parseFloat(selectedJob.parts_total || 0);
    const grandTotal = Math.max(0, (partsTotalNum + finishLabourNum) - numericDiscount);
    const paidAmountNum = parseFloat(paidAmount) || 0;
    const unpaidAmount = Math.max(0, grandTotal - paidAmountNum);
    const targetId = selectedJob.id;
    const completionTime = new Date().toISOString();

    const finishedJobData = {
      ...selectedJob,
      status: 'FINISHED',
      finished_at: completionTime,
      completed_at: completionTime,
      labour_charge: finishLabourNum,
      grand_total: grandTotal,
      live_total: grandTotal,
      paid_amount: paidAmountNum,
      pending_amount: unpaidAmount,
      discount_amount: numericDiscount
    };

    // 1. Create or Update Billing Invoice Object (Keyed per Job/Visit)
    const localInvoices = JSON.parse(localStorage.getItem('local_invoices') || '[]');
    const existingInvIndex = localInvoices.findIndex(inv => 
      inv && (
        String(inv.id) === `inv_${targetId}` || 
        String(inv.job_id) === String(targetId) || 
        inv.invoice_number === `INV-${String(targetId).slice(-4)}`
      )
    );

    const newInvoiceObj = {
      id: existingInvIndex >= 0 ? localInvoices[existingInvIndex].id : `inv_${targetId}`,
      job_id: targetId,
      invoice_number: `INV-${String(targetId).slice(-4)}`,
      customer_name: selectedJob.customer_name,
      mobile_number: selectedJob.mobile_number,
      vehicle_number: selectedJob.vehicle_number,
      bike_model: selectedJob.bike_model || 'Two Wheeler',
      labour_charge: finishLabourNum,
      parts_total: partsTotalNum,
      grand_total: grandTotal,
      total_amount: grandTotal,
      paid_amount: paidAmountNum,
      pending_amount: unpaidAmount,
      discount_amount: numericDiscount,
      payment_status: unpaidAmount > 0 ? (paidAmountNum > 0 ? 'PARTIAL' : 'UNPAID') : 'PAID',
      created_at: completionTime,
      parts: selectedJob.parts || []
    };

    // 2. Create or Update Khata Book Debit Entry (Keyed per Job/Visit)
    const localKhata = JSON.parse(localStorage.getItem('khata_entries') || '[]');
    const existingKhataIndex = localKhata.findIndex(k => 
      k && (
        String(k.id) === `khata_${targetId}` ||
        String(k.job_id) === String(targetId)
      )
    );

    let khataDebitEntry = null;
    if (unpaidAmount > 0) {
      khataDebitEntry = {
        id: existingKhataIndex >= 0 ? localKhata[existingKhataIndex].id : `khata_${targetId}`,
        job_id: targetId,
        customer_name: selectedJob.customer_name,
        mobile_number: selectedJob.mobile_number,
        vehicle_number: selectedJob.vehicle_number,
        bike_model: selectedJob.bike_model || 'Two Wheeler',
        type: 'DEBIT',
        amount: unpaidAmount,
        description: `Unpaid balance for Visit #${String(targetId).slice(-4)} (Total: ₹${grandTotal.toFixed(2)}, Paid: ₹${paidAmountNum.toFixed(2)})`,
        date: completionTime
      };
    }

    // 3. Auto-Deduct Inventory Spare Parts Stock if any unconfirmed
    const unconfirmedPartsUsed = (Array.isArray(selectedJob.parts) ? selectedJob.parts : []).filter(p => p && (!p.is_deducted || p.status !== 'CONFIRMED'));
    let updatedInvList = null;
    if (unconfirmedPartsUsed.length > 0) {
      try {
        const localInv = JSON.parse(localStorage.getItem('inventory_items') || localStorage.getItem('spare_parts') || '[]');
        updatedInvList = localInv.map(invItem => {
          const usedPart = unconfirmedPartsUsed.find(p => {
            if (!p) return false;
            const pId = String(p.inventory_id || p.part_id || p.id || '').replace(/[^a-z0-9]/g, '');
            const invId = String(invItem.id || '').replace(/[^a-z0-9]/g, '');
            if (pId && invId && pId === invId) return true;
            const pName = (p.part_name || p.name || '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
            const invName = (invItem.part_name || invItem.name || '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
            return pName && invName && (pName === invName || pName.includes(invName) || invName.includes(pName));
          });
          if (usedPart) {
            const currentQty = parseInt(invItem.current_stock !== undefined ? invItem.current_stock : 0, 10);
            const usedQty = parseInt(usedPart.quantity || 1, 10);
            const newQty = Math.max(0, currentQty - usedQty);
            return {
              ...invItem,
              current_stock: newQty,
              stock_quantity: newQty,
              quantity: newQty,
              updated_at: new Date().toISOString()
            };
          }
          return invItem;
        });
        localStorage.setItem('inventory_items', JSON.stringify(updatedInvList));
        localStorage.setItem('spare_parts', JSON.stringify(updatedInvList));
        setInventory(updatedInvList);
      } catch (invErr) {
        console.warn('Error auto-deducting inventory stock in finish bill:', invErr);
      }
    }

    // 4. ATOMIC SINGLE CLOUD COMMIT (No race conditions!)
    atomicFinishWorkshopJob({
      finishedJob: finishedJobData,
      invoice: newInvoiceObj,
      khataDebit: khataDebitEntry,
      updatedInventory: updatedInvList
    }).catch(console.warn);

    // 5. Update local React state immediately (0ms lag)
    setJobs(prev => prev.map(j => (String(j.id) === String(targetId) ? finishedJobData : j)));
    try {
      const newCustomerObj = {
        id: `cust_${selectedJob.vehicle_number || Date.now()}`,
        customer_name: selectedJob.customer_name || 'Valued Customer',
        mobile_number: selectedJob.mobile_number || 'N/A',
        phone: selectedJob.mobile_number || 'N/A',
        vehicle_number: selectedJob.vehicle_number || 'GJ-15',
        bike_model: selectedJob.bike_model || 'Two Wheeler',
        created_at: completionTime
      };
      const localCusts = JSON.parse(localStorage.getItem('local_customers') || '[]');
      const existsCust = localCusts.some(c => 
        c && (
          (c.vehicle_number && selectedJob.vehicle_number && c.vehicle_number === selectedJob.vehicle_number) ||
          (c.customer_name && selectedJob.customer_name && c.customer_name.toLowerCase() === selectedJob.customer_name.toLowerCase())
        )
      );
      if (!existsCust) {
        localStorage.setItem('local_customers', JSON.stringify([newCustomerObj, ...localCusts]));
      }
    } catch (custErr) {
      console.warn('Error updating local_customers on finish bill:', custErr);
    }

    setShowFinishModal(false);
    setSelectedJob(null);
    try { window.dispatchEvent(new Event('storage')); } catch (e) {}
    alert(`🎉 Service finished successfully! Invoice ${newInvoiceObj.invoice_number} generated and sent to Billing.`);
  };

  const handleCancelService = async (jobId) => {
    if (!window.confirm('Are you sure you want to cancel this service job? Staged inventory will remain untouched.')) return;

    // Update cloud store & local memory immediately
    updateCloudJobStatus(jobId, 'CANCELLED').catch(console.warn);
    const currentJobs = JSON.parse(localStorage.getItem('workshop_jobs') || '[]');
    const updatedLocal = currentJobs.map(j => (String(j.id) === String(jobId) ? { ...j, status: 'CANCELLED' } : j));
    localStorage.setItem('workshop_jobs', JSON.stringify(updatedLocal));

    setJobs(prev => prev.map(j => (String(j.id) === String(jobId) ? { ...j, status: 'CANCELLED' } : j)));

    try {
      await API.post(`/workshop/${jobId}/cancel_service/`, {}, { timeout: 2000 });
    } catch (err) {
      console.warn('Backend API offline, updated service status to CANCELLED locally & cloud');
    } finally {
      alert('Service job cancelled successfully!');
    }
  };

  const handleDeleteJobWithPassword = async (adminPassword) => {
    if (!deleteJobModal.job) return;
    const targetJob = deleteJobModal.job;
    const targetId = targetJob.id;

    // 1. Move to Recycle Bin (local & cloud)
    const trashObj = {
      id: `trash_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      item_type: 'Workshop Job',
      title: `Service Job: ${targetJob.vehicle_number} (${targetJob.customer_name})`,
      deleted_by: 'Patel Owner (Admin)',
      deleted_at: new Date().toISOString(),
      details: `Customer: ${targetJob.customer_name} • Phone: ${targetJob.mobile_number} • Model: ${targetJob.bike_model || 'Bike'} • Total: ₹${targetJob.live_total || 0}`,
      payload: targetJob
    };

    const existingTrash = JSON.parse(localStorage.getItem('recycle_bin_items') || '[]');
    localStorage.setItem('recycle_bin_items', JSON.stringify([trashObj, ...existingTrash]));
    pushCloudRecycleBinItem(trashObj).catch(console.warn);

    // 2. Delete from cloud store & local memory
    deleteCloudJob(targetId).catch(console.warn);
    const currentJobs = JSON.parse(localStorage.getItem('workshop_jobs') || '[]');
    const updatedLocal = currentJobs.filter(j => String(j.id) !== String(targetId));
    localStorage.setItem('workshop_jobs', JSON.stringify(updatedLocal));

    setJobs(prev => prev.filter(j => String(j.id) !== String(targetId)));
    setDeleteJobModal({ isOpen: false, job: null });

    try {
      await API.post(`/workshop/${targetId}/delete_with_password/`, {
        admin_password: adminPassword
      }, { timeout: 2000 });
    } catch (err) {
      console.warn('Backend API offline, moved service job to Recycle Bin locally & cloud');
    } finally {
      alert('Service job moved to Recycle Bin!');
    }
  };

  const activeJobs = jobs.filter(j => j && j.status !== 'FINISHED' && j.status !== 'COMPLETED' && j.status !== 'CANCELLED');
  const finishedJobs = jobs.filter(j => j && (j.status === 'FINISHED' || j.status === 'COMPLETED'));
  const cancelledJobs = jobs.filter(j => j && j.status === 'CANCELLED');
  const onlineBookingJobs = jobs.filter(j => j && j.status !== 'FINISHED' && j.status !== 'COMPLETED' && j.status !== 'CANCELLED' && (j.is_online_booking || j.booking_id || j.source === 'ONLINE_BOOKING' || String(j.complaint || '').toLowerCase().includes('booking')));

  const displayedJobs = tab === 'ONLINE_BOOKINGS' ? onlineBookingJobs : (tab === 'FINISHED' ? finishedJobs : (tab === 'CANCELLED' ? cancelledJobs : activeJobs));

  return (
    <div className="space-y-8">
      
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 font-poppins">Workshop Floor</h1>
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => setTab('ACTIVE')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              tab === 'ACTIVE'
                ? 'bg-slate-900 text-white shadow-md'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            Active Workshop Bikes ({activeJobs.length})
          </button>

          <button
            onClick={() => setTab('ONLINE_BOOKINGS')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              tab === 'ONLINE_BOOKINGS'
                ? 'bg-blue-600 text-white shadow-md'
                : 'bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100'
            }`}
          >
            🌐 Online Bookings ({onlineBookingJobs.length})
          </button>

          <button
            onClick={() => setTab('FINISHED')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              tab === 'FINISHED'
                ? 'bg-emerald-600 text-white shadow-md'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            Finished Jobs ({finishedJobs.length})
          </button>

          <button
            onClick={() => setTab('CANCELLED')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              tab === 'CANCELLED'
                ? 'bg-red-600 text-white shadow-md'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            Cancelled Jobs ({cancelledJobs.length})
          </button>
        </div>
      </div>

      {tab !== 'FINISHED' && (
        loading ? (
          <div className="p-8 text-center text-slate-500 font-medium">Loading Workshop Floor...</div>
      ) : displayedJobs.length === 0 ? (
        <div className="bg-white p-12 rounded-3xl text-center text-slate-400 border border-slate-200 font-medium">
          No {tab === 'ONLINE_BOOKINGS' ? 'online booking' : (tab === 'FINISHED' ? 'finished' : 'active')} bikes found on workshop floor.
        </div>
      ) : (
          /* BIKE CARDS GRID */
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {displayedJobs.map((job) => {
              const partsList = Array.isArray(job.parts) ? job.parts : [];
              const hasStagedParts = partsList.some(p => p && p.status === 'STAGED');
              const isOnline = Boolean(
                job.is_online_booking || 
                job.booking_id || 
                job.source === 'ONLINE_BOOKING' || 
                String(job.complaint || '').toLowerCase().includes('booking') ||
                onlineBookings.some(b => {
                  if (!b) return false;
                  const bVeh = String(b.vehicle_number || '').replace(/[^A-Za-z0-9]/g, '').toUpperCase();
                  const jVeh = String(job.vehicle_number || '').replace(/[^A-Za-z0-9]/g, '').toUpperCase();
                  return bVeh && jVeh && bVeh === jVeh;
                })
              );
              const rawLabour = labourInputs[job.id] !== undefined
                ? labourInputs[job.id]
                : (job.labour_charge && parseFloat(job.labour_charge) > 0 ? formatMoney(job.labour_charge) : '');
              const numericLabour = parseFloat(rawLabour) || 0;
              const liveTotal = job.parts_total + numericLabour;

              return (
                <div key={job.id} className="bg-white rounded-3xl border border-slate-200/80 soft-shadow p-6 flex flex-col justify-between space-y-6">
                  
                  {/* Header info */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-base font-extrabold px-3 py-1 bg-slate-900 text-amber-400 rounded-xl tracking-wider">
                          {job.vehicle_number}
                        </span>
                        {isOnline && (
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-blue-100 text-blue-800 border border-blue-200">
                            🌐 ONLINE BOOKING
                          </span>
                        )}
                      </div>
                      <button
                        onClick={() => openAssignModal(job)}
                        className="text-xs font-semibold text-purple-700 hover:text-purple-900 bg-purple-50 hover:bg-purple-100 px-3 py-1 rounded-full border border-purple-200 transition-colors flex items-center gap-1"
                        title="Click to Assign Mechanics"
                      >
                        <UserCheck className="w-3.5 h-3.5 text-purple-600" />
                        <span>Mechanic: <strong className="text-slate-900">{job.assigned_mechanic}</strong></span>
                        {job.secondary_mechanic && (
                          <span className="text-[10px] bg-purple-200 px-1.5 py-0.5 rounded-md font-bold text-purple-800 ml-1">
                            + {job.secondary_mechanic}
                          </span>
                        )}
                      </button>
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-lg font-bold text-slate-900 font-poppins">{job.customer_name}</h3>
                        <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                          <Phone className="w-3.5 h-3.5 text-emerald-600" /> {job.mobile_number} • {job.bike_model}
                        </p>
                      </div>
                    </div>

                    {/* LIVE BILL DISPLAY BOX */}
                    <div className="p-4 rounded-2xl bg-slate-900 text-white space-y-3 shadow-inner">
                      <div className="flex justify-between items-center text-xs">
                        <span className="font-bold text-slate-300 flex items-center gap-1.5">
                          <Wrench className="w-4 h-4 text-blue-400" /> Labour Charge:
                        </span>
                        <div className="flex items-center gap-1">
                          <span className="text-slate-400 font-bold text-xs">₹</span>
                          <input
                            type="text"
                            inputMode="decimal"
                            value={rawLabour}
                            onChange={(e) => {
                              const raw = e.target.value;
                              setLabourInputs(prev => ({ ...prev, [job.id]: raw }));
                              const num = parseFloat(raw.replace(/[^0-9.]/g, '')) || 0;
                              handleSilentUpdateLabourCharge(job.id, num);
                            }}
                            onBlur={(e) => {
                              const num = parseFloat(e.target.value.replace(/[^0-9.]/g, '')) || 0;
                              handleSilentUpdateLabourCharge(job.id, num);
                            }}
                            className="w-24 px-3 py-1.5 bg-slate-800 border border-slate-700 text-white text-xs font-extrabold rounded-xl focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20 text-right transition-all"
                          />
                        </div>
                      </div>

                      <div className="flex justify-between items-center text-xs text-slate-300">
                        <span>Parts Subtotal:</span>
                        <span className="font-bold text-white">₹{formatMoney(job.parts_total)}</span>
                      </div>

                      <div className="pt-2 border-t border-slate-800 flex justify-between items-center">
                        <span className="text-xs font-bold uppercase tracking-wider text-amber-400">Current Live Bill:</span>
                        <span className="text-xl font-extrabold text-amber-400 font-poppins">
                          ₹{formatMoney(liveTotal)}
                        </span>
                      </div>
                    </div>

                    {/* CURRENT PARTS LIST */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Current Parts ({partsList.length})</span>
                        {hasStagedParts && (
                          <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                            Parts Staged (Inventory Stock Intact)
                          </span>
                        )}
                      </div>

                      {partsList.length === 0 ? (
                        <p className="text-xs text-slate-400 py-2 italic">No spare parts added yet.</p>
                      ) : (
                        <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                          {partsList.map((p) => {
                            const cleanName = (p.part_name || p.name || 'Spare Part').split('#')[0].trim();
                            const unitVal = parseFloat(p.unit_price || p.price || (p.staged_total ? p.staged_total / (p.quantity || 1) : 0));
                            const qtyVal = parseInt(p.quantity || 1, 10);
                            const totalVal = parseFloat(p.staged_total || (unitVal * qtyVal));
                            const partStatus = p.status || (p.is_confirmed ? 'CONFIRMED' : 'STAGED');

                            return (
                              <div key={p.id || Math.random()} className="p-3 rounded-2xl bg-slate-50 border border-slate-200/60 flex items-center justify-between text-xs hover:border-slate-300 transition-colors">
                                <div className="flex items-center gap-2.5 min-w-0 pr-2">
                                  <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 font-extrabold text-xs">
                                    {qtyVal}×
                                  </div>
                                  <div className="truncate">
                                    <span className="font-bold text-slate-900 block truncate text-xs">{cleanName}</span>
                                    <span className="text-[11px] font-bold text-emerald-600">₹{formatMoney(totalVal)}</span>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                  <span className={`text-[10px] font-extrabold px-2.5 py-1 rounded-lg tracking-wider uppercase ${
                                    partStatus === 'CONFIRMED' ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' : 'bg-amber-100 text-amber-800 border border-amber-200'
                                  }`}>
                                    {partStatus}
                                  </span>
                                  <button
                                    onClick={() => openDeletePartModal(job.id, p)}
                                    className="text-slate-400 hover:text-rose-600 p-1.5 rounded-lg hover:bg-rose-50 transition-colors"
                                    title="Remove Part (Password Protected)"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                  </div>

                  {/* ACTION BUTTONS */}
                  <div className="pt-4 border-t border-slate-100 space-y-2">
                    {partsList.length > 0 && hasStagedParts && (
                      <button
                        onClick={() => handleConfirmParts(job.id)}
                        className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-1.5 cursor-pointer active:scale-98"
                      >
                        <Check className="w-4 h-4" /> Confirm Spare Parts (Deduct Inventory)
                      </button>
                    )}

                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => openAssignModal(job)}
                        className="inline-flex items-center justify-center gap-1.5 bg-purple-50 hover:bg-purple-100 text-purple-700 text-xs font-bold py-2.5 rounded-xl transition-colors border border-purple-200 cursor-pointer"
                      >
                        <UserCheck className="w-4 h-4" /> Mechanics
                      </button>

                      <button
                        onClick={() => openAddPartModal(job)}
                        className="inline-flex items-center justify-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold py-2.5 rounded-xl transition-all shadow-md shadow-blue-500/20 cursor-pointer"
                      >
                        <Plus className="w-4 h-4" /> Add Spare Part
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => openFinishModal(job)}
                        className="inline-flex items-center justify-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold py-2.5 rounded-xl shadow-md shadow-emerald-500/20 transition-colors"
                      >
                        <Receipt className="w-4 h-4" /> Finish Bill
                      </button>

                      <button
                        onClick={() => handleCancelService(job.id)}
                        className="inline-flex items-center justify-center gap-1.5 bg-red-50 hover:bg-red-100 text-red-600 text-xs font-bold py-2.5 rounded-xl transition-colors"
                      >
                        <XCircle className="w-4 h-4" /> Cancel Service
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )
      )}

      {tab === 'FINISHED' && (
        <div className="bg-white rounded-3xl border border-slate-200/80 p-6 space-y-6">
          <h2 className="text-lg font-bold text-slate-900 font-poppins flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-600" /> Finished Service Jobs
          </h2>
          {finishedJobs.length === 0 ? (
            <p className="text-xs text-slate-400 italic py-4 text-center">No finished service jobs found.</p>
          ) : (
            <div className="space-y-4">
              {finishedJobs.map((job) => (
                <div key={job.id} className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-sm font-extrabold px-2.5 py-0.5 bg-slate-900 text-amber-400 rounded-lg">
                        {job.vehicle_number}
                      </span>
                      <h3 className="font-bold text-slate-900 text-sm">{job.customer_name} ({job.bike_model})</h3>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700 border border-emerald-200">
                        FINISHED
                      </span>
                    </div>
                    <p className="text-xs text-slate-500">
                      Primary Mechanic: <strong>{job.assigned_mechanic}</strong>
                      {job.secondary_mechanic && <span> • Assistant: <strong>{job.secondary_mechanic}</strong></span>}
                      <span> • Total Bill: <strong>₹{parseFloat(job.live_total || job.grand_total || job.total_amount || 0).toFixed(2)}</strong></span>
                    </p>
                    <p className="text-xs text-slate-600 font-medium flex items-center gap-1.5 pt-0.5">
                      <CalendarClock className="w-3.5 h-3.5 text-emerald-600" />
                      Finished: <strong>{formatCompletionDateTime(job.finished_at || job.completed_at || job.created_at)}</strong>
                    </p>
                  </div>

                  <button
                    onClick={() => setDeleteJobModal({ isOpen: true, job })}
                    className="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 font-bold text-xs rounded-xl border border-red-200 flex items-center gap-1.5 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Delete Job (Password Protected)
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'CANCELLED' && (
        <div className="bg-white rounded-3xl border border-slate-200/80 p-6 space-y-6">
          <h2 className="text-lg font-bold text-slate-900 font-poppins flex items-center gap-2">
            <XCircle className="w-5 h-5 text-red-600" /> Cancelled Service Jobs
          </h2>
          {cancelledJobs.length === 0 ? (
            <p className="text-xs text-slate-400 italic py-4 text-center">No cancelled service jobs found.</p>
          ) : (
            <div className="space-y-4">
              {cancelledJobs.map((job) => (
                <div key={job.id} className="p-4 rounded-2xl bg-red-50/40 border border-red-200/80 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-sm font-extrabold px-2.5 py-0.5 bg-slate-900 text-amber-400 rounded-lg">
                        {job.vehicle_number}
                      </span>
                      <h3 className="font-bold text-slate-900 text-sm">{job.customer_name} ({job.bike_model})</h3>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-700 border border-red-200">
                        CANCELLED / CLOSED
                      </span>
                    </div>
                    <p className="text-xs text-slate-500">
                      Primary Mechanic: <strong>{job.assigned_mechanic}</strong>
                      {job.secondary_mechanic && <span> • Assistant: <strong>{job.secondary_mechanic}</strong></span>}
                    </p>
                    <p className="text-xs text-slate-600 font-medium flex items-center gap-1.5 pt-0.5">
                      <CalendarClock className="w-3.5 h-3.5 text-red-600" />
                      Cancelled Date: <strong>{formatCompletionDateTime(job.finished_at || job.completed_at || job.created_at)}</strong>
                    </p>
                  </div>

                  <button
                    onClick={() => setDeleteJobModal({ isOpen: true, job })}
                    className="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 font-bold text-xs rounded-xl border border-red-200 flex items-center gap-1.5 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Delete Job (Password Protected)
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ASSIGN MECHANIC MODAL (MULTI MECHANIC SUPPORT) */}
      {showAssignModal && selectedJob && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full space-y-6 shadow-2xl">
            <h2 className="text-xl font-bold text-slate-900 font-poppins">Assign Mechanics To Bike</h2>
            <div className="p-3 bg-slate-50 rounded-xl text-xs text-slate-700">
              Vehicle: <strong>{selectedJob.vehicle_number}</strong> ({selectedJob.bike_model})
            </div>

            <form onSubmit={handleAssignMechanic} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  Primary Mechanic (Required) *
                </label>
                <select
                  value={assignedMechanic}
                  onChange={(e) => setAssignedMechanic(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-purple-500/20 text-sm font-medium"
                >
                  {mechanicOptions.map((mech) => (
                    <option key={mech} value={mech}>{mech}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  Secondary Mechanic (Optional Assistant)
                </label>
                <select
                  value={secondaryMechanic}
                  onChange={(e) => setSecondaryMechanic(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-purple-500/20 text-sm font-medium"
                >
                  <option value="">-- None (Single Mechanic) --</option>
                  {mechanicOptions.map((mech) => (
                    <option key={mech} value={mech}>{mech}</option>
                  ))}
                </select>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAssignModal(false)}
                  className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3 bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs rounded-xl shadow-md"
                >
                  Save Mechanics Assignment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ADD SPARE PART MODAL */}
      {showPartModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 sm:p-7 max-w-lg w-full space-y-4 shadow-2xl overflow-hidden flex flex-col max-h-[88vh]">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <div>
                <h2 className="text-lg font-bold text-slate-900 font-poppins flex items-center gap-2">
                  <Package className="w-5 h-5 text-blue-600" /> Add Spare Part
                </h2>
                <p className="text-xs text-slate-500">
                  {selectedJob?.vehicle_number} • {selectedJob?.customer_name}
                </p>
              </div>
              <button
                onClick={() => setShowPartModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-full hover:bg-slate-100"
              >
                ✕
              </button>
            </div>

            {/* TAB SELECTOR: FROM CATALOG OR CUSTOM PART */}
            <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-2xl">
              <button
                type="button"
                onClick={() => setCustomPartMode(false)}
                className={`py-2 text-xs font-bold rounded-xl transition-all ${
                  !customPartMode
                    ? 'bg-white text-blue-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                📋 From Catalog ({inventory.length})
              </button>
              <button
                type="button"
                onClick={() => setCustomPartMode(true)}
                className={`py-2 text-xs font-bold rounded-xl transition-all ${
                  customPartMode
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                ✏️ Custom Part / Service
              </button>
            </div>

            <form onSubmit={handleAddPart} className="space-y-4 flex-1 flex flex-col min-h-0">
              {customPartMode ? (
                /* CUSTOM PART ENTRY INPUTS */
                <div className="space-y-4 py-2">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                      Spare Part / Service Name *
                    </label>
                    <input
                      type="text"
                      required
                      autoFocus
                      placeholder="e.g. Fork Oil Seal Pair, Carburetor Clean..."
                      value={customPartName}
                      onChange={(e) => setCustomPartName(e.target.value)}
                      className="w-full px-4 py-3 rounded-2xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-xs font-bold text-slate-900 bg-slate-50"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                      Unit Price (₹) *
                    </label>
                    <input
                      type="number"
                      required
                      min="1"
                      step="10"
                      placeholder="e.g. 250"
                      value={customPartPrice}
                      onChange={(e) => setCustomPartPrice(e.target.value)}
                      className="w-full px-4 py-3 rounded-2xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-sm font-extrabold text-slate-900 bg-slate-50"
                    />
                  </div>
                </div>
              ) : (
                /* CATALOG SELECTION LIST */
                <>
                  {/* SEARCH BAR */}
                  <div className="relative shrink-0">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input 
                      type="text"
                      autoFocus
                      placeholder="Search spare part by name, brand, or model..."
                      value={partSearchQuery}
                      onChange={(e) => setPartSearchQuery(e.target.value)}
                      className="w-full pl-10 pr-4 py-3 rounded-2xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-xs bg-slate-50 font-medium text-slate-900 placeholder:text-slate-400"
                    />
                  </div>

                  {/* INVENTORY LIST BOX */}
                  <div className="flex-1 overflow-y-auto space-y-2 pr-1 border border-slate-100 rounded-2xl p-2 bg-slate-50/50 max-h-56 min-h-36">
                    {(() => {
                      const curInv = (inventory && inventory.length > 0) ? inventory : DEFAULT_SPARE_PARTS;
                      const filtered = curInv.filter(item => {
                        if (!item) return false;
                        const name = (item.part_name || item.name || '').toLowerCase();
                        const query = (partSearchQuery || '').toLowerCase();
                        return name.includes(query);
                      });

                      if (filtered.length === 0) {
                        return (
                          <div className="p-6 text-center text-xs text-slate-400 font-medium">
                            No parts matching "{partSearchQuery}". You can click <strong>"✏️ Custom Part"</strong> above to add it directly!
                          </div>
                        );
                      }

                      return filtered.map((item) => {
                        const itemKey = String(item.id || item.part_name || item.name || '');
                        const itemNorm = String(item.part_name || item.name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
                        const selectedNorm = String(selectedPartId || '').toLowerCase().replace(/[^a-z0-9]/g, '');
                        const isSelected = String(selectedPartId) === itemKey || (selectedNorm && itemNorm && selectedNorm === itemNorm);
                        const rawName = item.part_name || item.name || 'Spare Part';
                        const cleanItemName = rawName.split('#')[0].trim();
                        return (
                          <div
                            key={itemKey || Math.random()}
                            onClick={() => setSelectedPartId(itemKey)}
                            className={`p-3 rounded-xl border cursor-pointer transition-all flex items-center justify-between text-xs ${
                              isSelected 
                                ? 'bg-blue-50/90 border-blue-500 shadow-xs text-blue-900 font-bold' 
                                : 'bg-white border-slate-200/80 hover:border-slate-300 text-slate-700'
                            }`}
                          >
                            <div className="space-y-0.5 pr-2 min-w-0">
                              <div className="font-bold text-slate-900 truncate text-xs">{cleanItemName}</div>
                              <div className="text-[11px] text-slate-500 flex items-center gap-2">
                                <span>Stock: <strong className="text-slate-700">{item.current_stock !== undefined ? item.current_stock : 10}</strong></span>
                                <span>•</span>
                                <span className="text-emerald-600 font-bold">₹{formatMoney(item.price)}</span>
                              </div>
                            </div>
                            <div className="shrink-0 flex items-center gap-2">
                              <span className="font-extrabold text-sm text-slate-900">₹{formatMoney(item.price)}</span>
                              {isSelected && (
                                <span className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px] font-bold shadow-xs">
                                  ✓
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      });
                    })()}
                  </div>
                </>
              )}

              {/* QUANTITY STEPPER */}
              <div className="flex items-center justify-between shrink-0 bg-slate-50 p-3 rounded-2xl border border-slate-100">
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">Quantity</span>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setPartQty(Math.max(1, partQty - 1))}
                    className="w-8 h-8 rounded-xl bg-white border border-slate-200 hover:bg-slate-100 font-bold text-slate-700 flex items-center justify-center text-sm shadow-xs active:scale-95 transition-transform"
                  >
                    -
                  </button>
                  <span className="text-sm font-extrabold text-slate-900 w-6 text-center">{partQty}</span>
                  <button
                    type="button"
                    onClick={() => setPartQty(partQty + 1)}
                    className="w-8 h-8 rounded-xl bg-white border border-slate-200 hover:bg-slate-100 font-bold text-slate-700 flex items-center justify-center text-sm shadow-xs active:scale-95 transition-transform"
                  >
                    +
                  </button>
                </div>
              </div>

              {/* ACTION BUTTONS */}
              <div className="flex gap-3 pt-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setShowPartModal(false)}
                  className="flex-1 py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded-xl shadow-lg shadow-emerald-500/25 transition-all flex items-center justify-center gap-1.5 cursor-pointer active:scale-98"
                >
                  <span>✔</span>
                  <span>Confirm & Add Part</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* FINISH BILL MODAL */}
      {showFinishModal && selectedJob && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full space-y-5 shadow-2xl">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <div>
                <h2 className="text-lg font-bold text-slate-900 font-poppins">Finish Service & Issue Invoice</h2>
                <p className="text-xs text-slate-500">{selectedJob.vehicle_number} • {selectedJob.customer_name}</p>
              </div>
              <button
                onClick={() => setShowFinishModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-full hover:bg-slate-100"
              >
                ✕
              </button>
            </div>

            {(() => {
              const numericDisc = parseFloat(discountAmount.toString().replace(/[^0-9.]/g, '')) || 0;
              const grandTotal = Math.max(0, (selectedJob.parts_total + parseFloat(selectedJob.labour_charge || 0)) - numericDisc);

              return (
                <form onSubmit={handleFinishBill} className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Discount (₹)</label>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={discountAmount}
                      onChange={(e) => {
                        const raw = e.target.value;
                        setDiscountAmount(raw);
                        const disc = parseFloat(raw.replace(/[^0-9.]/g, '')) || 0;
                        const grand = Math.max(0, (selectedJob.parts_total + parseFloat(selectedJob.labour_charge || 0)) - disc);
                        setPaidAmount(grand);
                      }}
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm font-bold text-amber-600 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                    />
                  </div>

                  {/* SUMMARY BOX */}
                  <div className="p-4 bg-slate-900 rounded-2xl text-white space-y-2 text-xs">
                    <div className="flex justify-between text-slate-300">
                      <span>Parts Subtotal:</span>
                      <span className="font-semibold text-white">₹{formatMoney(selectedJob.parts_total)}</span>
                    </div>
                    <div className="flex justify-between text-slate-300">
                      <span>Labour Charge:</span>
                      <span className="font-semibold text-white">₹{formatMoney(selectedJob.labour_charge)}</span>
                    </div>
                    {numericDisc > 0 && (
                      <div className="flex justify-between text-amber-400 font-semibold">
                        <span>Discount:</span>
                        <span>- ₹{formatMoney(numericDisc)}</span>
                      </div>
                    )}
                    <div className="pt-2 border-t border-slate-800 flex justify-between items-center text-sm font-extrabold text-amber-400">
                      <span>Final Bill Amount:</span>
                      <span className="text-base">
                        ₹{formatMoney(grandTotal)}
                      </span>
                    </div>
                  </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Amount Paid Now (₹)</label>
                <input
                  type="number"
                  step="10"
                  min="0"
                  value={paidAmount}
                  onChange={(e) => setPaidAmount(parseFloat(e.target.value) || 0)}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 text-base font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                />
              </div>

              {Math.max(0, (selectedJob.parts_total + parseFloat(selectedJob.labour_charge || 0)) - discountAmount) - paidAmount > 0 && (
                <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-800 font-medium">
                  Remaining ₹{(Math.max(0, (selectedJob.parts_total + parseFloat(selectedJob.labour_charge || 0)) - discountAmount) - paidAmount).toFixed(2)} will be recorded in Customer's Khata Book!
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowFinishModal(false)}
                  className="flex-1 py-3 bg-slate-100 text-slate-700 font-bold text-xs rounded-xl hover:bg-slate-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-md"
                >
                  Generate Invoice & Close
                </button>
              </div>
            </form>
              );
            })()}
          </div>
        </div>
      )}

      {/* ADMIN PASSWORD DELETE JOB MODAL */}
      <AdminPasswordModal
        isOpen={deleteJobModal.isOpen}
        onClose={() => setDeleteJobModal({ isOpen: false, job: null })}
        onConfirm={handleDeleteJobWithPassword}
        title="Delete Finished Service Job"
        itemDescription={deleteJobModal.job ? `Service Job #${deleteJobModal.job.id} (${deleteJobModal.job.vehicle_number})` : 'job'}
      />

      {/* ADMIN PASSWORD DELETE SPARE PART MODAL */}
      <AdminPasswordModal
        isOpen={deletePartModal.isOpen}
        onClose={() => setDeletePartModal({ isOpen: false, jobId: null, part: null })}
        onConfirm={handleDeletePartWithPassword}
        title="Remove Spare Part from Bike Card"
        itemDescription={deletePartModal.part ? `Spare Part '${deletePartModal.part.part_name || deletePartModal.part.name}' (Qty: ${deletePartModal.part.quantity || 1})` : 'part'}
      />

    </div>
  );
}
