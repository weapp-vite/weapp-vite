import * as upstream from '@weapp-vite/ast/babel'
import { describe, expect, expectTypeOf, it } from 'vitest'
import { observeCompiler } from '../profiling/internal'
import * as observed from './babel'

describe('compiler Babel observation wrappers', () => {
  it('preserves the upstream callable types and shared parser configuration', () => {
    expectTypeOf(observed.parse).toEqualTypeOf(upstream.parse)
    expectTypeOf(observed.parseJsLike).toEqualTypeOf(upstream.parseJsLike)
    expectTypeOf(observed.generate).toEqualTypeOf(upstream.generate)
    expectTypeOf(observed.traverse).toEqualTypeOf(upstream.traverse)
    expect(observed.BABEL_TS_MODULE_PARSER_OPTIONS).toBe(upstream.BABEL_TS_MODULE_PARSER_OPTIONS)
    expect(observed.BABEL_TS_MODULE_PLUGINS).toBe(upstream.BABEL_TS_MODULE_PLUGINS)
    expect(observed.getVisitorKeys).toBe(upstream.getVisitorKeys)
    for (const key of ['parse', 'parseJsLike', 'generate', 'traverse'] as const) {
      expect(observed[key].length).toBe(upstream[key].length)
      expect(Object.keys(observed[key])).toEqual(Object.keys(upstream[key]))
    }
  })

  it('preserves parser options, traversal state and generated source maps', () => {
    const source = 'export const count: number = 1'
    const ast = observed.parse(source, upstream.BABEL_TS_MODULE_PARSER_OPTIONS)
    expect(ast).toStrictEqual(upstream.parse(source, upstream.BABEL_TS_MODULE_PARSER_OPTIONS))
    const state = { identifiers: [] as string[] }
    observed.traverse(ast, {
      Identifier(path, passedState) {
        expect(passedState).toBe(state)
        state.identifiers.push(path.node.name)
      },
    }, undefined, state)
    expect(state.identifiers).toContain('count')
    const options = { sourceMaps: true, sourceFileName: 'input.ts', retainLines: true }
    expect(observed.generate(ast, options, source)).toStrictEqual(upstream.generate(ast, options, source))
  })

  it('counts actual wrapper calls once and keeps parser failures unchanged', () => {
    const profile = observeCompiler(() => {
      const ast = observed.parseJsLike('export const count = 1')
      observed.parse('const answer = 42', upstream.BABEL_TS_MODULE_PARSER_OPTIONS)
      observed.traverse(ast, {})
      return observed.generate(ast).code
    })
    expect(profile.observation.counters).toEqual({ babelParseCalls: 2, babelTraverseCalls: 1, babelGenerateCalls: 1 })
    const failure = (parse: typeof observed.parse) => {
      try {
        parse('const value =', upstream.BABEL_TS_MODULE_PARSER_OPTIONS)
      }
      catch (error) {
        return error
      }
      throw new Error('Expected parser failure')
    }
    const baseline = failure(upstream.parse)
    const result = failure(observed.parse)
    expect(result).toStrictEqual(baseline)
  })
})
