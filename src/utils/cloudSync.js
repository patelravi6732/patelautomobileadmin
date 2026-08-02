import axios from 'axios';

// Primary & Backup Master Cloud Storage Endpoints
const PRIMARY_BIN_URL = 'https://api.npoint.io/87b4fa8d9e2a4a754b2a';
const BACKUP_BIN_URL = 'https://api.restful-api.dev/objects/ff8081819f7e10ae019fbcb185ca5b9e';

async function fetchMasterStore() {
  const getLocalCache = () => {
    try {
      const raw = localStorage.getItem('master_cloud_cache');
      if (raw) {
        const parsed = JSON.parse(raw);
        return {
          bookings: Array.isArray(parsed.bookings) ? parsed.bookings : [],
          messages: Array.isArray(parsed.messages) ? parsed.messages : [],
          jobs: Array.isArray(parsed.jobs) ? parsed.jobs : [],
          inventory: Array.isArray(parsed.inventory) ? parsed.inventory : [],
          recycleBin: Array.isArray(parsed.recycleBin) ? parsed.recycleBin : [],
          garageInfo: parsed.garageInfo || null,
          adminProfiles: Array.isArray(parsed.adminProfiles) ? parsed.adminProfiles : [],
          khataEntries: Array.isArray(parsed.khataEntries) ? parsed.khataEntries : [],
          customers: Array.isArray(parsed.customers) ? parsed.customers : [],
          invoices: Array.isArray(parsed.invoices) ? parsed.invoices : [],
          attendance: Array.isArray(parsed.attendance) ? parsed.attendance : [],
          salaryPayments: Array.isArray(parsed.salaryPayments) ? parsed.salaryPayments : [],
          deletedIds: Array.isArray(parsed.deletedIds) ? parsed.deletedIds : []
        };
      }
    } catch (e) {
      console.warn('Error reading local master_cloud_cache:', e);
    }
    return { bookings: [], messages: [], jobs: [], inventory: [], recycleBin: [], garageInfo: null, adminProfiles: [], khataEntries: [], customers: [], invoices: [], attendance: [], salaryPayments: [], deletedIds: [] };
  };

  const localCache = getLocalCache();
  let freshStore = null;

  try {
    const res = await axios.get(PRIMARY_BIN_URL, { timeout: 1500 });
    if (res.data) {
      freshStore = {
        bookings: Array.isArray(res.data.bookings) ? res.data.bookings : [],
        messages: Array.isArray(res.data.messages) ? res.data.messages : [],
        jobs: Array.isArray(res.data.jobs) ? res.data.jobs : [],
        inventory: Array.isArray(res.data.inventory) ? res.data.inventory : [],
        recycleBin: Array.isArray(res.data.recycleBin) ? res.data.recycleBin : [],
        garageInfo: res.data.garageInfo || null,
        adminProfiles: Array.isArray(res.data.adminProfiles) ? res.data.adminProfiles : [],
        khataEntries: Array.isArray(res.data.khataEntries) ? res.data.khataEntries : [],
        customers: Array.isArray(res.data.customers) ? res.data.customers : [],
        invoices: Array.isArray(res.data.invoices) ? res.data.invoices : [],
        attendance: Array.isArray(res.data.attendance) ? res.data.attendance : [],
        salaryPayments: Array.isArray(res.data.salaryPayments) ? res.data.salaryPayments : [],
        deletedIds: Array.isArray(res.data.deletedIds) ? res.data.deletedIds : []
      };
    }
  } catch (e1) {
    try {
      const res = await axios.get(BACKUP_BIN_URL, { timeout: 1500 });
      if (res.data && res.data.data) {
        freshStore = {
          bookings: Array.isArray(res.data.data.bookings) ? res.data.data.bookings : [],
          messages: Array.isArray(res.data.data.messages) ? res.data.data.messages : [],
          jobs: Array.isArray(res.data.data.jobs) ? res.data.data.jobs : [],
          inventory: Array.isArray(res.data.data.inventory) ? res.data.data.inventory : [],
          recycleBin: Array.isArray(res.data.data.recycleBin) ? res.data.data.recycleBin : [],
          garageInfo: res.data.data.garageInfo || null,
          adminProfiles: Array.isArray(res.data.data.adminProfiles) ? res.data.data.adminProfiles : [],
          khataEntries: Array.isArray(res.data.data.khataEntries) ? res.data.data.khataEntries : [],
          customers: Array.isArray(res.data.data.customers) ? res.data.data.customers : [],
          invoices: Array.isArray(res.data.data.invoices) ? res.data.data.invoices : [],
          attendance: Array.isArray(res.data.data.attendance) ? res.data.data.attendance : [],
          salaryPayments: Array.isArray(res.data.data.salaryPayments) ? res.data.data.salaryPayments : [],
          deletedIds: Array.isArray(res.data.data.deletedIds) ? res.data.data.deletedIds : []
        };
      }
    } catch (e2) {
      // Cloud endpoints offline
    }
  }

  if (freshStore) {
    // Merge cloud and local cache to preserve rich records
    const mergedStore = {
      bookings: Array.from(new Map([...localCache.bookings, ...freshStore.bookings].map(b => [b.id || `${b.customer_name}_${b.vehicle_number}`, b])).values()),
      messages: Array.from(new Map([...localCache.messages, ...freshStore.messages].map(m => [m.id || m.title, m])).values()),
      jobs: Array.from(new Map([...localCache.jobs, ...freshStore.jobs].map(j => [j.id, j])).values()),
      inventory: Array.from(new Map([...localCache.inventory, ...freshStore.inventory].map(i => [i.id || i.name, i])).values()),
      recycleBin: Array.from(new Map([...localCache.recycleBin, ...freshStore.recycleBin].map(r => [r.id, r])).values()),
      garageInfo: freshStore.garageInfo || localCache.garageInfo,
      adminProfiles: Array.from(new Map([...localCache.adminProfiles, ...freshStore.adminProfiles].map(a => [a.id || a.email, a])).values()),
      khataEntries: Array.from(new Map([...localCache.khataEntries, ...freshStore.khataEntries].map(k => [k.id, k])).values()),
      customers: Array.from(new Map([...localCache.customers, ...freshStore.customers].map(c => [c.id || c.phone, c])).values()),
      invoices: Array.from(new Map([...localCache.invoices, ...freshStore.invoices].map(inv => [inv.id, inv])).values()),
      attendance: Array.from(new Map([...localCache.attendance, ...freshStore.attendance].map(att => [att.id || `${att.mechanic_name}_${att.date}`, att])).values()),
      salaryPayments: Array.from(new Map([...localCache.salaryPayments, ...freshStore.salaryPayments].map(s => [s.id, s])).values()),
      deletedIds: Array.from(new Set([...localCache.deletedIds, ...freshStore.deletedIds]))
    };
    try {
      localStorage.setItem('master_cloud_cache', JSON.stringify(mergedStore));
    } catch (e) {
      console.warn('Failed to update local master_cloud_cache:', e);
    }
    return mergedStore;
  }

  return localCache;
}

