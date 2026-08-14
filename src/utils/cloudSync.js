import axios from 'axios';

const DEFAULT_PRIMARY_BIN_URL = '/api/public/master_store/';

function getActiveBinUrl() {
  return '/api/public/master_store/';
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
  password: '@patelautomobile1414',
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
          deletedIds: Array.isArray(parsed.deletedIds) ? parsed.deletedIds : [],
          counterSales: Array.isArray(parsed.counterSales) ? parsed.counterSales : [],
          counterKhata: Array.isArray(parsed.counterKhata) ? parsed.counterKhata : []
        };
      }
    } catch (e) {
      console.warn('Error reading local master_cloud_cache:', e);
    }
    return { bookings: [], messages: [], jobs: [], inventory: [], recycleBin: [], garageInfo: null, adminProfiles: [], khataEntries: [], customers: [], invoices: [], attendance: [], salaryPayments: [], deletedIds: [], counterSales: [], counterKhata: [] };
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
      const res = await axios.get('/api/public/master_store/?t=' + Date.now(), {
        headers: { 'Accept': 'application/json', 'Cache-Control': 'no-cache' },
        timeout: 2500
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
          deletedIds: Array.isArray(res.data.deletedIds) ? res.data.deletedIds : [],
          counterSales: Array.isArray(res.data.counterSales) ? res.data.counterSales : [],
          counterKhata: Array.isArray(res.data.counterKhata) ? res.data.counterKhata : [],
          activeCounterCart: res.data.activeCounterCart || null
        };
      }
    } catch (e1) {
      console.warn('Primary MongoDB Atlas GET notice, trying fallback bin:', e1);
    }

    if (freshStore) {
      const allDeleted = Array.from(new Set([
        ...(freshStore.deletedIds || []),
        ...JSON.parse(localStorage.getItem('deleted_ids') || '[]'),
        ...JSON.parse(localStorage.getItem('deleted_item_ids') || '[]')
      ])).map(String);

      const isCleanDeleted = (item) => {
        if (!item) return true;
        const id = String(item.id || '');
        const rawId = id.replace(/^(inv_|job_|khata_|booking_|cs_|ckhata_|trash_)+/gi, '').trim();
        const invNum = String(item.invoice_number || '');
        const jobId = String(item.job_id || '').replace(/^(inv_|job_|khata_|booking_|cs_|ckhata_|trash_)+/gi, '').trim();
        return allDeleted.some(d => {
          if (!d) return false;
          const dStr = String(d).trim();
          const dRaw = dStr.replace(/^(inv_|job_|khata_|booking_|cs_|ckhata_|trash_)+/gi, '').trim();
          return id === dStr || invNum === dStr || (rawId && dRaw && rawId === dRaw) || (jobId && dRaw && jobId === dRaw);
        });
      };

      const cleanJobs = (freshStore.jobs || []).filter(j => !isCleanDeleted(j));
      const cleanInvoices = (freshStore.invoices || []).filter(i => !isCleanDeleted(i));
      const cleanKhata = (freshStore.khataEntries || []).filter(k => !isCleanDeleted(k));
      const cleanSales = (freshStore.counterSales || []).filter(s => !isCleanDeleted(s));
      const cleanCounterKhata = (freshStore.counterKhata || []).filter(k => !isCleanDeleted(k));

      const mergedStore = {
        bookings: freshStore.bookings || [],
        messages: freshStore.messages || [],
        jobs: cleanJobs,
        inventory: freshStore.inventory || [],
        recycleBin: freshStore.recycleBin || [],
        garageInfo: freshStore.garageInfo || localCache.garageInfo,
        adminProfiles: freshStore.adminProfiles || [],
        khataEntries: cleanKhata,
        customers: freshStore.customers || [],
        invoices: cleanInvoices,
        attendance: freshStore.attendance || [],
        salaryPayments: freshStore.salaryPayments || [],
        deletedIds: allDeleted,
        counterSales: cleanSales,
        counterKhata: cleanCounterKhata,
        activeCounterCart: freshStore.activeCounterCart || null
      };
      try {
        localStorage.setItem('master_cloud_cache', JSON.stringify(mergedStore));

        localStorage.setItem('workshop_jobs', JSON.stringify(cleanJobs));
        localStorage.setItem('local_invoices', JSON.stringify(cleanInvoices));
        localStorage.setItem('recycle_bin_items', JSON.stringify(mergedStore.recycleBin));
        localStorage.setItem('deleted_item_ids', JSON.stringify(allDeleted));
        localStorage.setItem('deleted_ids', JSON.stringify(allDeleted));
        localStorage.setItem('khata_entries', JSON.stringify(cleanKhata));
        localStorage.setItem('local_bookings', JSON.stringify(mergedStore.bookings));
        localStorage.setItem('local_messages', JSON.stringify(mergedStore.messages));
        localStorage.setItem('contact_messages', JSON.stringify(mergedStore.messages));
        localStorage.setItem('admin_profiles', JSON.stringify(mergedStore.adminProfiles));
        localStorage.setItem('local_customers', JSON.stringify(mergedStore.customers));
        localStorage.setItem('local_counter_sales', JSON.stringify(cleanSales));
        localStorage.setItem('local_counter_khata', JSON.stringify(cleanCounterKhata));

        const curLocalInv = JSON.parse(localStorage.getItem('inventory_items') || localStorage.getItem('spare_parts') || localStorage.getItem('local_inventory') || '[]');
        const mergedInvMap = new Map();
        [...curLocalInv, ...(mergedStore.inventory || [])].forEach(i => {
          if (i && typeof i === 'object' && (i.id || i.part_name || i.item_name || i.name)) {
            const rawName = String(i.part_name || i.item_name || i.name || '').trim();
            const normKey = rawName.toLowerCase().replace(/[^a-z0-9]/g, '') || String(i.id || '').toLowerCase();
            if (normKey) {
              if (!mergedInvMap.has(normKey)) {
                mergedInvMap.set(normKey, { ...i, part_name: rawName, item_name: rawName, name: rawName });
              } else {
                const prev = mergedInvMap.get(normKey);
                const prevTime = new Date(prev.updated_at || 0).getTime();
                const curTime = new Date(i.updated_at || 0).getTime();
                const prevStock = parseInt(prev.current_stock !== undefined ? prev.current_stock : (prev.stock_quantity !== undefined ? prev.stock_quantity : (prev.quantity !== undefined ? prev.quantity : 10)), 10);
                const curStock = parseInt(i.current_stock !== undefined ? i.current_stock : (i.stock_quantity !== undefined ? i.stock_quantity : (i.quantity !== undefined ? i.quantity : 10)), 10);
                const resolvedStock = curTime > prevTime ? curStock : Math.min(prevStock, curStock);
                const preferred = curTime > prevTime ? i : prev;
                mergedInvMap.set(normKey, {
                  ...prev,
                  ...preferred,
                  current_stock: resolvedStock,
                  stock_quantity: resolvedStock,
                  quantity: resolvedStock,
                  part_name: rawName,
                  item_name: rawName,
                  name: rawName
                });
              }
            }
          }
        });
        const finalMergedInv = Array.from(mergedInvMap.values());
        localStorage.setItem('inventory_items', JSON.stringify(finalMergedInv));
        localStorage.setItem('spare_parts', JSON.stringify(finalMergedInv));
        localStorage.setItem('local_inventory', JSON.stringify(finalMergedInv));
        mergedStore.inventory = finalMergedInv;

        window.dispatchEvent(new Event('storage'));
        window.dispatchEvent(new Event('master_store_updated'));
        window.dispatchEvent(new Event('inventory_updated'));
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

export async function saveMasterStore(storeData) {
  try {
    const curCache = _cachedMasterStore || {};
    const localBookings = JSON.parse(localStorage.getItem('local_bookings') || '[]');
    const localMessages = JSON.parse(localStorage.getItem('local_messages') || localStorage.getItem('contact_messages') || '[]');
    const localJobs = JSON.parse(localStorage.getItem('workshop_jobs') || '[]');
    const localInv = JSON.parse(localStorage.getItem('inventory_items') || localStorage.getItem('spare_parts') || '[]');
    const localRecycle = JSON.parse(localStorage.getItem('recycle_bin_items') || '[]');
    const localKhata = JSON.parse(localStorage.getItem('khata_entries') || '[]');
    const localCust = JSON.parse(localStorage.getItem('local_customers') || '[]');
    const localInvList = JSON.parse(localStorage.getItem('local_invoices') || '[]');
    const allDeletedIds = Array.from(new Set([
      ...(storeData.deletedIds || []),
      ...(curCache.deletedIds || []),
      ...JSON.parse(localStorage.getItem('deleted_ids') || '[]'),
      ...JSON.parse(localStorage.getItem('deleted_item_ids') || '[]')
    ])).map(String);

    const isDeletedItem = (item) => {
      if (!item) return true;
      const id = String(item.id || '');
      const rawId = id.replace(/^(inv_|job_|khata_|booking_|cs_|ckhata_|trash_)+/gi, '').trim();
      const invNum = String(item.invoice_number || '');
      const jobId = String(item.job_id || '').replace(/^(inv_|job_|khata_|booking_|cs_|ckhata_|trash_)+/gi, '').trim();
      return allDeletedIds.some(d => {
        if (!d) return false;
        const dStr = String(d).trim();
        const dRaw = dStr.replace(/^(inv_|job_|khata_|booking_|cs_|ckhata_|trash_)+/gi, '').trim();
        return id === dStr || invNum === dStr || (rawId && dRaw && rawId === dRaw) || (jobId && dRaw && jobId === dRaw);
      });
    };

    const rawJobs = Array.isArray(storeData.jobs) ? storeData.jobs : (curCache.jobs || localJobs);
    const rawInvs = Array.isArray(storeData.invoices) ? storeData.invoices : (curCache.invoices || localInvList);
    const rawKhata = Array.isArray(storeData.khataEntries) ? storeData.khataEntries : (curCache.khataEntries || localKhata);
    const rawSales = Array.isArray(storeData.counterSales) ? storeData.counterSales : (curCache.counterSales || []);
    const rawCounterKhata = Array.isArray(storeData.counterKhata) ? storeData.counterKhata : (curCache.counterKhata || []);

    storeData = {
      ...storeData,
      bookings: Array.isArray(storeData.bookings) && storeData.bookings.length > 0 ? storeData.bookings : (Array.isArray(curCache.bookings) && curCache.bookings.length > 0 ? curCache.bookings : localBookings),
      messages: Array.isArray(storeData.messages) && storeData.messages.length > 0 ? storeData.messages : (Array.isArray(curCache.messages) && curCache.messages.length > 0 ? curCache.messages : localMessages),
      jobs: rawJobs.filter(j => !isDeletedItem(j)),
      inventory: Array.isArray(storeData.inventory) ? storeData.inventory : (curCache.inventory || localInv),
      recycleBin: Array.isArray(storeData.recycleBin) ? storeData.recycleBin : (curCache.recycleBin || localRecycle),
      garageInfo: storeData.garageInfo || curCache.garageInfo || JSON.parse(localStorage.getItem('garage_info') || 'null'),
      adminProfiles: storeData.adminProfiles || curCache.adminProfiles || JSON.parse(localStorage.getItem('admin_profiles') || '[]'),
      khataEntries: rawKhata.filter(k => !isDeletedItem(k)),
      customers: Array.isArray(storeData.customers) ? storeData.customers : (curCache.customers || localCust),
      invoices: rawInvs.filter(i => !isDeletedItem(i)),
      attendance: Array.isArray(storeData.attendance) ? storeData.attendance : (curCache.attendance || []),
      salaryPayments: Array.isArray(storeData.salaryPayments) ? storeData.salaryPayments : (curCache.salaryPayments || []),
      deletedIds: allDeletedIds,
      counterSales: rawSales.filter(s => !isDeletedItem(s)),
      counterKhata: rawCounterKhata.filter(k => !isDeletedItem(k)),
      activeCounterCart: storeData.activeCounterCart !== undefined ? storeData.activeCounterCart : (curCache.activeCounterCart || null)
    };

    _cachedMasterStore = storeData;
    _lastMasterFetchTime = Date.now();

    const curLocalJobs = JSON.parse(localStorage.getItem('workshop_jobs') || '[]');
    const localJobMap = new Map();
    curLocalJobs.forEach(j => {
      if (j && j.id) localJobMap.set(String(j.id), j);
    });

    const mergedJobs = (storeData.jobs || []).map(cloudJob => {
      if (!cloudJob || !cloudJob.id) return cloudJob;
      const localJob = localJobMap.get(String(cloudJob.id));
      if (localJob) {
        const prevTime = new Date(localJob.updated_at || localJob.created_at || 0).getTime();
        const curTime = new Date(cloudJob.updated_at || cloudJob.created_at || 0).getTime();
        const preferred = prevTime >= curTime ? localJob : cloudJob;
        return {
          ...cloudJob,
          ...preferred,
          parts: preferred.parts || [],
          parts_total: preferred.parts_total !== undefined ? preferred.parts_total : 0,
          live_total: preferred.live_total !== undefined ? preferred.live_total : 0
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

    const localDeleted = JSON.parse(localStorage.getItem('deleted_ids') || '[]');
    const cloudDeleted = Array.isArray(storeData.deletedIds) ? storeData.deletedIds : [];
    const allDeleted = Array.from(new Set([...localDeleted, ...cloudDeleted]));

    const cleanInv = (Array.isArray(storeData.inventory) ? storeData.inventory : []).filter(item => {
      if (!item || typeof item !== 'object') return false;
      const rawId = String(item.id || '').toLowerCase().trim();
      const rawName = String(item.part_name || item.item_name || item.name || '').trim().toLowerCase();
      const normName = rawName.replace(/[^a-z0-9]/g, '');
      return !allDeleted.some(d => {
        if (!d) return false;
        const dStr = String(d).toLowerCase().trim();
        const dNorm = dStr.replace(/[^a-z0-9]/g, '');
        return (rawId && dStr && rawId === dStr) || (rawName && dStr && rawName === dStr) || (normName && dNorm && normName === dNorm);
      });
    });

    storeData.inventory = cleanInv;
    storeData.deletedIds = allDeleted;

    localStorage.setItem('inventory_items', JSON.stringify(cleanInv));
    localStorage.setItem('spare_parts', JSON.stringify(cleanInv));
    localStorage.setItem('local_inventory', JSON.stringify(cleanInv));
    localStorage.setItem('master_cloud_cache', JSON.stringify(storeData));

    if (storeData.garageInfo) {
      localStorage.setItem('garage_info', JSON.stringify(storeData.garageInfo));
    }
    if (Array.isArray(storeData.jobs)) localStorage.setItem('workshop_jobs', JSON.stringify(storeData.jobs));
    if (Array.isArray(storeData.invoices)) localStorage.setItem('local_invoices', JSON.stringify(storeData.invoices));
    if (Array.isArray(storeData.khataEntries)) localStorage.setItem('khata_entries', JSON.stringify(storeData.khataEntries));
    if (Array.isArray(storeData.customers)) localStorage.setItem('local_customers', JSON.stringify(storeData.customers));
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
    await axios.post('/api/public/master_store/', storeData, {
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      timeout: 3000
    });
  } catch (err) {
    console.warn('Direct MongoDB Atlas store update notice:', err);
  }
}

export async function fetchCloudBookings() {
  const store = await fetchMasterStore();
  return (store.bookings || []).filter(b => b && typeof b === 'object' && (b.id || b.customer_name || b.vehicle_number));
}

export async function pushCloudBooking(newBooking) {
  if (!newBooking || typeof newBooking !== 'object') return;

  const strNewId = String(newBooking.id || '');

  const localBookings = JSON.parse(localStorage.getItem('local_bookings') || '[]');
  const updatedLocal = [newBooking, ...localBookings.filter(b => String(b.id || '') !== strNewId)];
  localStorage.setItem('local_bookings', JSON.stringify(updatedLocal));

  const store = await fetchMasterStore(true);
  const existing = (store.bookings || []).filter(b => b && typeof b === 'object');
  const exists = existing.some(b => String(b.id || '') === strNewId);

  let updatedBookings = existing;
  if (!exists) {
    const freshBooking = { ...newBooking, status: newBooking.status || 'PENDING' };
    updatedBookings = [freshBooking, ...existing];
  } else {
    updatedBookings = existing.map(b => 
      String(b.id || '') === strNewId ? { ...b, ...newBooking } : b
    );
  }

  await saveMasterStore({ ...store, bookings: updatedBookings });
  window.dispatchEvent(new Event('storage'));
  window.dispatchEvent(new Event('master_store_updated'));
}

export async function updateCloudBookingStatus(bookingId, newStatus) {
  if (!bookingId) return;
  const strId = String(bookingId);
  const store = await fetchMasterStore();
  const existing = (store.bookings || []).filter(b => b && typeof b === 'object');
  const updatedBookings = existing.map(b => {
    const bId = String(b.id || '');
    if (bId === strId) {
      return { ...b, status: newStatus };
    }
    return b;
  });
  await saveMasterStore({ ...store, bookings: updatedBookings });
  window.dispatchEvent(new Event('storage'));
  window.dispatchEvent(new Event('master_store_updated'));
}

// ---------------- MESSAGES (CONTACT INQUIRIES) ----------------
export async function fetchCloudMessages() {
  const store = await fetchMasterStore();
  return (store.messages || []).filter(m => m && typeof m === 'object' && (m.id || m.name || m.phone || m.message));
}

export async function pushCloudMessage(newMsg) {
  if (!newMsg || typeof newMsg !== 'object') return;

  const strNewId = String(newMsg.id || '');

  const localMsgs = JSON.parse(localStorage.getItem('local_messages') || localStorage.getItem('contact_messages') || '[]');
  const updatedLocal = [newMsg, ...localMsgs.filter(m => String(m.id || '') !== strNewId)];
  localStorage.setItem('local_messages', JSON.stringify(updatedLocal));
  localStorage.setItem('contact_messages', JSON.stringify(updatedLocal));

  const store = await fetchMasterStore(true);
  const existing = (store.messages || []).filter(m => m && typeof m === 'object');
  const exists = existing.some(m => String(m.id || '') === strNewId);
  
  let updated = existing;
  if (!exists) {
    updated = [newMsg, ...existing];
  } else {
    updated = existing.map(m => String(m.id || '') === strNewId ? { ...m, ...newMsg } : m);
  }

  await saveMasterStore({ ...store, messages: updated });
  window.dispatchEvent(new Event('storage'));
  window.dispatchEvent(new Event('master_store_updated'));
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
  const rawId = strId.replace(/^job_/, '').replace(/^inv_/, '');

  // 1. Remove from workshop_jobs
  const localJobs = JSON.parse(localStorage.getItem('workshop_jobs') || '[]');
  const updatedLocal = localJobs.filter(j => {
    if (!j) return false;
    const jId = String(j.id || '');
    const jRaw = jId.replace(/^job_/, '').replace(/^inv_/, '');
    return jId !== strId && jRaw !== rawId;
  });
  localStorage.setItem('workshop_jobs', JSON.stringify(updatedLocal));

  // 2. Mark deleted in deletedIds
  await markIdAsDeleted(jobId).catch(console.warn);
  if (rawId && rawId !== strId) await markIdAsDeleted(rawId).catch(console.warn);

  // 3. Remove from master_cloud_cache store.jobs
  const store = await fetchMasterStore();
  const existing = (store.jobs || []).filter(j => j && typeof j === 'object');
  const updated = existing.filter(j => {
    if (!j) return false;
    const jId = String(j.id || '');
    const jRaw = jId.replace(/^job_/, '').replace(/^inv_/, '');
    return jId !== strId && jRaw !== rawId;
  });
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
  return (store.inventory || []).filter(i => i && typeof i === 'object' && (i.id || i.part_name || i.item_name || i.name));
}

export async function pushCloudInventoryItem(newItem) {
  if (!newItem || typeof newItem !== 'object') return;
  const rawId = String(newItem.id || '').trim();
  const rawName = String(newItem.part_name || newItem.item_name || newItem.name || '').trim();
  const newName = rawName.toLowerCase();
  const newNorm = newName.replace(/[^a-z0-9]/g, '');
  const newId = rawId || `inv_${newNorm || Date.now()}`;

  const stockVal = parseInt(newItem.current_stock !== undefined ? newItem.current_stock : (newItem.stock_quantity !== undefined ? newItem.stock_quantity : (newItem.quantity !== undefined ? newItem.quantity : 0)), 10);
  const priceVal = parseFloat(newItem.price || newItem.selling_price || newItem.unit_price || 0);

  const stampedItem = {
    ...newItem,
    id: newId,
    part_name: rawName,
    item_name: rawName,
    name: rawName,
    current_stock: stockVal,
    stock_quantity: stockVal,
    quantity: stockVal,
    price: priceVal,
    unit_price: priceVal,
    selling_price: priceVal,
    updated_at: new Date().toISOString()
  };

  const isMatchItem = (i) => {
    if (!i) return false;
    const curId = String(i.id || '').trim();
    const curRaw = String(i.part_name || i.item_name || i.name || '').trim();
    const curName = curRaw.toLowerCase();
    const curNorm = curName.replace(/[^a-z0-9]/g, '');
    return (newId && curId && newId.toLowerCase() === curId.toLowerCase()) || 
           (newNorm && curNorm && newNorm === curNorm) || 
           (newName && curName && newName === curName);
  };

  // 1. Remove from all local and cloud deletion lists
  const isDeletedMatch = (d) => {
    if (!d) return false;
    const dStr = String(d).toLowerCase().trim();
    const dNorm = dStr.replace(/[^a-z0-9]/g, '');
    return dStr === newId.toLowerCase() || dStr === newName || (newNorm && dNorm && dNorm === newNorm);
  };

  const localDeleted = JSON.parse(localStorage.getItem('deleted_ids') || '[]');
  const localDeletedItems = JSON.parse(localStorage.getItem('deleted_item_ids') || '[]');
  const localTrash = JSON.parse(localStorage.getItem('recycle_bin_items') || '[]');

  const cleanedLocalDeleted = localDeleted.filter(d => !isDeletedMatch(d));
  const cleanedLocalDeletedItems = localDeletedItems.filter(d => !isDeletedMatch(d));
  const cleanedLocalTrash = localTrash.filter(t => !isDeletedMatch(t?.title) && !isDeletedMatch(t?.payload?.id) && !isDeletedMatch(t?.payload?.part_name));

  localStorage.setItem('deleted_ids', JSON.stringify(cleanedLocalDeleted));
  localStorage.setItem('deleted_item_ids', JSON.stringify(cleanedLocalDeletedItems));
  localStorage.setItem('recycle_bin_items', JSON.stringify(cleanedLocalTrash));

  // 2. Update local storages immediately
  const localInv = JSON.parse(localStorage.getItem('inventory_items') || localStorage.getItem('spare_parts') || localStorage.getItem('local_inventory') || '[]');
  const filteredLocal = localInv.filter(i => !isMatchItem(i));
  const updatedLocal = [stampedItem, ...filteredLocal];

  localStorage.setItem('inventory_items', JSON.stringify(updatedLocal));
  localStorage.setItem('spare_parts', JSON.stringify(updatedLocal));
  localStorage.setItem('local_inventory', JSON.stringify(updatedLocal));

  // 3. Save to master store and clear from cloud deletedIds
  const store = await fetchMasterStore(true);
  const cloudDeleted = Array.isArray(store.deletedIds) ? store.deletedIds : [];
  const cleanedCloudDeleted = cloudDeleted.filter(d => !isDeletedMatch(d));

  const existing = (store.inventory || []).filter(i => i && typeof i === 'object');
  const filteredCloud = existing.filter(i => !isMatchItem(i));
  const updatedCloud = [stampedItem, ...filteredCloud];

  await saveMasterStore({
    ...store,
    inventory: updatedCloud,
    deletedIds: cleanedCloudDeleted
  });

  try {
    window.dispatchEvent(new Event('storage'));
    window.dispatchEvent(new Event('master_store_updated'));
    window.dispatchEvent(new Event('inventory_updated'));
  } catch (e) {}

  return stampedItem;
}

export async function moveToRecycleBin(trashObj, inventoryItem) {
  if (!trashObj) return;
  const item = inventoryItem || trashObj.payload || {};
  const itId = String(item.id || '').trim();
  const itName = String(item.part_name || item.item_name || item.name || trashObj.title || '').trim();
  const itNorm = itName.toLowerCase().replace(/[^a-z0-9]/g, '');

  // 1. Update local recycle bin
  const existingTrash = JSON.parse(localStorage.getItem('recycle_bin_items') || '[]');
  const updatedTrash = [trashObj, ...existingTrash.filter(r => String(r.id) !== String(trashObj.id))];
  localStorage.setItem('recycle_bin_items', JSON.stringify(updatedTrash));

  // 2. Prepare deletion IDs (store ID, name, and norm name)
  const localDeleted = JSON.parse(localStorage.getItem('deleted_ids') || '[]');
  const newDeletedIds = Array.from(new Set([...localDeleted, itId, itName, itNorm].filter(Boolean)));
  localStorage.setItem('deleted_ids', JSON.stringify(newDeletedIds));

  // 3. Remove from local inventory storages
  const isMatchItem = (i) => {
    if (!i) return false;
    const curId = String(i.id || '').trim();
    const curName = String(i.part_name || i.item_name || i.name || '').trim();
    const curNorm = curName.toLowerCase().replace(/[^a-z0-9]/g, '');
    return (itId && curId && itId === curId) || 
           (itName && curName && itName.toLowerCase() === curName.toLowerCase()) || 
           (itNorm && curNorm && itNorm === curNorm);
  };

  const localInv = JSON.parse(localStorage.getItem('inventory_items') || localStorage.getItem('spare_parts') || localStorage.getItem('local_inventory') || '[]');
  const updatedLocalInv = localInv.filter(i => !isMatchItem(i));
  localStorage.setItem('inventory_items', JSON.stringify(updatedLocalInv));
  localStorage.setItem('spare_parts', JSON.stringify(updatedLocalInv));
  localStorage.setItem('local_inventory', JSON.stringify(updatedLocalInv));

  // 4. ATOMIC SINGLE CLOUD UPDATE
  const store = await fetchMasterStore();
  const existingRecycle = (store.recycleBin || []).filter(r => r && typeof r === 'object');
  const existingInv = (store.inventory || []).filter(i => i && typeof i === 'object');
  const cloudDeleted = Array.isArray(store.deletedIds) ? store.deletedIds : [];

  const mergedDeleted = Array.from(new Set([...cloudDeleted, ...newDeletedIds]));
  const filteredInv = existingInv.filter(i => !isMatchItem(i));
  const mergedRecycle = [trashObj, ...existingRecycle.filter(r => String(r.id) !== String(trashObj.id))];

  await saveMasterStore({
    ...store,
    inventory: filteredInv,
    recycleBin: mergedRecycle,
    deletedIds: mergedDeleted
  });

  try {
    window.dispatchEvent(new Event('storage'));
    window.dispatchEvent(new Event('master_store_updated'));
    window.dispatchEvent(new Event('inventory_updated'));
  } catch (e) {}
}

export async function deleteCloudInventoryItem(target) {
  if (!target) return;
  const targetId = typeof target === 'object' ? String(target.id || '').trim() : String(target).trim();
  const targetName = typeof target === 'object' ? String(target.part_name || target.item_name || target.name || '').trim() : targetId;

  const itemObj = typeof target === 'object' ? target : { id: targetId, name: targetName, part_name: targetName };
  const trashObj = {
    id: `trash_inv_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
    item_type: 'Inventory Item',
    title: `Inventory: ${itemObj.part_name || itemObj.name || 'Spare Part'}`,
    deleted_by: 'Patel Owner (Admin)',
    deleted_at: new Date().toISOString(),
    details: `Part Name: ${itemObj.part_name || itemObj.name || 'N/A'} • Category: ${itemObj.category || 'General'} • Stock: ${itemObj.current_stock || 0} • Price: ₹${itemObj.price || 0}`,
    payload: itemObj
  };

  await moveToRecycleBin(trashObj, itemObj);
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
  const targetKey = String(trashObj.id || (trashObj.payload ? trashObj.payload.id : ''));
  const store = await fetchMasterStore();
  const existing = (store.recycleBin || []).filter(r => r && typeof r === 'object');
  const filtered = existing.filter(r => {
    const rKey = String(r.id || (r.payload ? r.payload.id : ''));
    return rKey !== targetKey;
  });
  const updated = [trashObj, ...filtered];
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
    } else if (type.includes('counter sale') || type.includes('counter invoice')) {
      const curSales = JSON.parse(localStorage.getItem('local_counter_sales') || '[]');
      const upSales = [p, ...curSales.filter(s => String(s.id) !== payloadId)];
      localStorage.setItem('local_counter_sales', JSON.stringify(upSales));
      store.counterSales = [p, ...(store.counterSales || []).filter(s => String(s.id) !== payloadId)];
    } else if (type.includes('counter khata')) {
      const curKhata = JSON.parse(localStorage.getItem('local_counter_khata') || '[]');
      const upKhata = [p, ...curKhata.filter(k => String(k.id) !== payloadId)];
      localStorage.setItem('local_counter_khata', JSON.stringify(upKhata));
      store.counterKhata = [p, ...(store.counterKhata || []).filter(k => String(k.id) !== payloadId)];
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

export async function deleteCloudRecycleBinItem(itemId) {
  if (!itemId) return;
  const strId = String(itemId);
  const localTrash = JSON.parse(localStorage.getItem('recycle_bin_items') || '[]');
  const updatedLocal = localTrash.filter(r => String(r.id) !== strId && (!r.payload || String(r.payload.id) !== strId));
  localStorage.setItem('recycle_bin_items', JSON.stringify(updatedLocal));

  const store = await fetchMasterStore();
  const existingTrash = (store.recycleBin || []).filter(r => r && typeof r === 'object');
  const updatedCloudTrash = existingTrash.filter(r => String(r.id) !== strId && (!r.payload || String(r.payload.id) !== strId));

  await saveMasterStore({ ...store, recycleBin: updatedCloudTrash });

  try {
    window.dispatchEvent(new Event('storage'));
    window.dispatchEvent(new Event('master_store_updated'));
  } catch (e) {}
}

export async function emptyCloudRecycleBin() {
  localStorage.setItem('recycle_bin_items', '[]');
  const store = await fetchMasterStore();
  await saveMasterStore({ ...store, recycleBin: [] });
  try {
    window.dispatchEvent(new Event('storage'));
    window.dispatchEvent(new Event('master_store_updated'));
  } catch (e) {}
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
    const res = await axios.get('/api/public/master_store/?t=' + Date.now(), {
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
  if (DEFAULT_PRIMARY_ADMIN && DEFAULT_PRIMARY_ADMIN.username) {
    allAdminsMap.set(DEFAULT_PRIMARY_ADMIN.username.toLowerCase(), DEFAULT_PRIMARY_ADMIN);
  }

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
        const safePass = adminObj.password || a.password || '@patelautomobile1414';
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

  // Update strictly the linked booking to COMPLETED (never touch other bookings of the same vehicle)
  let storeBookings = (store.bookings || []).filter(b => b && typeof b === 'object');
  const targetBookingId = finishedJob?.booking_id ? String(finishedJob.booking_id) : null;
  if (targetBookingId) {
    storeBookings = storeBookings.map(b => {
      if (String(b.id) === targetBookingId) return { ...b, status: 'COMPLETED' };
      return b;
    });
    try {
      const localBookings = JSON.parse(localStorage.getItem('local_bookings') || '[]');
      const updatedLocalBookings = localBookings.map(b => {
        if (String(b.id) === targetBookingId) return { ...b, status: 'COMPLETED' };
        return b;
      });
      localStorage.setItem('local_bookings', JSON.stringify(updatedLocalBookings));
    } catch(e){}
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

export const atomicRecordPayment = async ({
  updatedInvoice,
  updatedJob,
  creditKhataEntry,
  paymentAmount,
  targetId,
  vehicleNumber
}) => {
  const store = await fetchMasterStore();
  const vNorm = (vehicleNumber || '').replace(/[^A-Za-z0-9]/g, '').toUpperCase();
  const rawTargetId = String(targetId || '').replace(/^inv_/, '').replace(/^job_/, '').replace(/^khata_/, '').replace(/^booking_/, '');
  const numAmt = parseFloat(paymentAmount) || 0;

  // 1. Invoices
  let storeInvs = (store.invoices || []).map(inv => {
    if (!inv) return inv;
    const invId = String(inv.id || '');
    const invJobId = String(inv.job_id || '');
    const rawInvId = invId.replace(/^inv_/, '').replace(/^job_/, '').replace(/^khata_/, '').replace(/^booking_/, '');
    const invVeh = (inv.vehicle_number || '').replace(/[^A-Za-z0-9]/g, '').toUpperCase();
    const curTotal = parseFloat(inv.grand_total || inv.total_amount || 0);
    const curPaidOld = parseFloat(inv.paid_amount || 0);
    const curPendingOld = Math.max(0, curTotal - curPaidOld);

    const isTarget = (invId === targetId || invJobId === targetId || (rawTargetId && (rawInvId === rawTargetId || invJobId === rawTargetId)));
    const isMatchingPendingVeh = (vNorm && invVeh === vNorm && curPendingOld > 0);

    if (isTarget || isMatchingPendingVeh) {
      if (updatedInvoice && isTarget) return { ...inv, ...updatedInvoice };
      const curPaid = Math.min(curTotal, curPaidOld + numAmt);
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
    const rawJId = jId.replace(/^inv_/, '').replace(/^job_/, '').replace(/^khata_/, '').replace(/^booking_/, '');
    const jVeh = (j.vehicle_number || '').replace(/[^A-Za-z0-9]/g, '').toUpperCase();
    const curTotal = parseFloat(j.grand_total || j.live_total || 0);
    const curPaidOld = parseFloat(j.paid_amount || 0);
    const curPendingOld = Math.max(0, curTotal - curPaidOld);

    const isTarget = (jId === targetId || (rawTargetId && rawJId === rawTargetId));
    const isMatchingPendingVeh = (vNorm && jVeh === vNorm && (j.status === 'FINISHED' || j.status === 'COMPLETED') && curPendingOld > 0);

    if (isTarget || isMatchingPendingVeh) {
      if (updatedJob && isTarget) return { ...j, ...updatedJob };
      const curPaid = Math.min(curTotal, curPaidOld + numAmt);
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
    const rawKId = kId.replace(/^inv_/, '').replace(/^job_/, '').replace(/^khata_/, '').replace(/^booking_/, '');
    const kVeh = (k.vehicle_number || '').replace(/[^A-Za-z0-9]/g, '').toUpperCase();
    if ((kId === targetId || kJobId === targetId || (rawTargetId && (rawKId === rawTargetId || kJobId === rawTargetId)) || (vNorm && kVeh === vNorm && k.type === 'DEBIT'))) {
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

  try {
    window.dispatchEvent(new Event('storage'));
    window.dispatchEvent(new Event('khata_updated'));
    window.dispatchEvent(new Event('invoices_updated'));
    window.dispatchEvent(new Event('master_store_updated'));
  } catch (e) {}
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

// ---------------- COUNTER SALES & COUNTER KHATA ----------------
function safeGetArrayFromLocal(key) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw || raw === 'undefined' || raw === 'null') return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    return [];
  }
}

export async function fetchCloudCounterSales() {
  const deletedIds = await fetchCloudDeletedIds().catch(() => []);
  const isDeleted = (id) => id && (deletedIds.includes(String(id)) || deletedIds.includes(String(id).replace(/^cs_/, '').replace(/^inv_/, '')));

  const store = await fetchMasterStore().catch(() => ({}));
  const cloudSales = (store.counterSales || []).filter(s => s && typeof s === 'object' && !isDeleted(s.id));
  const rawLocalSales = safeGetArrayFromLocal('local_counter_sales');
  const localSales = rawLocalSales.filter(s => s && typeof s === 'object' && !isDeleted(s.id));

  if (localSales.length !== rawLocalSales.length) {
    try { localStorage.setItem('local_counter_sales', JSON.stringify(localSales)); } catch(e){}
  }

  const map = new Map();
  [...cloudSales, ...localSales].forEach(s => {
    if (s && s.id && !isDeleted(s.id)) {
      map.set(String(s.id), s);
    }
  });
  return Array.from(map.values()).sort((a, b) => new Date(b.created_at || b.date || 0) - new Date(a.created_at || a.date || 0));
}

export async function pushCloudCounterSale(saleObj) {
  if (!saleObj || typeof saleObj !== 'object') return;
  const localSales = safeGetArrayFromLocal('local_counter_sales');
  const filteredLocal = localSales.filter(s => s && String(s.id) !== String(saleObj.id));
  try { localStorage.setItem('local_counter_sales', JSON.stringify([saleObj, ...filteredLocal])); } catch(e){}

  const store = await fetchMasterStore().catch(() => ({}));
  const existing = (store.counterSales || []).filter(s => s && typeof s === 'object');
  const filteredCloud = existing.filter(s => String(s.id) !== String(saleObj.id));
  await saveMasterStore({ ...store, counterSales: [saleObj, ...filteredCloud] }).catch(console.warn);
}

export async function deleteCloudCounterSale(saleId) {
  if (!saleId) return;
  const strId = String(saleId);
  const rawId = strId.replace(/^cs_/, '').replace(/^inv_/, '');
  const khataId = `ckhata_${strId}`;

  // 1. Mark in deletedIds
  await markIdAsDeleted(strId).catch(console.warn);
  if (rawId && rawId !== strId) await markIdAsDeleted(rawId).catch(console.warn);
  await markIdAsDeleted(khataId).catch(console.warn);

  // 2. Remove from local_counter_sales
  const localSales = safeGetArrayFromLocal('local_counter_sales');
  const updatedLocalSales = localSales.filter(s => s && String(s.id) !== strId && String(s.id).replace(/^cs_/, '') !== rawId);
  try { localStorage.setItem('local_counter_sales', JSON.stringify(updatedLocalSales)); } catch(e){}

  // 3. Remove linked counterKhata debtor
  const localKhata = safeGetArrayFromLocal('local_counter_khata');
  const updatedLocalKhata = localKhata.filter(k => k && String(k.id) !== strId && String(k.sale_id) !== strId && String(k.id) !== khataId && String(k.id).replace(/^ckhata_/, '') !== rawId);
  try { localStorage.setItem('local_counter_khata', JSON.stringify(updatedLocalKhata)); } catch(e){}

  // 4. Remove from master store
  const store = await fetchMasterStore().catch(() => ({}));
  const existingSales = (store.counterSales || []).filter(s => s && typeof s === 'object');
  const updatedCloudSales = existingSales.filter(s => String(s.id) !== strId && String(s.id).replace(/^cs_/, '') !== rawId);

  const existingKhata = (store.counterKhata || []).filter(k => k && typeof k === 'object');
  const updatedCloudKhata = existingKhata.filter(k => String(k.id) !== strId && String(k.sale_id) !== strId && String(k.id) !== khataId && String(k.id).replace(/^ckhata_/, '') !== rawId);

  await saveMasterStore({ ...store, counterSales: updatedCloudSales, counterKhata: updatedCloudKhata }).catch(console.warn);

  try {
    window.dispatchEvent(new Event('storage'));
    window.dispatchEvent(new Event('master_store_updated'));
  } catch (e) {}
}

export async function fetchCloudCounterKhata() {
  const deletedIds = await fetchCloudDeletedIds().catch(() => []);
  const isDeleted = (id) => id && (deletedIds.includes(String(id)) || deletedIds.includes(String(id).replace(/^ckhata_/, '').replace(/^cs_/, '')));

  const store = await fetchMasterStore().catch(() => ({}));
  const cloudKhata = (store.counterKhata || []).filter(k => k && typeof k === 'object' && !isDeleted(k.id) && !isDeleted(k.sale_id));
  const rawLocalKhata = safeGetArrayFromLocal('local_counter_khata');
  const localKhata = rawLocalKhata.filter(k => k && typeof k === 'object' && !isDeleted(k.id) && !isDeleted(k.sale_id));

  if (localKhata.length !== rawLocalKhata.length) {
    try { localStorage.setItem('local_counter_khata', JSON.stringify(localKhata)); } catch(e){}
  }

  const map = new Map();
  [...cloudKhata, ...localKhata].forEach(k => {
    if (k && k.id && !isDeleted(k.id) && !isDeleted(k.sale_id)) {
      map.set(String(k.id), k);
    }
  });
  return Array.from(map.values()).sort((a, b) => new Date(b.updated_at || b.created_at || 0) - new Date(a.updated_at || a.created_at || 0));
}

export async function pushCloudCounterKhata(khataObj) {
  if (!khataObj || typeof khataObj !== 'object') return;
  const localKhata = safeGetArrayFromLocal('local_counter_khata');
  const filteredLocal = localKhata.filter(k => k && String(k.id) !== String(khataObj.id));
  try { localStorage.setItem('local_counter_khata', JSON.stringify([khataObj, ...filteredLocal])); } catch(e){}

  const store = await fetchMasterStore().catch(() => ({}));
  const existing = (store.counterKhata || []).filter(k => k && typeof k === 'object');
  const filteredCloud = existing.filter(k => String(k.id) !== String(khataObj.id));
  await saveMasterStore({ ...store, counterKhata: [khataObj, ...filteredCloud] }).catch(console.warn);
}

export async function deleteCloudCounterKhata(khataId) {
  if (!khataId) return;
  const strId = String(khataId);
  const rawId = strId.replace(/^ckhata_/, '').replace(/^cs_/, '');

  await markIdAsDeleted(strId).catch(console.warn);
  if (rawId && rawId !== strId) await markIdAsDeleted(rawId).catch(console.warn);

  const localKhata = JSON.parse(localStorage.getItem('local_counter_khata') || '[]');
  const updatedLocal = localKhata.filter(k => String(k.id) !== strId && String(k.sale_id) !== strId && String(k.id).replace(/^ckhata_/, '') !== rawId);
  localStorage.setItem('local_counter_khata', JSON.stringify(updatedLocal));

  const store = await fetchMasterStore();
  const existing = (store.counterKhata || []).filter(k => k && typeof k === 'object');
  const updatedCloud = existing.filter(k => String(k.id) !== strId && String(k.sale_id) !== strId && String(k.id).replace(/^ckhata_/, '') !== rawId);
  await saveMasterStore({ ...store, counterKhata: updatedCloud });
}

export async function atomicRecordCounterPayment(targetId, paymentAmount, paymentMode = 'CASH', adminName = 'Patel Automobiles') {
  const numAmt = parseFloat(paymentAmount || 0);
  if (numAmt <= 0) return;

  const store = await fetchMasterStore();
  const strId = String(targetId);
  const saleId = strId.replace(/^ckhata_/, '');
  const rawId = saleId.replace(/^cs_/, '').replace(/^inv_/, '');

  // 1. Update Counter Sales Invoices
  let storeSales = (store.counterSales || []).map(s => {
    if (!s) return s;
    const sId = String(s.id || '');
    const sRaw = sId.replace(/^cs_/, '').replace(/^inv_/, '');
    if (sId === strId || sId === saleId || sRaw === rawId) {
      const curTotal = parseFloat(s.net_total || s.total_amount || s.grand_total || 0);
      const curPaidOld = parseFloat(s.paid_amount || 0);
      const curPaid = Math.min(curTotal, curPaidOld + numAmt);
      const curPending = Math.max(0, curTotal - curPaid);
      return {
        ...s,
        paid_amount: curPaid,
        pending_amount: curPending,
        payment_status: curPending <= 0 ? 'PAID' : 'UNPAID',
        payment_mode: paymentMode || s.payment_mode || 'CASH'
      };
    }
    return s;
  });

  // 2. Update Counter Khata Book Debtors
  let storeKhata = (store.counterKhata || []).map(k => {
    if (!k) return k;
    const kId = String(k.id || '');
    const kSaleId = String(k.sale_id || '');
    const kRaw = kId.replace(/^ckhata_/, '').replace(/^cs_/, '');
    if (kId === strId || kSaleId === strId || kSaleId === saleId || kRaw === rawId) {
      const curTotal = parseFloat(k.total_amount || k.net_total || 0);
      const curPaidOld = parseFloat(k.paid_amount || 0);
      const curPaid = Math.min(curTotal, curPaidOld + numAmt);
      const curPending = Math.max(0, curTotal - curPaid);
      const paymentHistory = Array.isArray(k.payments) ? [...k.payments] : [];
      paymentHistory.push({
        id: `cpay_${Date.now()}`,
        amount: numAmt,
        payment_mode: paymentMode,
        date: new Date().toISOString(),
        recorded_by: adminName
      });
      return {
        ...k,
        paid_amount: curPaid,
        pending_amount: curPending,
        status: curPending <= 0 ? 'CLEARED' : 'UNPAID',
        payments: paymentHistory,
        updated_at: new Date().toISOString()
      };
    }
    return k;
  });

  // Update local storage
  localStorage.setItem('local_counter_sales', JSON.stringify(storeSales));
  localStorage.setItem('local_counter_khata', JSON.stringify(storeKhata));

  await saveMasterStore({
    ...store,
    counterSales: storeSales,
    counterKhata: storeKhata
  });

  try {
    window.dispatchEvent(new Event('storage'));
    window.dispatchEvent(new Event('master_store_updated'));
  } catch (e) {}
}

export async function syncCloudInventory(inventoryList) {
  if (!Array.isArray(inventoryList)) return;
  const store = await fetchMasterStore();
  const allMap = new Map();
  inventoryList.forEach(it => {
    if (it && (it.part_name || it.item_name || it.name)) {
      const rawName = String(it.part_name || it.item_name || it.name || '').trim();
      const normKey = rawName.toLowerCase().replace(/[^a-z0-9]/g, '') || String(it.id || '').toLowerCase();
      if (normKey) {
        allMap.set(normKey, { ...it, part_name: rawName, item_name: rawName, name: rawName });
      }
    }
  });
  const cleanInv = Array.from(allMap.values());
  localStorage.setItem('inventory_items', JSON.stringify(cleanInv));
  localStorage.setItem('spare_parts', JSON.stringify(cleanInv));
  localStorage.setItem('local_inventory', JSON.stringify(cleanInv));
  await saveMasterStore({ ...store, inventory: cleanInv });
  try {
    window.dispatchEvent(new Event('master_store_updated'));
    window.dispatchEvent(new Event('inventory_updated'));
  } catch (e) {}
}

export async function pushCloudActiveCounterCart(cartDraft) {
  const store = await fetchMasterStore().catch(() => ({}));
  await saveMasterStore({ ...store, activeCounterCart: cartDraft || null }).catch(console.warn);
  try {
    localStorage.setItem('counter_sale_draft', JSON.stringify(cartDraft || null));
  } catch (e) {}
}

export async function fetchCloudActiveCounterCart() {
  const store = await fetchMasterStore();
  return store.activeCounterCart || JSON.parse(localStorage.getItem('counter_sale_draft') || 'null');
}

export async function atomicAddInventoryItem(itemObj) {
  if (!itemObj || typeof itemObj !== 'object') return;
  const store = await fetchMasterStore();
  const existingInv = (store.inventory || []).filter(i => i && typeof i === 'object');
  const localInv = JSON.parse(localStorage.getItem('inventory_items') || localStorage.getItem('spare_parts') || localStorage.getItem('local_inventory') || '[]');

  const rawName = String(itemObj.part_name || itemObj.item_name || itemObj.name || 'Spare Part').trim();
  const normKey = rawName.toLowerCase().replace(/[^a-z0-9]/g, '');
  const newId = itemObj.id || `inv_${normKey || Date.now()}`;
  const priceVal = parseFloat(itemObj.price || itemObj.unit_price || itemObj.selling_price || 0);
  const stockVal = parseInt(itemObj.current_stock || itemObj.stock_quantity || itemObj.quantity || 0, 10);

  // 1. Remove from local deleted_ids and cloud deletedIds
  const localDeleted = JSON.parse(localStorage.getItem('deleted_ids') || '[]');
  const cleanedLocalDeleted = localDeleted.filter(d => {
    if (!d) return false;
    const dStr = String(d).toLowerCase().trim();
    const dNorm = dStr.replace(/[^a-z0-9]/g, '');
    return dStr !== newId.toLowerCase() && dStr !== rawName.toLowerCase() && dNorm !== normKey;
  });
  localStorage.setItem('deleted_ids', JSON.stringify(cleanedLocalDeleted));

  const cloudDeleted = Array.isArray(store.deletedIds) ? store.deletedIds : [];
  const cleanedCloudDeleted = cloudDeleted.filter(d => {
    if (!d) return false;
    const dStr = String(d).toLowerCase().trim();
    const dNorm = dStr.replace(/[^a-z0-9]/g, '');
    return dStr !== newId.toLowerCase() && dStr !== rawName.toLowerCase() && dNorm !== normKey;
  });

  const allMap = new Map();
  [...localInv, ...existingInv].forEach(it => {
    if (it && (it.id || it.part_name || it.item_name || it.name)) {
      const itRaw = String(it.part_name || it.item_name || it.name || '').trim();
      const itKey = itRaw.toLowerCase().replace(/[^a-z0-9]/g, '') || String(it.id || '').toLowerCase();
      if (itKey) {
        allMap.set(itKey, it);
      }
    }
  });

  const newItem = {
    id: newId,
    part_name: rawName,
    item_name: rawName,
    name: rawName,
    part_number: itemObj.part_number || '',
    category: itemObj.category || 'General',
    cost_price: parseFloat(itemObj.cost_price || 0),
    unit_price: priceVal,
    selling_price: priceVal,
    price: priceVal,
    current_stock: stockVal,
    stock_quantity: stockVal,
    quantity: stockVal,
    min_stock_alert: parseInt(itemObj.min_stock_alert || itemObj.min_stock || 5, 10),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  allMap.set(normKey, newItem);
  const updatedInv = Array.from(allMap.values());

  localStorage.setItem('inventory_items', JSON.stringify(updatedInv));
  localStorage.setItem('spare_parts', JSON.stringify(updatedInv));
  localStorage.setItem('local_inventory', JSON.stringify(updatedInv));
  
  await saveMasterStore({
    ...store,
    inventory: updatedInv,
    deletedIds: cleanedCloudDeleted
  });

  try {
    window.dispatchEvent(new Event('storage'));
    window.dispatchEvent(new Event('master_store_updated'));
    window.dispatchEvent(new Event('inventory_updated'));
  } catch (e) {}

  return newItem;
}

export async function atomicDeductInventoryStock({ partId, partName, quantity }) {
  const qty = parseInt(quantity || 1, 10);
  if (qty <= 0) return;

  const targetId = String(partId || '').trim();
  const rawName = String(partName || '').trim().toLowerCase();
  const normName = rawName.replace(/[^a-z0-9]/g, '');

  const isMatch = (item) => {
    if (!item) return false;
    const itId = String(item.id || '').trim();
    const itName = String(item.part_name || item.item_name || item.name || '').trim().toLowerCase();
    const itNorm = itName.replace(/[^a-z0-9]/g, '');
    return (targetId && itId && targetId === itId) ||
           (normName && itNorm && normName === itNorm);
  };

  // 1. Update local storage (Deduct EXACTLY ONCE)
  const localInv = JSON.parse(localStorage.getItem('inventory_items') || localStorage.getItem('spare_parts') || localStorage.getItem('local_inventory') || '[]');
  let updatedTargetItem = null;
  let hasDeducted = false;

  const updatedLocal = localInv.map(i => {
    if (isMatch(i) && !hasDeducted) {
      hasDeducted = true;
      const curStock = parseInt(i.current_stock !== undefined ? i.current_stock : (i.stock_quantity !== undefined ? i.stock_quantity : (i.quantity !== undefined ? i.quantity : 0)), 10);
      const newStock = Math.max(0, curStock - qty);
      const updated = {
        ...i,
        current_stock: newStock,
        stock_quantity: newStock,
        quantity: newStock,
        updated_at: new Date().toISOString()
      };
      updatedTargetItem = updated;
      return updated;
    }
    return i;
  });

  localStorage.setItem('inventory_items', JSON.stringify(updatedLocal));
  localStorage.setItem('spare_parts', JSON.stringify(updatedLocal));
  localStorage.setItem('local_inventory', JSON.stringify(updatedLocal));

  // 2. Update Cloud Master Store
  try {
    const store = await fetchMasterStore();
    const cloudInv = (store.inventory || []).filter(i => i && typeof i === 'object');
    let hasCloudDeducted = false;
    const updatedCloud = cloudInv.map(i => {
      if (isMatch(i) && !hasCloudDeducted) {
        hasCloudDeducted = true;
        const curStock = parseInt(i.current_stock !== undefined ? i.current_stock : (i.stock_quantity !== undefined ? i.stock_quantity : (i.quantity !== undefined ? i.quantity : 0)), 10);
        const newStock = Math.max(0, curStock - qty);
        return {
          ...i,
          current_stock: newStock,
          stock_quantity: newStock,
          quantity: newStock,
          updated_at: new Date().toISOString()
        };
      }
      return i;
    });

    await saveMasterStore({
      ...store,
      inventory: updatedCloud.length > 0 ? updatedCloud : updatedLocal
    });
  } catch (err) {
    console.warn('atomicDeductInventoryStock cloud update notice:', err);
  }

  try {
    window.dispatchEvent(new Event('storage'));
    window.dispatchEvent(new Event('master_store_updated'));
    window.dispatchEvent(new Event('inventory_updated'));
  } catch (e) {}

  return updatedTargetItem;
}

export async function atomicRestoreInventoryStock({ partId, partName, quantity }) {
  const qty = parseInt(quantity || 1, 10);
  if (qty <= 0) return;

  const targetId = String(partId || '').trim();
  const rawName = String(partName || '').trim().toLowerCase();
  const normName = rawName.replace(/[^a-z0-9]/g, '');

  const isMatch = (item) => {
    if (!item) return false;
    const itId = String(item.id || '').trim();
    const itName = String(item.part_name || item.item_name || item.name || '').trim().toLowerCase();
    const itNorm = itName.replace(/[^a-z0-9]/g, '');
    return (targetId && itId && targetId === itId) ||
           (normName && itNorm && normName === itNorm);
  };

  // 1. Update local storage (Restore EXACTLY ONCE)
  const localInv = JSON.parse(localStorage.getItem('inventory_items') || localStorage.getItem('spare_parts') || localStorage.getItem('local_inventory') || '[]');
  let updatedTargetItem = null;
  let hasRestored = false;

  const updatedLocal = localInv.map(i => {
    if (isMatch(i) && !hasRestored) {
      hasRestored = true;
      const curStock = parseInt(i.current_stock !== undefined ? i.current_stock : (i.stock_quantity !== undefined ? i.stock_quantity : (i.quantity !== undefined ? i.quantity : 0)), 10);
      const newStock = curStock + qty;
      const updated = {
        ...i,
        current_stock: newStock,
        stock_quantity: newStock,
        quantity: newStock,
        updated_at: new Date().toISOString()
      };
      updatedTargetItem = updated;
      return updated;
    }
    return i;
  });

  localStorage.setItem('inventory_items', JSON.stringify(updatedLocal));
  localStorage.setItem('spare_parts', JSON.stringify(updatedLocal));
  localStorage.setItem('local_inventory', JSON.stringify(updatedLocal));

  // 2. Update Cloud Master Store
  try {
    const store = await fetchMasterStore();
    const cloudInv = (store.inventory || []).filter(i => i && typeof i === 'object');
    let hasCloudRestored = false;
    const updatedCloud = cloudInv.map(i => {
      if (isMatch(i) && !hasCloudRestored) {
        hasCloudRestored = true;
        const curStock = parseInt(i.current_stock !== undefined ? i.current_stock : (i.stock_quantity !== undefined ? i.stock_quantity : (i.quantity !== undefined ? i.quantity : 0)), 10);
        const newStock = curStock + qty;
        return {
          ...i,
          current_stock: newStock,
          stock_quantity: newStock,
          quantity: newStock,
          updated_at: new Date().toISOString()
        };
      }
      return i;
    });

    await saveMasterStore({
      ...store,
      inventory: updatedCloud.length > 0 ? updatedCloud : updatedLocal
    });
  } catch (err) {
    console.warn('atomicRestoreInventoryStock cloud update notice:', err);
  }

  try {
    window.dispatchEvent(new Event('storage'));
    window.dispatchEvent(new Event('master_store_updated'));
    window.dispatchEvent(new Event('inventory_updated'));
  } catch (e) {}

  return updatedTargetItem;
}
