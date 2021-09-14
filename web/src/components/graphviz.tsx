import * as React from "react";
import { EmptyWasi } from "empty-wasi"

interface Wasinodot {
    memory: WebAssembly.Memory,
    malloc: (size: number) => number,
    free: (ptr: number) => void,
    render: (src: number, result: number) => number,
    free_render_data: (result: number) => void,
}

type WasinodotExports = WebAssembly.Exports & Wasinodot;

interface Props {
    src: Uint8Array,
    onError?: (err: string | null) => any,
    className?: string, 
}

function Graphviz({src, onError, className}: Props) {
    const [wasm, setWasm] = React.useState<[WasinodotExports, Array<string>] | null>(null);
    const [image, setImage] = React.useState<string|null>(null);

    React.useEffect(() => {
        (async () => {
            const wasi = new EmptyWasi({});
            const module = await WebAssembly.compileStreaming(fetch("libwasinodot.wasm"));
            const stderr: Array<string> = [];
            const instance = await WebAssembly.instantiate(module, {
                ...wasi.getImports(module),
                env: {
                    handle_err(buf: number, len: number) {
                        const mem = instance.exports.memory as WebAssembly.Memory;
                        const msg = new Uint8Array(mem.buffer, buf, len);
                        stderr.push(new TextDecoder().decode(msg));
                    },
                },
            });
            wasi.start(instance);
            const exports = instance.exports as WasinodotExports;
            setWasm([exports, stderr]);
            return [instance, stderr] as [WebAssembly.Instance, Array<string>];
        })();
    }, []);

    React.useEffect(() => {
        if (!wasm) {
            return;
        }

        const [{ memory, malloc, free, render, free_render_data }, stderr] = wasm;

        let length;
        let result;
        const buf = malloc(src.byteLength + 1);
        if (buf === 0) {
            throw new Error("failed to malloc.");
        }
        try {
            new Uint8Array(memory.buffer, buf, src.byteLength).set(src);
            new Uint8Array(memory.buffer, buf + src.byteLength, 1).set([0]);
            const resultPtr = malloc(Uint32Array.BYTES_PER_ELEMENT);
            try {
                new Uint32Array(memory.buffer, resultPtr, 1)[0] = 0;
                length = render(buf, resultPtr);
                result = new Uint32Array(memory.buffer, resultPtr, 1)[0];
            } finally {
                free(resultPtr);
            }

        } finally {
            free(buf);
        }

        let image: string|null = null;
        if (length >= 0) {
            const data = memory.buffer.slice(result, result + length); // copy of ArrayBuffer
            free_render_data(result);

            const blob = new Blob([data], { type: "image/svg+xml" });
            image = URL.createObjectURL(blob);
            setImage(image);
        }
        if (onError) {
            if (stderr.length) {
                onError(stderr.splice(0).join(""));
            } else {
                onError(null);
            }
        }
        return () => {
            if (image) {
                URL.revokeObjectURL(image);
            }
        }
    }, [wasm, src, onError, setImage]);

    return <div className={className}>{ image &&
      <a href={image} target="_blank" rel="noreferrer">
        <img src={image} alt="" />
      </a>
    }</div>;
}

export default Graphviz;
