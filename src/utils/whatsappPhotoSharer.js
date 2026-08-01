import html2canvas from 'html2canvas';

/**
 * Captures an HTML element as an HD PNG photo card, copies or downloads it,
 * and opens WhatsApp chat with the customer's phone number.
 */
export const sharePhotoToWhatsApp = async (element, customerPhone, customerName = 'Customer', customMessage = '') => {
  if (!element) return false;

  let phoneClean = ''.concat(customerPhone || '').replace(/\D/g, '');
  if (!phoneClean.startsWith('91') && phoneClean.length === 10) {
    phoneClean = '91' + phoneClean;
  }

  const encodedMsg = customMessage ? encodeURIComponent(customMessage) : '';
  const targetUrl = `https://wa.me/${phoneClean}${encodedMsg ? `?text=${encodedMsg}` : ''}`;

  const openWhatsApp = () => {
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
  };

  try {
    let canvas = null;

    const sanitizeCss = (str) => {
      if (!str) return str;
      return str.replace(/oklch\([^)]+\)|oklab\([^)]+\)|light-dark\([^)]+\)|color\([^)]+\)/gi, '#334155');
    };

    // Attempt 1: High definition html2canvas with oklch CSS sanitizer
    try {
      canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        logging: false,
        onclone: (clonedDoc) => {
          try {
            const styleElements = clonedDoc.querySelectorAll('style');
            styleElements.forEach((styleEl) => {
              if (styleEl.textContent && /oklch|oklab|light-dark/i.test(styleEl.textContent)) {
                styleEl.textContent = sanitizeCss(styleEl.textContent);
              }
            });

            const allElements = clonedDoc.querySelectorAll('*');
            allElements.forEach((el) => {
              const inlineStyle = el.getAttribute('style');
              if (inlineStyle && /oklch|oklab|light-dark/i.test(inlineStyle)) {
                el.setAttribute('style', sanitizeCss(inlineStyle));
              }
            });
          } catch (e) {
            console.warn('onclone color cleanup warning:', e);
          }
        }
      });
    } catch (err1) {
      console.warn('html2canvas attempt 1 failed:', err1);
    }

    // Attempt 2: Standard html2canvas fallback (scale 1)
    if (!canvas) {
      try {
        canvas = await html2canvas(element, {
          scale: 1,
          useCORS: false,
          allowTaint: true,
          backgroundColor: '#ffffff',
          logging: false,
          onclone: (clonedDoc) => {
            try {
              const styleElements = clonedDoc.querySelectorAll('style');
              styleElements.forEach((styleEl) => {
                if (styleEl.textContent) styleEl.textContent = sanitizeCss(styleEl.textContent);
              });
            } catch (e) {}
          }
        });
      } catch (err2) {
        console.warn('html2canvas attempt 2 failed:', err2);
      }
    }

    if (!canvas) {
      throw new Error('Failed to generate image canvas from element.');
    }

    // Convert canvas to Blob safely
    let blob = null;
    try {
      blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
    } catch (blobErr) {
      console.warn('canvas.toBlob failed, trying toDataURL fallback:', blobErr);
    }

    if (!blob) {
      const dataUrl = canvas.toDataURL('image/png');
      const res = await fetch(dataUrl);
      blob = await res.blob();
    }

    const fileName = `Bill_${customerName.replace(/\s+/g, '_')}_${Date.now()}.png`;

    // 1. Try Native Web Share API (Mobile / Android / iOS)
    if (isMobile && navigator.canShare) {
      const file = new File([blob], fileName, { type: 'image/png' });
      if (navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({
            title: `Patel Automobiles - ${customerName}`,
            text: customMessage || `Thank you for visiting Patel Automobiles! Ride safe & always wear a helmet! 🛵⛑️`,
            files: [file]
          });
          return true;
        } catch (shareErr) {
          console.warn('Mobile native share cancelled or unsupported:', shareErr);
        }
      }
    }

    // 2. Trigger Auto-Download of Image File
    try {
      const imgUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = imgUrl;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (dlErr) {
      console.warn('Auto download error:', dlErr);
    }

    // 3. Try Desktop Clipboard Copy
    let copiedToClipboard = false;
    if (!isMobile && navigator.clipboard && window.ClipboardItem) {
      try {
        await navigator.clipboard.write([
          new ClipboardItem({
            'image/png': blob
          })
        ]);
        copiedToClipboard = true;
      } catch (clipErr) {
        console.warn('Clipboard image write failed:', clipErr);
      }
    }

    // 4. OPEN WHATSAPP FIRST (Prevents Chrome popup blocker)
    openWhatsApp();

    // 5. Guidance notification
    setTimeout(() => {
      if (isMobile) {
        alert(`📸 Bill Photo Download Ho Gayi!\n\nWhatsApp khul gaya hai:\nWhatsApp mein 📎 (Attach Icon) -> Gallery -> Select '${fileName}' to send! 📲`);
      } else if (copiedToClipboard) {
        alert(`📸 Bill Photo Copied to Clipboard & Downloaded (${fileName})!\n\nWhatsApp Web khul gaya hai:\n1. Chat box mein Ctrl + V (Paste) dabayein!\n2. Ya 📎 (Attach Icon) -> Photos & Videos -> '${fileName}' select karein! 💻`);
      } else {
        alert(`📸 Bill Photo Download Ho Gayi (${fileName})!\n\nWhatsApp Web khul gaya hai:\nWhatsApp mein 📎 (Attach Icon) -> Photos & Videos -> '${fileName}' select karke photo bhej dein! 💻`);
      }
    }, 400);

    return true;

  } catch (err) {
    console.error('Share photo error:', err);
    alert('Opening WhatsApp chat for customer messaging...');
    openWhatsApp();
    return false;
  }
};
