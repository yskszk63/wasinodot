export function ccheck(ret: number, message: string): number {
    if (ret < 0) {
        throw new Error(`Error occurred: [${ret}] ${message}`);
    }
    return ret;
}

interface CBufferImports {
    memory: WebAssembly.Memory;
    malloc: (size: number) => number;
    free: (ptr: number) => void;
}

export class CBuffer {
    static alloc(exports: CBufferImports, initial: number): CBuffer {
        return new CBuffer(exports, initial);
    }

    static fromCstr(exports: CBufferImports, cstr: Uint8Array): CBuffer {
        const buf = CBuffer.alloc(exports, cstr.byteLength + 1);
        try {
            new Uint8Array(buf.memory.buffer, buf.ptr, cstr.byteLength).set(cstr);
            new Uint8Array(buf.memory.buffer, buf.ptr + cstr.byteLength, 1).set([0]);
            return buf;
        } catch (e) {
            buf.destroy();
            throw e;
        }
    }

    memory: WebAssembly.Memory;
    malloc: (size: number) => number;
    free: (ptr: number) => void;
    ptr: number;
    size: number;

    private constructor({memory, malloc, free}: CBufferImports, initial: number) {
        if (initial < 1) {
            throw new Error(`${initial} < 1`);
        }

        this.memory = memory;
        this.malloc = malloc;
        this.free = free;
        this.ptr = ccheck(malloc(initial), "failed to malloc.");
        this.size = initial;
    }

    destroy(): void {
        this.free(this.ptr);
        this.ptr = 0;
        this.size = 0;
    }

    grow(minsize: number = 2, copy: boolean = false): void {
        const oldsize = this.size;
        const oldptr = this.ptr;
        try {
            const newsize = Math.max(oldsize + (oldsize >> 1), minsize); // TODO tuning
            const newptr = ccheck(this.malloc(newsize), "failed to malloc.");
            try {
                if (copy) {
                    const oldmem = new Uint8Array(this.memory.buffer, oldptr, oldsize);
                    const newmem = new Uint8Array(this.memory.buffer, newptr, newsize);
                    newmem.set(oldmem);
                }
            } catch (e) {
                this.free(newptr);
                throw e;
            }
            this.size = newsize;
            this.ptr = newptr;
        } finally {
            this.free(oldptr);
        }
    }
}

export class CIntPtr {
    static alloc({memory, malloc, free}: CBufferImports): CIntPtr {
        const ptr = malloc(Uint32Array.BYTES_PER_ELEMENT);
        try {
            new Uint32Array(memory.buffer, ptr, Uint32Array.BYTES_PER_ELEMENT)[0] = 0;
            return new CIntPtr(ptr, free, memory);
        } catch (e) {
            free(ptr);
            throw e;
        }
    }

    memory: WebAssembly.Memory|null;
    ptr: number;
    free: (ptr: number) => void;

    private constructor(ptr: number, free: (ptr: number) => void, memory: WebAssembly.Memory) {
        this.ptr = ptr;
        this.free = free;
        this.memory = memory;
    }

    destroy(): void {
        this.free(this.ptr);
        this.ptr = 0;
        this.memory = null;
    }

    get(): number {
        return new Uint32Array(this.memory!.buffer, this.ptr, Uint32Array.BYTES_PER_ELEMENT)[0];
    }

    set(val: number): void {
        new Uint32Array(this.memory!.buffer, this.ptr, Uint32Array.BYTES_PER_ELEMENT)[0] = val;
    }
}

export interface Destroyable {
    destroy(): void;
}

export function cwith<I extends Destroyable, R>(res: I, func: (input: I) => R): R {
    try {
        return func(res);
    } finally {
        res.destroy();
    }
}