async function saveMasterStore(storeData) {
  try {
    localStorage.setItem('master_cloud_cache', JSON.stringify(storeData));
  } catch (e) {
    console.warn('Error writing local master_cloud_cache:', e);
  }

  try {
    await axios.post(PRIMARY_BIN_URL, storeData, { timeout: 2500 });
  } catch (err) {
    try {
      await axios.put(BACKUP_BIN_URL, { name: 'PatelAutomobilesMasterBin', data: storeData }, { timeout: 2000 });
    } catch (e2) {
      // Saved in local cache above
    }
  }
}

// ---------------- BOOKINGS ----------------
export async function fetchCloudBookings() {
  const store = await fetchMasterStore();
  return (store.bookings || []).filter(b => b && typeof b === 'object' && (b.id || b.customer_name || b.vehicle_number));
}

export async function pushCloudBooking(newBooking) {
  if (!newBooking || typeof newBooking !== 'object') return;
  const store = await fetchMasterStore();
  const existing = (store.bookings || []).filter(b => b && typeof b === 'object');
  
  const exists = existing.some(b => 
    b.id === newBooking.id || 
    (b.vehicle_number && newBooking.vehicle_number && b.vehicle_number === newBooking.vehicle_number && b.preferred_date === newBooking.preferred_date)
  );

  let updatedBookings = existing;
  if (!exists) {
    updatedBookings = [newBooking, ...existing];
  } else {
    updatedBookings = existing.map(b => 
      (b.id === newBooking.id || (b.vehicle_number === newBooking.vehicle_number && b.preferred_date === newBooking.preferred_date))
        ? { ...b, ...newBooking }
        : b
    );
  }

  await saveMasterStore({ ...store, bookings: updatedBookings });
}

