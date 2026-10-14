import type { OutputChunk } from 'rolldown'
import { originalPositionFor, TraceMap } from '@jridgewell/trace-mapping'
import MagicString from 'magic-string'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { parseJsLike } from '../../../../../../utils/babel'
import { rewriteChunkNpmImportsToLocalRoot } from '../localRoot'

vi.mock('../../../../../../utils/babel', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../../../../utils/babel')>()
  return { ...actual, parseJsLike: vi.fn(actual.parseJsLike) }
})

function createChunk(code: string): OutputChunk {
  return { code, fileName: 'pkg-a/pages/index.js', imports: [], moduleIds: [], map: null, type: 'chunk' } as unknown as OutputChunk
}

function rewrite(code: string, patterns?: (string | RegExp)[], dependencies: Record<string, string> = { 'ui-lib': '1.0.0' }) {
  const chunk = createChunk(code)
  rewriteChunkNpmImportsToLocalRoot(chunk, 'pkg-a', patterns, dependencies, { collectPlatformApiAccess: false })
  return chunk
}

describe('local root conservative candidate semantics', () => {
  beforeEach(() => {
    vi.mocked(parseJsLike).mockClear()
    vi.stubEnv('WEAPP_VITE_NATIVE', '0')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it.each([
    ['escaped identifier', String.raw`const required = true; const dep = \u0072equire('ui-lib/button')`],
    ['escaped full identifier', String.raw`const required = true; const dep = \u{72}\u{65}\u{71}\u{75}\u{69}\u{72}\u{65}('ui-lib/button')`],
    ['hex literal', String.raw`const dep = require('\x75i-lib/button')`],
    ['unicode literal', String.raw`const dep = require('u\u0069-lib/button')`],
    ['static template', 'const dep = require(`ui-lib/button`)'],
  ])('rewrites %s through the existing AST path', (_name, code) => {
    const chunk = rewrite(code)
    expect(chunk.code).toContain('"../miniprogram_npm/ui-lib/button"')
    expect(parseJsLike).toHaveBeenCalledTimes(1)
  })

  it('does not infer require absence from ordinary regex backslashes when a require identifier exists', () => {
    const code = String.raw`const matcher = /\B/; const dep = require('./relative')`
    const chunk = rewrite(code)
    expect(chunk.code).toBe(code)
    expect(parseJsLike).toHaveBeenCalledTimes(1)
  })

  it.each([
    ['@scope//pkg', '@scope///pkg/button', '@scope/pkg/button'],
    ['/ui-lib//', 'ui-lib///button', 'ui-lib/button'],
    [String.raw`@scope\pkg`, '@scope/pkg/button', '@scope/pkg/button'],
  ])('retains fallback matching for dependency %s', (dependency, importee, target) => {
    const chunk = rewrite(`const dep = require('${importee}')`, undefined, { [dependency]: '1.0.0' })
    expect(chunk.code).toContain(`"../miniprogram_npm/${target}"`)
    expect(parseJsLike).toHaveBeenCalledTimes(1)
  })

  it.each([
    ['@scope/pkg', '@scope///pkg/button', '@scope/pkg/button'],
    ['ui-lib//button', 'ui-lib//button/icon', 'ui-lib/button/icon'],
  ])('retains string pattern matching for %s', (pattern, importee, target) => {
    const chunk = rewrite(`const dep = require('${importee}')`, [pattern], {})
    expect(chunk.code).toContain(`"../miniprogram_npm/${target}"`)
  })

  it.each([/^ui-lib$/, /^ui-lib\/button/g])('falls back for regular expression pattern %s', (pattern) => {
    pattern.lastIndex = 100
    const chunk = rewrite(`const dep = require('ui-lib/button')`, [pattern], {})
    expect(chunk.code).toContain('"../miniprogram_npm/ui-lib/button"')
    expect(parseJsLike).toHaveBeenCalledTimes(1)
  })

  it('keeps the original traversal for an unrelated require with a RegExp scope', () => {
    const code = `const dep = require('./relative')`
    expect(rewrite(code, [/^ui-lib$/], {}).code).toBe(code)
    expect(parseJsLike).toHaveBeenCalledTimes(1)
  })

  it('keeps unknown string scopes on the original path', () => {
    const code = `const dep = require('./relative')`
    expect(rewrite(code, ['./ui-lib'], {}).code).toBe(code)
    expect(parseJsLike).toHaveBeenCalledTimes(1)
  })

  it('preserves localized interop removal across variable and assignment aliases', () => {
    const code = [
      `const direct = require('../miniprogram_npm/other-lib/button')`,
      `const alias = direct`,
      `let assigned; assigned = alias`,
      `const first = __toESM(assigned, 1)`,
      `const second = helpers.__toESM(require('../miniprogram_npm/other-lib/button'), 1)`,
    ].join('\n')
    const chunk = rewrite(code)

    expect(chunk.code).toContain(`__toESM(assigned)`)
    expect(chunk.code).toContain(`helpers.__toESM(require('../miniprogram_npm/other-lib/button'))`)
    expect(chunk.code).not.toContain(', 1)')
    expect(parseJsLike).toHaveBeenCalledTimes(1)
  })

  it('rewrites assignment requires and drops interop without consulting imports or moduleIds', () => {
    const chunk = rewrite(`let dep; dep = require('ui-lib/button'); const wrapped = __toESM(dep, 1)`)
    expect(chunk.imports).toEqual([])
    expect(chunk.moduleIds).toEqual([])
    expect(chunk.code).toContain('require("../miniprogram_npm/ui-lib/button")')
    expect(chunk.code).toContain('__toESM(dep)')
  })

  it('leaves shadowed require and its interop unchanged', () => {
    const code = `function local(require) { const dep = require('ui-lib/button'); return __toESM(dep, 1) }`
    expect(rewrite(code).code).toBe(code)
    expect(parseJsLike).toHaveBeenCalledTimes(1)
  })

  it.each([
    ['npm protocol', 'npm:ui-lib/button'],
    ['absolute npm root', '/miniprogram_npm/ui-lib/button'],
    ['absolute node_modules', '/workspace/node_modules/ui-lib/button'],
  ])('retains normalization of %s', (_name, importee) => {
    expect(rewrite(`const dep = require('${importee}')`).code).toContain('"../miniprogram_npm/ui-lib/button"')
  })

  it('preserves original source positions when a candidate is rewritten', () => {
    const code = `const dep = require('ui-lib/button')\nconst rewriteMarker = dep`
    const chunk = createChunk(code)
    chunk.map = new MagicString(code).generateMap({ hires: true, includeContent: true, source: 'src/pages/index.ts' }) as any
    rewriteChunkNpmImportsToLocalRoot(chunk, 'pkg-a', undefined, { 'ui-lib': '1.0.0' }, { collectPlatformApiAccess: false })

    const markerPrefix = chunk.code.slice(0, chunk.code.indexOf('rewriteMarker'))
    expect(originalPositionFor(new TraceMap(chunk.map as any), {
      line: markerPrefix.split('\n').length,
      column: markerPrefix.length - markerPrefix.lastIndexOf('\n') - 1,
    })).toMatchObject({ source: 'src/pages/index.ts', line: 2, column: 6 })
  })
})
