import React, { useState, useEffect } from 'react';
import { 
  Wrench, Plus, Trash2, CheckCircle2, XCircle, AlertCircle, CalendarClock, RotateCcw,
  IndianRupee, Package, Bike, User, Phone, Check, Receipt, UserCheck, Users, Lock, Search, ChevronDown, Edit2, Tag
} from 'lucide-react';
import API from '../services/api';
import { fetchCloudJobs, updateCloudJobStatus, deleteCloudJob, fetchCloudInventory, pushCloudJob, pushCloudRecycleBinItem, pushCloudKhataEntry, pushCloudInvoice, updateCloudBookingStatus, fetchCloudDeletedIds, fetchCloudBookings, atomicFinishWorkshopJob, pushCloudInventoryItem, deleteJobToRecycleBin, pushAuditLog } from '../utils/cloudSync';
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
  const [inventory, setInventory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState('ACTIVE'); // ACTIVE or FINISHED
  const [mechanicOptions, setMechanicOptions] = useState(['Unassigned', 'Amitbhai Mechanic', 'Vishalbhai Mechanic', 'Manojbhai Mechanic']);
  
  // Modal states
  const [selectedJob, setSelectedJob] = useState(null);
  const [showPartModal, setShowPartModal] = useState(false);
  const [showFinishModal, setShowFinishModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);

  // Admin Password Delete Modals
  const [deleteJobModal, setDeleteJobModal] = useState({ isOpen: false, job: null });
  const [undoJobModal, setUndoJobModal] = useState({ isOpen: false, job: null });
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
    if (isInitial && (!jobs || jobs.length === 0)) setLoading(true);
    let backendJobs = [];
    let invData = [];
    let cloudJobs = [];
    let cloudInv = [];
    let deletedIds = [];

    try {
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
      
      const isJobDeleted = (jobId) => {
        if (!jobId) return false;
        const strId = String(jobId).trim();
        const rawId = strId.replace(/^job_/, '').replace(/^inv_/, '');
        return deletedIds.some(d => {
          if (!d) return false;
          const dStr = String(d).trim();
          const dRaw = dStr.replace(/^job_/, '').replace(/^inv_/, '');
          return dStr === strId || dRaw === rawId || dStr === rawId || dRaw === strId;
        });
      };

      // 1. Process Workshop Jobs (Smart Merge localJobs and cloudJobs by ID & Vehicle Number)
      const allMap = new Map();
      const jobSources = [...localJobs, ...(cloudJobs || []), ...(backendJobs || [])];
      jobSources.forEach(j => {
        if (j && typeof j === 'object' && (j.id || j.vehicle_number)) {
          const strId = String(j.id || '');
          const rawId = strId.replace(/^job_/, '').replace(/^inv_/, '');
          const vehNorm = String(j.vehicle_number || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');

          let existingKey = null;
          for (const [k, ex] of allMap.entries()) {
            const exId = String(ex.id || '');
            const exRaw = exId.replace(/^job_/, '').replace(/^inv_/, '');
            const exVeh = String(ex.vehicle_number || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
            if ((rawId && exRaw && rawId === exRaw) || (strId && exId && strId === exId) || (vehNorm && exVeh && vehNorm === exVeh)) {
              existingKey = k;
              break;
            }
          }

          if (existingKey && isJobDeleted(existingKey)) return;
          if (isJobDeleted(strId) || isJobDeleted(j.vehicle_number)) return;

          const sanitizedJob = {
            ...j,
            parts: Array.isArray(j.parts) ? j.parts : [],
            parts_total: parseFloat(j.parts_total || 0),
            labour_charge: parseFloat(j.labour_charge || 0),
            live_total: parseFloat(j.live_total || j.grand_total || (parseFloat(j.parts_total || 0) + parseFloat(j.labour_charge || 0))),
            status: (j.status === 'FINISHED' || j.status === 'COMPLETED') ? 'FINISHED' : (j.status || 'IN_PROGRESS')
          };

          if (!existingKey) {
            const newKey = strId || `job_veh_${vehNorm}`;
            allMap.set(newKey, sanitizedJob);
          } else {
            const existing = allMap.get(existingKey);
            const existingParts = Array.isArray(existing.parts) ? existing.parts : [];
            const currentParts = Array.isArray(sanitizedJob.parts) ? sanitizedJob.parts : [];

            // Smart Union Merging of Parts by Part ID or Normalized Name
            const mergedPartsMap = new Map();
            [...existingParts, ...currentParts].forEach(p => {
              if (p && (p.id || p.part_name || p.name)) {
                const rawName = String(p.part_name || p.name || '').trim();
                const pKey = rawName ? rawName.toLowerCase().replace(/[^a-z0-9]/g, '') : String(p.inventory_id || p.part_id || p.id || '').toLowerCase().replace(/[^a-z0-9]/g, '');
                if (pKey) {
                  if (!mergedPartsMap.has(pKey)) {
                    mergedPartsMap.set(pKey, p);
                  } else {
                    const exP = mergedPartsMap.get(pKey);
                    const exQty = parseInt(exP.quantity || 1, 10);
                    const curQty = parseInt(p.quantity || 1, 10);
                    const finalQty = Math.max(exQty, curQty);
                    const unitPrice = parseFloat(p.price || p.unit_price || exP.price || exP.unit_price || 0);
                    mergedPartsMap.set(pKey, {
                      ...exP,
                      ...p,
                      quantity: finalQty,
                      staged_total: finalQty * unitPrice,
                      status: (p.status === 'CONFIRMED' || exP.status === 'CONFIRMED') ? 'CONFIRMED' : (p.status || exP.status || 'STAGED'),
                      is_confirmed: Boolean(p.is_confirmed || exP.is_confirmed),
                      is_deducted: Boolean(p.is_deducted || exP.is_deducted)
                    });
                  }
                }
              }
            });

            const finalParts = Array.from(mergedPartsMap.values());
            const finalPartsTotal = finalParts.reduce((acc, p) => acc + parseFloat(p.staged_total || (parseFloat(p.price || p.unit_price || 0) * parseInt(p.quantity || 1, 10))), 0);
            const finalLabour = parseFloat(sanitizedJob.labour_charge !== undefined ? sanitizedJob.labour_charge : (existing.labour_charge || 0));

            allMap.set(existingKey, {
              ...existing,
              ...sanitizedJob,
              parts: finalParts,
              parts_total: finalPartsTotal,
              labour_charge: finalLabour,
              live_total: finalPartsTotal + finalLabour
            });
          }
        }
      });

      // 2. Process Persistent Bookings Memory (Cloud Bookings is authoritative)
      const allBookingsMap = new Map();
      const bookingSources = (cloudBookings && Array.isArray(cloudBookings)) ? cloudBookings : localBookings;
      bookingSources.forEach(b => {
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

          // 3. Skip if any job (active or finished) for this exact vehicle already exists (No duplicates!)
          const hasExistingJobForVehicle = Array.from(allMap.values()).some(j => {
            if (!j) return false;
            const jVeh = String(j.vehicle_number || '').replace(/[^A-Za-z0-9]/g, '').toUpperCase();
            return normVeh && jVeh && normVeh === jVeh;
          });

          if (hasExistingJobForVehicle || allMap.has(bookingJobId)) {
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
        return allDeletedIds.some(d => {
          if (!d) return false;
          const dStr = String(d).toLowerCase().trim();
          return itId && dStr && itId === dStr;
        });
      };

      const allInvMap = new Map();
      const localInv = JSON.parse(localStorage.getItem('inventory_items') || localStorage.getItem('spare_parts') || '[]');
      [...localInv, ...cloudInv, ...invData].forEach(item => {
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

      const unifiedInv = Array.from(allInvMap.values());
      localStorage.setItem('inventory_items', JSON.stringify(unifiedInv));
      localStorage.setItem('spare_parts', JSON.stringify(unifiedInv));
      setInventory(unifiedInv);
    } catch (err) {
      console.warn('Workshop fetchData error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData(true);
    const interval = setInterval(() => {
      fetchData(false);
    }, 4000);
    const handleStorage = () => fetchData(true);
    window.addEventListener('storage', handleStorage);
    window.addEventListener('master_store_updated', handleStorage);
    return () => {
      clearInterval(interval);
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('master_store_updated', handleStorage);
    };
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
    const localInv = JSON.parse(localStorage.getItem('inventory_items') || localStorage.getItem('spare_parts') || '[]');
    const currentInv = (inventory && inventory.length > 0) ? inventory : localInv;
    const firstItem = currentInv && currentInv.length > 0 ? currentInv[0] : null;
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

    const localInv = JSON.parse(localStorage.getItem('inventory_items') || localStorage.getItem('spare_parts') || '[]');
    const allInv = (inventory && inventory.length > 0) ? inventory : localInv;

    const filteredInv = allInv.filter(item => {
      if (!item) return false;
      const name = (item.part_name || item.name || '').toLowerCase();
      const query = (partSearchQuery || '').toLowerCase();
      return name.includes(query);
    });

    const targetKey = String(selectedPartId || '').trim();
    const targetNorm = targetKey.toLowerCase().replace(/[^a-z0-9]/g, '');

    let partObj = allInv.find(p => {
      if (!p) return false;
      const pKey = String(p.id || p.part_name || p.name || '').trim();
      const pNorm = String(p.part_name || p.name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      return (targetKey && pKey === targetKey) || (targetNorm && pNorm && targetNorm === pNorm);
    });

    if (!partObj && filteredInv.length > 0) {
      partObj = filteredInv[0];
    }

    if (!partObj) {
      alert('⚠️ Please click to select a valid spare part from the list.');
      return;
    }

    const availableStock = parseInt(partObj.current_stock !== undefined ? partObj.current_stock : (partObj.stock_quantity !== undefined ? partObj.stock_quantity : (partObj.quantity !== undefined ? partObj.quantity : 0)), 10);
    const qty = parseInt(partQty || 1, 10);

    if (availableStock <= 0) {
      alert(`⚠️ Out of Stock!\n\n'${partObj.part_name || partObj.name}' has 0 units available in Inventory.`);
      return;
    }

    if (qty > availableStock) {
      alert(`⚠️ Insufficient Stock!\n\nOnly ${availableStock} unit(s) of '${partObj.part_name || partObj.name}' available in Inventory.`);
      return;
    }

    const unitPrice = parseFloat(partObj.price || 0);

    const targetPartNorm = String(partObj.part_name || partObj.name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const targetPartId = String(partObj.id || '');

    const existingParts = Array.isArray(selectedJob.parts) ? selectedJob.parts : [];
    let partFound = false;

    const updatedParts = existingParts.map(p => {
      if (!p) return p;
      const pNorm = String(p.part_name || p.name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      const pId = String(p.inventory_id || p.part_id || p.id || '');

      const isSamePart = (targetPartId && pId && targetPartId === pId) || 
                         (targetPartNorm && pNorm && targetPartNorm === pNorm);

      if (isSamePart) {
        partFound = true;
        const newQty = parseInt(p.quantity || 1, 10) + qty;
        const unitP = parseFloat(p.unit_price || p.price || unitPrice);
        const newStagedTotal = unitP * newQty;
        return {
          ...p,
          quantity: newQty,
          unit_price: unitP,
          price: unitP,
          staged_total: newStagedTotal,
          status: 'CONFIRMED',
          is_confirmed: true,
          is_deducted: true
        };
      }
      return p;
    });

    if (!partFound) {
      updatedParts.push({
        id: Date.now(),
        inventory_id: partObj.id || `inv_${targetPartNorm}`,
        part_id: partObj.id || `inv_${targetPartNorm}`,
        part_name: partObj.part_name || partObj.name,
        price: unitPrice,
        unit_price: unitPrice,
        quantity: qty,
        staged_total: unitPrice * qty,
        status: 'CONFIRMED',
        is_confirmed: true,
        is_deducted: true
      });
    }

    const newPartsTotal = updatedParts.reduce((acc, p) => acc + parseFloat(p.staged_total || (parseFloat(p.price || p.unit_price || 0) * parseInt(p.quantity || 1, 10))), 0);
    const newLiveTotal = newPartsTotal + parseFloat(selectedJob.labour_charge || 0);

    const updatedJob = {
      ...selectedJob,
      parts: updatedParts,
      parts_total: newPartsTotal,
      live_total: newLiveTotal
    };

    const selId = String(selectedJob.id || '');
    const selRaw = selId.replace(/^job_/, '').replace(/^inv_/, '');
    const selVeh = String(selectedJob.vehicle_number || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');

    const isMatchJob = (j) => {
      if (!j) return false;
      const jId = String(j.id || '');
      const jRaw = jId.replace(/^job_/, '').replace(/^inv_/, '');
      const jVeh = String(j.vehicle_number || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
      return (selId && jId && (selId === jId || selId.includes(jId) || jId.includes(selId))) ||
             (selRaw && jRaw && selRaw === jRaw) ||
             (selVeh && jVeh && selVeh === jVeh);
    };

    setSelectedJob(updatedJob);
    setJobs(prev => prev.map(j => (isMatchJob(j) ? updatedJob : j)));
    
    // 1. Deduct Inventory stock IMMEDIATELY (10 -> 9)
    const baseInv = (inventory && inventory.length > 0) ? inventory : (localInv.length > 0 ? localInv : [partObj]);
    const partNormName = String(partObj.part_name || partObj.name || '').toLowerCase().replace(/[^a-z0-9]/g, '');

    let updatedTargetItem = null;
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
    localStorage.setItem('local_inventory', JSON.stringify(updatedInv));
    setInventory(updatedInv);
    try {
      window.dispatchEvent(new Event('storage'));
      window.dispatchEvent(new Event('master_store_updated'));
      window.dispatchEvent(new Event('inventory_updated'));
    } catch (e) {}

    // 2. Update Job parts
    const localJobs = JSON.parse(localStorage.getItem('workshop_jobs') || '[]');
    const updatedLocal = localJobs.map(j => (isMatchJob(j) ? updatedJob : j));
    if (!updatedLocal.some(isMatchJob)) {
      updatedLocal.push(updatedJob);
    }
    localStorage.setItem('workshop_jobs', JSON.stringify(updatedLocal));
    pushCloudJob(updatedJob).catch(console.warn);

    if (updatedTargetItem) {
      pushCloudInventoryItem(updatedTargetItem).catch(console.warn);
    }

    setShowPartModal(false);

    try {
      await API.post(`/workshop/${selectedJob.id}/add_staged_part/`, {
        inventory_id: partObj.id,
        quantity: qty
      }, { timeout: 2000 });
    } catch (err) {
      console.warn('Backend API notice:', err);
    } finally {
      const prevStock = parseInt(partObj.current_stock !== undefined ? partObj.current_stock : 10, 10);
      const afterStock = updatedTargetItem ? updatedTargetItem.current_stock : Math.max(0, prevStock - qty);
      alert(`✅ Part '${partObj.part_name || partObj.name}' Added!\n\nStock Deducted: ${prevStock} ➔ ${afterStock} Units in Inventory.`);
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
        localStorage.setItem('local_inventory', JSON.stringify(invList));
        setInventory(invList);
        try {
          window.dispatchEvent(new Event('storage'));
          window.dispatchEvent(new Event('master_store_updated'));
          window.dispatchEvent(new Event('inventory_updated'));
        } catch (e) {}
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
      const localInv = JSON.parse(localStorage.getItem('inventory_items') || localStorage.getItem('spare_parts') || localStorage.getItem('local_inventory') || '[]');
      const cloudInv = await fetchCloudInventory().catch(() => []);
      const allInvMap = new Map();
      [...cloudInv, ...localInv].forEach(item => {
        if (item && (item.id || item.part_name || item.item_name || item.name)) {
          const rawName = String(item.part_name || item.item_name || item.name || '').trim();
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
          const invName = String(invItem.part_name || invItem.item_name || invItem.name || '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase().trim();

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
        localStorage.setItem('local_inventory', JSON.stringify(invList));
        setInventory(invList);
        try {
          window.dispatchEvent(new Event('storage'));
          window.dispatchEvent(new Event('master_store_updated'));
          window.dispatchEvent(new Event('inventory_updated'));
        } catch (e) {}
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
    const enteredPaid = parseFloat(paidAmount) || 0;
    const paidAmountNum = Math.min(grandTotal, Math.max(0, enteredPaid));
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

    // Update online booking memory so it never re-creates as active
    try {
      const localBookings = JSON.parse(localStorage.getItem('local_bookings') || localStorage.getItem('workshop_online_bookings') || '[]');
      const updatedBookings = localBookings.map(b => {
        if (!b) return b;
        const bId = String(b.id || '');
        const bVeh = String(b.vehicle_number || '').replace(/[^A-Za-z0-9]/g, '').toUpperCase();
        const tVeh = String(selectedJob.vehicle_number || '').replace(/[^A-Za-z0-9]/g, '').toUpperCase();
        if (bId === String(targetId) || bId === String(selectedJob.booking_id) || (bVeh && tVeh && bVeh === tVeh)) {
          return { ...b, status: 'FINISHED' };
        }
        return b;
      });
      localStorage.setItem('local_bookings', JSON.stringify(updatedBookings));
      localStorage.setItem('workshop_online_bookings', JSON.stringify(updatedBookings));
    } catch (bErr) {
      console.warn('Booking status update notice:', bErr);
    }

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

    // 1. Move to Recycle Bin & purge atomically (0ms local & cloud)
    deleteJobToRecycleBin(targetJob).catch(console.warn);

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

  const handleUndoJobWithPassword = async (adminPassword) => {
    if (!undoJobModal.job) return;
    const targetJob = undoJobModal.job;
    const jobId = targetJob.id;

    const updatedJob = { ...targetJob, status: 'IN_PROGRESS', updated_at: new Date().toISOString() };

    const currentJobs = JSON.parse(localStorage.getItem('workshop_jobs') || '[]');
    const updatedLocal = currentJobs.map(j => (String(j.id) === String(jobId) ? updatedJob : j));
    if (!updatedLocal.some(j => String(j.id) === String(jobId))) {
      updatedLocal.push(updatedJob);
    }
    localStorage.setItem('workshop_jobs', JSON.stringify(updatedLocal));

    setJobs(prev => prev.map(j => (String(j.id) === String(jobId) ? updatedJob : j)));

    await updateCloudJobStatus(jobId, 'IN_PROGRESS').catch(console.warn);
    pushAuditLog('UNDO_CANCEL', 'Workshop', `Restored cancelled job ${targetJob.vehicle_number} (${targetJob.customer_name}) back to Active Workshop`).catch(console.warn);

    setUndoJobModal({ isOpen: false, job: null });
    setTab('ACTIVE');
    alert(`🎉 Service job for ${targetJob.vehicle_number} has been restored back to Active Workshop Floor!`);
  };

  const getNormStatus = (j) => String(j?.status || '').trim().toUpperCase();

  const activeJobs = jobs.filter(j => j && !['FINISHED', 'COMPLETED', 'CANCELLED', 'CLOSED', 'REJECTED'].includes(getNormStatus(j)));
  const finishedJobs = jobs.filter(j => j && ['FINISHED', 'COMPLETED'].includes(getNormStatus(j)));
  const cancelledJobs = jobs.filter(j => j && ['CANCELLED', 'CLOSED', 'REJECTED'].includes(getNormStatus(j)));
  const onlineBookingJobs = jobs.filter(j => j && !['FINISHED', 'COMPLETED', 'CANCELLED', 'CLOSED', 'REJECTED'].includes(getNormStatus(j)) && (j.is_online_booking || j.booking_id || j.source === 'ONLINE_BOOKING' || String(j.complaint || '').toLowerCase().includes('booking')));

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

      {tab !== 'FINISHED' && tab !== 'CANCELLED' && (
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

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      onClick={() => setUndoJobModal({ isOpen: true, job })}
                      className="px-3 py-1.5 bg-purple-50 hover:bg-purple-100 text-purple-700 font-bold text-xs rounded-xl border border-purple-200 flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <RotateCcw className="w-3.5 h-3.5 text-purple-600" /> Undo / Re-activate (Password)
                    </button>
                    <button
                      onClick={() => setDeleteJobModal({ isOpen: true, job })}
                      className="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 font-bold text-xs rounded-xl border border-red-200 flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Delete Job (Password Protected)
                    </button>
                  </div>
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
          <div className="bg-white rounded-3xl p-6 sm:p-7 max-w-lg w-full space-y-4 shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <div>
                <h2 className="text-lg font-bold text-slate-900 font-poppins flex items-center gap-2">
                  <Package className="w-5 h-5 text-blue-600" /> Add Spare Part
                </h2>
                <p className="text-xs text-slate-500">Adds part to job card and deducts stock from Inventory</p>
              </div>
              <button
                onClick={() => setShowPartModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-full hover:bg-slate-100"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddPart} className="space-y-4 flex-1 flex flex-col min-h-0">
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
              <div className="flex-1 overflow-y-auto space-y-2 pr-1 border border-slate-100 rounded-2xl p-2 bg-slate-50/50 max-h-60 min-h-40">
                {(() => {
                  const localInv = JSON.parse(localStorage.getItem('inventory_items') || localStorage.getItem('spare_parts') || '[]');
                  const invListToDisplay = (inventory && inventory.length > 0) ? inventory : localInv;
                  const filtered = invListToDisplay.filter(item => {
                    if (!item) return false;
                    const name = (item.part_name || item.name || '').toLowerCase();
                    const query = (partSearchQuery || '').toLowerCase();
                    return name.includes(query);
                  });

                  if (filtered.length === 0) {
                    return (
                      <div className="p-8 text-center text-xs text-slate-400 font-medium">
                        No spare parts found matching "{partSearchQuery}"
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
                <div className="flex justify-between items-center mb-1">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">Amount Paid Now (₹)</label>
                  <span className="text-[11px] font-bold text-slate-400">Max: ₹{formatMoney(grandTotal)}</span>
                </div>
                <input
                  type="number"
                  step="1"
                  min="0"
                  max={grandTotal}
                  value={paidAmount}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value) || 0;
                    setPaidAmount(Math.min(grandTotal, Math.max(0, val)));
                  }}
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

      {/* ADMIN PASSWORD UNDO CANCELLED JOB MODAL */}
      <AdminPasswordModal
        isOpen={undoJobModal.isOpen}
        onClose={() => setUndoJobModal({ isOpen: false, job: null })}
        onConfirm={handleUndoJobWithPassword}
        title="Undo Cancel & Re-activate Service Job"
        itemDescription={undoJobModal.job ? `Service Job #${undoJobModal.job.id} (${undoJobModal.job.vehicle_number} - ${undoJobModal.job.customer_name})` : 'job'}
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
