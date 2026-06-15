import type { RequestGlobalsBlobLike } from './shared'
import { cloneArrayBuffer, cloneArrayBufferView, decodeText, encodeText, isArrayBufferLike, isBlobLike } from './shared'

export type BlobLikePart = RequestGlobalsBlobLike

export type BlobPart = ArrayBuffer | ArrayBufferView | BlobLikePart | string
export type FormDataEntryValue = FilePolyfill | BlobPolyfill | string

interface BlobPropertyBag {
  type?: string
}

interface FilePropertyBag extends BlobPropertyBag {
  lastModified?: number
}

function normalizeBlobPart(part: BlobPart): Promise<ArrayBuffer> {
  if (typeof part === 'string') {
    return Promise.resolve(encodeText(part))
  }
  if (isBlobLike(part)) {
    return part.arrayBuffer()
  }
  if (isArrayBufferLike(part)) {
    return Promise.resolve(cloneArrayBuffer(part))
  }
  if (ArrayBuffer.isView(part)) {
    return Promise.resolve(cloneArrayBufferView(part))
  }
  return Promise.resolve(encodeText(String(part)))
}

export class BlobPolyfill {
  readonly size: number
  readonly type: string
  private readonly parts: BlobPart[]

  constructor(parts: BlobPart[] = [], options?: BlobPropertyBag) {
    this.parts = [...parts]
    this.type = options?.type ?? ''
    this.size = parts.reduce((total, part) => {
      if (typeof part === 'string') {
        return total + String(part).length
      }
      if (part && typeof part === 'object' && typeof (part as BlobLikePart).size === 'number') {
        return total + Number((part as BlobLikePart).size)
      }
      if (isArrayBufferLike(part)) {
        return total + part.byteLength
      }
      if (ArrayBuffer.isView(part)) {
        return total + part.byteLength
      }
      return total
    }, 0)
  }

  async arrayBuffer(): Promise<ArrayBuffer> {
    const buffers: ArrayBuffer[] = await Promise.all(this.parts.map(part => normalizeBlobPart(part)))
    const totalLength: number = buffers.reduce((sum: number, buffer: ArrayBuffer) => sum + buffer.byteLength, 0)
    const merged = new Uint8Array(totalLength)
    let offset = 0
    for (const buffer of buffers) {
      merged.set(new Uint8Array(buffer), offset)
      offset += buffer.byteLength
    }
    return merged.buffer
  }

  async text() {
    return decodeText(await this.arrayBuffer())
  }
}

export class FilePolyfill extends BlobPolyfill {
  readonly lastModified: number
  readonly name: string

  constructor(parts: BlobPart[] = [], name: string, options?: FilePropertyBag) {
    super(parts, options)
    this.name = String(name)
    this.lastModified = options?.lastModified ?? Date.now()
  }

  get [Symbol.toStringTag]() {
    return 'File'
  }
}

function isFileLikePart(value: BlobLikePart): value is BlobLikePart & { lastModified: number, name: string } {
  return typeof (value as { name?: unknown }).name === 'string'
    && typeof (value as { lastModified?: unknown }).lastModified === 'number'
}

function normalizeFormDataValue(value: BlobLikePart | string, filename?: string): FormDataEntryValue {
  if (value instanceof FilePolyfill) {
    if (filename === undefined) {
      return value
    }
    return new FilePolyfill([value], filename, {
      lastModified: value.lastModified,
      type: value.type,
    })
  }

  if (typeof value !== 'string') {
    return new FilePolyfill([value], filename ?? (isFileLikePart(value) ? value.name : 'blob'), {
      lastModified: isFileLikePart(value) ? value.lastModified : undefined,
      type: value.type,
    })
  }

  return String(value)
}

export class FormDataPolyfill {
  private readonly entriesList: Array<[string, FormDataEntryValue]> = []

  append(name: string, value: string): void
  append(name: string, value: BlobLikePart, filename?: string): void
  append(name: string, value: BlobLikePart | string, filename?: string) {
    this.entriesList.push([String(name), normalizeFormDataValue(value, filename)])
  }

  delete(name: string) {
    const normalizedName = String(name)
    let index = this.entriesList.length
    while (index-- > 0) {
      if (this.entriesList[index]?.[0] === normalizedName) {
        this.entriesList.splice(index, 1)
      }
    }
  }

  get(name: string) {
    return this.entriesList.find(entry => entry[0] === String(name))?.[1] ?? null
  }

  getAll(name: string) {
    return this.entriesList
      .filter(entry => entry[0] === String(name))
      .map(entry => entry[1])
  }

  has(name: string) {
    return this.entriesList.some(entry => entry[0] === String(name))
  }

  set(name: string, value: string): void
  set(name: string, value: BlobLikePart, filename?: string): void
  set(name: string, value: BlobLikePart | string, filename?: string) {
    this.delete(name)
    if (typeof value === 'string') {
      this.append(name, value)
      return
    }
    this.append(name, value, filename)
  }

  forEach(callback: (value: FormDataEntryValue, key: string, parent: FormDataPolyfill) => void) {
    for (const [key, value] of this.entriesList) {
      callback(value, key, this)
    }
  }

  * entries() {
    yield* this.entriesList
  }

  * keys() {
    for (const [key] of this.entriesList) {
      yield key
    }
  }

  * values() {
    for (const [, value] of this.entriesList) {
      yield value
    }
  }

  [Symbol.iterator]() {
    return this.entries()
  }

  get [Symbol.toStringTag]() {
    return 'FormData'
  }
}
