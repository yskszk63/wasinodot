import { EmptyWasi } from "empty-wasi";
import { CBuffer, CIntPtr, cwith } from "./c";

interface Wasinodot {
    memory: WebAssembly.Memory,
    malloc: (size: number) => number,
    free: (ptr: number) => void,
    render: (src: number, result: number) => number,
    free_render_data: (result: number) => void,
}

type WasinodotExports = WebAssembly.Exports & Wasinodot;

export class LibGraphviz {
    static async create(wasmloc: string) {
        const stderr: Array<string> = [];

        const wasi = new EmptyWasi({});
        const module = await WebAssembly.compileStreaming(fetch(wasmloc));
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
        return new LibGraphviz(instance.exports as WasinodotExports, stderr);
    }

    exports: WasinodotExports;
    stderr: Array<string>;
    constructor(exports: WasinodotExports, stderr: Array<string>) {
        this.exports = exports;
        this.stderr = stderr;
    }

    render(src: Uint8Array): [Blob|null, Array<string>] {
        const { memory, render, free_render_data } = this.exports;

        const [length, result] = cwith(CBuffer.fromCstr(this.exports, src), buf => {
            return cwith(CIntPtr.alloc(this.exports), resultPtr => {
                const length = render(buf.ptr, resultPtr.ptr);
                const result = resultPtr.get();
                return [length, result]
            });
        });
        try {
            let image: Blob|null = null;
            if (length >= 0) {
                const data = memory.buffer.slice(result, result + length); // copy of ArrayBuffer
                image = new Blob([data], { type: "image/svg+xml" });
            }
            const stderr = this.stderr.splice(0);
            return [image, stderr];
        } finally {
            if (result !== 0) {
                free_render_data(result);
            }
        }
    }
}
