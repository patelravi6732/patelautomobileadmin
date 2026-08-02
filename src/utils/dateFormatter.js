export function formatDateDMY(dateInput) {
  if (!dateInput || dateInput === 'N/A') return 'N/A';
  let d;
  if (dateInput instanceof Date) {
    d = dateInput;
  } else {
    const str = String(dateInput).trim();
    if (str.includes('/')) {
      const parts = str.split('/');
      if (parts.length === 3) {
        const p1 = parseInt(parts[0], 10);
        const p2 = parseInt(parts[1], 10);
        const p3 = parseInt(parts[2], 10);
        if (p2 <= 12 && p1 <= 31) {
          d = new Date(p3, p2 - 1, p1);
        } else if (p1 <= 12 && p2 <= 31) {
          d = new Date(p3, p1 - 1, p2);
        }
      }
    }
    if (!d) d = new Date(str);
  }

  if (!d || isNaN(d.getTime())) return 'N/A';

  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

export function parseSafelyDate(dateStr) {
  if (!dateStr) return new Date();
  if (dateStr instanceof Date) return dateStr;
  const str = String(dateStr).trim();
  if (str.includes('/')) {
    const parts = str.split('/');
    if (parts.length === 3) {
      const p1 = parseInt(parts[0], 10);
      const p2 = parseInt(parts[1], 10);
      const p3 = parseInt(parts[2], 10);
      if (p2 <= 12 && p1 <= 31) {
        return new Date(p3, p2 - 1, p1);
      } else if (p1 <= 12 && p2 <= 31) {
        return new Date(p3, p1 - 1, p2);
      }
    }
  }
  const d = new Date(str);
  return isNaN(d.getTime()) ? new Date() : d;
}
