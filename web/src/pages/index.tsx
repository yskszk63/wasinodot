import Head from 'next/head'
import styles from '../styles/Home.module.css'

import Editor from '../components/editor';
import Graphviz from '../components/graphviz';
import { useState } from 'react';

export default function Home() {
  const [text, setText] = useState("digraph G {\n  a -> b;\n}");

  return (
    <div className={styles.container}>
      <Head>
        <title>wasinodot</title>
        <meta name="description" content="Graphviz on WASM." />
        <link rel="icon" href="data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text x=%2250%%22 y=%2250%%22 style=%22dominant-baseline:central;text-anchor:middle;font-size:90px;%22>○</text></svg>" />
      </Head>

      <main className={styles.main}>
        <Editor text={text} onTextChanged={setText}/>
        <Graphviz text={text} onError={console.log}/>
      </main>
    </div>
  )
}
