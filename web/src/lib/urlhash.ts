import { useCallback, useEffect, useState } from "react";

export function useUrlHash(
  defaultValue: string,
): [string | null, (hash: string) => void] {
  const [hash, setHash] = useState<string | null>(null);
  useEffect(() => {
    if (window.location.hash === "") {
      window.history.replaceState({}, "", `#${defaultValue}`);
      setHash(defaultValue);
    } else {
      setHash(window.location.hash.slice(1));
    }
  }, [defaultValue, setHash]);
  const set = useCallback((hash: string) => {
    window.history.replaceState({}, "", `#${hash}`);
    setHash(hash);
  }, [setHash]);
  return [hash, set];
}
