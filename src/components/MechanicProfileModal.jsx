import React, { useState, useEffect } from 'react';
import { UserCheck, Calendar, Clock, Award, X, CheckCircle2, AlertCircle, Wrench } from 'lucide-react';
import API from '../services/api';
import { fetchCloudAttendance, fetchCloudSalaryPayments } from '../utils/cloudSync';

export default function MechanicProfileModal({ isOpen, onClose, mechanicName }) {
  const [profileData, setProfileData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isOpen && mechanicName) {
      setLoading(true);
      
      const loadProfile = async () => {
        let backendData = null;
        try {
          const res = await API.get(`/attendance/mechanic_profile/?mechanic_name=${encodeURIComponent(mechanicName)}`, { timeout: 1200 });
          backendData = res.data;
        } catch (err) {
          console.warn('Backend API offline for Mechanic Profile, aggregating from local & cloud stores:', err);
        }

        if (backendData && backendData.mechanic_name) {
          setProfileData(backendData);
          setLoading(false);
          return;
        }

        // Aggregate local & cloud attendance & salary records
        const localAtt = JSON.parse(localStorage.getItem('local_attendance') || '[]');
        const cloudAtt = await fetchCloudAttendance();
        const combinedAtt = [...localAtt, ...cloudAtt].filter(a => a && a.mechanic_name === mechanicName);

        const localSal = JSON.parse(localStorage.getItem('local_salary_payments') || '[]');
        const cloudSal = await fetchCloudSalaryPayments();
        const combinedSal = [...localSal, ...cloudSal].filter(s => s && s.mechanic_name === mechanicName);

        const now = new Date();
        const curMonth = now.getMonth() + 1;
        const curYear = now.getFullYear();

        const monthAtt = combinedAtt.filter(a => {
          const d = new Date(a.date);
          return !isNaN(d.getTime()) && (d.getMonth() + 1) === curMonth && d.getFullYear() === curYear;
        });

        const presentCount = monthAtt.filter(a => a.status === 'PRESENT').length;
        const halfDayCount = monthAtt.filter(a => a.status === 'HALF_DAY').length;
        const absentCount = monthAtt.filter(a => a.status === 'ABSENT').length;
        const daysWorked = presentCount + (halfDayCount * 0.5);

        const monthSal = combinedSal.filter(s => {
          const dt = new Date(s.payment_date || s.created_at || s.date);
          return !isNaN(dt.getTime()) && (dt.getMonth() + 1) === curMonth && dt.getFullYear() === curYear;
        });

        const totalSalaryPaid = monthSal.reduce((acc, s) => acc + parseFloat(s.amount || 0), 0);

        setProfileData({
          mechanic_name: mechanicName,
          current_month: `${now.toLocaleString('en-US', { month: 'long' })} ${curYear}`,
          present: presentCount,
          half_day: halfDayCount,
          absent: absentCount,
          total_days_worked: daysWorked,
          total_salary_paid: totalSalaryPaid,
          attendance_logs: combinedAtt.slice(0, 10),
          salary_history: combinedSal.slice(0, 10)
        });
        setLoading(false);
      };

      loadProfile();
    }
  }, [isOpen, mechanicName]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-2xl w-full space-y-6 shadow-2xl relative max-h-[90vh] overflow-y-auto">
        
        <button
          onClick={onClose}
          className="absolute top-5 right-5 text-slate-400 hover:text-slate-600 p-1.5 rounded-full hover:bg-slate-100 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* HEADER PROFILE AVATAR */}
        <div className="flex items-center gap-4 border-b border-slate-100 pb-5">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-purple-600 via-indigo-600 to-blue-600 text-white flex items-center justify-center font-bold text-2xl shadow-lg shadow-purple-500/30">
            {mechanicName ? mechanicName.charAt(0).toUpperCase() : 'M'}
          </div>
          <div>
            <h2 className="text-2xl font-bold text-slate-900 font-poppins">{mechanicName}</h2>
            <p className="text-xs text-purple-600 font-semibold flex items-center gap-1.5 mt-0.5">
              <UserCheck className="w-4 h-4" /> Workshop Staff • {profileData?.current_month || 'Current Month'} Profile
            </p>
          </div>
        </div>

        {loading ? (
          <div className="p-8 text-center text-slate-400 font-medium">Loading Mechanic Attendance Profile...</div>
        ) : !profileData ? (
          <div className="p-8 text-center text-slate-400 font-medium">Failed to load profile data.</div>
        ) : (
          <div className="space-y-6">
            
            {/* MONTHLY SUMMARY COUNTERS */}
            <div className="space-y-2">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
                Monthly Attendance Breakdown ({profileData.current_month}):
              </span>
              <div className="grid grid-cols-4 gap-3">
                <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-center">
                  <span className="text-2xl font-extrabold text-emerald-700 font-poppins block">{profileData.present_count}</span>
                  <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider block mt-0.5">Present Days</span>
                </div>
                <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-center">
                  <span className="text-2xl font-extrabold text-amber-700 font-poppins block">{profileData.half_day_count}</span>
                  <span className="text-[10px] font-bold text-amber-600 uppercase tracking-wider block mt-0.5">Half Days</span>
                </div>
                <div className="p-3.5 rounded-2xl bg-red-50 border border-red-200 text-center">
                  <span className="text-2xl font-extrabold text-red-700 font-poppins block">{profileData.absent_count}</span>
                  <span className="text-[10px] font-bold text-red-600 uppercase tracking-wider block mt-0.5">Absent Days</span>
                </div>
                <div className="p-3.5 rounded-2xl bg-purple-50 border border-purple-200 text-center">
                  <span className="text-2xl font-extrabold text-purple-700 font-poppins block">{profileData.finished_jobs_count}</span>
                  <span className="text-[10px] font-bold text-purple-600 uppercase tracking-wider block mt-0.5">Bikes Serviced</span>
                </div>
              </div>
            </div>

            {/* RECENT CHECK-IN / CHECK-OUT LOGS */}
            <div className="space-y-3">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
                Detailed Check-In / Check-Out History (12-Hour AM/PM Format):
              </span>

              {profileData.attendance_history.length === 0 ? (
                <p className="text-xs text-slate-400 italic py-2">No attendance logs recorded yet.</p>
              ) : (
                <div className="border border-slate-200 rounded-2xl overflow-hidden max-h-60 overflow-y-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-slate-600 font-bold uppercase tracking-wider text-[10px] border-b border-slate-200">
                      <tr>
                        <th className="p-3">Date</th>
                        <th className="p-3">Check In</th>
                        <th className="p-3">Check Out</th>
                        <th className="p-3 text-right">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium">
                      {profileData.attendance_history.map((record) => (
                        <tr key={record.id} className="hover:bg-slate-50/80">
                          <td className="p-3 font-mono font-bold text-slate-900">{record.date}</td>
                          <td className="p-3 font-semibold text-blue-600 flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5 text-blue-500" /> {record.check_in_time}
                          </td>
                          <td className="p-3 font-semibold text-purple-600">
                            {record.check_out_time}
                          </td>
                          <td className="p-3 text-right">
                            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${
                              record.status === 'PRESENT' ? 'bg-emerald-100 text-emerald-700' :
                              record.status === 'HALF_DAY' ? 'bg-amber-100 text-amber-700' :
                              'bg-red-100 text-red-700'
                            }`}>
                              {record.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="pt-2 text-right">
              <button
                type="button"
                onClick={onClose}
                className="px-6 py-2.5 bg-slate-900 text-white font-bold text-xs rounded-xl shadow-md"
              >
                Close Profile
              </button>
            </div>

          </div>
        )}

      </div>
    </div>
  );
}
