import { useState, useEffect } from "react";

const MOBILE_BREAKPOINT = 768;

/**
 * Custom hook that returns whether the screen is mobile-sized.
 * This hook is designed to be hydration-safe by only determining the
 * screen size after the component has mounted on the client.
 */
export function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkScreenSize = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    };

    // Check on initial mount (client-side)
    checkScreenSize();

    // Add event listener for window resize
    window.addEventListener('resize', checkScreenSize);

    // Cleanup event listener on component unmount
    return () => window.removeEventListener('resize', checkScreenSize);
  }, []);

  return isMobile;
}
