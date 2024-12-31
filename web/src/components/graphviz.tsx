import { useCallback, useEffect, useState } from "react";
import { LibGraphviz } from "@/lib/libgraphviz";

function useLib(): LibGraphviz | undefined {
  const [lib, setLib] = useState<LibGraphviz | undefined>();

  useEffect(() => {
    const abort = new AbortController();
    (async (signal) => {
      const lib = await LibGraphviz.create("libwasinodot.wasm");
      if (signal.aborted) {
        return;
      }
      setLib(lib);
    })(abort.signal);
    return () => abort.abort();
  }, []);

  return lib;
}

type UseRenderedResult = {
  image?: string | undefined;
  error?: string | undefined;
}

function useRendered(lib: LibGraphviz | undefined, src: Uint8Array): UseRenderedResult {
  const [blob, setBlob] = useState<Blob | null>(null);
  const [stderr, setStderr] = useState<string[]>(() => []);
  const [state, setState] = useState<UseRenderedResult>(() => ({}));

  useEffect(() => {
    if (typeof lib === "undefined") {
      return;
    }

    const [blob, stderr] = lib.render(src);
    setBlob(blob);
    setStderr(stderr);
  }, [lib, src]);

  useEffect(() => {
    if (blob === null) {
      setState(({ image: _, ...prev }) => ({ ...prev }));
      return;
    }

    const image = URL.createObjectURL(blob);
    setState((prev) => ({ ...prev, image }));
    return () => URL.revokeObjectURL(image);
  }, [blob]);

  useEffect(() => {
    if (stderr.length < 1) {
      setState(({ error: _, ...prev }) => ({ ...prev }));
      return;
    }
    setState((prev) => ({ ...prev, error: stderr.join("") }));
  }, [stderr]);

  return state;
}

interface Props {
  src: Uint8Array;
  onError?: (err: string | null) => any;
  className?: string;
}

function Graphviz({ src, onError, className }: Props) {
  const lib = useLib();
  const { image, error } = useRendered(lib, src);

  useEffect(() => onError?.(error ?? null), [error, onError]);

  return (
    <div className={className}>
      {image &&
        (
          <a href={image} target="_blank" rel="noreferrer" className="size-full shadow-lg bg-white">
            <img src={image} alt="" className="size-full object-contain" />
          </a>
        )}
    </div>
  );
}

export default Graphviz;
