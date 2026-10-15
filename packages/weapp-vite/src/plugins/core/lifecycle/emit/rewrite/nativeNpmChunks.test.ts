import type { OutputChunk } from 'rolldown'
import type { NativeNpmChunkAnalysis } from '../../../../../ast'
import MagicString from 'magic-string'
import { describe, expect, it, vi } from 'vitest'
import { applyAtomicMagicStringChunkRewrite } from '../../../../../utils/outputChunk'
import { applyNativeChunkRewrite, createNativeLocalRootNpmEdits, projectNpmChunkAnalysis } from './nativeNpmChunks'

vi.mock('../../../../../utils/outputChunk', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../../../utils/outputChunk')>()
  return { ...actual, applyAtomicMagicStringChunkRewrite: vi.fn(actual.applyAtomicMagicStringChunkRewrite) }
})

describe('native final chunk edit consumption', () => {
  it('projects API offsets after literal replacement and interop removal', () => {
    const code = `require('pkg'); __toESM(dep, 1); wx.request();`
    const analysis: NativeNpmChunkAnalysis = {
      requires: [{ start: 8, end: 13, importee: 'pkg' }],
      platformApiRanges: [{ start: code.indexOf('wx'), end: code.indexOf('wx') + 2 }],
      localRootFacts: [
        { kind: 'require', requireIndex: 0, bindingName: 'dep' },
        { kind: 'interop', referenceName: 'dep', secondArgumentStart: code.indexOf('1'), secondArgumentEnd: code.indexOf('1') + 1 },
      ],
    }
    const edits = createNativeLocalRootNpmEdits(code, analysis, () => '../miniprogram_npm/pkg/index')!
    const magic = new MagicString(code)
    for (const edit of edits) {
      magic.update(edit.start, edit.end, edit.replacement)
    }
    const transformed = magic.toString()
    const projected = projectNpmChunkAnalysis(analysis, edits)!
    expect(transformed).toContain('__toESM(dep)')
    expect(projected.requires).toEqual([])
    expect(projected.localRootFacts).toEqual([])
    const [range] = projected.platformApiRanges
    expect(transformed.slice(range!.start, range!.end)).toBe('wx')
  })

  it('preserves traversal order when interop precedes the require that becomes local', () => {
    const code = `__toESM(dep, 1); require('pkg');`
    const start = code.indexOf('\'pkg\'')
    const analysis: NativeNpmChunkAnalysis = {
      requires: [{ start, end: start + 5, importee: 'pkg' }],
      platformApiRanges: [],
      localRootFacts: [
        { kind: 'interop', referenceName: 'dep', secondArgumentStart: code.indexOf('1'), secondArgumentEnd: code.indexOf('1') + 1 },
        { kind: 'require', requireIndex: 0, bindingName: 'dep' },
      ],
    }
    expect(createNativeLocalRootNpmEdits(code, analysis, () => '../miniprogram_npm/pkg/index')).toEqual([
      { start, end: start + 5, replacement: '"../miniprogram_npm/pkg/index"' },
    ])
  })

  it('rejects overlapping edits instead of projecting stale AST offsets', () => {
    const analysis: NativeNpmChunkAnalysis = { requires: [], localRootFacts: [], platformApiRanges: [{ start: 10, end: 12 }] }
    expect(projectNpmChunkAnalysis(analysis, [{ start: 8, end: 11, replacement: '' }])).toBeUndefined()
    expect(projectNpmChunkAnalysis(analysis, [
      { start: 0, end: 5, replacement: '' },
      { start: 4, end: 7, replacement: '' },
    ])).toBeUndefined()
  })

  it('keeps the original chunk intact when map/code application fails midway', () => {
    const chunk = { code: `require('pkg')`, map: null, fileName: 'pages/index.js', type: 'chunk' } as OutputChunk
    const before = { ...chunk }
    vi.mocked(applyAtomicMagicStringChunkRewrite).mockImplementationOnce(() => {
      throw new Error('map composition failed')
    })

    expect(() => applyNativeChunkRewrite(chunk, new MagicString(chunk.code))).toThrow('map composition failed')
    expect(chunk).toEqual(before)
  })
})
