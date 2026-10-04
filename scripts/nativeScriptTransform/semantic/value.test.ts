import { runInNewContext } from 'node:vm'
import { describe, expect, it } from 'vitest'
import { createSemanticTools } from './async'
import { snapshotSemanticValue } from './value'

describe('semantic snapshots and async ledger', () => {
  it('retains undefined, sparse slots, nonfinite values and negative zero', () => {
    const values = [undefined, undefined, Number.NaN, Infinity, -Infinity, -0, 2n]
    Reflect.deleteProperty(values, 1)
    expect(snapshotSemanticValue(values)).toEqual({
      type: 'array',
      id: 0,
      values: [
        { type: 'undefined' },
        { type: 'hole' },
        ...['NaN', 'Infinity', '-Infinity', '-0'].map(value => ({ type: 'number', value })),
        { type: 'bigint', value: '2' },
      ],
      properties: [],
    })
    expect(snapshotSemanticValue({ present: undefined })).not.toEqual(snapshotSemanticValue({}))
  })

  it('preserves cyclic aliases and snapshots mutable input immediately', () => {
    const shared: Record<string, unknown> = { value: 1 }
    shared.self = shared
    const ledger = createSemanticTools()
    ledger.tools.record('before', { first: shared, second: shared })
    const before = JSON.stringify(ledger.trace)
    shared.value = 2
    expect(JSON.stringify(ledger.trace)).toBe(before)
    expect(before).toContain('"type":"reference","id":1')
  })

  it('preserves cross-realm errors and causes without unstable stacks', () => {
    const error = runInNewContext('new TypeError("outer", { cause: new Error("inner") })') as unknown
    expect(snapshotSemanticValue(error)).toEqual({
      type: 'error',
      id: 0,
      name: 'TypeError',
      message: 'outer',
      properties: [],
      cause: { type: 'error', id: 1, name: 'Error', message: 'inner', properties: [] },
    })
  })

  it('rejects unsupported observations instead of normalizing away their state', () => {
    expect(() => snapshotSemanticValue(new Map([['value', 1]]))).toThrow('Unsupported semantic object')
    expect(() => snapshotSemanticValue({ [Symbol('value')]: 1 })).toThrow('Enumerable symbol keys')
  })

  it('tracks rejected promises while allowing explicit expected-error assertions', async () => {
    const ledger = createSemanticTools()
    await expect(ledger.tools.track('expected', Promise.reject(new Error('expected')))).rejects.toThrow('expected')
    await ledger.tools.flush()
    expect(ledger.state).toEqual([{
      id: 0,
      label: 'expected',
      status: 'rejected',
      error: { type: 'error', id: 0, name: 'Error', message: 'expected', properties: [] },
    }])
  })
})
