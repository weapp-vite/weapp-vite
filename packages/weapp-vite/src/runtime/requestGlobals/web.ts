import { cloneArrayBuffer, cloneArrayBufferView, decodeText, encodeText } from './shared'

type BlobPart = ArrayBuffer | ArrayBufferView | BlobPolyfill | string

function normalizeBlobPart(part: BlobPart) {
  if (typeof part === 'string') {
    return encodeText(part)
  }
  if (part && typeof part === 'object' && typeof (part as BlobPolyfill).arrayBuffer === 'function') {
    return part.arrayBuffer()
  }
  if (part instanceof ArrayBuffer) {
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

  constructor(parts: BlobPart[] = [], options?: { type?: string }) {
    this.parts = [...parts]
    this.type = options?.type ?? ''
    this.size = parts.reduce((total, part) => {
      if (typeof part === 'string') {
        return total + String(part).length
      }
      if (part instanceof BlobPolyfill) {
        return total + part.size
      }
      if (part instanceof ArrayBuffer) {
        return total + part.byteLength
      }
      if (ArrayBuffer.isView(part)) {
        return total + part.byteLength
      }
      return total
    }, 0)
  }

  async arrayBuffer() {
    const buffers = await Promise.all(this.parts.map(part => normalizeBlobPart(part)))
    const totalLength = buffers.reduce((sum, buffer) => sum + buffer.byteLength, 0)
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

type FormDataEntryValue = BlobPolyfill | string

export class FormDataPolyfill {
  private readonly entriesList: Array<[string, FormDataEntryValue]> = []

  append(name: string, value: FormDataEntryValue) {
    this.entriesList.push([String(name), value instanceof BlobPolyfill ? value : String(value)])
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

  set(name: string, value: FormDataEntryValue) {
    this.delete(name)
    this.append(name, value)
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
