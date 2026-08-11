import axios from 'axios';

const DEFAULT_PRIMARY_BIN_URL = 'https://jsonblob.com/api/jsonBlob/019fea29-8149-759d-ad03-0c9b267e07b2';

function getActiveBinUrl() {
  try {
    return localStorage.getItem('primary_cloud_bin_url') || DEFAULT_PRIMARY_BIN_URL;
  } catch (e) {
    return DEFAULT_PRIMARY_BIN_URL;
  }
}

async function createFreshCloudBin(initialData) {
  try {
    const res = await axios.post('https://jsonblob.com/api/jsonBlob', initialData, {
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      timeout: 4000
    });
    const location = res.headers['location'] || res.headers['Location'];
    if (location) {
      const fullUrl = location.startsWith('http') ? location : `https://jsonblob.com${location}`;
      localStorage.setItem('primary_cloud_bin_url', fullUrl);
      console.log('✨ Auto-healed & created fresh cloud bin:', fullUrl);
      return fullUrl;
    }
  } catch (err) {
    console.warn('Failed to auto-create fresh cloud bin:', err);
  }
  return null;
}

export const DEFAULT_PRIMARY_ADMIN = {
  id: 'admin_patel_master',
  username: 'patelautomobile',
  user_name: 'Ravi Patel',
  name: 'Ravi Patel',
  role: 'Super Admin',
  email: 'patelautomobile6732@gmail.com',
  phone: '+91 81403 71414',
  mobile_number: '8140371414',
  garage_name: 'Patel Automobiles',
  password: '@ravipatel2005',
  profile_photo: '/logo.png',
  created_at: '2026-08-01T00:00:00Z'
};

let _lastMasterFetchTime = 0;
let _cachedMasterStore = null;
let _masterFetchPromise = null;

