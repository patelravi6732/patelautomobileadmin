import React, { useState, useEffect } from 'react';
import { MessageSquare, Mail, Phone, Clock, RefreshCw, User, ExternalLink, Sparkles, CheckCircle2, Trash2, Send, Lock } from 'lucide-react';
import API from '../services/api';
import AdminPasswordModal from '../components/AdminPasswordModal';
import { useAuth } from '../context/AuthContext';
import { generateInquiryReplyMessage } from '../utils/aiMessageGenerator';
import { fetchCloudMessages, markCloudMessageRead, deleteCloudMessage, pushCloudRecycleBinItem, fetchCloudDeletedIds } from '../utils/cloudSync';
import { formatDateDMY, parseSafelyDate } from '../utils/dateFormatter';

export default function MessagesPage() {
  const { garageInfo } = useAuth();
  const garagePhone = garageInfo?.phone || '+91 81403 71414';

  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('ALL'); // ALL, UNREAD, COMPLETED
  const [deleteModal, setDeleteModal] = useState({ isOpen: false, messageObj: null });

  // Editable draft states per message ID
  const [draftTexts, setDraftTexts] = useState({});
  const [draftLangs, setDraftLangs] = useState({});
  const [variationIndices, setVariationIndices] = useState({});
  const [actionLoading, setActionLoading] = useState({});

  const fetchMessages = async () => {
    setLoading(true);
    let backendMsgs = [];
    try {
      const res = await API.get('/messages/');
      backendMsgs = res.data || [];
    } catch (err) {
      console.warn('Backend API offline or error:', err);
    }

    const deletedIds = await fetchCloudDeletedIds().catch(() => []);
    const localMsgs = JSON.parse(localStorage.getItem('local_messages') || '[]');
    const cloudMsgs = await fetchCloudMessages();

    const allMap = new Map();
    [...backendMsgs, ...localMsgs, ...cloudMsgs].forEach(m => {
      if (m && typeof m === 'object') {
        const uniqueKey = String(m.id || `${m.phone || m.mobile_number}_${m.created_at || m.date}`);
        if (!deletedIds.includes(uniqueKey) && !deletedIds.includes(String(m.id))) {
          if (!allMap.has(uniqueKey)) {
            allMap.set(uniqueKey, m);
          }
        }
      }
    });

    const mergedMsgs = Array.from(allMap.values()).filter(m => {
      const name = m.name || m.customer_name;
      const phone = m.phone || m.mobile_number;
      const msg = m.message || m.inquiry;
      return Boolean(name || phone || msg);
    }).sort(
      (a, b) => new Date(b.created_at || b.date || Date.now()) - new Date(a.created_at || a.date || Date.now())
    );

    setMessages(mergedMsgs);

    const initialDrafts = {};
    const initialLangs = {};
    const initialVars = {};
    mergedMsgs.forEach(m => {
      const lang = 'GUJARATI';
      initialLangs[m.id] = lang;
      initialVars[m.id] = 0;
      initialDrafts[m.id] = m.reply_text || m.ai_draft_reply || generateInquiryReplyMessage(m, lang, 0, garagePhone);
    });
    setDraftTexts(initialDrafts);
    setDraftLangs(initialLangs);
    setVariationIndices(initialVars);
    setLoading(false);
  };

  useEffect(() => {
    fetchMessages();
  }, []);

  const handleTextChange = (id, text) => {
    setDraftTexts(prev => ({ ...prev, [id]: text }));
  };

  const handleLangChange = (msg, newLang) => {
    setDraftLangs(prev => ({ ...prev, [msg.id]: newLang }));
    const currentVar = variationIndices[msg.id] || 0;
    const newText = generateInquiryReplyMessage(msg, newLang, currentVar, garagePhone);
    setDraftTexts(prev => ({ ...prev, [msg.id]: newText }));
  };

  const handleGenerateAiReply = (msg) => {
    const currentLang = draftLangs[msg.id] || 'GUJARATI';
    const nextVar = (variationIndices[msg.id] || 0) + 1;
    setVariationIndices(prev => ({ ...prev, [msg.id]: nextVar }));
    const newText = generateInquiryReplyMessage(msg, currentLang, nextVar, garagePhone);
    setDraftTexts(prev => ({ ...prev, [msg.id]: newText }));
  };

  const handleSendAndComplete = async (msg) => {
    const textToSend = draftTexts[msg.id] || msg.ai_draft_reply || msg.reply_text;
    if (!textToSend.trim()) {
      alert('Please enter a response message before sending.');
      return;
    }

    setActionLoading(prev => ({ ...prev, [msg.id]: true }));

    // Mark completed locally and in cloud bin
    markCloudMessageRead(msg.id).catch(console.warn);
    const localMsgs = JSON.parse(localStorage.getItem('local_messages') || '[]');
    const updatedLocal = localMsgs.map(m => (String(m.id) === String(msg.id) ? { ...m, is_read: true, status: 'COMPLETED' } : m));
    localStorage.setItem('local_messages', JSON.stringify(updatedLocal));

    setMessages(prev => prev.map(m => (String(m.id) === String(msg.id) ? { ...m, is_read: true, status: 'COMPLETED' } : m)));

    let phoneClean = (msg.phone || '').replace(/\D/g, '');
    if (!phoneClean.startsWith('91') && phoneClean.length === 10) {
      phoneClean = '91' + phoneClean;
    }
    const encoded = encodeURIComponent(textToSend);
    const fallbackWhatsappUrl = `https://wa.me/${phoneClean}?text=${encoded}`;

    try {
      const res = await API.post(`/messages/${msg.id}/approve_and_send_ai_reply/`, {
        approved_text: textToSend
      }, { timeout: 2000 });
      const finalUrl = res.data.whatsapp_link || fallbackWhatsappUrl;
      window.open(finalUrl, '_blank');
    } catch (err) {
      console.warn('Backend API offline, opening WhatsApp link directly:', err);
      window.open(fallbackWhatsappUrl, '_blank');
    } finally {
      setActionLoading(prev => ({ ...prev, [msg.id]: false }));
    }
  };

  const handleDeleteWithPassword = async (adminPassword) => {
    if (!deleteModal.messageObj) return;
    const targetMsg = deleteModal.messageObj;
    const targetId = targetMsg.id;

    // 1. Move to Recycle Bin (local & cloud)
    const trashObj = {
      id: `trash_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      item_type: 'Customer Inquiry Message',
      title: `Message: ${targetMsg.name || 'Customer'} (${targetMsg.phone || 'N/A'})`,
      deleted_by: 'Patel Owner (Admin)',
      deleted_at: new Date().toISOString(),
      details: `Sender: ${targetMsg.name || 'Customer'} • Phone: ${targetMsg.phone} • Text: "${(targetMsg.message || '').slice(0, 50)}..."`,
      payload: targetMsg
    };

    const existingTrash = JSON.parse(localStorage.getItem('recycle_bin_items') || '[]');
    localStorage.setItem('recycle_bin_items', JSON.stringify([trashObj, ...existingTrash]));
    pushCloudRecycleBinItem(trashObj).catch(console.warn);

    // 2. Delete locally and from cloud bin
    deleteCloudMessage(targetId).catch(console.warn);
    const localMsgs = JSON.parse(localStorage.getItem('local_messages') || '[]');
    const updatedLocal = localMsgs.filter(m => String(m.id) !== String(targetId));
    localStorage.setItem('local_messages', JSON.stringify(updatedLocal));

    setMessages(prev => prev.filter(m => String(m.id) !== String(targetId)));
    setDeleteModal({ isOpen: false, messageObj: null });

    try {
      await API.post(`/messages/${targetId}/delete_with_password/`, {
        admin_password: adminPassword
      }, { timeout: 2000 });
    } catch (err) {
      console.warn('Backend API offline, moved message to Recycle Bin locally and cloud store:', err);
    } finally {
      alert('Message moved to Recycle Bin!');
    }
  };

  const openDirectWhatsApp = (msg) => {
    let phoneClean = msg.phone.replace(/\D/g, '');
    if (!phoneClean.startsWith('91') && phoneClean.length === 10) {
      phoneClean = '91' + phoneClean;
    }
    const textToUse = draftTexts[msg.id] || msg.reply_text || msg.ai_draft_reply || msg.message;
    const encoded = encodeURIComponent(textToUse);
    window.open(`https://wa.me/${phoneClean}?text=${encoded}`, '_blank');
  };

  const filtered = messages.filter(m => {
    if (filter === 'UNREAD') return m.status === 'UNREAD';
    if (filter === 'COMPLETED') return m.status === 'COMPLETED' || m.status === 'REPLIED' || m.ai_approved;
    return true;
  });

  const pendingCount = messages.filter(m => m.status === 'UNREAD').length;
  const completedCount = messages.filter(m => m.status === 'COMPLETED' || m.status === 'REPLIED' || m.ai_approved).length;

  return (
    <div className="space-y-8">
      
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 font-poppins flex items-center gap-2.5">
            <MessageSquare className="w-7 h-7 text-blue-600" /> Customer Messages &amp; WhatsApp Desk
          </h1>
        </div>
        <button
          onClick={fetchMessages}
          className="inline-flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-colors"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh Inbox
        </button>
      </div>

      {/* STATUS FILTER TABS */}
      <div className="flex flex-wrap gap-3">
        <button
          onClick={() => setFilter('ALL')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            filter === 'ALL'
              ? 'bg-slate-900 text-white shadow-md'
              : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
          }`}
        >
          All Inquiries ({messages.length})
        </button>
        <button
          onClick={() => setFilter('UNREAD')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all relative ${
            filter === 'UNREAD'
              ? 'bg-amber-500 text-white shadow-md'
              : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
          }`}
        >
          Pending ({pendingCount})
          {pendingCount > 0 && (
            <span className="ml-2 px-1.5 py-0.5 text-[10px] bg-white text-amber-600 rounded-full font-extrabold">
              NEW
            </span>
          )}
        </button>
        <button
          onClick={() => setFilter('COMPLETED')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            filter === 'COMPLETED'
              ? 'bg-emerald-600 text-white shadow-md'
              : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
          }`}
        >
          Completed ({completedCount})
        </button>
      </div>

      {/* MESSAGES LIST */}
      <div className="space-y-6">
        {loading ? (
          <div className="bg-white p-12 rounded-3xl border border-slate-200/80 text-center text-slate-400 font-medium">
            Loading customer inquiries...
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-white p-12 rounded-3xl border border-slate-200/80 text-center text-slate-400 font-medium">
            No inquiries found for selected filter.
          </div>
        ) : (
          filtered.map((msg) => {
            const isCompleted = msg.status === 'COMPLETED' || msg.status === 'REPLIED' || msg.ai_approved;
            const currentLang = draftLangs[msg.id] || 'GUJARATI';

            return (
              <div
                key={msg.id}
                className={`bg-white p-6 sm:p-8 rounded-3xl border transition-all duration-300 ${
                  isCompleted
                    ? 'border-emerald-200 soft-shadow bg-emerald-50/10'
                    : 'border-blue-200 shadow-xl shadow-blue-500/5 bg-gradient-to-br from-blue-50/20 via-white to-white'
                }`}
              >
                
                {/* TOP HEADER */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-100 pb-4">
                  <div className="flex items-center gap-3.5">
                    <div className={`w-12 h-12 rounded-2xl text-white flex items-center justify-center font-bold font-poppins shrink-0 shadow-lg ${
                      isCompleted ? 'bg-gradient-to-tr from-emerald-600 to-teal-500 shadow-emerald-500/30' : 'bg-gradient-to-tr from-blue-600 to-indigo-600 shadow-blue-500/30'
                    }`}>
                      <User className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-900 font-poppins text-base flex items-center gap-2.5">
                        {msg.name || msg.customer_name || 'Valued Customer'}
                        {isCompleted ? (
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-emerald-100 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" /> Completed
                          </span>
                        ) : (
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-amber-100 text-amber-700 border border-amber-200 flex items-center gap-1">
                            Pending Response
                          </span>
                        )}
                      </h3>
                      <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 mt-1">
                        <span className="flex items-center gap-1 font-bold text-slate-800">
                          <Phone className="w-3.5 h-3.5 text-blue-600" /> {msg.phone || msg.mobile_number || 'N/A'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-[11px] font-semibold text-slate-400 flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      {formatDateDMY(msg.created_at || msg.date)}
                    </span>
                    
                    {/* DELETE MESSAGE BUTTON WITH PASSWORD PROTECTION */}
                    <button
                      type="button"
                      onClick={() => setDeleteModal({ isOpen: true, messageObj: msg })}
                      className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors"
                      title="Delete Message (Password Protected)"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* CUSTOMER INQUIRY */}
                <div className="py-4 space-y-2">
                  <span className="text-[11px] font-extrabold text-slate-400 uppercase tracking-wider block">Customer Inquiry:</span>
                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 text-xs sm:text-sm font-medium text-slate-800 leading-relaxed">
                    "{msg.message || msg.inquiry || 'Inquiry message submitted'}"
                  </div>
                </div>

                {/* RESPONSE BOX: EDITABLE IF PENDING, LOCKED READ-ONLY IF COMPLETED */}
                {isCompleted ? (
                  <div className="mt-2 p-5 rounded-2xl bg-emerald-50/50 border border-emerald-200/80 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        <span className="text-xs font-extrabold text-emerald-900 font-poppins">
                          Sent Response Message (Locked / Read Only)
                        </span>
                      </div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-100/80 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                        <Lock className="w-3 h-3" /> Sent &amp; Completed
                      </span>
                    </div>

                    {/* READ-ONLY DISPLAY OF SENT MESSAGE */}
                    <div className="p-4 rounded-xl bg-white border border-emerald-200 text-xs sm:text-sm font-medium text-slate-800 leading-relaxed whitespace-pre-wrap">
                      {msg.reply_text || msg.ai_draft_reply}
                    </div>

                    <div className="flex flex-col sm:flex-row justify-between items-center gap-3 pt-2 border-t border-emerald-200/60">
                      <span className="text-[11px] font-semibold text-emerald-800">
                        💬 Message sent! You can continue chatting directly on WhatsApp anytime.
                      </span>

                      <button
                        type="button"
                        onClick={() => openDirectWhatsApp(msg)}
                        className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-2.5 bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 hover:from-emerald-700 hover:to-teal-800 text-white font-extrabold text-xs rounded-xl shadow-lg shadow-emerald-600/30 transition-all hover:scale-105 active:scale-95"
                      >
                        Open WhatsApp Chat Direct <ExternalLink className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="mt-2 p-5 rounded-2xl bg-gradient-to-r from-slate-50 via-blue-50/30 to-indigo-50/20 border border-slate-200/80 space-y-4">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                      <div className="flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-blue-600" />
                        <span className="text-xs font-extrabold text-slate-900 font-poppins">
                          AI Professional Response Message (Editable)
                        </span>
                      </div>

                      {/* LANGUAGE TOGGLE BUTTONS FOR MESSAGES */}
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleLangChange(msg, 'GUJARATI')}
                          className={`px-3 py-1 rounded-lg text-xs font-bold transition-all border ${
                            currentLang === 'GUJARATI'
                              ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                              : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                          }`}
                        >
                          Gujarati
                        </button>
                        <button
                          type="button"
                          onClick={() => handleLangChange(msg, 'ENGLISH')}
                          className={`px-3 py-1 rounded-lg text-xs font-bold transition-all border ${
                            currentLang === 'ENGLISH'
                              ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                              : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                          }`}
                        >
                          English
                        </button>

                        <button
                          type="button"
                          onClick={() => handleGenerateAiReply(msg)}
                          className="ml-2 text-[11px] font-bold text-amber-600 hover:text-amber-700 hover:underline flex items-center gap-1"
                        >
                          <RefreshCw className="w-3 h-3" /> Re-Generate AI Draft
                        </button>
                      </div>
                    </div>

                    <textarea
                      rows={5}
                      value={draftTexts[msg.id] ?? msg.reply_text ?? msg.ai_draft_reply ?? ''}
                      onChange={(e) => handleTextChange(msg.id, e.target.value)}
                      className="w-full p-4 rounded-xl border border-slate-300 text-xs sm:text-sm font-medium text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 shadow-xs leading-relaxed"
                    ></textarea>

                    <div className="flex flex-col sm:flex-row justify-between items-center gap-3 pt-2">
                      <span className="text-[11px] font-semibold text-slate-500">
                        💬 Sending message will mark inquiry Completed and launch WhatsApp chat.
                      </span>

                      <div className="flex items-center gap-3 w-full sm:w-auto">
                        <button
                          type="button"
                          onClick={() => openDirectWhatsApp(msg)}
                          className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-colors flex items-center gap-1.5 shrink-0"
                        >
                          Open WhatsApp <ExternalLink className="w-3.5 h-3.5" />
                        </button>

                        <button
                          type="button"
                          disabled={actionLoading[msg.id]}
                          onClick={() => handleSendAndComplete(msg)}
                          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-2.5 bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 hover:from-emerald-700 hover:to-teal-800 text-white font-extrabold text-xs rounded-xl shadow-lg shadow-emerald-600/30 transition-all hover:scale-105 active:scale-95 disabled:opacity-50"
                        >
                          <Send className="w-4 h-4" />
                          {actionLoading[msg.id] ? 'Sending...' : 'Send Message & Mark Completed'}
                        </button>
                      </div>
                    </div>
                  </div>
                )}

              </div>
            );
          })
        )}
      </div>

      {/* ADMIN PASSWORD DELETE MODAL */}
      <AdminPasswordModal
        isOpen={deleteModal.isOpen}
        onClose={() => setDeleteModal({ isOpen: false, messageObj: null })}
        onConfirm={handleDeleteWithPassword}
        title="Delete Customer Message"
        itemDescription={deleteModal.messageObj ? `Message from ${deleteModal.messageObj.name}` : 'message'}
      />

    </div>
  );
}
