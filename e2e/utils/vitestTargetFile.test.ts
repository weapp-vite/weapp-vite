import path from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { E2E_TARGET_FILE_ENV, resolveVitestIncludePatterns } from './vitestTargetFile'

describe('resolveVitestIncludePatterns', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('returns default patterns when target file env is absent', () => {
    const result = resolveVitestIncludePatterns('C:/repo/e2e', [
      'C:/repo/e2e/ide/**/*.test.ts',
      'C:/repo/e2e/ci/**/*.test.ts',
    ])

    expect(result).toEqual([
      'C:/repo/e2e/ide/**/*.test.ts',
      'C:/repo/e2e/ci/**/*.test.ts',
    ])
  })

  it('resolves relative target files against the e2e base dir', () => {
    vi.stubEnv(E2E_TARGET_FILE_ENV, 'ide/index.test.ts')

    const result = resolveVitestIncludePatterns('C:/repo/e2e', [
      'C:/repo/e2e/ide/**/*.test.ts',
    ])

    expect(result).toEqual([
      'C:/repo/e2e/ide/index.test.ts',
    ])
  })

  it('normalizes absolute Windows target files to posix separators', () => {
    vi.stubEnv(E2E_TARGET_FILE_ENV, 'C:\\repo\\e2e\\ide\\index.test.ts')

    const result = resolveVitestIncludePatterns(path.join('C:', 'repo', 'e2e'), [
      'C:/repo/e2e/ide/**/*.test.ts',
    ])

    expect(result).toEqual([
      'C:/repo/e2e/ide/index.test.ts',
    ])
  })
})
