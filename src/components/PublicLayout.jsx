import React, { useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Navbar from './Navbar';
import Footer from './Footer';

export default function PublicLayout() {
  const location = useLocation();

  useEffect(() => {
    // Global Form Typing Mode: Pauses all animations across website while typing inside any form field
    const handleFocusIn = (e) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) {
        document.body.classList.add('form-typing-mode');
      }
    };

    const handleFocusOut = (e) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) {
        document.body.classList.remove('form-typing-mode');
      }
    };

    document.addEventListener('focusin', handleFocusIn);
    document.addEventListener('focusout', handleFocusOut);

    return () => {
      document.removeEventListener('focusin', handleFocusIn);
      document.removeEventListener('focusout', handleFocusOut);
      document.body.classList.remove('form-typing-mode');
    };
  }, []);

  useEffect(() => {
    // Bi-directional Scroll Reveal (Triggers on Scroll Down AND Scroll Up)
    const observerCallback = (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('revealed');
        } else {
          // Remove revealed when scrolled out of view so scrolling back up re-triggers animation
          entry.target.classList.remove('revealed');
        }
      });
    };

    const observerOptions = {
      threshold: 0.12,
      rootMargin: '0px 0px -30px 0px'
    };

    const observer = new IntersectionObserver(observerCallback, observerOptions);

    const observeElements = () => {
      const elements = document.querySelectorAll('.scroll-reveal, .scroll-reveal-left, .scroll-reveal-right');
      elements.forEach((el) => observer.observe(el));
    };

    const timer = setTimeout(() => {
      observeElements();
    }, 80);

    return () => {
      clearTimeout(timer);
      observer.disconnect();
    };
  }, [location.pathname]);

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 overflow-x-hidden">
      <Navbar />
      <main key={location.pathname} className="flex-grow animate-page-fade">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}
