"use client";

import { useEffect, useState } from "react";
import styles from "../styles/Home.module.css";

import Editor from "@/components/editor";
import Graphviz from "@/components/graphviz";

import { useZstd, useCompress, useDecompress } from "@/hooks/zstd";
import { useMediaQuery } from "@/hooks/mediaquery";
import { useDebounse } from "@/hooks/debouse";
import { useUrlHash } from "@/hooks/urlhash";

export default function Home(): React.ReactNode {
  const zstd = useZstd();
  const [text, setText] = useState<string | null>(null);
  const delayText = useDebounse(text, 500);
  const compressedText = useCompress(zstd, delayText);
  const [dot, setDot] = useState<Uint8Array | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const dark = useMediaQuery('(prefers-color-scheme: dark)');
  const [hash, setHash] = useUrlHash(
    "KLUv/SQXuQAAZGlncmFwaCBHIHsKICBhIC0+IGI7Cn2j2B46",
  ); // digraph G {\n  a -> b;\n}
  const decompressedHash = useDecompress(zstd, hash);

  useEffect(() => {
    if (compressedText === null) {
      return;
    }

    setHash(compressedText);
  }, [compressedText, setHash]);

  useEffect(() => {
    if (decompressedHash === null) {
      return;
    }

    const abort = new AbortController();

    (async (signal) => {
      const data = await decompressedHash.arrayBuffer();
      if (signal.aborted) {
        return;
      }
      setDot(new Uint8Array(data));
    })(abort.signal);

    (async (signal) => {
      const data = await decompressedHash.text();
      if (signal.aborted) {
        return;
      }
      setText((prev) => prev ?? data);
    })(abort.signal);

    return () => abort.abort();
  }, [decompressedHash]);

  return (
    <main className="w-screen h-screen flex size-full">
      <div className="flex-1 overflow-auto">
        {text !== null && (
          <Editor
            text={text}
            onTextChanged={setText}
            errorMessage={errorMessage}
            darkTheme={dark}
            className="size-full"
          />
        )}
      </div>
      <div className="flex-1 overflow-auto">
        {dot !== null && (
          <Graphviz
            src={dot}
            onError={setErrorMessage}
            className="size-full flex justify-center p-4"
          />
        )}
      </div>
    </main>
  );
}
