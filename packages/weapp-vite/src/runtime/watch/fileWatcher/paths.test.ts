import path from 'pathe'
import { describe, expect, it } from 'vitest'
import { createFileWatchIgnored, normalizeWatchTargets, resolveWatchPath } from './paths'

describe('file watcher path resolution', () => {
  it('resolves relative inputs against the current project directory', () => {
    expect(resolveWatchPath('watch-fixture/src/../config.ts')).toBe(path.resolve('watch-fixture/config.ts'))
  })

  it.each([
    { file: '//server/share/project/src/../config.ts', expected: '//server/share/project/config.ts' },
    { file: '\\\\server\\share\\project\\config.ts', expected: '//server/share/project/config.ts' },
    { file: '\\\\?\\UNC\\server\\share\\project\\config.ts', expected: '//server/share/project/config.ts' },
    { file: '\\\\?\\C:\\project\\config.ts', expected: 'C:/project/config.ts' },
  ])('preserves the absolute root of $file', ({ file, expected }) => {
    expect(resolveWatchPath(file)).toBe(expected)
    expect(normalizeWatchTargets([file, expected])).toEqual([expected])
  })

  it('uses the same UNC identity for literal exclusions', () => {
    const ignored = createFileWatchIgnored('\\\\?\\UNC\\server\\share\\project\\generated')
    expect(ignored('//server/share/project/generated/app.js')).toBe(true)
    expect(ignored('//server/share/project/generated-extra/config.ts')).toBe(false)
    expect(ignored('//other/share/project/generated/app.js')).toBe(false)
  })
})
