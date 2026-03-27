import { describe, expect, it } from 'vitest'
import { resolveBundleOutputExtensions } from './outputExtensions'

describe('bundle output extension helpers', () => {
  it('provides default bundle output extensions', () => {
    expect(resolveBundleOutputExtensions()).toEqual({
      templateExtension: 'wxml',
      styleExtension: 'wxss',
      jsonExtension: 'json',
      scriptExtension: 'js',
      scriptModuleExtension: undefined,
    })
  })

  it('maps platform-specific output extensions into bundle-friendly fields', () => {
    expect(resolveBundleOutputExtensions({
      wxml: 'axml',
      wxss: 'acss',
      json: 'json',
      js: 'mjs',
      wxs: 'sjs',
    })).toEqual({
      templateExtension: 'axml',
      styleExtension: 'acss',
      jsonExtension: 'json',
      scriptExtension: 'mjs',
      scriptModuleExtension: 'sjs',
    })
  })
})