export async function updateCloudBookingStatus(bookingId, newStatus, vehicleNumber = null, prefDate = null) {
  if (!bookingId && !vehicleNumber) return;
  const store = await fetchMasterStore();
  const existing = (store.bookings || []).filter(b => b && typeof b === 'object');
  const updatedBookings = existing.map(b => {
    const isMatch = (bookingId && (b.id === bookingId || String(b.id) === String(bookingId))) ||
                    (vehicleNumber && prefDate && b.vehicle_number === vehicleNumber && b.preferred_date === prefDate);
    if (isMatch) {
      return { ...b, status: newStatus };
    }
    return b;
  });
  await saveMasterStore({ ...store, bookings: updatedBookings });
}

// ---------------- MESSAGES (CONTACT INQUIRIES) ----------------
export async function fetchCloudMessages() {
  const store = await fetchMasterStore();
  return (store.messages || []).filter(m => m && typeof m === 'object' && (m.id || m.name || m.phone || m.message));
}

export async function pushCloudMessage(newMsg) {
  if (!newMsg || typeof newMsg !== 'object') return;
  const store = await fetchMasterStore();
  const existing = (store.messages || []).filter(m => m && typeof m === 'object');
  const exists = existing.some(m => m.id === newMsg.id || (m.name === newMsg.name && m.phone === newMsg.phone && m.message === newMsg.message));
  
  let updated = existing;
  if (!exists) {
    updated = [newMsg, ...existing];
  }
  await saveMasterStore({ ...store, messages: updated });
}

// ---------------- WORKSHOP JOBS (CONVERT TO SERVICE) ----------------
export async function fetchCloudJobs() {
  const store = await fetchMasterStore();
  return (store.jobs || []).filter(j => j && typeof j === 'object' && (j.id || j.customer_name || j.vehicle_number));
}

export async function pushCloudJob(newJob) {
  if (!newJob || typeof newJob !== 'object') return;
  const store = await fetchMasterStore();
  const existing = (store.jobs || []).filter(j => j && typeof j === 'object');
  const exists = existing.some(j => j.id === newJob.id || (j.vehicle_number && newJob.vehicle_number && j.vehicle_number === newJob.vehicle_number && j.status === 'IN_PROGRESS'));
  let updated = existing;
  if (!exists) {
    updated = [newJob, ...existing];
  } else {
    updated = existing.map(j => (j.id === newJob.id || String(j.id) === String(newJob.id)) ? { ...j, ...newJob } : j);
  }
  await saveMasterStore({ ...store, jobs: updated });
}

export async function updateCloudJobStatus(jobId, newStatus) {
  if (!jobId) return;
  const store = await fetchMasterStore();
  const existing = (store.jobs || []).filter(j => j && typeof j === 'object');
  const updated = existing.map(j => {
    if (j.id === jobId || String(j.id) === String(jobId)) {
      return { ...j, status: newStatus };
    }
    return j;
  });
  await saveMasterStore({ ...store, jobs: updated });
}

