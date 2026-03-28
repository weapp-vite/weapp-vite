import { describe, expect, it } from 'vitest'
import {
  fromPosixPath,
  isPathInside,
  normalizePath,
  normalizeRelativePath,
  normalizeRoot,
  normalizeWatchPath,
  stripLeadingSlashes,
  stripWindowsDevicePath,
  toPosixPath,
} from './path'

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

  describe('normalizePath', () => {
    it('normalizes to posix separators', () => {
      expect(normalizePath('a\\\\b\\\\c')).toBe('a/b/c')
      expect(normalizePath('a/b/c')).toBe('a/b/c')
      expect(normalizePath('')).toBe('')
      expect(stripWindowsDevicePath('\\\\?\\C:\\project\\src')).toBe('C:\\project\\src')
      expect(stripWindowsDevicePath('\\\\?\\UNC\\server\\share\\src')).toBe('\\\\server\\share\\src')
      expect(stripWindowsDevicePath('C:\\project\\src')).toBe('C:\\project\\src')
    })
  })

  describe('normalizeRelativePath', () => {
    it('keeps empty relative paths', () => {
      expect(normalizeRelativePath('')).toBe('')
      expect(normalizeRelativePath('pages\\index')).toBe('pages/index')
    })
  })

  describe('normalizeWatchPath', () => {
    it('normalizes device paths for watcher compatibility', () => {
      expect(normalizeWatchPath('\\\\?\\C:\\project\\src\\pages')).toBe('C:/project/src/pages')
      expect(normalizeWatchPath('pages\\index')).toBe('pages/index')
      expect(normalizeWatchPath('')).toBe('')
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

  describe('path boundary helpers', () => {
    it('converts posix paths to native form and checks parent-child containment', () => {
      expect(fromPosixPath('pages/index')).toBe('pages/index')
      expect(isPathInside('/project/src', '/project/src/pages/index.ts')).toBe(true)
      expect(isPathInside('/project/src', '/project/other/index.ts')).toBe(false)
      expect(isPathInside(undefined, '/project/src/pages/index.ts')).toBe(false)
    })
  })
})
