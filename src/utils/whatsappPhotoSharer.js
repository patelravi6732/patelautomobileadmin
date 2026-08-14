import { generateBillCanvasBlob } from './billCardGenerator';
import { formatDateDMY } from './dateFormatter';

/**
 * Bulletproof Phone Sanitizer for WhatsApp (India + International)
 * Strips non-digits, leading zeros, and ensures 91 country code for 10-digit numbers.
 */
export const sanitizeWhatsAppPhone = (phone) => {
  if (!phone) return '';
  let digits = String(phone).replace(/\D/g, '');
  while (digits.startsWith('0')) {
    digits = digits.substring(1);
  }
  if (digits.length === 10) {
    return '91' + digits;
  }
  if (digits.length === 12 && digits.startsWith('91')) {
    return digits;
  }
  if (digits.length === 13 && digits.startsWith('910')) {
    return '91' + digits.substring(3);
  }
  if (digits.length >= 10) {
    return digits.startsWith('91') ? digits : '91' + digits.slice(-10);
  }
  return digits;
};

/**
 * Opens WhatsApp Chat with fallback to anchor click if popup is blocked.
 */
export const openWhatsAppChat = (phone, message = '') => {
  const cleanPhone = sanitizeWhatsAppPhone(phone);
  if (!cleanPhone || cleanPhone.length < 10) {
    alert('⚠️ Invalid or missing mobile number for WhatsApp share!');
    return false;
  }

  const encodedMsg = message ? encodeURIComponent(message) : '';
  const targetUrl = `https://api.whatsapp.com/send/?phone=${cleanPhone}&text=${encodedMsg}`;

  try {
    const win = window.open(targetUrl, '_blank');
    if (!win || win.closed || typeof win.closed === 'undefined') {
      const a = document.createElement('a');
      a.href = targetUrl;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  } catch (e) {
    window.location.href = targetUrl;
  }
  return true;
};

/**
 * Shares Workshop Billing Invoice to WhatsApp:
 * 1. Generates HD Bill Photo Card & triggers download with unique timestamp
 * 2. Copies photo to clipboard on desktop
 * 3. Opens WhatsApp with formatted invoice details & UPI payment link
 */
export const shareInvoiceToWhatsApp = async (invoice, garageInfo) => {
  if (!invoice) return false;

  const custName = invoice.customer_name || 'Customer';
  const custPhone = invoice.mobile_number || invoice.customer_mobile || invoice.service_job?.mobile_number || invoice.phone || '';
  const vehNum = String(invoice.vehicle_number || invoice.service_job?.vehicle_number || '').toUpperCase();
  const bikeModel = invoice.bike_model || invoice.service_job?.bike_model || '';
  const invNumber = invoice.invoice_number || `INV-${String(invoice.id || '').slice(-4)}`;
  const dateStr = formatDateDMY(invoice.created_at || invoice.visit_date || invoice.date || Date.now());

  const parts = invoice.service_job?.parts || invoice.service_job?.parts_used || invoice.parts || invoice.items || [];
  const labourCharge = parseFloat(invoice.service_job?.labour_charge || invoice.labour_charge || 0);
  const discountAmount = parseFloat(invoice.discount_amount || 0);
  const grandTotal = parseFloat(invoice.grand_total || invoice.total_amount || invoice.net_total || 0);
  const rawPaid = parseFloat(invoice.paid_amount !== undefined ? invoice.paid_amount : (invoice.received_amount || (invoice.payment_status === 'PAID' ? grandTotal : 0)));
  const paidAmount = Math.min(grandTotal, Math.max(0, rawPaid));
  const pendingAmount = Math.max(0, grandTotal - paidAmount);
  const isPaid = pendingAmount <= 0;

  // 1. Generate & Download HD Photo Card
  const timeCode = Date.now().toString().slice(-4);
  const fileName = `Bill_${custName.replace(/\s+/g, '_')}_${vehNum || 'Card'}_${timeCode}.png`;

  try {
    const blob = await generateBillCanvasBlob(invoice, garageInfo);
    if (blob) {
      // Auto Download
      const imgUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = imgUrl;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      // Desktop Clipboard Copy
      if (navigator.clipboard && window.ClipboardItem) {
        try {
          await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
        } catch (e) {}
      }
    }
  } catch (canvasErr) {
    console.warn('Bill photo card generation warning:', canvasErr);
  }

  // 2. Format Items Breakdown
  let itemsList = '';
  if (Array.isArray(parts) && parts.length > 0) {
    itemsList = parts.map((p, i) => {
      const pName = p.part_name || p.item_name || p.name || 'Spare Part';
      const qty = p.quantity || 1;
      const price = parseFloat(p.selling_price || p.unit_price || p.price || 0) * qty;
      return `${i + 1}. ${pName} (x${qty}) - ₹${price.toFixed(2)}`;
    }).join('\n');
  }
  if (labourCharge > 0) {
    itemsList += `${itemsList ? '\n' : ''}• Labour / Service Charges - ₹${labourCharge.toFixed(2)}`;
  }
  if (!itemsList) {
    itemsList = `• Two Wheeler Periodic Service & Inspection - ₹${grandTotal.toFixed(2)}`;
  }

  // 3. Compose WhatsApp Message
  const garageName = garageInfo?.garage_name || 'Patel Automobiles';
  const garagePhone = garageInfo?.phone || '+91 81403 71414';

  const msg = `Thank you for choosing ${garageName}! Wish you a safe & smooth ride. 🛵⛑️\n\n📞 Contact: ${garagePhone}\n— ${garageName}`;

  return openWhatsAppChat(custPhone, msg);
};

/**
 * Shares Khata Book Statement to WhatsApp:
 */
export const shareKhataStatementToWhatsApp = async (customer, garageInfo) => {
  if (!customer) return false;

  const custName = customer.customer_name || 'Customer';
  const custPhone = customer.phone || customer.mobile_number || '';
  const vehNum = String(customer.vehicle_number || '').toUpperCase();
  const timeCode = Date.now().toString().slice(-4);
  const fileName = `Statement_${custName.replace(/\s+/g, '_')}_${vehNum || 'Khata'}_${timeCode}.png`;

  try {
    const blob = await generateBillCanvasBlob(customer, garageInfo);
    if (blob) {
      const imgUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = imgUrl;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      if (navigator.clipboard && window.ClipboardItem) {
        try {
          await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
        } catch (e) {}
      }
    }
  } catch (canvasErr) {
    console.warn('Khata statement photo card generation warning:', canvasErr);
  }

  const garageName = garageInfo?.garage_name || 'Patel Automobiles';
  const garagePhone = garageInfo?.phone || '+91 81403 71414';

  const msg = `Thank you for choosing ${garageName}! Wish you a safe & smooth ride. 🛵⛑️\n\n📞 Contact: ${garagePhone}\n— ${garageName}`;

  return openWhatsAppChat(custPhone, msg);
};
