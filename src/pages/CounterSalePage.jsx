import React, { useState, useEffect, useMemo } from 'react';
import { 
  ShoppingBag, Plus, Search, Trash2, CheckCircle2, AlertCircle, 
  Receipt, BookOpen, Download, Share2, Phone, User, Calendar, 
  DollarSign, Package, Tag, ArrowRight, RefreshCw, X, ShieldAlert,
  CreditCard, Smartphone, Check, Sparkles, Filter, ChevronRight,
  IndianRupee, Wrench
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { 
  fetchCloudCounterSales, pushCloudCounterSale, deleteCloudCounterSale,
  fetchCloudCounterKhata, pushCloudCounterKhata, atomicRecordCounterPayment,
  atomicDeductInventoryForSale, atomicAddInventoryItem, fetchMasterStore
} from '../utils/cloudSync';
import { generateCounterSaleCardPhotoAsync } from '../utils/billCardGenerator';

const INVENTORY_CATEGORIES = [
  'General', 'Engine Oil', 'Air Filter', 'Oil Filter', 'Spark Plug', 
  'Brake Shoe', 'Brake Pad', 'Chain Kit', 'Clutch Plate', 'Clutch Cable', 
  'Accelerator Cable', 'Bulbs', 'Battery', 'Tyres'
];

export default function CounterSalePage() {
  const { garageInfo, user } = useAuth();
  const [activeTab, setActiveTab] = useState('NEW_SALE'); // NEW_SALE | INVOICES | KHATA

  // Live Inventory & Catalog State
  const [inventory, setInventory] = useState([]);
  const [loadingInv, setLoadingInv] = useState(false);
  const [invSearch, setInvSearch] = useState('');
  const [invCategory, setInvCategory] = useState('ALL');

  // New Sale POS Form State
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [vehicleNumber, setVehicleNumber] = useState('');
  const [cartItems, setCartItems] = useState([]);
  const [discountAmount, setDiscountAmount] = useState(0);
  const [paidAmount, setPaidAmount] = useState('');
  const [paymentMode, setPaymentMode] = useState('CASH'); // CASH | UPI
  const [submittingSale, setSubmittingSale] = useState(false);

  // Success Modal
  const [successModal, setSuccessModal] = useState({
    isOpen: false,
    sale: null,
    photoUrl: null
  });

  // Add New Spare Part Modal (Exact match to Inventory Modal)
  const [showAddPartModal, setShowAddPartModal] = useState(false);
  const [newPartForm, setNewPartForm] = useState({
    part_name: '',
    category: 'General',
    price: '',
    current_stock: '',
    min_stock_alert: '5'
  });
  const [addingPart, setAddingPart] = useState(false);

  // Invoices Tab State
  const [invoices, setInvoices] = useState([]);
  const [invFilterSearch, setInvFilterSearch] = useState('');

  // Khata Tab State
  const [khataDebtors, setKhataDebtors] = useState([]);
  const [khataSearch, setKhataSearch] = useState('');
  const [paymentModal, setPaymentModal] = useState({
    isOpen: false,
    debtor: null,
    amount: '',
    paymentMode: 'CASH'
  });
  const [recordingPayment, setRecordingPayment] = useState(false);

  // 1. Fetch Inventory Store
  const loadInventory = async () => {
    setLoadingInv(true);
    try {
      const store = await fetchMasterStore();
      const items = (store.inventory || []).filter(i => i && typeof i === 'object');
      const local = JSON.parse(localStorage.getItem('local_inventory') || '[]');
      const map = new Map();
      [...items, ...local].forEach(it => {
        if (it && it.id) {
          map.set(String(it.id), it);
        }
      });
      setInventory(Array.from(map.values()));
    } catch (e) {
      console.warn('Error loading inventory for counter sale:', e);
    } finally {
      setLoadingInv(false);
    }
  };

  // 2. Fetch Counter Sales Invoices
  const loadInvoices = async () => {
    try {
      const data = await fetchCloudCounterSales();
      setInvoices(data);
    } catch (e) {
      console.warn('Error loading counter sales:', e);
    }
  };

  // 3. Fetch Counter Khata
  const loadKhata = async () => {
    try {
      const data = await fetchCloudCounterKhata();
      setKhataDebtors(data);
    } catch (e) {
      console.warn('Error loading counter khata:', e);
    }
  };

  useEffect(() => {
    loadInventory();
    loadInvoices();
    loadKhata();
  }, []);

  // Filtered Inventory Catalog
  const filteredCatalog = useMemo(() => {
    return inventory.filter(item => {
      const name = (item.part_name || item.item_name || item.name || '').toLowerCase();
      const query = invSearch.toLowerCase().trim();
      const matchesSearch = !query || name.includes(query);
      const matchesCat = invCategory === 'ALL' || (item.category || '').toLowerCase() === invCategory.toLowerCase();
      return matchesSearch && matchesCat;
    });
  }, [inventory, invSearch, invCategory]);

  // Categories list for pills
  const categoriesList = useMemo(() => {
    const set = new Set(['ALL', ...INVENTORY_CATEGORIES]);
    inventory.forEach(i => {
      if (i.category) set.add(i.category);
    });
    return Array.from(set);
  }, [inventory]);

  // Cart Calculations
  const cartSubtotal = useMemo(() => {
    return cartItems.reduce((sum, it) => sum + (parseFloat(it.selling_price || it.price || 0) * (parseInt(it.quantity, 10) || 1)), 0);
  }, [cartItems]);

  const numericDiscount = useMemo(() => {
    return parseFloat(discountAmount) || 0;
  }, [discountAmount]);

  const cartNetTotal = useMemo(() => {
    return Math.max(0, cartSubtotal - numericDiscount);
  }, [cartSubtotal, numericDiscount]);

  // Keep paidAmount in sync with net total by default when cart or discount changes
  useEffect(() => {
    setPaidAmount(cartNetTotal);
  }, [cartNetTotal]);

  const effectivePaid = useMemo(() => {
    if (paidAmount === '' || isNaN(parseFloat(paidAmount))) return 0;
    return Math.min(cartNetTotal, Math.max(0, parseFloat(paidAmount)));
  }, [paidAmount, cartNetTotal]);

  const cartPendingBalance = useMemo(() => {
    return Math.max(0, cartNetTotal - effectivePaid);
  }, [cartNetTotal, effectivePaid]);

  // Handle Add Item to Cart
  const handleAddToCart = (item) => {
    const curStock = parseInt(item.current_stock || item.stock_quantity || item.quantity || 0, 10);
    if (curStock <= 0) {
      alert(`⚠️ '${item.part_name || item.item_name || item.name}' is currently Out of Stock!`);
      return;
    }

    const existingIndex = cartItems.findIndex(i => String(i.id) === String(item.id));
    if (existingIndex >= 0) {
      const currentQty = cartItems[existingIndex].quantity;
      if (currentQty + 1 > curStock) {
        alert(`⚠️ Maximum available stock for '${item.part_name || item.item_name || item.name}' is ${curStock} units.`);
        return;
      }
      const updated = [...cartItems];
      updated[existingIndex].quantity += 1;
      setCartItems(updated);
    } else {
      setCartItems([...cartItems, {
        id: item.id,
        item_name: item.part_name || item.item_name || item.name || 'Spare Part',
        part_name: item.part_name || item.item_name || item.name || 'Spare Part',
        selling_price: parseFloat(item.price || item.selling_price || item.unit_price || 0),
        unit_price: parseFloat(item.price || item.selling_price || item.unit_price || 0),
        quantity: 1,
        available_stock: curStock
      }]);
    }
  };

  // Update Cart Item Quantity
  const handleUpdateQty = (itemId, newQty) => {
    const qty = parseInt(newQty, 10);
    if (isNaN(qty) || qty <= 0) return;
    const target = cartItems.find(i => String(i.id) === String(itemId));
    if (target && target.available_stock && qty > target.available_stock) {
      alert(`⚠️ Only ${target.available_stock} units available in stock!`);
      return;
    }
    setCartItems(cartItems.map(i => String(i.id) === String(itemId) ? { ...i, quantity: qty } : i));
  };

  // Remove Item from Cart
  const handleRemoveFromCart = (itemId) => {
    setCartItems(cartItems.filter(i => String(i.id) !== String(itemId)));
  };

  // Submit Counter Sale
  const handleGenerateCounterBill = async (e) => {
    e.preventDefault();
    if (!customerName.trim()) {
      alert('Please enter customer name!');
      return;
    }
    if (!customerPhone.trim()) {
      alert('Please enter customer mobile number!');
      return;
    }
    if (cartItems.length === 0) {
      alert('Please add at least one spare part item to the cart!');
      return;
    }

    setSubmittingSale(true);
    const saleId = `cs_${Date.now()}`;
    const invoiceNo = `CS-${Date.now().toString().slice(-6)}`;
    const finalPaid = effectivePaid;
    const finalPending = cartPendingBalance;

    const saleInvoice = {
      id: saleId,
      invoice_number: invoiceNo,
      customer_name: customerName.trim(),
      customer_phone: customerPhone.trim(),
      vehicle_number: vehicleNumber.trim(),
      items: cartItems.map(it => ({
        id: it.id,
        item_name: it.item_name || it.part_name,
        part_name: it.part_name || it.item_name,
        quantity: it.quantity,
        unit_price: it.selling_price,
        total: it.selling_price * it.quantity
      })),
      subtotal: cartSubtotal,
      discount: numericDiscount,
      net_total: cartNetTotal,
      grand_total: cartNetTotal,
      paid_amount: finalPaid,
      pending_amount: finalPending,
      payment_status: finalPending === 0 ? 'PAID' : (finalPaid > 0 ? 'PARTIAL' : 'PENDING'),
      payment_mode: paymentMode,
      created_at: new Date().toISOString(),
      date: new Date().toISOString(),
      created_by: user?.user_name || 'Patel Automobiles'
    };

    try {
      // 1. Deduct from Main Inventory
      await atomicDeductInventoryForSale(saleInvoice.items);

      // 2. Save Counter Sale Invoice
      await pushCloudCounterSale(saleInvoice);

      // 3. If credit / pending balance > 0, register in Counter Khata
      if (finalPending > 0) {
        const khataObj = {
          id: `ckhata_${saleId}`,
          sale_id: saleId,
          invoice_number: invoiceNo,
          customer_name: customerName.trim(),
          customer_phone: customerPhone.trim(),
          vehicle_number: vehicleNumber.trim(),
          total_amount: cartNetTotal,
          paid_amount: finalPaid,
          pending_amount: finalPending,
          status: 'PENDING',
          items_summary: saleInvoice.items.map(i => `${i.item_name || i.part_name} (x${i.quantity})`).join(', '),
          payments: finalPaid > 0 ? [{
            id: `cpay_init_${Date.now()}`,
            amount: finalPaid,
            payment_mode: paymentMode,
            date: new Date().toISOString(),
            recorded_by: user?.user_name || 'Patel Automobiles'
          }] : [],
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
        await pushCloudCounterKhata(khataObj);
      }

      // 4. Generate Bill Photo Card
      const photoUrl = await generateCounterSaleCardPhotoAsync(saleInvoice, garageInfo);

      // 5. Open Success Modal
      setSuccessModal({
        isOpen: true,
        sale: saleInvoice,
        photoUrl: photoUrl
      });

      // 6. Reset POS Form
      setCustomerName('');
      setCustomerPhone('');
      setVehicleNumber('');
      setCartItems([]);
      setDiscountAmount(0);
      setPaidAmount(0);

      // Reload Data
      loadInventory();
      loadInvoices();
      loadKhata();
    } catch (err) {
      console.error('Error generating counter sale bill:', err);
      alert('⚠️ An error occurred while creating the bill. Please try again.');
    } finally {
      setSubmittingSale(false);
    }
  };

  // Handle Save New Part (Exact structure matching screenshot)
  const handleSaveNewPart = async (e) => {
    e.preventDefault();
    if (!newPartForm.part_name.trim()) {
      alert('Please enter part name!');
      return;
    }
    if (!newPartForm.price) {
      alert('Please enter selling price!');
      return;
    }
    if (!newPartForm.current_stock) {
      alert('Please enter current stock!');
      return;
    }

    setAddingPart(true);
    try {
      const createdItem = await atomicAddInventoryItem({
        name: newPartForm.part_name.trim(),
        part_name: newPartForm.part_name.trim(),
        item_name: newPartForm.part_name.trim(),
        category: newPartForm.category || 'General',
        price: parseFloat(newPartForm.price),
        unit_price: parseFloat(newPartForm.price),
        selling_price: parseFloat(newPartForm.price),
        current_stock: parseInt(newPartForm.current_stock, 10),
        stock_quantity: parseInt(newPartForm.current_stock, 10),
        min_stock_alert: parseInt(newPartForm.min_stock_alert || 5, 10)
      });

      // Add directly to cart
      handleAddToCart(createdItem);

      alert(`✅ '${createdItem.part_name || createdItem.name}' added to Inventory and added to cart!`);
      setShowAddPartModal(false);
      setNewPartForm({
        part_name: '',
        category: 'General',
        price: '',
        current_stock: '',
        min_stock_alert: '5'
      });
      loadInventory();
    } catch (err) {
      console.error('Error adding spare part:', err);
      alert('⚠️ Failed to add spare part. Please try again.');
    } finally {
      setAddingPart(false);
    }
  };

  // Record Khata Payment
  const handleConfirmRecordPayment = async (e) => {
    e.preventDefault();
    const numAmt = parseFloat(paymentModal.amount || 0);
    if (numAmt <= 0) {
      alert('Please enter a valid payment amount!');
      return;
    }
    if (numAmt > paymentModal.debtor.pending_amount) {
      alert(`Payment amount cannot exceed pending dues of ₹${paymentModal.debtor.pending_amount}!`);
      return;
    }

    setRecordingPayment(true);
    try {
      await atomicRecordCounterPayment(
        paymentModal.debtor.id,
        numAmt,
        paymentModal.paymentMode,
        user?.user_name || 'Patel Automobiles'
      );
      alert(`✅ Payment of ₹${numAmt.toFixed(2)} recorded successfully!`);
      setPaymentModal({ isOpen: false, debtor: null, amount: '', paymentMode: 'CASH' });
      loadKhata();
      loadInvoices();
    } catch (err) {
      console.error('Error recording payment:', err);
      alert('⚠️ Error recording payment.');
    } finally {
      setRecordingPayment(false);
    }
  };

  // WhatsApp Share Helper
  const handleShareWhatsApp = (sale) => {
    if (!sale || !sale.customer_phone) return;
    const cleanPhone = sale.customer_phone.replace(/[^0-9]/g, '');
    const phoneWithCountry = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;
    
    const itemsList = (sale.items || []).map((it, i) => `${i + 1}. ${it.part_name || it.item_name} (x${it.quantity}) - ₹${parseFloat(it.total).toFixed(2)}`).join('\n');
    const msg = `*PATEL AUTOMOBILES - SPARE PARTS CASH MEMO* 🛵🔧
━━━━━━━━━━━━━━━━━━━━
📄 *Bill No:* ${sale.invoice_number}
📅 *Date:* ${new Date(sale.created_at || Date.now()).toLocaleDateString('en-IN')}
👤 *Customer:* ${sale.customer_name}
${sale.vehicle_number ? `🛵 *Vehicle:* ${sale.vehicle_number.toUpperCase()}\n` : ''}
*Purchased Items:*
${itemsList}

━━━━━━━━━━━━━━━━━━━━
💰 *Net Total:* ₹${parseFloat(sale.net_total).toFixed(2)}
💵 *Paid Amount:* ₹${parseFloat(sale.paid_amount).toFixed(2)}
${parseFloat(sale.pending_amount) > 0 ? `⚠️ *Pending Balance Due:* ₹${parseFloat(sale.pending_amount).toFixed(2)}\n` : '✅ *Payment Status:* Paid in Full\n'}
${garageInfo?.safety_message || 'Thank you for choosing Patel Automobiles! Wish you a safe ride. 🛵⛑️'}

📍 *Address:* Near Dandi Pond, Dandi, Valsad
📞 *Contact:* +91 81403 71414`;

    window.open(`https://wa.me/${phoneWithCountry}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  // WhatsApp Khata Reminder Helper
  const handleShareKhataReminder = (debtor) => {
    if (!debtor || !debtor.customer_phone) return;
    const cleanPhone = debtor.customer_phone.replace(/[^0-9]/g, '');
    const phoneWithCountry = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;
    
    const msg = `*PATEL AUTOMOBILES - PAYMENT REMINDER* 🛵
━━━━━━━━━━━━━━━━━━━━
👤 *Customer:* ${debtor.customer_name}
📄 *Bill Ref:* ${debtor.invoice_number}
📦 *Items:* ${debtor.items_summary || 'Spare Parts'}
💰 *Total Bill:* ₹${parseFloat(debtor.total_amount).toFixed(2)}
💵 *Paid so far:* ₹${parseFloat(debtor.paid_amount).toFixed(2)}
⚠️ *Pending Balance Due:* *₹${parseFloat(debtor.pending_amount).toFixed(2)}*

━━━━━━━━━━━━━━━━━━━━
📲 *Pay via UPI:* ${garageInfo?.upi_id || 'paytmqr5hlpsp@ptys'}
👤 *Payee:* Patel Automobiles

Kindly clear your pending balance at your earliest convenience.
📞 *Contact:* +91 81403 71414`;

    window.open(`https://wa.me/${phoneWithCountry}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  // Download Bill Photo Card
  const handleDownloadCard = async (sale) => {
    const url = await generateCounterSaleCardPhotoAsync(sale, garageInfo);
    if (!url) return;
    const link = document.createElement('a');
    link.href = url;
    link.download = `Bill_${sale.invoice_number || 'CounterSale'}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Stats Calculations
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const todaySalesTotal = useMemo(() => {
    return invoices
      .filter(i => new Date(i.created_at || i.date) >= todayStart)
      .reduce((sum, i) => sum + parseFloat(i.paid_amount || i.net_total || 0), 0);
  }, [invoices]);

  const totalKhataPending = useMemo(() => {
    return khataDebtors
      .filter(k => k.status !== 'CLEARED')
      .reduce((sum, k) => sum + parseFloat(k.pending_amount || 0), 0);
  }, [khataDebtors]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      
      {/* HEADER & TOP STATS */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm">
        <div>
          <h1 className="text-2xl font-black text-slate-900 font-poppins flex items-center gap-2.5">
            <span className="p-2.5 bg-blue-600 text-white rounded-2xl shadow-md shadow-blue-500/20">
              <ShoppingBag className="w-6 h-6" />
            </span>
            Counter Sale & Spare Parts POS
          </h1>
          <p className="text-xs text-slate-500 mt-1 font-medium">
            Over-the-counter spare parts direct billing, live inventory sync, and independent Khata Book.
          </p>
        </div>

        {/* TOP STATS BADGES */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="px-4 py-2.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900">
            <span className="text-[10px] font-bold uppercase tracking-wider block text-emerald-600">Today's Counter Sale</span>
            <span className="text-base font-black font-mono">₹{todaySalesTotal.toFixed(2)}</span>
          </div>
          <div className="px-4 py-2.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-900">
            <span className="text-[10px] font-bold uppercase tracking-wider block text-rose-600">Pending Khata Dues</span>
            <span className="text-base font-black font-mono">₹{totalKhataPending.toFixed(2)}</span>
          </div>
        </div>
      </div>

      {/* NAVIGATION TABS */}
      <div className="flex items-center gap-2 bg-slate-100 p-1.5 rounded-2xl border border-slate-200/80 max-w-fit">
        <button
          onClick={() => setActiveTab('NEW_SALE')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'NEW_SALE'
              ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <ShoppingBag className="w-4 h-4" /> 1. New Sale (POS)
        </button>

        <button
          onClick={() => { setActiveTab('INVOICES'); loadInvoices(); }}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'INVOICES'
              ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Receipt className="w-4 h-4" /> 2. Counter Invoices ({invoices.length})
        </button>

        <button
          onClick={() => { setActiveTab('KHATA'); loadKhata(); }}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'KHATA'
              ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <BookOpen className="w-4 h-4" /> 3. Counter Khata Book ({khataDebtors.filter(k => k.status !== 'CLEARED').length})
        </button>
      </div>

      {/* TAB 1: NEW COUNTER SALE (POS) */}
      {activeTab === 'NEW_SALE' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* LEFT COLUMN: INVENTORY CATALOG (7 Cols) */}
          <div className="lg:col-span-7 space-y-4">
            <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-sm space-y-4">
              
              {/* Search & Add Part Header */}
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <div className="relative flex-1 w-full">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={invSearch}
                    onChange={(e) => setInvSearch(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>

                <button
                  type="button"
                  onClick={() => setShowAddPartModal(true)}
                  className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-md inline-flex items-center gap-1.5 shrink-0 transition-all"
                >
                  <Plus className="w-4 h-4" /> + Add New Part
                </button>
              </div>

              {/* Categories Pills */}
              {categoriesList.length > 1 && (
                <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
                  {categoriesList.map(cat => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setInvCategory(cat)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                        invCategory === cat
                          ? 'bg-slate-900 text-white'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              )}

              {/* Catalog Items Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[540px] overflow-y-auto pr-1">
                {filteredCatalog.length === 0 ? (
                  <div className="col-span-2 text-center py-12 text-slate-400">
                    <Package className="w-12 h-12 mx-auto stroke-1 text-slate-300 mb-2" />
                    <p className="text-sm font-medium">No matching spare parts found in inventory.</p>
                    <button
                      type="button"
                      onClick={() => setShowAddPartModal(true)}
                      className="mt-3 text-xs text-blue-600 font-bold hover:underline"
                    >
                      Click here to add this item as a new part
                    </button>
                  </div>
                ) : (
                  filteredCatalog.map(item => {
                    const stock = parseInt(item.current_stock || item.stock_quantity || item.quantity || 0, 10);
                    const isLow = stock <= (parseInt(item.min_stock_alert, 10) || 5);
                    const isOut = stock <= 0;
                    const price = parseFloat(item.price || item.selling_price || item.unit_price || 0);

                    return (
                      <div
                        key={item.id}
                        onClick={() => !isOut && handleAddToCart(item)}
                        className={`p-4 rounded-2xl border transition-all flex flex-col justify-between cursor-pointer group ${
                          isOut
                            ? 'bg-slate-50 border-slate-200 opacity-60 cursor-not-allowed'
                            : 'bg-white hover:bg-blue-50/50 border-slate-200/80 hover:border-blue-300 hover:shadow-md'
                        }`}
                      >
                        <div>
                          <div className="flex justify-between items-start gap-2">
                            <h4 className="font-bold text-sm text-slate-900 font-poppins group-hover:text-blue-600 transition-colors line-clamp-1">
                              {item.part_name || item.item_name || item.name}
                            </h4>
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase shrink-0 ${
                              isOut 
                                ? 'bg-rose-100 text-rose-700' 
                                : isLow 
                                  ? 'bg-amber-100 text-amber-700' 
                                  : 'bg-emerald-100 text-emerald-700'
                            }`}>
                              {isOut ? 'Out of Stock' : `${stock} In Stock`}
                            </span>
                          </div>

                          {item.category && (
                            <span className="text-[11px] text-slate-400 block mt-0.5">
                              {item.category}
                            </span>
                          )}
                        </div>

                        <div className="flex justify-between items-center mt-3 pt-2 border-t border-slate-100">
                          <span className="text-base font-black font-mono text-slate-900">
                            ₹{price.toFixed(2)}
                          </span>
                          <button
                            type="button"
                            disabled={isOut}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold inline-flex items-center gap-1 transition-all ${
                              isOut 
                                ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                                : 'bg-blue-50 text-blue-600 group-hover:bg-blue-600 group-hover:text-white'
                            }`}
                          >
                            <Plus className="w-3.5 h-3.5" /> Add
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

            </div>
          </div>

          {/* RIGHT COLUMN: BILL BUILDER & CART (5 Cols) */}
          <div className="lg:col-span-5 space-y-4">
            <form onSubmit={handleGenerateCounterBill} className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm space-y-5">
              
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="font-bold text-slate-900 font-poppins flex items-center gap-2">
                  <Receipt className="w-5 h-5 text-blue-600" /> Customer & Billing Cart
                </h3>
                <span className="px-2.5 py-1 bg-blue-50 text-blue-700 font-bold text-xs rounded-xl font-mono">
                  {cartItems.length} {cartItems.length === 1 ? 'Item' : 'Items'}
                </span>
              </div>

              {/* CUSTOMER DETAILS */}
              <div className="space-y-3 bg-slate-50 p-4 rounded-2xl border border-slate-200/70">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Customer Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Mobile Number *
                    </label>
                    <input
                      type="tel"
                      required
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Vehicle No. (Optional)
                    </label>
                    <input
                      type="text"
                      value={vehicleNumber}
                      onChange={(e) => setVehicleNumber(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 text-sm font-mono uppercase focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    />
                  </div>
                </div>
              </div>

              {/* CART ITEMS LIST */}
              <div className="space-y-2">
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                  Selected Spare Parts
                </label>
                
                {cartItems.length === 0 ? (
                  <div className="p-6 border-2 border-dashed border-slate-200 rounded-2xl text-center text-slate-400">
                    <ShoppingBag className="w-8 h-8 mx-auto stroke-1 mb-1 text-slate-300" />
                    <p className="text-xs font-medium">Click on spare parts from catalog to add.</p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-44 overflow-y-auto pr-1">
                    {cartItems.map((item) => (
                      <div key={item.id} className="p-3 bg-slate-50 rounded-2xl border border-slate-200/80 flex items-center justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <h5 className="text-xs font-bold text-slate-900 truncate">{item.part_name || item.item_name}</h5>
                          <span className="text-[11px] font-mono text-slate-500">₹{item.selling_price.toFixed(2)} / unit</span>
                        </div>

                        {/* Qty Counter */}
                        <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-xl px-2 py-1">
                          <button
                            type="button"
                            onClick={() => handleUpdateQty(item.id, item.quantity - 1)}
                            className="text-slate-500 hover:text-rose-600 font-bold px-1"
                          >
                            -
                          </button>
                          <span className="text-xs font-mono font-bold w-6 text-center">{item.quantity}</span>
                          <button
                            type="button"
                            onClick={() => handleUpdateQty(item.id, item.quantity + 1)}
                            className="text-slate-500 hover:text-emerald-600 font-bold px-1"
                          >
                            +
                          </button>
                        </div>

                        <span className="text-xs font-black font-mono text-slate-900 w-16 text-right">
                          ₹{(item.selling_price * item.quantity).toFixed(2)}
                        </span>

                        <button
                          type="button"
                          onClick={() => handleRemoveFromCart(item.id)}
                          className="text-slate-400 hover:text-rose-600 p-1 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* DISCOUNT INPUT (SAME AS WORKSHOP) */}
              <div className="space-y-3 pt-2 border-t border-slate-100">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Special Discount (₹)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={discountAmount || ''}
                    onChange={(e) => setDiscountAmount(parseFloat(e.target.value) || 0)}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm font-bold text-amber-600 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                  />
                </div>

                {/* SUMMARY BOX (SAME AS WORKSHOP) */}
                <div className="p-4 bg-slate-900 rounded-2xl text-white space-y-2 text-xs">
                  <div className="flex justify-between text-slate-300">
                    <span>Parts Subtotal:</span>
                    <span className="font-semibold text-white">₹{cartSubtotal.toFixed(2)}</span>
                  </div>
                  {numericDiscount > 0 && (
                    <div className="flex justify-between text-amber-400 font-semibold">
                      <span>Discount:</span>
                      <span>- ₹{numericDiscount.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="pt-2 border-t border-slate-800 flex justify-between items-center text-sm font-extrabold text-amber-400">
                    <span>Final Bill Amount:</span>
                    <span className="text-base font-mono">₹{cartNetTotal.toFixed(2)}</span>
                  </div>
                </div>

                {/* AMOUNT PAID NOW (SAME AS WORKSHOP) */}
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                      Amount Paid Now (₹)
                    </label>
                    <span className="text-[11px] font-bold text-slate-400">Max: ₹{cartNetTotal.toFixed(2)}</span>
                  </div>
                  <input
                    type="number"
                    step="1"
                    min="0"
                    max={cartNetTotal}
                    value={paidAmount}
                    onChange={(e) => setPaidAmount(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 text-base font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                  />
                </div>

                {/* AUTOMATIC KHATA DUE BANNER (SAME AS WORKSHOP) */}
                {cartPendingBalance > 0 && (
                  <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-800 font-medium">
                    Remaining ₹{cartPendingBalance.toFixed(2)} will be automatically recorded in Customer's Counter Khata Book!
                  </div>
                )}

                {/* PAYMENT METHOD (ONLY CASH & UPI / GPAY) */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                    Payment Method
                  </label>
                  <select
                    value={paymentMode}
                    onChange={(e) => setPaymentMode(e.target.value)}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:outline-none"
                  >
                    <option value="CASH">Cash 💵</option>
                    <option value="UPI">UPI / GPay 📱</option>
                  </select>
                </div>
              </div>

              {/* GENERATE INVOICE & CLOSE BUTTON */}
              <button
                type="submit"
                disabled={submittingSale || cartItems.length === 0}
                className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold rounded-2xl shadow-lg shadow-emerald-600/20 text-sm flex items-center justify-center gap-2 transition-all"
              >
                {submittingSale ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Receipt className="w-4 h-4" />
                )}
                Generate Invoice & Close
              </button>

            </form>
          </div>

        </div>
      )}

      {/* TAB 2: COUNTER INVOICES HISTORY */}
      {activeTab === 'INVOICES' && (
        <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm space-y-5">
          
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-100 pb-4">
            <div>
              <h3 className="font-bold text-slate-900 font-poppins text-lg">Counter Sales Invoices History</h3>
              <p className="text-xs text-slate-500">All retail counter sales bills generated for spare parts.</p>
            </div>

            <div className="flex items-center gap-3 w-full sm:w-auto">
              <div className="relative flex-1 sm:w-64">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={invFilterSearch}
                  onChange={(e) => setInvFilterSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-medium focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* INVOICES TABLE */}
          {invoices.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <Receipt className="w-12 h-12 mx-auto stroke-1 mb-2 text-slate-300" />
              <p className="text-sm font-medium">No counter sale bills created yet.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200/80 bg-slate-50/50 text-slate-500 font-bold uppercase tracking-wider">
                    <th className="py-3 px-4">Bill No</th>
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4">Customer</th>
                    <th className="py-3 px-4">Items</th>
                    <th className="py-3 px-4 text-right">Net Total</th>
                    <th className="py-3 px-4 text-right">Paid</th>
                    <th className="py-3 px-4 text-right">Balance</th>
                    <th className="py-3 px-4 text-center">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {invoices
                    .filter(inv => {
                      const q = invFilterSearch.toLowerCase();
                      return !q || (inv.customer_name || '').toLowerCase().includes(q) || (inv.customer_phone || '').includes(q) || (inv.invoice_number || '').toLowerCase().includes(q);
                    })
                    .map((inv) => (
                      <tr key={inv.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3 px-4 font-mono font-bold text-blue-600">{inv.invoice_number}</td>
                        <td className="py-3 px-4 text-slate-500">{new Date(inv.created_at || Date.now()).toLocaleDateString('en-IN')}</td>
                        <td className="py-3 px-4">
                          <span className="font-bold text-slate-900 block">{inv.customer_name}</span>
                          <span className="font-mono text-slate-400 text-[11px]">{inv.customer_phone}</span>
                        </td>
                        <td className="py-3 px-4 text-slate-600 max-w-[200px] truncate">
                          {(inv.items || []).map(i => `${i.part_name || i.item_name} (x${i.quantity})`).join(', ')}
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">₹{parseFloat(inv.net_total || 0).toFixed(2)}</td>
                        <td className="py-3 px-4 text-right font-mono text-emerald-600 font-bold">₹{parseFloat(inv.paid_amount || 0).toFixed(2)}</td>
                        <td className="py-3 px-4 text-right font-mono text-rose-600 font-bold">
                          {parseFloat(inv.pending_amount || 0) > 0 ? `₹${parseFloat(inv.pending_amount).toFixed(2)}` : '₹0.00'}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${
                            parseFloat(inv.pending_amount || 0) === 0
                              ? 'bg-emerald-100 text-emerald-700'
                              : 'bg-amber-100 text-amber-700'
                          }`}>
                            {parseFloat(inv.pending_amount || 0) === 0 ? 'PAID' : 'PARTIAL'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleDownloadCard(inv)}
                              className="p-1.5 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors"
                              title="Download Photo Card"
                            >
                              <Download className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleShareWhatsApp(inv)}
                              className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-100 transition-colors"
                              title="Share on WhatsApp"
                            >
                              <Share2 className="w-3.5 h-3.5" />
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
      )}

      {/* TAB 3: COUNTER KHATA BOOK */}
      {activeTab === 'KHATA' && (
        <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm space-y-5">
          
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-100 pb-4">
            <div>
              <h3 className="font-bold text-slate-900 font-poppins text-lg flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-rose-600" /> Counter Spare Parts Khata Book
              </h3>
              <p className="text-xs text-slate-500">Independent credit register for customers with pending spare part dues.</p>
            </div>

            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={khataSearch}
                onChange={(e) => setKhataSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-medium focus:outline-none"
              />
            </div>
          </div>

          {/* DEBTORS LIST */}
          {khataDebtors.filter(k => k.status !== 'CLEARED').length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <CheckCircle2 className="w-12 h-12 mx-auto stroke-1 mb-2 text-emerald-400" />
              <p className="text-sm font-bold text-slate-700">All Clear! No Pending Spare Part Dues.</p>
              <p className="text-xs text-slate-400 mt-0.5">Any credit counter sales will automatically appear here.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {khataDebtors
                .filter(k => k.status !== 'CLEARED')
                .filter(k => {
                  const q = khataSearch.toLowerCase();
                  return !q || (k.customer_name || '').toLowerCase().includes(q) || (k.customer_phone || '').includes(q);
                })
                .map((debtor) => (
                  <div key={debtor.id} className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-4 hover:shadow-md transition-shadow">
                    
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="font-bold text-slate-900 text-sm font-poppins">{debtor.customer_name}</h4>
                        <span className="font-mono text-slate-500 text-xs block">{debtor.customer_phone}</span>
                        {debtor.invoice_number && (
                          <span className="text-[10px] font-mono text-blue-600 font-bold block mt-0.5">
                            Ref: #{debtor.invoice_number}
                          </span>
                        )}
                      </div>

                      <div className="text-right">
                        <span className="text-[10px] font-bold text-rose-600 uppercase block">Pending Due</span>
                        <span className="text-base font-black font-mono text-rose-600">
                          ₹{parseFloat(debtor.pending_amount || 0).toFixed(2)}
                        </span>
                      </div>
                    </div>

                    <div className="text-xs text-slate-600 bg-white p-3 rounded-xl border border-slate-200/70 space-y-1">
                      <div className="flex justify-between text-[11px]">
                        <span className="text-slate-400">Total Purchase:</span>
                        <span className="font-mono font-bold">₹{parseFloat(debtor.total_amount || 0).toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-[11px]">
                        <span className="text-slate-400">Paid So Far:</span>
                        <span className="font-mono font-bold text-emerald-600">₹{parseFloat(debtor.paid_amount || 0).toFixed(2)}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => setPaymentModal({ isOpen: true, debtor, amount: '', paymentMode: 'CASH' })}
                        className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-sm transition-colors flex items-center justify-center gap-1"
                      >
                        <DollarSign className="w-3.5 h-3.5" /> Record Payment
                      </button>

                      <button
                        type="button"
                        onClick={() => handleShareKhataReminder(debtor)}
                        className="p-2 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 rounded-xl transition-colors"
                        title="Send WhatsApp Payment Reminder"
                      >
                        <Share2 className="w-4 h-4" />
                      </button>
                    </div>

                  </div>
                ))}
            </div>
          )}

        </div>
      )}

      {/* MODAL 1: ADD NEW SPARE PART (EXACT REPLICA OF INVENTORY PAGE MODAL) */}
      {showAddPartModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full space-y-6 shadow-2xl border border-slate-200">
            
            <h2 className="text-xl font-bold text-slate-900 font-poppins">
              Add New Spare Part
            </h2>

            <form onSubmit={handleSaveNewPart} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  PART NAME *
                </label>
                <input
                  type="text"
                  required
                  value={newPartForm.part_name}
                  onChange={(e) => setNewPartForm({ ...newPartForm, part_name: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  CATEGORY *
                </label>
                <select
                  value={newPartForm.category}
                  onChange={(e) => setNewPartForm({ ...newPartForm, category: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 text-xs font-bold bg-slate-50 focus:outline-none"
                >
                  {INVENTORY_CATEGORIES.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    SELLING PRICE (₹) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={newPartForm.price}
                    onChange={(e) => setNewPartForm({ ...newPartForm, price: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm font-mono font-bold focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    CURRENT STOCK *
                  </label>
                  <input
                    type="number"
                    required
                    value={newPartForm.current_stock}
                    onChange={(e) => setNewPartForm({ ...newPartForm, current_stock: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm font-mono font-bold focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  LOW STOCK ALERT THRESHOLD
                </label>
                <input
                  type="number"
                  required
                  value={newPartForm.min_stock_alert}
                  onChange={(e) => setNewPartForm({ ...newPartForm, min_stock_alert: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm font-mono focus:outline-none"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowAddPartModal(false)}
                  className="flex-1 py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addingPart}
                  className="flex-1 py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-md transition-all disabled:opacity-50"
                >
                  {addingPart ? 'Saving...' : 'Save Part'}
                </button>
              </div>
            </form>

          </div>
        </div>
      )}

      {/* MODAL 2: SALE SUCCESS & INSTANT SHARE MODAL */}
      {successModal.isOpen && successModal.sale && (
        <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-lg w-full space-y-5 shadow-2xl border border-slate-100 relative animate-in fade-in zoom-in duration-200">
            
            <div className="text-center space-y-2">
              <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto shadow-sm">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-bold font-poppins text-slate-900">Counter Sale Completed!</h3>
              <p className="text-xs text-slate-500">
                Invoice <span className="font-mono font-bold text-blue-600">#{successModal.sale.invoice_number}</span> generated & stock updated.
              </p>
            </div>

            {/* PREVIEW PHOTO CARD */}
            {successModal.photoUrl && (
              <div className="rounded-2xl overflow-hidden border border-slate-200 shadow-md">
                <img src={successModal.photoUrl} alt="Bill Preview" className="w-full object-contain max-h-56 bg-slate-50" />
              </div>
            )}

            {/* ACTION BUTTONS */}
            <div className="space-y-2.5">
              <button
                type="button"
                onClick={() => handleDownloadCard(successModal.sale)}
                className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-md inline-flex items-center justify-center gap-2 transition-all"
              >
                <Download className="w-4 h-4" /> Download Bill Photo Card
              </button>

              <button
                type="button"
                onClick={() => handleShareWhatsApp(successModal.sale)}
                className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-md inline-flex items-center justify-center gap-2 transition-all"
              >
                <Share2 className="w-4 h-4" /> Share on WhatsApp
              </button>

              <button
                type="button"
                onClick={() => setSuccessModal({ isOpen: false, sale: null, photoUrl: null })}
                className="w-full py-3 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-xs rounded-xl transition-all"
              >
                Done / Next Sale
              </button>
            </div>

          </div>
        </div>
      )}

      {/* MODAL 3: RECORD KHATA PAYMENT MODAL */}
      {paymentModal.isOpen && paymentModal.debtor && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-sm w-full space-y-5 shadow-2xl border border-slate-100 relative animate-in fade-in zoom-in duration-150">
            
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-bold text-slate-900 font-poppins text-base flex items-center gap-1.5">
                  <DollarSign className="w-5 h-5 text-emerald-600" /> Record Khata Payment
                </h3>
                <p className="text-xs text-slate-500">Customer: {paymentModal.debtor.customer_name}</p>
              </div>
              <button
                type="button"
                onClick={() => setPaymentModal({ isOpen: false, debtor: null, amount: '', paymentMode: 'CASH' })}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleConfirmRecordPayment} className="space-y-4">
              <div className="p-3 bg-rose-50 rounded-2xl border border-rose-100 flex justify-between items-center">
                <span className="text-xs font-bold text-rose-800">Pending Dues:</span>
                <span className="text-base font-black font-mono text-rose-600">
                  ₹{parseFloat(paymentModal.debtor.pending_amount || 0).toFixed(2)}
                </span>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  PAYMENT AMOUNT (₹) *
                </label>
                <input
                  type="number"
                  step="1"
                  required
                  value={paymentModal.amount}
                  onChange={(e) => setPaymentModal({ ...paymentModal, amount: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm font-mono font-bold focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  PAYMENT METHOD
                </label>
                <select
                  value={paymentModal.paymentMode}
                  onChange={(e) => setPaymentModal({ ...paymentModal, paymentMode: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-bold bg-slate-50 focus:outline-none"
                >
                  <option value="CASH">Cash 💵</option>
                  <option value="UPI">UPI / GPay 📱</option>
                </select>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setPaymentModal({ isOpen: false, debtor: null, amount: '', paymentMode: 'CASH' })}
                  className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-xs rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={recordingPayment}
                  className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-md disabled:opacity-50"
                >
                  {recordingPayment ? 'Recording...' : 'Confirm Payment'}
                </button>
              </div>
            </form>

          </div>
        </div>
      )}

    </div>
  );
}
