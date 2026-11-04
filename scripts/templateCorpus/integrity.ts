import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'

export function corpusHash(value: string | Uint8Array): string {
  return createHash('sha256').update(value).digest('hex')
}

/** 递归排序对象键，保留所有有语义的数组顺序。 */
export function corpusJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(corpusJson).join(',')}]`
  }
  if (value && typeof value === 'object') {
    return `{${Object.entries(value).filter(([, item]) => item !== undefined).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([key, item]) => `${JSON.stringify(key)}:${corpusJson(item)}`).join(',')}}`
  }
  assert.ok(typeof value !== 'number' || Number.isFinite(value), 'Corpus metadata must contain only finite numbers')
  const serialized = JSON.stringify(value)
  assert.ok(serialized !== undefined, 'Corpus metadata must contain only JSON values')
  return serialized
}
