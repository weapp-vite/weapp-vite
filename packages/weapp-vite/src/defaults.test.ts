import { describe, expect, it } from 'vitest'
import { getOutputExtensions, getWeappViteConfig } from './defaults'

describe('getWeappViteConfig', () => {
  it('resolves output extensions by platform adapter', () => {
    expect(getOutputExtensions()).toEqual({
      js: 'js',
      json: 'json',
      wxml: 'wxml',
      wxss: 'wxss',
      wxs: 'wxs',
    })
    expect(getOutputExtensions('alipay')).toEqual({
      js: 'js',
      json: 'json',
      wxml: 'axml',
      wxss: 'acss',
      wxs: 'sjs',
    })
    expect(getOutputExtensions('tt')).toEqual({
      js: 'js',
      json: 'json',
      wxml: 'ttml',
      wxss: 'ttss',
    })
  })

  it('defaults hmr.sharedChunks to auto', () => {
    const config = getWeappViteConfig()
    expect(config.hmr?.sharedChunks).toBe('auto')
  })

  it('defaults hmr.touchAppWxss to auto', () => {
    const config = getWeappViteConfig()
    expect(config.hmr?.touchAppWxss).toBe('auto')
  })

  it('keeps additional defaults stable', () => {
    const config = getWeappViteConfig()
    expect(config.isAdditionalWxml?.()).toBe(false)
    expect(config.npm?.alipayNpmMode).toBe('node_modules')
    expect(config.chunks?.sharedStrategy).toBe('duplicate')
  })
})
