import { LOGO_BASE64 } from '../assets/logoBase64';
import { formatDateDMY } from './dateFormatter';

const imageCache = new Map();

const loadSingleImage = (src) => {
  if (!src) return Promise.resolve(null);
  if (imageCache.has(src)) return Promise.resolve(imageCache.get(src));

  return new Promise((resolve) => {
    let done = false;
    const finish = (result) => {
      if (done) return;
      done = true;
      if (result) imageCache.set(src, result);
      resolve(result);
    };

    const timer = setTimeout(() => {
      if (src !== '/upi_qr.jpg') {
        const fallback = new Image();
        fallback.crossOrigin = 'Anonymous';
        fallback.onload = () => finish(fallback);
        fallback.onerror = () => finish(null);
        fallback.src = '/upi_qr.jpg';
      } else {
        finish(null);
      }
    }, 2500);

    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.onload = () => {
      clearTimeout(timer);
      finish(img);
    };
    img.onerror = () => {
      clearTimeout(timer);
      if (src !== '/upi_qr.jpg' && src !== LOGO_BASE64) {
        const fallback = new Image();
        fallback.crossOrigin = 'Anonymous';
        fallback.onload = () => finish(fallback);
        fallback.onerror = () => finish(null);
        fallback.src = '/upi_qr.jpg';
      } else {
        finish(null);
      }
    };
    img.src = src;
  });
};

const drawRoundedRect = (ctx, x, y, w, h, r = 12) => {
  if (w < 2 * r) r = w / 2;
  if (h < 2 * r) r = h / 2;
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
};

