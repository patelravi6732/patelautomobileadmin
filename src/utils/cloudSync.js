import axios from 'axios';

const PRIMARY_BIN_URL = 'https://jsonblob.com/api/jsonBlob/019fd66d-15cf-7fac-88f7-812f4bd2d266';

export const DEFAULT_PRIMARY_ADMIN = {
  id: 'admin_patel_primary',
  username: 'patel',
  user_name: 'Ravi Patel',
  password: '@ravipatel2005',
  phone: '+91 81403 71414',
  email: 'patelautomobile01@gmail.com',
  role: 'ADMIN',
  created_at: new Date().toISOString()
};

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
    const res = await axios.get(PRIMARY_BIN_URL + '?t=' + Date.now(), {
      headers: { 'Accept': 'application/json', 'Cache-Control': 'no-cache' },
      timeout: 3000
    });
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
    console.warn('Primary cloud store fetch notice:', e1);
  }

  if (freshStore) {
    const mergedStore = {
      bookings: freshStore.bookings,
      messages: freshStore.messages,
      jobs: freshStore.jobs,
      inventory: freshStore.inventory,
      recycleBin: freshStore.recycleBin,
      garageInfo: freshStore.garageInfo || localCache.garageInfo,
      adminProfiles: freshStore.adminProfiles,
      khataEntries: freshStore.khataEntries,
      customers: freshStore.customers,
      invoices: freshStore.invoices,
      attendance: freshStore.attendance,
      salaryPayments: freshStore.salaryPayments,
      deletedIds: freshStore.deletedIds
    };
    try {
      localStorage.setItem('master_cloud_cache', JSON.stringify(mergedStore));

      if (Array.isArray(mergedStore.jobs)) localStorage.setItem('workshop_jobs', JSON.stringify(mergedStore.jobs));
      if (Array.isArray(mergedStore.invoices)) localStorage.setItem('local_invoices', JSON.stringify(mergedStore.invoices));
      if (Array.isArray(mergedStore.inventory)) {
        localStorage.setItem('inventory_items', JSON.stringify(mergedStore.inventory));
        localStorage.setItem('spare_parts', JSON.stringify(mergedStore.inventory));
      }
      if (Array.isArray(mergedStore.khataEntries)) localStorage.setItem('khata_entries', JSON.stringify(mergedStore.khataEntries));
      if (Array.isArray(mergedStore.bookings)) localStorage.setItem('local_bookings', JSON.stringify(mergedStore.bookings));
      if (Array.isArray(mergedStore.messages)) {
        localStorage.setItem('local_messages', JSON.stringify(mergedStore.messages));
        localStorage.setItem('contact_messages', JSON.stringify(mergedStore.messages));
      }
      if (Array.isArray(mergedStore.adminProfiles)) localStorage.setItem('admin_profiles', JSON.stringify(mergedStore.adminProfiles));
      if (Array.isArray(mergedStore.customers)) localStorage.setItem('local_customers', JSON.stringify(mergedStore.customers));
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
    if (storeData.garageInfo) {
      localStorage.setItem('garage_info', JSON.stringify(storeData.garageInfo));
    }
    if (Array.isArray(storeData.jobs)) localStorage.setItem('workshop_jobs', JSON.stringify(storeData.jobs));
    if (Array.isArray(storeData.invoices)) localStorage.setItem('local_invoices', JSON.stringify(storeData.invoices));
    if (Array.isArray(storeData.khataEntries)) localStorage.setItem('khata_entries', JSON.stringify(storeData.khataEntries));
    if (Array.isArray(storeData.customers)) localStorage.setItem('local_customers', JSON.stringify(storeData.customers));
    if (Array.isArray(storeData.inventory)) {
      localStorage.setItem('inventory_items', JSON.stringify(storeData.inventory));
      localStorage.setItem('spare_parts', JSON.stringify(storeData.inventory));
    }
    if (Array.isArray(storeData.bookings)) localStorage.setItem('local_bookings', JSON.stringify(storeData.bookings));
    if (Array.isArray(storeData.messages)) {
      localStorage.setItem('local_messages', JSON.stringify(storeData.messages));
      localStorage.setItem('contact_messages', JSON.stringify(storeData.messages));
    }
    if (Array.isArray(storeData.adminProfiles)) localStorage.setItem('admin_profiles', JSON.stringify(storeData.adminProfiles));
  } catch (e) {
    console.warn('Error writing local master_cloud_cache:', e);
  }

  try {
    await axios.put(PRIMARY_BIN_URL, storeData, {
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      timeout: 3000
    });
  } catch (err) {
    console.warn('Master cloud store save notice:', err);
  }
}

