import { describe, expect, it, vi } from 'vitest'
import { registerVueTemplateToken } from './shared'

describe('vue transform shared helpers', () => {
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