const renderCanvasInternal = (invoice, garageInfo, logoImg, qrImg) => {
  const inv = invoice || {};
  // Ultra HD 4K Quality: Scale = 4, width = 800 => 3200px resolution
  const scale = 4;
  const width = 800;
  
  const parts = inv.service_job?.parts || inv.service_job?.parts_used || inv.parts || [];
  const hasLabour = parseFloat(inv.service_job?.labour_charge || inv.labour_charge || 0) > 0;
  const itemCount = Array.isArray(parts) ? parts.length + (hasLabour ? 1 : 0) : 1;
  const rowHeight = 44;
  const baseHeight = 780;
  const height = Math.max(940, baseHeight + (itemCount * rowHeight));

  const canvas = document.createElement('canvas');
  canvas.width = width * scale;
  canvas.height = height * scale;

  const ctx = canvas.getContext('2d');
  ctx.scale(scale, scale);

  // High quality crisp image rendering
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  // 1. Pure White Clean Background
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);

  const pad = 34;
  let currentY = pad;

  // 2. Real Garage Logo Draw
  const logoSize = 68;

  if (logoImg && (logoImg.naturalWidth > 0 || logoImg.complete)) {
    ctx.save();
    drawRoundedRect(ctx, pad, currentY, logoSize, logoSize, 14);
    ctx.clip();
    ctx.drawImage(logoImg, pad, currentY, logoSize, logoSize);
    ctx.restore();

    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 2;
    drawRoundedRect(ctx, pad, currentY, logoSize, logoSize, 14);
    ctx.stroke();
  } else {
    // Fallback Gold Badge
    ctx.fillStyle = '#f59e0b';
    drawRoundedRect(ctx, pad, currentY, logoSize, logoSize, 14);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 26px "Segoe UI", Roboto, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('PA', pad + (logoSize / 2), currentY + 44);
    ctx.textAlign = 'left';
  }

  // Garage Title & Info
  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 26px "Segoe UI", Roboto, system-ui, -apple-system, sans-serif';
  ctx.fillText(garageInfo?.garage_name || 'Patel Automobiles', pad + 86, currentY + 26);

  ctx.fillStyle = '#475569';
  ctx.font = '600 13.5px "Segoe UI", Roboto, system-ui, -apple-system, sans-serif';
  ctx.fillText(garageInfo?.address || 'Near Dandi Pond, Dandi, Valsad, Gujarat - 396385', pad + 86, currentY + 48);

  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 13.5px Consolas, "Liberation Mono", monospace, sans-serif';
  ctx.fillText(`📞 ${garageInfo?.phone || '+91 81403 71414'}`, pad + 86, currentY + 68);

  // Date Top Right
  const invDate = inv.created_at || inv.visit_date || Date.now();
  const dateStr = formatDateDMY(invDate);

  ctx.fillStyle = '#64748b';
  ctx.font = 'bold 13.5px Consolas, "Liberation Mono", monospace, sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText(`Date: ${dateStr}`, width - pad, currentY + 26);
  ctx.textAlign = 'left';

  currentY += 88;

  // 3. Amber Divider Line
  ctx.strokeStyle = '#f59e0b';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(pad, currentY);
  ctx.lineTo(width - pad, currentY);
  ctx.stroke();

  currentY += 22;

  // 4. Yellowish Customer & Vehicle Details Box
  const boxHeight = 82;
  const boxY = currentY;

  ctx.fillStyle = '#fffbe5';
  drawRoundedRect(ctx, pad, boxY, width - (pad * 2), boxHeight, 16);
  ctx.fill();
  ctx.strokeStyle = '#fde68a';
  ctx.lineWidth = 1.5;
  drawRoundedRect(ctx, pad, boxY, width - (pad * 2), boxHeight, 16);
  ctx.stroke();

  // Customer Details Left
  ctx.fillStyle = '#b45309';
  ctx.font = 'bold 11.5px "Segoe UI", Roboto, system-ui, -apple-system, sans-serif';
  ctx.fillText('CUSTOMER DETAILS', pad + 20, boxY + 24);

  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 17px "Segoe UI", Roboto, system-ui, -apple-system, sans-serif';
  ctx.fillText(inv.customer_name || 'Valued Customer', pad + 20, boxY + 48);

  ctx.fillStyle = '#334155';
  ctx.font = 'bold 13.5px Consolas, "Liberation Mono", monospace, sans-serif';
  ctx.fillText(`📞 ${inv.customer_mobile || inv.mobile_number || inv.phone || '8140371414'}`, pad + 20, boxY + 68);

  // Vehicle Details Right
  const col2X = pad + 380;
  ctx.fillStyle = '#b45309';
  ctx.font = 'bold 11.5px "Segoe UI", Roboto, system-ui, -apple-system, sans-serif';
  ctx.fillText('VEHICLE REGISTRATION', col2X, boxY + 24);

  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 17px Consolas, "Liberation Mono", monospace, sans-serif';
  ctx.fillText((inv.vehicle_number || '').toUpperCase(), col2X, boxY + 48);

  ctx.fillStyle = '#475569';
  ctx.font = '600 13.5px "Segoe UI", Roboto, system-ui, -apple-system, sans-serif';
  ctx.fillText((inv.bike_model || '').toUpperCase(), col2X, boxY + 68);

  currentY += boxHeight + 22;

  // 5. Dark Navy Table Header
  const tblHeaderY = currentY;
  const tblHeaderH = 40;

  ctx.fillStyle = '#0b132b';
  drawRoundedRect(ctx, pad, tblHeaderY, width - (pad * 2), tblHeaderH, 12);
  ctx.fill();

  ctx.fillStyle = '#fcd34d';
  ctx.font = 'bold 12.5px "Segoe UI", Roboto, system-ui, -apple-system, sans-serif';
  ctx.fillText('DESCRIPTION', pad + 18, tblHeaderY + 25);

  ctx.textAlign = 'center';
  ctx.fillText('QTY', pad + 400, tblHeaderY + 25);

  ctx.textAlign = 'right';
  ctx.fillText('PRICE', pad + 570, tblHeaderY + 25);
  ctx.fillText('TOTAL', width - pad - 18, tblHeaderY + 25);
  ctx.textAlign = 'left';

  currentY += tblHeaderH + 18;

  // 6. Table Rows
  if (Array.isArray(parts) && parts.length > 0) {
    parts.forEach((p) => {
      const uPrice = parseFloat(p.unit_price || p.price || 0);
      const subTot = parseFloat(p.subtotal || (uPrice * p.quantity) || 0);
      const cleanName = (p.part_name || '').split(' Genuine Part')[0].split(' - ')[0].trim();

      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 14.5px "Segoe UI", Roboto, system-ui, -apple-system, sans-serif';
      ctx.fillText(cleanName, pad + 18, currentY + 20);

      ctx.textAlign = 'center';
      ctx.font = '14.5px Consolas, "Liberation Mono", monospace, sans-serif';
      ctx.fillText(String(p.quantity || 1), pad + 400, currentY + 20);

      ctx.textAlign = 'right';
      ctx.fillText(`₹${uPrice.toFixed(2)}`, pad + 570, currentY + 20);

      ctx.font = 'bold 14.5px Consolas, "Liberation Mono", monospace, sans-serif';
      ctx.fillText(`₹${subTot.toFixed(2)}`, width - pad - 18, currentY + 20);
      ctx.textAlign = 'left';

      currentY += 36;
    });
  }

  // Labour Row
  const labourVal = parseFloat(inv.labour_charge || inv.service_job?.labour_charge || 0);
  if (labourVal > 0) {
    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 14.5px "Segoe UI", Roboto, system-ui, -apple-system, sans-serif';
    ctx.fillText('Labour Service Charge', pad + 18, currentY + 20);

    ctx.textAlign = 'center';
    ctx.font = '14.5px Consolas, "Liberation Mono", monospace, sans-serif';
    ctx.fillText('1', pad + 400, currentY + 20);

    ctx.textAlign = 'right';
    ctx.fillText(`₹${labourVal.toFixed(2)}`, pad + 570, currentY + 20);

    ctx.font = 'bold 14.5px Consolas, "Liberation Mono", monospace, sans-serif';
    ctx.fillText(`₹${labourVal.toFixed(2)}`, width - pad - 18, currentY + 20);
    ctx.textAlign = 'left';

    currentY += 36;
  }

  currentY += 12;

  // Bottom Divider
  ctx.strokeStyle = '#0f172a';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(pad, currentY);
  ctx.lineTo(width - pad, currentY);
  ctx.stroke();

  currentY += 24;

  // 7. Totals Section with Pure, Clean UPI QR Scanner Image (For Pending Bills)
  const pendingVal = parseFloat(inv.pending_amount !== undefined ? inv.pending_amount : (inv.balance || 0));
  const isPendingPayment = pendingVal > 0;
  const qrBoxSize = 185;
  const startY = currentY;

  if (isPendingPayment) {
    // Pure White Background for 100% Scanner Reliability
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.rect(pad, startY, qrBoxSize + 20, qrBoxSize + 48);
    ctx.fill();

    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 1;
    ctx.strokeRect(pad, startY, qrBoxSize + 20, qrBoxSize + 48);

    if (qrImg && (qrImg.naturalWidth > 0 || qrImg.complete)) {
      try {
        ctx.drawImage(qrImg, pad + 10, startY + 10, qrBoxSize, qrBoxSize);
      } catch (e) {}
    } else {
      // Fallback Visual Scanner Box
      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(pad + 10, startY + 10, qrBoxSize, qrBoxSize);
      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 12px "Segoe UI", Roboto, system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('⚡ UPI QR SCANNER', pad + (qrBoxSize / 2) + 10, startY + 80);
      ctx.fillText(`Pay ₹${pendingVal.toFixed(2)}`, pad + (qrBoxSize / 2) + 10, startY + 105);
      ctx.textAlign = 'left';
    }

    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 12px "Segoe UI", Roboto, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Scan & Pay via GPay / UPI', pad + (qrBoxSize / 2) + 10, startY + qrBoxSize + 28);
    ctx.fillStyle = '#059669';
    ctx.font = 'bold 11px Consolas, monospace, sans-serif';
    ctx.fillText(garageInfo?.upi_id || '', pad + (qrBoxSize / 2) + 10, startY + qrBoxSize + 42);
    ctx.textAlign = 'left';
    
    currentY = Math.max(currentY, startY + qrBoxSize + 60);
  }

  const totPartsVal = parseFloat(inv.parts_total || inv.service_job?.parts_total || 0);
  const totLabourVal = parseFloat(inv.labour_charge || inv.service_job?.labour_charge || 0);
  const discountVal = parseFloat(inv.discount_amount || inv.discount || inv.service_job?.discount_amount || 0);
  const subtotalVal = (totPartsVal > 0 || totLabourVal > 0) ? (totPartsVal + totLabourVal) : 0;

  const grandTotal = parseFloat(inv.grand_total || inv.total_amount || inv.total_billed || 0).toFixed(2);
  const paidAmount = parseFloat(inv.paid_amount || inv.total_paid || 0).toFixed(2);
  const pendingAmount = parseFloat(inv.pending_amount || 0).toFixed(2);

  ctx.textAlign = 'right';

  // Subtotal row if discount was applied
  if (discountVal > 0 && subtotalVal > 0) {
    ctx.fillStyle = '#64748b';
    ctx.font = 'bold 14px "Segoe UI", Roboto, system-ui, -apple-system, sans-serif';
    ctx.fillText('Subtotal (Parts + Labour):', width - pad - 150, currentY + 20);
    ctx.fillStyle = '#334155';
    ctx.font = 'bold 16px Consolas, "Liberation Mono", monospace, sans-serif';
    ctx.fillText(`₹${subtotalVal.toFixed(2)}`, width - pad - 18, currentY + 20);
    currentY += 28;

    ctx.fillStyle = '#dc2626';
    ctx.font = 'bold 14px "Segoe UI", Roboto, system-ui, -apple-system, sans-serif';
    ctx.fillText('Discount Given (-):', width - pad - 150, currentY + 20);
    ctx.fillStyle = '#dc2626';
    ctx.font = 'bold 17px Consolas, "Liberation Mono", monospace, sans-serif';
    ctx.fillText(`- ₹${discountVal.toFixed(2)}`, width - pad - 18, currentY + 20);
    currentY += 28;
  }

  ctx.fillStyle = '#475569';
  ctx.font = 'bold 15px "Segoe UI", Roboto, system-ui, -apple-system, sans-serif';
  ctx.fillText('Grand Total:', width - pad - 150, currentY + 22);
  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 20px Consolas, "Liberation Mono", monospace, sans-serif';
  ctx.fillText(`₹${grandTotal}`, width - pad - 18, currentY + 22);
  currentY += 32;

  ctx.fillStyle = '#059669';
  ctx.font = 'bold 15px "Segoe UI", Roboto, system-ui, -apple-system, sans-serif';
  ctx.fillText('Amount Paid:', width - pad - 150, currentY + 22);
  ctx.font = 'bold 20px Consolas, "Liberation Mono", monospace, sans-serif';
  ctx.fillText(`₹${paidAmount}`, width - pad - 18, currentY + 22);
  currentY += 32;

  if (parseFloat(pendingAmount) > 0) {
    ctx.fillStyle = '#d97706';
    ctx.font = 'bold 15px "Segoe UI", Roboto, system-ui, -apple-system, sans-serif';
    ctx.fillText('Balance Due:', width - pad - 150, currentY + 22);
    ctx.font = 'bold 20px Consolas, "Liberation Mono", monospace, sans-serif';
    ctx.fillText(`₹${pendingAmount}`, width - pad - 18, currentY + 22);
    currentY += 32;
  }

  currentY = Math.max(currentY, startY + qrBoxSize + 60);
  ctx.textAlign = 'left';
  currentY += 20;

  // 8. Bottom Safety Banner Box
  const bannerH = 92;
  ctx.fillStyle = '#fffbe5';
  drawRoundedRect(ctx, pad, currentY, width - (pad * 2), bannerH, 16);
  ctx.fill();
  ctx.strokeStyle = '#fde68a';
  ctx.lineWidth = 1.5;
  drawRoundedRect(ctx, pad, currentY, width - (pad * 2), bannerH, 16);
  ctx.stroke();

  ctx.textAlign = 'center';
  const centerX = width / 2;

  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 14.5px "Segoe UI", Roboto, system-ui, -apple-system, sans-serif';
  ctx.fillText(garageInfo?.safety_message || 'Thank you for choosing us! Wish you a safe & smooth ride. 🛵⛑️', centerX, currentY + 30);

  ctx.fillStyle = '#334155';
  ctx.font = 'bold 13.5px Consolas, "Liberation Mono", monospace, sans-serif';
  ctx.fillText(`📞 Contact: ${garageInfo?.phone || '+91 81403 71414'}`, centerX, currentY + 54);

  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 14.5px "Segoe UI", Roboto, system-ui, -apple-system, sans-serif';
  ctx.fillText(`— ${garageInfo?.garage_name || 'Patel Automobiles'}`, centerX, currentY + 76);

  ctx.textAlign = 'left';

  try {
    return canvas.toDataURL('image/png');
  } catch (err) {
    console.warn('Canvas toDataURL notice, returning fallback rendering:', err);
    return renderCanvasInternal(invoice, garageInfo, null, null);
  }
};

