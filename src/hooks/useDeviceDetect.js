import { useState, useEffect } from 'react';

/**
 * useDeviceDetect Hook
 * Detects whether the current environment is a mobile screen (< 768px),
 * touch mobile device, or running inside Capacitor native Android/iOS container.
 * Supports manual override saved to localStorage for development and previewing.
 */
export function useDeviceDetect() {
  const [isMobile, setIsMobile] = useState(() => {
    // Check manual override first
    const savedOverride = localStorage.getItem('controlroom_view_mode_override');
    if (savedOverride === 'mobile') return true;
    if (savedOverride === 'desktop') return false;

    if (typeof window === 'undefined') return false;

    // Check screen width
    const isSmallScreen = window.innerWidth <= 768;

    // Check Capacitor native container
    const isCapacitor = Boolean(window.Capacitor?.isNativePlatform && window.Capacitor.isNativePlatform());

    // Check user agent
    const isTouchUserAgent = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

    return isSmallScreen || isCapacitor || (isTouchUserAgent && window.innerWidth <= 1024);
  });

  const [viewModeOverride, setViewModeOverride] = useState(() => {
    return localStorage.getItem('controlroom_view_mode_override') || 'auto';
  });

  useEffect(() => {
    const handleResize = () => {
      const savedOverride = localStorage.getItem('controlroom_view_mode_override');
      if (savedOverride === 'mobile') {
        setIsMobile(true);
        return;
      }
      if (savedOverride === 'desktop') {
        setIsMobile(false);
        return;
      }

      const isSmall = window.innerWidth <= 768;
      const isCapacitor = Boolean(window.Capacitor?.isNativePlatform && window.Capacitor.isNativePlatform());
      const isTouch = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

      setIsMobile(isSmall || isCapacitor || (isTouch && window.innerWidth <= 1024));
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
    };
  }, []);

  const toggleViewMode = (mode) => {
    // mode: 'auto' | 'mobile' | 'desktop'
    if (mode === 'auto') {
      localStorage.removeItem('controlroom_view_mode_override');
      setViewModeOverride('auto');
      const isSmall = window.innerWidth <= 768;
      setIsMobile(isSmall);
    } else {
      localStorage.setItem('controlroom_view_mode_override', mode);
      setViewModeOverride(mode);
      setIsMobile(mode === 'mobile');
    }
  };

  return {
    isMobile,
    viewModeOverride,
    toggleViewMode
  };
}

export default useDeviceDetect;
