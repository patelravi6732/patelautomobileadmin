import html2canvas from 'html2canvas';

export const downloadElementAsPNG = async (element, filename = 'download.png') => {
  if (!element) return false;

  // Attempt 1: Standard html2canvas without taint/CORS traps
  try {
    const canvas = await html2canvas(element, {
      scale: 2,
      allowTaint: false,
      useCORS: false,
      backgroundColor: '#ffffff',
      logging: false,
      imageTimeout: 0,
      onclone: (clonedDoc) => {
        try {
          const sanitizeCss = (str) => {
            if (!str) return str;
            return str.replace(/oklch\([^)]+\)|oklab\([^)]+\)|light-dark\([^)]+\)|color\([^)]+\)/gi, '#475569');
          };

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
    
    const image = canvas.toDataURL('image/png', 1.0);
    const link = document.createElement('a');
    link.href = image;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    return true;
  } catch (err1) {
    console.warn('html2canvas attempt 1 failed:', err1);
  }

  // Attempt 2: html2canvas with scale 1
  try {
    const canvas = await html2canvas(element, {
      scale: 1,
      backgroundColor: '#ffffff',
      logging: false,
      onclone: (clonedDoc) => {
        try {
          const sanitizeCss = (str) => {
            if (!str) return str;
            return str.replace(/oklch\([^)]+\)|oklab\([^)]+\)|light-dark\([^)]+\)|color\([^)]+\)/gi, '#475569');
          };

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
    
    const image = canvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.href = image;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    return true;
  } catch (err2) {
    console.warn('html2canvas attempt 2 failed:', err2);
  }

  // Attempt 3: SVG ForeignObject Fallback
  try {
    const htmlString = element.outerHTML;
    const width = element.offsetWidth || 600;
    const height = element.offsetHeight || 800;

    const svgString = `
      <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
        <foreignObject width="100%" height="100%">
          <div xmlns="http://www.w3.org/1999/xhtml">
            ${htmlString}
          </div>
        </foreignObject>
      </svg>
    `;

    const img = new Image();
    const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);

    return new Promise((resolve) => {
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = width * 2;
        canvas.height = height * 2;
        const ctx = canvas.getContext('2d');
        ctx.scale(2, 2);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0);
        
        URL.revokeObjectURL(url);
        const pngUrl = canvas.toDataURL('image/png');
        const link = document.createElement('a');
        link.href = pngUrl;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        resolve(true);
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        resolve(false);
      };
      img.src = url;
    });
  } catch (err3) {
    console.error('All download attempts failed:', err3);
    return false;
  }
};
