import React, { useState, useEffect } from 'react';
import { Clock, LogIn, LogOut, CheckCircle2, UserCheck, Calendar, Undo2, Trash2, XCircle, AlertCircle, Award, Eye, DollarSign, PlusCircle, CreditCard, ChevronLeft, ChevronRight, Edit2 } from 'lucide-react';
import API from '../services/api';
import { useAuth } from '../context/AuthContext';
import { pushCloudRecycleBinItem, pushCloudAttendanceRecord, pushCloudSalaryPayment, fetchCloudAttendance, fetchCloudSalaryPayments, pushAuditLog, deleteCloudAttendanceRecord, deleteCloudSalaryPayment, fetchCloudDeletedIds } from '../utils/cloudSync';
import AdminPasswordModal from '../components/AdminPasswordModal';
import MechanicProfileModal from '../components/MechanicProfileModal';

export default function AttendancePage() {
  const { garageInfo } = useAuth();
  const [activeTab, setActiveTab] = useState('ATTENDANCE'); // ATTENDANCE, CALENDAR, SALARY
  
  const [attendanceList, setAttendanceList] = useState(() => {
    try { return JSON.parse(localStorage.getItem('local_attendance') || '[]'); } catch (e) { return []; }
  });
  const [summaryList, setSummaryList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [mechanicOptions, setMechanicOptions] = useState(['Amitbhai Mechanic', 'Vishalbhai Mechanic', 'Manojbhai Mechanic']);
  const [selectedMechanic, setSelectedMechanic] = useState('Amitbhai Mechanic');
  const [selectedStatus, setSelectedStatus] = useState('PRESENT');

  // Edit Attendance Modal State
  const [editModal, setEditModal] = useState({
    isOpen: false,
    item: null,
    check_in_time: '',
    check_out_time: '',
    status: 'PRESENT'
  });

  // Dynamic Year Selector starting from 2026 onwards
  const currentDate = new Date();
  const [selectedMonth, setSelectedMonth] = useState(currentDate.getMonth() + 1); // 1-12
  const [selectedYear, setSelectedYear] = useState(Math.max(2026, currentDate.getFullYear()));
  const [calendarData, setCalendarData] = useState([]);
  const [totalDaysInMonth, setTotalDaysInMonth] = useState(31);

  // Generate Year options starting from 2026 up to max(currentYear + 5, 2035)
  const currentYr = currentDate.getFullYear();
  const maxYr = Math.max(currentYr + 5, 2035);
  const yearOptions = [];
  for (let y = 2026; y <= maxYr; y++) {
    yearOptions.push(y);
  }

  // Salary Payments State (Notes field removed)
  const [salaryPayments, setSalaryPayments] = useState([]);
  const [salaryForm, setSalaryForm] = useState({
    mechanic_name: 'Patel Owner',
    amount: '',
    payment_type: 'SALARY', // SALARY, ADVANCE, BONUS
    payment_date: new Date().toISOString().split('T')[0]
  });
  
  // Modals
  const [deleteModal, setDeleteModal] = useState({ isOpen: false, item: null, type: 'ATTENDANCE' });
  const [profileModal, setProfileModal] = useState({ isOpen: false, mechanicName: '' });

  useEffect(() => {
    if (garageInfo?.mechanics_list) {
      const parsed = garageInfo.mechanics_list.split(',').map(m => m.trim()).filter(m => m && !m.toLowerCase().includes('unassigned'));
      if (parsed.length > 0) {
        setMechanicOptions(parsed);
        setSelectedMechanic(prev => (prev && parsed.includes(prev) ? prev : parsed[0]));
        setSalaryForm(prev => ({
          ...prev,
          mechanic_name: (prev?.mechanic_name && parsed.includes(prev.mechanic_name)) ? prev.mechanic_name : parsed[0]
        }));
      }
    }
  }, [garageInfo?.mechanics_list]);

  const fetchData = async () => {
    let apiAtt = [], apiSum = [], apiCal = [], apiSal = [];
    let cloudAtt = [], cloudSal = [], deletedIds = [];

    try {
      const [attRes, sumRes, calRes, salRes] = await Promise.all([
        API.get('/attendance/', { timeout: 1500 }).catch(() => ({ data: [] })),
        API.get(`/attendance/monthly_summary/?month=${selectedMonth}&year=${selectedYear}`, { timeout: 1500 }).catch(() => ({ data: { summary: [] } })),
        API.get(`/attendance/monthly_calendar/?month=${selectedMonth}&year=${selectedYear}`, { timeout: 1500 }).catch(() => ({ data: { calendar_data: [] } })),
        API.get('/salary-payments/', { timeout: 1500 }).catch(() => ({ data: [] }))
      ]);
      apiAtt = attRes.data || [];
      apiSum = sumRes.data?.summary || [];
      apiCal = calRes.data?.calendar_data || [];
      apiSal = salRes.data || [];
    } catch (err) {}

    try {
      [cloudAtt, cloudSal, deletedIds] = await Promise.all([
        fetchCloudAttendance().catch(() => []),
        fetchCloudSalaryPayments().catch(() => []),
        fetchCloudDeletedIds().catch(() => [])
      ]);
    } catch (e) {}

    const localAtt = JSON.parse(localStorage.getItem('local_attendance') || '[]');
    const combinedAtt = [...apiAtt, ...localAtt, ...cloudAtt];

    const attMap = new Map();
    combinedAtt.forEach(item => {
      if (item && typeof item === 'object' && item.mechanic_name && item.date && !item.mechanic_name.toLowerCase().includes('unassigned')) {
        const key = `${item.mechanic_name.trim()}_${item.date}`;
        if (!deletedIds.includes(key) && !deletedIds.includes(String(item.id))) {
          if (!attMap.has(key)) {
            attMap.set(key, item);
          } else {
            const existing = attMap.get(key);
            attMap.set(key, {
              ...existing,
              ...item,
              check_in_time: existing.check_in_time || existing.check_in || item.check_in_time || item.check_in,
              check_in: existing.check_in || existing.check_in_time || item.check_in || item.check_in_time,
              check_out_time: item.check_out_time || item.check_out || existing.check_out_time || existing.check_out,
              check_out: item.check_out || item.check_out_time || existing.check_out || existing.check_out_time
            });
          }
        }
      }
    });
    const finalAttList = Array.from(attMap.values());
    setAttendanceList(finalAttList);

    const localSal = JSON.parse(localStorage.getItem('local_salary_payments') || '[]');
    const combinedSal = [...apiSal, ...localSal, ...cloudSal];
    const salMap = new Map();
    combinedSal.forEach(s => {
      if (s && typeof s === 'object') {
        const key = String(s.id || `${s.mechanic_name}_${s.payment_date}_${s.amount}`);
        if (!deletedIds.includes(key) && !deletedIds.includes(String(s.id))) {
          salMap.set(key, s);
        }
      }
    });
    const finalSalList = Array.from(salMap.values());
    setSalaryPayments(finalSalList);

    const totalDays = new Date(selectedYear, selectedMonth, 0).getDate();
    setTotalDaysInMonth(totalDays);

    // Compute Summary List dynamically per mechanic
    const computedSummary = mechanicOptions.map(mech => {
      const mechAtt = finalAttList.filter(a => {
        if (!a || a.mechanic_name !== mech) return false;
        const d = new Date(a.date);
        return !isNaN(d.getTime()) && (d.getMonth() + 1) === selectedMonth && d.getFullYear() === selectedYear;
      });

      const presentCount = mechAtt.filter(a => a.status === 'PRESENT').length;
      const halfDayCount = mechAtt.filter(a => a.status === 'HALF_DAY').length;
      const absentCount = mechAtt.filter(a => a.status === 'ABSENT').length;
      const daysWorked = presentCount + (halfDayCount * 0.5);

      const mechSal = finalSalList.filter(s => {
        if (!s || s.mechanic_name !== mech) return false;
        const dt = new Date(s.payment_date || s.created_at || s.date);
        return !isNaN(dt.getTime()) && (dt.getMonth() + 1) === selectedMonth && dt.getFullYear() === selectedYear;
      });

      const totalSalaryPaid = mechSal.reduce((acc, s) => acc + (parseFloat(s.amount || 0)), 0);

      return {
        mechanic_name: mech,
        present: presentCount,
        half_day: halfDayCount,
        absent: absentCount,
        total_days_worked: daysWorked,
        total_salary_paid: totalSalaryPaid,
        total_days_in_month: totalDays
      };
    });

    setSummaryList(apiSum.length > 0 ? apiSum : computedSummary);

    // Compute Calendar Matrix dynamically
    const computedCal = mechanicOptions.map(mech => {
      const daysMap = {};
      for (let day = 1; day <= totalDays; day++) {
        const dayStr = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const record = finalAttList.find(a => a.mechanic_name === mech && a.date === dayStr);
        daysMap[day] = record ? {
          status: record.status,
          check_in: record.check_in || record.check_in_time || null,
          check_out: record.check_out || record.check_out_time || null
        } : null;
      }

      return {
        mechanic_name: mech,
        days: daysMap
      };
    });

    setCalendarData(apiCal.length > 0 ? apiCal : computedCal);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, [selectedMonth, selectedYear]);

  const handleCheckIn = async (e) => {
    e.preventDefault();
    const todayStr = new Date().toISOString().split('T')[0];
    const nowTime = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });

    // Lock check-in if attendance is already marked for today
    const existingToday = attendanceList.find(a => a && a.mechanic_name === selectedMechanic && a.date === todayStr);
    if (existingToday) {
      alert(`⚠️ Attendance for ${selectedMechanic} on ${todayStr} is ALREADY marked! If you want to change the time or status, please click the 'Edit' button in Recent Attendance Records below.`);
      return;
    }

    const newAttRecord = {
      id: `att_${Date.now()}`,
      mechanic_name: selectedMechanic,
      date: todayStr,
      check_in: nowTime,
      check_in_time: nowTime,
      check_out: null,
      check_out_time: null,
      status: selectedStatus
    };

    pushCloudAttendanceRecord(newAttRecord).catch(console.warn);
    pushAuditLog('ATTENDANCE', 'Attendance', `Checked in ${selectedMechanic} (${selectedStatus}) at ${nowTime}`).catch(console.warn);
    const localAtt = JSON.parse(localStorage.getItem('local_attendance') || '[]');
    const updatedLocal = [newAttRecord, ...localAtt.filter(a => !(a.mechanic_name === selectedMechanic && a.date === todayStr))];
    localStorage.setItem('local_attendance', JSON.stringify(updatedLocal));

    try {
      const res = await API.post('/attendance/check_in/', {
        mechanic_name: selectedMechanic,
        status: selectedStatus,
        check_in_time: nowTime
      }, { timeout: 1500 });
      alert(res.data?.message || `Checked in ${selectedMechanic} at ${nowTime}!`);
    } catch (err) {
      console.warn('Backend API offline, recorded attendance locally & cloud store:', err);
      alert(`✅ Checked in ${selectedMechanic} (${selectedStatus}) at ${nowTime}!`);
    } finally {
      fetchData();
    }
  };

  const openEditModal = (item) => {
    setEditModal({
      isOpen: true,
      item,
      check_in_time: item.check_in_time || item.check_in || '09:00 AM',
      check_out_time: item.check_out_time || item.check_out || '',
      status: item.status || 'PRESENT'
    });
  };

  const handleSaveEditedAttendance = async (e) => {
    e.preventDefault();
    if (!editModal.item) return;

    const updatedRecord = {
      ...editModal.item,
      check_in: editModal.check_in_time,
      check_in_time: editModal.check_in_time,
      check_out: editModal.check_out_time || null,
      check_out_time: editModal.check_out_time || null,
      status: editModal.status
    };

    pushCloudAttendanceRecord(updatedRecord).catch(console.warn);
    const localAtt = JSON.parse(localStorage.getItem('local_attendance') || '[]');
    const updatedLocal = localAtt.map(a => String(a.id) === String(editModal.item.id) ? updatedRecord : a);
    localStorage.setItem('local_attendance', JSON.stringify(updatedLocal));

    setAttendanceList(prev => prev.map(a => String(a.id) === String(editModal.item.id) ? updatedRecord : a));
    setEditModal({ isOpen: false, item: null, check_in_time: '', check_out_time: '', status: 'PRESENT' });
    alert(`✅ Attendance for '${editModal.item.mechanic_name}' updated successfully!`);
    fetchData();
  };

  const handleCheckOut = async () => {
    const todayStr = new Date().toISOString().split('T')[0];
    const nowTime = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });

    const localAtt = JSON.parse(localStorage.getItem('local_attendance') || '[]');
    let foundToday = false;
    const updatedLocal = localAtt.map(a => {
      if (a.mechanic_name === selectedMechanic && a.date === todayStr) {
        foundToday = true;
        return { ...a, check_out: nowTime, check_out_time: nowTime };
      }
      return a;
    });

    if (!foundToday) {
      const realIn = new Date(Date.now() - 3600000).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
      updatedLocal.unshift({
        id: `att_${Date.now()}`,
        mechanic_name: selectedMechanic,
        date: todayStr,
        check_in: realIn,
        check_in_time: realIn,
        check_out: nowTime,
        check_out_time: nowTime,
        status: 'PRESENT'
      });
    }

    localStorage.setItem('local_attendance', JSON.stringify(updatedLocal));

    const checkOutRecord = {
      id: `att_co_${Date.now()}`,
      mechanic_name: selectedMechanic,
      date: todayStr,
      check_out: nowTime,
      check_out_time: nowTime,
      status: 'PRESENT'
    };
    pushCloudAttendanceRecord(checkOutRecord).catch(console.warn);

    try {
      const res = await API.post('/attendance/check_out/', {
        mechanic_name: selectedMechanic,
        check_out_time: nowTime
      }, { timeout: 1500 });
      alert(res.data?.message || `Checked out ${selectedMechanic} at ${nowTime}!`);
    } catch (err) {
      console.warn('Backend API offline, recorded checkout locally & cloud store:', err);
      alert(`✅ Checked out ${selectedMechanic} at ${nowTime}!`);
    } finally {
      fetchData();
    }
  };

  const handleRecordSalary = async (e) => {
    e.preventDefault();
    if (!salaryForm.amount || parseFloat(salaryForm.amount) <= 0) {
      alert('Please enter a valid salary amount.');
      return;
    }

    const todayStr = new Date().toISOString().split('T')[0];
    const newSalaryRecord = {
      id: `sal_${Date.now()}`,
      mechanic_name: salaryForm.mechanic_name || selectedMechanic,
      amount: parseFloat(salaryForm.amount),
      payment_type: salaryForm.payment_type || 'Advance Payout',
      payment_date: todayStr,
      notes: salaryForm.notes || 'Payout'
    };

    pushCloudSalaryPayment(newSalaryRecord).catch(console.warn);
    const localSal = JSON.parse(localStorage.getItem('local_salary_payments') || '[]');
    localStorage.setItem('local_salary_payments', JSON.stringify([newSalaryRecord, ...localSal]));

    try {
      await API.post('/salary-payments/', salaryForm, { timeout: 1500 });
      alert(`🎉 ₹${salaryForm.amount} payout recorded for ${salaryForm.mechanic_name}!`);
    } catch (err) {
      console.warn('Backend API offline, recorded salary payout locally & cloud store:', err);
      alert(`🎉 ₹${salaryForm.amount} payout recorded for ${salaryForm.mechanic_name}!`);
    } finally {
      setSalaryForm(prev => ({ ...prev, amount: '' }));
      fetchData();
    }
  };

  const handleDeleteWithPassword = async (adminPassword) => {
    if (!deleteModal.item) return;
    const targetItem = deleteModal.item;

    const trashObj = {
      id: `trash_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      item_type: deleteModal.type === 'ATTENDANCE' ? 'Attendance Log' : 'Salary Payout',
      title: deleteModal.type === 'ATTENDANCE' 
        ? `Attendance: ${targetItem.mechanic_name || 'Mechanic'} (${targetItem.date || 'Log'})` 
        : `Salary: ₹${targetItem.amount || 0} (${targetItem.mechanic_name || 'Mechanic'})`,
      deleted_by: 'Patel Owner (Admin)',
      deleted_at: new Date().toISOString(),
      details: deleteModal.type === 'ATTENDANCE'
        ? `Mechanic: ${targetItem.mechanic_name} • Check-In: ${targetItem.check_in || 'N/A'} • Check-Out: ${targetItem.check_out || 'N/A'}`
        : `Mechanic: ${targetItem.mechanic_name} • Amount: ₹${targetItem.amount} • Type: ${targetItem.payment_type || 'Advance'}`,
      payload: targetItem
    };

    const existingTrash = JSON.parse(localStorage.getItem('recycle_bin_items') || '[]');
    localStorage.setItem('recycle_bin_items', JSON.stringify([trashObj, ...existingTrash]));
    pushCloudRecycleBinItem(trashObj).catch(console.warn);

    if (deleteModal.type === 'ATTENDANCE') {
      deleteCloudAttendanceRecord(targetItem.id).catch(console.warn);
      if (targetItem.mechanic_name && targetItem.date) {
        deleteCloudAttendanceRecord(`${targetItem.mechanic_name.trim()}_${targetItem.date}`).catch(console.warn);
      }
      const targetAttId = String(targetItem.id || '');
      const localAtt = JSON.parse(localStorage.getItem('local_attendance') || '[]');
      const updatedLocalAtt = localAtt.filter(a => a && String(a.id) !== targetAttId && String(a.id) !== String(targetItem.id));
      localStorage.setItem('local_attendance', JSON.stringify(updatedLocalAtt));
    } else if (deleteModal.type === 'SALARY') {
      deleteCloudSalaryPayment(targetItem.id).catch(console.warn);
      const targetSalId = String(targetItem.id || '');
      const localSal = JSON.parse(localStorage.getItem('local_salary_payments') || '[]');
      const updatedLocalSal = localSal.filter(s => s && String(s.id) !== targetSalId && String(s.id) !== String(targetItem.id));
      localStorage.setItem('local_salary_payments', JSON.stringify(updatedLocalSal));
    }

    try {
      if (deleteModal.type === 'ATTENDANCE') {
        await API.post(`/attendance/${targetItem.id}/delete_with_password/`, { admin_password: adminPassword }, { timeout: 2000 });
      } else if (deleteModal.type === 'SALARY') {
        await API.post(`/salary-payments/${targetItem.id}/delete_with_password/`, { admin_password: adminPassword }, { timeout: 2000 });
      }
    } catch (err) {
      console.warn('Backend API offline, moved record to Recycle Bin locally:', err);
    } finally {
      alert(`${deleteModal.type === 'ATTENDANCE' ? 'Attendance log' : 'Salary payout'} moved to Recycle Bin!`);
      setDeleteModal({ isOpen: false, item: null, type: null });
      fetchData();
    }
  };

  const openMechanicProfile = (name) => {
    setProfileModal({ isOpen: true, mechanicName: name });
  };

  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      
      {/* PAGE HEADER & TAB SWITCHER */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 font-poppins">Mechanic Attendance & Salary</h1>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setActiveTab('ATTENDANCE')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'ATTENDANCE' ? 'bg-slate-900 text-white shadow-md' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            Today's Desk
          </button>

          <button
            onClick={() => setActiveTab('CALENDAR')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'CALENDAR' ? 'bg-blue-600 text-white shadow-md' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            Monthly Calendar Grid
          </button>

          <button
            onClick={() => setActiveTab('SALARY')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'SALARY' ? 'bg-emerald-600 text-white shadow-md' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            Salary & Advance Payments
          </button>
        </div>
      </div>

      {/* MONTH & YEAR SELECTOR (Starting from 2026 onwards) */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 soft-shadow flex flex-wrap justify-between items-center gap-4">
        <div className="flex items-center gap-3">
          <Calendar className="w-5 h-5 text-blue-600" />
          <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">Select Month & Year:</span>
        </div>

        <div className="flex items-center gap-3">
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
            className="px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-bold bg-slate-50 text-slate-800 focus:outline-none"
          >
            {monthNames.map((m, idx) => (
              <option key={idx} value={idx + 1}>{m}</option>
            ))}
          </select>

          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(parseInt(e.target.value))}
            className="px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-bold bg-slate-50 text-slate-800 focus:outline-none"
          >
            {yearOptions.map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
      </div>

      {/* TAB 1: TODAY'S ATTENDANCE DESK */}
      {activeTab === 'ATTENDANCE' && (
        <div className="space-y-8">
          
          {/* MONTHLY SUMMARY CARDS WITH DAYS WORKED & TOTAL SALARY PAID */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {summaryList.map((m, idx) => (
              <div
                key={idx}
                onClick={() => openMechanicProfile(m.mechanic_name)}
                className="bg-white p-6 rounded-3xl border border-slate-200/80 soft-shadow space-y-4 hover:shadow-xl transition-all cursor-pointer group"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center font-bold group-hover:scale-110 transition-transform">
                      <UserCheck className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-900 text-sm font-poppins group-hover:text-purple-600 transition-colors">
                        {m.mechanic_name}
                      </h3>
                      <span className="text-[10px] text-slate-400 font-bold uppercase">{monthNames[selectedMonth - 1]} {selectedYear}</span>
                    </div>
                  </div>
                  <Eye className="w-4 h-4 text-slate-400 group-hover:text-purple-600" />
                </div>

                {/* MONTH END BREAKDOWN: DAYS WORKED & TOTAL SALARY PAID */}
                <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100 flex justify-between items-center text-xs">
                  <div>
                    <span className="text-[10px] text-slate-400 font-bold uppercase block">Days Worked</span>
                    <span className="font-extrabold text-slate-900 font-poppins text-sm">
                      {m.total_days_worked || 0} / {m.total_days_in_month || totalDaysInMonth} Days
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-emerald-600 font-bold uppercase block">Monthly Payout</span>
                    <span className="font-extrabold text-emerald-700 font-poppins text-sm">
                      ₹{parseFloat(m.total_salary_paid || 0).toLocaleString()}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 pt-1 border-t border-slate-100 text-center">
                  <div className="p-2 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-100">
                    <span className="text-base font-extrabold block font-poppins">{m.present}</span>
                    <span className="text-[9px] font-bold uppercase tracking-wider block text-emerald-600">Present</span>
                  </div>
                  <div className="p-2 rounded-xl bg-amber-50 text-amber-800 border border-amber-100">
                    <span className="text-base font-extrabold block font-poppins">{m.half_day}</span>
                    <span className="text-[9px] font-bold uppercase tracking-wider block text-amber-600">Half Day</span>
                  </div>
                  <div className="p-2 rounded-xl bg-red-50 text-red-800 border border-red-100">
                    <span className="text-base font-extrabold block font-poppins">{m.absent}</span>
                    <span className="text-[9px] font-bold uppercase tracking-wider block text-red-600">Absent</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* MARK ATTENDANCE CONTROL PANEL */}
          <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200/80 soft-shadow space-y-6">
            <h2 className="text-lg font-bold text-slate-900 font-poppins flex items-center gap-2">
              <Clock className="w-5 h-5 text-purple-600" /> Today's Attendance Desk
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 items-end">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Select Mechanic</label>
                <select
                  value={selectedMechanic}
                  onChange={(e) => setSelectedMechanic(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-purple-500/20 text-sm font-medium"
                >
                  {mechanicOptions.map(m => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Attendance Status</label>
                <select
                  value={selectedStatus}
                  onChange={(e) => setSelectedStatus(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-purple-500/20 text-sm font-bold"
                >
                  <option value="PRESENT">PRESENT (Full Day)</option>
                  <option value="HALF_DAY">HALF DAY</option>
                  <option value="ABSENT">ABSENT</option>
                </select>
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={handleCheckIn}
                  className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded-xl shadow-md transition-colors flex items-center justify-center gap-1.5"
                >
                  <LogIn className="w-4 h-4" /> Check In / Mark
                </button>
                <button
                  type="button"
                  onClick={handleCheckOut}
                  className="px-4 py-3 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-xs rounded-xl transition-colors flex items-center justify-center gap-1.5"
                >
                  <LogOut className="w-4 h-4" /> Check Out
                </button>
              </div>
            </div>
          </div>

          {/* RECENT LOGS TABLE */}
          <div className="bg-white rounded-3xl border border-slate-200/80 soft-shadow overflow-hidden">
            <div className="p-6 border-b border-slate-100">
              <h2 className="text-lg font-bold text-slate-900 font-poppins">Recent Attendance Records</h2>
            </div>

            {loading ? (
              <div className="p-8 text-center text-slate-500 font-medium">Loading Attendance Logs...</div>
            ) : attendanceList.length === 0 ? (
              <div className="p-12 text-center text-slate-400 font-medium">No attendance records found.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs sm:text-sm">
                  <thead className="bg-slate-50 text-slate-600 font-bold uppercase tracking-wider text-[11px] border-b border-slate-200">
                    <tr>
                      <th className="p-4 sm:p-5">Mechanic Name</th>
                      <th className="p-4 sm:p-5">Date</th>
                      <th className="p-4 sm:p-5">Check In Time</th>
                      <th className="p-4 sm:p-5">Check Out Time</th>
                      <th className="p-4 sm:p-5">Status</th>
                      <th className="p-4 sm:p-5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {attendanceList.map((att) => (
                      <tr key={att.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="p-4 sm:p-5 font-bold text-slate-900 font-poppins">
                          <button
                            onClick={() => openMechanicProfile(att.mechanic_name)}
                            className="hover:text-purple-600 hover:underline flex items-center gap-1.5"
                          >
                            {att.mechanic_name}
                          </button>
                        </td>
                        <td className="p-4 sm:p-5 text-slate-600 font-mono text-xs">
                          {att.date}
                        </td>
                        <td className="p-4 sm:p-5 text-blue-600 font-bold text-xs font-mono">
                          {att.check_in || att.check_in_time || (att.status === 'ABSENT' ? '--' : '09:00 AM')}
                        </td>
                        <td className="p-4 sm:p-5 font-bold text-xs font-mono">
                          {(att.check_out || att.check_out_time) ? (
                            <span className="text-purple-600 font-bold">{att.check_out || att.check_out_time}</span>
                          ) : (att.status === 'PRESENT' || att.status === 'HALF_DAY') ? (
                            <span className="px-2.5 py-1 rounded-full bg-amber-50 text-amber-600 border border-amber-200 text-[10px] font-extrabold flex items-center gap-1 w-fit">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
                              ● Working (Not Checked Out)
                            </span>
                          ) : (
                            <span className="text-slate-400">--</span>
                          )}
                        </td>
                        <td className="p-4 sm:p-5">
                          <span className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase ${
                            att.status === 'PRESENT' ? 'bg-emerald-100 text-emerald-700' :
                            att.status === 'HALF_DAY' ? 'bg-amber-100 text-amber-700' :
                            'bg-red-100 text-red-700'
                          }`}>
                            {att.status}
                          </span>
                        </td>
                        <td className="p-4 sm:p-5 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => openEditModal(att)}
                              className="px-2.5 py-1 text-xs font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors border border-blue-200 flex items-center gap-1"
                              title="Edit Attendance Time/Status"
                            >
                              <Edit2 className="w-3.5 h-3.5" /> Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeleteModal({ isOpen: true, item: att, type: 'ATTENDANCE' })}
                              className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors"
                              title="Delete Attendance Log"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: MONTHLY CALENDAR GRID VIEW */}
      {activeTab === 'CALENDAR' && (
        <div className="space-y-6">
          <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200/80 soft-shadow space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-100 pb-4">
              <h2 className="text-lg font-bold text-slate-900 font-poppins flex items-center gap-2">
                <Calendar className="w-5 h-5 text-blue-600" /> Attendance Calendar Matrix ({monthNames[selectedMonth - 1]} {selectedYear})
              </h2>

              <div className="flex items-center gap-4 text-xs font-bold">
                <span className="flex items-center gap-1 text-emerald-600"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span> Present (P)</span>
                <span className="flex items-center gap-1 text-amber-600"><span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span> Half Day (H)</span>
                <span className="flex items-center gap-1 text-red-600"><span className="w-2.5 h-2.5 rounded-full bg-red-500"></span> Absent (A)</span>
              </div>
            </div>

            {loading ? (
              <div className="p-8 text-center text-slate-400 font-medium">Loading Calendar Grid...</div>
            ) : calendarData.length === 0 ? (
              <div className="p-8 text-center text-slate-400 font-medium">No mechanics found for calendar view.</div>
            ) : (
              <div className="space-y-8 overflow-x-auto">
                {calendarData.map((mechItem, idx) => (
                  <div key={idx} className="space-y-3">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-blue-600 text-white font-bold text-xs flex items-center justify-center">
                        {mechItem.mechanic_name.charAt(0)}
                      </div>
                      <h3 className="font-bold text-slate-900 text-sm font-poppins">{mechItem.mechanic_name}</h3>
                    </div>

                    <div className="grid grid-cols-7 sm:grid-cols-10 md:grid-cols-16 gap-1.5">
                      {Object.entries(mechItem.days).map(([dayNum, dayInfo]) => {
                        const isPresent = dayInfo?.status === 'PRESENT';
                        const isHalfDay = dayInfo?.status === 'HALF_DAY';
                        const isAbsent = dayInfo?.status === 'ABSENT';

                        return (
                          <div
                            key={dayNum}
                            title={dayInfo ? `${dayNum} ${monthNames[selectedMonth - 1]}: ${dayInfo.status} (In: ${dayInfo.check_in || 'N/A'})` : `Day ${dayNum}: Not marked`}
                            className={`p-2 rounded-xl text-center border font-mono text-xs transition-all ${
                              isPresent ? 'bg-emerald-50 border-emerald-200 text-emerald-800 font-bold' :
                              isHalfDay ? 'bg-amber-50 border-amber-200 text-amber-800 font-bold' :
                              isAbsent ? 'bg-red-50 border-red-200 text-red-800 font-bold' :
                              'bg-slate-50 border-slate-100 text-slate-400'
                            }`}
                          >
                            <span className="text-[10px] text-slate-400 block mb-0.5">{dayNum}</span>
                            <span className="font-extrabold block text-xs">
                              {isPresent ? 'P' : isHalfDay ? 'H' : isAbsent ? 'A' : '-'}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: MECHANIC SALARY & ADVANCE PAYMENTS (Notes Removed) */}
      {activeTab === 'SALARY' && (
        <div className="space-y-8">
          
          {/* PAYOUT RECORD FORM */}
          <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200/80 soft-shadow space-y-6">
            <h2 className="text-lg font-bold text-slate-900 font-poppins flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-emerald-600" /> Record Mechanic Salary / Advance Payout
            </h2>

            <form onSubmit={handleRecordSalary} className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Select Mechanic *</label>
                  <select
                    value={salaryForm.mechanic_name}
                    onChange={(e) => setSalaryForm({ ...salaryForm, mechanic_name: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm font-medium focus:outline-none"
                  >
                    {mechanicOptions.map(m => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Amount Paid (₹) *</label>
                  <input
                    type="number"
                    required
                    value={salaryForm.amount}
                    onChange={(e) => setSalaryForm({ ...salaryForm, amount: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm font-bold text-slate-900 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Payment Type *</label>
                  <select
                    value={salaryForm.payment_type}
                    onChange={(e) => setSalaryForm({ ...salaryForm, payment_type: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm font-bold focus:outline-none"
                  >
                    <option value="SALARY">Full Monthly Salary</option>
                    <option value="ADVANCE">Advance Payment</option>
                    <option value="BONUS">Bonus / Incentive</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Payment Date *</label>
                <input
                  type="date"
                  required
                  value={salaryForm.payment_date}
                  onChange={(e) => setSalaryForm({ ...salaryForm, payment_date: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm focus:outline-none max-w-sm"
                />
              </div>

              <button
                type="submit"
                className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-2"
              >
                <PlusCircle className="w-4 h-4" /> Save Salary / Advance Payout Entry
              </button>
            </form>
          </div>

          {/* SALARY PAYOUT HISTORY TABLE (Notes Removed) */}
          <div className="bg-white rounded-3xl border border-slate-200/80 soft-shadow overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center">
              <h2 className="text-lg font-bold text-slate-900 font-poppins">Salary & Advance Payment History</h2>
              <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-100">
                Total Paid: ₹{salaryPayments.reduce((sum, p) => sum + parseFloat(p.amount || 0), 0).toFixed(2)}
              </span>
            </div>

            {loading ? (
              <div className="p-8 text-center text-slate-500 font-medium">Loading Salary Records...</div>
            ) : salaryPayments.length === 0 ? (
              <div className="p-12 text-center text-slate-400 font-medium">No salary payouts recorded yet.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs sm:text-sm">
                  <thead className="bg-slate-50 text-slate-600 font-bold uppercase tracking-wider text-[11px] border-b border-slate-200">
                    <tr>
                      <th className="p-4 sm:p-5">Mechanic Name</th>
                      <th className="p-4 sm:p-5">Payment Date</th>
                      <th className="p-4 sm:p-5">Type</th>
                      <th className="p-4 sm:p-5">Amount Paid</th>
                      <th className="p-4 sm:p-5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {salaryPayments.map((p) => (
                      <tr key={p.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="p-4 sm:p-5 font-bold text-slate-900 font-poppins">{p.mechanic_name}</td>
                        <td className="p-4 sm:p-5 text-slate-600 font-mono text-xs">{p.payment_date}</td>
                        <td className="p-4 sm:p-5">
                          <span className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase ${
                            p.payment_type === 'SALARY' ? 'bg-emerald-100 text-emerald-700' :
                            p.payment_type === 'ADVANCE' ? 'bg-blue-100 text-blue-700' :
                            'bg-purple-100 text-purple-700'
                          }`}>
                            {p.payment_type}
                          </span>
                        </td>
                        <td className="p-4 sm:p-5 font-extrabold text-emerald-700 font-poppins text-sm">
                          ₹{parseFloat(p.amount).toFixed(2)}
                        </td>
                        <td className="p-4 sm:p-5 text-right">
                          <button
                            onClick={() => setDeleteModal({ isOpen: true, item: p, type: 'SALARY' })}
                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors"
                            title="Delete Salary Entry (Move to Recycle Bin)"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

        </div>
      )}

      {/* ADMIN PASSWORD DELETE MODAL */}
      <AdminPasswordModal
        isOpen={deleteModal.isOpen}
        onClose={() => setDeleteModal({ isOpen: false, item: null, type: 'ATTENDANCE' })}
        onConfirm={handleDeleteWithPassword}
        title={deleteModal.type === 'SALARY' ? 'Delete Salary Payout Record' : 'Delete Attendance Log'}
        itemDescription={
          deleteModal.item
            ? deleteModal.type === 'SALARY'
              ? `Salary Payout of ₹${deleteModal.item.amount} for ${deleteModal.item.mechanic_name}`
              : `Attendance entry for ${deleteModal.item.mechanic_name} (${deleteModal.item.date})`
            : 'entry'
        }
      />

      {/* EDIT ATTENDANCE MODAL */}
      {editModal.isOpen && editModal.item && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full space-y-6 shadow-2xl">
            <h2 className="text-xl font-bold text-slate-900 font-poppins flex items-center gap-2">
              <Edit2 className="w-5 h-5 text-blue-600" /> Edit Attendance Record
            </h2>
            <div className="p-3 bg-slate-50 rounded-xl text-xs text-slate-700">
              Mechanic: <strong>{editModal.item.mechanic_name}</strong> • Date: <strong>{editModal.item.date}</strong>
            </div>

            <form onSubmit={handleSaveEditedAttendance} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Check In Time</label>
                <input
                  type="text"
                  value={editModal.check_in_time}
                  onChange={(e) => setEditModal(prev => ({ ...prev, check_in_time: e.target.value }))}
                  placeholder="e.g. 09:00 AM"
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-mono font-bold focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Check Out Time</label>
                <input
                  type="text"
                  value={editModal.check_out_time}
                  onChange={(e) => setEditModal(prev => ({ ...prev, check_out_time: e.target.value }))}
                  placeholder="e.g. 07:30 PM (leave blank if currently working)"
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-mono font-bold focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Status</label>
                <select
                  value={editModal.status}
                  onChange={(e) => setEditModal(prev => ({ ...prev, status: e.target.value }))}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                >
                  <option value="PRESENT">PRESENT (Full Day)</option>
                  <option value="HALF_DAY">HALF DAY</option>
                  <option value="ABSENT">ABSENT</option>
                </select>
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setEditModal({ isOpen: false, item: null, check_in_time: '', check_out_time: '', status: 'PRESENT' })}
                  className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-lg shadow-blue-600/30 transition-all"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
