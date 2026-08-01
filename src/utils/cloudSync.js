import axios from 'axios';

// Primary & Backup Master Cloud Storage Endpoints
const PRIMARY_BIN_URL = 'https://api.npoint.io/87b4fa8d9e2a4a754b2a';
const BACKUP_BIN_URL = 'https://api.restful-api.dev/objects/ff8081819f7e10ae019fbcb185ca5b9e';

async function fetchMasterStore() {
  try {
    const res = await axios.get(PRIMARY_BIN_URL, { timeout: 2000 });
    if (res.data) {
      return {
        bookings: Array.isArray(res.data.bookings) ? res.data.bookings : [],
        messages: Array.isArray(res.data.messages) ? res.data.messages : [],
        jobs: Array.isArray(res.data.jobs) ? res.data.jobs : [],
        inventory: Array.isArray(res.data.inventory) ? res.data.inventory : [],
        recycleBin: Array.isArray(res.data.recycleBin) ? res.data.recycleBin : [],
        garageInfo: res.data.garageInfo || null
      };
    }
  } catch (e1) {
    // Attempt Backup endpoint silently
    try {
      const res = await axios.get(BACKUP_BIN_URL, { timeout: 1500 });
      if (res.data && res.data.data) {
        return {
          bookings: Array.isArray(res.data.data.bookings) ? res.data.data.bookings : [],
          messages: Array.isArray(res.data.data.messages) ? res.data.data.messages : [],
          jobs: Array.isArray(res.data.data.jobs) ? res.data.data.jobs : [],
          inventory: Array.isArray(res.data.data.inventory) ? res.data.data.inventory : [],
          recycleBin: Array.isArray(res.data.data.recycleBin) ? res.data.data.recycleBin : [],
          garageInfo: res.data.data.garageInfo || null
        };
      }
    } catch (e2) {
      // Offline or cloud endpoint down, return empty store without spamming console
    }
  }
  return { bookings: [], messages: [], jobs: [], inventory: [], recycleBin: [], garageInfo: null };
}

async function saveMasterStore(storeData) {
  try {
    await axios.post(PRIMARY_BIN_URL, storeData, { timeout: 2500 });
  } catch (err) {
    try {
      await axios.put(BACKUP_BIN_URL, { name: 'PatelAutomobilesMasterBin', data: storeData }, { timeout: 2000 });
    } catch (e2) {
      // Saved locally in caller
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

export async function updateCloudBookingStatus(bookingId, newStatus) {
  if (!bookingId) return;
  const store = await fetchMasterStore();
  const existing = (store.bookings || []).filter(b => b && typeof b === 'object');
  const updatedBookings = existing.map(b => {
    if (b.id === bookingId || String(b.id) === String(bookingId)) {
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