export async function deleteCloudJob(jobId) {
  if (!jobId) return;
  const store = await fetchMasterStore();
  const existing = (store.jobs || []).filter(j => j && typeof j === 'object');
  const updated = existing.filter(j => j.id !== jobId && String(j.id) !== String(jobId));
  await saveMasterStore({ ...store, jobs: updated });
}

export async function deleteCloudBooking(bookingId) {
  if (!bookingId) return;
  const store = await fetchMasterStore();
  const existing = (store.bookings || []).filter(b => b && typeof b === 'object');
  const updated = existing.filter(b => b.id !== bookingId && String(b.id) !== String(bookingId));
  await saveMasterStore({ ...store, bookings: updated });
}

export async function deleteCloudMessage(msgId) {
  if (!msgId) return;
  const store = await fetchMasterStore();
  const existing = (store.messages || []).filter(m => m && typeof m === 'object');
  const updated = existing.filter(m => m.id !== msgId && String(m.id) !== String(msgId));
  await saveMasterStore({ ...store, messages: updated });
}

export async function markCloudMessageRead(msgId) {
  if (!msgId) return;
  const store = await fetchMasterStore();
  const existing = (store.messages || []).filter(m => m && typeof m === 'object');
  const updated = existing.map(m => (m.id === msgId || String(m.id) === String(msgId)) ? { ...m, is_read: true } : m);
  await saveMasterStore({ ...store, messages: updated });
}

// ---------------- INVENTORY ----------------
export async function fetchCloudInventory() {
  const store = await fetchMasterStore();
  return (store.inventory || []).filter(i => i && typeof i === 'object' && (i.id || i.part_name || i.name));
}

export async function pushCloudInventoryItem(newItem) {
  if (!newItem || typeof newItem !== 'object') return;
  const store = await fetchMasterStore();
  const existing = (store.inventory || []).filter(i => i && typeof i === 'object');
  const exists = existing.some(i => i.id === newItem.id || String(i.id) === String(newItem.id));
  let updated = existing;
  if (!exists) {
    updated = [newItem, ...existing];
  } else {
    updated = existing.map(i => (i.id === newItem.id || String(i.id) === String(newItem.id)) ? { ...i, ...newItem } : i);
  }
  await saveMasterStore({ ...store, inventory: updated });
}

export async function deleteCloudInventoryItem(itemId) {
  if (!itemId) return;
  const store = await fetchMasterStore();
  const existing = (store.inventory || []).filter(i => i && typeof i === 'object');
  const updated = existing.filter(i => i.id !== itemId && String(i.id) !== String(itemId));
  await saveMasterStore({ ...store, inventory: updated });
}

// ---------------- RECYCLE BIN ----------------
export async function fetchCloudRecycleBin() {
  const store = await fetchMasterStore();
  return (store.recycleBin || []).filter(r => r && typeof r === 'object' && (r.id || r.item_type));
}

export async function pushCloudRecycleBinItem(trashObj) {
  if (!trashObj || typeof trashObj !== 'object') return;
  const store = await fetchMasterStore();
  const existing = (store.recycleBin || []).filter(r => r && typeof r === 'object');
  const updated = [trashObj, ...existing];
  await saveMasterStore({ ...store, recycleBin: updated });
}

export async function restoreCloudRecycleBinItem(itemId) {
  if (!itemId) return;
  const store = await fetchMasterStore();
  const existing = (store.recycleBin || []).filter(r => r && typeof r === 'object');
  const target = existing.find(r => r.id === itemId || String(r.id) === String(itemId));
  const updatedTrash = existing.filter(r => r.id !== itemId && String(r.id) !== String(itemId));
  
  let updatedInventory = store.inventory || [];
  if (target && target.payload && target.item_type === 'Inventory') {
    updatedInventory = [target.payload, ...updatedInventory];
  }
  await saveMasterStore({ ...store, recycleBin: updatedTrash, inventory: updatedInventory });
}

