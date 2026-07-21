import type { Plugin } from 'vite'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createLogicalEntryId, createSidecarModuleId, createSidecarSourceSpecifier } from './protocol'

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
    const { createDevModuleGraphProvider } = await import('./devProvider')
    const resolver = { name: 'vite-tsconfig-paths' }
    const internal = { name: 'weapp-vite:pre' }
    const bindDevServer = vi.fn()
    const ctx = {
      moduleGraphService: {
        bindDevServer,
        getEntryDependencies: vi.fn(() => []),
      },
    } as any
    const onChange = vi.fn()

    const provider = await createDevModuleGraphProvider(ctx, {
      plugins: [internal, resolver],
      build: { write: true, watch: {} },
    }, onChange)

    const config = createServerMock.mock.calls[0]![0]
    expect(config.server).toMatchObject({ hmr: false, middlewareMode: true })
    expect(config.build).toMatchObject({ watch: undefined, write: false })
    expect(config.plugins).toEqual([expect.objectContaining({ name: 'weapp-vite:module-graph-provider' }), resolver])
    expect(bindDevServer).toHaveBeenCalledWith(server)
    expect(watcher.on).toHaveBeenCalledWith('change', onChange)

    await provider.close()
    expect(watcher.off).toHaveBeenCalledWith('change', onChange)
    expect(close).toHaveBeenCalled()
    expect(bindDevServer).toHaveBeenLastCalledWith(undefined)
  })

  it('loads logical entry and sidecar modules from stable metadata', async () => {
    const { createDevModuleGraphProvider } = await import('./devProvider')
    const pageId = '/project/src/pages/home/index.ts'
    const templateId = '/project/src/pages/home/index.wxml'
    const ctx = {
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

    expect(logicalCode).toContain(JSON.stringify(pageId))
    expect(logicalCode).toContain(createSidecarModuleId(pageId, templateId, 'template'))
    expect(sidecarCode).toContain(`${templateId}?raw&`)
    expect(resolvedSidecarSource).toBe(sidecarSourceId)
    expect(sidecarSourceCode).toContain(JSON.stringify(templateId))
  })

  it('stubs build externals while leaving normal resolver requests untouched', async () => {
    const { createDevModuleGraphProvider } = await import('./devProvider')
    const ctx = {
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
    const { createDevModuleGraphProvider } = await import('./devProvider')
    const ctx = {
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
const lazy = () => import('./lazy')
console.log(value, lazy)
</script>
`, '/project/src/pages/home/index.vue')

    expect(result.code).toContain('./shared')
    expect(result.code).toContain('import(')
    expect(result.code).toContain('./lazy')
  })
})
