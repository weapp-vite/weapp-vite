import { describe, expect, it, vi } from 'vitest'
import { registerVueTemplateToken, resolveVueOutputBase } from './shared'

describe('vue transform shared helpers', () => {
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
    }))
    const tokenMapSet = vi.fn()
    const setWxmlComponentsMap = vi.fn()

    registerVueTemplateToken(
      {
        wxmlService: {
          analyze,
          tokenMap: {
            set: tokenMapSet,
          },
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
    })
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
            setWxmlComponentsMap: vi.fn(),
          },
        } as any,
        '/project/src/pages/home/index.vue',
        '<view />',
      )
    }).not.toThrow()
  })
})
