import { useEffect, useState } from "react";

export function useDebounse(val: any, delay: number) {
  const [dval, setDval] = useState(val);
  useEffect(() => {
    const timer = setTimeout(() => setDval(val), delay);
    return () => clearTimeout(timer);
  }, [val, delay]);
  return dval;
}
