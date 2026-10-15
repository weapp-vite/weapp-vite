import { describe, expect, it } from 'vitest'
import { readNativeNpmChunkAnalysis } from './npmChunks'

const code = `require('pkg'); wx.request();`
const valid = {
  requires: [{ start: 8, end: 13, importee: 'pkg' }],
  platformApiRanges: [{ start: 16, end: 18 }],
  localRootFacts: [{ kind: 'require', requireIndex: 0 }],
}

describe('native npm chunk result validation', () => {
  it('copies a valid snapshot without retaining binding-owned arrays or objects', () => {
    const result = readNativeNpmChunkAnalysis(valid, code)
    expect(result).toEqual(valid)
    expect(result?.requires).not.toBe(valid.requires)
    expect(result?.requires[0]).not.toBe(valid.requires[0])
  })

  it.each([
    { ...valid, requires: [null] },
    { ...valid, requires: [{ start: 8, end: 13, importee: 'wrong' }] },
    { ...valid, platformApiRanges: [{ start: 0, end: 2 }] },
    { ...valid, localRootFacts: [] },
    { ...valid, localRootFacts: [{ kind: 'require', requireIndex: 1 }] },
    { ...valid, localRootFacts: [{ kind: 'require', requireIndex: 0 }, { kind: 'require', requireIndex: 0 }] },
    { ...valid, localRootFacts: [{ kind: 'interop', referenceName: 'dep', secondArgumentStart: 0, secondArgumentEnd: 1 }] },
    { ...valid, platformApiRanges: [{ start: 16, end: 18 }, { start: 16, end: 18 }] },
  ])('rejects malformed facts without accepting a partial summary', (value) => {
    expect(readNativeNpmChunkAnalysis(value, code)).toBeUndefined()
  })

  it('rejects sparse arrays and throwing getters', () => {
    const sparse = { ...valid, requires: Array.from({ length: 1 }) }
    expect(readNativeNpmChunkAnalysis(sparse, code)).toBeUndefined()
    expect(readNativeNpmChunkAnalysis({
      get requires() {
        throw new Error('binding read')
      },
    }, code)).toBeUndefined()
    const invalidLength = new Proxy([], { get: (_target, key) => key === 'length' ? Number.NaN : undefined })
    expect(readNativeNpmChunkAnalysis({ ...valid, requires: invalidLength }, code)).toBeUndefined()
  })

  it('reads a native fact getter once before storing a plain snapshot', () => {
    let reads = 0
    const fact = {
      start: 8,
      end: 13,
      get importee() {
        return ++reads === 1 ? 'pkg' : 'wrong'
      },
    }
    const result = readNativeNpmChunkAnalysis({ ...valid, requires: [fact] }, code)
    expect(result?.requires[0]?.importee).toBe('pkg')
    expect(reads).toBe(1)
  })
})
