import { describe, expect, it } from 'vitest'
import { transformWxsCode } from './index'

describe('transformWxsCode', () => {
  it('rewrites require extensions to target script module extension', () => {
    const code = `
      const foo = require('./utils.wxs')
      const bar = require('./plain')
    `
    const { result } = transformWxsCode(code, { extension: 'sjs' })
    const output = result?.code ?? ''

    expect(output).toMatch(/require\(['"]\.\/utils\.sjs['"]\)/)
    expect(output).toMatch(/require\(['"]\.\/plain\.sjs['"]\)/)
  })

  it('defaults to wxs when no extension override', () => {
    const code = `
      const foo = require('./utils')
    `
    const { result } = transformWxsCode(code)
    const output = result?.code ?? ''

    expect(output).toMatch(/require\(['"]\.\/utils\.wxs['"]\)/)
  })
})
