import Head from 'next/head'
import styles from '../styles/Home.module.css'

import Editor from '../components/editor';
import Graphviz from '../components/graphviz';
import { useEffect, useState } from 'react';
import { createZstd, IZstd } from '../lib/zstd';
import { useDebounse } from "../lib/debouse";
import { useUrlHash } from "../lib/urlhash";

export default function Home() {
  const [initialized, setInitialized] = useState(false);
  const [text, setText] = useState<string>("");
  const delayText = useDebounse(text, 500);
  const [dot, setDot] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [hash, setHash] = useUrlHash("KLUv/SQXuQAAZGlncmFwaCBHIHsKICBhIC0+IGI7Cn2j2B46"); // digraph G {\n  a -> b;\n}
  const [zstd, setZstd] = useState<IZstd | null>(null);
  useEffect(() => { createZstd().then(setZstd); }, []);
  useEffect(() => {
    if (zstd && delayText) {
        const c = zstd.compress(delayText);
        setHash(c);
    }
  }, [delayText, zstd, setHash]);
  useEffect(() => {
    if (zstd && hash !== null) {
        const d = zstd.decompress(hash);
        setDot(d);
    }
  }, [zstd, hash, setDot]);
  useEffect(() => {
    if (!initialized && hash && zstd) {
        const d = zstd.decompress(hash);
        setText(d);
        setInitialized(true);
    }
  }, [hash, initialized, setInitialized, setText, zstd]);

  return (
    <div className={styles.container}>
      <Head>
        <title>wasinodot</title>
        <meta name="description" content="Graphviz on WASM." />
        <link rel="icon" href="data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text x=%2250%%22 y=%2250%%22 style=%22dominant-baseline:central;text-anchor:middle;font-size:90px;%22>○</text></svg>" />
      </Head>

      <main className={styles.main}>
        { initialized && <Editor text={text} onTextChanged={setText} errorMessage={errorMessage}/> }
        <Graphviz text={dot} onError={setErrorMessage} className={styles.imagePane}/>
      </main>
    </div>
  )
}
