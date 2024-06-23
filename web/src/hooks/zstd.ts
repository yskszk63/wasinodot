import { useEffect, useState } from "react";
import { createZstd, Zstd } from "@/lib/zstd";

export function useZstd(): Zstd | null {
  const [zstd, setZstd] = useState<Zstd | null>(null);

  useEffect(() => {
    const abort = new AbortController();

    (async function(signal: AbortSignal) {
      const instance = await createZstd();
      if (signal.aborted) {
        return;
      }

      signal.addEventListener("abort", () => instance.destroy());
      setZstd(instance);
    })(abort.signal);

    return () => abort.abort();
  }, []);

  return zstd;
}

export function useCompress(zstd: Zstd | null, text: string | null): string | null {
  const [state, setState] = useState<string | null>(null);

  useEffect(() => {
    if (zstd === null || text === null) {
      return;
    }

    setState(zstd.compress(text));
  }, [zstd, text]);

  return state;
}

export function useDecompress(zstd: Zstd | null, b64Text: string | null): Blob | null {
  const [state, setState] = useState<Blob | null>(null);

  useEffect(() => {
    if (zstd === null || b64Text === null) {
      return;
    }

    setState(zstd.decompressBytes(b64Text));
  }, [zstd, b64Text]);

  return state;
}