export const getDynamicUpiQrUrl = (invoice, garageInfo) => {
  const upiId = garageInfo?.upi_id || '';
  const payeeName = garageInfo?.upi_payee_name || garageInfo?.garage_name || 'Patel Automobiles';
  const pendingAmt = parseFloat(invoice?.pending_amount || 0);

  if (upiId && pendingAmt > 0) {
    const upiUri = `upi://pay?pa=${upiId}&pn=${encodeURIComponent(payeeName)}&am=${pendingAmt.toFixed(2)}&cu=INR&tn=${encodeURIComponent(`Invoice Payment #${invoice?.id || ''}`)}`;
    return `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(upiUri)}`;
  }

  return (garageInfo?.upi_qr_code && garageInfo.upi_qr_code.trim() !== '' && !garageInfo.upi_qr_code.includes('undefined'))
    ? garageInfo.upi_qr_code
    : '/upi_qr.jpg';
};

export const generateBillCanvasDataUrlAsync = async (invoice, garageInfo) => {
  const customLogoSrc = garageInfo?.logo && garageInfo.logo !== '/logo.png' && !garageInfo.logo.includes('undefined')
    ? garageInfo.logo
    : LOGO_BASE64;

  const customQrSrc = getDynamicUpiQrUrl(invoice, garageInfo);

  const [logoImg, qrImg] = await Promise.all([
    loadSingleImage(customLogoSrc),
    loadSingleImage(customQrSrc)
  ]);

  return renderCanvasInternal(invoice, garageInfo, logoImg, qrImg);
};

