import { describe, expect, it } from 'vitest'
import { resolveCompilerOutputExtensions } from './outputExtensions'

describe('utils/outputExtensions', () => {
  it('provides default compiler output extensions', () => {
    expect(resolveCompilerOutputExtensions()).toEqual({
      templateExtension: 'wxml',
      styleExtension: 'wxss',
      jsonExtension: 'json',
      scriptExtension: 'js',
      scriptModuleExtension: 'wxs',
    })
  })

  it('maps explicit platform output extensions', () => {
    expect(resolveCompilerOutputExtensions({
      wxml: 'axml',
      wxss: 'acss',
      json: 'json5',
      js: 'mjs',
      wxs: 'sjs',
    })).toEqual({
      templateExtension: 'axml',
      styleExtension: 'acss',
      jsonExtension: 'json5',
      scriptExtension: 'mjs',
      scriptModuleExtension: 'sjs',
    })
  })
})
