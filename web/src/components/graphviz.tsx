import * as React from "react";
import { WASI } from "@wasmer/wasi"
import { WasmFs } from "@wasmer/wasmfs";

interface Wasinodot {
    memory: WebAssembly.Memory,
    malloc: (size: number) => number,
    free: (ptr: number) => void,
    render: (src: number, result: number) => number,
    free_render_data: (result: number) => void,
}

type WasinodotExports = WebAssembly.Exports & Wasinodot;

class InputBuffer {
    length: number;
    ptr: number;
    memory: WebAssembly.Memory;
    malloc: (size: number) => number;
    free: (ptr: number, size: number) => void;

    constructor(exports: Wasinodot) {
        this.length = 1024 * 8;
        this.memory = exports.memory as WebAssembly.Memory;
        this.malloc = exports.malloc;
        this.free = exports.free;
        this.ptr = this.malloc(this.length);
    }

    destruct() {
        this.free(this.ptr, this.length);
    }

    set(text: string): void {
        const encoder = new TextEncoder();
        const { read, written } = encoder.encodeInto(text, new Uint8Array(this.memory.buffer, this.ptr, this.length));
        if (typeof read === 'undefined' || typeof written === 'undefined') {
            throw new Error('unexpected.');
        }
        if (read < text.length || this.length - written <= 0) {
            this.free(this.ptr, this.length);
            this.length = this.length * 2;
            this.ptr = this.malloc(this.length);
            return this.set(text);
        }
        new Uint8Array(this.memory.buffer, this.ptr + written, 1)[0] = 0;
    }
}

interface Props {
    //src: ArrayBuffer | ArrayBufferView,
    text: string,
    onError?: (err: string | null) => any,
    className?: string, 
}

function Graphviz({text, onError, className}: Props) {
    const [wasm, setWasm] = React.useState<[WasinodotExports, Array<string>, InputBuffer] | null>(null);
    const [image, setImage] = React.useState<string|null>(null);

    React.useEffect(() => {
        const done: Promise<[WebAssembly.Instance, Array<string>, InputBuffer]> = (async () => {
            const fs = new WasmFs();
            const wasi = new WASI({
                args: [],
                env: {},
                bindings: {
                    ...WASI.defaultBindings,
                    fs: fs.fs,
                }
            });
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
            const buf = new InputBuffer(exports);
            setWasm([exports, stderr, buf]);
            return [instance, stderr, buf] as [WebAssembly.Instance, Array<string>, InputBuffer];
        })();
        return () => {
            done.then(([_instance, _stderr, buf]) => {
                buf.destruct();
            });
        }
    }, []);

    React.useEffect(() => {
        if (!wasm) {
            return;
        }

        const [{ memory, malloc, free, render, free_render_data }, stderr, buffer] = wasm;

        buffer.set(text);
        const resultPtr = malloc(Uint32Array.BYTES_PER_ELEMENT);
        new Uint32Array(memory.buffer, resultPtr, 1)[0] = 0;

        const length = render(buffer.ptr, resultPtr);
        const result = new Uint32Array(memory.buffer, resultPtr, 1)[0];

        free(resultPtr);

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
    }, [wasm, text, onError, setImage]);

    return <div className={className}>{ image && <a href={image} target="_blank"><img src={image}/></a> }</div>;
}

export default Graphviz;
