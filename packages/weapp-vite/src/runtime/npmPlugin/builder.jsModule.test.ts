import { describe, expect, it } from 'vitest'

import { transformJsModuleToCjs } from './builder/jsModule'

describe('runtime npm builder js module transform', () => {
  it('does not export function parameters when converting named function exports', async () => {
    const output = await transformJsModuleToCjs([
      'export function isFunction(t) {',
      '  return typeof t === "function"',
      '}',
      'export function isDate(t, e) {',
      '  return Boolean(t || e)',
      '}',
    ].join('\n'), {
      markEsModule: true,
    })

    expect(output).toContain('__esModule')
    expect(output).toContain('exports.isFunction = isFunction')
    expect(output).toContain('exports.isDate = isDate')
    expect(output).not.toContain('exports.t = t')
    expect(output).not.toContain('exports.e = e')
  })
})
