import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  ShoppingBag, Plus, Search, Trash2, CheckCircle2, AlertCircle, 
  Receipt, BookOpen, Download, Share2, Phone, User, Calendar, 
  DollarSign, Package, Tag, ArrowRight, RefreshCw, X, ShieldAlert,
  CreditCard, Smartphone, Check, Sparkles, Filter, ChevronRight,
  IndianRupee, Wrench, ShieldCheck, Layers, ShoppingCart, Send
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { 
  fetchCloudCounterSales, pushCloudCounterSale, deleteCloudCounterSale,
  fetchCloudCounterKhata, pushCloudCounterKhata, deleteCloudCounterKhata,
  atomicRecordCounterPayment, syncCloudInventory, atomicAddInventoryItem,
  fetchMasterStore, saveMasterStore, pushCloudActiveCounterCart
} from '../utils/cloudSync';
import { generateCounterSaleCardPhotoAsync, generateBillCanvasBlob } from '../utils/billCardGenerator';
import { formatDateDMY } from '../utils/dateFormatter';

const INVENTORY_CATEGORIES = [
  'General', 'Engine Oil', 'Air Filter', 'Oil Filter', 'Spark Plug', 
  'Brake Shoe', 'Brake Pad', 'Chain Kit', 'Clutch Plate', 'Clutch Cable', 
  'Accelerator Cable', 'Bulbs', 'Battery', 'Tyres'
];

// Official WhatsApp SVG Icon Component
const WhatsAppIcon = ({ className = "w-4 h-4" }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z"/>
  </svg>
);

