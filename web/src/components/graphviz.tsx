import { useCallback, useEffect, useState } from "react";
import { LibGraphviz } from "../lib/libgraphviz";

interface Props {
  src: Uint8Array;
  onError?: (err: string | null) => any;
  className?: string;
}

function Graphviz({ src, onError, className }: Props) {
  const [lib, setLib] = useState<LibGraphviz | null>(null);
  const [image, setImage] = useState<string | null>(null);
  const onErrorCallback = useCallback((msg: string | null) => {
    if (onError) {
      onError(msg);
    }
  }, [onError]);

  useEffect(() => {
    LibGraphviz.create("libwasinodot.wasm").then(setLib);
  }, []);

  useEffect(() => {
    if (!lib) {
      return;
    }

    const [blob, stderr] = lib.render(src);
    const image = blob ? URL.createObjectURL(blob) : null;
    if (image) {
      setImage(image);
    }
    onErrorCallback(stderr.length ? stderr.join("") : null);

    return () => {
      if (image) {
        URL.revokeObjectURL(image);
      }
    };
  }, [lib, src, onErrorCallback, setImage]);

  return (
    <div className={className}>
      {image &&
        (
          <a href={image} target="_blank" rel="noreferrer">
            <img src={image} alt="" />
          </a>
        )}
    </div>
  );
}

export default Graphviz;
