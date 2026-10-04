import { readFileSync } from 'node:fs'
import { addSegment, GenMapping, toEncodedMap } from '@jridgewell/gen-mapping'
import { originalPositionFor, TraceMap } from '@jridgewell/trace-mapping'
import { describe, expect, it, vi } from 'vitest'
import { composeSourceMapForSource, composeSourceMaps } from '../../packages-runtime/wevu-compiler/src/utils/sourcemap'
import { instrumentIntegratedMap, IntegratedMapComposition, integratedMapTarget } from './integratedMap'

describe('diagnostic final source map ownership', () => {
  it('composes the actual native script source while retaining direct template origins', () => {
    const stage = new GenMapping()
    addSegment(stage, 0, 0, 'inline.ts', 0, 0)
    addSegment(stage, 0, 10, 'Page.vue', 0, 15, 'handler')
    const upstream = new GenMapping()
    addSegment(upstream, 0, 0, 'Page.vue', 2, 3, 'setup')
    const mapped = (input: GenMapping) => {
      const value = toEncodedMap(input)
      return { version: value.version, names: [...value.names], sources: value.sources.map((source) => {
        if (source === null) {
          throw new Error('Fixture map unexpectedly has a null source')
        }
        return source
      }), mappings: value.mappings }
    }
    const transformed = mapped(stage)
    const original = mapped(upstream)
    const owner = new IntegratedMapComposition()
    owner.register(transformed)
    const composed = owner.compose(transformed, original, composeSourceMaps, composeSourceMapForSource)!
    const consumer = new TraceMap(JSON.stringify(composed))
    expect(originalPositionFor(consumer, { line: 1, column: 0 })).toMatchObject({ source: 'Page.vue', line: 3, column: 3, name: 'setup' })
    expect(originalPositionFor(consumer, { line: 1, column: 10 })).toMatchObject({ source: 'Page.vue', line: 1, column: 15, name: 'handler' })
    expect(owner.snapshot()).toEqual({ calls: 1, selectiveCalls: 1 })
  })

  it('keeps the original composer for controls, single-source maps and unowned clones', () => {
    const owner = new IntegratedMapComposition()
    const map = { version: 3, names: [], sources: ['inline.ts', 'Page.vue'], mappings: '' }
    owner.register(map)
    const original = vi.fn(() => null)
    const selected = vi.fn(() => null)
    owner.compose({ ...map }, null, original, selected)
    const single = { ...map, sources: ['inline.ts'] }
    owner.register(single)
    owner.compose(single, null, original, selected)
    owner.compose(null, null, original, selected)
    expect(original).toHaveBeenCalledTimes(3)
    expect(selected).not.toHaveBeenCalled()
    expect(owner.snapshot()).toEqual({ calls: 3, selectiveCalls: 0 })
  })

  it('requires the unique actual production import and final composition call', () => {
    const source = readFileSync(new URL(`../../${integratedMapTarget}`, import.meta.url), 'utf8')
    const instrumented = instrumentIntegratedMap(source)
    expect(instrumented).toContain('.maps.compose(transformed.map ?? jsxTransformed.map, scriptMap, composeSourceMaps, composeSourceMapForSource)')
    expect(() => instrumentIntegratedMap(instrumented)).toThrow('anchor changed')
    expect(() => instrumentIntegratedMap(source + source)).toThrow('anchor changed')
  })
})