export async function emptyCloudRecycleBin() {
  const store = await fetchMasterStore();
  await saveMasterStore({ ...store, recycleBin: [] });
}

// ---------------- GARAGE INFO (SETTINGS) ----------------
export async function fetchCloudGarageInfo() {
  const store = await fetchMasterStore();
  return store.garageInfo || null;
}

export async function pushCloudGarageInfo(infoObj) {
  if (!infoObj || typeof infoObj !== 'object') return;
  const store = await fetchMasterStore();
  await saveMasterStore({ ...store, garageInfo: infoObj });
}

// ---------------- ADMIN PROFILES (MONGODB / CLOUD SYNC) ----------------
export async function fetchCloudAdminProfiles() {
  const store = await fetchMasterStore();
  return (store.adminProfiles || []).filter(a => a && typeof a === 'object' && (a.id || a.username || a.user_name));
}

export async function pushCloudAdminProfile(adminObj) {
  if (!adminObj || typeof adminObj !== 'object') return;
  const store = await fetchMasterStore();
  const existing = (store.adminProfiles || []).filter(a => a && typeof a === 'object');
  const exists = existing.some(a => a.id === adminObj.id || (a.username && adminObj.username && a.username === adminObj.username));
  
  let updated = existing;
  if (!exists) {
    updated = [adminObj, ...existing];
  } else {
    updated = existing.map(a => (a.id === adminObj.id || a.username === adminObj.username) ? { ...a, ...adminObj } : a);
  }
  await saveMasterStore({ ...store, adminProfiles: updated });
}

export async function deleteCloudAdminProfile(adminId) {
  if (!adminId) return;
  const store = await fetchMasterStore();
  const existing = (store.adminProfiles || []).filter(a => a && typeof a === 'object');
  const updated = existing.filter(a => a.id !== adminId && String(a.id) !== String(adminId));
  await saveMasterStore({ ...store, adminProfiles: updated });
}

// ---------------- KHATA ENTRIES ----------------
export async function fetchCloudKhataEntries() {
  const store = await fetchMasterStore();
  return (store.khataEntries || []).filter(k => k && typeof k === 'object' && (k.id || k.customer_name || k.amount));
}

export async function pushCloudKhataEntry(khataObj) {
  if (!khataObj || typeof khataObj !== 'object') return;
  const store = await fetchMasterStore();
  const existing = (store.khataEntries || []).filter(k => k && typeof k === 'object');
  const exists = existing.some(k => k.id === khataObj.id || String(k.id) === String(khataObj.id));
  let updated = existing;
  if (!exists) {
    updated = [khataObj, ...existing];
  } else {
    updated = existing.map(k => (k.id === khataObj.id || String(k.id) === String(khataObj.id)) ? { ...k, ...khataObj } : k);
  }
  await saveMasterStore({ ...store, khataEntries: updated });
}

export async function deleteCloudKhataEntry(khataId) {
  if (!khataId) return;
  const store = await fetchMasterStore();
  const existing = (store.khataEntries || []).filter(k => k && typeof k === 'object');
  const updated = existing.filter(k => k.id !== khataId && String(k.id) !== String(khataId));
  await saveMasterStore({ ...store, khataEntries: updated });
}

// ---------------- INVOICES & BILLING ----------------
export async function fetchCloudInvoices() {
  const store = await fetchMasterStore();
  return (store.invoices || []).filter(i => i && typeof i === 'object' && (i.id || i.invoice_number || i.customer_name));
}

export async function pushCloudInvoice(invObj) {
  if (!invObj || typeof invObj !== 'object') return;
  const store = await fetchMasterStore();
  const existing = (store.invoices || []).filter(i => i && typeof i === 'object');
  const exists = existing.some(i => i.id === invObj.id || String(i.id) === String(invObj.id));
  let updated = existing;
  if (!exists) {
    updated = [invObj, ...existing];
  } else {
    updated = existing.map(i => (i.id === invObj.id || String(i.id) === String(invObj.id)) ? { ...i, ...invObj } : i);
  }
  await saveMasterStore({ ...store, invoices: updated });
}