// ---------------- BOOKINGS ----------------
export async function fetchCloudBookings() {
  const store = await fetchMasterStore();
  return (store.bookings || []).filter(b => b && typeof b === 'object' && (b.id || b.customer_name || b.vehicle_number) && b.id !== 101 && b.vehicle_number !== 'GJ15BC6732' && !String(b.customer_name).includes('Prit Patel'));
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
  
  const isMatch = (j) => String(j.id) === String(newJob.id) ||
    (j.vehicle_number && newJob.vehicle_number && j.vehicle_number === newJob.vehicle_number && (j.created_at === newJob.created_at || j.status === 'IN_PROGRESS'));

  const exists = existing.some(isMatch);
  let updated = existing;
  if (!exists) {
    updated = [newJob, ...existing];
  } else {
    updated = existing.map(j => isMatch(j) ? { ...j, ...newJob } : j);
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
  const strId = String(jobId);

  // 1. Remove from workshop_jobs
  const localJobs = JSON.parse(localStorage.getItem('workshop_jobs') || '[]');
  const updatedLocal = localJobs.filter(j => j && String(j.id) !== strId);
  localStorage.setItem('workshop_jobs', JSON.stringify(updatedLocal));

  // 2. Mark deleted in deletedIds
  await markIdAsDeleted(jobId).catch(console.warn);

  // 3. Remove from master_cloud_cache store.jobs
  const store = await fetchMasterStore();
  const existing = (store.jobs || []).filter(j => j && typeof j === 'object');
  const updated = existing.filter(j => j && String(j.id) !== strId);
  await saveMasterStore({ ...store, jobs: updated });
}

export async function deleteCloudBooking(bookingId) {
  if (!bookingId) return;
  const strId = String(bookingId);

  // 1. Remove from local_bookings
  try {
    const localBookings = JSON.parse(localStorage.getItem('local_bookings') || '[]');
    const updatedLocal = localBookings.filter(b => b && String(b.id) !== strId && b.vehicle_number !== 'GJ15BC6732' && b.id !== 101);
    localStorage.setItem('local_bookings', JSON.stringify(updatedLocal));
  } catch (e) {}

  // 2. Mark deleted in deletedIds array
  await markIdAsDeleted(bookingId).catch(console.warn);

  // 3. Remove from master_cloud_cache store.bookings
  const store = await fetchMasterStore();
  const existing = (store.bookings || []).filter(b => b && typeof b === 'object');
  const updated = existing.filter(b => b && b.id !== bookingId && String(b.id) !== strId && b.vehicle_number !== 'GJ15BC6732' && b.id !== 101);
  await saveMasterStore({ ...store, bookings: updated });
}

export async function deleteCloudMessage(msgId) {
  if (!msgId) return;
  const strId = String(msgId);

  // 1. Remove from local_messages
  const localMsgs = JSON.parse(localStorage.getItem('local_messages') || '[]');
  const updatedLocal = localMsgs.filter(m => m && String(m.id) !== strId);
  localStorage.setItem('local_messages', JSON.stringify(updatedLocal));

  // 2. Mark deleted in deletedIds
  await markIdAsDeleted(msgId).catch(console.warn);

  // 3. Remove from master_cloud_cache store.messages
  const store = await fetchMasterStore();
  const existing = (store.messages || []).filter(m => m && typeof m === 'object');
  const updated = existing.filter(m => m && String(m.id) !== strId);
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

  // 1. Update local inventory_items
  const localInv = JSON.parse(localStorage.getItem('inventory_items') || '[]');
  const existsLocal = localInv.some(i => String(i.id) === String(newItem.id));
  let updatedLocal = localInv;
  if (!existsLocal) {
    updatedLocal = [newItem, ...localInv];
  } else {
    updatedLocal = localInv.map(i => String(i.id) === String(newItem.id) ? { ...i, ...newItem } : i);
  }
  localStorage.setItem('inventory_items', JSON.stringify(updatedLocal));

  // 2. Save to master_cloud_cache
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

  // 1. Remove from local recycle_bin_items
  const localTrash = JSON.parse(localStorage.getItem('recycle_bin_items') || '[]');
  const updatedLocalTrash = localTrash.filter(r => r.id !== itemId && String(r.id) !== String(itemId));
  localStorage.setItem('recycle_bin_items', JSON.stringify(updatedLocalTrash));

  // 2. Remove from master_cloud_cache store.recycleBin
  const store = await fetchMasterStore();
  const existing = (store.recycleBin || []).filter(r => r && typeof r === 'object');
  const target = existing.find(r => r.id === itemId || String(r.id) === String(itemId));
  const updatedCloudTrash = existing.filter(r => r.id !== itemId && String(r.id) !== String(itemId));
  
  let updatedInvs = store.invoices || [];
  let updatedJobs = store.jobs || [];
  let updatedKhata = store.khataEntries || [];
  let updatedInventory = store.inventory || [];
  let updatedCustomers = store.customers || [];
  let updatedBookings = store.bookings || [];
  let updatedMessages = store.messages || [];

  if (target && target.payload) {
    const payloadId = String(target.payload.id || '');
    if (target.item_type === 'Billing Invoice') {
      updatedInvs = [target.payload, ...updatedInvs.filter(i => String(i.id) !== payloadId)];
    } else if (target.item_type === 'Workshop Job') {
      updatedJobs = [target.payload, ...updatedJobs.filter(j => String(j.id) !== payloadId)];
    } else if (target.item_type === 'Khata Account') {
      updatedKhata = [target.payload, ...updatedKhata.filter(k => String(k.id) !== payloadId)];
    } else if (target.item_type === 'Inventory') {
      updatedInventory = [target.payload, ...updatedInventory.filter(i => String(i.id) !== payloadId)];
    } else if (target.item_type === 'Customer Record') {
      updatedCustomers = [target.payload, ...updatedCustomers.filter(c => String(c.id) !== payloadId)];
    } else if (target.item_type === 'Online Booking') {
      updatedBookings = [target.payload, ...updatedBookings.filter(b => String(b.id) !== payloadId)];
    } else if (target.item_type === 'Contact Inquiry / Message') {
      updatedMessages = [target.payload, ...updatedMessages.filter(m => String(m.id) !== payloadId)];
    }
  }

  await saveMasterStore({
    ...store,
    recycleBin: updatedCloudTrash,
    invoices: updatedInvs,
    jobs: updatedJobs,
    khataEntries: updatedKhata,
    inventory: updatedInventory,
    customers: updatedCustomers,
    bookings: updatedBookings,
    messages: updatedMessages
  });
}

export async function emptyCloudRecycleBin() {
  localStorage.setItem('recycle_bin_items', '[]');
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
  const localAdmins = (() => {
    try {
      return JSON.parse(localStorage.getItem('admin_profiles') || '[]');
    } catch (e) {
      return [];
    }
  })();

  let cloudList = [];
  try {
    const res = await axios.get(PRIMARY_BIN_URL + '?t=' + Date.now(), {
      headers: { 'Accept': 'application/json', 'Cache-Control': 'no-cache' },
      timeout: 3000
    });
    if (res.data && Array.isArray(res.data.adminProfiles)) {
      cloudList = res.data.adminProfiles.filter(a => a && typeof a === 'object' && (a.id || a.username || a.user_name));
    }
  } catch (err) {
    console.warn('Direct cloud fetch notice for adminProfiles:', err);
  }

  const allAdminsMap = new Map();

  cloudList.forEach(a => { 
    const key = (a.username || a.user_name || a.phone || a.id || '').toLowerCase();
    if (key) allAdminsMap.set(key, a); 
  });
  localAdmins.forEach(a => { 
    const key = (a.username || a.user_name || a.phone || a.id || '').toLowerCase();
    if (key && !allAdminsMap.has(key)) allAdminsMap.set(key, a); 
  });

  const finalAdmins = Array.from(allAdminsMap.values());
  return finalAdmins;
}

export async function pushCloudAdminProfile(adminObj) {
  if (!adminObj || typeof adminObj !== 'object') return;
  const store = await fetchMasterStore();
  const existing = (store.adminProfiles || []).filter(a => a && typeof a === 'object');
  const exists = existing.some(a => a.id === adminObj.id || (a.username && adminObj.username && a.username.toLowerCase() === adminObj.username.toLowerCase()));
  
  let updated = existing;
  if (!exists) {
    updated = [adminObj, ...existing];
  } else {
    updated = existing.map(a => (a.id === adminObj.id || (a.username && adminObj.username && a.username.toLowerCase() === adminObj.username.toLowerCase())) ? { ...a, ...adminObj } : a);
  }
  await saveMasterStore({ ...store, adminProfiles: updated });
}

export async function deleteCloudAdminProfile(adminId) {
  if (!adminId) return;
  const store = await fetchMasterStore();
  const existing = (store.adminProfiles || []).filter(a => a && typeof a === 'object');
  const updated = existing.filter(a => a.id !== adminId && String(a.id) !== String(adminId) && a.username !== adminId);
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
  const strId = String(custId);
  const cleanVeh = strId.replace(/[^A-Za-z0-9]/g, '').toUpperCase();

  // 1. Remove from local_customers
  const localCusts = JSON.parse(localStorage.getItem('local_customers') || '[]');
  const updatedLocal = localCusts.filter(c => {
    if (!c) return false;
    const cVeh = (c.vehicle_number || '').replace(/[^A-Za-z0-9]/g, '').toUpperCase();
    return String(c.id) !== strId && cVeh !== cleanVeh;
  });
  localStorage.setItem('local_customers', JSON.stringify(updatedLocal));

  // 2. Remove from master_cloud_cache store.customers
  const store = await fetchMasterStore();
  const existing = (store.customers || []).filter(c => c && typeof c === 'object');
  const updated = existing.filter(c => {
    const cVeh = (c.vehicle_number || '').replace(/[^A-Za-z0-9]/g, '').toUpperCase();
    return String(c.id) !== strId && cVeh !== cleanVeh;
  });
  await saveMasterStore({ ...store, customers: updated });
}

// ---------------- ATTENDANCE & SALARY PAYMENTS ----------------
export async function fetchCloudAttendance() {
  const store = await fetchMasterStore();
  return (store.attendance || []).filter(a => a && typeof a === 'object' && (a.id || a.mechanic_name));
}

export async function pushCloudAttendanceRecord(attObj) {
  if (!attObj || typeof attObj !== 'object') return;
  const strId = String(attObj.id || '');
  const attKey = `${(attObj.mechanic_name || '').trim()}_${attObj.date}`;

  // 1. Update local_attendance
  const localAtt = JSON.parse(localStorage.getItem('local_attendance') || '[]');
  const filteredLocal = localAtt.filter(a => a && String(a.id) !== strId && `${(a.mechanic_name || '').trim()}_${a.date}` !== attKey);
  localStorage.setItem('local_attendance', JSON.stringify([attObj, ...filteredLocal]));

  // 2. Update master_cloud_cache store.attendance
  const store = await fetchMasterStore();
  const existing = (store.attendance || []).filter(a => a && typeof a === 'object');
  const filteredCloud = existing.filter(a => a && String(a.id) !== strId && `${(a.mechanic_name || '').trim()}_${a.date}` !== attKey);
  const updated = [attObj, ...filteredCloud];
  await saveMasterStore({ ...store, attendance: updated });
}

export async function deleteCloudAttendanceRecord(attId) {
  if (!attId) return;
  const strId = String(attId);

  // 1. Remove from local_attendance
  const localAtt = JSON.parse(localStorage.getItem('local_attendance') || '[]');
  const updatedLocal = localAtt.filter(a => a && String(a.id) !== strId);
  localStorage.setItem('local_attendance', JSON.stringify(updatedLocal));

  // 2. Mark deleted in deletedIds
  await markIdAsDeleted(attId).catch(console.warn);

  // 3. Remove from master_cloud_cache store.attendance
  const store = await fetchMasterStore();
  const existing = (store.attendance || []).filter(a => a && typeof a === 'object');
  const updated = existing.filter(a => a && String(a.id) !== strId);
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

export async function getCleanDeletedIds() {
  const cloudDeleted = await fetchCloudDeletedIds().catch(() => []);
  const localDeleted = JSON.parse(localStorage.getItem('deleted_item_ids') || '[]');
  const recycleItems = JSON.parse(localStorage.getItem('recycle_bin_items') || '[]');
  
  const allSet = new Set([...cloudDeleted, ...localDeleted]);
  recycleItems.forEach(item => {
    if (item && typeof item === 'object') {
      if (item.id) allSet.add(String(item.id));
      if (item.payload && typeof item.payload === 'object') {
        if (item.payload.id) allSet.add(String(item.payload.id));
        if (item.payload.invoice_number) allSet.add(String(item.payload.invoice_number));
        if (item.payload.job_id) allSet.add(String(item.payload.job_id));
      }
    }
  });
  return Array.from(allSet);
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
