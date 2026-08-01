import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

export default function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    // Also scroll any scrollable main containers
    const mainContainer = document.querySelector('main');
    if (mainContainer) {
      mainContainer.scrollTop = 0;
    }
  }, [pathname]);

  return null;
}
