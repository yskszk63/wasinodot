import { compile, ZstdExports } from 'simple-wasi-zstd';
import { EmptyWasi } from 'empty-wasi';
import { ccheck, cwith, CBuffer } from '../lib/c';

const ZERO = BigInt(0);
const MAX_I32 = BigInt(0x7FFF_FFFF);

export class Zstd {
    exports: ZstdExports;

    constructor(exports: ZstdExports) {
        this.exports = exports;
    }

    compress(text: string): string {
        const textBuf = new TextEncoder().encode(text);

        return cwith(CBuffer.alloc(this.exports, textBuf.byteLength), src => {
            new Uint8Array(this.exports.memory.buffer, src.ptr, src.size).set(textBuf);

            return cwith(CBuffer.alloc(this.exports, Math.max(src.size * 2, 13)), dst => {
                for (const _ of Array.from({length: 5})) {
                    // 3: zstd cli default level
                    const level = 3;
                    const ret = this.exports.ZSTD_compress(dst.ptr, dst.size, src.ptr, src.size, level);
                    if (ret === -70) { // ZSTD_error_dstSize_tooSmall
                        dst.grow();
                    } else if (ret < 0) {
                        throw new Error(`failed to compress.${ret}`);
                    } else {
                        const buf = new Uint8Array(this.exports.memory.buffer, dst.ptr, ret);
                        return btoa(Array.from(buf, b => String.fromCharCode(b)).join(""));
                    }
                }
                throw new Error("failed to compress cause allocation failed.");
            });
        });
    }

    decompressBytes(text: string): Uint8Array {
        const textBuf = Uint8Array.from(Array.from(atob(text), c => c.charCodeAt(0)));

        return cwith(CBuffer.alloc(this.exports, textBuf.byteLength), src => {
            new Uint8Array(this.exports.memory.buffer, src.ptr, src.size).set(textBuf);

            const dstLenb = this.exports.ZSTD_getFrameContentSize(src.ptr, src.size);
            if (dstLenb < ZERO) {
                throw new Error("Could not detect decompressed size. May be stream compressed data.");
            }
            if (dstLenb > MAX_I32) {
                throw new Error(`Too large data.${dstLenb}`);
            }
            const dstLen = Number(dstLenb);

            return cwith(CBuffer.alloc(this.exports, dstLen), dst => {
                const ret = ccheck(this.exports.ZSTD_decompress(dst.ptr, dstLen, src.ptr, src.size), "failed to decompress.");
                return new Uint8Array(this.exports.memory.buffer.slice(dst.ptr, dst.ptr + ret));
            });
        });
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
