import React, { useState, useEffect } from 'react';
import { 
  Wrench, Plus, Trash2, CheckCircle2, XCircle, AlertCircle, CalendarClock,
  IndianRupee, Package, Bike, User, Phone, Check, Receipt, UserCheck, Users, Lock, Search, ChevronDown, Edit2, Tag
} from 'lucide-react';
import API from '../services/api';
import { fetchCloudJobs } from '../utils/cloudSync';
import { useAuth } from '../context/AuthContext';
import AdminPasswordModal from '../components/AdminPasswordModal';

export default function WorkshopPage() {
  const { garageInfo } = useAuth();
  const [jobs, setJobs] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('ACTIVE'); // ACTIVE or FINISHED
  const [mechanicOptions, setMechanicOptions] = useState(['Patel Owner', 'Ramesh Mechanic', 'Suresh Technician']);
  
  // Modal states
  const [selectedJob, setSelectedJob] = useState(null);
  const [showPartModal, setShowPartModal] = useState(false);
  const [showFinishModal, setShowFinishModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);

  // Admin Password Delete Modal
  const [deleteJobModal, setDeleteJobModal] = useState({ isOpen: false, job: null });
  
  // Form states inside modal
  const [selectedPartId, setSelectedPartId] = useState('');
  const [partQty, setPartQty] = useState(1);
  const [partSearchQuery, setPartSearchQuery] = useState('');
  const [isPartDropdownOpen, setIsPartDropdownOpen] = useState(false);
  const [paidAmount, setPaidAmount] = useState(0);
  const [finishLabourCharge, setFinishLabourCharge] = useState(0);
  const [discountAmount, setDiscountAmount] = useState(0);
  const [labourInputs, setLabourInputs] = useState({});
  const [assignedMechanic, setAssignedMechanic] = useState('');
  const [secondaryMechanic, setSecondaryMechanic] = useState('');

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

  const fetchData = async () => {
    setLoading(true);
    let backendJobs = [];
    let invData = [];
    try {
      const [jobsRes, invRes] = await Promise.all([
        API.get('/workshop/'),
        API.get('/inventory/')
      ]);
      backendJobs = jobsRes.data || [];
      invData = invRes.data || [];
    } catch (err) {
      console.warn('Backend API offline or unreachable:', err);
    }

    const localJobs = JSON.parse(localStorage.getItem('workshop_jobs') || '[]');
    const cloudJobs = await fetchCloudJobs();

    const allMap = new Map();
    [...backendJobs, ...localJobs, ...cloudJobs].forEach(j => {
      if (j && typeof j === 'object') {
        const uniqueKey = j.id || `${j.vehicle_number || 'UNKNOWN'}_${j.created_at || Date.now()}`;
        if (!allMap.has(uniqueKey)) {
          const sanitizedJob = {
            ...j,
            parts: Array.isArray(j.parts) ? j.parts : [],
            parts_total: parseFloat(j.parts_total || 0),
            labour_charge: parseFloat(j.labour_charge || 0),
            status: j.status || 'IN_PROGRESS'
          };
          allMap.set(uniqueKey, sanitizedJob);
        }
      }
    });

    const mergedJobs = Array.from(allMap.values()).sort(
      (a, b) => new Date(b.created_at || Date.now()) - new Date(a.created_at || Date.now())
    );

    setJobs(mergedJobs);
    setInventory(invData);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSilentUpdateLabourCharge = async (jobId, amount) => {
    try {
      await API.post(`/workshop/${jobId}/update_labour_charge/`, {
        labour_charge: amount
      });
    } catch (err) {
      console.error('Silent labour charge update error', err);
    }
  };

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
    try {
      await API.post(`/workshop/${selectedJob.id}/assign_mechanic/`, {
        assigned_mechanic: assignedMechanic,
        secondary_mechanic: secondaryMechanic
      });
      setShowAssignModal(false);
      fetchData();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to assign mechanics');
    }
  };

  const openAddPartModal = (job) => {
    setSelectedJob(job);
    setSelectedPartId(inventory[0]?.id || '');
    setPartQty(1);
    setShowPartModal(true);
  };

  const handleAddStagedPart = async (e) => {
    e.preventDefault();
    if (!selectedPartId || !selectedJob) return;
    try {
      await API.post(`/workshop/${selectedJob.id}/add_staged_part/`, {
        inventory_id: selectedPartId,
        quantity: partQty
      });
      setShowPartModal(false);
      fetchData();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to add part');
    }
  };

  const handleRemovePart = async (jobId, partId) => {
    try {
      await API.post(`/workshop/${jobId}/remove_staged_part/`, { part_id: partId });
      fetchData();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to remove part');
    }
  };

  const handleConfirmParts = async (jobId) => {
    try {
      const res = await API.post(`/workshop/${jobId}/confirm_parts/`);
      alert(res.data.message || 'Parts confirmed & inventory updated!');
      fetchData();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to confirm parts');
    }
  };

  const handleUpdateLabourCharge = async (jobId, amount) => {
    try {
      await API.post(`/workshop/${jobId}/update_labour_charge/`, {
        labour_charge: amount
      });
      setEditingLabourJobId(null);
      fetchData();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to update labour charge');
    }
  };

  const openFinishModal = (job) => {
    if (!job.assigned_mechanic || job.assigned_mechanic === 'Unassigned') {
      alert('⚠️ Mechanic assignment is COMPULSORY! Please select a mechanic for this bike before finishing the bill.');
      openAssignModal(job);
      return;
    }
    setSelectedJob(job);
    const initialLabour = parseFloat(job.labour_charge || 0);
    setFinishLabourCharge(initialLabour);
    setDiscountAmount('');
    const subtotal = job.parts_total + initialLabour;
    setPaidAmount(subtotal);
    setShowFinishModal(true);
  };

  const handleFinishBill = async (e) => {
    e.preventDefault();
    if (!selectedJob) return;
    const numericDiscount = parseFloat(discountAmount.toString().replace(/[^0-9.]/g, '')) || 0;
    try {
      const res = await API.post(`/workshop/${selectedJob.id}/finish_service/`, {
        labour_charge: finishLabourCharge,
        discount_amount: numericDiscount,
        paid_amount: paidAmount
      });
      alert(`Service finished! Invoice ${res.data.invoice.invoice_number} generated.`);
      setShowFinishModal(false);
      fetchData();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to finish bill');
    }
  };

  const handleCancelService = async (jobId) => {
    if (!window.confirm('Are you sure you want to cancel this service job? Staged inventory will remain untouched.')) return;
    try {
      await API.post(`/workshop/${jobId}/cancel_service/`);
      fetchData();
    } catch (err) {
      alert('Failed to cancel service');
    }
  };

  const handleDeleteJobWithPassword = async (adminPassword) => {
    if (!deleteJobModal.job) return;
    await API.post(`/workshop/${deleteJobModal.job.id}/delete_with_password/`, {
      admin_password: adminPassword
    });
    alert('Service job deleted successfully!');
    fetchData();
  };

  const activeJobs = jobs.filter(j => j && j.status === 'IN_PROGRESS');
  const finishedJobs = jobs.filter(j => j && (j.status === 'FINISHED' || j.status === 'CANCELLED'));

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
            onClick={() => setTab('FINISHED')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              tab === 'FINISHED'
                ? 'bg-emerald-600 text-white shadow-md'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            Finished / Closed Jobs ({finishedJobs.length})
          </button>
        </div>
      </div>

      {loading ? (
        <div className="p-8 text-center text-slate-500 font-medium">Loading Workshop Floor...</div>
      ) : tab === 'ACTIVE' ? (
        activeJobs.length === 0 ? (
          <div className="bg-white p-12 rounded-3xl text-center text-slate-400 border border-slate-200">
            No bikes currently on the workshop floor. Click "New Service" to create a job card.
          </div>
        ) : (
          /* ACTIVE BIKE CARDS GRID */
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {activeJobs.map((job) => {
              const partsList = Array.isArray(job.parts) ? job.parts : [];
              const hasStagedParts = partsList.some(p => p && p.status === 'STAGED');
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
                      <span className="font-mono text-base font-extrabold px-3 py-1 bg-slate-900 text-amber-400 rounded-xl tracking-wider">
                        {job.vehicle_number}
                      </span>
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
                            const cleanName = (p.part_name || '').split('#')[0].trim();
                            return (
                              <div key={p.id} className="p-3 rounded-2xl bg-slate-50 border border-slate-200/60 flex items-center justify-between text-xs hover:border-slate-300 transition-colors">
                                <div className="flex items-center gap-2.5 min-w-0 pr-2">
                                  <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 font-extrabold text-xs">
                                    {p.quantity}×
                                  </div>
                                  <div className="truncate">
                                    <span className="font-bold text-slate-900 block truncate text-xs">{cleanName}</span>
                                    <span className="text-[11px] font-semibold text-slate-500">₹{formatMoney(p.unit_price * p.quantity)}</span>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                  <span className={`text-[10px] font-extrabold px-2.5 py-1 rounded-lg tracking-wider uppercase ${
                                    p.status === 'CONFIRMED' ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' : 'bg-amber-100 text-amber-800 border border-amber-200'
                                  }`}>
                                    {p.status}
                                  </span>
                                  <button
                                    onClick={() => handleRemovePart(job.id, p.id)}
                                    className="text-slate-400 hover:text-rose-600 p-1.5 rounded-lg hover:bg-rose-50 transition-colors"
                                    title="Remove Part"
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
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        onClick={() => openAssignModal(job)}
                        className="inline-flex items-center justify-center gap-1 bg-purple-50 hover:bg-purple-100 text-purple-700 text-xs font-bold py-2.5 rounded-xl transition-colors border border-purple-200"
                      >
                        <UserCheck className="w-4 h-4" /> Mechanics
                      </button>

                      <button
                        onClick={() => openAddPartModal(job)}
                        className="inline-flex items-center justify-center gap-1 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold py-2.5 rounded-xl transition-colors"
                      >
                        <Plus className="w-4 h-4 text-blue-600" /> Add Part
                      </button>

                      <button
                        onClick={() => handleConfirmParts(job.id)}
                        disabled={!hasStagedParts}
                        className="inline-flex items-center justify-center gap-1 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold py-2.5 rounded-xl transition-colors disabled:opacity-40"
                      >
                        <Check className="w-4 h-4" /> Confirm
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => openFinishModal(job)}
                        className="inline-flex items-center justify-center gap-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold py-2.5 rounded-xl shadow-md transition-colors"
                      >
                        <Receipt className="w-4 h-4" /> Finish Bill
                      </button>

                      <button
                        onClick={() => handleCancelService(job.id)}
                        className="inline-flex items-center justify-center gap-1 bg-red-50 hover:bg-red-100 text-red-600 text-xs font-bold py-2.5 rounded-xl transition-colors"
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
      ) : (
        /* FINISHED / CLOSED JOBS LIST WITH PASSWORD DELETE */
        <div className="bg-white rounded-3xl border border-slate-200/80 p-6 space-y-6">
          <h2 className="text-lg font-bold text-slate-900 font-poppins">Finished & Closed Service Jobs</h2>
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
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700">
                        FINISHED
                      </span>
                    </div>
                    <p className="text-xs text-slate-500">
                      Primary Mechanic: <strong>{job.assigned_mechanic}</strong>
                      {job.secondary_mechanic && <span> • Assistant: <strong>{job.secondary_mechanic}</strong></span>}
                      <span> • Total Bill: <strong>₹{job.live_total.toFixed(2)}</strong></span>
                    </p>
                    <p className="text-xs text-slate-600 font-medium flex items-center gap-1.5 pt-0.5">
                      <CalendarClock className="w-3.5 h-3.5 text-emerald-600" />
                      {job.status === 'CANCELLED' ? 'Closed' : 'Finished'}: <strong>{formatCompletionDateTime(job.finished_at)}</strong>
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
          <div className="bg-white rounded-3xl p-6 sm:p-7 max-w-lg w-full space-y-4 shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <div>
                <h2 className="text-lg font-bold text-slate-900 font-poppins">Add Spare Part (Staged)</h2>
                <p className="text-xs text-slate-500">Inventory stock decreases only when confirmed</p>
              </div>
              <button
                onClick={() => setShowPartModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-full hover:bg-slate-100"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddStagedPart} className="space-y-4 flex-1 flex flex-col min-h-0">
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
                {inventory.filter(item => item.part_name.toLowerCase().includes(partSearchQuery.toLowerCase())).length === 0 ? (
                  <div className="p-8 text-center text-xs text-slate-400 font-medium">
                    No spare parts found matching "{partSearchQuery}"
                  </div>
                ) : (
                  inventory.filter(item => item.part_name.toLowerCase().includes(partSearchQuery.toLowerCase())).map((item) => {
                    const isSelected = selectedPartId.toString() === item.id.toString();
                    const cleanItemName = item.part_name.split('#')[0].trim();
                    return (
                      <div
                        key={item.id}
                        onClick={() => setSelectedPartId(item.id.toString())}
                        className={`p-3 rounded-xl border cursor-pointer transition-all flex items-center justify-between text-xs ${
                          isSelected 
                            ? 'bg-blue-50/90 border-blue-500 shadow-xs text-blue-900 font-bold' 
                            : 'bg-white border-slate-200/80 hover:border-slate-300 text-slate-700'
                        }`}
                      >
                        <div className="space-y-0.5 pr-2 min-w-0">
                          <div className="font-bold text-slate-900 truncate text-xs">{cleanItemName}</div>
                          <div className="text-[11px] text-slate-500 flex items-center gap-2">
                            <span>Stock: <strong className="text-slate-700">{item.current_stock}</strong></span>
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
                  })
                )}
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
                  className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!selectedPartId}
                  className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-md transition-all disabled:opacity-50"
                >
                  Add To Staged Bill
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

      {/* ADMIN PASSWORD DELETE MODAL */}
      <AdminPasswordModal
        isOpen={deleteJobModal.isOpen}
        onClose={() => setDeleteJobModal({ isOpen: false, job: null })}
        onConfirm={handleDeleteJobWithPassword}
        title="Delete Finished Service Job"
        itemDescription={deleteJobModal.job ? `Service Job #${deleteJobModal.job.id} (${deleteJobModal.job.vehicle_number})` : 'job'}
      />

    </div>
  );
}
