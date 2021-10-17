import { useState, useEffect } from "react";

export function useMediaQuery(query: string): boolean | null {
  const [matches, setMatches] = useState<boolean | null>(null);
  useEffect(() => {
    if (typeof window.matchMedia === 'undefined') {
      return;
    }

    const list = window.matchMedia(query);
    setMatches(list.matches);
    const listener = function(evt: MediaQueryListEvent) {
      setMatches(evt.matches);
    }
    list.addEventListener('change', listener);
    return () => list.removeEventListener('change', listener);
  }, [query, setMatches]);
  return matches;
}
