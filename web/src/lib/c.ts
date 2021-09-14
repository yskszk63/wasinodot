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
    memory: WebAssembly.Memory;
    malloc: (size: number) => number;
    free: (ptr: number) => void;
    ptr: number;
    size: number;

    constructor({memory, malloc, free}: CBufferImports, initial: number) {
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
