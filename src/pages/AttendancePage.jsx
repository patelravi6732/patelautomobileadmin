import React, { useState, useEffect } from 'react';
import { Clock, LogIn, LogOut, CheckCircle2, UserCheck, Calendar, Undo2, Trash2, XCircle, AlertCircle, Award, Eye, DollarSign, PlusCircle, CreditCard, ChevronLeft, ChevronRight } from 'lucide-react';
import API from '../services/api';
import { useAuth } from '../context/AuthContext';
import AdminPasswordModal from '../components/AdminPasswordModal';
import MechanicProfileModal from '../components/MechanicProfileModal';

export default function AttendancePage() {
  const { garageInfo } = useAuth();
  const [activeTab, setActiveTab] = useState('ATTENDANCE'); // ATTENDANCE, CALENDAR, SALARY
  
  const [attendanceList, setAttendanceList] = useState([]);
  const [summaryList, setSummaryList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [mechanicOptions, setMechanicOptions] = useState(['Patel Owner', 'Ramesh Mechanic', 'Suresh Technician']);
  const [selectedMechanic, setSelectedMechanic] = useState('Patel Owner');
  const [selectedStatus, setSelectedStatus] = useState('PRESENT');

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
      const parsed = garageInfo.mechanics_list.split(',').map(m => m.trim()).filter(Boolean);
      if (parsed.length > 0) {
        setMechanicOptions(parsed);
        setSelectedMechanic(parsed[0]);
        setSalaryForm(prev => ({ ...prev, mechanic_name: parsed[0] }));
      }
    }
  }, [garageInfo]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [attRes, sumRes, calRes, salRes] = await Promise.all([
        API.get('/attendance/', { timeout: 1500 }),
        API.get(`/attendance/monthly_summary/?month=${selectedMonth}&year=${selectedYear}`, { timeout: 1500 }),
        API.get(`/attendance/monthly_calendar/?month=${selectedMonth}&year=${selectedYear}`, { timeout: 1500 }),
        API.get('/salary-payments/', { timeout: 1500 })
      ]);
      setAttendanceList(attRes.data || []);
      setSummaryList(sumRes.data?.summary || []);
      setCalendarData(calRes.data?.calendar_data || []);
      setTotalDaysInMonth(calRes.data?.total_days_in_month || 31);
      setSalaryPayments(salRes.data || []);
    } catch (err) {
      console.warn('Backend API offline for Attendance, using fast local fallback:', err);
      setAttendanceList(JSON.parse(localStorage.getItem('local_attendance') || '[]'));
      setSalaryPayments(JSON.parse(localStorage.getItem('local_salary_payments') || '[]'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [selectedMonth, selectedYear]);

  const handleMarkAttendance = async () => {
    try {
      const res = await API.post('/attendance/mark_status/', {
        mechanic_name: selectedMechanic,
        status: selectedStatus
      });
      alert(res.data.message);
      fetchData();
    } catch (err) {
      alert(err.response?.data?.error || 'Mark attendance failed');
    }
  };

  const handleCheckOut = async () => {
    try {
      const res = await API.post('/attendance/check_out/', { mechanic_name: selectedMechanic });
      alert(res.data.message);
      fetchData();
    } catch (err) {
      alert(err.response?.data?.error || 'Check out failed');
    }
  };

  const handleRecordSalary = async (e) => {
    e.preventDefault();
    if (!salaryForm.amount || parseFloat(salaryForm.amount) <= 0) {
      alert('Please enter a valid salary amount.');
      return;
    }

    try {
      await API.post('/salary-payments/', salaryForm);
      alert(`₹${salaryForm.amount} payout recorded for ${salaryForm.mechanic_name}!`);
      setSalaryForm(prev => ({ ...prev, amount: '' }));
      fetchData();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to record salary payout');
    }
  };

  const handleDeleteWithPassword = async (adminPassword) => {
    if (!deleteModal.item) return;

    if (deleteModal.type === 'ATTENDANCE') {
      await API.post(`/attendance/${deleteModal.item.id}/delete_with_password/`, { admin_password: adminPassword });
      alert('Attendance log moved to Recycle Bin!');
    } else if (deleteModal.type === 'SALARY') {
      await API.post(`/salary-payments/${deleteModal.item.id}/delete_with_password/`, { admin_password: adminPassword });
      alert('Salary payout record moved to Recycle Bin!');
    }
    fetchData();
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
                  onClick={handleMarkAttendance}
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
                          {att.check_in_time ? att.check_in_time : (att.status === 'ABSENT' ? '--' : '09:00 AM')}
                        </td>
                        <td className="p-4 sm:p-5 font-bold text-xs font-mono">
                          {att.check_out_time ? (
                            <span className="text-purple-600 font-bold">{att.check_out_time}</span>
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
                          <button
                            onClick={() => setDeleteModal({ isOpen: true, item: att, type: 'ATTENDANCE' })}
                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors"
                            title="Delete Attendance Log"
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

      {/* MECHANIC PROFILE MODAL */}
      <MechanicProfileModal
        isOpen={profileModal.isOpen}
        onClose={() => setProfileModal({ isOpen: false, mechanicName: '' })}
        mechanicName={profileModal.mechanicName}
      />

    </div>
  );
}
