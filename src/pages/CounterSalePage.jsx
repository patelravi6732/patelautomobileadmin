import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  ShoppingBag, Plus, Search, Trash2, CheckCircle2, AlertCircle, 
  Receipt, BookOpen, Download, Share2, Phone, User, Calendar, 
  DollarSign, Package, Tag, ArrowRight, RefreshCw, X, ShieldAlert,
  CreditCard, Smartphone, Check, Sparkles, Filter, ChevronRight,
  IndianRupee, Wrench, ShieldCheck, Layers, ShoppingCart, Send
} from 'lucide-react';
import { useAuth, DEFAULT_GARAGE_INFO } from '../context/AuthContext';
import { 
  fetchCloudCounterSales, pushCloudCounterSale, deleteCloudCounterSale,
  fetchCloudCounterKhata, pushCloudCounterKhata, deleteCloudCounterKhata,
  atomicRecordCounterPayment, syncCloudInventory, atomicAddInventoryItem,
  fetchMasterStore, saveMasterStore, pushCloudActiveCounterCart,
  pushCloudRecycleBinItem, pushCloudInventoryItem, fetchCloudInventory,
  atomicRestoreInventoryStock, atomicDeductInventoryStock
} from '../utils/cloudSync';
import { generateCounterSaleCardPhotoAsync, generateBillCanvasBlob } from '../utils/billCardGenerator';
import { formatDateDMY } from '../utils/dateFormatter';
import { openWhatsAppChat, sanitizeWhatsAppPhone } from '../utils/whatsappPhotoSharer';
import AdminPasswordModal from '../components/AdminPasswordModal';

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
  const auth = useAuth() || {};
  const garageInfo = auth.garageInfo || DEFAULT_GARAGE_INFO;
  const user = auth.user || null;
  const [activeTab, setActiveTab] = useState('NEW_SALE'); // NEW_SALE | INVOICES | KHATA
  const [mobilePosView, setMobilePosView] = useState('CATALOG'); // 'CATALOG' | 'CART' for mobile layout

  // Live Inventory & Catalog State
  const [inventory, setInventory] = useState([]);
  const [invSearch, setInvSearch] = useState('');
  const [invCategory, setInvCategory] = useState('ALL');

  // Load initial draft from localStorage or cloud (100% Crash-Proof)
  const loadInitialDraft = () => {
    try {
      const raw = localStorage.getItem('counter_sale_draft');
      if (raw && raw !== 'undefined' && raw !== 'null') {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          return parsed;
        }
      }
    } catch (e) {}
    return null;
  };

  const initialDraft = loadInitialDraft();

  // New Sale POS Form State (Synced across devices via MongoDB Atlas)
  const [customerName, setCustomerName] = useState(initialDraft?.customerName || '');
  const [customerPhone, setCustomerPhone] = useState(initialDraft?.customerPhone || '');
  const [vehicleNumber, setVehicleNumber] = useState(initialDraft?.vehicleNumber || '');
  const [cartItems, setCartItems] = useState(Array.isArray(initialDraft?.cartItems) ? initialDraft.cartItems : []);
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
      customerName: customerName || '',
      customerPhone: customerPhone || '',
      vehicleNumber: vehicleNumber || '',
      cartItems: Array.isArray(cartItems) ? cartItems : [],
      discountAmount: discountAmount || 0,
      paidAmount: paidAmount !== undefined ? paidAmount : '',
      paymentMode: paymentMode || 'CASH',
      updated_at: new Date().toISOString()
    };

    try {
      localStorage.setItem('counter_sale_draft', JSON.stringify(draft));
    } catch (e) {}

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

  // Admin Security Password Modal for Delete
  const [deleteSecurityModal, setDeleteSecurityModal] = useState({
    isOpen: false,
    item: null,
    type: null
  });
  const [recordingPayment, setRecordingPayment] = useState(false);

  // 1. Fetch Inventory Store (0ms Instant Local-First + Cloud Merge)
  const loadInventory = async () => {
    try {
      const raw = localStorage.getItem('inventory_items') || localStorage.getItem('spare_parts') || localStorage.getItem('local_inventory') || '[]';
      const local = JSON.parse(raw);
      const cloud = await fetchCloudInventory().catch(() => []);

      const localDeleted = JSON.parse(localStorage.getItem('deleted_ids') || '[]');
      const isDeleted = (item) => {
        if (!item) return true;
        const itId = String(item.id || '').toLowerCase().trim();
        if (!itId) return false;
        return localDeleted.some(d => {
          if (!d) return false;
          const dStr = String(d).toLowerCase().trim();
          return itId === dStr;
        });
      };

      const map = new Map();
      [...(Array.isArray(cloud) ? cloud : []), ...(Array.isArray(local) ? local : [])].forEach(it => {
        if (it && typeof it === 'object' && !isDeleted(it) && (it.part_name || it.item_name || it.name)) {
          const rawName = String(it.part_name || it.item_name || it.name || '').trim();
          const normKey = rawName.toLowerCase().replace(/[^a-z0-9]/g, '');
          if (normKey) {
            map.set(normKey, { ...it, part_name: rawName, item_name: rawName, name: rawName });
          }
        }
      });
      const finalItems = Array.from(map.values());
      setInventory(finalItems);
    } catch (e) {
      console.warn('Error loading inventory for counter sale:', e);
    }
  };

  // 2. Fetch Counter Sales Invoices
  const loadInvoices = async () => {
    try {
      const data = await fetchCloudCounterSales();
      setInvoices(Array.isArray(data) ? data : []);
    } catch (e) {
      console.warn('Error loading counter sales:', e);
      setInvoices([]);
    }
  };

  // 3. Fetch Counter Khata
  const loadKhata = async () => {
    try {
      const data = await fetchCloudCounterKhata();
      setKhataDebtors(Array.isArray(data) ? data : []);
    } catch (e) {
      console.warn('Error loading counter khata:', e);
      setKhataDebtors([]);
    }
  };

  // 4. Sync Cross-Device Cart from Master Store
  const syncCrossDeviceCart = async () => {
    if (isSyncingFromCloud.current) return;
    try {
      let localDraft = null;
      try {
        const rawLocal = localStorage.getItem('counter_sale_draft');
        if (rawLocal && rawLocal !== 'undefined') localDraft = JSON.parse(rawLocal);
      } catch (e) {}

      const store = await fetchMasterStore();
      const cloudCart = store.activeCounterCart;
      if (cloudCart && typeof cloudCart === 'object') {
        const cloudTime = new Date(cloudCart.updated_at || 0).getTime();
        const localTime = new Date(localDraft?.updated_at || 0).getTime();

        if (cloudTime > (localTime + 2000) || (!localDraft && Array.isArray(cloudCart.cartItems) && cloudCart.cartItems.length > 0)) {
          isSyncingFromCloud.current = true;
          setCustomerName(cloudCart.customerName || '');
          setCustomerPhone(cloudCart.customerPhone || '');
          setVehicleNumber(cloudCart.vehicleNumber || '');
          setCartItems(Array.isArray(cloudCart.cartItems) ? cloudCart.cartItems : []);
          setDiscountAmount(cloudCart.discountAmount || 0);
          setPaidAmount(cloudCart.paidAmount !== undefined ? cloudCart.paidAmount : '');
          setPaymentMode(cloudCart.paymentMode || 'CASH');
          try {
            localStorage.setItem('counter_sale_draft', JSON.stringify(cloudCart));
          } catch (e) {}
          setTimeout(() => { isSyncingFromCloud.current = false; }, 800);
        }
      }
    } catch (e) {}
  };

  // Automatic Self-Healing Storage Protection
  useEffect(() => {
    try {
      ['counter_sale_draft', 'local_counter_sales', 'local_counter_khata'].forEach(key => {
        const raw = localStorage.getItem(key);
        if (raw === 'undefined' || raw === 'null' || raw === '[object Object]') {
          localStorage.removeItem(key);
        }
      });
    } catch (e) {}
  }, []);

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
    window.addEventListener('storage', handleUpdates);

    const interval = setInterval(() => {
      loadInventory();
      syncCrossDeviceCart();
    }, 4000);

    return () => {
      clearInterval(interval);
      window.removeEventListener('master_store_updated', handleUpdates);
      window.removeEventListener('inventory_updated', handleUpdates);
      window.removeEventListener('counter_cart_updated', handleUpdates);
      window.removeEventListener('storage', handleUpdates);
    };
  }, []);

  // Filtered Inventory Catalog (100% Safe against non-array inventory)
  const filteredCatalog = useMemo(() => {
    if (!Array.isArray(inventory)) return [];
    return inventory.filter(item => {
      if (!item || typeof item !== 'object') return false;
      const name = (item.part_name || item.item_name || item.name || '').toLowerCase();
      const query = (invSearch || '').toLowerCase().trim();
      const matchesSearch = !query || name.includes(query);
      const matchesCat = !invCategory || invCategory === 'ALL' || (item.category || '').toLowerCase() === invCategory.toLowerCase();
      return matchesSearch && matchesCat;
    });
  }, [inventory, invSearch, invCategory]);

  const categoriesList = useMemo(() => {
    const set = new Set(['ALL', ...INVENTORY_CATEGORIES]);
    if (Array.isArray(inventory)) {
      inventory.forEach(i => {
        if (i && typeof i === 'object' && i.category) set.add(String(i.category));
      });
    }
    return Array.from(set);
  }, [inventory]);

  // Cart Calculations (Pure & Safe Memoization - No infinite re-render loops)
  const cartSubtotal = useMemo(() => {
    if (!Array.isArray(cartItems)) return 0;
    return cartItems.reduce((sum, it) => {
      if (!it) return sum;
      const price = parseFloat(it.selling_price || it.unit_price || it.price || 0);
      const qty = parseInt(it.quantity || 1, 10);
      return sum + (price * qty);
    }, 0);
  }, [cartItems]);

  const numericDiscount = useMemo(() => {
    const d = parseFloat(discountAmount);
    return isNaN(d) ? 0 : Math.max(0, d);
  }, [discountAmount]);

  const cartNetTotal = useMemo(() => {
    return Math.max(0, cartSubtotal - numericDiscount);
  }, [cartSubtotal, numericDiscount]);

  const effectivePaid = useMemo(() => {
    if (paidAmount === '' || paidAmount === undefined || paidAmount === null) {
      return 0;
    }
    const parsed = parseFloat(paidAmount);
    if (isNaN(parsed)) return 0;
    return Math.min(cartNetTotal, Math.max(0, parsed));
  }, [paidAmount, cartNetTotal]);

  const cartPendingBalance = useMemo(() => {
    return Math.max(0, cartNetTotal - effectivePaid);
  }, [cartNetTotal, effectivePaid]);

  const hasUnconfirmedParts = useMemo(() => {
    return Array.isArray(cartItems) && cartItems.some(p => {
      if (!p) return false;
      const qty = parseInt(p.quantity || 1, 10);
      const ded = parseInt(p.deducted_qty || 0, 10);
      return qty > ded || !p.is_deducted || p.status !== 'CONFIRMED';
    });
  }, [cartItems]);

  // Handle Confirm & Lock Stock for Cart Parts
  const handleConfirmCartParts = async () => {
    const unconfirmed = cartItems.filter(p => {
      if (!p) return false;
      const qty = parseInt(p.quantity || 1, 10);
      const ded = parseInt(p.deducted_qty || 0, 10);
      return qty > ded || !p.is_deducted || p.status !== 'CONFIRMED';
    });

    if (unconfirmed.length === 0) {
      alert('ℹ️ All spare parts in the cart are already confirmed & stock locked!');
      return;
    }

    setConfirmingParts(true);
    try {
      const localInv = JSON.parse(localStorage.getItem('inventory_items') || localStorage.getItem('spare_parts') || localStorage.getItem('local_inventory') || '[]');
      const cloudInv = await fetchCloudInventory().catch(() => []);
      const allInvMap = new Map();
      [...cloudInv, ...localInv].forEach(item => {
        if (item && (item.id || item.part_name || item.item_name || item.name)) {
          const rawName = String(item.part_name || item.item_name || item.name || '').trim();
          const key = rawName.toLowerCase().replace(/[^a-z0-9]/g, '');
          if (!allInvMap.has(key)) allInvMap.set(key, item);
        }
      });

      let invList = Array.from(allInvMap.values());
      let invChanged = false;

      unconfirmed.forEach(pToUse => {
        if (!pToUse) return;
        const pId = String(pToUse.inventory_id || pToUse.part_id || pToUse.id || '').replace(/[^a-z0-9]/g, '');
        const pName = String(pToUse.part_name || pToUse.item_name || pToUse.name || '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase().trim();
        const totalQty = parseInt(pToUse.quantity || 1, 10);
        const alreadyDed = parseInt(pToUse.deducted_qty || 0, 10);
        const toDeduct = Math.max(0, totalQty - alreadyDed);

        if (toDeduct <= 0) return;

        invList = invList.map(invItem => {
          if (!invItem) return invItem;
          const invId = String(invItem.id || '').replace(/[^a-z0-9]/g, '');
          const invName = String(invItem.part_name || invItem.item_name || invItem.name || '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase().trim();

          const isMatch = (pId && invId && pId === invId) || (pName && invName && (pName === invName || pName.includes(invName) || invName.includes(pName)));

          if (isMatch) {
            invChanged = true;
            const currentQty = parseInt(invItem.current_stock !== undefined ? invItem.current_stock : (invItem.stock_quantity !== undefined ? invItem.stock_quantity : (invItem.quantity !== undefined ? invItem.quantity : 0)), 10);
            const newQty = Math.max(0, currentQty - toDeduct);
            const updatedItem = {
              ...invItem,
              current_stock: newQty,
              stock_quantity: newQty,
              quantity: newQty,
              updated_at: new Date().toISOString()
            };
            pushCloudInventoryItem(updatedItem).catch(console.warn);
            return updatedItem;
          }
          return invItem;
        });
      });

      if (invChanged) {
        localStorage.setItem('inventory_items', JSON.stringify(invList));
        localStorage.setItem('spare_parts', JSON.stringify(invList));
        localStorage.setItem('local_inventory', JSON.stringify(invList));
        setInventory(invList);
        await syncCloudInventory(invList).catch(console.warn);
        try {
          window.dispatchEvent(new Event('inventory_updated'));
          window.dispatchEvent(new Event('master_store_updated'));
        } catch (e) {}
        loadInventory();
      }

      // Mark all cart items as CONFIRMED and deducted_qty equal to quantity
      const updatedCart = cartItems.map(p => ({
        ...p,
        status: 'CONFIRMED',
        is_deducted: true,
        is_confirmed: true,
        deducted_qty: parseInt(p.quantity || 1, 10)
      }));
      setCartItems(updatedCart);
      alert(`✅ ${unconfirmed.length} Spare Part(s) Confirmed & Stock Deducted from Inventory!`);
    } catch (err) {
      console.error('Error confirming cart parts:', err);
      alert('⚠️ Failed to lock stock. Please try again.');
    } finally {
      setConfirmingParts(false);
    }
  };

  // Handle Add Item to Cart (Workshop Style)
  const handleAddToCart = (item) => {
    if (!item) return;
    const invItem = inventory.find(inv => {
      const invId = String(inv.id || '').trim();
      const invNorm = String(inv.part_name || inv.item_name || inv.name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      const itId = String(item.id || '').trim();
      const itNorm = String(item.part_name || item.item_name || item.name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      return (itId && invId && itId === invId) || (itNorm && invNorm && itNorm === invNorm);
    }) || item;

    const liveStock = parseInt(invItem.current_stock !== undefined ? invItem.current_stock : (invItem.stock_quantity !== undefined ? invItem.stock_quantity : (invItem.quantity !== undefined ? invItem.quantity : 0)), 10);
    const rawName = String(invItem.part_name || invItem.item_name || invItem.name || 'Spare Part').trim();
    const itemNorm = rawName.toLowerCase().replace(/[^a-z0-9]/g, '');
    const priceVal = parseFloat(invItem.price || invItem.selling_price || invItem.unit_price || 0);

    const existingIndex = cartItems.findIndex(i => {
      if (!i) return false;
      const iNorm = String(i.part_name || i.item_name || i.name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      return (i.id && invItem.id && String(i.id) === String(invItem.id)) || (iNorm && itemNorm && iNorm === itemNorm);
    });

    if (existingIndex >= 0) {
      const existing = cartItems[existingIndex];
      const currentQty = existing.quantity || 1;
      const alreadyDeducted = parseInt(existing.deducted_qty !== undefined ? existing.deducted_qty : (existing.is_deducted ? existing.quantity : 0), 10);
      const maxAllowed = liveStock + alreadyDeducted;
      if (currentQty + 1 > maxAllowed) {
        alert(`⚠️ Maximum available stock for '${rawName}' is ${maxAllowed} unit(s).`);
        return;
      }
      const newDeducted = alreadyDeducted + 1;
      const nextCart = cartItems.map((cItem, idx) => idx === existingIndex ? {
        ...cItem,
        quantity: currentQty + 1,
        deducted_qty: newDeducted,
        status: 'CONFIRMED',
        is_deducted: true
      } : cItem);
      setCartItems(nextCart);

      atomicDeductInventoryStock({
        partId: invItem.id,
        partName: rawName,
        quantity: 1
      }).then(() => loadInventory()).catch(console.warn);
    } else {
      if (liveStock <= 0) {
        alert(`⚠️ '${rawName}' is currently Out of Stock!`);
        return;
      }
      const nextCart = [...cartItems, {
        id: invItem.id || `cart_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
        inventory_id: invItem.id,
        item_name: rawName,
        part_name: rawName,
        selling_price: priceVal,
        unit_price: priceVal,
        quantity: 1,
        available_stock: liveStock - 1,
        deducted_qty: 1,
        status: 'CONFIRMED',
        is_deducted: true
      }];
      setCartItems(nextCart);

      atomicDeductInventoryStock({
        partId: invItem.id,
        partName: rawName,
        quantity: 1
      }).then(() => loadInventory()).catch(console.warn);
    }
  };

  // Update Cart Item Quantity (Synchronous UI Update + Auto-Restores/Deducts Stock dynamically)
  const handleUpdateQty = async (itemId, newQty) => {
    const qty = parseInt(newQty, 10);
    if (isNaN(qty) || qty <= 0) return;

    let deltaToRestore = 0;
    let deltaToDeduct = 0;
    let targetPartInfo = null;

    setCartItems(prevCart => {
      const target = prevCart.find(i => String(i.id) === String(itemId));
      if (!target) return prevCart;

      targetPartInfo = target;
      const invItem = inventory.find(inv => {
        const invId = String(inv.id || '').trim();
        const invNorm = String(inv.part_name || inv.item_name || inv.name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
        const tId = String(target.inventory_id || target.part_id || target.id || '').trim();
        const tNorm = String(target.part_name || target.item_name || target.name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
        return (tId && invId && tId === invId) || (tNorm && invNorm && tNorm === invNorm);
      });

      const liveStock = parseInt(invItem?.current_stock !== undefined ? invItem.current_stock : (invItem?.stock_quantity !== undefined ? invItem.stock_quantity : 0), 10);
      const alreadyDeducted = parseInt(target.deducted_qty !== undefined ? target.deducted_qty : (target.is_deducted ? target.quantity : 0), 10);
      const maxAllowed = liveStock + alreadyDeducted;

      if (qty > maxAllowed) {
        alert(`⚠️ Maximum available stock for '${target.part_name || target.item_name}' is ${maxAllowed} unit(s)!`);
        return prevCart;
      }

      if (qty > alreadyDeducted) {
        deltaToDeduct = qty - alreadyDeducted;
      } else if (alreadyDeducted > qty) {
        deltaToRestore = alreadyDeducted - qty;
      }

      return prevCart.map(i => String(i.id) === String(itemId) ? {
        ...i,
        quantity: qty,
        deducted_qty: qty,
        status: 'CONFIRMED',
        is_deducted: true
      } : i);
    });

    if (deltaToRestore > 0 && targetPartInfo) {
      try {
        await atomicRestoreInventoryStock({
          partId: targetPartInfo.inventory_id || targetPartInfo.part_id || targetPartInfo.id,
          partName: targetPartInfo.part_name || targetPartInfo.item_name || targetPartInfo.name,
          quantity: deltaToRestore
        });
        await loadInventory();
      } catch (err) {
        console.warn('Error restoring stock on quantity decrement:', err);
      }
    } else if (deltaToDeduct > 0 && targetPartInfo) {
      try {
        await atomicDeductInventoryStock({
          partId: targetPartInfo.inventory_id || targetPartInfo.part_id || targetPartInfo.id,
          partName: targetPartInfo.part_name || targetPartInfo.item_name || targetPartInfo.name,
          quantity: deltaToDeduct
        });
        await loadInventory();
      } catch (err) {
        console.warn('Error deducting stock on quantity increment:', err);
      }
    }
  };

  // Remove Item from Cart (0ms Instant UI Response + Restores Confirmed Stock back to Inventory)
  const handleRemoveFromCart = async (itemId) => {
    const itemToRemove = cartItems.find(i => String(i.id) === String(itemId));
    if (!itemToRemove) return;

    // 1. Immediately remove from UI state at 0ms (first click response)
    const nextCart = cartItems.filter(i => String(i.id) !== String(itemId));
    setCartItems(nextCart);

    // 2. Restore stock if the item was already deducted/confirmed
    const returnQty = parseInt(itemToRemove.deducted_qty !== undefined ? itemToRemove.deducted_qty : (itemToRemove.is_deducted ? itemToRemove.quantity : 0), 10);

    if (returnQty > 0) {
      try {
        await atomicRestoreInventoryStock({
          partId: itemToRemove.inventory_id || itemToRemove.part_id || itemToRemove.id,
          partName: itemToRemove.part_name || itemToRemove.item_name || itemToRemove.name,
          quantity: returnQty
        });
        await loadInventory();
      } catch (e) {
        console.warn('Error restoring stock on cart remove:', e);
      }
    }
  };

  // Clear Cart Completely (0ms Instant UI Reset for Cart, Customer Name, Mobile Number + Restores Stock)
  const handleClearCart = async () => {
    if (cartItems.length === 0 && !customerName && !customerPhone) return;
    if (!window.confirm('Are you sure you want to clear the active cart and customer details?')) return;

    const itemsToRestore = cartItems.filter(i => i && (i.is_deducted || (i.deducted_qty && i.deducted_qty > 0) || i.status === 'CONFIRMED'));

    // 1. Clear all inputs and cart immediately at 0ms
    setCartItems([]);
    setCustomerName('');
    setCustomerPhone('');
    setDiscount('');
    localStorage.removeItem('counter_sale_draft');
    pushCloudActiveCounterCart(null).catch(() => null);

    // 2. Restore any confirmed items back to inventory stock
    if (itemsToRestore.length > 0) {
      try {
        for (const itemToRemove of itemsToRestore) {
          const returnQty = parseInt(itemToRemove.deducted_qty !== undefined ? itemToRemove.deducted_qty : (itemToRemove.is_deducted ? itemToRemove.quantity : (itemToRemove.status === 'CONFIRMED' ? itemToRemove.quantity : 0)), 10);
          if (returnQty > 0) {
            await atomicRestoreInventoryStock({
              partId: itemToRemove.inventory_id || itemToRemove.part_id || itemToRemove.id,
              partName: itemToRemove.part_name || itemToRemove.item_name || itemToRemove.name,
              quantity: returnQty
            });
          }
        }
        await loadInventory();
      } catch (e) {
        console.warn('Error restoring stock on clear cart:', e);
      }
    }
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
      // 1. Deduct only unconfirmed parts from inventory (if not already deducted during Confirm Parts)
      const unconfirmedParts = cartItems.filter(p => p && (!p.is_deducted || p.status !== 'CONFIRMED'));
      if (unconfirmedParts.length > 0) {
        const localInv = JSON.parse(localStorage.getItem('inventory_items') || localStorage.getItem('spare_parts') || localStorage.getItem('local_inventory') || '[]');
        const cloudInv = await fetchCloudInventory().catch(() => []);
        const allInvMap = new Map();
        [...cloudInv, ...localInv].forEach(item => {
          if (item && (item.id || item.part_name || item.item_name || item.name)) {
            const rawName = String(item.part_name || item.item_name || item.name || '').trim();
            const key = rawName.toLowerCase().replace(/[^a-z0-9]/g, '');
            if (!allInvMap.has(key)) allInvMap.set(key, item);
          }
        });

        let invList = Array.from(allInvMap.values());
        let invChanged = false;

        unconfirmedParts.forEach(pToUse => {
          if (!pToUse) return;
          const pId = String(pToUse.inventory_id || pToUse.part_id || pToUse.id || '').replace(/[^a-z0-9]/g, '');
          const pName = String(pToUse.part_name || pToUse.item_name || pToUse.name || '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase().trim();
          const usedQty = parseInt(pToUse.quantity || 1, 10);

          invList = invList.map(invItem => {
            if (!invItem) return invItem;
            const invId = String(invItem.id || '').replace(/[^a-z0-9]/g, '');
            const invName = String(invItem.part_name || invItem.item_name || invItem.name || '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase().trim();

            const isMatch = (pId && invId && pId === invId) || (pName && invName && (pName === invName || pName.includes(invName) || invName.includes(pName)));

            if (isMatch) {
              invChanged = true;
              const currentQty = parseInt(invItem.current_stock !== undefined ? invItem.current_stock : (invItem.stock_quantity !== undefined ? invItem.stock_quantity : (invItem.quantity !== undefined ? invItem.quantity : 0)), 10);
              const newQty = Math.max(0, currentQty - usedQty);
              const updatedItem = {
                ...invItem,
                current_stock: newQty,
                stock_quantity: newQty,
                quantity: newQty,
                updated_at: new Date().toISOString()
              };
              pushCloudInventoryItem(updatedItem).catch(console.warn);
              return updatedItem;
            }
            return invItem;
          });
        });

        if (invChanged) {
          localStorage.setItem('inventory_items', JSON.stringify(invList));
          localStorage.setItem('spare_parts', JSON.stringify(invList));
          localStorage.setItem('local_inventory', JSON.stringify(invList));
          setInventory(invList);
          await syncCloudInventory(invList).catch(console.warn);
          try {
            window.dispatchEvent(new Event('inventory_updated'));
            window.dispatchEvent(new Event('master_store_updated'));
          } catch (e) {}
          loadInventory();
        }
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
          subtotal: cartSubtotal,
          discount: numericDiscount,
          discount_amount: numericDiscount,
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

  // Handle Save New Part (Adds to Main Inventory & Catalog, NEVER automatically to Cart)
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
      const rawName = newPartForm.part_name.trim();
      const normKey = rawName.toLowerCase().replace(/[^a-z0-9]/g, '');
      const priceVal = parseFloat(newPartForm.price) || 0;
      const stockVal = parseInt(newPartForm.current_stock, 10) || 0;
      const minStock = parseInt(newPartForm.min_stock_alert || 5, 10) || 5;

      const newPartObj = {
        id: `inv_${normKey || Date.now()}`,
        name: rawName,
        part_name: rawName,
        item_name: rawName,
        category: newPartForm.category || 'General',
        price: priceVal,
        unit_price: priceVal,
        selling_price: priceVal,
        current_stock: stockVal,
        stock_quantity: stockVal,
        quantity: stockVal,
        min_stock_alert: minStock,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const savedItem = await pushCloudInventoryItem(newPartObj);

      setInventory(prev => [savedItem || newPartObj, ...prev.filter(i => String(i.part_name || '').toLowerCase() !== rawName.toLowerCase())]);

      alert(`✅ '${rawName}' successfully added to Main Inventory and Catalog!`);
      setShowAddPartModal(false);
      setNewPartForm({
        part_name: '',
        category: 'General',
        price: '',
        current_stock: '',
        min_stock_alert: '5'
      });
      await loadInventory();
    } catch (err) {
      console.error('Error adding spare part:', err);
      alert('⚠️ Failed to add spare part. Please try again.');
    } finally {
      setAddingPart(false);
    }
  };

  // Initiate Delete Counter Sale Invoice (Triggers Admin Security Password Modal)
  const handleDeleteInvoice = (inv) => {
    if (!inv || !inv.id) return;
    setDeleteSecurityModal({
      isOpen: true,
      item: inv,
      type: 'INVOICE'
    });
  };

  // Initiate Delete Counter Khata Debtor (Triggers Admin Security Password Modal)
  const handleDeleteKhataEntry = (debtor) => {
    if (!debtor || !debtor.id) return;
    setDeleteSecurityModal({
      isOpen: true,
      item: debtor,
      type: 'KHATA'
    });
  };

  // Perform Delete with Admin Password Confirmation
  const handleConfirmDeleteWithPassword = async (adminPassword) => {
    if (!deleteSecurityModal.item || !deleteSecurityModal.type) return;

    if (deleteSecurityModal.type === 'INVOICE') {
      const inv = deleteSecurityModal.item;
      const trashId = `trash_cs_${inv.id}`;
      const trashObj = {
        id: trashId,
        item_type: 'Counter Sale Invoice',
        title: `Counter Sale: ${inv.customer_name} (₹${inv.net_total || inv.total_amount || 0})`,
        deleted_by: user?.user_name || 'Patel Owner (Admin)',
        deleted_at: new Date().toISOString(),
        details: `Customer: ${inv.customer_name} • Mobile: ${inv.customer_phone || inv.mobile_number} • Total: ₹${inv.net_total || inv.total_amount || 0} • Status: ${inv.payment_status || 'PAID'}`,
        payload: inv
      };

      const existingTrash = JSON.parse(localStorage.getItem('recycle_bin_items') || '[]')
        .filter(t => String(t.id) !== trashId && (!t.payload || String(t.payload.id) !== String(inv.id)));
      localStorage.setItem('recycle_bin_items', JSON.stringify([trashObj, ...existingTrash]));
      await pushCloudRecycleBinItem(trashObj).catch(console.warn);

      const filtered = invoices.filter(i => String(i.id) !== String(inv.id));
      setInvoices(filtered);
      localStorage.setItem('local_counter_sales', JSON.stringify(filtered));

      await deleteCloudCounterSale(inv.id);
      
      try {
        window.dispatchEvent(new Event('master_store_updated'));
        window.dispatchEvent(new Event('storage'));
      } catch (e) {}

      alert(`🗑️ Invoice for ${inv.customer_name} moved to Recycle Bin!`);
      const updatedSales = await fetchCloudCounterSales();
      setInvoices(updatedSales);

    } else if (deleteSecurityModal.type === 'KHATA') {
      const debtor = deleteSecurityModal.item;
      const trashId = `trash_ckhata_${debtor.id}`;
      const trashObj = {
        id: trashId,
        item_type: 'Counter Khata Entry',
        title: `Counter Khata: ${debtor.customer_name} (Due: ₹${debtor.pending_amount || 0})`,
        deleted_by: user?.user_name || 'Patel Owner (Admin)',
        deleted_at: new Date().toISOString(),
        details: `Customer: ${debtor.customer_name} • Mobile: ${debtor.customer_phone || debtor.phone} • Pending Due: ₹${debtor.pending_amount || 0}`,
        payload: debtor
      };

      const existingTrash = JSON.parse(localStorage.getItem('recycle_bin_items') || '[]')
        .filter(t => String(t.id) !== trashId && (!t.payload || String(t.payload.id) !== String(debtor.id)));
      localStorage.setItem('recycle_bin_items', JSON.stringify([trashObj, ...existingTrash]));
      await pushCloudRecycleBinItem(trashObj).catch(console.warn);

      const filtered = khataDebtors.filter(k => String(k.id) !== String(debtor.id));
      setKhataDebtors(filtered);
      localStorage.setItem('local_counter_khata', JSON.stringify(filtered));

      await deleteCloudCounterKhata(debtor.id);

      try {
        window.dispatchEvent(new Event('master_store_updated'));
        window.dispatchEvent(new Event('storage'));
      } catch (e) {}

      alert(`🗑️ Khata record for ${debtor.customer_name} moved to Recycle Bin!`);
      const updatedKhata = await fetchCloudCounterKhata();
      setKhataDebtors(updatedKhata);
    }
  };

  // Record Khata Payment
  const handleConfirmRecordPayment = async (e) => {
    e.preventDefault();
    const maxDue = parseFloat(paymentModal.debtor?.pending_amount || 0);
    const numAmt = parseFloat(paymentModal.amount || 0);
    if (numAmt <= 0) {
      alert('Please enter a valid payment amount!');
      return;
    }
    if (numAmt > maxDue) {
      alert(`⚠️ Payment amount (₹${numAmt.toFixed(2)}) cannot exceed remaining pending dues of ₹${maxDue.toFixed(2)}!`);
      setPaymentModal(prev => ({ ...prev, amount: String(maxDue) }));
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
      await loadKhata();
      await loadInvoices();
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
    const timeCode = Date.now().toString().slice(-4);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Bill_${(sale.customer_name || 'CounterSale').replace(/\s+/g, '_')}_${formatDateDMY(sale.created_at || Date.now())}_${timeCode}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // WhatsApp Share Helper (Auto Generated HD Card + Formatted Message)
  const handleShareWhatsApp = async (sale) => {
    if (!sale) return;
    const rawPhone = sale.customer_phone || sale.mobile_number || sale.phone || '';
    
    // Automatically trigger HD Photo Card download
    handleDownloadCard(sale).catch(() => null);

    const garageName = garageInfo?.garage_name || 'Patel Automobiles';
    const garagePhone = garageInfo?.phone || '+91 81403 71414';

    const msg = `Thank you for choosing ${garageName}! Wish you a safe & smooth ride. 🛵⛑️\n\n📞 Contact: ${garagePhone}\n— ${garageName}`;

    openWhatsAppChat(rawPhone, msg);
  };

  // Download Khata Statement Photo Card
  const handleDownloadKhataCard = async (debtor) => {
    if (!debtor) return;
    const invAdapter = {
      id: debtor.id,
      customer_name: debtor.customer_name,
      customer_phone: debtor.customer_phone || debtor.phone,
      mobile_number: debtor.customer_phone || debtor.phone,
      vehicle_number: debtor.vehicle_number || '',
      created_at: debtor.created_at || Date.now(),
      items: [{
        item_name: debtor.items_summary || 'Spare Parts Counter Purchase',
        quantity: 1,
        unit_price: parseFloat(debtor.total_amount || 0),
        total: parseFloat(debtor.total_amount || 0)
      }],
      subtotal: parseFloat(debtor.total_amount || 0),
      grand_total: parseFloat(debtor.total_amount || 0),
      total_amount: parseFloat(debtor.total_amount || 0),
      paid_amount: parseFloat(debtor.paid_amount || 0),
      pending_amount: parseFloat(debtor.pending_amount || 0)
    };

    const url = await generateCounterSaleCardPhotoAsync(invAdapter, garageInfo);
    if (!url) return;
    const timeCode = Date.now().toString().slice(-4);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Statement_${(debtor.customer_name || 'Customer').replace(/\s+/g, '_')}_${formatDateDMY(debtor.created_at || Date.now())}_${timeCode}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // WhatsApp Khata Reminder Helper
  const handleShareKhataReminder = async (debtor) => {
    if (!debtor) return;
    const rawPhone = debtor.customer_phone || debtor.phone || debtor.mobile_number || '';
    
    // Automatically trigger Statement Photo Card download with QR scanner
    handleDownloadKhataCard(debtor).catch(() => null);

    const garageName = garageInfo?.garage_name || 'Patel Automobiles';
    const garagePhone = garageInfo?.phone || '+91 81403 71414';

    const msg = `Thank you for choosing ${garageName}! Wish you a safe & smooth ride. 🛵⛑️\n\n📞 Contact: ${garagePhone}\n— ${garageName}`;

    openWhatsAppChat(rawPhone, msg);
  };

  // Stats Calculations (100% Crash-Proof)
  const todaySalesTotal = useMemo(() => {
    if (!Array.isArray(invoices)) return 0;
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    return invoices
      .filter(i => i && typeof i === 'object' && new Date(i.created_at || i.date || 0) >= startOfDay)
      .reduce((sum, i) => sum + (parseFloat(i.paid_amount || i.net_total || i.total_amount || 0) || 0), 0);
  }, [invoices]);

  const totalKhataPending = useMemo(() => {
    if (!Array.isArray(khataDebtors)) return 0;
    return khataDebtors
      .filter(k => k && typeof k === 'object' && k.status !== 'PAID' && parseFloat(k.pending_amount || 0) > 0)
      .reduce((sum, k) => sum + (parseFloat(k.pending_amount || 0) || 0), 0);
  }, [khataDebtors]);

  const safeInvoicesCount = useMemo(() => Array.isArray(invoices) ? invoices.length : 0, [invoices]);
  const safeKhataCount = useMemo(() => Array.isArray(khataDebtors) ? khataDebtors.filter(k => k && parseFloat(k.pending_amount || 0) > 0).length : 0, [khataDebtors]);

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
          <Receipt className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> 2. Invoices ({safeInvoicesCount})
        </button>

        <button
          onClick={() => { setActiveTab('KHATA'); loadKhata(); }}
          className={`flex items-center gap-1.5 px-3.5 sm:px-5 py-2 sm:py-2.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
            activeTab === 'KHATA'
              ? 'bg-blue-600 text-white shadow-sm shadow-blue-600/20'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <BookOpen className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> 3. Khata Book ({safeKhataCount})
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
                      {cartItems.map((item, idx) => {
                        if (!item) return null;
                        const itemPrice = parseFloat(item.selling_price || item.unit_price || item.price || 0);
                        const qty = parseInt(item.quantity || 1, 10);
                        const itemTotal = itemPrice * qty;
                        const isConfirmed = item.status === 'CONFIRMED';
                        const itemKey = item.id || `citem_${idx}`;
                        const rawName = item.part_name || item.item_name || 'Spare Part';

                        return (
                          <div key={itemKey} className="p-2.5 sm:p-3 bg-slate-50 rounded-xl sm:rounded-2xl border border-slate-200/80 flex items-center justify-between gap-2.5">
                            <div className="flex-1 min-w-0">
                              <h5 className="text-xs font-bold text-slate-900 truncate">{rawName}</h5>
                              <div className="flex items-center gap-1.5 mt-0.5">
                                <span className="text-[10px] sm:text-[11px] font-mono text-slate-500">₹{itemPrice.toFixed(2)}</span>
                                {isConfirmed && (
                                  <span className="text-[9px] sm:text-[10px] font-bold px-1.5 py-0.2 rounded font-mono text-emerald-700 bg-emerald-100">
                                    ✓ Confirmed
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Qty Counter */}
                            <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg px-1.5 py-0.5">
                              <button
                                type="button"
                                onClick={() => handleUpdateQty(itemKey, qty - 1)}
                                className="text-slate-500 hover:text-rose-600 font-bold px-1 text-sm cursor-pointer"
                              >
                                -
                              </button>
                              <span className="text-xs font-mono font-bold w-5 text-center">{qty}</span>
                              <button
                                type="button"
                                onClick={() => handleUpdateQty(itemKey, qty + 1)}
                                className="text-slate-500 hover:text-emerald-600 font-bold px-1 text-sm cursor-pointer"
                              >
                                +
                              </button>
                            </div>

                            <span className="text-xs font-black font-mono text-slate-900 w-14 sm:w-16 text-right">
                              ₹{itemTotal.toFixed(2)}
                            </span>

                            <button
                              type="button"
                              onClick={() => handleRemoveFromCart(itemKey)}
                              className="text-slate-400 hover:text-rose-600 p-1 transition-colors cursor-pointer"
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
                      step="any"
                      min="0"
                      max={cartNetTotal}
                      value={paidAmount}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value);
                        if (!isNaN(val) && val > cartNetTotal) {
                          setPaidAmount(String(cartNetTotal));
                        } else {
                          setPaidAmount(e.target.value);
                        }
                      }}
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

          {/* INVOICES TABLE (EXACT MATCH TO USER IMAGE 1) */}
          {invoices.length === 0 ? (
            <div className="text-center py-10 text-slate-400">
              <Receipt className="w-10 h-10 mx-auto stroke-1 mb-2 text-slate-300" />
              <p className="text-xs sm:text-sm font-medium">No counter sale bills created yet.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs min-w-[850px]">
                <thead>
                  <tr className="border-b border-slate-200/80 bg-slate-50/50 text-slate-500 font-bold uppercase tracking-wider text-[11px]">
                    <th className="py-3.5 px-4">CUSTOMER & VEHICLE</th>
                    <th className="py-3.5 px-4 text-right">PARTS TOTAL</th>
                    <th className="py-3.5 px-4 text-center">DISCOUNT</th>
                    <th className="py-3.5 px-4 text-right">NET TOTAL</th>
                    <th className="py-3.5 px-4 text-right">RECEIVED</th>
                    <th className="py-3.5 px-4 text-center">PAYMENT STATUS</th>
                    <th className="py-3.5 px-4 text-center">COMPLETED ON</th>
                    <th className="py-3.5 px-4 text-right">ACTIONS</th>
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
                      const discAmt = parseFloat(inv.discount || inv.discount_amount || 0);
                      const partsTotal = parseFloat(inv.subtotal || (netTot + discAmt));

                      return (
                        <tr key={inv.id} className="hover:bg-slate-50/80 transition-colors">
                          {/* CUSTOMER & VEHICLE & ITEMS */}
                          <td className="py-3.5 px-4">
                            <span className="font-extrabold text-slate-900 block text-sm">{inv.customer_name}</span>
                            <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                              {inv.vehicle_number ? (
                                <span className="text-[10px] bg-slate-100 text-slate-700 font-bold px-2 py-0.5 rounded-md font-mono border border-slate-200">
                                  {inv.vehicle_number}
                                </span>
                              ) : (
                                <span className="text-[10px] bg-slate-100 text-slate-400 font-bold px-2 py-0.5 rounded-md">-</span>
                              )}
                              {inv.customer_phone && (
                                <span className="text-[10px] text-slate-500 font-mono">📞 {inv.customer_phone}</span>
                              )}
                            </div>
                            {inv.items && inv.items.length > 0 && (
                              <div className="text-[10px] text-slate-500 mt-1 max-w-[220px] truncate flex items-center gap-1">
                                <Package className="w-3 h-3 text-slate-400 shrink-0" />
                                <span className="truncate">{inv.items.map(i => `${i.part_name || i.item_name} (x${i.quantity})`).join(', ')}</span>
                              </div>
                            )}
                          </td>

                          {/* PARTS TOTAL */}
                          <td className="py-3.5 px-4 text-right font-mono font-extrabold text-slate-900 text-sm whitespace-nowrap">
                            ₹{partsTotal.toFixed(2)}
                          </td>

                          {/* DISCOUNT */}
                          <td className="py-3.5 px-4 text-center whitespace-nowrap">
                            {discAmt > 0 ? (
                              <span className="px-2.5 py-1 rounded-lg bg-amber-100/90 text-amber-900 font-black font-mono text-xs border border-amber-300 shadow-2xs">
                                -₹{discAmt.toFixed(2)}
                              </span>
                            ) : (
                              <span className="text-slate-400 font-bold text-xs">-</span>
                            )}
                          </td>

                          {/* NET TOTAL */}
                          <td className="py-3.5 px-4 text-right font-mono font-black text-slate-900 text-sm whitespace-nowrap">
                            ₹{netTot.toFixed(2)}
                          </td>

                          {/* RECEIVED */}
                          <td className="py-3.5 px-4 text-right font-mono font-extrabold text-emerald-600 text-sm whitespace-nowrap">
                            ₹{paidAmt.toFixed(2)}
                          </td>

                          {/* PAYMENT STATUS */}
                          <td className="py-3.5 px-4 text-center whitespace-nowrap">
                            {isPaid ? (
                              <span className="px-3 py-1 rounded-full text-[10px] font-extrabold uppercase bg-emerald-100 text-emerald-800 border border-emerald-200">
                                PAID
                              </span>
                            ) : (
                              <span className="px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase bg-purple-100 text-purple-800 border border-purple-200 inline-block text-center">
                                PARTIAL <br /><span className="text-[9px] text-purple-700 font-mono">(₹{pendingAmt.toFixed(0)} PENDING)</span>
                              </span>
                            )}
                          </td>

                          {/* COMPLETED ON */}
                          <td className="py-3.5 px-4 text-center text-slate-600 font-medium whitespace-nowrap text-xs">
                            {formatDateDMY(inv.created_at || inv.date || Date.now())}
                          </td>

                          {/* ACTIONS */}
                          <td className="py-3.5 px-4 text-right whitespace-nowrap">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={() => handleDownloadCard(inv)}
                                className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs inline-flex items-center gap-1.5 shadow-xs transition-all active:scale-98"
                              >
                                <Download className="w-3.5 h-3.5" /> Download
                              </button>

                              <button
                                type="button"
                                onClick={() => handleShareWhatsApp(inv)}
                                className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs inline-flex items-center gap-1.5 shadow-xs transition-all active:scale-98"
                              >
                                <WhatsAppIcon className="w-3.5 h-3.5" /> WhatsApp
                              </button>

                              <button
                                type="button"
                                onClick={() => handleDeleteInvoice(inv)}
                                className="p-2 rounded-xl bg-slate-100 hover:bg-rose-100 text-slate-400 hover:text-rose-600 transition-colors"
                              >
                                <Trash2 className="w-4 h-4" />
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

      {/* TAB 3: COUNTER KHATA BOOK (EXACT MATCH TO USER IMAGE 2) */}
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

          {/* DEBTORS TABLE (EXACT MATCH TO IMAGE 2) */}
          {khataDebtors.filter(k => parseFloat(k.pending_amount || 0) > 0).length === 0 ? (
            <div className="text-center py-10 text-slate-400">
              <CheckCircle2 className="w-10 h-10 mx-auto stroke-1 mb-2 text-emerald-400" />
              <p className="text-xs sm:text-sm font-bold text-slate-700">All Clear! No Pending Spare Part Dues.</p>
              <p className="text-[11px] text-slate-400 mt-0.5">Any credit counter sales will automatically appear here.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs min-w-[900px]">
                <thead>
                  <tr className="border-b border-slate-200/80 bg-slate-50/50 text-slate-500 font-bold uppercase tracking-wider text-[11px]">
                    <th className="py-3.5 px-4">DEBTOR DETAILS</th>
                    <th className="py-3.5 px-4">VEHICLE</th>
                    <th className="py-3.5 px-4 text-right">PARTS TOTAL</th>
                    <th className="py-3.5 px-4 text-center">DISCOUNT</th>
                    <th className="py-3.5 px-4 text-right">NET TOTAL</th>
                    <th className="py-3.5 px-4 text-right">PAID</th>
                    <th className="py-3.5 px-4 text-right">PENDING DUES</th>
                    <th className="py-3.5 px-4 text-center">VISIT DATE</th>
                    <th className="py-3.5 px-4 text-right">ACTIONS</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {khataDebtors
                    .filter(k => parseFloat(k.pending_amount || 0) > 0)
                    .filter(k => {
                      const q = khataSearch.toLowerCase();
                      return !q || (k.customer_name || '').toLowerCase().includes(q) || (k.customer_phone || '').includes(q);
                    })
                    .map((debtor) => {
                      const discAmt = parseFloat(debtor.discount || debtor.discount_amount || 0);
                      const netTot = parseFloat(debtor.total_amount || 0);
                      const partsTotal = parseFloat(debtor.subtotal || (netTot + discAmt));
                      const paidAmt = parseFloat(debtor.paid_amount || 0);
                      const pendingAmt = parseFloat(debtor.pending_amount || 0);

                      return (
                        <tr key={debtor.id} className="hover:bg-slate-50/80 transition-colors">
                          {/* DEBTOR DETAILS */}
                          <td className="py-3.5 px-4">
                            <span className="font-extrabold text-slate-900 block text-sm">{debtor.customer_name}</span>
                            {debtor.customer_phone && (
                              <span className="font-mono text-slate-500 text-xs block mt-0.5">📞 {debtor.customer_phone || debtor.phone}</span>
                            )}
                            {debtor.items_summary && (
                              <div className="text-[10px] text-slate-500 mt-1 max-w-[200px] truncate flex items-center gap-1">
                                <Package className="w-3 h-3 text-slate-400 shrink-0" />
                                <span className="truncate">{debtor.items_summary}</span>
                              </div>
                            )}
                          </td>

                          {/* VEHICLE */}
                          <td className="py-3.5 px-4 whitespace-nowrap">
                            {debtor.vehicle_number ? (
                              <span className="font-extrabold text-slate-800 text-xs block font-mono">
                                {debtor.vehicle_number}
                              </span>
                            ) : (
                              <span className="text-slate-400 font-bold">-</span>
                            )}
                          </td>

                          {/* PARTS TOTAL */}
                          <td className="py-3.5 px-4 text-right font-mono font-extrabold text-slate-900 text-sm whitespace-nowrap">
                            ₹{partsTotal.toFixed(2)}
                          </td>

                          {/* DISCOUNT */}
                          <td className="py-3.5 px-4 text-center whitespace-nowrap">
                            {discAmt > 0 ? (
                              <span className="px-2.5 py-1 rounded-lg bg-amber-100/90 text-amber-900 font-black font-mono text-xs border border-amber-300 shadow-2xs">
                                -₹{discAmt.toFixed(2)}
                              </span>
                            ) : (
                              <span className="text-slate-400 font-bold text-xs">-</span>
                            )}
                          </td>

                          {/* NET TOTAL */}
                          <td className="py-3.5 px-4 text-right font-mono font-black text-slate-900 text-sm whitespace-nowrap">
                            ₹{netTot.toFixed(2)}
                          </td>

                          {/* PAID */}
                          <td className="py-3.5 px-4 text-right font-mono font-extrabold text-emerald-600 text-sm whitespace-nowrap">
                            ₹{paidAmt.toFixed(2)}
                          </td>

                          {/* PENDING DUES */}
                          <td className="py-3.5 px-4 text-right font-mono font-black text-rose-600 text-sm whitespace-nowrap">
                            ₹{pendingAmt.toFixed(2)}
                          </td>

                          {/* VISIT DATE */}
                          <td className="py-3.5 px-4 text-center text-slate-600 font-medium whitespace-nowrap text-xs">
                            📅 {formatDateDMY(debtor.created_at || debtor.date || Date.now())}
                          </td>

                          {/* ACTIONS */}
                          <td className="py-3.5 px-4 text-right whitespace-nowrap">
                            <div className="flex items-center justify-end gap-1.5">
                              {/* Download Card */}
                              <button
                                type="button"
                                onClick={() => handleDownloadKhataCard(debtor)}
                                className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs inline-flex items-center gap-1.5 shadow-xs transition-all active:scale-98"
                              >
                                <Download className="w-3.5 h-3.5" /> Download
                              </button>

                              {/* WhatsApp Reminder */}
                              <button
                                type="button"
                                onClick={() => handleShareKhataReminder(debtor)}
                                className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs inline-flex items-center gap-1.5 shadow-xs transition-all active:scale-98"
                              >
                                <WhatsAppIcon className="w-3.5 h-3.5" /> WhatsApp
                              </button>

                              {/* Record Payment */}
                              <button
                                type="button"
                                onClick={() => setPaymentModal({ isOpen: true, debtor, amount: '', paymentMode: 'CASH' })}
                                className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs inline-flex items-center gap-1 shadow-xs transition-all active:scale-98"
                              >
                                <Plus className="w-3.5 h-3.5" /> Payment
                              </button>

                              {/* Delete Button */}
                              <button
                                type="button"
                                onClick={() => handleDeleteKhataEntry(debtor)}
                                className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-500 border border-rose-200 rounded-xl transition-colors active:scale-95"
                              >
                                <Trash2 className="w-4 h-4" />
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
                <div className="flex justify-between items-center mb-1">
                  <label className="block text-[10px] sm:text-xs font-bold text-slate-700 uppercase tracking-wider">
                    PAYMENT AMOUNT (₹) *
                  </label>
                  <button
                    type="button"
                    onClick={() => setPaymentModal(prev => ({ ...prev, amount: String(parseFloat(prev.debtor?.pending_amount || 0)) }))}
                    className="text-[10px] font-bold text-emerald-600 hover:text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded cursor-pointer transition-colors"
                  >
                    Full Pay: ₹{parseFloat(paymentModal.debtor?.pending_amount || 0).toFixed(2)}
                  </button>
                </div>
                <input
                  type="number"
                  step="any"
                  min="1"
                  max={parseFloat(paymentModal.debtor?.pending_amount || 0)}
                  required
                  placeholder={`Max ₹${parseFloat(paymentModal.debtor?.pending_amount || 0).toFixed(2)}`}
                  value={paymentModal.amount}
                  onChange={(e) => {
                    const maxDue = parseFloat(paymentModal.debtor?.pending_amount || 0);
                    const val = parseFloat(e.target.value);
                    if (!isNaN(val) && val > maxDue) {
                      setPaymentModal(prev => ({ ...prev, amount: String(maxDue) }));
                    } else {
                      setPaymentModal(prev => ({ ...prev, amount: e.target.value }));
                    }
                  }}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs sm:text-sm font-mono font-bold focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>

              <div>
                <label className="block text-[10px] sm:text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  PAYMENT METHOD
                </label>
                <select
                  value={paymentModal.paymentMode}
                  onChange={(e) => setPaymentModal(prev => ({ ...prev, paymentMode: e.target.value }))}
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

      {/* MODAL 4: ADMIN SECURITY PASSWORD FOR DELETE */}
      <AdminPasswordModal
        isOpen={deleteSecurityModal.isOpen}
        onClose={() => setDeleteSecurityModal({ isOpen: false, item: null, type: null })}
        onConfirm={handleConfirmDeleteWithPassword}
        title="Admin Security Password Required"
        itemDescription={deleteSecurityModal.item ? `${deleteSecurityModal.type === 'INVOICE' ? 'Invoice of' : 'Khata Record of'} ${deleteSecurityModal.item.customer_name}` : 'this item'}
        actionLabel="Confirm & Move to Recycle Bin"
      />

    </div>
  );
}
