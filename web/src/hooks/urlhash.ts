import { Dispatch, SetStateAction, useEffect, useRef, useState } from "react";

export function useUrlHash(
  defaultValue: string,
): [string | null, Dispatch<SetStateAction<string | null>>] {
  const defaultValueRef = useRef<string>(defaultValue);
  const [hash, setHash] = useState<string | null>(null);

  useEffect(() => {
    if (window.location.hash === "") {
      setHash((prev) => prev ?? defaultValueRef.current);
      return;
    }

    setHash((prev) => prev ?? window.location.hash.slice(1));
  }, []);

  useEffect(() => {
    if (hash === null) {
      return;
    }

    window.history.replaceState({}, "", `#${hash}`);
  }, [hash]);

  return [hash, setHash];
}
