import { EmptyWasi } from "empty-wasi";
import { ccheck } from "./c";

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
        const { memory, malloc, free, render, free_render_data } = this.exports;

        let length;
        let result;
        const buf = ccheck(malloc(src.byteLength + 1), "failed to malloc.");
        try {
            new Uint8Array(memory.buffer, buf, src.byteLength).set(src);
            new Uint8Array(memory.buffer, buf + src.byteLength, 1).set([0]);
            const resultPtr = ccheck(malloc(Uint32Array.BYTES_PER_ELEMENT), "failed to malloc.");
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

        let image: Blob|null = null;
        if (length >= 0) {
            const data = memory.buffer.slice(result, result + length); // copy of ArrayBuffer
            free_render_data(result);

            image = new Blob([data], { type: "image/svg+xml" });
        }
        const stderr = this.stderr.splice(0);
        return [image, stderr];
    }
}
