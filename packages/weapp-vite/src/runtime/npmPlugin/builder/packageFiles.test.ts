import { describe, expect, it } from 'vitest'
import { createNpmPackageFileMatcher } from './packageFiles'

describe('npm package file matcher', () => {
  it('includes only configured package files', () => {
    const matches = createNpmPackageFileMatcher({
      include: ['dialog/**', 'common/**/*.js'],
    })

    expect(matches('dialog/index.js')).toBe(true)
    expect(matches('common/utils.js')).toBe(true)
    expect(matches('button/index.js')).toBe(false)
  })

  it('applies excludes after includes', () => {
    const matches = createNpmPackageFileMatcher({
      include: ['dialog/**'],
      exclude: ['**/*.d.ts'],
    })

    expect(matches('dialog/index.js')).toBe(true)
    expect(matches('dialog/index.d.ts')).toBe(false)
  })

  it('normalizes Windows path separators', () => {
    const matches = createNpmPackageFileMatcher({
      include: ['dialog/**'],
    })

    expect(matches('dialog\\index.js')).toBe(true)
  })
})
