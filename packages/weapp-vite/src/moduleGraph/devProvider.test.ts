import type { Plugin } from 'vite'
import { mergeConfig } from 'vite'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createRuntimeState } from '../runtime/runtimeState'
import { createDevModuleGraphProvider } from './devProvider'
import { attachDevModuleGraphHost, notifyDevModuleGraphHost } from './host'
import { createLogicalEntryId, createSidecarModuleId, createSidecarSourceSpecifier } from './protocol'
import { createModuleGraphService } from './service'

const createServerMock = vi.hoisted(() => vi.fn())

vi.mock('vite', async (importOriginal) => {
  const actual = await importOriginal<typeof import('vite')>()
  return {
    ...actual,
    createServer: createServerMock,
  }
})

describe('dev module graph provider', () => {
  const watcher = {
    add: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
  }
  const close = vi.fn(async () => {})
  const server = {
    close,
    moduleGraph: {},
    watcher,
  }

  beforeEach(() => {
    vi.clearAllMocks()
    createServerMock.mockResolvedValue(server)
  })

  it('uses a middleware Vite graph without output and keeps user resolver plugins', async () => {
    const resolver = { name: 'vite-tsconfig-paths' }
    const internal = { name: 'weapp-vite:pre' }
    const moduleGraphService = createModuleGraphService()
    const userIgnored = (id: string) => id.endsWith('.generated.ts')
    const ctx = {
      runtimeState: createRuntimeState(),
      configService: {
        cwd: '/project',
        outDir: '/project/dist',
        inlineConfig: { build: { watch: { chokidar: { usePolling: true, interval: 75 } } } },
      },
      moduleGraphService,
    } as any
    const onChange = vi.fn()

    const provider = await createDevModuleGraphProvider(ctx, {
      plugins: [internal, resolver],
      build: { write: true, watch: {} },
      server: {
        watch: {
          ignored: userIgnored,
        },
      },
    }, onChange)

    const config = createServerMock.mock.calls[0]![0]
    expect(config.server).toMatchObject({ hmr: true, middlewareMode: true })
    expect(config.server.watch).toMatchObject({ usePolling: true, interval: 75 })
    const ignored = config.server.watch.ignored as Array<(id: string) => boolean>
    expect(ignored[0]).toBe(userIgnored)
    expect(ignored[1]!('/project/dist/miniprogram_npm/@vant/weapp/field/index.json')).toBe(true)
    expect(ignored[1]!('/project/src/pages/index.ts')).toBe(false)
    expect(config.build).toMatchObject({ watch: undefined, write: false })
    expect(config.plugins).toEqual([expect.objectContaining({ name: 'weapp-vite:module-graph-provider' }), resolver])
    const providerPlugin = config.plugins[0] as Plugin
    const read = vi.fn(async () => '<view />')
    await (providerPlugin.hotUpdate as any).call(
      { environment: { name: 'client' } },
      {
        type: 'update',
        file: '/project/src/page.wxml',
        read,
      },
    )
    expect(read).toHaveBeenCalled()
    expect(onChange).toHaveBeenCalledWith({
      event: 'update',
      file: '/project/src/page.wxml',
    })
    expect(providerPlugin.handleHotUpdate).toBeUndefined()
    expect(watcher.on).not.toHaveBeenCalled()

    await provider.close()
    expect(watcher.off).not.toHaveBeenCalled()
    expect(close).toHaveBeenCalled()
  })

  it('merges exact profile ownership with user ignores and rejects late profile events before reading', async () => {
    const ctx = {
      runtimeState: createRuntimeState(),
      configService: {
        cwd: '/project',
        outDir: '/project/dist',
        inlineConfig: {},
        weappViteConfig: { hmr: { profileJson: true } },
      },
      moduleGraphService: createModuleGraphService(),
    } as any
    const onChange = vi.fn()
    const userIgnored = (file: string) => file.endsWith('.user-ignored')
    const provider = await createDevModuleGraphProvider(ctx, { server: { watch: { ignored: userIgnored } } }, onChange)
    try {
      const options = createServerMock.mock.calls[0]![0]
      const plugin = options.plugins[0] as Plugin
      const merged = mergeConfig(options, await (plugin.config as any)())
      const ignored = merged.server.watch.ignored as Array<(file: string) => boolean>
      expect(ignored).toContain(userIgnored)
      const isIgnored = (file: string) => ignored.some(match => match(file))
      const file = '/project/.weapp-vite/hmr-profile.jsonl'
      expect(isIgnored(file)).toBe(true)
      expect(isIgnored('/project/dist/app.js')).toBe(true)
      expect(isIgnored('/project/src/input.user-ignored')).toBe(true)
      expect(isIgnored('/project/.weapp-vite/user-config.json')).toBe(false)
      const read = vi.fn(async () => '{}')
      for (const type of ['create', 'update', 'delete']) {
        await (plugin.hotUpdate as any).call({ environment: { name: 'client' } }, { type, file, read })
      }
      expect(read).not.toHaveBeenCalled()
      expect(onChange).not.toHaveBeenCalled()

      ctx.configService.weappViteConfig.hmr.profileJson = false
      expect(isIgnored(file)).toBe(false)
      await (plugin.hotUpdate as any).call({ environment: { name: 'client' } }, { type: 'update', file, read })
      expect(read).toHaveBeenCalledOnce()
      expect(onChange).toHaveBeenCalledExactlyOnceWith({ event: 'update', file })
    }
    finally {
      await provider.close()
    }
  })

  it('subscribes external WXML inputs to the provider and releases only its listener', async () => {
    const runtimeState = createRuntimeState()
    const dependency = '/external/transform-rules.json'
    runtimeState.wxmlProcessing.references.set(dependency, 1)
    const unrelated = vi.fn()
    runtimeState.wxmlProcessing.listeners.add(unrelated)
    const provider = await createDevModuleGraphProvider({
      moduleGraphService: createModuleGraphService(),
      runtimeState,
    } as any, {}, vi.fn())
    expect(watcher.add).toHaveBeenCalledWith([dependency])
    expect(runtimeState.wxmlProcessing.listeners.size).toBe(2)
    for (const listener of runtimeState.wxmlProcessing.listeners) {
      listener(['/external/late-rules.json'])
    }
    expect(watcher.add).toHaveBeenCalledWith(['/external/late-rules.json'])
    await provider.close()
    await provider.close()
    expect(runtimeState.wxmlProcessing.listeners).toEqual(new Set([unrelated]))
  })

  it('borrows a host graph without creating or closing a second Vite server', async () => {
    const moduleGraphService = createModuleGraphService()
    const ctx = { moduleGraphService, runtimeState: createRuntimeState() }
    const detach = attachDevModuleGraphHost(ctx, server as any)
    const onChange = vi.fn()
    const provider = await createDevModuleGraphProvider(ctx, {}, onChange)
    expect(createServerMock).not.toHaveBeenCalled()
    notifyDevModuleGraphHost(ctx, { event: 'update', file: '/src/page.ts' })
    expect(onChange).toHaveBeenCalledOnce()
    await provider.close()
    await provider.close()
    notifyDevModuleGraphHost(ctx, { event: 'update', file: '/src/page.ts' })
    expect(onChange).toHaveBeenCalledOnce()
    expect(close).not.toHaveBeenCalled()
    detach()
  })

  it('leaves missing-file topology changes to the topology watcher', async () => {
    const ctx = {
      runtimeState: createRuntimeState(),
      moduleGraphService: {
        bindDevServer: vi.fn(),
        getEntryDependencies: vi.fn(() => []),
      },
    } as any
    const onChange = vi.fn()
    await createDevModuleGraphProvider(ctx, {}, onChange)
    const config = createServerMock.mock.calls[0]![0]
    const providerPlugin = config.plugins[0] as Plugin
    const error = Object.assign(new Error('missing'), { code: 'ENOENT' })

    await expect((providerPlugin.hotUpdate as any).call(
      { environment: { name: 'client' } },
      {
        type: 'create',
        file: '/project/src/page.wxml',
        read: vi.fn(async () => Promise.reject(error)),
      },
    )).resolves.toBeUndefined()
    expect(onChange).not.toHaveBeenCalled()
  })

  it('loads logical entry and sidecar modules from stable metadata', async () => {
    const pageId = '/project/src/pages/home/index.ts'
    const templateId = '/project/src/pages/home/index.wxml'
    const styleId = '/project/src/pages/home/index.css'
    const ctx = {
      runtimeState: createRuntimeState(),
      moduleGraphService: {
        bindDevServer: vi.fn(),
        getEntryDependencies: vi.fn(() => [{ kind: 'template', sourceId: templateId }]),
      },
    } as any
    await createDevModuleGraphProvider(ctx, {}, vi.fn())
    const config = createServerMock.mock.calls[0]![0]
    const plugin = config.plugins[0] as Plugin
    const logicalCode = await (plugin.load as any).call({}, createLogicalEntryId(pageId, 'page'))
    const sidecarCode = await (plugin.load as any).call({}, createSidecarModuleId(pageId, templateId, 'template'))
    const sidecarSourceId = createSidecarSourceSpecifier(pageId, templateId, 'template')
    const resolvedSidecarSource = await (plugin.resolveId as any).call({}, sidecarSourceId)
    const sidecarSourceCode = await (plugin.load as any).call({}, sidecarSourceId)
    const styleSourceId = createSidecarSourceSpecifier(pageId, styleId, 'style')
    const styleSourceCode = await (plugin.load as any).call({}, styleSourceId)

    expect(logicalCode).toContain(JSON.stringify(pageId))
    expect(logicalCode).toContain(createSidecarModuleId(pageId, templateId, 'template'))
    expect(sidecarCode).toContain(`${templateId}?raw&`)
    expect(resolvedSidecarSource).toBe(sidecarSourceId)
    expect(sidecarSourceCode).toContain(JSON.stringify(templateId))
    expect(styleSourceId).toContain('&lang.css')
    expect(styleSourceCode).toBeNull()
  })

  it('stubs build externals while leaving normal resolver requests untouched', async () => {
    const ctx = {
      runtimeState: createRuntimeState(),
      moduleGraphService: {
        bindDevServer: vi.fn(),
        getEntryDependencies: vi.fn(() => []),
      },
    } as any
    await createDevModuleGraphProvider(ctx, {
      build: {
        rolldownOptions: {
          external: [/^tdesign-miniprogram(?:\/|$)/],
        },
      } as any,
    }, vi.fn())
    const config = createServerMock.mock.calls[0]![0]
    const plugin = config.plugins[0] as Plugin
    const resolve = vi.fn(async (id: string) => {
      if (id === 'normal-package') {
        return { id: '/resolved/normal-package.js' }
      }
      if (id === 'external-package') {
        return { id, external: true }
      }
      return null
    })
    const externalId = await (plugin.resolveId as any).call(
      { resolve },
      'tdesign-miniprogram/dialog/index',
      '/project/src/app.ts',
    )

    expect(externalId).toContain('module-graph-external')
    expect(await (plugin.load as any).call({}, externalId)).toBe('export default {}')
    await expect((plugin.resolveId as any).call(
      { resolve },
      'normal-package',
      '/project/src/app.ts',
    )).resolves.toEqual({ id: '/resolved/normal-package.js' })
    expect(resolve).toHaveBeenCalledWith('normal-package', '/project/src/app.ts', { skipSelf: true })
    expect(await (plugin.resolveId as any).call(
      { resolve },
      'external-package',
      '/project/src/app.ts',
    )).toContain('module-graph-external')
  })

  it('turns Vue scripts into valid provider modules for static and dynamic imports', async () => {
    const ctx = {
      runtimeState: createRuntimeState(),
      moduleGraphService: {
        bindDevServer: vi.fn(),
        getEntryDependencies: vi.fn(() => []),
      },
    } as any
    await createDevModuleGraphProvider(ctx, {}, vi.fn())
    const config = createServerMock.mock.calls[0]![0]
    const plugin = config.plugins[0] as Plugin
    const result = await (plugin.transform as any).call({}, `
<script setup lang="ts">
import { value } from './shared'
import { label } from './template-only'
import type { Props } from './types-only'
const lazy = () => import('./lazy')
console.log(value, lazy)
</script>
`, '/project/src/pages/home/index.vue')

    expect(result.code).toContain('./template-only')
    expect(result.code).not.toContain('./types-only')
    expect(result.code).toContain('./shared')
    expect(result.code).toContain('import(')
    expect(result.code).toContain('./lazy')
  })

  it('keeps a replacement provider active when old close fails or cleanup repeats', async () => {
    const moduleGraphService = createModuleGraphService()
    const ctx = { moduleGraphService, runtimeState: createRuntimeState() }
    const oldNode = { id: '/src/old.ts', file: '/src/old.ts' }
    const currentNode = { id: '/src/current.ts', file: '/src/current.ts' }
    const oldClose = Promise.withResolvers<void>()
    createServerMock.mockResolvedValueOnce({
      watcher,
      close: () => oldClose.promise,
      moduleGraph: {
        getModuleById: (id: string) => id === oldNode.id ? oldNode : undefined,
        getModulesByFile: (id: string) => id === oldNode.file ? new Set([oldNode]) : undefined,
      },
    })
    const oldProvider = await createDevModuleGraphProvider(ctx, {}, () => {})
    expect(moduleGraphService.hasModule('/src/old.ts')).toBe(true)
    const closing = oldProvider.close()
    const failedClose = expect(closing).rejects.toThrow('old close failed')
    createServerMock.mockResolvedValueOnce({
      watcher,
      close: async () => {},
      moduleGraph: {
        getModuleById: (id: string) => id === currentNode.id ? currentNode : undefined,
        getModulesByFile: (id: string) => id === currentNode.file ? new Set([currentNode]) : undefined,
      },
    })
    const currentProvider = await createDevModuleGraphProvider(ctx, {}, () => {})
    oldClose.reject(new Error('old close failed'))
    await failedClose
    await expect(oldProvider.close()).rejects.toThrow('old close failed')
    expect(moduleGraphService.hasModule('/src/old.ts')).toBe(false)
    expect(moduleGraphService.hasModule('/src/current.ts')).toBe(true)
    await currentProvider.close()
    await currentProvider.close()
    expect(moduleGraphService.hasModule('/src/current.ts')).toBe(false)
  })

  it('drops the failed provider graph even if closing its server rejects', async () => {
    const moduleGraphService = createModuleGraphService()
    const source = '/src/failed.ts'
    createServerMock.mockResolvedValueOnce({
      watcher,
      close: async () => {
        throw new Error('close failed')
      },
      moduleGraph: {
        getModuleById: (id: string) => id === source ? { id: source } : undefined,
        getModulesByFile: (id: string) => id === source ? new Set([{ id: source, file: source }]) : undefined,
      },
    })
    const provider = await createDevModuleGraphProvider({
      moduleGraphService,
      runtimeState: createRuntimeState(),
    }, {}, () => {})
    expect(moduleGraphService.hasModule(source)).toBe(true)
    await expect(provider.close()).rejects.toThrow('close failed')
    expect(moduleGraphService.hasModule(source)).toBe(false)
    expect(moduleGraphService.collectAffectedEntries(source)).toEqual(new Set())
  })
})