export default function CounterSalePage() {
  const { garageInfo, user } = useAuth();
  const [activeTab, setActiveTab] = useState('NEW_SALE'); // NEW_SALE | INVOICES | KHATA
  const [mobilePosView, setMobilePosView] = useState('CATALOG'); // 'CATALOG' | 'CART' for mobile layout

  // Live Inventory & Catalog State
  const [inventory, setInventory] = useState([]);
  const [invSearch, setInvSearch] = useState('');
  const [invCategory, setInvCategory] = useState('ALL');

  // Load initial draft from localStorage or cloud
  const loadInitialDraft = () => {
    try {
      const raw = localStorage.getItem('counter_sale_draft');
      if (raw) return JSON.parse(raw);
    } catch (e) {}
    return null;
  };

  const initialDraft = loadInitialDraft();

  // New Sale POS Form State (Synced across devices via MongoDB Atlas)
  const [customerName, setCustomerName] = useState(initialDraft?.customerName || '');
  const [customerPhone, setCustomerPhone] = useState(initialDraft?.customerPhone || '');
  const [vehicleNumber, setVehicleNumber] = useState(initialDraft?.vehicleNumber || '');
  const [cartItems, setCartItems] = useState(initialDraft?.cartItems || []);
  const [discountAmount, setDiscountAmount] = useState(initialDraft?.discountAmount || 0);
  const [paidAmount, setPaidAmount] = useState(initialDraft?.paidAmount !== undefined ? initialDraft.paidAmount : '');
  const [paymentMode, setPaymentMode] = useState(initialDraft?.paymentMode || 'CASH'); // CASH | UPI
  const [submittingSale, setSubmittingSale] = useState(false);
  const [confirmingParts, setConfirmingParts] = useState(false);

  // Sync draft to local storage and Cloud Master Store
  const isSyncingFromCloud = useRef(false);
  const debounceCloudTimer = useRef(null);

  useEffect(() => {
    if (isSyncingFromCloud.current) return;

    const draft = {
      customerName,
      customerPhone,
      vehicleNumber,
      cartItems,
      discountAmount,
      paidAmount,
      paymentMode,
      updated_at: new Date().toISOString()
    };
    localStorage.setItem('counter_sale_draft', JSON.stringify(draft));

    if (debounceCloudTimer.current) clearTimeout(debounceCloudTimer.current);
    debounceCloudTimer.current = setTimeout(() => {
      pushCloudActiveCounterCart(draft).catch(() => null);
    }, 600);
  }, [customerName, customerPhone, vehicleNumber, cartItems, discountAmount, paidAmount, paymentMode]);

  // Success Modal
  const [successModal, setSuccessModal] = useState({
    isOpen: false,
    sale: null,
    photoUrl: null
  });

  // Add New Spare Part Modal
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

  // 1. Fetch Inventory Store (0ms Instant Local-First)
  const loadInventory = () => {
    try {
      const local = JSON.parse(localStorage.getItem('inventory_items') || localStorage.getItem('spare_parts') || localStorage.getItem('local_inventory') || '[]');
      const map = new Map();
      local.forEach(it => {
        if (it && (it.part_name || it.item_name || it.name)) {
          const raw = String(it.part_name || it.item_name || it.name || '').trim();
          const normKey = raw.toLowerCase().replace(/[^a-z0-9]/g, '');
          if (normKey) {
            if (!map.has(normKey)) {
              map.set(normKey, { ...it, part_name: raw, item_name: raw, name: raw });
            } else {
              const prev = map.get(normKey);
              const prevTime = new Date(prev.updated_at || 0).getTime();
              const curTime = new Date(it.updated_at || 0).getTime();
              const preferred = curTime >= prevTime ? it : prev;
              map.set(normKey, { ...prev, ...preferred, part_name: raw, item_name: raw, name: raw });
            }
          }
        }
      });
      setInventory(Array.from(map.values()));
    } catch (e) {
      console.warn('Error loading inventory for counter sale:', e);
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

  // 4. Sync Cross-Device Cart from Master Store
  const syncCrossDeviceCart = async () => {
    try {
      const store = await fetchMasterStore();
      const cloudCart = store.activeCounterCart;
      if (cloudCart && typeof cloudCart === 'object') {
        const localDraft = JSON.parse(localStorage.getItem('counter_sale_draft') || 'null');
        const cloudTime = new Date(cloudCart.updated_at || 0).getTime();
        const localTime = new Date(localDraft?.updated_at || 0).getTime();

        if (cloudTime > localTime || (!localDraft && Array.isArray(cloudCart.cartItems) && cloudCart.cartItems.length > 0)) {
          isSyncingFromCloud.current = true;
          setCustomerName(cloudCart.customerName || '');
          setCustomerPhone(cloudCart.customerPhone || '');
          setVehicleNumber(cloudCart.vehicleNumber || '');
          setCartItems(Array.isArray(cloudCart.cartItems) ? cloudCart.cartItems : []);
          setDiscountAmount(cloudCart.discountAmount || 0);
          setPaidAmount(cloudCart.paidAmount !== undefined ? cloudCart.paidAmount : '');
          setPaymentMode(cloudCart.paymentMode || 'CASH');
          localStorage.setItem('counter_sale_draft', JSON.stringify(cloudCart));
          setTimeout(() => { isSyncingFromCloud.current = false; }, 300);
        }
      }
    } catch (e) {}
  };

  useEffect(() => {
    loadInventory();
    loadInvoices();
    loadKhata();
    syncCrossDeviceCart();

    const handleUpdates = () => {
      loadInventory();
      loadInvoices();
      loadKhata();
      syncCrossDeviceCart();
    };

    window.addEventListener('master_store_updated', handleUpdates);
    window.addEventListener('inventory_updated', handleUpdates);
    window.addEventListener('counter_cart_updated', handleUpdates);

    const interval = setInterval(() => {
      syncCrossDeviceCart();
    }, 4000);

    return () => {
      clearInterval(interval);
      window.removeEventListener('master_store_updated', handleUpdates);
      window.removeEventListener('inventory_updated', handleUpdates);
      window.removeEventListener('counter_cart_updated', handleUpdates);
    };
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

  useEffect(() => {
    if (paidAmount === '' || paidAmount === cartSubtotal || initialDraft?.paidAmount === undefined) {
      setPaidAmount(cartNetTotal);
    }
  }, [cartNetTotal]);

  const effectivePaid = useMemo(() => {
    if (paidAmount === '' || isNaN(parseFloat(paidAmount))) return 0;
    return Math.min(cartNetTotal, Math.max(0, parseFloat(paidAmount)));
  }, [paidAmount, cartNetTotal]);

  const cartPendingBalance = useMemo(() => {
    return Math.max(0, cartNetTotal - effectivePaid);
  }, [cartNetTotal, effectivePaid]);

  const hasUnconfirmedParts = useMemo(() => {
    return cartItems.some(p => p && p.status !== 'CONFIRMED');
  }, [cartItems]);

  // Handle Add Item to Cart
  const handleAddToCart = (item) => {
    const curStock = parseInt(item.current_stock !== undefined ? item.current_stock : (item.stock_quantity !== undefined ? item.stock_quantity : (item.quantity !== undefined ? item.quantity : 0)), 10);
    if (curStock <= 0) {
      alert(`⚠️ '${item.part_name || item.item_name || item.name}' is currently Out of Stock!`);
      return;
    }

    const itemNorm = String(item.part_name || item.item_name || item.name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const existingIndex = cartItems.findIndex(i => {
      const iNorm = String(i.part_name || i.item_name || i.name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      return (i.id && item.id && String(i.id) === String(item.id)) || (iNorm && itemNorm && iNorm === itemNorm);
    });

    if (existingIndex >= 0) {
      const currentQty = cartItems[existingIndex].quantity;
      if (currentQty + 1 > curStock) {
        alert(`⚠️ Maximum available stock for '${item.part_name || item.item_name || item.name}' is ${curStock} units.`);
        return;
      }
      const updated = [...cartItems];
      updated[existingIndex].quantity += 1;
      updated[existingIndex].status = 'STAGED';
      setCartItems(updated);
    } else {
      const rawName = item.part_name || item.item_name || item.name || 'Spare Part';
      setCartItems([...cartItems, {
        id: item.id || `cart_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
        item_name: rawName,
        part_name: rawName,
        selling_price: parseFloat(item.price || item.selling_price || item.unit_price || 0),
        unit_price: parseFloat(item.price || item.selling_price || item.unit_price || 0),
        quantity: 1,
        available_stock: curStock,
        status: 'STAGED'
      }]);
    }
  };

  // Confirm Cart Parts
  const handleConfirmCartParts = async () => {
    const stagedParts = cartItems.filter(p => p && p.status !== 'CONFIRMED');
    if (stagedParts.length === 0) {
      alert('ℹ️ All spare parts in cart are already confirmed!');
      return;
    }

    setConfirmingParts(true);

    const local = JSON.parse(localStorage.getItem('inventory_items') || localStorage.getItem('spare_parts') || localStorage.getItem('local_inventory') || '[]');
    const map = new Map();
    local.forEach(it => {
      if (it && (it.part_name || it.item_name || it.name)) {
        const raw = String(it.part_name || it.item_name || it.name || '').trim();
        const norm = raw.toLowerCase().replace(/[^a-z0-9]/g, '');
        if (norm) map.set(norm, { ...it, part_name: raw, item_name: raw, name: raw });
      }
    });

    stagedParts.forEach(staged => {
      const raw = String(staged.part_name || staged.item_name || '').trim();
      const norm = raw.toLowerCase().replace(/[^a-z0-9]/g, '');
      const deductQty = parseInt(staged.quantity || 1, 10);
      if (norm && map.has(norm)) {
        const item = map.get(norm);
        const curStock = parseInt(item.current_stock !== undefined ? item.current_stock : (item.stock_quantity !== undefined ? item.stock_quantity : (item.quantity !== undefined ? item.quantity : 0)), 10);
        const newStock = Math.max(0, curStock - deductQty);
        map.set(norm, {
          ...item,
          current_stock: newStock,
          stock_quantity: newStock,
          quantity: newStock,
          updated_at: new Date().toISOString()
        });
      }
    });

    const updatedInv = Array.from(map.values());
    localStorage.setItem('inventory_items', JSON.stringify(updatedInv));
    localStorage.setItem('spare_parts', JSON.stringify(updatedInv));
    localStorage.setItem('local_inventory', JSON.stringify(updatedInv));
    setInventory(updatedInv);

    const updatedCart = cartItems.map(p => ({ ...p, status: 'CONFIRMED' }));
    setCartItems(updatedCart);
    
    const draft = {
      customerName,
      customerPhone,
      vehicleNumber,
      cartItems: updatedCart,
      discountAmount,
      paidAmount,
      paymentMode,
      updated_at: new Date().toISOString()
    };
    localStorage.setItem('counter_sale_draft', JSON.stringify(draft));
    pushCloudActiveCounterCart(draft).catch(() => null);
    setConfirmingParts(false);

    try {
      window.dispatchEvent(new Event('master_store_updated'));
      window.dispatchEvent(new Event('inventory_updated'));
    } catch (e) {}

    syncCloudInventory(updatedInv).catch(console.warn);

    alert(`✅ Spare Parts Confirmed!\n\n${stagedParts.length} item(s) confirmed and stock deducted from Inventory successfully.`);
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
    const updatedCart = cartItems.map(i => String(i.id) === String(itemId) ? { ...i, quantity: qty, status: 'STAGED' } : i);
    setCartItems(updatedCart);
    const draft = {
      customerName,
      customerPhone,
      vehicleNumber,
      cartItems: updatedCart,
      discountAmount,
      paidAmount,
      paymentMode,
      updated_at: new Date().toISOString()
    };
    localStorage.setItem('counter_sale_draft', JSON.stringify(draft));
    pushCloudActiveCounterCart(draft).catch(() => null);
  };

  // Remove Item from Cart
  const handleRemoveFromCart = (itemId) => {
    const target = cartItems.find(i => String(i.id) === String(itemId));
    if (!target) return;

    const nextCart = cartItems.filter(i => String(i.id) !== String(itemId));
    setCartItems(nextCart);

    const draft = {
      customerName,
      customerPhone,
      vehicleNumber,
      cartItems: nextCart,
      discountAmount,
      paidAmount,
      paymentMode,
      updated_at: new Date().toISOString()
    };
    localStorage.setItem('counter_sale_draft', JSON.stringify(draft));
    pushCloudActiveCounterCart(draft).catch(() => null);

    if (target.status === 'CONFIRMED') {
      const local = JSON.parse(localStorage.getItem('inventory_items') || localStorage.getItem('spare_parts') || localStorage.getItem('local_inventory') || '[]');
      const map = new Map();
      local.forEach(it => {
        if (it && (it.part_name || it.item_name || it.name)) {
          const raw = String(it.part_name || it.item_name || it.name || '').trim();
          const norm = raw.toLowerCase().replace(/[^a-z0-9]/g, '');
          if (norm) map.set(norm, { ...it, part_name: raw, item_name: raw, name: raw });
        }
      });

      const raw = String(target.part_name || target.item_name || '').trim();
      const norm = raw.toLowerCase().replace(/[^a-z0-9]/g, '');
      const restoreQty = parseInt(target.quantity || 1, 10);
      if (norm && map.has(norm)) {
        const item = map.get(norm);
        const curStock = parseInt(item.current_stock !== undefined ? item.current_stock : (item.stock_quantity !== undefined ? item.stock_quantity : (item.quantity !== undefined ? item.quantity : 0)), 10);
        const newStock = curStock + restoreQty;
        const updatedItem = {
          ...item,
          current_stock: newStock,
          stock_quantity: newStock,
          quantity: newStock,
          updated_at: new Date().toISOString()
        };
        map.set(norm, updatedItem);

        const updatedInv = Array.from(map.values());
        localStorage.setItem('inventory_items', JSON.stringify(updatedInv));
        localStorage.setItem('spare_parts', JSON.stringify(updatedInv));
        localStorage.setItem('local_inventory', JSON.stringify(updatedInv));
        setInventory(updatedInv);

        try {
          window.dispatchEvent(new Event('master_store_updated'));
          window.dispatchEvent(new Event('inventory_updated'));
        } catch (e) {}

        syncCloudInventory(updatedInv).catch(console.warn);
      }
    }
  };

  // Clear Cart Completely
  const handleClearCart = async () => {
    if (!window.confirm('Are you sure you want to clear the active cart?')) return;
    
    const confirmedItems = cartItems.filter(p => p && p.status === 'CONFIRMED');
    const local = JSON.parse(localStorage.getItem('inventory_items') || localStorage.getItem('spare_parts') || localStorage.getItem('local_inventory') || '[]');
    const map = new Map();
    local.forEach(it => {
      if (it && (it.part_name || it.item_name || it.name)) {
        const raw = String(it.part_name || it.item_name || it.name || '').trim();
        const norm = raw.toLowerCase().replace(/[^a-z0-9]/g, '');
        if (norm) map.set(norm, { ...it, part_name: raw, item_name: raw, name: raw });
      }
    });

    confirmedItems.forEach(cItem => {
      const raw = String(cItem.part_name || cItem.item_name || '').trim();
      const norm = raw.toLowerCase().replace(/[^a-z0-9]/g, '');
      const restoreQty = parseInt(cItem.quantity || 1, 10);
      if (norm && map.has(norm)) {
        const item = map.get(norm);
        const curStock = parseInt(item.current_stock !== undefined ? item.current_stock : (item.stock_quantity !== undefined ? item.stock_quantity : (item.quantity !== undefined ? item.quantity : 0)), 10);
        map.set(norm, {
          ...item,
          current_stock: curStock + restoreQty,
          stock_quantity: curStock + restoreQty,
          quantity: curStock + restoreQty,
          updated_at: new Date().toISOString()
        });
      }
    });

    const updatedInv = Array.from(map.values());
    localStorage.setItem('inventory_items', JSON.stringify(updatedInv));
    localStorage.setItem('spare_parts', JSON.stringify(updatedInv));
    localStorage.setItem('local_inventory', JSON.stringify(updatedInv));
    setInventory(updatedInv);

    setCartItems([]);
    localStorage.removeItem('counter_sale_draft');
    pushCloudActiveCounterCart(null).catch(() => null);

    try {
      window.dispatchEvent(new Event('master_store_updated'));
      window.dispatchEvent(new Event('inventory_updated'));
    } catch (e) {}

    syncCloudInventory(updatedInv).catch(console.warn);
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
    const finalPaid = effectivePaid;
    const finalPending = cartPendingBalance;

    const saleInvoice = {
      id: saleId,
      customer_name: customerName.trim(),
      customer_phone: customerPhone.trim(),
      mobile_number: customerPhone.trim(),
      vehicle_number: vehicleNumber.trim(),
      items: cartItems.map(it => ({
        id: it.id,
        item_name: it.item_name || it.part_name,
        part_name: it.part_name || it.item_name,
        quantity: it.quantity,
        unit_price: it.selling_price,
        selling_price: it.selling_price,
        total: it.selling_price * it.quantity
      })),
      subtotal: cartSubtotal,
      discount: numericDiscount,
      discount_amount: numericDiscount,
      net_total: cartNetTotal,
      grand_total: cartNetTotal,
      total_amount: cartNetTotal,
      paid_amount: finalPaid,
      pending_amount: finalPending,
      payment_status: finalPending === 0 ? 'PAID' : 'UNPAID',
      payment_mode: paymentMode,
      created_at: new Date().toISOString(),
      date: new Date().toISOString(),
      created_by: user?.user_name || 'Patel Automobiles'
    };

    try {
      // 1. If any parts were unconfirmed, deduct now
      const unconfirmedParts = cartItems.filter(p => p && p.status !== 'CONFIRMED');
      if (unconfirmedParts.length > 0) {
        const local = JSON.parse(localStorage.getItem('inventory_items') || localStorage.getItem('spare_parts') || localStorage.getItem('local_inventory') || '[]');
        const map = new Map();
        local.forEach(it => {
          if (it && (it.part_name || it.item_name || it.name)) {
            const raw = String(it.part_name || it.item_name || it.name || '').trim();
            const norm = raw.toLowerCase().replace(/[^a-z0-9]/g, '');
            if (norm) map.set(norm, { ...it, part_name: raw, item_name: raw, name: raw });
          }
        });

        unconfirmedParts.forEach(staged => {
          const raw = String(staged.part_name || staged.item_name || '').trim();
          const norm = raw.toLowerCase().replace(/[^a-z0-9]/g, '');
          const deductQty = parseInt(staged.quantity || 1, 10);
          if (norm && map.has(norm)) {
            const item = map.get(norm);
            const curStock = parseInt(item.current_stock !== undefined ? item.current_stock : (item.stock_quantity !== undefined ? item.stock_quantity : (item.quantity !== undefined ? item.quantity : 0)), 10);
            map.set(norm, {
              ...item,
              current_stock: Math.max(0, curStock - deductQty),
              stock_quantity: Math.max(0, curStock - deductQty),
              quantity: Math.max(0, curStock - deductQty),
              updated_at: new Date().toISOString()
            });
          }
        });

        const updatedInv = Array.from(map.values());
        localStorage.setItem('inventory_items', JSON.stringify(updatedInv));
        localStorage.setItem('spare_parts', JSON.stringify(updatedInv));
        localStorage.setItem('local_inventory', JSON.stringify(updatedInv));
        setInventory(updatedInv);
        await syncCloudInventory(updatedInv);
      }

      // 2. Save Counter Sale Invoice to MongoDB Atlas
      await pushCloudCounterSale(saleInvoice);

      // 3. If credit / pending balance > 0, register in Counter Khata
      if (finalPending > 0) {
        const khataObj = {
          id: `ckhata_${saleId}`,
          sale_id: saleId,
          customer_name: customerName.trim(),
          customer_phone: customerPhone.trim(),
          phone: customerPhone.trim(),
          vehicle_number: vehicleNumber.trim(),
          total_amount: cartNetTotal,
          paid_amount: finalPaid,
          pending_amount: finalPending,
          status: 'UNPAID',
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

      // 4. Generate Ultra HD Bill Photo Card
      const photoUrl = await generateCounterSaleCardPhotoAsync(saleInvoice, garageInfo);

      // 5. Open Success Modal
      setSuccessModal({
        isOpen: true,
        sale: saleInvoice,
        photoUrl: photoUrl
      });

      // 6. Reset POS Form & Clear Draft
      setCustomerName('');
      setCustomerPhone('');
      setVehicleNumber('');
      setCartItems([]);
      setDiscountAmount(0);
      setPaidAmount(0);
      localStorage.removeItem('counter_sale_draft');
      pushCloudActiveCounterCart(null).catch(() => null);

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

  // Handle Save New Part
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

  // Delete Counter Sale Invoice (From Local & MongoDB Atlas)
  const handleDeleteInvoice = async (inv) => {
    if (!inv || !inv.id) return;
    if (!window.confirm(`Are you sure you want to permanently delete the invoice for ${inv.customer_name}?`)) {
      return;
    }

    try {
      // 1. Optimistic Local Removal
      const filtered = invoices.filter(i => String(i.id) !== String(inv.id));
      setInvoices(filtered);
      localStorage.setItem('local_counter_sales', JSON.stringify(filtered));

      // 2. Delete from MongoDB Atlas
      await deleteCloudCounterSale(inv.id);
      
      try {
        window.dispatchEvent(new Event('master_store_updated'));
      } catch (e) {}

      alert('🗑️ Invoice deleted successfully from Cloud database!');
      loadInvoices();
    } catch (err) {
      console.error('Error deleting counter sale invoice:', err);
      alert('⚠️ Error deleting invoice.');
    }
  };

  // Delete Counter Khata Debtor (From Local & MongoDB Atlas)
  const handleDeleteKhataEntry = async (debtor) => {
    if (!debtor || !debtor.id) return;
    if (!window.confirm(`Are you sure you want to permanently delete the Khata entry for ${debtor.customer_name}?`)) {
      return;
    }

    try {
      const filtered = khataDebtors.filter(k => String(k.id) !== String(debtor.id));
      setKhataDebtors(filtered);
      localStorage.setItem('local_counter_khata', JSON.stringify(filtered));

      await deleteCloudCounterKhata(debtor.id);

      try {
        window.dispatchEvent(new Event('master_store_updated'));
      } catch (e) {}

      alert('🗑️ Khata entry deleted successfully from Cloud database!');
      loadKhata();
    } catch (err) {
      console.error('Error deleting Khata entry:', err);
      alert('⚠️ Error deleting Khata entry.');
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

  // Download Bill Photo Card
  const handleDownloadCard = async (sale) => {
    const url = await generateCounterSaleCardPhotoAsync(sale, garageInfo);
    if (!url) return;
    const link = document.createElement('a');
    link.href = url;
    link.download = `Bill_${(sale.customer_name || 'CounterSale').replace(/\s+/g, '_')}_${formatDateDMY(sale.created_at || Date.now())}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // WhatsApp Share Helper (Auto Generated HD Card + Formatted Message)
  const handleShareWhatsApp = async (sale) => {
    if (!sale) return;
    const rawPhone = sale.customer_phone || sale.mobile_number || sale.phone || '';
    const cleanPhone = rawPhone.replace(/[^0-9]/g, '');
    const phoneWithCountry = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;
    
    // Automatically trigger HD Photo Card download
    handleDownloadCard(sale).catch(() => null);

    const itemsList = (sale.items || []).map((it, i) => `${i + 1}. ${it.part_name || it.item_name} (x${it.quantity}) - ₹${parseFloat(it.total || (it.unit_price * it.quantity)).toFixed(2)}`).join('\n');
    
    const isPaid = parseFloat(sale.pending_amount || 0) <= 0;
    const msg = `*PATEL AUTOMOBILES - SPARE PARTS CASH MEMO* 🛵🔧
━━━━━━━━━━━━━━━━━━━━
📅 *Date:* ${formatDateDMY(sale.created_at || sale.date || Date.now())}
👤 *Customer:* ${sale.customer_name}
${sale.vehicle_number ? `🛵 *Vehicle:* ${sale.vehicle_number.toUpperCase()}\n` : ''}
*Purchased Items:*
${itemsList}

━━━━━━━━━━━━━━━━━━━━
💰 *Net Total:* ₹${parseFloat(sale.net_total || sale.total_amount || 0).toFixed(2)}
💵 *Paid Amount:* ₹${parseFloat(sale.paid_amount || 0).toFixed(2)}
${!isPaid ? `⚠️ *Pending Balance Due:* ₹${parseFloat(sale.pending_amount).toFixed(2)}\n` : '✅ *Status:* PAID IN FULL\n'}
${garageInfo?.safety_message || 'Thank you for choosing Patel Automobiles! Wish you a safe & smooth ride. 🛵⛑️'}

📍 *Address:* ${garageInfo?.address || 'Near Dandi Pond, Dandi, Valsad'}
📞 *Contact:* ${garageInfo?.phone || '+91 81403 71414'}`;

    window.open(`https://wa.me/${phoneWithCountry}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  // WhatsApp Khata Reminder Helper
  const handleShareKhataReminder = async (debtor) => {
    if (!debtor) return;
    const rawPhone = debtor.customer_phone || debtor.phone || debtor.mobile_number || '';
    const cleanPhone = rawPhone.replace(/[^0-9]/g, '');
    const phoneWithCountry = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;
    
    const msg = `*PATEL AUTOMOBILES - PAYMENT REMINDER* 🛵
━━━━━━━━━━━━━━━━━━━━
👤 *Customer:* ${debtor.customer_name}
📦 *Items:* ${debtor.items_summary || 'Spare Parts'}
💰 *Total Bill:* ₹${parseFloat(debtor.total_amount || 0).toFixed(2)}
💵 *Paid so far:* ₹${parseFloat(debtor.paid_amount || 0).toFixed(2)}
⚠️ *Pending Balance Due:* *₹${parseFloat(debtor.pending_amount || 0).toFixed(2)}*

━━━━━━━━━━━━━━━━━━━━
📲 *Pay via UPI:* ${garageInfo?.upi_id || 'paytmqr5hlpsp@ptys'}
👤 *Payee:* Patel Automobiles

Kindly clear your pending balance at your earliest convenience.
📞 *Contact:* ${garageInfo?.phone || '+91 81403 71414'}`;

    window.open(`https://wa.me/${phoneWithCountry}?text=${encodeURIComponent(msg)}`, '_blank');
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
      .filter(k => k.status !== 'PAID' && parseFloat(k.pending_amount || 0) > 0)
      .reduce((sum, k) => sum + parseFloat(k.pending_amount || 0), 0);
  }, [khataDebtors]);

  return (
    <div className="space-y-4 sm:space-y-6 max-w-7xl mx-auto pb-16 sm:pb-8">
      
      {/* HEADER & TOP STATS */}
      <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3 bg-white p-4 sm:p-6 rounded-2xl sm:rounded-3xl border border-slate-200/80 shadow-xs">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 font-poppins flex items-center gap-2.5">
            <span className="p-2 sm:p-2.5 bg-blue-600 text-white rounded-xl sm:rounded-2xl shadow-sm shadow-blue-500/20">
              <ShoppingBag className="w-5 h-5 sm:w-6 sm:h-6" />
            </span>
            Counter Sale POS
          </h1>
          <p className="text-[11px] sm:text-xs text-slate-500 mt-1 font-medium">
            Over-the-counter spare parts direct billing, live multi-device cart sync & Khata.
          </p>
        </div>

        {/* TOP STATS BADGES */}
        <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center sm:gap-3 shrink-0">
          <div className="px-3 py-2 sm:px-4 sm:py-2.5 rounded-xl sm:rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900">
            <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider block text-emerald-600 truncate">Today's Sales</span>
            <span className="text-sm sm:text-base font-black font-mono">₹{todaySalesTotal.toFixed(2)}</span>
          </div>
          <div className="px-3 py-2 sm:px-4 sm:py-2.5 rounded-xl sm:rounded-2xl bg-rose-50 border border-rose-200 text-rose-900">
            <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider block text-rose-600 truncate">Khata Dues</span>
            <span className="text-sm sm:text-base font-black font-mono">₹{totalKhataPending.toFixed(2)}</span>
          </div>
        </div>
      </div>

      {/* NAVIGATION TABS */}
      <div className="flex items-center gap-1.5 bg-slate-100 p-1.5 rounded-2xl border border-slate-200/80 overflow-x-auto scrollbar-none w-full sm:w-fit">
        <button
          onClick={() => setActiveTab('NEW_SALE')}
          className={`flex items-center gap-1.5 px-3.5 sm:px-5 py-2 sm:py-2.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
            activeTab === 'NEW_SALE'
              ? 'bg-blue-600 text-white shadow-sm shadow-blue-600/20'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <ShoppingBag className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> 1. New Sale
        </button>

        <button
          onClick={() => { setActiveTab('INVOICES'); loadInvoices(); }}
          className={`flex items-center gap-1.5 px-3.5 sm:px-5 py-2 sm:py-2.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
            activeTab === 'INVOICES'
              ? 'bg-blue-600 text-white shadow-sm shadow-blue-600/20'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Receipt className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> 2. Invoices ({invoices.length})
        </button>

        <button
          onClick={() => { setActiveTab('KHATA'); loadKhata(); }}
          className={`flex items-center gap-1.5 px-3.5 sm:px-5 py-2 sm:py-2.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
            activeTab === 'KHATA'
              ? 'bg-blue-600 text-white shadow-sm shadow-blue-600/20'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <BookOpen className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> 3. Khata Book ({khataDebtors.filter(k => parseFloat(k.pending_amount || 0) > 0).length})
        </button>
      </div>

      {/* TAB 1: NEW COUNTER SALE (POS) */}
      {activeTab === 'NEW_SALE' && (
        <div className="space-y-4">
          
          {/* MOBILE SEGMENT SWITCHER */}
          <div className="grid grid-cols-2 gap-2 lg:hidden bg-white p-1.5 rounded-2xl border border-slate-200 shadow-xs">
            <button
              type="button"
              onClick={() => setMobilePosView('CATALOG')}
              className={`py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                mobilePosView === 'CATALOG'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              <Package className="w-3.5 h-3.5" /> Catalog ({filteredCatalog.length})
            </button>

            <button
              type="button"
              onClick={() => setMobilePosView('CART')}
              className={`py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                mobilePosView === 'CART'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              <ShoppingCart className="w-3.5 h-3.5" /> Cart ({cartItems.length}) {cartNetTotal > 0 && `• ₹${cartNetTotal.toFixed(0)}`}
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
            
            {/* LEFT COLUMN: INVENTORY CATALOG */}
            <div className={`lg:col-span-7 space-y-4 ${mobilePosView === 'CATALOG' ? 'block' : 'hidden lg:block'}`}>
              <div className="bg-white p-4 sm:p-5 rounded-2xl sm:rounded-3xl border border-slate-200/80 shadow-xs space-y-3.5">
                
                {/* Search & Add Part Header */}
                <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-2.5">
                  <div className="relative flex-1">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={invSearch}
                      onChange={(e) => setInvSearch(e.target.value)}
                      className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs sm:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={() => setShowAddPartModal(true)}
                    className="px-3.5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-xs inline-flex items-center justify-center gap-1.5 shrink-0 transition-all active:scale-95"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add New Part
                  </button>
                </div>

                {/* Categories Pills */}
                {categoriesList.length > 1 && (
                  <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                    {categoriesList.map(cat => (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => setInvCategory(cat)}
                        className={`px-3 py-1.5 rounded-xl text-[11px] font-bold whitespace-nowrap transition-all ${
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
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-[500px] overflow-y-auto pr-0.5">
                  {filteredCatalog.length === 0 ? (
                    <div className="col-span-1 sm:col-span-2 text-center py-10 text-slate-400">
                      <Package className="w-10 h-10 mx-auto stroke-1 text-slate-300 mb-1.5" />
                      <p className="text-xs sm:text-sm font-medium">No matching spare parts found.</p>
                      <button
                        type="button"
                        onClick={() => setShowAddPartModal(true)}
                        className="mt-2 text-xs text-blue-600 font-bold hover:underline"
                      >
                        + Add this as a new part
                      </button>
                    </div>
                  ) : (
                    filteredCatalog.map(item => {
                      const stock = parseInt(item.current_stock !== undefined ? item.current_stock : (item.stock_quantity !== undefined ? item.stock_quantity : (item.quantity !== undefined ? item.quantity : 0)), 10);
                      const isLow = stock <= (parseInt(item.min_stock_alert, 10) || 5);
                      const isOut = stock <= 0;
                      const price = parseFloat(item.price || item.selling_price || item.unit_price || 0);

                      return (
                        <div
                          key={item.id}
                          onClick={() => !isOut && handleAddToCart(item)}
                          className={`p-3 sm:p-4 rounded-xl sm:rounded-2xl border transition-all flex flex-col justify-between cursor-pointer group active:scale-[0.98] ${
                            isOut
                              ? 'bg-slate-50 border-slate-200 opacity-60 cursor-not-allowed'
                              : 'bg-white hover:bg-blue-50/40 border-slate-200 hover:border-blue-300 hover:shadow-xs'
                          }`}
                        >
                          <div>
                            <div className="flex justify-between items-start gap-1.5">
                              <h4 className="font-bold text-xs sm:text-sm text-slate-900 font-poppins group-hover:text-blue-600 transition-colors line-clamp-1">
                                {item.part_name || item.item_name || item.name}
                              </h4>
                              <span className={`px-1.5 py-0.5 rounded-full text-[9px] sm:text-[10px] font-extrabold uppercase shrink-0 ${
                                isOut 
                                  ? 'bg-rose-100 text-rose-700' 
                                  : isLow 
                                    ? 'bg-amber-100 text-amber-700' 
                                    : 'bg-emerald-100 text-emerald-700'
                              }`}>
                                {isOut ? 'Out of Stock' : `${stock} Left`}
                              </span>
                            </div>

                            {item.category && (
                              <span className="text-[10px] sm:text-[11px] text-slate-400 block mt-0.5">
                                {item.category}
                              </span>
                            )}
                          </div>

                          <div className="flex justify-between items-center mt-2.5 pt-2 border-t border-slate-100">
                            <span className="text-sm sm:text-base font-black font-mono text-slate-900">
                              ₹{price.toFixed(2)}
                            </span>
                            <button
                              type="button"
                              disabled={isOut}
                              className={`px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-lg sm:rounded-xl text-[11px] sm:text-xs font-bold inline-flex items-center gap-1 transition-all ${
                                isOut 
                                  ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                                  : 'bg-blue-50 text-blue-600 group-hover:bg-blue-600 group-hover:text-white'
                              }`}
                            >
                              <Plus className="w-3 h-3 sm:w-3.5 sm:h-3.5" /> Add
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

              </div>
            </div>

            {/* RIGHT COLUMN: BILL BUILDER & CART */}
            <div className={`lg:col-span-5 space-y-4 ${mobilePosView === 'CART' ? 'block' : 'hidden lg:block'}`}>
              <form onSubmit={handleGenerateCounterBill} className="bg-white p-4 sm:p-6 rounded-2xl sm:rounded-3xl border border-slate-200/80 shadow-xs space-y-4 sm:space-y-5">
                
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <h3 className="font-bold text-slate-900 font-poppins text-sm sm:text-base flex items-center gap-2">
                    <Receipt className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600" /> Customer & Billing Cart
                  </h3>
                  <div className="flex items-center gap-2">
                    {cartItems.length > 0 && (
                      <button
                        type="button"
                        onClick={handleClearCart}
                        className="text-[11px] text-rose-500 hover:text-rose-700 font-bold hover:underline"
                      >
                        Clear
                      </button>
                    )}
                    <span className="px-2 py-0.5 bg-blue-50 text-blue-700 font-bold text-[11px] sm:text-xs rounded-lg font-mono">
                      {cartItems.length} {cartItems.length === 1 ? 'Item' : 'Items'}
                    </span>
                  </div>
                </div>

                {/* CUSTOMER DETAILS */}
                <div className="space-y-2.5 bg-slate-50 p-3 sm:p-4 rounded-xl sm:rounded-2xl border border-slate-200/70">
                  <div>
                    <label className="block text-[10px] sm:text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Customer Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs sm:text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-[10px] sm:text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                        Mobile Number *
                      </label>
                      <input
                        type="tel"
                        required
                        value={customerPhone}
                        onChange={(e) => setCustomerPhone(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs sm:text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] sm:text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                        Vehicle No. (Optional)
                      </label>
                      <input
                        type="text"
                        value={vehicleNumber}
                        onChange={(e) => setVehicleNumber(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs sm:text-sm font-mono uppercase focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                      />
                    </div>
                  </div>
                </div>

                {/* CART ITEMS LIST */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <label className="block text-[10px] sm:text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                      Selected Spare Parts
                    </label>
                    {cartItems.length > 0 && (
                      <span className="text-[9px] sm:text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-100 flex items-center gap-1">
                        {hasUnconfirmedParts ? '⏳ Unconfirmed in Cart' : '✓ All Confirmed & Locked'}
                      </span>
                    )}
                  </div>
                  
                  {cartItems.length === 0 ? (
                    <div className="p-6 border-2 border-dashed border-slate-200 rounded-xl sm:rounded-2xl text-center text-slate-400">
                      <ShoppingBag className="w-7 h-7 mx-auto stroke-1 mb-1 text-slate-300" />
                      <p className="text-xs font-medium">Click on spare parts from catalog to add.</p>
                      <button
                        type="button"
                        onClick={() => setMobilePosView('CATALOG')}
                        className="lg:hidden mt-2 text-xs font-bold text-blue-600 underline"
                      >
                        Open Catalog
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-44 overflow-y-auto pr-0.5">
                      {cartItems.map((item) => {
                        const isConfirmed = item.status === 'CONFIRMED';
                        return (
                          <div key={item.id} className="p-2.5 sm:p-3 bg-slate-50 rounded-xl sm:rounded-2xl border border-slate-200/80 flex items-center justify-between gap-2.5">
                            <div className="flex-1 min-w-0">
                              <h5 className="text-xs font-bold text-slate-900 truncate">{item.part_name || item.item_name}</h5>
                              <div className="flex items-center gap-1.5 mt-0.5">
                                <span className="text-[10px] sm:text-[11px] font-mono text-slate-500">₹{item.selling_price.toFixed(2)}</span>
                                <span className={`text-[9px] sm:text-[10px] font-bold px-1.5 py-0.2 rounded font-mono ${
                                  isConfirmed 
                                    ? 'text-emerald-700 bg-emerald-100' 
                                    : 'text-amber-700 bg-amber-100 animate-pulse'
                                }`}>
                                  {isConfirmed ? '✓ Confirmed' : '⏳ Staged'}
                                </span>
                              </div>
                            </div>

                            {/* Qty Counter */}
                            <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg px-1.5 py-0.5">
                              <button
                                type="button"
                                onClick={() => handleUpdateQty(item.id, item.quantity - 1)}
                                className="text-slate-500 hover:text-rose-600 font-bold px-1 text-sm"
                              >
                                -
                              </button>
                              <span className="text-xs font-mono font-bold w-5 text-center">{item.quantity}</span>
                              <button
                                type="button"
                                onClick={() => handleUpdateQty(item.id, item.quantity + 1)}
                                className="text-slate-500 hover:text-emerald-600 font-bold px-1 text-sm"
                              >
                                +
                              </button>
                            </div>

                            <span className="text-xs font-black font-mono text-slate-900 w-14 sm:w-16 text-right">
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
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* EXPLICIT CONFIRM PARTS BUTTON */}
                {cartItems.length > 0 && hasUnconfirmedParts && (
                  <button
                    type="button"
                    onClick={handleConfirmCartParts}
                    disabled={confirmingParts}
                    className="w-full py-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 font-bold text-xs rounded-xl shadow-2xs flex items-center justify-center gap-1.5 transition-all active:scale-98"
                  >
                    <ShieldCheck className="w-4 h-4 text-emerald-600" />
                    {confirmingParts ? 'Confirming Stock...' : `Confirm ${cartItems.filter(p => p && p.status !== 'CONFIRMED').length} Part(s) & Lock Stock`}
                  </button>
                )}

                {/* DISCOUNT INPUT */}
                <div className="space-y-2.5 pt-2 border-t border-slate-100">
                  <div>
                    <label className="block text-[10px] sm:text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Special Discount (₹)
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={discountAmount || ''}
                      onChange={(e) => setDiscountAmount(parseFloat(e.target.value) || 0)}
                      className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-xs sm:text-sm font-bold text-amber-600 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                    />
                  </div>

                  {/* SUMMARY BOX */}
                  <div className="p-3 sm:p-4 bg-slate-900 rounded-xl sm:rounded-2xl text-white space-y-1.5 text-xs">
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
                    <div className="pt-1.5 border-t border-slate-800 flex justify-between items-center text-xs sm:text-sm font-extrabold text-amber-400">
                      <span>Final Bill Amount:</span>
                      <span className="text-sm sm:text-base font-mono">₹{cartNetTotal.toFixed(2)}</span>
                    </div>
                  </div>

                  {/* AMOUNT PAID NOW */}
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <label className="block text-[10px] sm:text-xs font-bold text-slate-700 uppercase tracking-wider">
                        Amount Paid Now (₹)
                      </label>
                      <span className="text-[10px] sm:text-[11px] font-bold text-slate-400">Max: ₹{cartNetTotal.toFixed(2)}</span>
                    </div>
                    <input
                      type="number"
                      step="1"
                      min="0"
                      max={cartNetTotal}
                      value={paidAmount}
                      onChange={(e) => setPaidAmount(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm sm:text-base font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                    />
                  </div>

                  {/* AUTOMATIC KHATA DUE BANNER */}
                  {cartPendingBalance > 0 && (
                    <div className="p-2.5 bg-rose-50 rounded-xl border border-rose-200 text-[11px] sm:text-xs text-rose-800 font-bold">
                      ⚠️ Remaining ₹{cartPendingBalance.toFixed(2)} is UNPAID and will be recorded in Customer's Counter Khata Book!
                    </div>
                  )}

                  {/* PAYMENT METHOD */}
                  <div>
                    <label className="block text-[10px] sm:text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                      Payment Method
                    </label>
                    <select
                      value={paymentMode}
                      onChange={(e) => setPaymentMode(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:outline-none"
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
                  className="w-full py-3.5 sm:py-4 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold rounded-xl sm:rounded-2xl shadow-md shadow-emerald-600/20 text-xs sm:text-sm flex items-center justify-center gap-2 transition-all active:scale-98"
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

          {/* MOBILE FLOATING VIEW CART BAR */}
          {mobilePosView === 'CATALOG' && cartItems.length > 0 && (
            <div className="fixed bottom-3 inset-x-3 lg:hidden z-40">
              <button
                type="button"
                onClick={() => setMobilePosView('CART')}
                className="w-full py-3 px-4 bg-slate-900 text-white font-bold text-xs rounded-2xl shadow-xl flex items-center justify-between active:scale-98 transition-all"
              >
                <div className="flex items-center gap-2">
                  <span className="p-1.5 bg-blue-600 rounded-xl text-white">
                    <ShoppingCart className="w-4 h-4" />
                  </span>
                  <span>{cartItems.length} {cartItems.length === 1 ? 'Part' : 'Parts'} in Cart</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="font-mono text-amber-400 font-black">₹{cartNetTotal.toFixed(2)}</span>
                  <ChevronRight className="w-4 h-4 text-slate-400" />
                </div>
              </button>
            </div>
          )}

        </div>
      )}

      {/* TAB 2: COUNTER INVOICES HISTORY (NO BILL NO, CLEAN PAID / UNPAID STATUS, DELETE BUTTON) */}
      {activeTab === 'INVOICES' && (
        <div className="bg-white p-4 sm:p-6 rounded-2xl sm:rounded-3xl border border-slate-200/80 shadow-xs space-y-4">
          
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-slate-100 pb-3">
            <div>
              <h3 className="font-bold text-slate-900 font-poppins text-base sm:text-lg">Counter Sales Invoices History</h3>
              <p className="text-[11px] sm:text-xs text-slate-500">All retail counter sales bills generated for spare parts.</p>
            </div>

            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={invFilterSearch}
                onChange={(e) => setInvFilterSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-medium focus:outline-none"
              />
            </div>
          </div>

          {/* INVOICES TABLE */}
          {invoices.length === 0 ? (
            <div className="text-center py-10 text-slate-400">
              <Receipt className="w-10 h-10 mx-auto stroke-1 mb-2 text-slate-300" />
              <p className="text-xs sm:text-sm font-medium">No counter sale bills created yet.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs min-w-[650px]">
                <thead>
                  <tr className="border-b border-slate-200/80 bg-slate-50/50 text-slate-500 font-bold uppercase tracking-wider">
                    <th className="py-3 px-3.5">Date</th>
                    <th className="py-3 px-3.5">Customer</th>
                    <th className="py-3 px-3.5">Items</th>
                    <th className="py-3 px-3.5 text-right">Net Total</th>
                    <th className="py-3 px-3.5 text-right">Paid</th>
                    <th className="py-3 px-3.5 text-right">Balance</th>
                    <th className="py-3 px-3.5 text-center">Status</th>
                    <th className="py-3 px-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {invoices
                    .filter(inv => {
                      const q = invFilterSearch.toLowerCase();
                      return !q || (inv.customer_name || '').toLowerCase().includes(q) || (inv.customer_phone || '').includes(q);
                    })
                    .map((inv) => {
                      const netTot = parseFloat(inv.net_total || inv.total_amount || inv.grand_total || 0);
                      const paidAmt = parseFloat(inv.paid_amount || 0);
                      const pendingAmt = parseFloat(inv.pending_amount !== undefined ? inv.pending_amount : Math.max(0, netTot - paidAmt));
                      const isPaid = pendingAmt <= 0;

                      return (
                        <tr key={inv.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-3 px-3.5 text-slate-600 font-medium whitespace-nowrap">
                            {formatDateDMY(inv.created_at || inv.date || Date.now())}
                          </td>
                          <td className="py-3 px-3.5">
                            <span className="font-bold text-slate-900 block">{inv.customer_name}</span>
                            <span className="font-mono text-slate-400 text-[10px]">{inv.customer_phone || inv.mobile_number}</span>
                          </td>
                          <td className="py-3 px-3.5 text-slate-600 max-w-[200px] truncate">
                            {(inv.items || []).map(i => `${i.part_name || i.item_name} (x${i.quantity})`).join(', ')}
                          </td>
                          <td className="py-3 px-3.5 text-right font-mono font-black text-slate-900 whitespace-nowrap">
                            ₹{netTot.toFixed(2)}
                          </td>
                          <td className="py-3 px-3.5 text-right font-mono text-emerald-600 font-black whitespace-nowrap">
                            ₹{paidAmt.toFixed(2)}
                          </td>
                          <td className="py-3 px-3.5 text-right font-mono text-rose-600 font-black whitespace-nowrap">
                            {pendingAmt > 0 ? `₹${pendingAmt.toFixed(2)}` : '₹0.00'}
                          </td>
                          <td className="py-3 px-3.5 text-center whitespace-nowrap">
                            <span className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase ${
                              isPaid
                                ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                : 'bg-rose-100 text-rose-800 border border-rose-200'
                            }`}>
                              {isPaid ? 'PAID' : 'UNPAID'}
                            </span>
                          </td>
                          <td className="py-3 px-3.5 text-right whitespace-nowrap">
                            <div className="flex items-center justify-end gap-1.5">
                              {/* Download Card */}
                              <button
                                type="button"
                                onClick={() => handleDownloadCard(inv)}
                                className="p-1.5 sm:px-2.5 sm:py-1.5 rounded-xl bg-blue-50 text-blue-600 hover:bg-blue-100 font-bold text-[11px] inline-flex items-center gap-1 transition-colors"
                                title="Download Photo Card"
                              >
                                <Download className="w-3.5 h-3.5" />
                                <span className="hidden sm:inline">Card</span>
                              </button>

                              {/* WhatsApp Share Button with WhatsApp Icon */}
                              <button
                                type="button"
                                onClick={() => handleShareWhatsApp(inv)}
                                className="p-1.5 sm:px-2.5 sm:py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] inline-flex items-center gap-1.5 shadow-xs transition-colors"
                                title="Share Bill on WhatsApp"
                              >
                                <WhatsAppIcon className="w-3.5 h-3.5" />
                                <span className="hidden sm:inline">WhatsApp</span>
                              </button>

                              {/* Delete Button (Red) */}
                              <button
                                type="button"
                                onClick={() => handleDeleteInvoice(inv)}
                                className="p-1.5 sm:p-2 rounded-xl bg-slate-100 hover:bg-rose-100 text-slate-400 hover:text-rose-600 transition-colors"
                                title="Delete Invoice permanently from database"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          )}

        </div>
      )}

      {/* TAB 3: COUNTER KHATA BOOK (WITH DELETE OPTION & WHATSAPP BUTTON) */}
      {activeTab === 'KHATA' && (
        <div className="bg-white p-4 sm:p-6 rounded-2xl sm:rounded-3xl border border-slate-200/80 shadow-xs space-y-4">
          
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-slate-100 pb-3">
            <div>
              <h3 className="font-bold text-slate-900 font-poppins text-base sm:text-lg flex items-center gap-2">
                <BookOpen className="w-4 h-4 sm:w-5 sm:h-5 text-rose-600" /> Counter Khata Book
              </h3>
              <p className="text-[11px] sm:text-xs text-slate-500">Independent credit register for customers with pending spare part dues.</p>
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
          {khataDebtors.filter(k => parseFloat(k.pending_amount || 0) > 0).length === 0 ? (
            <div className="text-center py-10 text-slate-400">
              <CheckCircle2 className="w-10 h-10 mx-auto stroke-1 mb-2 text-emerald-400" />
              <p className="text-xs sm:text-sm font-bold text-slate-700">All Clear! No Pending Spare Part Dues.</p>
              <p className="text-[11px] text-slate-400 mt-0.5">Any credit counter sales will automatically appear here.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {khataDebtors
                .filter(k => parseFloat(k.pending_amount || 0) > 0)
                .filter(k => {
                  const q = khataSearch.toLowerCase();
                  return !q || (k.customer_name || '').toLowerCase().includes(q) || (k.customer_phone || '').includes(q);
                })
                .map((debtor) => (
                  <div key={debtor.id} className="p-4 rounded-xl sm:rounded-2xl bg-slate-50 border border-slate-200 space-y-3 hover:shadow-xs transition-shadow">
                    
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="font-bold text-slate-900 text-xs sm:text-sm font-poppins">{debtor.customer_name}</h4>
                        <span className="font-mono text-slate-500 text-[11px] block">{debtor.customer_phone || debtor.phone}</span>
                      </div>

                      <div className="text-right">
                        <span className="text-[9px] font-bold text-rose-600 uppercase block">Due</span>
                        <span className="text-sm sm:text-base font-black font-mono text-rose-600">
                          ₹{parseFloat(debtor.pending_amount || 0).toFixed(2)}
                        </span>
                      </div>
                    </div>

                    <div className="text-xs text-slate-600 bg-white p-2.5 rounded-xl border border-slate-200/70 space-y-1">
                      <div className="flex justify-between text-[10px] sm:text-[11px]">
                        <span className="text-slate-400">Total Purchase:</span>
                        <span className="font-mono font-bold">₹{parseFloat(debtor.total_amount || 0).toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-[10px] sm:text-[11px]">
                        <span className="text-slate-400">Paid So Far:</span>
                        <span className="font-mono font-bold text-emerald-600">₹{parseFloat(debtor.paid_amount || 0).toFixed(2)}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 pt-0.5">
                      <button
                        type="button"
                        onClick={() => setPaymentModal({ isOpen: true, debtor, amount: '', paymentMode: 'CASH' })}
                        className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors flex items-center justify-center gap-1 active:scale-98"
                      >
                        <DollarSign className="w-3.5 h-3.5" /> Record Payment
                      </button>

                      {/* WhatsApp Reminder Button with WhatsApp Icon */}
                      <button
                        type="button"
                        onClick={() => handleShareKhataReminder(debtor)}
                        className="p-2 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 rounded-xl transition-colors active:scale-95"
                        title="Send WhatsApp Payment Reminder"
                      >
                        <WhatsAppIcon className="w-4 h-4" />
                      </button>

                      {/* Delete Khata Entry (Red) */}
                      <button
                        type="button"
                        onClick={() => handleDeleteKhataEntry(debtor)}
                        className="p-2 bg-slate-100 hover:bg-rose-100 text-slate-400 hover:text-rose-600 rounded-xl transition-colors active:scale-95"
                        title="Delete Khata Record permanently from database"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                  </div>
                ))}
            </div>
          )}

        </div>
      )}

      {/* MODAL 1: ADD NEW SPARE PART */}
      {showAddPartModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-2xl sm:rounded-3xl p-5 sm:p-7 max-w-md w-full space-y-4 shadow-2xl border border-slate-200 max-h-[90vh] overflow-y-auto">
            
            <h2 className="text-lg sm:text-xl font-bold text-slate-900 font-poppins">
              Add New Spare Part
            </h2>

            <form onSubmit={handleSaveNewPart} className="space-y-3.5">
              <div>
                <label className="block text-[10px] sm:text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  PART NAME *
                </label>
                <input
                  type="text"
                  required
                  value={newPartForm.part_name}
                  onChange={(e) => setNewPartForm({ ...newPartForm, part_name: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs sm:text-sm font-bold focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>

              <div>
                <label className="block text-[10px] sm:text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  CATEGORY *
                </label>
                <select
                  value={newPartForm.category}
                  onChange={(e) => setNewPartForm({ ...newPartForm, category: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-bold bg-slate-50 focus:outline-none"
                >
                  {INVENTORY_CATEGORIES.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] sm:text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    SELLING PRICE (₹) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={newPartForm.price}
                    onChange={(e) => setNewPartForm({ ...newPartForm, price: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs sm:text-sm font-mono font-bold focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[10px] sm:text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    CURRENT STOCK *
                  </label>
                  <input
                    type="number"
                    required
                    value={newPartForm.current_stock}
                    onChange={(e) => setNewPartForm({ ...newPartForm, current_stock: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs sm:text-sm font-mono font-bold focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] sm:text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  LOW STOCK ALERT THRESHOLD
                </label>
                <input
                  type="number"
                  required
                  value={newPartForm.min_stock_alert}
                  onChange={(e) => setNewPartForm({ ...newPartForm, min_stock_alert: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs sm:text-sm font-mono focus:outline-none"
                />
              </div>

              <div className="flex gap-2.5 pt-3">
                <button
                  type="button"
                  onClick={() => setShowAddPartModal(false)}
                  className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addingPart}
                  className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all disabled:opacity-50"
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
        <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-md flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-2xl sm:rounded-3xl p-5 sm:p-7 max-w-lg w-full space-y-4 shadow-2xl border border-slate-100 relative max-h-[90vh] overflow-y-auto">
            
            <div className="text-center space-y-1.5">
              <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto shadow-xs">
                <CheckCircle2 className="w-7 h-7 sm:w-8 sm:h-8" />
              </div>
              <h3 className="text-lg sm:text-xl font-bold font-poppins text-slate-900">Counter Sale Completed!</h3>
              <p className="text-[11px] sm:text-xs text-slate-500">
                Invoice generated & stock updated in database.
              </p>
            </div>

            {/* PREVIEW PHOTO CARD */}
            {successModal.photoUrl && (
              <div className="rounded-xl sm:rounded-2xl overflow-hidden border border-slate-200 shadow-xs">
                <img src={successModal.photoUrl} alt="Bill Preview" className="w-full object-contain max-h-52 bg-slate-50" />
              </div>
            )}

            {/* ACTION BUTTONS */}
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => handleDownloadCard(successModal.sale)}
                className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-xs inline-flex items-center justify-center gap-2 transition-all active:scale-98"
              >
                <Download className="w-4 h-4" /> Download Bill Photo Card
              </button>

              <button
                type="button"
                onClick={() => handleShareWhatsApp(successModal.sale)}
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs inline-flex items-center justify-center gap-2 transition-all active:scale-98"
              >
                <WhatsAppIcon className="w-4 h-4" /> Share on WhatsApp
              </button>

              <button
                type="button"
                onClick={() => setSuccessModal({ isOpen: false, sale: null, photoUrl: null })}
                className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-xs rounded-xl transition-all"
              >
                Done / Next Sale
              </button>
            </div>

          </div>
        </div>
      )}

      {/* MODAL 3: RECORD KHATA PAYMENT MODAL */}
      {paymentModal.isOpen && paymentModal.debtor && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-2xl sm:rounded-3xl p-5 sm:p-7 max-w-sm w-full space-y-4 shadow-2xl border border-slate-100 relative">
            
            <div className="flex justify-between items-center border-b border-slate-100 pb-2.5">
              <div>
                <h3 className="font-bold text-slate-900 font-poppins text-sm sm:text-base flex items-center gap-1.5">
                  <DollarSign className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-600" /> Record Khata Payment
                </h3>
                <p className="text-[11px] text-slate-500">Customer: {paymentModal.debtor.customer_name}</p>
              </div>
              <button
                type="button"
                onClick={() => setPaymentModal({ isOpen: false, debtor: null, amount: '', paymentMode: 'CASH' })}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleConfirmRecordPayment} className="space-y-3.5">
              <div className="p-2.5 bg-rose-50 rounded-xl border border-rose-100 flex justify-between items-center">
                <span className="text-xs font-bold text-rose-800">Pending Dues:</span>
                <span className="text-sm sm:text-base font-black font-mono text-rose-600">
                  ₹{parseFloat(paymentModal.debtor.pending_amount || 0).toFixed(2)}
                </span>
              </div>

              <div>
                <label className="block text-[10px] sm:text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  PAYMENT AMOUNT (₹) *
                </label>
                <input
                  type="number"
                  step="1"
                  required
                  value={paymentModal.amount}
                  onChange={(e) => setPaymentModal({ ...paymentModal, amount: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs sm:text-sm font-mono font-bold focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>

              <div>
                <label className="block text-[10px] sm:text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  PAYMENT METHOD
                </label>
                <select
                  value={paymentModal.paymentMode}
                  onChange={(e) => setPaymentMode(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:outline-none"
                >
                  <option value="CASH">Cash 💵</option>
                  <option value="UPI">UPI / GPay 📱</option>
                </select>
              </div>

              <div className="flex gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setPaymentModal({ isOpen: false, debtor: null, amount: '', paymentMode: 'CASH' })}
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-xs rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={recordingPayment}
                  className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs disabled:opacity-50 active:scale-98"
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
