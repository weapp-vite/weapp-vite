import type { Plugin } from 'vite'
import { describe, expect, it, vi } from 'vitest'
import { collectResolverPlugins } from './resolverPlugins'

describe('auxiliary graph resolver ownership', () => {
  it('flattens async options and preserves resolver ordering and filters without sharing hook containers', async () => {
    const filter = { id: /virtual:fixture/ }
    const resolveId = {
      order: 'post' as const,
      filter,
      handler(this: { owner: string }) { return this.owner },
    }
    const lifecycle = vi.fn()
    const plugin: Plugin = {
      name: 'third-party',
      enforce: 'pre',
      resolveId: resolveId as Plugin['resolveId'],
      config: lifecycle,
      configResolved: lifecycle,
      configureServer: lifecycle,
      buildStart: lifecycle,
      buildEnd: lifecycle,
      generateBundle: lifecycle,
      writeBundle: lifecycle,
      closeBundle: lifecycle,
      closeWatcher: lifecycle,
    }
    const plugins = await collectResolverPlugins({ plugins: [false, [Promise.resolve(plugin)], { name: 'weapp-vite:context' }, Promise.resolve([{ name: 'weapp-runtime:owner' }])] })
    expect(plugins).toHaveLength(1)
    const projected = plugins[0]!
    expect(projected).toMatchObject({ name: 'third-party', enforce: 'pre', resolveId: { order: 'post', filter } })
    expect(projected).not.toBe(plugin)
    const hook = projected.resolveId as typeof resolveId
    expect(hook).not.toBe(resolveId)
    expect(hook.handler.call({ owner: 'resolver-context' })).toBe('resolver-context')
    hook.order = 'pre' as never
    expect(resolveId.order).toBe('post')
    for (const name of ['config', 'configResolved', 'configureServer', 'buildStart', 'buildEnd', 'generateBundle', 'writeBundle', 'closeBundle', 'closeWatcher'] as const) {
      expect(projected[name]).toBeUndefined()
    }
    expect(lifecycle).not.toHaveBeenCalled()
  })

  it('selects resolvers for the actual build command rather than the auxiliary serve command', async () => {
    const apply = vi.fn(() => true)
    const plugins = await collectResolverPlugins({
      mode: 'development',
      plugins: [
        { name: 'build-only', apply: 'build' },
        { name: 'serve-only', apply: 'serve' },
        { name: 'selected', apply },
        { name: 'excluded', apply: () => false },
      ],
    })
    expect(plugins.map(plugin => plugin.name)).toEqual(['build-only', 'selected'])
    expect(apply).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ mode: 'development' }), {
      command: 'build',
      mode: 'development',
      isSsrBuild: false,
      isPreview: false,
    })
    expect(plugins.every(plugin => plugin.apply === undefined)).toBe(true)
  })
})
