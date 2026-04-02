import { describe, expect, it } from 'vitest'
import {
  fromPosixPath,
  isPathInside,
  normalizePath,
  normalizeRelativePath,
  normalizeRoot,
  normalizeWatchPath,
  stripLeadingSlashes,
  toPosixPath,
} from './path'

describe('path utils', () => {
  it('normalizes path and slash styles', () => {
    expect(toPosixPath('a\\b\\c')).toBe('a/b/c')
    expect(fromPosixPath('a/b/c')).toContain('a')
    expect(normalizePath('C:\\project\\src\\..\\index.ts')).toContain('C:/project/index.ts')
    expect(normalizeRelativePath('')).toBe('')
    expect(normalizeRelativePath('./a/../b')).toBe('b')
    expect(normalizeWatchPath('C:\\project\\src\\index.ts')).toContain('project')
  })

  it('handles root and containment helpers', () => {
    expect(stripLeadingSlashes('///a/b')).toBe('a/b')
    expect(normalizeRoot('/a//b///')).toBe('a/b')

    expect(isPathInside('/project/src', '/project/src/pages/index.ts')).toBe(true)
    expect(isPathInside('/project/src', '/project/other/index.ts')).toBe(false)
    expect(isPathInside(undefined, '/project/src/index.ts')).toBe(false)
  })
})
