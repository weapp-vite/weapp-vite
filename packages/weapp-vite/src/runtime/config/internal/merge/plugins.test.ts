import { describe, expect, it, vi } from 'vitest'
import { markWeappCompilerPlugin } from '../../../../plugins/compilerPlugin'
import { arrangePlugins, normalizePluginOptions } from './plugins'

const vitePluginWeappMock = vi.hoisted(() => vi.fn(() => [
  { name: 'weapp-vite:context' },
  { name: 'weapp-vite:output-finalizer' },
]))

vi.mock('../../../../plugins', () => ({
  WEAPP_VITE_CONTEXT_PLUGIN_NAME: 'weapp-vite:context',
  vitePluginWeapp: vitePluginWeappMock,
}))

describe('runtime config merge plugins', () => {
  it('runs the Tailwind source compiler after user pre plugins without moving the final output owner', () => {
    const compiler = markWeappCompilerPlugin(
      { name: 'weapp-vite:tailwindcss', enforce: 'pre' },
      'source',
      'tailwindcss',
    )
    vitePluginWeappMock.mockReturnValueOnce([
      { name: 'weapp-vite:context' },
      compiler,
      { name: 'weapp-vite:output-finalizer' },
    ])
    const userPre = { name: 'user-pre', enforce: 'pre' }
    const config: any = { plugins: [userPre] }
    arrangePlugins(config, {} as any, undefined)
    expect(config.plugins).toEqual([
      { name: 'weapp-vite:context' },
      userPre,
      compiler,
      { name: 'weapp-vite:output-finalizer' },
    ])
  })

  it('keeps compiler output between normalization and final publication', () => {
    const compilerSource = markWeappCompilerPlugin(
      { name: 'weapp-vite:compiler:source', enforce: 'pre' },
      'source',
      'fake-source',
    )
    const compilerOutput = markWeappCompilerPlugin(
      { name: 'weapp-vite:compiler:output', enforce: 'post' },
      'output',
      'fake-output',
    )
    const outputFinalizer = { name: 'weapp-vite:output-finalizer' }
    const outputPublication = { name: 'weapp-vite:output-publication' }
    vitePluginWeappMock.mockReturnValueOnce([
      { name: 'weapp-vite:context' },
      outputPublication,
      compilerSource,
      { name: 'weapp-vite:css' },
      outputFinalizer,
      compilerOutput,
    ])
    const userPre = { name: 'user-pre', enforce: 'pre' }
    const config: any = { plugins: [userPre, { name: 'weapp-vite:output-publication' }] }
    arrangePlugins(config, {} as any, undefined)
    expect(config.plugins.map((plugin: any) => plugin.name)).toEqual([
      'weapp-vite:context',
      'user-pre',
      'weapp-vite:compiler:source',
      'weapp-vite:css',
      'weapp-vite:output-finalizer',
      'weapp-vite:compiler:output',
      'weapp-vite:output-publication',
    ])
    expect(config.plugins.indexOf(compilerSource)).toBe(2)
  })

  it('does not classify an unrelated plugin by its Tailwind-like name', () => {
    const unrelated = { name: 'weapp-vite:tailwindcss', enforce: 'pre' }
    vitePluginWeappMock.mockReturnValueOnce([
      { name: 'weapp-vite:context' },
      { name: 'weapp-vite:output-finalizer' },
    ])
    const config: any = { plugins: [unrelated] }
    arrangePlugins(config, {} as any, undefined)
    expect(config.plugins).toContain(unrelated)
  })

  it('normalizes nested plugin options into a flat array', () => {
    expect(normalizePluginOptions([
      { name: 'a' },
      [{ name: 'b' }, undefined],
      false as any,
    ] as any)).toEqual([
      { name: 'a' },
      { name: 'b' },
    ])
  })

  it('places weapp plugins first, keeps output finalizer last, and removes duplicates', () => {
    const config: any = {
      plugins: [
        { name: 'user-a' },
        [{ name: 'vite-tsconfig-paths' }],
        { name: 'weapp-vite:context' },
        {
          name: 'user-enforce-post',
          enforce: 'post',
        },
        {
          name: 'user-order-post',
          generateBundle: {
            order: 'post',
            handler: vi.fn(),
          },
        },
      ],
    }

    arrangePlugins(config, {} as any, undefined)

    expect(vitePluginWeappMock).toHaveBeenCalledWith({}, undefined)
    expect(config.plugins).toEqual([
      { name: 'weapp-vite:context' },
      { name: 'user-a' },
      expect.objectContaining({ name: 'user-enforce-post' }),
      expect.objectContaining({ name: 'user-order-post' }),
      { name: 'vite-tsconfig-paths' },
      { name: 'weapp-vite:output-finalizer' },
    ])
  })
})
