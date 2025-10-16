import { describe, expect, it } from 'vitest'
import { getOutputExtensions } from '@/defaults'

describe('getOutputExtensions', () => {
  it('returns expected extensions for swan (Baidu mini program)', () => {
    const extensions = getOutputExtensions('swan')
    expect(extensions).toEqual({
      js: 'js',
      json: 'json',
      wxml: 'swan',
      wxss: 'css',
      wxs: 'sjs',
    })
  })

  it('returns expected extensions for jd (JD mini program)', () => {
    const extensions = getOutputExtensions('jd')
    expect(extensions).toEqual({
      js: 'js',
      json: 'json',
      wxml: 'jxml',
      wxss: 'jxss',
      wxs: 'wxs',
    })
  })

  it('keeps existing mappings for tt mini program', () => {
    const extensions = getOutputExtensions('tt')
    expect(extensions).toEqual({
      js: 'js',
      json: 'json',
      wxml: 'ttml',
      wxss: 'ttss',
    })
  })
})
