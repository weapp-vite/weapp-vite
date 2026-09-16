import type { RequestGlobalsBlobLike } from '../shared'
import { cloneArrayBuffer, cloneArrayBufferView, decodeText, encodeText, isArrayBufferLike, isBlobLike } from '../shared'

export type BlobLikePart = RequestGlobalsBlobLike
export type BlobPart = ArrayBuffer | ArrayBufferView | BlobLikePart | string
export interface BlobPropertyBag {
  type?: string
}

interface Segment {
  source: ArrayBuffer | BlobLikePart
  start: number
  end?: number
}

const segments = new WeakMap<BlobPolyfill, readonly Segment[]>()

/** Blob 的 MIME 类型只接受可打印 ASCII，并按标准转换成小写。 */
export function normalizeBlobType(type: unknown = '') {
  const value = String(type)
  return /[^\x20-\x7E]/.test(value) ? '' : value.toLowerCase()
}

function scalarString(value: string) {
  return value.replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]|[\uD800-\uDFFF]/g, match => match.length === 2 ? match : '\uFFFD')
}

function segmentSize(segment: Segment) {
  return Math.max(0, (segment.end ?? segment.start) - segment.start)
}

function normalizePart(part: BlobPart): readonly Segment[] {
  if (typeof part === 'object' && part !== null && segments.has(part as BlobPolyfill)) {
    return segments.get(part as BlobPolyfill) ?? []
  }
  if (isBlobLike(part)) {
    const size = typeof part.size === 'number' && Number.isFinite(part.size) && part.size >= 0 ? Math.trunc(part.size) : undefined
    return [{ source: part, start: 0, end: size }]
  }
  const source = isArrayBufferLike(part)
    ? cloneArrayBuffer(part)
    : ArrayBuffer.isView(part)
      ? cloneArrayBufferView(part)
      : encodeText(scalarString(String(part)))
  return [{ source, start: 0, end: source.byteLength }]
}

function relativeIndex(value: number, size: number) {
  const number = Number(value)
  const integer = Number.isNaN(number) ? 0 : Math.trunc(number)
  return integer < 0 ? Math.max(size + integer, 0) : Math.min(integer, size)
}

export class BlobPolyfill {
  readonly size: number
  readonly type: string

  constructor(parts: BlobPart[] = [], options?: BlobPropertyBag) {
    const content: Segment[] = []
    for (const part of parts) {
      content.push(...normalizePart(part))
    }
    segments.set(this, content)
    this.size = content.reduce((total, part) => total + segmentSize(part), 0)
    this.type = normalizeBlobType(options?.type)
  }

  async arrayBuffer(): Promise<ArrayBuffer> {
    const buffers = await Promise.all((segments.get(this) ?? []).map(async (part) => {
      const buffer = isArrayBufferLike(part.source) ? part.source : await part.source.arrayBuffer()
      const end = Math.min(part.end ?? buffer.byteLength, buffer.byteLength)
      const start = Math.min(part.start, end)
      return new Uint8Array(buffer, start, end - start)
    }))
    const length = buffers.reduce((total, part) => total + part.byteLength, 0)
    const merged = new Uint8Array(length)
    let offset = 0
    for (const buffer of buffers) {
      merged.set(buffer, offset)
      offset += buffer.byteLength
    }
    return merged.buffer
  }

  async bytes(): Promise<Uint8Array<ArrayBuffer>> {
    return new Uint8Array(await this.arrayBuffer())
  }

  async text(): Promise<string> {
    return decodeText(await this.arrayBuffer())
  }

  slice(start = 0, end = this.size, contentType = ''): BlobPolyfill {
    const first = relativeIndex(start, this.size)
    const last = relativeIndex(end, this.size)
    const sliced: Segment[] = []
    let offset = 0
    for (const part of segments.get(this) ?? []) {
      const length = segmentSize(part)
      const from = Math.max(first - offset, 0)
      const to = Math.min(last - offset, length)
      if (from < to) {
        sliced.push({ source: part.source, start: part.start + from, end: part.start + to })
      }
      offset += length
      if (offset >= last) {
        break
      }
    }
    const result = new BlobPolyfill([], { type: contentType })
    segments.set(result, sliced)
    Object.defineProperty(result, 'size', { value: Math.max(last - first, 0), enumerable: true })
    return result
  }

  get [Symbol.toStringTag]() {
    return 'Blob'
  }
}
