import { compile, ZstdExports } from 'simple-wasi-zstd';
import { EmptyWasi } from 'empty-wasi';

const ZERO = BigInt(0);
const MAX_I32 = BigInt(0x7FFF_FFFF);

export class Zstd {
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
                const ret = this.exports.ZSTD_compress(dst, dstLen, ptr, textBuf.byteLength, 3); // 3: zstd cli default level
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

    decompressBytes(text: string): Uint8Array {
        const textBuf = Uint8Array.from(Array.from(atob(text), c => c.charCodeAt(0)));
        const ptr = this.exports.malloc(textBuf.byteLength);
        try {
            new Uint8Array(this.exports.memory.buffer, ptr, textBuf.byteLength).set(textBuf);

            const dstLenb = this.exports.ZSTD_getFrameContentSize(ptr, textBuf.byteLength);
            if (dstLenb < ZERO) {
                throw new Error("Could not detect decompressed size. May be stream compressed data.");
            }
            if (dstLenb > MAX_I32) {
                throw new Error(`Too large data.${dstLenb}`);
            }
            const dstLen = Number(dstLenb);
            const dst = this.exports.malloc(dstLen);
            try {
                const ret = this.exports.ZSTD_decompress(dst, dstLen, ptr, textBuf.byteLength);
                if (ret < 0) {
                    throw new Error(`failed to decompress.${ret}`);
                }
                return new Uint8Array(this.exports.memory.buffer.slice(dst, dst + ret));
            } finally {
                this.exports.free(dst);
            }
        } finally {
            this.exports.free(ptr);
        }
    }
}

export async function createZstd(): Promise<Zstd> {
    const wasi = new EmptyWasi({});
    const module = await compile();
    const instance = await WebAssembly.instantiate(module, {
        ...wasi.getImports(module),
    });
    wasi.start(instance);

    return new Zstd(instance.exports as ZstdExports);
}
