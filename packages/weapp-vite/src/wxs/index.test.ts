import { MINI_PROGRAM_PLATFORM_DESCRIPTORS } from '@weapp-core/shared'
import { describe, expect, it } from 'vitest'
import { transformWxsCode } from './index'

describe('transformWxsCode', () => {
  it.each(MINI_PROGRAM_PLATFORM_DESCRIPTORS.map(platform => [platform.id, platform.outputExtensions.wxs ?? 'wxs']))('keeps typed script conversion and module output for %s', (_platform, extension) => {
    const { result, importees } = transformWxsCode(`
      const helper = require('./helper.wxs.ts')
      const count: number = 2
      module.exports = { count, helper }
    `, { extension })
    const output = result?.code ?? ''
    expect(output).not.toContain(': number')
    expect(output).toMatch(new RegExp(`require\\(['"]\\./helper\\.${extension}['"]\\)`))
    expect(importees).toEqual([{ source: './helper.wxs.ts' }])
    if (extension === 'sjs') {
      expect(output).toContain('export default')
      expect(output).not.toContain('module.exports')
    }
    else {
      expect(output).toContain('module.exports')
    }
  })

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

  it('preserves ESM default exports for Alipay SJS', () => {
    const code = `
      export default {
        description: 'Alipay SJS',
      }
    `
    const { result } = transformWxsCode(code, { extension: 'sjs' })
    const output = result?.code ?? ''

    expect(output).toContain('export default')
    expect(output).not.toContain('module.exports')
  })

  it('converts CommonJS default exports for Alipay SJS', () => {
    const code = `
      function label(value) {
        return value || 'unknown'
      }
      module.exports = {
        label: label,
      }
    `
    const { result } = transformWxsCode(code, { extension: 'sjs' })
    const output = result?.code ?? ''

    expect(output).toContain('export default')
    expect(output).not.toContain('module.exports')
  })
})
