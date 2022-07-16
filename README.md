# wasinodot

[Graphviz](https://graphviz.org/) on WASI.

This is my experimental hobby project.

## Demo

![demo](assets/demo.gif)

## How to build

1. `paru -S wasi-sdk-bin` .. if needed.
2. `rustup target add wasm32-wasi`
3. `cargo install cargo-wasi`
4. `WASI_SDK_PATH=/opt/wasi-sdk cargo wasi build --release`
5. `ls target/wasm32-wasi/release/libwasinodot.wasm`

## How to run

### cli

`echo 'graph { ok; }' | wasmtime target/wasm32-wasi/release/wasinodot.wasm`

### Browser

1. `cp target/wasm32-wasi/release/libwasinodot.wasm web/public/libwasinodot.wasm`
2. `cd web && npm ci && npm run dev`

## License

[MIT](LICENSE)
