import { describe, expect, it, vi } from 'vitest'
import { createEntryNormalizer } from './normalizer'

function createConfigService() {
  return {
    aliasEntries: [{ find: '@', replacement: '/project/src' }],
    absoluteSrcRoot: '/project/src',
    packageJson: {
      dependencies: {
        'tdesign-miniprogram': '^1.0.0',
        '@scope/pkg': '^1.0.0',
      },
    },
    relativeAbsoluteSrcRoot: vi.fn((id: string) => id.replace('/project/src/', '')),
  } as any
}

describe('useLoadEntry normalizer', () => {
  it('keeps plugin protocol entries untouched', () => {
    const normalizeEntry = createEntryNormalizer(createConfigService())
    expect(normalizeEntry('plugin://demo/card', '/project/src/app.json')).toBe('plugin://demo/card')
  })

  it('normalizes dependency entries into npm protocol for scoped and unscoped packages', () => {
    const normalizeEntry = createEntryNormalizer(createConfigService())

    expect(normalizeEntry('tdesign-miniprogram/button/button', '/project/src/app.json')).toBe('npm:tdesign-miniprogram/button/button')
    expect(normalizeEntry('@scope/pkg/button/index', '/project/src/app.json')).toBe('npm:@scope/pkg/button/index')
  })

  it('keeps absolute entries repo-relative and resolves aliases for local entries', () => {
    const configService = createConfigService()
    const normalizeEntry = createEntryNormalizer(configService)

    expect(normalizeEntry('/components/Card/index', '/project/src/app.json')).toBe('components/Card/index')
    expect(normalizeEntry('@/components/Card/index', '/project/src/pages/home/index.json')).toBe('components/Card/index')
    expect(configService.relativeAbsoluteSrcRoot).toHaveBeenCalledWith('/project/src/components/Card/index')
  })

  it('handles windows separators before dependency and local path normalization', () => {
    const normalizeEntry = createEntryNormalizer(createConfigService())

    expect(normalizeEntry('tdesign-miniprogram\\button\\button', '/project/src/app.json')).toBe('npm:tdesign-miniprogram/button/button')
    expect(normalizeEntry('\\components\\Card\\index', '/project/src/app.json')).toBe('components/Card/index')
  })
})
