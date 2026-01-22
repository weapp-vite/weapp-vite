import { describe, expect, it } from 'vitest'
import { normalizeWxsFilename } from './utils'

describe('normalizeWxsFilename', () => {
  it.each([
    ['./foo/bar.wxs', 'sjs', './foo/bar.sjs'],
    ['./foo/bar.sjs', 'wxs', './foo/bar.wxs'],
    ['./foo/bar.wxs.ts', 'sjs', './foo/bar.sjs'],
    ['./foo/bar.sjs.ts', 'sjs', './foo/bar.sjs'],
    ['./foo/bar.ts', 'wxs', './foo/bar.wxs'],
    ['./foo/bar', 'wxs', './foo/bar.wxs'],
  ])('normalizes %s to %s extension', (value, extension, expected) => {
    expect(normalizeWxsFilename(value, extension)).toBe(expected)
  })
})
