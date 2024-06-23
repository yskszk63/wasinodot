import { compile, ZstdExports } from "simple-wasi-zstd";
import { EmptyWasi } from "empty-wasi";
import { CBuffer, CIntPtr } from "../lib/c";

export class Zstd {
  exports: ZstdExports;
  cctx?: number;
  dctx?: number;
  ibuf?: CBuffer;
  obuf?: CBuffer;
  ipos?: CIntPtr;
  opos?: CIntPtr;

  constructor(exports: ZstdExports) {
    this.exports = exports;

    const {
      ZSTD_createCCtx,
      ZSTD_createDCtx,
      ZSTD_CStreamInSize,
      ZSTD_CStreamOutSize,
    } = exports;

    try {
      this.cctx = ZSTD_createCCtx();
      this.dctx = ZSTD_createDCtx();
      this.ibuf = CBuffer.alloc(exports, ZSTD_CStreamInSize());
      this.obuf = CBuffer.alloc(exports, ZSTD_CStreamOutSize());
      this.ipos = CIntPtr.alloc(exports);
      this.opos = CIntPtr.alloc(exports);
    } catch (e) {
      this.destroy();
      throw e;
    }
  }

  destroy() {
    const { ZSTD_freeCCtx, ZSTD_freeDCtx } = this.exports;

    if (this.cctx) {
      ZSTD_freeCCtx(this.cctx);
    }
    if (this.dctx) {
      ZSTD_freeDCtx(this.dctx);
    }
    this.ibuf?.destroy();
    this.obuf?.destroy();
    this.ipos?.destroy();
    this.opos?.destroy();
  }

  compress(text: string): string {
    if (!this.cctx || !this.obuf || !this.ibuf || !this.ipos || !this.opos) {
      throw new Error("may be destroyed.");
    }

    const { ZSTD_isError, ZSTD_CCtx_reset, ZSTD_compressStream2_simpleArgs } =
      this.exports;
    const { cctx, obuf, ibuf, ipos, opos } = this;

    ZSTD_CCtx_reset(cctx, 2);

    const result: Array<string> = [];
    const encoder = new TextEncoder();
    let pos = 0;
    while (pos < text.length) {
      const { read, written } = encoder.encodeInto(text.slice(pos), ibuf.mem());
      if (typeof read === "undefined" || typeof written === "undefined") {
        throw new Error();
      }
      pos += read;

      const last = !(pos < text.length);

      ipos.set(0);
      while (true) {
        opos.set(0);
        const mode = last ? 2 : 0;
        const ret = ZSTD_compressStream2_simpleArgs(
          cctx,
          obuf.ptr,
          obuf.size,
          opos.ptr,
          ibuf.ptr,
          written,
          ipos.ptr,
          mode,
        );
        if (ZSTD_isError(ret)) {
          throw new Error(`err: ${ret}`);
        }
        if (opos.get() > 0) {
          result.push(
            Array.from(obuf.mem(opos.get()), (b) => String.fromCharCode(b))
              .join(""),
          );
        }
        if (last ? ret === 0 : written === ipos.get()) {
          break;
        }
      }
    }
    return btoa(result.join(""));
  }

  decompressBytes(text: string): Blob {
    if (!this.dctx || !this.obuf || !this.ibuf || !this.ipos || !this.opos) {
      throw new Error("may be destroyed.");
    }

    const { ZSTD_isError, ZSTD_DCtx_reset, ZSTD_decompressStream_simpleArgs } =
      this.exports;
    const { dctx, obuf, ibuf, ipos, opos } = this;

    ZSTD_DCtx_reset(dctx, 2);
    const textBuf = Uint8Array.from(
      Array.from(atob(text), (c) => c.charCodeAt(0)),
    );
    const result: Array<Uint8Array> = [];
    let pos = 0;
    while (pos < textBuf.length) {
      const n = Math.min(ibuf.size, textBuf.length - pos);
      ibuf.mem().set(textBuf.slice(pos, pos + n));
      pos += n;

      ipos.set(0);
      while (true) {
        opos.set(0);
        const ret = ZSTD_decompressStream_simpleArgs(
          dctx,
          obuf.ptr,
          obuf.size,
          opos.ptr,
          ibuf.ptr,
          n,
          ipos.ptr,
        );
        if (ZSTD_isError(ret)) {
          throw new Error(`err ${ret}`);
        }
        if (opos.get() > 0) {
          result.push(obuf.mem(opos.get()).slice());
        }
        if (n === ipos.get()) {
          break;
        }
      }
    }
    return new Blob(result);
  }
}

export async function createZstd(): Promise<Zstd> {
  const wasi = new EmptyWasi({});
  // Not cjs module
  // eslint-disable-next-line @next/next/no-assign-module-variable
  const module = await compile();
  const instance = await WebAssembly.instantiate(module, {
    ...wasi.getImports(module),
  });
  wasi.start(instance);

  return new Zstd(instance.exports as ZstdExports);
}
