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
  
  const parts = inv.service_job?.parts || inv.service_job?.parts_used || inv.parts || inv.items || [];
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
  const invDate = inv.created_at || inv.visit_date || inv.date || Date.now();
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

  // 4. Customer Details Box
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
  ctx.fillText(`📞 ${inv.customer_phone || inv.customer_mobile || inv.mobile_number || inv.phone || '8140371414'}`, pad + 20, boxY + 68);

  // Vehicle Details Right
  const col2X = pad + 380;
  ctx.fillStyle = '#b45309';
  ctx.font = 'bold 11.5px "Segoe UI", Roboto, system-ui, -apple-system, sans-serif';
  ctx.fillText('VEHICLE / SERVICE INFO', col2X, boxY + 24);

  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 17px Consolas, "Liberation Mono", monospace, sans-serif';
  ctx.fillText((inv.vehicle_number || 'COUNTER RETAIL SALE').toUpperCase(), col2X, boxY + 48);

  ctx.fillStyle = '#475569';
  ctx.font = '600 13.5px "Segoe UI", Roboto, system-ui, -apple-system, sans-serif';
  ctx.fillText((inv.bike_model || 'Spare Parts Direct Sale').toUpperCase(), col2X, boxY + 68);

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
      const uPrice = parseFloat(p.unit_price || p.selling_price || p.price || 0);
      const qty = parseInt(p.quantity || p.qty || 1, 10);
      const subTot = parseFloat(p.total || p.subtotal || (uPrice * qty) || 0);
      const rawName = p.part_name || p.item_name || p.name || 'Spare Part';
      const cleanName = rawName.split(' Genuine Part')[0].split(' - ')[0].trim();

      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 14.5px "Segoe UI", Roboto, system-ui, -apple-system, sans-serif';
      ctx.fillText(cleanName, pad + 18, currentY + 20);

      ctx.textAlign = 'center';
      ctx.font = '14.5px Consolas, "Liberation Mono", monospace, sans-serif';
      ctx.fillText(String(qty), pad + 400, currentY + 20);

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

    // Subtle Clean Border
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 1;
    ctx.strokeRect(pad, startY, qrBoxSize + 20, qrBoxSize + 48);

    if (qrImg && (qrImg.naturalWidth > 0 || qrImg.complete)) {
      ctx.drawImage(qrImg, pad + 10, startY + 10, qrBoxSize, qrBoxSize);
    } else {
      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(pad + 10, startY + 10, qrBoxSize, qrBoxSize);
      ctx.fillStyle = '#64748b';
      ctx.font = 'bold 13px "Segoe UI", Roboto, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Scan & Pay via UPI', pad + 10 + (qrBoxSize / 2), startY + 100);
      ctx.textAlign = 'left';
    }

    // QR Helper Text
    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 12.5px "Segoe UI", Roboto, system-ui, -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('📱 Scan QR to Pay via GPay / PhonePe', pad + 10 + (qrBoxSize / 2), startY + qrBoxSize + 28);
    ctx.fillStyle = '#64748b';
    ctx.font = '600 11px Consolas, monospace';
    ctx.fillText(`${garageInfo?.upi_id || 'paytmqr5hlpsp@ptys'}`, pad + 10 + (qrBoxSize / 2), startY + qrBoxSize + 42);
    ctx.textAlign = 'left';
  } else {
    // PAID IN FULL GREEN BADGE
    const paidBadgeW = 220;
    const paidBadgeH = 95;
    ctx.fillStyle = '#ecfdf5';
    drawRoundedRect(ctx, pad, startY, paidBadgeW, paidBadgeH, 16);
    ctx.fill();
    ctx.strokeStyle = '#6ee7b7';
    ctx.lineWidth = 2;
    drawRoundedRect(ctx, pad, startY, paidBadgeW, paidBadgeH, 16);
    ctx.stroke();

    ctx.fillStyle = '#065f46';
    ctx.font = 'bold 22px "Segoe UI", Roboto, system-ui, -apple-system, sans-serif';
    ctx.fillText('✓ PAID IN FULL', pad + 24, startY + 44);

    ctx.fillStyle = '#047857';
    ctx.font = '600 12.5px "Segoe UI", Roboto, system-ui, -apple-system, sans-serif';
    ctx.fillText('Thank you for prompt payment!', pad + 24, startY + 70);
  }

  // Right Side Totals Calculation
  const totX = isPendingPayment ? (pad + qrBoxSize + 40) : (pad + 245);
  const totW = width - pad - totX;
  let curTotY = startY + 10;

  // Subtotal
  const partsTot = parseFloat(inv.parts_total || (Array.isArray(parts) ? parts.reduce((acc, p) => acc + (parseFloat(p.unit_price || p.selling_price || p.price || 0) * (p.quantity || p.qty || 1)), 0) : 0));
  const subtotalVal = (partsTot + labourVal > 0) ? (partsTot + labourVal) : parseFloat(inv.subtotal || inv.grand_total || inv.net_total || inv.total_amount || 0);

  ctx.fillStyle = '#475569';
  ctx.font = '600 14px "Segoe UI", Roboto, system-ui, -apple-system, sans-serif';
  ctx.fillText('Subtotal:', totX, curTotY);
  ctx.textAlign = 'right';
  ctx.font = 'bold 15px Consolas, "Liberation Mono", monospace, sans-serif';
  ctx.fillText(`₹${subtotalVal.toFixed(2)}`, width - pad, curTotY);
  ctx.textAlign = 'left';

  // Discount (if any)
  const discountVal = parseFloat(inv.discount_amount || inv.discount || 0);
  if (discountVal > 0) {
    curTotY += 28;
    ctx.fillStyle = '#16a34a';
    ctx.font = '600 14px "Segoe UI", Roboto, system-ui, -apple-system, sans-serif';
    ctx.fillText('Special Discount:', totX, curTotY);
    ctx.textAlign = 'right';
    ctx.font = 'bold 15px Consolas, "Liberation Mono", monospace, sans-serif';
    ctx.fillText(`- ₹${discountVal.toFixed(2)}`, width - pad, curTotY);
    ctx.textAlign = 'left';
  }

  // Grand Net Total Box
  curTotY += 34;
  const netTot = parseFloat(inv.grand_total || inv.net_total || inv.total_amount || Math.max(0, subtotalVal - discountVal));
  ctx.fillStyle = '#f8fafc';
  drawRoundedRect(ctx, totX, curTotY - 18, totW, 44, 10);
  ctx.fill();
  ctx.strokeStyle = '#e2e8f0';
  ctx.lineWidth = 1;
  drawRoundedRect(ctx, totX, curTotY - 18, totW, 44, 10);
  ctx.stroke();

  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 16px "Segoe UI", Roboto, system-ui, -apple-system, sans-serif';
  ctx.fillText('Grand Net Total:', totX + 12, curTotY + 10);
  ctx.textAlign = 'right';
  ctx.font = 'bold 18px Consolas, "Liberation Mono", monospace, sans-serif';
  ctx.fillText(`₹${netTot.toFixed(2)}`, width - pad - 12, curTotY + 10);
  ctx.textAlign = 'left';

  // Paid & Pending
  curTotY += 46;
  const rawPaid = parseFloat(inv.paid_amount !== undefined && inv.paid_amount !== null ? inv.paid_amount : (isPendingPayment ? (netTot - pendingVal) : netTot));
  const paidVal = Math.min(netTot, Math.max(0, rawPaid));

  ctx.fillStyle = '#059669';
  ctx.font = '600 14px "Segoe UI", Roboto, system-ui, -apple-system, sans-serif';
  ctx.fillText('Paid Amount:', totX, curTotY);
  ctx.textAlign = 'right';
  ctx.font = 'bold 15px Consolas, "Liberation Mono", monospace, sans-serif';
  ctx.fillText(`₹${paidVal.toFixed(2)}`, width - pad, curTotY);
  ctx.textAlign = 'left';

  if (isPendingPayment) {
    curTotY += 28;
    ctx.fillStyle = '#dc2626';
    ctx.font = 'bold 15px "Segoe UI", Roboto, system-ui, -apple-system, sans-serif';
    ctx.fillText('Pending Balance Due:', totX, curTotY);
    ctx.textAlign = 'right';
    ctx.font = 'bold 17px Consolas, "Liberation Mono", monospace, sans-serif';
    ctx.fillText(`₹${pendingVal.toFixed(2)}`, width - pad, curTotY);
    ctx.textAlign = 'left';
  }

  // 8. Bottom Safety Message Footer
  const footerY = height - 52;
  ctx.fillStyle = '#f8fafc';
  drawRoundedRect(ctx, pad, footerY - 14, width - (pad * 2), 48, 14);
  ctx.fill();

  ctx.fillStyle = '#475569';
  ctx.font = '600 12.5px "Segoe UI", Roboto, system-ui, -apple-system, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(garageInfo?.safety_message || 'Thank you for choosing Patel Automobiles! Wish you a safe & smooth ride. 🛵⛑️', width / 2, footerY + 10);
  ctx.fillText(`📍 ${garageInfo?.address || 'Near Dandi Pond, Dandi, Valsad'}  |  📞 ${garageInfo?.phone || '+91 81403 71414'}`, width / 2, footerY + 26);
  ctx.textAlign = 'left';

  try {
    return canvas.toDataURL('image/png');
  } catch (e) {
    console.error('Canvas error:', e);
    return null;
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

export const generateCounterSaleCardPhotoAsync = async (saleInvoice, garageInfo) => {
  return generateBillCanvasDataUrlAsync(saleInvoice, garageInfo);
};
