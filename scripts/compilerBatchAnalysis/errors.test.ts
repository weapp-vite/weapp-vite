import { isDeepStrictEqual } from 'node:util'
import { deserialize, serialize } from 'node:v8'
import { parse } from '@babel/parser'
import { describe, expect, it } from 'vitest'
import { CompilerDiagnosticError } from '../../packages-runtime/wevu-compiler/src/types/diagnostics'
import { errorEvidence } from './errors'

function parserError(source = 'const value =') {
  try {
    parse(source, { sourceType: 'module', plugins: ['typescript'] })
  }
  catch (error) {
    if (error instanceof SyntaxError) {
      return error as SyntaxError & { clone: (...args: unknown[]) => SyntaxError, loc: unknown, pos: number }
    }
    throw error
  }
  throw new Error('Expected invalid script to produce a Babel SyntaxError')
}

describe('compiler error evidence', () => {
  it('retains the production diagnostic class, location, cause and property descriptors', () => {
    const diagnostic = { code: 'WV2001', severity: 'error', message: 'invalid v-for', filename: 'src/page.vue', source: 'template', loc: { start: { offset: 2, line: 1, column: 3 }, end: { offset: 7, line: 1, column: 8 } } } as const
    const first = new CompilerDiagnosticError(diagnostic, { cause: new Error('underlying') })
    const second = new CompilerDiagnosticError(diagnostic, { cause: new Error('underlying') })
    const evidence = errorEvidence(first)
    expect(isDeepStrictEqual(evidence, errorEvidence(second))).toBe(true)
    expect(isDeepStrictEqual(evidence, deserialize(serialize(evidence)))).toBe(true)
    expect(evidence).toMatchObject({
      prototype: { name: 'CompilerDiagnosticError', parent: 'Error', source: Function.prototype.toString.call(CompilerDiagnosticError) },
      fields: { name: 'CompilerDiagnosticError', code: 'WV2001', severity: 'error', filename: 'src/page.vue', source: 'template', cause: { fields: { message: 'underlying' } }, loc: { fields: { start: { fields: diagnostic.loc.start }, end: { fields: diagnostic.loc.end } } } },
      descriptors: { message: { writable: true, enumerable: false, configurable: true }, code: { writable: true, enumerable: true, configurable: true } },
    })
    Object.defineProperty(second, 'code', { writable: false })
    expect(isDeepStrictEqual(evidence, errorEvidence(second))).toBe(false)
    class UnknownDiagnosticError extends Error {}
    expect(() => errorEvidence(new UnknownDiagnosticError('unsupported'))).toThrow('Unsupported error object prototype')
  })

  it('compares independent Babel errors and survives private V8 serialization', () => {
    const first = parserError()
    const second = parserError()
    expect(first.clone).not.toBe(second.clone)
    const evidence = errorEvidence(first)
    expect(isDeepStrictEqual(evidence, errorEvidence(second))).toBe(true)
    expect(isDeepStrictEqual(evidence, deserialize(serialize(evidence)))).toBe(true)
    expect(evidence).toMatchObject({
      prototype: { name: 'SyntaxError' },
      descriptors: { clone: { writable: false, enumerable: false, configurable: true } },
      fields: {
        code: 'BABEL_PARSER_SYNTAX_ERROR',
        reasonCode: 'UnexpectedToken',
        syntaxPlugin: undefined,
        loc: { fields: { line: 1, column: 13, index: 13 } },
        details: { fields: { expected: null } },
        clone: {
          kind: 'babel-parser-clone',
          function: { name: 'clone', arity: 0, source: Function.prototype.toString.call(first.clone), prototype: { constructor: 'self' } },
          probes: [
            { fields: { message: 'Unexpected token (1:13)', loc: { fields: { line: 1, column: 13 } } } },
            { fields: { message: 'Unexpected token (7:9)', loc: { fields: { line: 7, column: 9 } } } },
            { fields: { details: { fields: { expected: 'compiler-batch-clone-probe' } } } },
          ],
        },
      },
    })
  })

  it('detects different captured clone locations despite equal outer fields and function source', () => {
    const first = parserError()
    const second = parserError('const value =\n')
    second.loc = first.loc
    second.pos = first.pos
    second.message = first.message
    expect(Function.prototype.toString.call(first.clone)).toBe(Function.prototype.toString.call(second.clone))
    expect(Object.keys(first).map(key => [key, Reflect.get(first, key)])).toEqual(Object.keys(second).map(key => [key, Reflect.get(second, key)]))
    expect(isDeepStrictEqual(errorEvidence(first), errorEvidence(second))).toBe(false)
  })

  it.each(['code', 'loc', 'diagnostics'])('detects changed %s metadata', (key) => {
    const first = Object.assign(new Error('invalid template'), { code: 'WV2001', loc: { line: 1, column: 1 }, diagnostics: [] })
    const second = Object.assign(new Error('invalid template'), { code: 'WV2001', loc: { line: 1, column: 1 }, diagnostics: [] })
    Object.assign(second, { [key]: key === 'code' ? 'WV2002' : key === 'loc' ? { line: 2, column: 3 } : [{ message: 'changed' }] })
    expect(isDeepStrictEqual(errorEvidence(first), errorEvidence(second))).toBe(false)
  })

  it('retains nested metadata, cycles, collections and non-error fields named stack', () => {
    const error = new Error('failure', { cause: new Error('cause') })
    const metadata = { stack: 'semantic payload', optional: undefined }
    Object.assign(error, { self: error, metadata, values: new Map([['entry', new Set([metadata])]]) })
    const first = errorEvidence(error)
    error.stack = 'different process stack'
    expect(isDeepStrictEqual(first, errorEvidence(error))).toBe(true)
    expect(isDeepStrictEqual(first, deserialize(serialize(first)))).toBe(true)
    expect(first).toMatchObject({ fields: { cause: { fields: { message: 'cause' } }, metadata: { fields: metadata } } })
  })

  it('distinguishes property descriptors, prototypes, sparse arrays and extra array fields', () => {
    const first = parserError()
    const second = parserError()
    Object.defineProperty(second, 'clone', { enumerable: true })
    expect(isDeepStrictEqual(errorEvidence(first), errorEvidence(second))).toBe(false)
    expect(isDeepStrictEqual(errorEvidence({}), errorEvidence(Object.create(null)))).toBe(false)
    expect(isDeepStrictEqual(errorEvidence(Array.from({ length: 1 })), errorEvidence(Array.from({ length: 0 })))).toBe(false)
    const sparse: unknown[] = []
    sparse.length = 1
    expect(isDeepStrictEqual(errorEvidence([undefined]), errorEvidence(sparse))).toBe(false)
    expect(isDeepStrictEqual(errorEvidence([]), errorEvidence(Object.assign([], { diagnostic: 'extra' })))).toBe(false)
  })

  it('rejects unsupported callable or symbol metadata instead of dropping it', () => {
    expect(() => errorEvidence(Object.assign(new Error('failure'), { helper: () => 1 }))).toThrow('Unsupported callable')
    expect(() => errorEvidence(Object.assign(new Error('failure'), { [Symbol('diagnostic')]: 1 }))).toThrow('Unsupported symbol')
    const error = parserError()
    Object.assign(error.clone.prototype, { extra: true })
    expect(() => errorEvidence(error)).toThrow('Unsupported Babel clone')
  })
})
