import type { ChunkInput } from './rewrite'

const cases = [
  'const dep = require("ui-lib"); wx.getStorageSync("key")',
  'const dep = require(`ui-lib/button`); my["alert"]({})',
  'const dep = require("./relative"); tt?.showToast({})',
  'const text = "中文😀"; wx.a(); require("ui-lib"); my.b()',
  'function scoped(require, wx) { require("ui-lib"); wx.a() } my.b()',
  'function scoped() { wx.a(); var wx; require("ui-lib"); var require }',
  'try { fail() } catch ({ wx, require }) { wx.a(); require("ui-lib") } tt.b()',
  'const { wx: host } = {}; wx.a(); host.a(); require("ui-lib")',
  '{ let wx; wx.a() } wx.b(); require("ui-lib")',
  'const wx = {}; wx.a(); require("ui-lib")',
  String.raw`const text = "\u{1f600}"; \u0077x.a(); require("ui-lib")`,
  String.raw`function scoped(\u0077x) { \u0077x.a() } require("ui-lib")`,
  String.raw`w\u0078.a()`,
  String.raw`r\u0065quire("ui-lib")`,
  '(wx).a(); (require)("ui-lib")',
  'require?.("ui-lib"); wx?.a?.(); swan["showToast"]({})',
  'require /* comment */ ("ui-lib"); wx /* comment */ .a()',
  'const dep = require("ui-lib", () => my.a()); xhs.a()',
  'require("ui-lib"); jd[wx.a()](); wx.a.b()',
  'const text = "wx.a(); require(\\"ui-lib\\")"; /* wx.a(); */',
  'import wx from "host"; wx.a(); require("ui-lib")',
  'const call = (wx = my) => wx.a(); require("ui-lib")',
  'class Host { wx = wx.a(); method(require) { return require("ui-lib") } }',
  'for (const wx of list) { wx.a() } wx.b(); require("ui-lib")',
  'function require() {} require("ui-lib"); wx.a()',
  'const empty = true',
]

/** 小型语义语料与合成大块都明确标记；不替代真实工程端到端样本。 */
export function createChunkFixtures(): ChunkInput[] {
  return cases.map((code, index) => ({ code, filename: `semantic/case-${index}.js` }))
}
