import { describe, expect, it } from 'vitest'
import { usingComponentFromResolvedFile } from './usingComponentFrom'

describe('usingComponentFromResolvedFile', () => {
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
})
