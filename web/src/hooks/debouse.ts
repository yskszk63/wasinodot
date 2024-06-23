import { useEffect, useState } from "react";

export function useDebounse<T>(val: T, delay: number): T {
  const [dval, setDval] = useState<T>(val);
  useEffect(() => {
    const timer = setTimeout(() => setDval(val), delay);
    return () => clearTimeout(timer);
  }, [val, delay]);
  return dval;
}
