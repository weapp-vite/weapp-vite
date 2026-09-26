import type { BlobLikePart, BlobPolyfill } from './blob'
import { FilePolyfill } from './file'

export type FormDataEntryValue = FilePolyfill | BlobPolyfill | string

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
