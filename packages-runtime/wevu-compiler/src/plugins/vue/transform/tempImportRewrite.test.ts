import { describe, expect, it } from 'vitest'
import { rewriteJsLikeImportsForTempDir, rewriteRelativeImportSource } from './tempImportRewrite'

describe('tempImportRewrite', () => {
  it('rewrites relative import source from original directory to temp directory', () => {
    const fromDir = '/project/src/pages'
    const tempDir = '/project/.tmp'

    expect(rewriteRelativeImportSource('./foo', fromDir, tempDir)).toBe('../src/pages/foo')
    expect(rewriteRelativeImportSource('../shared/bar', fromDir, tempDir)).toBe('../src/shared/bar')
    expect(rewriteRelativeImportSource('vue', fromDir, tempDir)).toBe('vue')
  })

  it('rewrites import/export/require/dynamic-import literals in js-like source', () => {
    const source = `
import foo from './foo'
export { helper } from '../shared/helper'
export * from './bar'
const baz = require('./baz')
const mod = import('./mod')
import vue from 'vue'
    `.trim()

    const rewritten = rewriteJsLikeImportsForTempDir(source, '/project/src/pages', '/project/.tmp')

    expect(rewritten).toContain(`import foo from "../src/pages/foo"`)
    expect(rewritten).toContain(`from "../src/shared/helper"`)
    expect(rewritten).toContain(`from "../src/pages/bar"`)
    expect(rewritten).toContain(`require("../src/pages/baz")`)
    expect(rewritten).toContain(`import("../src/pages/mod")`)
    expect(rewritten).toContain(`import vue from 'vue'`)
  })
})