export async function fetchMasterStore(forceFresh = false) {
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

  // 1. Return in-memory cache instantly (0ms) if fetched recently
  if (!forceFresh && _cachedMasterStore && (Date.now() - _lastMasterFetchTime < 3000)) {
    return _cachedMasterStore;
  }

  // 2. Reuse pending network promise to avoid duplicate concurrent calls
  if (_masterFetchPromise && !forceFresh) {
    return _masterFetchPromise;
  }

  _masterFetchPromise = (async () => {
    let freshStore = null;
    let activeUrl = getActiveBinUrl();

    try {
      const res = await axios.get(activeUrl + '?t=' + Date.now(), {
        headers: { 'Accept': 'application/json', 'Cache-Control': 'no-cache' },
        timeout: 2000
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
      if (e1?.response?.status === 404) {
        console.warn('Cloud bin expired (404), triggering auto-recovery...');
        const newUrl = await createFreshCloudBin(localCache);
        if (newUrl) {
          freshStore = localCache;
        }
      }
    }

    if (freshStore) {
      const curLocalJobs = JSON.parse(localStorage.getItem('workshop_jobs') || '[]');
      const localJobMap = new Map();
      curLocalJobs.forEach(j => {
        if (j && j.id) localJobMap.set(String(j.id), j);
      });

      const mergedJobs = (freshStore.jobs || []).map(cloudJob => {
        if (!cloudJob || !cloudJob.id) return cloudJob;
        const localJob = localJobMap.get(String(cloudJob.id));
        if (localJob) {
          const localParts = Array.isArray(localJob.parts) ? localJob.parts : [];
          const cloudParts = Array.isArray(cloudJob.parts) ? cloudJob.parts : [];
          const finalParts = localParts.length >= cloudParts.length ? localParts : cloudParts;
          const finalPartsTotal = finalParts.reduce((acc, p) => acc + parseFloat(p.staged_total || (parseFloat(p.price || p.unit_price || 0) * parseInt(p.quantity || 1, 10))), 0);
          return {
            ...localJob,
            ...cloudJob,
            parts: finalParts,
            parts_total: finalPartsTotal,
            live_total: finalPartsTotal + parseFloat(cloudJob.labour_charge || localJob.labour_charge || 0)
          };
        }
        return cloudJob;
      });

      curLocalJobs.forEach(localJob => {
        if (localJob && localJob.id && !mergedJobs.some(j => String(j.id) === String(localJob.id))) {
          mergedJobs.push(localJob);
        }
      });

      const mergedStore = {
        bookings: freshStore.bookings,
        messages: freshStore.messages,
        jobs: mergedJobs,
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
        if (Array.isArray(mergedStore.recycleBin)) localStorage.setItem('recycle_bin_items', JSON.stringify(mergedStore.recycleBin));
        if (Array.isArray(mergedStore.deletedIds)) {
          localStorage.setItem('deleted_item_ids', JSON.stringify(mergedStore.deletedIds));
          localStorage.setItem('deleted_ids', JSON.stringify(mergedStore.deletedIds));
        }
        if (Array.isArray(mergedStore.khataEntries)) localStorage.setItem('khata_entries', JSON.stringify(mergedStore.khataEntries));
        if (Array.isArray(mergedStore.bookings)) localStorage.setItem('local_bookings', JSON.stringify(mergedStore.bookings));
        if (Array.isArray(mergedStore.messages)) {
          localStorage.setItem('local_messages', JSON.stringify(mergedStore.messages));
          localStorage.setItem('contact_messages', JSON.stringify(mergedStore.messages));
        }
        if (Array.isArray(mergedStore.adminProfiles)) localStorage.setItem('admin_profiles', JSON.stringify(mergedStore.adminProfiles));
        if (Array.isArray(mergedStore.customers)) localStorage.setItem('local_customers', JSON.stringify(mergedStore.customers));
        if (Array.isArray(mergedStore.inventory)) {
          localStorage.setItem('inventory_items', JSON.stringify(mergedStore.inventory));
          localStorage.setItem('spare_parts', JSON.stringify(mergedStore.inventory));
        }
        window.dispatchEvent(new Event('storage'));
        window.dispatchEvent(new Event('master_store_updated'));
      } catch (e) {
        console.warn('Failed to update local master_cloud_cache:', e);
      }
      _lastMasterFetchTime = Date.now();
      _cachedMasterStore = mergedStore;
      _masterFetchPromise = null;
      return mergedStore;
    }

    _lastMasterFetchTime = Date.now();
    _cachedMasterStore = localCache;
    _masterFetchPromise = null;
    return localCache;
  })();

  return _masterFetchPromise;
}

async function saveMasterStore(storeData) {
  try {
    const curLocalJobs = JSON.parse(localStorage.getItem('workshop_jobs') || '[]');
    const localJobMap = new Map();
    curLocalJobs.forEach(j => {
      if (j && j.id) localJobMap.set(String(j.id), j);
    });

    const mergedJobs = (storeData.jobs || []).map(cloudJob => {
      if (!cloudJob || !cloudJob.id) return cloudJob;
      const localJob = localJobMap.get(String(cloudJob.id));
      if (localJob) {
        const localParts = Array.isArray(localJob.parts) ? localJob.parts : [];
        const cloudParts = Array.isArray(cloudJob.parts) ? cloudJob.parts : [];
        const finalParts = localParts.length >= cloudParts.length ? localParts : cloudParts;
        const finalPartsTotal = finalParts.reduce((acc, p) => acc + parseFloat(p.staged_total || (parseFloat(p.price || p.unit_price || 0) * parseInt(p.quantity || 1, 10))), 0);
        return {
          ...cloudJob,
          ...localJob,
          parts: finalParts,
          parts_total: finalPartsTotal,
          live_total: finalPartsTotal + parseFloat(localJob.labour_charge || cloudJob.labour_charge || 0)
        };
      }
      return cloudJob;
    });

    curLocalJobs.forEach(localJob => {
      if (localJob && localJob.id && !mergedJobs.some(j => String(j.id) === String(localJob.id))) {
        mergedJobs.push(localJob);
      }
    });

    storeData.jobs = mergedJobs;

    const curLocalInv = JSON.parse(localStorage.getItem('inventory_items') || localStorage.getItem('spare_parts') || '[]');
    let resolvedInv = storeData.inventory || curLocalInv;
    
    if (curLocalInv.length > 0) {
      const localDeleted = JSON.parse(localStorage.getItem('deleted_ids') || '[]');
      const cloudDeleted = Array.isArray(storeData.deletedIds) ? storeData.deletedIds : [];
      const allDeleted = Array.from(new Set([...localDeleted, ...cloudDeleted]));

      const recMap = new Map();
      [...(storeData.inventory || []), ...curLocalInv].forEach(item => {
        if (item && (item.id || item.part_name || item.name)) {
          const rawId = String(item.id || `inv_${String(item.part_name || item.name).toLowerCase().replace(/[^a-z0-9]/g, '')}`);
          const rawName = String(item.part_name || item.name || '').trim();
          const normName = rawName.toLowerCase().replace(/[^a-z0-9]/g, '');

          if (!allDeleted.includes(rawId) && !allDeleted.includes(rawName) && !allDeleted.includes(normName)) {
            const parsedStock = parseInt(item.current_stock !== undefined ? item.current_stock : 0, 10);
            const cleanObj = {
              ...item,
              id: rawId,
              part_name: rawName || 'Spare Part',
              current_stock: parsedStock,
              min_stock_alert: item.min_stock_alert !== undefined ? parseInt(item.min_stock_alert, 10) : 2,
              price: parseFloat(item.price || 0)
            };
            const existing = recMap.get(rawId);
            if (!existing) {
              recMap.set(rawId, cleanObj);
            } else {
              if (parsedStock < existing.current_stock) {
                recMap.set(rawId, { ...existing, ...cleanObj, current_stock: parsedStock });
              } else if (cleanObj.price !== existing.price || cleanObj.min_stock_alert !== existing.min_stock_alert) {
                recMap.set(rawId, { ...existing, ...cleanObj });
              }
            }
          }
        }
      });
      resolvedInv = Array.from(recMap.values());
    }

    storeData.inventory = resolvedInv;
    localStorage.setItem('master_cloud_cache', JSON.stringify(storeData));
    if (storeData.garageInfo) {
      localStorage.setItem('garage_info', JSON.stringify(storeData.garageInfo));
    }
    if (Array.isArray(storeData.jobs)) localStorage.setItem('workshop_jobs', JSON.stringify(storeData.jobs));
    if (Array.isArray(storeData.invoices)) localStorage.setItem('local_invoices', JSON.stringify(storeData.invoices));
    if (Array.isArray(storeData.khataEntries)) localStorage.setItem('khata_entries', JSON.stringify(storeData.khataEntries));
    if (Array.isArray(storeData.customers)) localStorage.setItem('local_customers', JSON.stringify(storeData.customers));
    if (Array.isArray(resolvedInv)) {
      localStorage.setItem('inventory_items', JSON.stringify(resolvedInv));
      localStorage.setItem('spare_parts', JSON.stringify(resolvedInv));
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

  let activeUrl = getActiveBinUrl();
  try {
    await axios.put(activeUrl, storeData, {
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      timeout: 3000
    });
  } catch (err) {
    if (err?.response?.status === 404) {
      console.warn('Cloud bin 404, creating fresh recovery bin...');
      await createFreshCloudBin(storeData);
    } else {
      console.warn('Cloud store update warning:', err);
    }
  }

  try {
    axios.post('/api/sync', storeData, { timeout: 4000 }).catch(() => {});
  } catch (e) {}
}

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

  const newId = String(newItem.id || '');
  const rawName = String(newItem.part_name || newItem.name || '').trim();
  const newName = rawName.toLowerCase();
  const newNorm = newName.replace(/[^a-z0-9]/g, '');
  const stampedItem = {
    ...newItem,
    updated_at: newItem.updated_at || new Date().toISOString()
  };

  // 1. Update local inventory_items & spare_parts
  const localInv = JSON.parse(localStorage.getItem('inventory_items') || localStorage.getItem('spare_parts') || '[]');
  const isMatchItem = (i) => {
    if (!i) return false;
    const curId = String(i.id || '');
    const curRaw = String(i.part_name || i.name || '').trim();
    const curName = curRaw.toLowerCase();
    const curNorm = curName.replace(/[^a-z0-9]/g, '');
    return (newId && curId && newId === curId) || (newNorm && curNorm && newNorm === curNorm) || (newName && curName && newName === curName);
  };

  const existsLocal = localInv.some(isMatchItem);
  let updatedLocal = localInv;
  if (!existsLocal) {
    updatedLocal = [stampedItem, ...localInv];
  } else {
    updatedLocal = localInv.map(i => isMatchItem(i) ? { ...i, ...stampedItem } : i);
  }
  localStorage.setItem('inventory_items', JSON.stringify(updatedLocal));
  localStorage.setItem('spare_parts', JSON.stringify(updatedLocal));

  // 2. Save to master_cloud_cache
  const store = await fetchMasterStore();
  const existing = (store.inventory || []).filter(i => i && typeof i === 'object');
  const exists = existing.some(isMatchItem);
  let updated = existing;
  if (!exists) {
    updated = [stampedItem, ...existing];
  } else {
    updated = existing.map(i => isMatchItem(i) ? { ...i, ...stampedItem } : i);
  }
  await saveMasterStore({ ...store, inventory: updated });
}

export async function moveToRecycleBin(trashObj, inventoryItem) {
  if (!trashObj) return;
  const item = inventoryItem || trashObj.payload || {};
  const itId = String(item.id || '');
  const itName = String(item.part_name || item.name || trashObj.title || '').trim();
  const itNorm = itName.toLowerCase().replace(/[^a-z0-9]/g, '');

  // 1. Update local recycle bin
  const existingTrash = JSON.parse(localStorage.getItem('recycle_bin_items') || '[]');
  const updatedTrash = [trashObj, ...existingTrash];
  localStorage.setItem('recycle_bin_items', JSON.stringify(updatedTrash));

  // 2. Prepare deletion IDs
  const localDeleted = JSON.parse(localStorage.getItem('deleted_ids') || '[]');
  const newDeletedIds = Array.from(new Set([...localDeleted, itId, itName, itNorm].filter(Boolean)));
  localStorage.setItem('deleted_ids', JSON.stringify(newDeletedIds));

  // 3. Remove from local inventory
  const localInv = JSON.parse(localStorage.getItem('inventory_items') || localStorage.getItem('spare_parts') || '[]');
  const isMatchItem = (i) => {
    if (!i) return false;
    const curId = String(i.id || '');
    const curName = String(i.part_name || i.name || '').trim();
    const curNorm = curName.toLowerCase().replace(/[^a-z0-9]/g, '');
    return (itId && curId && itId === curId) || (itName && curName && itName.toLowerCase() === curName.toLowerCase()) || (itNorm && curNorm && itNorm === curNorm);
  };
  const updatedLocalInv = localInv.filter(i => !isMatchItem(i));
  localStorage.setItem('inventory_items', JSON.stringify(updatedLocalInv));
  localStorage.setItem('spare_parts', JSON.stringify(updatedLocalInv));

  // 4. ATOMIC SINGLE CLOUD UPDATE
  const store = await fetchMasterStore();
  const existingRecycle = (store.recycleBin || []).filter(r => r && typeof r === 'object');
  const existingInv = (store.inventory || []).filter(i => i && typeof i === 'object');
  const cloudDeleted = Array.isArray(store.deletedIds) ? store.deletedIds : [];

  const mergedDeleted = Array.from(new Set([...cloudDeleted, ...newDeletedIds]));
  const filteredInv = existingInv.filter(i => !isMatchItem(i));
  const mergedRecycle = [trashObj, ...existingRecycle];

  await saveMasterStore({
    ...store,
    inventory: filteredInv,
    recycleBin: mergedRecycle,
    deletedIds: mergedDeleted
  });
}

export async function deleteCloudInventoryItem(target) {
  if (!target) return;
  const targetId = typeof target === 'object' ? String(target.id || '') : String(target);
  const targetName = typeof target === 'object' ? String(target.part_name || target.name || '').toLowerCase().trim() : targetId.toLowerCase().trim();
  const targetNorm = targetName.replace(/[^a-z0-9]/g, '');

  // 1. Add to deletedIds (local & cloud)
  const localDeleted = JSON.parse(localStorage.getItem('deleted_ids') || '[]');
  const updatedDeleted = Array.from(new Set([...localDeleted, targetId, targetNorm, targetName].filter(Boolean)));
  localStorage.setItem('deleted_ids', JSON.stringify(updatedDeleted));

  // 2. Remove from local inventory_items & spare_parts
  const localInv = JSON.parse(localStorage.getItem('inventory_items') || localStorage.getItem('spare_parts') || '[]');
  const isMatchItem = (i) => {
    if (!i) return false;
    const curId = String(i.id || '');
    const curRaw = String(i.part_name || i.name || '').trim();
    const curName = curRaw.toLowerCase();
    const curNorm = curName.replace(/[^a-z0-9]/g, '');
    return (targetId && curId && targetId === curId) || (targetNorm && curNorm && targetNorm === curNorm) || (targetName && curName && targetName === curName);
  };
  const updatedLocal = localInv.filter(i => !isMatchItem(i));
  localStorage.setItem('inventory_items', JSON.stringify(updatedLocal));
  localStorage.setItem('spare_parts', JSON.stringify(updatedLocal));

  // 3. Remove from master_cloud_cache
  const store = await fetchMasterStore();
  const existing = (store.inventory || []).filter(i => i && typeof i === 'object');
  const updated = existing.filter(i => !isMatchItem(i));
  await saveMasterStore({ ...store, inventory: updated, deletedIds: Array.from(new Set([...(store.deletedIds || []), ...updatedDeleted])) });
}

// ---------------- RECYCLE BIN ----------------
export async function fetchCloudRecycleBin() {
  const store = await fetchMasterStore();
  return (store.recycleBin || []).filter(r => r && typeof r === 'object' && (r.id || r.item_type));
}

export async function deleteJobToRecycleBin(targetJob) {
  if (!targetJob || !targetJob.id) return;
  const strId = String(targetJob.id);
  const vehNum = String(targetJob.vehicle_number || '');

  const trashObj = {
    id: `trash_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
    item_type: 'Workshop Job',
    title: `Service Job: ${vehNum} (${targetJob.customer_name || 'Customer'})`,
    deleted_by: 'Patel Owner (Admin)',
    deleted_at: new Date().toISOString(),
    details: `Customer: ${targetJob.customer_name || 'Customer'} • Phone: ${targetJob.mobile_number || 'N/A'} • Model: ${targetJob.bike_model || 'Bike'} • Total: ₹${targetJob.live_total || targetJob.grand_total || 0}`,
    payload: targetJob
  };

  const localTrash = JSON.parse(localStorage.getItem('recycle_bin_items') || '[]');
  localStorage.setItem('recycle_bin_items', JSON.stringify([trashObj, ...localTrash.filter(r => String(r.id) !== trashObj.id)]));

  const localJobs = JSON.parse(localStorage.getItem('workshop_jobs') || '[]');
  localStorage.setItem('workshop_jobs', JSON.stringify(localJobs.filter(j => String(j.id) !== strId)));

  const localDeleted = JSON.parse(localStorage.getItem('deleted_ids') || '[]');
  localStorage.setItem('deleted_ids', JSON.stringify(Array.from(new Set([...localDeleted, strId]))));

  const store = await fetchMasterStore();
  const storeJobs = (store.jobs || []).filter(j => String(j.id) !== strId);
  const storeRecycle = [trashObj, ...(store.recycleBin || []).filter(r => String(r.id) !== trashObj.id)];
  const storeDeleted = Array.from(new Set([...(store.deletedIds || []).map(String), strId]));

  await saveMasterStore({
    ...store,
    jobs: storeJobs,
    recycleBin: storeRecycle,
    deletedIds: storeDeleted
  });

  window.dispatchEvent(new Event('storage'));
  window.dispatchEvent(new Event('master_store_updated'));
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
  const existingTrash = (store.recycleBin || []).filter(r => r && typeof r === 'object');
  const target = existingTrash.find(r => String(r.id) === String(itemId) || (r.payload && String(r.payload.id) === String(itemId)));
  const updatedCloudTrash = existingTrash.filter(r => String(r.id) !== String(itemId) && (!r.payload || String(r.payload.id) !== String(itemId)));

  const localTrash = JSON.parse(localStorage.getItem('recycle_bin_items') || '[]');
  localStorage.setItem('recycle_bin_items', JSON.stringify(localTrash.filter(r => String(r.id) !== String(itemId) && (!r.payload || String(r.payload.id) !== String(itemId)))));

  let updatedInvs = store.invoices || [];
  let updatedJobs = store.jobs || [];
  let updatedKhata = store.khataEntries || [];
  let updatedInventory = store.inventory || [];
  let updatedCustomers = store.customers || [];
  let updatedBookings = store.bookings || [];
  let updatedMessages = store.messages || [];

  if (target && target.payload) {
    const p = target.payload;
    const payloadId = String(p.id || '');
    const payloadNum = String(p.invoice_number || '');
    const payloadVeh = String(p.vehicle_number || '');
    const payloadPart = String(p.part_name || p.name || '');
    const payloadNorm = payloadPart.toLowerCase().replace(/[^a-z0-9]/g, '');

    const idsToRemove = new Set([payloadId, payloadNum, payloadVeh, payloadPart, payloadNorm].filter(Boolean));

    const localDeleted1 = JSON.parse(localStorage.getItem('deleted_item_ids') || '[]');
    const localDeleted2 = JSON.parse(localStorage.getItem('deleted_ids') || '[]');
    localStorage.setItem('deleted_item_ids', JSON.stringify(localDeleted1.filter(d => !idsToRemove.has(String(d)) && !idsToRemove.has(String(d).toLowerCase().replace(/[^a-z0-9]/g, '')))));
    localStorage.setItem('deleted_ids', JSON.stringify(localDeleted2.filter(d => !idsToRemove.has(String(d)) && !idsToRemove.has(String(d).toLowerCase().replace(/[^a-z0-9]/g, '')))));

    const type = (target.item_type || '').toLowerCase();
    if (type.includes('inventory') || type.includes('spare') || type.includes('part')) {
      const curInv = JSON.parse(localStorage.getItem('inventory_items') || localStorage.getItem('spare_parts') || '[]');
      const upInv = [p, ...curInv.filter(i => String(i.id) !== payloadId && String(i.part_name || i.name) !== payloadPart)];
      localStorage.setItem('inventory_items', JSON.stringify(upInv));
      localStorage.setItem('spare_parts', JSON.stringify(upInv));
      updatedInventory = [p, ...updatedInventory.filter(i => String(i.id) !== payloadId)];
    } else if (type.includes('workshop') || type.includes('job')) {
      const curJobs = JSON.parse(localStorage.getItem('workshop_jobs') || '[]');
      const upJobs = [p, ...curJobs.filter(j => String(j.id) !== payloadId)];
      localStorage.setItem('workshop_jobs', JSON.stringify(upJobs));
      updatedJobs = [p, ...updatedJobs.filter(j => String(j.id) !== payloadId)];
    } else if (type.includes('billing') || type.includes('invoice')) {
      const curInvs = JSON.parse(localStorage.getItem('local_invoices') || '[]');
      const upInvs = [p, ...curInvs.filter(i => String(i.id) !== payloadId)];
      localStorage.setItem('local_invoices', JSON.stringify(upInvs));
      updatedInvs = [p, ...updatedInvs.filter(i => String(i.id) !== payloadId)];
    } else if (type.includes('khata')) {
      const curKhata = JSON.parse(localStorage.getItem('khata_entries') || '[]');
      const upKhata = [p, ...curKhata.filter(k => String(k.id) !== payloadId)];
      localStorage.setItem('khata_entries', JSON.stringify(upKhata));
      updatedKhata = [p, ...updatedKhata.filter(k => String(k.id) !== payloadId)];
    } else if (type.includes('customer')) {
      const curCust = JSON.parse(localStorage.getItem('local_customers') || '[]');
      const upCust = [p, ...curCust.filter(c => String(c.id) !== payloadId)];
      localStorage.setItem('local_customers', JSON.stringify(upCust));
      updatedCustomers = [p, ...updatedCustomers.filter(c => String(c.id) !== payloadId)];
    } else if (type.includes('booking')) {
      const curBook = JSON.parse(localStorage.getItem('local_bookings') || '[]');
      const upBook = [p, ...curBook.filter(b => String(b.id) !== payloadId)];
      localStorage.setItem('local_bookings', JSON.stringify(upBook));
      updatedBookings = [p, ...updatedBookings.filter(b => String(b.id) !== payloadId)];
    } else if (type.includes('message')) {
      const curMsgs = JSON.parse(localStorage.getItem('local_messages') || '[]');
      const upMsgs = [p, ...curMsgs.filter(m => String(m.id) !== payloadId)];
      localStorage.setItem('local_messages', JSON.stringify(upMsgs));
      updatedMessages = [p, ...updatedMessages.filter(m => String(m.id) !== payloadId)];
    }

    const storeDeleted = (store.deletedIds || []).map(String).filter(d => !idsToRemove.has(d) && !idsToRemove.has(d.toLowerCase().replace(/[^a-z0-9]/g, '')));

    await saveMasterStore({
      ...store,
      recycleBin: updatedCloudTrash,
      deletedIds: storeDeleted,
      invoices: updatedInvs,
      jobs: updatedJobs,
      khataEntries: updatedKhata,
      inventory: updatedInventory,
      customers: updatedCustomers,
      bookings: updatedBookings,
      messages: updatedMessages
    });
  } else {
    await saveMasterStore({
      ...store,
      recycleBin: updatedCloudTrash
    });
  }

  window.dispatchEvent(new Event('storage'));
  window.dispatchEvent(new Event('master_store_updated'));
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
    updated = existing.map(a => {
      const isTarget = a.id === adminObj.id || (a.username && adminObj.username && a.username.toLowerCase() === adminObj.username.toLowerCase());
      if (isTarget) {
        const safePass = adminObj.password || a.password || '@ravipatel2005';
        return { ...a, ...adminObj, password: safePass };
      }
      return a;
    });
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

export async function atomicFinishWorkshopJob({ finishedJob, invoice, khataDebit, updatedInventory }) {
  // 1. Update local storage first (0ms instantaneous)
  if (finishedJob) {
    const curJobs = JSON.parse(localStorage.getItem('workshop_jobs') || '[]');
    const upJobs = [finishedJob, ...curJobs.filter(j => String(j.id) !== String(finishedJob.id))];
    localStorage.setItem('workshop_jobs', JSON.stringify(upJobs));
  }
  if (invoice) {
    const curInvs = JSON.parse(localStorage.getItem('local_invoices') || '[]');
    const upInvs = [invoice, ...curInvs.filter(i => String(i.id) !== String(invoice.id) && String(i.job_id) !== String(invoice.job_id))];
    localStorage.setItem('local_invoices', JSON.stringify(upInvs));
  }
  if (khataDebit) {
    const curKhata = JSON.parse(localStorage.getItem('khata_entries') || '[]');
    const upKhata = [khataDebit, ...curKhata.filter(k => String(k.id) !== String(khataDebit.id) && String(k.job_id) !== String(khataDebit.job_id))];
    localStorage.setItem('khata_entries', JSON.stringify(upKhata));
  }

  // 2. ATOMIC SINGLE CLOUD TRANSACTION
  const store = await fetchMasterStore();
  
  let storeJobs = (store.jobs || []).filter(j => j && typeof j === 'object');
  if (finishedJob) {
    storeJobs = [finishedJob, ...storeJobs.filter(j => String(j.id) !== String(finishedJob.id) && (j.vehicle_number !== finishedJob.vehicle_number || j.status !== 'IN_PROGRESS'))];
  }

  let storeInvs = (store.invoices || []).filter(i => i && typeof i === 'object');
  if (invoice) {
    storeInvs = [invoice, ...storeInvs.filter(i => String(i.id) !== String(invoice.id) && String(i.job_id) !== String(invoice.job_id))];
  }

  let storeKhata = (store.khataEntries || []).filter(k => k && typeof k === 'object');
  if (khataDebit) {
    storeKhata = [khataDebit, ...storeKhata.filter(k => String(k.id) !== String(khataDebit.id) && String(k.job_id) !== String(khataDebit.job_id))];
  }

  // Update matching bookings to COMPLETED
  let storeBookings = (store.bookings || []).filter(b => b && typeof b === 'object');
  if (finishedJob && finishedJob.vehicle_number) {
    const fVeh = String(finishedJob.vehicle_number).replace(/[^A-Za-z0-9]/g, '').toUpperCase();
    storeBookings = storeBookings.map(b => {
      const bVeh = String(b.vehicle_number || '').replace(/[^A-Za-z0-9]/g, '').toUpperCase();
      if (bVeh === fVeh) return { ...b, status: 'COMPLETED' };
      return b;
    });
  }

  await saveMasterStore({
    ...store,
    jobs: storeJobs,
    invoices: storeInvs,
    khataEntries: storeKhata,
    bookings: storeBookings,
    ...(updatedInventory ? { inventory: updatedInventory } : {})
  });
}

export async function atomicRecordPayment({ updatedInvoice, updatedJob, creditKhataEntry, paymentAmount, targetId, vehicleNumber }) {
  const store = await fetchMasterStore();
  const vNorm = (vehicleNumber || '').replace(/[^A-Za-z0-9]/g, '').toUpperCase();
  const numAmt = parseFloat(paymentAmount) || 0;

  // 1. Invoices
  let storeInvs = (store.invoices || []).map(inv => {
    if (!inv) return inv;
    const invId = String(inv.id || '');
    const invJobId = String(inv.job_id || '');
    const invVeh = (inv.vehicle_number || '').replace(/[^A-Za-z0-9]/g, '').toUpperCase();
    const isTarget = (invId === targetId || invJobId === targetId);
    const isMatchingPendingVeh = (vNorm && invVeh === vNorm && parseFloat(inv.pending_amount || 0) > 0);

    if (isTarget || isMatchingPendingVeh) {
      if (updatedInvoice && isTarget) return { ...inv, ...updatedInvoice };
      const curTotal = parseFloat(inv.grand_total || inv.total_amount || 0);
      const curPaid = Math.min(curTotal, parseFloat(inv.paid_amount || 0) + numAmt);
      const curPending = Math.max(0, curTotal - curPaid);
      return {
        ...inv,
        paid_amount: curPaid,
        pending_amount: curPending,
        payment_status: curPending === 0 ? 'PAID' : 'PARTIAL'
      };
    }
    return inv;
  });

  // 2. Jobs
  let storeJobs = (store.jobs || []).map(j => {
    if (!j) return j;
    const jId = String(j.id || '');
    const jVeh = (j.vehicle_number || '').replace(/[^A-Za-z0-9]/g, '').toUpperCase();
    const isTarget = (jId === targetId);
    const isMatchingPendingVeh = (vNorm && jVeh === vNorm && (j.status === 'FINISHED' || j.status === 'COMPLETED') && parseFloat(j.pending_amount || 0) > 0);

    if (isTarget || isMatchingPendingVeh) {
      if (updatedJob && isTarget) return { ...j, ...updatedJob };
      const curTotal = parseFloat(j.grand_total || j.live_total || 0);
      const curPaid = Math.min(curTotal, parseFloat(j.paid_amount || 0) + numAmt);
      const curPending = Math.max(0, curTotal - curPaid);
      return {
        ...j,
        paid_amount: curPaid,
        pending_amount: curPending,
        payment_status: curPending === 0 ? 'PAID' : 'PARTIAL'
      };
    }
    return j;
  });

  // 3. Khata Entries
  let storeKhata = (store.khataEntries || []).map(k => {
    if (!k) return k;
    const kId = String(k.id || '');
    const kJobId = String(k.job_id || '');
    const kVeh = (k.vehicle_number || '').replace(/[^A-Za-z0-9]/g, '').toUpperCase();
    if ((kId === targetId || kJobId === targetId || (vNorm && kVeh === vNorm && k.type === 'DEBIT'))) {
      const curAmt = parseFloat(k.amount || 0);
      const newAmt = Math.max(0, curAmt - numAmt);
      return { ...k, amount: newAmt };
    }
    return k;
  });

  if (creditKhataEntry) {
    storeKhata = [creditKhataEntry, ...storeKhata];
  }

  await saveMasterStore({
    ...store,
    invoices: storeInvs,
    jobs: storeJobs,
    khataEntries: storeKhata
  });
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

export async function deleteCloudInvoice(invId, invNumber = null) {
  if (!invId) return;
  const strId = String(invId);
  const rawId = strId.replace(/^inv_/, '').replace(/^job_/, '');
  const store = await fetchMasterStore();
  
  const isTarget = (i) => {
    if (!i) return false;
    const curId = String(i.id || '');
    const curRaw = curId.replace(/^inv_/, '').replace(/^job_/, '');
    const curNum = String(i.invoice_number || '');
    return curId === strId || curRaw === rawId || curNum === strId || (invNumber && curNum === String(invNumber));
  };

  const updatedInvs = (store.invoices || []).filter(i => !isTarget(i));
  const updatedJobs = (store.jobs || []).filter(j => {
    const jId = String(j.id || '');
    const jRaw = jId.replace(/^inv_/, '').replace(/^job_/, '');
    return jId !== strId && jRaw !== rawId;
  });

  const idsToMark = [strId, rawId, `inv_${rawId}`, `job_${rawId}`];
  if (invNumber) idsToMark.push(String(invNumber));
  const existingDeleted = (store.deletedIds || []).map(d => String(d));
  const updatedDeleted = Array.from(new Set([...existingDeleted, ...idsToMark]));

  await saveMasterStore({
    ...store,
    invoices: updatedInvs,
    jobs: updatedJobs,
    deletedIds: updatedDeleted
  });
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
