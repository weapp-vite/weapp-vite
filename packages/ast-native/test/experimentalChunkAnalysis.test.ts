import type { NodePath } from '@babel/traverse'
import type { CallExpression, MemberExpression, OptionalMemberExpression } from '@babel/types'
import { createRequire } from 'node:module'
import process from 'node:process'
import { parseJsLike, traverse } from '@weapp-vite/ast/babel'
import { describe, expect, it } from 'vitest'

interface Range { start: number, end: number }
interface ChunkFacts {
  requireLiterals: Array<Range & { value: string }>
  platformApiObjects: Range[]
}
interface ExperimentalBinding {
  analyzeChunkRewritesNative: (inputs: Array<{ code: string, filename?: string }>) => ChunkFacts[]
}

const modulePath = process.env.WEAPP_VITE_EXPERIMENTAL_CHUNK_BINDING
const binding = modulePath ? createRequire(import.meta.url)(modulePath) as ExperimentalBinding : undefined
const platformNames = new Set(['wx', 'my', 'tt', 'swan', 'jd', 'xhs'])

function babelFacts(code: string): ChunkFacts {
  const result: ChunkFacts = { requireLiterals: [], platformApiObjects: [] }
  const collectPlatform = (path: NodePath<MemberExpression | OptionalMemberExpression>) => {
    const object = path.node.object
    if (object.type === 'Identifier' && platformNames.has(object.name) && !path.scope.hasBinding(object.name)) {
      result.platformApiObjects.push({ start: object.start!, end: object.end! })
    }
  }
  traverse(parseJsLike(code), {
    CallExpression(path: NodePath<CallExpression>) {
      if (path.node.callee.type !== 'Identifier' || path.node.callee.name !== 'require' || path.scope.hasBinding('require')) {
        return
      }
      const first = path.node.arguments[0]
      const value = first?.type === 'StringLiteral'
        ? first.value
        : first?.type === 'TemplateLiteral' && first.expressions.length === 0 && first.quasis.length === 1
          ? first.quasis[0]!.value.cooked
          : undefined
      if (typeof value === 'string') {
        result.requireLiterals.push({ start: first!.start!, end: first!.end!, value })
      }
    },
    MemberExpression: collectPlatform,
    OptionalMemberExpression: collectPlatform,
  })
  return result
}

const sources = [
  'require("pkg"); wx.request(); my.getStorage(); tt[key]; swan?.showToast(); jd?.[key]?.(); xhs.getSystemInfo()',
  'const dependency = require(`pkg/subpath`); const access = wx.request; wx[key].nested()',
  // eslint-disable-next-line no-template-curly-in-string -- 夹具需要保留待解析的模板表达式。
  'const noStatic = require(dynamic); require(`pkg/${dynamic}`); require.async("pkg"); loader.require("pkg")',
  'require?.("optional"); (require)?.("optional"); require("ordinary")',
  '(require)(("parenthesized")); (wx).request(); ((my))[key]',
  'require("outside"); function child(require, wx) { require("inside"); wx.request(); my.request() } wx.request()',
  'function child() { require("before"); var require; wx.request(); var wx } require("after"); wx.request()',
  'function child() { require("before"); function require() {} wx.request(); function wx() {} }',
  'try { throw 1 } catch (wx) { wx.request(); require("catch") } wx.request()',
  'const { require, wx } = source; require("bound"); wx.request(); my.request()',
  'import require from "loader"; import * as wx from "api"; require("bound"); wx.request(); tt.request()',
  'const closure = function require() { require("self"); wx.request() }; require("global")',
  '{ wx.request(); let wx; require("block") } wx.request()',
  'for (const wx of list) { wx.request(); require("loop") } wx.request()',
  'function defaults(wx = wx.request(), request = my.request()) { wx.request(); require("default") }',
  'const label = "中文😀"; require("包/📦"); wx.request(); require("after")',
  String.raw`r\u0065quire("escaped"); w\u0078.request(); const m\u0079 = local; my.request()`,
  String.raw`require("line\nnext"); require("\u4e2d\u6587"); require("\uD83D\uDE00"); require("\\uD800")`,
  'class Example { #value; read() { return wx.#value } }',
  'const typed = (wx as unknown as { request(): void }).request(); (require as Function)("typed"); require!("non-null")',
  '// require("comment"); wx.request()\nconst text = "require(\\\"string\\\")"; const regex = /wx\\.request/;',
  '"use strict"; (() => { require("inside"); wx.request() })();',
  'const ordinary = 1;',
]

describe.runIf(Boolean(modulePath))('experimental chunk analysis with a real feature-enabled binding', () => {
  it.each(sources)('matches production Babel scope and UTF-16 facts: %s', (code) => {
    expect(binding!.analyzeChunkRewritesNative([{ code, filename: 'chunk.ts' }])).toEqual([babelFacts(code)])
  })

  it('returns compact results in batch input order', () => {
    const inputs = sources.map(code => ({ code, filename: 'chunk.ts' }))
    expect(binding!.analyzeChunkRewritesNative(inputs)).toEqual(sources.map(babelFacts))
    expect(binding!.analyzeChunkRewritesNative([])).toEqual([])
  })

  it.each([undefined, 'chunk.js', 'chunk.mjs', 'chunk.cjs'])('keeps emitted JavaScript semantics for filename %s', (filename) => {
    const code = 'const label = "中文😀"; require("pkg"); wx?.[property]?.()'
    expect(binding!.analyzeChunkRewritesNative([{ code, filename }])).toEqual([babelFacts(code)])
  })

  it.each([
    'const =',
    'let wx; let wx; wx.request()',
    String.raw`require("\uD800")`,
    'require(`\\uDC00`)',
  ])('rejects the whole batch when source cannot be analyzed losslessly: %s', (code) => {
    expect(() => binding!.analyzeChunkRewritesNative([
      { code: 'require("first"); wx.request()' },
      { code },
      { code: 'require("last"); my.request()' },
    ])).toThrow(/Experimental chunk/)
  })
})
