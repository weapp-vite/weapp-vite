import { describe, expect, it } from 'vitest'
import { normalizeRoot, stripLeadingSlashes, toPosixPath } from './path'

describe('utils/path', () => {
  describe('toPosixPath', () => {
    it('replaces backslashes with forward slashes', () => {
      expect(toPosixPath('a\\b\\c')).toBe('a/b/c')
      expect(toPosixPath('a/b/c')).toBe('a/b/c')
    })
  })

  describe('stripLeadingSlashes', () => {
    it('removes leading path separators', () => {
      expect(stripLeadingSlashes('/pages/index')).toBe('pages/index')
      expect(stripLeadingSlashes('\\pages\\index')).toBe('pages\\index')
      expect(stripLeadingSlashes('///pages/index')).toBe('pages/index')
      expect(stripLeadingSlashes('pages/index')).toBe('pages/index')
      expect(stripLeadingSlashes('')).toBe('')
    })
  })

  describe('normalizeRoot', () => {
    it('normalizes to posix and trims leading/trailing slashes', () => {
      expect(normalizeRoot('/foo/bar/')).toBe('foo/bar')
      expect(normalizeRoot('foo/bar')).toBe('foo/bar')
      expect(normalizeRoot('\\\\foo\\\\bar\\\\')).toBe('foo/bar')
      expect(normalizeRoot('///')).toBe('')
      expect(normalizeRoot('')).toBe('')
    })
  })
})
