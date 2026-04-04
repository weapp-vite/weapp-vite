import { describe, expect, it, vi } from 'vitest'
import { findFirstResolvedVueLikeEntry, isVueLikeFile, registerVueTemplateToken, resolveVueLikeEntryCandidates, resolveVueOutputBase, stripVueLikeExtension } from './shared'

describe('vue transform shared helpers', () => {
  it('detects vue-like files and resolves candidate paths', async () => {
    expect(isVueLikeFile('/project/src/pages/home/index.vue')).toBe(true)
    expect(isVueLikeFile('/project/src/pages/home/index.jsx')).toBe(true)
    expect(isVueLikeFile('/project/src/pages/home/index.tsx')).toBe(true)
    expect(isVueLikeFile('/project/src/pages/home/index.ts')).toBe(false)

    expect(stripVueLikeExtension('/project/src/pages/home/index.vue')).toBe('/project/src/pages/home/index')
    expect(stripVueLikeExtension('/project/src/pages/home/index.ts')).toBe('/project/src/pages/home/index.ts')

    expect(resolveVueLikeEntryCandidates('/project/src/pages/home/index')).toEqual([
      '/project/src/pages/home/index.vue',
      '/project/src/pages/home/index.tsx',
      '/project/src/pages/home/index.jsx',
    ])

    expect(await findFirstResolvedVueLikeEntry('/project/src/pages/home/index', {
      resolve: async candidate => candidate.endsWith('.tsx') ? `${candidate}?found` : undefined,
    })).toBe('/project/src/pages/home/index.tsx?found')
  })

  it('resolves vue output base from file paths', () => {
    expect(resolveVueOutputBase({
      relativeOutputPath: (value: string) => `dist/${value}`,
    } as any, '/project/src/pages/home/index.vue')).toBe('dist//project/src/pages/home/index')

    expect(resolveVueOutputBase({
      relativeOutputPath: (value: string) => value,
    } as any, '/project/src/pages/home/index')).toBe('/project/src/pages/home/index')
  })

  it('registers template tokens when wxml service is available', () => {
    const analyze = vi.fn(() => ({
      components: {
        FooCard: true,
      },
      deps: [],
    }))
    const tokenMapSet = vi.fn()
    const setWxmlComponentsMap = vi.fn()
    const collectDepsFromToken = vi.fn(() => [])
    const setDeps = vi.fn()

    registerVueTemplateToken(
      {
        wxmlService: {
          analyze,
          tokenMap: {
            set: tokenMapSet,
          },
          collectDepsFromToken,
          setDeps,
          setWxmlComponentsMap,
        },
      } as any,
      '/project/src/pages/home/index.vue',
      '<FooCard />',
    )

    expect(analyze).toHaveBeenCalledWith('<FooCard />')
    expect(tokenMapSet).toHaveBeenCalledWith('/project/src/pages/home/index.vue', {
      components: {
        FooCard: true,
      },
      deps: [],
    })
    expect(collectDepsFromToken).toHaveBeenCalledWith('/project/src/pages/home/index.vue', [])
    expect(setDeps).toHaveBeenCalledWith('/project/src/pages/home/index.vue', [])
    expect(setWxmlComponentsMap).toHaveBeenCalledWith('/project/src/pages/home/index.vue', {
      FooCard: true,
    })
  })

  it('ignores empty templates and analysis failures', () => {
    expect(() => {
      registerVueTemplateToken({} as any, '/project/src/pages/home/index.vue', undefined)
      registerVueTemplateToken(
        {
          wxmlService: {
            analyze: () => {
              throw new Error('scan failed')
            },
            tokenMap: {
              set: vi.fn(),
            },
            collectDepsFromToken: vi.fn(() => []),
            setDeps: vi.fn(),
            setWxmlComponentsMap: vi.fn(),
          },
        } as any,
        '/project/src/pages/home/index.vue',
        '<view />',
      )
    }).not.toThrow()
  })
})