export async function deleteCloudInvoice(invId) {
  if (!invId) return;
  const store = await fetchMasterStore();
  const existing = (store.invoices || []).filter(i => i && typeof i === 'object');
  const updated = existing.filter(i => i.id !== invId && String(i.id) !== String(invId) && i.invoice_number !== invId);
  await saveMasterStore({ ...store, invoices: updated });
}

export async function fetchCloudCustomers() {
  const store = await fetchMasterStore();
  return (store.customers || []).filter(c => c && typeof c === 'object' && (c.id || c.customer_name || c.vehicle_number));
}

export async function pushCloudCustomer(custObj) {
  if (!custObj || typeof custObj !== 'object') return;
  const store = await fetchMasterStore();
  const existing = (store.customers || []).filter(c => c && typeof c === 'object');
  const cleanVeh = (custObj.vehicle_number || '').replace(/[^A-Za-z0-9]/g, '').toUpperCase();
  const updated = [custObj, ...existing.filter(c => (c.vehicle_number || '').replace(/[^A-Za-z0-9]/g, '').toUpperCase() !== cleanVeh)];
  await saveMasterStore({ ...store, customers: updated });
}

export async function deleteCloudCustomer(custId) {
  if (!custId) return;
  const store = await fetchMasterStore();
  const existing = (store.customers || []).filter(c => c && typeof c === 'object');
  const updated = existing.filter(c => c.id !== custId && String(c.id) !== String(custId));
  await saveMasterStore({ ...store, customers: updated });
}

// ---------------- ATTENDANCE & SALARY PAYMENTS ----------------
export async function fetchCloudAttendance() {
  const store = await fetchMasterStore();
  return (store.attendance || []).filter(a => a && typeof a === 'object' && (a.id || a.mechanic_name));
}

export async function pushCloudAttendanceRecord(attObj) {
  if (!attObj || typeof attObj !== 'object') return;
  const store = await fetchMasterStore();
  const existing = (store.attendance || []).filter(a => a && typeof a === 'object');
  const updated = [attObj, ...existing];
  await saveMasterStore({ ...store, attendance: updated });
}

export async function deleteCloudAttendanceRecord(attId) {
  if (!attId) return;
  const store = await fetchMasterStore();
  const existing = (store.attendance || []).filter(a => a && typeof a === 'object');
  const updated = existing.filter(a => a.id !== attId && String(a.id) !== String(attId));
  await saveMasterStore({ ...store, attendance: updated });
}

export async function fetchCloudSalaryPayments() {
  const store = await fetchMasterStore();
  return (store.salaryPayments || []).filter(s => s && typeof s === 'object' && (s.id || s.mechanic_name || s.amount));
}

export async function pushCloudSalaryPayment(salObj) {
  if (!salObj || typeof salObj !== 'object') return;
  const store = await fetchMasterStore();
  const existing = (store.salaryPayments || []).filter(s => s && typeof s === 'object');
  const updated = [salObj, ...existing];
  await saveMasterStore({ ...store, salaryPayments: updated });
}

export async function deleteCloudSalaryPayment(salId) {
  if (!salId) return;
  const store = await fetchMasterStore();
  const existing = (store.salaryPayments || []).filter(s => s && typeof s === 'object');
  const updated = existing.filter(s => s.id !== salId && String(s.id) !== String(salId));
  await saveMasterStore({ ...store, salaryPayments: updated });
}

