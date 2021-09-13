import { compile, ZstdExports } from 'simple-wasi-zstd';
import { WASI } from '@wasmer/wasi';

export interface IZstd {
    compress(text: string): string;
    decompress(text: string): string;
}

class Zstd {
    exports: ZstdExports;

    constructor(exports: ZstdExports) {
        this.exports = exports;
    }

    compress(text: string): string {
        const textBuf = new TextEncoder().encode(text);
        const ptr = this.exports.malloc(textBuf.byteLength);
        try {
            new Uint8Array(this.exports.memory.buffer, ptr, textBuf.byteLength).set(textBuf);

            const dstLen = textBuf.byteLength * 2;
            const dst = this.exports.malloc(dstLen);
            try {
                const ret = this.exports.ZSTD_compress(dst, dstLen, ptr, textBuf.byteLength, 0);
                if (ret < 0) {
                    throw new Error(`failed to compress.${ret}`);
                }
                const buf = new Uint8Array(this.exports.memory.buffer, dst, ret);
                return btoa(Array.from(buf, b => String.fromCharCode(b)).join(""));
            } finally {
                this.exports.free(dst);
            }
        } finally {
            this.exports.free(ptr);
        }
    }

    decompress(text: string): string {
        const textBuf = Uint8Array.from(Array.from(atob(text), c => c.charCodeAt(0)));
        const ptr = this.exports.malloc(textBuf.byteLength);
        try {
            new Uint8Array(this.exports.memory.buffer, ptr, textBuf.byteLength).set(textBuf);

            const dstLen = textBuf.byteLength * 2;
            const dst = this.exports.malloc(dstLen);
            try {
                const ret = this.exports.ZSTD_decompress(dst, dstLen, ptr, textBuf.byteLength);
                if (ret < 0) {
                    throw new Error(`failed to decompress.${ret}`);
                }
                const buf = new Uint8Array(this.exports.memory.buffer, dst, ret);
                return new TextDecoder().decode(buf);
            } finally {
                this.exports.free(dst);
            }
        } finally {
            this.exports.free(ptr);
        }
    }
}

export async function createZstd(): Promise<IZstd> {
    const wasi = new WASI({});
    const module = await compile();
    const instance = await WebAssembly.instantiate(module, {
        ...wasi.getImports(module),
    });
    wasi.start(instance);

    return new Zstd(instance.exports as ZstdExports);
}
