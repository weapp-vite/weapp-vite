import { describe, expect, it } from 'vitest'
import { toAbsoluteId } from './toAbsoluteId'

describe('toAbsoluteId', () => {
  const configService = {
    cwd: '/project',
    absoluteSrcRoot: '/project/src',
  }

  it('returns normalized absolute ids', () => {
    expect(toAbsoluteId('/@fs/Users/me/a.ts?import', configService as any)).toBe('/Users/me/a.ts')
  })

  it('resolves relative ids against importer dir when possible', () => {
    expect(toAbsoluteId('./a', configService as any, '/project/src/pages/index.vue')).toBe('/project/src/pages/a')
  })

  it('supports vue virtual importer', () => {
    expect(toAbsoluteId('./a', configService as any, '\0vue:/project/src/pages/index.vue?vue&type=script')).toBe('/project/src/pages/a')
  })

  it('falls back to srcRoot by default', () => {
    expect(toAbsoluteId('pages/a', configService as any)).toBe('/project/src/pages/a')
  })

  it('falls back to cwd when configured', () => {
    expect(toAbsoluteId('pages/a', configService as any, undefined, { base: 'cwd' })).toBe('/project/pages/a')
  })

  it('does not rewrite virtual ids', () => {
    expect(toAbsoluteId('\0virtual:dep', configService as any)).toBe('\0virtual:dep')
    expect(toAbsoluteId('node:fs', configService as any)).toBe('node:fs')
  })
})
