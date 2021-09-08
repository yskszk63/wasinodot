import * as React from "react";
import { WASI } from "@wasmer/wasi"
import { WasmFs } from "@wasmer/wasmfs";

function useDebounse(val: any, delay: number) {
    const [dval, setDval] = React.useState(val);
    React.useEffect(() => {
        const timer = setTimeout(() => setDval(val), delay);
        return () => clearTimeout(timer);
    }, [val, delay]);
    return dval;
}

function Graphviz({text, }: { text: string, }) {
    const delayText = useDebounse(text, 500);
    const [wasm, setWasm] = React.useState<WebAssembly.Module | null>(null);
    const ref = React.useRef<HTMLDivElement>(null);

    React.useEffect(() => {
        WebAssembly.compileStreaming(fetch("wasinodot.wasm")).then(setWasm);
    }, []);

    React.useEffect(() => {
        (async () => {
            if (!wasm || !ref.current) {
                return "";
            }

            const fs = new WasmFs();
            const wasi = new WASI({
                args: [],
                env: {},
                bindings: {
                    ...WASI.defaultBindings,
                    fs: fs.fs,
                }
            });
            const instance = await WebAssembly.instantiate(wasm, {
                ...wasi.getImports(wasm),
            });
            await new Promise(resolve => {
                fs.fs.writeFile("/dev/stdin", new TextEncoder().encode(delayText), resolve);
            });
            wasi.start(instance);
            const data = await fs.getStdOut();
            ref.current.innerHTML = String(data);
        })();
    }, [wasm, ref, delayText]);

    return <div ref={ref} />;
}

export default Graphviz;
