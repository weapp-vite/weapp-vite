import { beforeEach, describe, expect, it, vi } from 'vitest'

describe('vue resolver wevu install detection', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.restoreAllMocks()
    vi.unmock('node:module')
  })

  it.each([
    ['dependencies', { dependencies: { wevu: '^1.0.0' } }],
    ['devDependencies', { devDependencies: { wevu: '^1.0.0' } }],
  ])('skips warning when wevu is declared in %s', async (_label, packageJson) => {
    const logger = (await import('../../src/logger')).default
    const warnSpy = vi.spyOn(logger, 'warn').mockImplementation(() => {})
    const { createVueResolverPlugin } = await import('../../src/plugins/vue/resolver')

    const plugin = createVueResolverPlugin({
      configService: {
        cwd: '/root',
        absoluteSrcRoot: '/root/src',
        packageJson,
      },
    } as any)

    const resolved = await plugin.resolveId!('/root/src/foo.vue', '/root/src/app.vue')
    expect(resolved).toBe('/root/src/foo.vue')
    expect(warnSpy).not.toHaveBeenCalled()
  })

  it('warns when wevu is not declared', async () => {
    const createRequire = vi.fn<(typeof import('node:module'))['createRequire']>()

    vi.doMock('node:module', async (importOriginal) => {
      const actual = await importOriginal<typeof import('node:module')>()
      createRequire.mockImplementation((...args) => {
        const req = actual.createRequire(...args)
        const originalResolve = req.resolve.bind(req)
        req.resolve = (id, options) => {
          if (id === 'wevu') {
            throw new Error('missing')
          }
          return originalResolve(id, options)
        }
        return req
      })
      return {
        ...actual,
        createRequire,
      }
    })

    const logger = (await import('../../src/logger')).default
    const warnSpy = vi.spyOn(logger, 'warn').mockImplementation(() => {})
    const { createVueResolverPlugin } = await import('../../src/plugins/vue/resolver')

    const plugin = createVueResolverPlugin({
      configService: {
        cwd: '/root',
        absoluteSrcRoot: '/root/src',
        packageJson: {},
      },
    } as any)

    await plugin.resolveId!('/root/src/foo.vue', '/root/src/app.vue')
    expect(createRequire).toHaveBeenCalled()
    expect(warnSpy).toHaveBeenCalledTimes(1)
    const [message] = warnSpy.mock.calls[0] ?? []
    expect(String(message)).toContain('wevu')
    expect(String(message)).toContain('.vue')
  })
})
