'use client';

import { useEffect } from 'react';

/**
 * Clicking the nav logo while already on the homepage is a same-URL
 * navigation, which Next treats as a no-op and leaves the scroll position
 * alone; scroll back to the top explicitly.
 */
export function LogoScrollTop() {
  useEffect(() => {
    function onClick(event: MouseEvent) {
      const target = event.target as Element | null;
      if (target?.closest('#nd-nav a[href="/"]')) {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    }
    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
  }, []);

  return null;
}
