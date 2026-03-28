import { describe, expect, it } from 'vitest'
import { resolveCompilerOutputExtensions, resolveOutputExtensions } from './outputExtensions'

describe('utils/outputExtensions', () => {
  it('provides shared output extension defaults with optional script module fallback', () => {
    expect(resolveOutputExtensions()).toEqual({
      templateExtension: 'wxml',
      styleExtension: 'wxss',
      jsonExtension: 'json',
      scriptExtension: 'js',
      scriptModuleExtension: undefined,
    })

    expect(resolveOutputExtensions(undefined, {
      scriptModuleExtensionFallback: 'wxs',
    })).toEqual({
      templateExtension: 'wxml',
      styleExtension: 'wxss',
      jsonExtension: 'json',
      scriptExtension: 'js',
      scriptModuleExtension: 'wxs',
    })
  })

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
