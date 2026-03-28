import { describe, expect, it } from 'vitest'
import {
  shouldResolveUsingComponentFrom,
  usingComponentFromResolvedFile,
} from './usingComponentFrom'

describe('usingComponentFromResolvedFile', () => {
  it('detects which resolved files can become usingComponents paths', () => {
    expect(shouldResolveUsingComponentFrom('/project/src/components/foo/index.vue')).toBe(true)
    expect(shouldResolveUsingComponentFrom('components/foo/index.vue')).toBe(false)
    expect(shouldResolveUsingComponentFrom('node:fs')).toBe(false)
    expect(shouldResolveUsingComponentFrom(undefined)).toBe(false)
  })

  it('returns posix output path with leading slash', () => {
    const configService = {
      relativeOutputPath: (p: string) => p.replace('/project/src/', ''),
    }
    expect(usingComponentFromResolvedFile('/project/src/components/foo/index.vue', configService as any)).toBe('/components/foo/index')
  })

  it('returns undefined for skippable ids', () => {
    const configService = {
      relativeOutputPath: (p: string) => p,
    }
    expect(usingComponentFromResolvedFile('node:fs', configService as any)).toBeUndefined()
    expect(usingComponentFromResolvedFile('\0virtual:dep', configService as any)).toBeUndefined()
  })

  it('returns undefined for files outside output root after relative conversion', () => {
    const configService = {
      relativeOutputPath: () => '../components/foo/index',
    }
    expect(usingComponentFromResolvedFile('/project/src/components/foo/index.vue', configService as any)).toBeUndefined()
  })
})
