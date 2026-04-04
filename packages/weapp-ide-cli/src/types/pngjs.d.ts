import type { Buffer } from 'node:buffer'

declare module 'pngjs' {
  export class PNG {
    constructor(options?: { width?: number, height?: number })
    width: number
    height: number
    data: Uint8Array
    static sync: {
      read: (buffer: Buffer) => PNG
      write: (png: PNG) => Buffer
    }
  }
}