// ---------------- PERMANENT DELETED IDS TRACKER ----------------
export async function fetchCloudDeletedIds() {
  const store = await fetchMasterStore();
  const cloudDeleted = (store.deletedIds || []).map(d => String(d));
  const localDeleted = JSON.parse(localStorage.getItem('deleted_item_ids') || '[]').map(d => String(d));
  // Filter out vehicle registration numbers (e.g., GJ15AR1234) so recurring vehicle visits are never blocked
  const vehicleRegex = /^[A-Z]{2}\s*\d{1,2}\s*[A-Z]{0,3}\s*\d{1,4}$/i;
  const filtered = [...cloudDeleted, ...localDeleted].filter(id => {
    const s = String(id).trim();
    if (vehicleRegex.test(s)) return false;
    if (s.length === 10 && /^[A-Z0-9]+$/i.test(s) && !s.startsWith('inv_') && !s.startsWith('job_') && !s.startsWith('khata_')) return false;
    return true;
  });
  return Array.from(new Set(filtered));
}

export async function markIdAsDeleted(targetId) {
  if (!targetId) return;
  const strId = String(targetId);
  const rawId = strId.replace(/^inv_/, '').replace(/^job_/, '').replace(/^khata_/, '');
  const idsToMark = [strId, rawId, `inv_${rawId}`, `job_${rawId}`, `khata_${rawId}`];

  const localDeleted = JSON.parse(localStorage.getItem('deleted_item_ids') || '[]');
  const updatedLocal = Array.from(new Set([...localDeleted, ...idsToMark]));
  localStorage.setItem('deleted_item_ids', JSON.stringify(updatedLocal));

  const store = await fetchMasterStore();
  const existing = (store.deletedIds || []).map(d => String(d));
  const updatedCloud = Array.from(new Set([...existing, ...idsToMark]));
  await saveMasterStore({ ...store, deletedIds: updatedCloud });
}

export async function unmarkDeletedId(targetId) {
  if (!targetId) return;
  const strId = String(targetId);
  const rawId = strId.replace(/^inv_/, '').replace(/^job_/, '').replace(/^khata_/, '');
  const idsToRemove = new Set([strId, rawId, `inv_${rawId}`, `job_${rawId}`, `khata_${rawId}`]);

  const localDeleted = JSON.parse(localStorage.getItem('deleted_item_ids') || '[]');
  const updatedLocal = localDeleted.filter(d => !idsToRemove.has(String(d)));
  localStorage.setItem('deleted_item_ids', JSON.stringify(updatedLocal));

  const store = await fetchMasterStore();
  const existing = (store.deletedIds || []).map(d => String(d));
  const updatedCloud = existing.filter(d => !idsToRemove.has(String(d)));
  await saveMasterStore({ ...store, deletedIds: updatedCloud });
}

// ---------------- AUDIT LOGS TRACKER ----------------
export async function pushAuditLog(action, moduleName, details, performedBy = 'Patel Owner (Admin)') {
  const logObj = {
    id: `audit_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
    action: action || 'UPDATE',
    module_name: moduleName || 'General',
    details: details || 'Administrative action performed',
    performed_by: performedBy,
    timestamp: new Date().toISOString(),
    created_at: new Date().toISOString()
  };

  const localLogs = JSON.parse(localStorage.getItem('admin_audit_logs') || '[]');
  localStorage.setItem('admin_audit_logs', JSON.stringify([logObj, ...localLogs]));

  const store = await fetchMasterStore();
  const existing = (store.auditLogs || []).filter(l => l && typeof l === 'object');
  await saveMasterStore({ ...store, auditLogs: [logObj, ...existing] });
}

export async function fetchCloudAuditLogs() {
  const store = await fetchMasterStore();
  const cloudLogs = (store.auditLogs || []).filter(l => l && typeof l === 'object');
  const localLogs = JSON.parse(localStorage.getItem('admin_audit_logs') || '[]');

  const map = new Map();
  [...cloudLogs, ...localLogs].forEach(l => {
    if (l && typeof l === 'object') {
      const key = l.id || `${l.action}_${l.timestamp}`;
      if (!map.has(key)) map.set(key, l);
    }
  });
  return Array.from(map.values()).sort((a, b) => new Date(b.timestamp || Date.now()) - new Date(a.timestamp || Date.now()));
}
