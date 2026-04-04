declare module 'pngjs' {
  export class PNG {
    constructor(options?: { width?: number, height?: number })
    width: number
    height: number
    data: Uint8Array
    static sync: {
      read: (buffer: import('node:buffer').Buffer) => PNG
      write: (png: PNG) => import('node:buffer').Buffer
    }
  }
}
