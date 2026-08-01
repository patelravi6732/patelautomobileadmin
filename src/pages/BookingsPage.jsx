import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { CalendarCheck, Check, X, ArrowRight, Phone, Bike, Trash2, Send, RefreshCw, MessageSquare } from 'lucide-react';
import API from '../services/api';
import AdminPasswordModal from '../components/AdminPasswordModal';
import { useAuth } from '../context/AuthContext';
import { generateBookingNotificationMessage } from '../utils/aiMessageGenerator';
import { fetchCloudBookings, updateCloudBookingStatus, pushCloudJob } from '../utils/cloudSync';

const DEFAULT_BOOKING_DATE = new Date();

export default function BookingsPage() {
  const { garageInfo } = useAuth();
  const garagePhone = garageInfo?.phone || '+91 81403 71414';

  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deleteModal, setDeleteModal] = useState({ isOpen: false, booking: null });
  
  // Action Confirmation Modal State (Prevents Accidental Accept/Reject)
  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    booking: null,
    actionType: 'ACCEPT' // 'ACCEPT' or 'REJECT'
  });

  // WhatsApp Notification Modal State
  const [notifyModal, setNotifyModal] = useState({
    isOpen: false,
    booking: null,
    isAccepted: true,
    lang: 'GUJARATI',
    variationIndex: 0,
    text: ''
  });

  const [selectedMonth, setSelectedMonth] = useState(DEFAULT_BOOKING_DATE.getMonth());
  const [selectedYear, setSelectedYear] = useState(DEFAULT_BOOKING_DATE.getFullYear());
  const [selectedStatus, setSelectedStatus] = useState(null);
  const navigate = useNavigate();

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  const fetchBookings = async () => {
    setLoading(true);
    let backendBookings = [];
    try {
      const res = await API.get('/bookings/');
      backendBookings = res.data || [];
    } catch (err) {
      console.warn('Backend API offline or unreachable:', err);
    }

    const localBookings = JSON.parse(localStorage.getItem('local_bookings') || '[]');
    const cloudBookings = await fetchCloudBookings();

    const allBookingsMap = new Map();
    [...backendBookings, ...localBookings, ...cloudBookings].forEach(b => {
      const uniqueKey = b.id || `${b.vehicle_number}_${b.preferred_date}`;
      if (!allBookingsMap.has(uniqueKey)) {
        allBookingsMap.set(uniqueKey, b);
      }
    });

    const mergedList = Array.from(allBookingsMap.values()).sort(
      (a, b) => new Date(b.created_at || Date.now()) - new Date(a.created_at || Date.now())
    );

    setBookings(mergedList);
    setLoading(false);
  };

  useEffect(() => {
    fetchBookings();
  }, []);

  const openNotifyModal = (booking, isAccepted) => {
    const defaultLang = 'GUJARATI';
    const initialText = generateBookingNotificationMessage(booking, isAccepted, defaultLang, 0, garagePhone);
    setNotifyModal({
      isOpen: true,
      booking,
      isAccepted,
      lang: defaultLang,
      variationIndex: 0,
      text: initialText
    });
  };

  const handleLangChange = (newLang) => {
    if (!notifyModal.booking) return;
    const newText = generateBookingNotificationMessage(
      notifyModal.booking,
      notifyModal.isAccepted,
      newLang,
      notifyModal.variationIndex,
      garagePhone
    );
    setNotifyModal(prev => ({
      ...prev,
      lang: newLang,
      text: newText
    }));
  };

  const handleRegenerateText = () => {
    if (!notifyModal.booking) return;
    const nextIndex = notifyModal.variationIndex + 1;
    const newText = generateBookingNotificationMessage(
      notifyModal.booking,
      notifyModal.isAccepted,
      notifyModal.lang,
      nextIndex,
      garagePhone
    );
    setNotifyModal(prev => ({
      ...prev,
      variationIndex: nextIndex,
      text: newText
    }));
  };

  const sendWhatsAppNotification = () => {
    if (!notifyModal.booking) return;
    let phoneClean = notifyModal.booking.mobile_number.replace(/\D/g, '');
    if (!phoneClean.startsWith('91') && phoneClean.length === 10) {
      phoneClean = '91' + phoneClean;
    }
    const encoded = encodeURIComponent(notifyModal.text);
    window.open(`https://wa.me/${phoneClean}?text=${encoded}`, '_blank');
    setNotifyModal({ isOpen: false, booking: null, isAccepted: true, lang: 'GUJARATI', variationIndex: 0, text: '' });
  };

  const monthBookings = useMemo(() => bookings.filter((booking) => {
    const bookingDate = new Date(`${booking.preferred_date}T00:00:00`);
    return !Number.isNaN(bookingDate.getTime())
      && bookingDate.getMonth() === selectedMonth
      && bookingDate.getFullYear() === selectedYear;
  }), [bookings, selectedMonth, selectedYear]);

  const visibleBookings = useMemo(() => {
    if (!selectedStatus) return monthBookings;
    return monthBookings.filter((booking) => booking.status === selectedStatus);
  }, [monthBookings, selectedStatus]);

  const availableYears = useMemo(() => {
    const bookingYears = bookings
      .map((booking) => Number(String(booking.preferred_date || '').slice(0, 4)))
      .filter((year) => Number.isInteger(year) && year > 2000);
    const firstYear = Math.min(selectedYear, ...bookingYears, DEFAULT_BOOKING_DATE.getFullYear());
    const lastYear = Math.max(selectedYear + 5, ...bookingYears, DEFAULT_BOOKING_DATE.getFullYear() + 5);
    return Array.from({ length: lastYear - firstYear + 1 }, (_, index) => firstYear + index);
  }, [bookings, selectedYear]);

  const initiateAccept = (booking) => {
    setConfirmModal({
      isOpen: true,
      booking,
      actionType: 'ACCEPT'
    });
  };

  const initiateReject = (booking) => {
    setConfirmModal({
      isOpen: true,
      booking,
      actionType: 'REJECT'
    });
  };

  const handleConfirmAction = async () => {
    const { booking, actionType } = confirmModal;
    if (!booking) return;

    setConfirmModal({ isOpen: false, booking: null, actionType: 'ACCEPT' });
    const newStatus = actionType === 'ACCEPT' ? 'ACCEPTED' : 'REJECTED';

    // Update Global Cloud Store so status updates sync across devices
    updateCloudBookingStatus(booking.id, newStatus).catch(console.warn);

    // Update local state directly
    setBookings(prev => prev.map(b => b.id === booking.id ? { ...b, status: newStatus } : b));

    try {
      if (actionType === 'ACCEPT') {
        await API.post(`/bookings/${booking.id}/accept/`);
      } else {
        await API.post(`/bookings/${booking.id}/reject/`);
      }
    } catch (err) {
      console.warn('Backend API offline or error on static host:', err);
    } finally {
      openNotifyModal(booking, actionType === 'ACCEPT');
    }
  };

  const handleConvert = async (booking) => {
    const bookingObj = typeof booking === 'object' ? booking : bookings.find(b => b.id === booking);
    if (!bookingObj) return;

    const newJobCard = {
      id: Date.now(),
      customer_name: bookingObj.customer_name,
      mobile_number: bookingObj.mobile_number,
      vehicle_number: bookingObj.vehicle_number,
      bike_model: bookingObj.bike_model || 'Commuter Bike',
      complaint: bookingObj.complaint || 'General Service & Repair',
      assigned_mechanic: 'Vijay Owner',
      labour_charge: 300.00,
      parts_total: 0.00,
      live_total: 300.00,
      status: 'IN_PROGRESS',
      created_at: new Date().toISOString()
    };

    pushCloudJob(newJobCard).catch(console.warn);

    const existingJobs = JSON.parse(localStorage.getItem('workshop_jobs') || '[]');
    existingJobs.push(newJobCard);
    localStorage.setItem('workshop_jobs', JSON.stringify(existingJobs));

    updateCloudBookingStatus(bookingObj.id, 'ACCEPTED').catch(console.warn);

    try {
      await API.post(`/bookings/${bookingObj.id}/convert_to_service/`);
    } catch (err) {
      console.warn('Backend API offline or static host fallback for convert:', err);
    } finally {
      alert('Successfully converted to active Workshop Job Card!');
      const basePrefix = window.location.pathname.startsWith('/admin') ? '/admin' : '/app';
      navigate(`${basePrefix}/workshop`);
    }
  };

  const handleDeleteWithPassword = async (adminPassword) => {
    if (!deleteModal.booking) return;
    await API.post(`/bookings/${deleteModal.booking.id}/delete_with_password/`, {
      admin_password: adminPassword
    });
    alert('Booking deleted successfully!');
    fetchBookings();
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 font-poppins flex items-center gap-2.5">
            <CalendarCheck className="w-7 h-7 text-blue-600" /> Online Service Bookings
          </h1>
        </div>
        <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
          Showing: {visibleBookings.length}
        </div>
      </div>

      <section className="bg-white rounded-3xl border border-slate-200/80 soft-shadow p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3 text-slate-800">
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
            <CalendarCheck className="w-5 h-5" />
          </div>
          <span className="text-sm font-extrabold uppercase tracking-wide">Select Month &amp; Year:</span>
        </div>
        <div className="flex items-center gap-3">
            <select
              value={selectedMonth}
              onChange={(event) => setSelectedMonth(Number(event.target.value))}
              className="min-w-36 px-4 py-3 rounded-2xl border border-slate-200 bg-slate-50 text-sm font-bold text-slate-800 outline-none focus:border-blue-500"
              aria-label="Select booking month"
            >
              {monthNames.map((month, index) => <option key={month} value={index}>{month}</option>)}
            </select>
            <select
              value={selectedYear}
              onChange={(event) => setSelectedYear(Number(event.target.value))}
              className="min-w-24 px-4 py-3 rounded-2xl border border-slate-200 bg-slate-50 text-sm font-bold text-slate-800 outline-none focus:border-blue-500"
              aria-label="Select booking year"
            >
              {availableYears.map((year) => <option key={year} value={year}>{year}</option>)}
            </select>
        </div>
      </section>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => setSelectedStatus(null)}
          className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-xs font-extrabold transition-all ${!selectedStatus ? 'bg-slate-800 text-white border-slate-800 shadow-md shadow-slate-200' : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'}`}
        >
          All
          <span className={`min-w-5 h-5 px-1.5 rounded-full text-[10px] flex items-center justify-center ${!selectedStatus ? 'bg-white/20' : 'bg-white'}`}>{monthBookings.length}</span>
        </button>
        {[
          { status: 'COMPLETED', label: 'Completed', active: 'bg-emerald-600 text-white border-emerald-600 shadow-emerald-200', idle: 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100' },
          { status: 'PENDING', label: 'Pending', active: 'bg-amber-500 text-white border-amber-500 shadow-amber-200', idle: 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100' },
          { status: 'REJECTED', label: 'Rejected', active: 'bg-rose-600 text-white border-rose-600 shadow-rose-200', idle: 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100' },
        ].map((filter) => {
          const count = monthBookings.filter((booking) => booking.status === filter.status).length;
          const isActive = selectedStatus === filter.status;
          return (
            <button
              key={filter.status}
              type="button"
              onClick={() => setSelectedStatus(isActive ? null : filter.status)}
              className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-xs font-extrabold transition-all ${isActive ? `${filter.active} shadow-md` : filter.idle}`}
            >
              {filter.label}
              <span className={`min-w-5 h-5 px-1.5 rounded-full text-[10px] flex items-center justify-center ${isActive ? 'bg-white/20' : 'bg-white/70'}`}>{count}</span>
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="p-8 text-center text-slate-500 font-medium">Loading Online Bookings...</div>
      ) : visibleBookings.length === 0 ? (
        <div className="bg-white p-12 rounded-3xl border border-slate-200 text-center text-slate-400 font-medium">
          No {selectedStatus ? selectedStatus.toLowerCase() : ''} bookings scheduled for {monthNames[selectedMonth]} {selectedYear}.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {visibleBookings.map((b) => (
            <div key={b.id} className="bg-white p-6 rounded-3xl border border-slate-200/80 soft-shadow flex flex-col justify-between space-y-6">
              
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-sm font-extrabold px-3 py-1 bg-slate-900 text-amber-400 rounded-xl tracking-wider">
                    {b.vehicle_number}
                  </span>
                  <span className={`text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full ${
                    b.status === 'ACCEPTED' ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' :
                    b.status === 'REJECTED' ? 'bg-red-100 text-red-700 border border-red-200' :
                    b.status === 'COMPLETED' ? 'bg-blue-100 text-blue-700 border border-blue-200' :
                    'bg-amber-100 text-amber-700 border border-amber-200 animate-pulse'
                  }`}>
                    {b.status}
                  </span>
                </div>

                <div className="space-y-1">
                  <h3 className="font-bold text-slate-900 font-poppins text-base">{b.customer_name}</h3>
                  <p className="text-xs text-slate-500 flex items-center gap-1">
                    <Phone className="w-3.5 h-3.5 text-emerald-600" /> {b.mobile_number}
                  </p>
                  <p className="text-xs text-slate-500 flex items-center gap-1">
                    <Bike className="w-3.5 h-3.5 text-blue-600" /> Model: <strong className="text-slate-800">{b.bike_model}</strong>
                  </p>
                </div>

                <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100 text-xs space-y-1">
                  <div className="flex items-center justify-between text-slate-600">
                    <span>Preferred Date:</span>
                    <span className="font-bold text-slate-900">{b.preferred_date}</span>
                  </div>
                  <div className="flex items-center justify-between text-slate-600">
                    <span>Time Slot:</span>
                    <span className="font-bold text-slate-900">{b.preferred_time}</span>
                  </div>
                </div>

                {b.complaint_details && (
                  <div className="p-3 rounded-xl bg-orange-50/50 border border-orange-100 text-xs text-slate-700">
                    <span className="font-bold text-orange-800 block mb-0.5">Complaint / Service:</span>
                    "{b.complaint_details}"
                  </div>
                )}
              </div>

              {/* ACTION BUTTONS & WHATSAPP NOTIFICATION TRIGGER */}
              <div className="space-y-2 pt-4 border-t border-slate-100">
                {b.status === 'PENDING' && (
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => initiateAccept(b)}
                      className="py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors flex items-center justify-center gap-1"
                    >
                      <Check className="w-4 h-4" /> Accept
                    </button>
                    <button
                      onClick={() => initiateReject(b)}
                      className="py-2.5 bg-red-50 hover:bg-red-100 text-red-600 font-bold text-xs rounded-xl transition-colors flex items-center justify-center gap-1"
                    >
                      <X className="w-4 h-4" /> Reject
                    </button>
                  </div>
                )}

                {(b.status === 'ACCEPTED' || b.status === 'REJECTED') && (
                  <button
                    onClick={() => openNotifyModal(b, b.status === 'ACCEPTED')}
                    className="w-full py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold text-xs rounded-xl border border-emerald-200 transition-colors flex items-center justify-center gap-1.5"
                  >
                    <MessageSquare className="w-3.5 h-3.5" /> Send WhatsApp Notification
                  </button>
                )}

                {(b.status === 'PENDING' || b.status === 'ACCEPTED') && (
                  <button
                    onClick={() => handleConvert(b.id)}
                    className="w-full py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-extrabold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-2"
                  >
                    Convert To Active Job Card <ArrowRight className="w-4 h-4" />
                  </button>
                )}

                <button
                  onClick={() => setDeleteModal({ isOpen: true, booking: b })}
                  className="w-full py-2 bg-slate-100 hover:bg-red-50 text-slate-500 hover:text-red-600 font-bold text-xs rounded-xl transition-colors flex items-center justify-center gap-1.5"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Delete Booking (Password Protected)
                </button>
              </div>

            </div>
          ))}
        </div>
      )}

      {/* WHATSAPP NOTIFICATION MODAL WITH GUJARATI/ENGLISH TOGGLE & RE-GENERATE */}
      {notifyModal.isOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 text-white rounded-3xl p-6 sm:p-8 max-w-lg w-full space-y-6 shadow-2xl border border-slate-800 relative animate-in fade-in zoom-in duration-200">
            
            <button
              onClick={() => setNotifyModal({ isOpen: false, booking: null, isAccepted: true, lang: 'GUJARATI', variationIndex: 0, text: '' })}
              className="absolute top-5 right-5 text-slate-400 hover:text-white p-1.5 rounded-full hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 border-b border-slate-800 pb-4">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white flex items-center justify-center shrink-0 shadow-lg shadow-emerald-500/30">
                <MessageSquare className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white font-poppins">
                  {notifyModal.isAccepted ? 'Send Booking Acceptance Alert' : 'Send Booking Rejection Alert'}
                </h3>
                <p className="text-xs text-slate-400">Patel Automobiles Customer Notification System</p>
              </div>
            </div>

            {/* LANGUAGE SELECTOR BUTTONS: GUJARATI & ENGLISH */}
            <div className="space-y-2">
              <span className="text-xs font-bold text-slate-300 uppercase tracking-wider block">
                Select Message Language:
              </span>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => handleLangChange('GUJARATI')}
                  className={`flex-1 py-2.5 rounded-xl text-xs font-extrabold transition-all border ${
                    notifyModal.lang === 'GUJARATI'
                      ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white border-emerald-500 shadow-md shadow-emerald-600/30'
                      : 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-750'
                  }`}
                >
                  Gujarati
                </button>
                <button
                  type="button"
                  onClick={() => handleLangChange('ENGLISH')}
                  className={`flex-1 py-2.5 rounded-xl text-xs font-extrabold transition-all border ${
                    notifyModal.lang === 'ENGLISH'
                      ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white border-blue-500 shadow-md shadow-blue-600/30'
                      : 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-750'
                  }`}
                >
                  English
                </button>
              </div>
            </div>

            {/* EDITABLE TEXTAREA WITH RE-GENERATE BUTTON */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                  AI Generated Message (Editable):
                </span>
                <button
                  type="button"
                  onClick={handleRegenerateText}
                  className="text-xs font-bold text-amber-400 hover:text-amber-300 flex items-center gap-1 transition-colors"
                >
                  <RefreshCw className="w-3.5 h-3.5" /> Re-Generate AI Draft
                </button>
              </div>

              <textarea
                rows={8}
                value={notifyModal.text}
                onChange={(e) => setNotifyModal(prev => ({ ...prev, text: e.target.value }))}
                className="w-full p-4 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs font-sans leading-relaxed focus:outline-none focus:border-emerald-500 shadow-inner"
              ></textarea>
            </div>

            {/* SEND BUTTON */}
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setNotifyModal({ isOpen: false, booking: null, isAccepted: true, lang: 'GUJARATI', variationIndex: 0, text: '' })}
                className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={sendWhatsAppNotification}
                className="flex-1 py-3 bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 hover:from-emerald-500 hover:to-teal-600 text-white font-bold text-xs rounded-xl shadow-lg transition-all flex items-center justify-center gap-2"
              >
                <Send className="w-4 h-4" /> Send WhatsApp
              </button>
            </div>

          </div>
        </div>
      )}

      {/* PROFESSIONAL ACTION CONFIRMATION MODAL (ENGLISH) */}
      {confirmModal.isOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 text-white rounded-3xl p-6 sm:p-8 max-w-md w-full space-y-6 shadow-2xl border border-slate-800 relative animate-in fade-in zoom-in duration-200">
            
            <button
              onClick={() => setConfirmModal({ isOpen: false, booking: null, actionType: 'ACCEPT' })}
              className="absolute top-5 right-5 text-slate-400 hover:text-white p-1.5 rounded-full hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 border-b border-slate-800 pb-4">
              <div className={`w-12 h-12 rounded-2xl text-white flex items-center justify-center shrink-0 shadow-lg ${
                confirmModal.actionType === 'ACCEPT' 
                  ? 'bg-gradient-to-tr from-emerald-600 to-teal-500 shadow-emerald-500/30' 
                  : 'bg-gradient-to-tr from-rose-600 to-red-500 shadow-rose-500/30'
              }`}>
                {confirmModal.actionType === 'ACCEPT' ? <Check className="w-6 h-6" /> : <X className="w-6 h-6" />}
              </div>
              <div>
                <h3 className="text-lg font-bold text-white font-poppins">
                  {confirmModal.actionType === 'ACCEPT' ? 'Confirm Booking Acceptance' : 'Confirm Booking Rejection'}
                </h3>
                <p className="text-xs text-slate-400">Patel Automobiles Administrative Action</p>
              </div>
            </div>

            <div className="space-y-3">
              <p className="text-sm text-slate-300 leading-relaxed">
                Are you sure you want to <strong className={confirmModal.actionType === 'ACCEPT' ? 'text-emerald-400' : 'text-rose-400'}>
                  {confirmModal.actionType === 'ACCEPT' ? 'ACCEPT' : 'REJECT'}
                </strong> the service booking request for:
              </p>

              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-1.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-400">Customer Name:</span>
                  <span className="font-bold text-white">{confirmModal.booking?.customer_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Vehicle Number:</span>
                  <span className="font-mono font-bold text-amber-400">{confirmModal.booking?.vehicle_number}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Bike Model:</span>
                  <span className="font-bold text-slate-200">{confirmModal.booking?.bike_model}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Preferred Schedule:</span>
                  <span className="font-bold text-slate-200">{confirmModal.booking?.preferred_date} ({confirmModal.booking?.preferred_time})</span>
                </div>
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setConfirmModal({ isOpen: false, booking: null, actionType: 'ACCEPT' })}
                className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmAction}
                className={`flex-1 py-3 font-extrabold text-xs rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 ${
                  confirmModal.actionType === 'ACCEPT'
                    ? 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-emerald-600/30'
                    : 'bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white shadow-rose-600/30'
                }`}
              >
                {confirmModal.actionType === 'ACCEPT' ? (
                  <>
                    <Check className="w-4 h-4" /> Confirm &amp; Accept
                  </>
                ) : (
                  <>
                    <X className="w-4 h-4" /> Confirm &amp; Reject
                  </>
                )}
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ADMIN PASSWORD DELETE MODAL */}
      <AdminPasswordModal
        isOpen={deleteModal.isOpen}
        onClose={() => setDeleteModal({ isOpen: false, booking: null })}
        onConfirm={handleDeleteWithPassword}
        title="Delete Booking Record"
        itemDescription={deleteModal.booking ? `Booking for ${deleteModal.booking.customer_name} (${deleteModal.booking.vehicle_number})` : 'booking'}
      />

    </div>
  );
}
