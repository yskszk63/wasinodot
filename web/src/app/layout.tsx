import "./global.css";

export default function Layout({ children }: { children: React.ReactNode}): React.ReactNode {
  return (
    <html>
      <head>
        <title>wasinodot</title>
        <meta name="description" content="Graphviz on WASM." />
        <link
          rel="icon"
          href="data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text x=%2250%%22 y=%2250%%22 style=%22dominant-baseline:central;text-anchor:middle;font-size:90px;%22>○</text></svg>"
        />
      </head>
      <body>
        {children}
      </body>
    </html>
  )
}
