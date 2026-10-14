import { describe, expect, it } from 'vitest'
import { parseJsLike, traverse } from '../../ast/src/babel'
import { platformApiIdentifiers } from '../../ast/src/operations/platformApi'
import { analyzeNpmChunksNative } from '../index.js'

describe('native final npm chunk facts', () => {
  it.each([
    `const value = require('pkg'); wx.request();`,
    `require(('pkg')); (wx)['request']();`,
    `const emoji = '😀'; require('pkg'); wx?.request(); my['getStorage'](); tt.value = 1;`,
    `require('before'); function shadow(require, wx) { require('local'); wx.request() } wx.request();`,
    `require('before'); const require = local; wx.request();`,
    `var dep = require('pkg'); var alias = dep; helper.__toESM(alias, 1);`,
    `function run() { const { require, wx } = local; require('pkg'); wx.request() } my.request();`,
    `if (ready) { let wx; wx.request() } wx.request();`,
  ])('matches scope-aware Babel literal and API ranges for %j', (code) => {
    const requires: Array<{ start: number, end: number, importee: string }> = []
    const platformApiRanges: Array<{ start: number, end: number }> = []
    traverse(parseJsLike(code), {
      CallExpression(path) {
        const node = path.node
        if (node.callee.type !== 'Identifier' || node.callee.name !== 'require' || path.scope.hasBinding('require')) {
          return
        }
        const argument = node.arguments[0]
        if (argument?.type === 'StringLiteral') {
          requires.push({ start: argument.start!, end: argument.end!, importee: argument.value })
        }
      },
      'MemberExpression|OptionalMemberExpression': function (path) {
        const object = (path.node as { object: { type: string, name: string, start: number, end: number } }).object
        if (object.type === 'Identifier' && platformApiIdentifiers.has(object.name as never) && !path.scope.hasBinding(object.name)) {
          platformApiRanges.push({ start: object.start, end: object.end })
        }
      },
    })
    const [analysis] = analyzeNpmChunksNative([{ code, filename: 'chunk.js' }])
    expect(analysis).not.toBeNull()
    expect(analysis?.requires).toEqual(requires)
    expect(analysis?.platformApiRanges).toEqual(platformApiRanges)
  })

  it('keeps valid neighbors when parsing or UTF-16 conversion fails', () => {
    const plain = `require('pkg'); wx.request();`
    const results = analyzeNpmChunksNative([
      { code: plain },
      { code: 'const =' },
      { code: '\uD800' },
      { code: plain },
    ])
    expect(results[0]).not.toBeNull()
    expect(results[1]).toBeNull()
    expect(results[2]).toBeNull()
    expect(results[3]).toEqual(results[0])
  })

  it('preserves enter order for aliases, direct bindings, and nested relative interop', () => {
    const code = `const dep = require('pkg'); const wrapped = __toESM(dep, 1); const alias = dep; helper.__toESM(alias, 1); __toESM(require('./miniprogram_npm/pkg/index'), 1);`
    const [analysis] = analyzeNpmChunksNative([{ code }])
    expect(analysis?.localRootFacts.map(fact => [
      fact.kind,
      fact.bindingName ?? null,
      fact.referenceName ?? null,
      fact.importee ?? null,
      fact.requireIndex ?? null,
    ])).toEqual([
      ['alias', 'dep', null, 'pkg', null],
      ['require', 'dep', null, null, 0],
      ['interop', null, 'dep', null, null],
      ['alias', 'alias', 'dep', null, null],
      ['interop', null, 'alias', null, null],
      ['interop', null, null, './miniprogram_npm/pkg/index', null],
      ['require', null, null, null, 1],
    ])
  })

  it.each([
    `const dep = require('pkg'); __toESM(dep, (1));`,
    `const dep = require?.('pkg');`,
    `helper?.__toESM(dep, 1);`,
  ])('returns a per-item fallback for unsupported Babel range semantics: %j', (code) => {
    expect(analyzeNpmChunksNative([{ code }])).toEqual([null])
  })
})
