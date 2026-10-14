import type { VueTransformResult } from '../../packages-runtime/wevu-compiler/src/index'
import { describe, expect, it, vi } from 'vitest'
import { captureError, measureRealEntry } from './entry'
import { assertExactParity } from './results'

describe('actual awaited compiler entry contract', () => {
  it('calls one public entry with the unchanged source and filename, and awaits complete style work', async () => {
    let finish: (result: VueTransformResult) => void = () => {}
    const compile = vi.fn(async (_source, _filename, options) => {
      options.warn('first')
      options.autoUsingComponents.warn('second')
      return await new Promise<VueTransformResult>((resolve) => {
        finish = resolve
      })
    })
    const source = '<template><view/></template>'
    const filename = 'src/pages/index.vue'
    let settled = false
    const measured = measureRealEntry(compile, source, filename, { sourceMap: true, autoUsingComponents: { enabled: true } }).then((result) => {
      settled = true
      return result
    })
    expect(settled).toBe(false)
    finish({ script: 'Page({})', style: '.x {}', scriptMap: { version: 3, sources: ['src/pages/index.vue'], sourcesContent: [source], names: [], mappings: 'AAAA' } })
    const result = await measured
    expect(compile).toHaveBeenCalledOnce()
    expect(compile.mock.calls[0]?.slice(0, 2)).toEqual([source, filename])
    expect(result.outcome).toMatchObject({ status: 'success', result: { style: '.x {}' }, warnings: ['first', 'second'] })
    expect(result.compileMs).toBeGreaterThanOrEqual(0)
  })

  it('compares original maps, sourcesContent, warning order and undefined fields without normalization', () => {
    const baseline = { status: 'success', result: { scriptMap: { mappings: 'AAAA', sourcesContent: ['original'] }, optional: undefined }, warnings: ['a', 'b'] } as const
    for (const actual of [
      { ...baseline, warnings: ['b', 'a'] },
      { ...baseline, result: { ...baseline.result, scriptMap: { mappings: 'AAAB', sourcesContent: ['original'] } } },
      { ...baseline, result: { scriptMap: baseline.result.scriptMap } },
    ]) {
      expect(() => assertExactParity(baseline as never, actual as never, 'fixture')).toThrow('Exact compiler parity')
    }
  })

  it('preserves diagnostic code/location and nested cause while excluding unstable stack frames', async () => {
    const cause = Object.assign(new Error('parse failure'), { code: 'PARSE', loc: { line: 3, column: 4 } })
    const error = new Error('compile failure', { cause })
    const compile = vi.fn(async () => {
      throw error
    })
    const result = await measureRealEntry(compile, 'invalid', 'src/index.vue', {})
    expect(result.outcome).toMatchObject({ status: 'error', error: { name: 'Error', message: 'compile failure', cause: { code: 'PARSE', loc: { line: 3, column: 4 } } } })
    expect(captureError(error)).not.toHaveProperty('stack')
  })
})
