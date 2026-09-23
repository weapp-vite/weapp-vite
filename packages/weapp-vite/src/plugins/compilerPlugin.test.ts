import type { OutputBundle } from 'rolldown'
import type { CompilerContext } from '../context'
import { describe, expect, it, vi } from 'vitest'
import { createCompilerPluginPlugins } from './compilerPlugin'
import { createManagedCompilerEntryMarker } from './compilerPluginRegistry'

function hook(plugin: any, name: string) {
  const value = plugin[name]
  return typeof value === 'function' ? value : value?.handler
}

function createContext(compilerPlugins: any[]) {
  return {
    configService: {
      cwd: '/project',
      absoluteSrcRoot: '/project/src',
      platform: 'weapp',
      isDev: true,
      outputExtensions: { wxss: 'wxss', wxml: 'wxml', js: 'js' },
      weappViteConfig: { compilerPlugins },
    },
  } as unknown as CompilerContext
}

describe('compiler plugin host', () => {
  it('runs source, output and lifecycle hooks for a third-party controller', async () => {
    const watched: string[] = []
    const calls: string[] = []
    const controller = {
      buildStart: vi.fn(async () => calls.push('buildStart')),
      claimSource: vi.fn(({ id }: { id: string }) => id.endsWith('.css')),
      transformSource: vi.fn(async ({ code }: { code: string }) => ({
        code: `${code}\n/* source */`,
        entryId: 'app.wxss',
        dependencies: ['/project/src/tokens.css'],
        state: 'entry-state',
      })),
      transformCss: vi.fn(async ({ code, state }: { code: string, state?: unknown }) => ({
        code: `${code}\n/* output */`,
        handled: state === 'entry-state',
      })),
      watchChange: vi.fn(async () => calls.push('watchChange')),
      closeBundle: vi.fn(async () => calls.push('closeBundle')),
      dispose: vi.fn(async () => calls.push('dispose')),
    }
    const provider = {
      name: 'fake-compiler',
      capabilities: { style: true, hmr: true },
      create: vi.fn(() => controller),
    }
    const plugins = createCompilerPluginPlugins(createContext([provider]))
    expect(plugins.map(plugin => plugin.name)).toEqual([
      'weapp-vite:compiler:source',
      'weapp-vite:compiler:output',
    ])

    const source = plugins[0]!
    const output = plugins[1]!
    const invalidated: string[] = []
    const pluginContext = {
      addWatchFile: (file: string) => watched.push(file),
      resolve: vi.fn(),
      environment: {
        moduleGraph: {
          getModuleById: (id: string) => id,
          invalidateModule: (id: unknown) => invalidated.push(String(id)),
        },
      },
    }
    hook(source, 'configResolved').call(pluginContext, { command: 'serve' })
    await hook(source, 'buildStart').call(pluginContext)
    const transformed = await hook(source, 'transform').call(pluginContext, '.entry {}', '/project/src/app.css')
    expect(transformed.code).toContain('/* source */')
    expect(transformed.code).toContain(createManagedCompilerEntryMarker())
    expect(watched).toEqual(['/project/src/tokens.css'])

    await hook(source, 'watchChange').call(pluginContext, '/project/src/app.css', { event: 'update' })
    const bundle = {
      'app.wxss': { type: 'asset', fileName: 'app.wxss', source: '.entry {}' },
    } as unknown as OutputBundle
    await hook(output, 'generateBundle').call(pluginContext, {}, bundle)
    expect(String((bundle['app.wxss'] as any).source)).toContain('/* output */')
    expect(String((bundle['app.wxss'] as any).source)).not.toContain(createManagedCompilerEntryMarker())

    await hook(output, 'closeBundle').call(pluginContext)
    await hook(output, 'closeBundle').call(pluginContext)
    expect(calls).toEqual(['buildStart', 'watchChange', 'closeBundle', 'dispose'])
  })

  it('disposes once across closeWatcher and closeBundle', async () => {
    const calls: string[] = []
    const provider = {
      name: 'watcher-lifecycle',
      create: () => ({
        closeWatcher: vi.fn(async () => calls.push('closeWatcher')),
        closeBundle: vi.fn(async () => calls.push('closeBundle')),
        dispose: vi.fn(async () => calls.push('dispose')),
      }),
    }
    const plugins = createCompilerPluginPlugins(createContext([provider]))
    const source = plugins[0]!
    const output = plugins[1]!
    const pluginContext = { resolve: vi.fn(), addWatchFile: vi.fn() }

    await hook(source, 'closeWatcher').call(pluginContext)
    await hook(source, 'closeWatcher').call(pluginContext)
    await hook(output, 'closeBundle').call(pluginContext)
    await hook(output, 'closeBundle').call(pluginContext)

    expect(calls).toEqual(['closeWatcher', 'dispose', 'closeBundle'])
  })

  it('passes a claim entryId to output transforms when source transform is omitted', async () => {
    const entryIds: string[] = []
    const provider = {
      name: 'claim-only',
      create: () => ({
        claimSource: () => ({ id: 'app.wxss', entryId: 'generated.wxss' }),
        transformCss: ({ entryId, code }: { entryId?: string, code: string }) => {
          entryIds.push(entryId ?? '')
          return { code: `${code}\n/* transformed */` }
        },
      }),
    }
    const plugins = createCompilerPluginPlugins(createContext([provider]))
    const source = plugins[0]!
    const output = plugins[1]!
    const pluginContext = { resolve: vi.fn(), addWatchFile: vi.fn() }
    await hook(source, 'transform').call(pluginContext, '.entry {}', '/project/src/app.css')

    const bundle = {
      'app.wxss': { type: 'asset', fileName: 'app.wxss', source: '.entry {}' },
    } as unknown as OutputBundle
    await hook(output, 'generateBundle').call(pluginContext, {}, bundle)

    expect(entryIds).toEqual(['generated.wxss'])
  })

  it('clears source state before a new build starts', async () => {
    const entryIds: string[] = []
    const provider = {
      name: 'state-reset',
      create: () => ({
        claimSource: ({ id }: { id: string }) => id.endsWith('.css') ? { entryId: 'generated.wxss' } : false,
        transformCss: ({ entryId, code }: { entryId?: string, code: string }) => {
          entryIds.push(entryId ?? '')
          return { code }
        },
      }),
    }
    const plugins = createCompilerPluginPlugins(createContext([provider]))
    const source = plugins[0]!
    const output = plugins[1]!
    const pluginContext = { resolve: vi.fn(), addWatchFile: vi.fn() }
    await hook(source, 'transform').call(pluginContext, '.entry {}', '/project/src/app.css')
    await hook(source, 'buildStart').call(pluginContext)

    const bundle = {
      'app.wxss': { type: 'asset', fileName: 'app.wxss', source: '.entry {}' },
    } as unknown as OutputBundle
    await hook(output, 'generateBundle').call(pluginContext, {}, bundle)

    expect(entryIds).toEqual(['app.wxss'])
  })

  it('transforms template and JavaScript outputs and preserves maps and dependencies', async () => {
    const watched: string[] = []
    const invalidated: string[] = []
    const bundleCalls: string[] = []
    const maps = {
      source: { version: 3, mappings: 'source' },
      css: { version: 3, mappings: 'css' },
      template: { version: 3, mappings: 'template' },
      script: { version: 3, mappings: 'script' },
    }
    const provider = {
      name: 'fake-full-chain',
      create: () => ({
        claimSource: ({ id }: { id: string }) => id.endsWith('.css')
          ? { dependencies: ['/project/src/imported.css'] }
          : false,
        transformSource: ({ code }: { code: string }) => ({
          code: `${code}\n/* source */`,
          map: maps.source,
          invalidated: ['/project/src/page.wxml'],
          dependencies: ['/project/src/generated.css'],
        }),
        generateBundle: (bundle: OutputBundle) => {
          bundleCalls.push(Object.keys(bundle).join(','))
        },
        transformCss: ({ code }: { code: string }) => ({ code: `${code}\n/* css */`, map: maps.css }),
        transformTemplate: ({ code }: { code: string }) => ({ code: `${code}\n<!-- template -->`, map: maps.template }),
        transformJavaScript: ({ code }: { code: string }) => ({ code: `${code}\n// script`, map: maps.script }),
      }),
    }
    const plugins = createCompilerPluginPlugins(createContext([provider]))
    const source = plugins[0]!
    const output = plugins[1]!
    const pluginContext = {
      addWatchFile: (file: string) => watched.push(file),
      resolve: vi.fn(),
      environment: {
        moduleGraph: {
          getModuleById: (id: string) => id,
          invalidateModule: (id: unknown) => invalidated.push(String(id)),
        },
      },
    }
    const transformed = await hook(source, 'transform').call(pluginContext, '.entry {}', '/project/src/app.css')
    expect(transformed.map).toEqual(maps.source)
    const bundle = {
      'app.wxss': { type: 'asset', fileName: 'app.wxss', source: '.entry {}' },
      'app.wxml': { type: 'asset', fileName: 'app.wxml', source: '<view />' },
      'app.js': { type: 'chunk', fileName: 'app.js', code: 'export default 1', map: null },
    } as unknown as OutputBundle

    await hook(output, 'generateBundle').call(pluginContext, {}, bundle)

    expect(bundleCalls).toEqual(['app.wxss,app.wxml,app.js'])
    expect(String((bundle['app.wxss'] as any).source)).toContain('/* css */')
    expect(String((bundle['app.wxml'] as any).source)).toContain('<!-- template -->')
    expect((bundle['app.js'] as any).code).toContain('// script')
    expect((bundle['app.js'] as any).map).toEqual(maps.script)
    expect(invalidated).toEqual(['/project/src/page.wxml'])
    expect(watched).toEqual([
      '/project/src/imported.css',
      '/project/src/generated.css',
    ])
  })

  it('removes the source marker when a provider has no CSS output hook', async () => {
    const provider = {
      name: 'source-only-compiler',
      create: () => ({
        claimSource: ({ id }: { id: string }) => id.endsWith('.css'),
        transformSource: ({ code }: { code: string }) => ({ code: `${code}\n.generated{display:block}` }),
      }),
    }
    const plugins = createCompilerPluginPlugins(createContext([provider]))
    const source = plugins[0]!
    const output = plugins[1]!
    const pluginContext = {
      resolve: vi.fn(),
      addWatchFile: vi.fn(),
    }
    await hook(source, 'transform').call(pluginContext, '.entry {}', '/project/src/app.css')
    const bundle = {
      'app.wxss': { type: 'asset', fileName: 'app.wxss', source: `${createManagedCompilerEntryMarker()}\n.entry {}` },
    } as unknown as OutputBundle

    await hook(output, 'generateBundle').call(pluginContext, {}, bundle)

    expect(String((bundle['app.wxss'] as any).source)).not.toContain(createManagedCompilerEntryMarker())
  })

  it('rejects two providers claiming the same source', async () => {
    const createProvider = (name: string) => ({
      name,
      create: () => ({
        claimSource: ({ id }: { id: string }) => ({
          id: name === 'one' ? `${id}?type=style` : id,
        }),
        transformSource: ({ code }: { code: string }) => ({ code: `${code}\n${name}` }),
      }),
    })
    const source = createCompilerPluginPlugins(createContext([createProvider('one'), createProvider('two')]))[0]!
    const pluginContext = { resolve: vi.fn(), addWatchFile: vi.fn() }
    await expect(hook(source, 'transform').call(pluginContext, '.entry {}', '/project/src/app.css')).rejects.toThrow('源码所有权冲突')
  })
})
