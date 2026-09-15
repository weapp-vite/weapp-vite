import type { BlobPart, BlobPropertyBag } from './blob'
import { BlobPolyfill } from './blob'

interface FilePropertyBag extends BlobPropertyBag {
  lastModified?: number
}

export class FilePolyfill extends BlobPolyfill {
  readonly lastModified: number
  private readonly fileName: string

  constructor(parts: BlobPart[] = [], name: string, options?: FilePropertyBag) {
    super(parts, options)
    this.fileName = String(name)
    this.lastModified = options?.lastModified ?? Date.now()
  }

  get name() {
    return this.fileName
  }

  get [Symbol.toStringTag]() {
    return 'File'
  }
}
