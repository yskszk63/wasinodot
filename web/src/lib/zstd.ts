import { compile, ZstdExports } from 'simple-wasi-zstd';
import { EmptyWasi } from 'empty-wasi';
import { ccheck, CBuffer } from '../lib/c';

const ZERO = BigInt(0);
const MAX_I32 = BigInt(0x7FFF_FFFF);

export class Zstd {
    exports: ZstdExports;

    constructor(exports: ZstdExports) {
        this.exports = exports;
    }

    compress(text: string): string {
        const textBuf = new TextEncoder().encode(text);

        const src = new CBuffer(this.exports, textBuf.byteLength);
        try {
            new Uint8Array(this.exports.memory.buffer, src.ptr, src.size).set(textBuf);

            const dst = new CBuffer(this.exports, Math.max(src.size * 2, 13));
            try {
                for (const _ of Array.from({length: 5})) {
                    // 3: zstd cli default level
                    const level = 3;
                    const ret = this.exports.ZSTD_compress(dst.ptr, dst.size, src.ptr, src.size, level);
                    if (ret === -70) {
                        dst.grow();
                    } else if (ret < 0) {
                        throw new Error(`failed to compress.${ret}`);
                    } else {
                        const buf = new Uint8Array(this.exports.memory.buffer, dst.ptr, ret);
                        return btoa(Array.from(buf, b => String.fromCharCode(b)).join(""));
                    }
                }
                throw new Error("failed to compress cause allocation failed.");
            } finally {
                dst.destroy();
            }
        } finally {
            src.destroy();
        }
    }

    decompressBytes(text: string): Uint8Array {
        const textBuf = Uint8Array.from(Array.from(atob(text), c => c.charCodeAt(0)));
        const ptr = ccheck(this.exports.malloc(textBuf.byteLength), "failed to malloc.");
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
            const dst = ccheck(this.exports.malloc(dstLen), "failed to malloc.");
            try {
                const ret = ccheck(this.exports.ZSTD_decompress(dst, dstLen, ptr, textBuf.byteLength), "failed to decompress.");
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