export const generateBillCanvasDataUrl = (invoice, garageInfo) => {
  const customLogoSrc = garageInfo?.logo && garageInfo.logo !== '/logo.png' && !garageInfo.logo.includes('undefined')
    ? garageInfo.logo
    : LOGO_BASE64;

  const customQrSrc = getDynamicUpiQrUrl(invoice, garageInfo);

  const logoImg = imageCache.get(customLogoSrc);
  const qrImg = imageCache.get(customQrSrc);

  // If not cached yet, load in background
  if (!logoImg || !qrImg) {
    loadSingleImage(customLogoSrc);
    loadSingleImage(customQrSrc);
  }

  return renderCanvasInternal(invoice, garageInfo, logoImg, qrImg);
};

export const generateBillCanvasBlob = async (invoice, garageInfo) => {
  const dataUrl = await generateBillCanvasDataUrlAsync(invoice, garageInfo);
  if (!dataUrl) throw new Error('Failed to generate canvas image');
  const res = await fetch(dataUrl);
  return await res.blob();
};

// ---------------- COUNTER SALE BILL PHOTO CARD ----------------
export const generateCounterSaleCardPhotoAsync = async (saleInvoice, garageInfo) => {
  if (!saleInvoice) return null;
  const canvas = document.createElement('canvas');
  const width = 760;
  const items = Array.isArray(saleInvoice.items) ? saleInvoice.items : [];
  
  // Calculate dynamic height
  const baseHeight = 560;
  const itemRowHeight = 36;
  const totalItemsHeight = items.length * itemRowHeight;
  const height = baseHeight + totalItemsHeight;

  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  // Background
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);

  // Outer border with accent
  ctx.strokeStyle = '#2563eb';
  ctx.lineWidth = 4;
  ctx.strokeRect(4, 4, width - 8, height - 8);

  const pad = 36;
  let currentY = 36;

  // Header Banner
  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 24px "Segoe UI", Roboto, sans-serif';
  ctx.fillText(garageInfo?.garage_name || 'Patel Automobiles', pad, currentY + 24);

  ctx.fillStyle = '#64748b';
  ctx.font = '500 13px "Segoe UI", Roboto, sans-serif';
  ctx.fillText(garageInfo?.address || 'Near Dandi Pond, Dandi, Valsad, Gujarat - 396385', pad, currentY + 46);

  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 13px Consolas, monospace';
  ctx.fillText(`📞 Contact: ${garageInfo?.phone || '+91 81403 71414'}`, pad, currentY + 66);

  // Bill Badge (Top Right)
  ctx.fillStyle = '#2563eb';
  ctx.fillRect(width - pad - 190, currentY, 190, 32);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 12px "Segoe UI", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('SPARE PARTS CASH MEMO', width - pad - 95, currentY + 21);

  // Invoice & Date
  ctx.fillStyle = '#475569';
  ctx.font = 'bold 12px Consolas, monospace';
  ctx.textAlign = 'right';
  ctx.fillText(`Bill No: ${saleInvoice.invoice_number || saleInvoice.id || 'CS-1001'}`, width - pad, currentY + 52);
  ctx.fillText(`Date: ${formatDateDMY(saleInvoice.created_at || saleInvoice.date || Date.now())}`, width - pad, currentY + 70);
  ctx.textAlign = 'left';

  currentY += 88;

  // Divider
  ctx.strokeStyle = '#2563eb';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(pad, currentY);
  ctx.lineTo(width - pad, currentY);
  ctx.stroke();

  currentY += 16;

  // Customer Box
  ctx.fillStyle = '#f8fafc';
  ctx.strokeStyle = '#e2e8f0';
  ctx.lineWidth = 1;
  ctx.fillRect(pad, currentY, width - (pad * 2), 52);
  ctx.strokeRect(pad, currentY, width - (pad * 2), 52);

  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 14px "Segoe UI", sans-serif';
  ctx.fillText(`Customer: ${saleInvoice.customer_name || 'Counter Customer'}`, pad + 16, currentY + 24);

  ctx.fillStyle = '#475569';
  ctx.font = 'bold 13px Consolas, monospace';
  ctx.fillText(`📞 Mobile: ${saleInvoice.customer_phone || 'N/A'}`, pad + 16, currentY + 42);

  if (saleInvoice.vehicle_number) {
    ctx.textAlign = 'right';
    ctx.fillStyle = '#0f172a';
    ctx.fillText(`🛵 Vehicle: ${saleInvoice.vehicle_number.toUpperCase()}`, width - pad - 16, currentY + 33);
    ctx.textAlign = 'left';
  }

  currentY += 68;

  // Items Table Header
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(pad, currentY, width - (pad * 2), 32);

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 12px "Segoe UI", sans-serif';
  ctx.fillText('SR', pad + 12, currentY + 21);
  ctx.fillText('SPARE PART DESCRIPTION', pad + 50, currentY + 21);
  ctx.textAlign = 'center';
  ctx.fillText('QTY', width - pad - 210, currentY + 21);
  ctx.textAlign = 'right';
  ctx.fillText('RATE (₹)', width - pad - 110, currentY + 21);
  ctx.fillText('AMOUNT (₹)', width - pad - 16, currentY + 21);
  ctx.textAlign = 'left';

  currentY += 32;

  // Items Rows
  items.forEach((it, idx) => {
    ctx.fillStyle = idx % 2 === 0 ? '#ffffff' : '#f8fafc';
    ctx.fillRect(pad, currentY, width - (pad * 2), itemRowHeight);

    ctx.strokeStyle = '#f1f5f9';
    ctx.strokeRect(pad, currentY, width - (pad * 2), itemRowHeight);

    ctx.fillStyle = '#334155';
    ctx.font = 'bold 12px Consolas, monospace';
    ctx.fillText(String(idx + 1).padStart(2, '0'), pad + 12, currentY + 23);

    ctx.fillStyle = '#0f172a';
    ctx.font = '600 13px "Segoe UI", sans-serif';
    const itemName = it.item_name || it.name || it.part_name || 'Spare Part';
    ctx.fillText(itemName.length > 34 ? itemName.substring(0, 32) + '...' : itemName, pad + 50, currentY + 23);

    ctx.textAlign = 'center';
    ctx.font = 'bold 13px Consolas, monospace';
    ctx.fillText(String(it.quantity || it.qty || 1), width - pad - 210, currentY + 23);

    ctx.textAlign = 'right';
    const unitPrice = parseFloat(it.unit_price || it.selling_price || it.price || 0);
    const totalAmt = parseFloat(it.total || (unitPrice * (it.quantity || 1)));
    ctx.fillText(unitPrice.toFixed(2), width - pad - 110, currentY + 23);
    ctx.font = 'bold 13.5px Consolas, monospace';
    ctx.fillText(totalAmt.toFixed(2), width - pad - 16, currentY + 23);
    ctx.textAlign = 'left';

    currentY += itemRowHeight;
  });

  currentY += 16;

  // Totals Breakdown Box
  const subtotal = parseFloat(saleInvoice.subtotal || saleInvoice.total_amount || 0);
  const discount = parseFloat(saleInvoice.discount || 0);
  const netTotal = parseFloat(saleInvoice.net_total || (subtotal - discount));
  const paid = parseFloat(saleInvoice.paid_amount || 0);
  const pending = Math.max(0, netTotal - paid);

  const totalsBoxWidth = 320;
  const totalsBoxX = width - pad - totalsBoxWidth;

  ctx.fillStyle = '#f8fafc';
  ctx.strokeStyle = '#cbd5e1';
  ctx.fillRect(totalsBoxX, currentY, totalsBoxWidth, 128);
  ctx.strokeRect(totalsBoxX, currentY, totalsBoxWidth, 128);

  let totY = currentY + 24;
  ctx.font = '600 13px "Segoe UI", sans-serif';
  ctx.fillStyle = '#475569';
  ctx.fillText('Subtotal:', totalsBoxX + 16, totY);
  ctx.textAlign = 'right';
  ctx.font = 'bold 13px Consolas, monospace';
  ctx.fillText(`₹${subtotal.toFixed(2)}`, totalsBoxX + totalsBoxWidth - 16, totY);
  ctx.textAlign = 'left';

  if (discount > 0) {
    totY += 22;
    ctx.font = '600 13px "Segoe UI", sans-serif';
    ctx.fillStyle = '#16a34a';
    ctx.fillText('Discount:', totalsBoxX + 16, totY);
    ctx.textAlign = 'right';
    ctx.font = 'bold 13px Consolas, monospace';
    ctx.fillText(`- ₹${discount.toFixed(2)}`, totalsBoxX + totalsBoxWidth - 16, totY);
    ctx.textAlign = 'left';
  }

  totY += 24;
  ctx.font = 'bold 14px "Segoe UI", sans-serif';
  ctx.fillStyle = '#0f172a';
  ctx.fillText('Grand Net Total:', totalsBoxX + 16, totY);
  ctx.textAlign = 'right';
  ctx.font = 'bold 16px Consolas, monospace';
  ctx.fillText(`₹${netTotal.toFixed(2)}`, totalsBoxX + totalsBoxWidth - 16, totY);
  ctx.textAlign = 'left';

  totY += 24;
  ctx.font = '600 13px "Segoe UI", sans-serif';
  ctx.fillStyle = pending > 0 ? '#dc2626' : '#16a34a';
  ctx.fillText(pending > 0 ? 'Pending Balance Due:' : 'Paid in Full:', totalsBoxX + 16, totY);
  ctx.textAlign = 'right';
  ctx.font = 'bold 14px Consolas, monospace';
  ctx.fillText(pending > 0 ? `₹${pending.toFixed(2)}` : `₹${paid.toFixed(2)}`, totalsBoxX + totalsBoxWidth - 16, totY);
  ctx.textAlign = 'left';

  // Left Note: Payment QR and Status
  const paymentMode = saleInvoice.payment_mode || 'CASH';
  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 12px "Segoe UI", sans-serif';
  ctx.fillText(`Payment Mode: ${paymentMode.toUpperCase()}`, pad, currentY + 24);

  const statusText = pending === 0 ? 'STATUS: PAID IN FULL ✅' : `STATUS: PARTIAL / CREDIT (₹${pending.toFixed(2)} DUES) ⚠️`;
  ctx.fillStyle = pending === 0 ? '#16a34a' : '#dc2626';
  ctx.font = 'bold 12.5px Consolas, monospace';
  ctx.fillText(statusText, pad, currentY + 48);

  ctx.fillStyle = '#64748b';
  ctx.font = '500 12px "Segoe UI", sans-serif';
  ctx.fillText(garageInfo?.safety_message || 'Thank you for choosing us! Wish you a safe & smooth ride. 🛵⛑️', pad, currentY + 84);
  ctx.fillText(`— ${garageInfo?.garage_name || 'Patel Automobiles'}`, pad, currentY + 104);

  try {
    return canvas.toDataURL('image/png');
  } catch (e) {
    console.error('Canvas error:', e);
    return null;
  }
};
