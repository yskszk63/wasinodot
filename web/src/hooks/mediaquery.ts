import { useState, useEffect } from "react";

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState<boolean>(false);

  useEffect(() => {
    if (typeof window.matchMedia === 'undefined') {
      return;
    }

    const list = window.matchMedia(query);
    setMatches(list.matches);

    const abort = new AbortController();
    list.addEventListener('change', (evt) => setMatches(evt.matches), { signal: abort.signal });
    return () => abort.abort();
  }, [query]);

  return matches;
}
