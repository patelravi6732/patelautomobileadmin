import axios from 'axios';

const MASTER_BIN_URL = 'https://api.restful-api.dev/objects/ff8081819f7e10ae019fbcb185ca5b9e';

async function fetchMasterStore() {
  try {
    const res = await axios.get(MASTER_BIN_URL);
    if (res.data && res.data.data) {
      return {
        bookings: Array.isArray(res.data.data.bookings) ? res.data.data.bookings : [],
        messages: Array.isArray(res.data.data.messages) ? res.data.data.messages : [],
        jobs: Array.isArray(res.data.data.jobs) ? res.data.data.jobs : []
      };
    }
    return { bookings: [], messages: [], jobs: [] };
  } catch (err) {
    console.warn('Failed to fetch Master Cloud Store:', err);
    return { bookings: [], messages: [], jobs: [] };
  }
}

async function saveMasterStore(storeData) {
  try {
    await axios.put(MASTER_BIN_URL, {
      name: 'PatelAutomobilesMasterBin',
      data: storeData
    });
  } catch (err) {
    console.warn('Failed to save Master Cloud Store:', err);
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
