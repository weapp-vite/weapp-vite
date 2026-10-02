import type { MutableCompilerContext } from '../context'
import { mkdir, mkdtemp, realpath, rename, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { WEVU_AUTO_ROUTES_RESOLVED_MODULE_ID } from '@weapp-core/constants'
import { createServer } from 'vite'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createOutputFinalizerPlugin } from '../plugins/outputFinalizer'
import { createRuntimeState } from '../runtime/runtimeState'
import { beginWxmlDependencies } from '../wxml/processing/dependencies'
import { ownsExternalWxmlWatch } from '../wxml/processing/watch'
import { createDevModuleGraphProvider } from './devProvider'
import { createLogicalEntryId } from './protocol'
import { createModuleGraphService } from './service'
import { normalizeSourceId } from './traversal'

describe('dev module graph provider integration', () => {
  const temporaryDirectories: string[] = []

  afterEach(async () => {
    await Promise.all(temporaryDirectories.splice(0).map(directory => rm(directory, {
      force: true,
      recursive: true,
    })))
  })

  it('lets Vite own alias, dynamic import and sidecar importer edges', async () => {
    const root = await realpath(await mkdtemp(path.join(tmpdir(), 'weapp-vite-module-graph-')))
    temporaryDirectories.push(root)
    const pageId = path.join(root, 'page.ts')
    const sharedId = path.join(root, 'shared.ts')
    const lazyId = path.join(root, 'lazy.ts')
    const templateId = path.join(root, 'page.wxml')
    const styleId = path.join(root, 'page.css')
    await Promise.all([
      writeFile(pageId, `import { value } from '@/shared'\nexport const lazy = () => import('./lazy')\nconsole.log(value)\n`, 'utf8'),
      writeFile(sharedId, `export const value = 'shared'\n`, 'utf8'),
      writeFile(lazyId, `export default 'lazy'\n`, 'utf8'),
      writeFile(templateId, '<view>initial</view>\n', 'utf8'),
      writeFile(styleId, '.page { color: red; }\n', 'utf8'),
    ])
    const moduleGraphService = createModuleGraphService()
    moduleGraphService.replaceEntryDependencies(pageId, 'template', [templateId])
    moduleGraphService.replaceEntryDependencies(pageId, 'style', [styleId])
    const onChange = vi.fn()
    const outDir = path.join(root, 'dist')
    const provider = await createDevModuleGraphProvider({
      runtimeState: createRuntimeState(),
      configService: {
        cwd: root,
        outDir,
        inlineConfig: { build: { watch: { chokidar: { usePolling: true, interval: 50 } } } },
      },
      moduleGraphService,
    } as any, {
      root,
      resolve: {
        alias: {
          '@': root,
        },
      },
    }, onChange)

    try {
      await moduleGraphService.syncDevGraph({
        getModuleIds: () => [createLogicalEntryId(pageId, 'page')],
      })

      const normalizedPageId = normalizeSourceId(pageId)
      expect(moduleGraphService.collectAffectedEntries(sharedId)).toEqual(new Set([normalizedPageId]))
      expect(moduleGraphService.collectAffectedEntries(lazyId)).toEqual(new Set([normalizedPageId]))
      expect(moduleGraphService.collectAffectedEntries(templateId)).toEqual(new Set([normalizedPageId]))
      expect(moduleGraphService.collectAffectedEntries(styleId)).toEqual(new Set([normalizedPageId]))

      const replacementTemplateId = `${templateId}.tmp`
      await writeFile(replacementTemplateId, '<view>updated</view>\n', 'utf8')
      await rename(replacementTemplateId, templateId)
      await vi.waitFor(() => expect(onChange).toHaveBeenCalledWith({
        event: expect.stringMatching(/^(?:create|update)$/),
        file: normalizeSourceId(templateId),
      }))
      await writeFile(styleId, '.page { color: blue; }\n', 'utf8')
      await vi.waitFor(() => expect(onChange).toHaveBeenCalledWith({
        event: 'update',
        file: normalizeSourceId(styleId),
      }))
    }
    finally {
      await provider.close()
    }
    await provider.close()
    expect(moduleGraphService.hasModule(sharedId)).toBe(false)
    expect(moduleGraphService.collectAffectedEntries(sharedId)).toEqual(new Set())
    expect(moduleGraphService.collectAffectedEntries(templateId)).toEqual(new Set([normalizeSourceId(pageId)]))
    moduleGraphService.removeEntryDependencies(pageId)
    expect(moduleGraphService.hasModule(templateId)).toBe(false)
    expect(moduleGraphService.collectAffectedEntries(styleId)).toEqual(new Set())
  })

  it('lets Vite replace compiler transform dependency edges without retaining stale owners', async () => {
    const root = await realpath(await mkdtemp(path.join(tmpdir(), 'weapp-vite-compiler-graph-')))
    temporaryDirectories.push(root)
    const pageId = path.join(root, 'page.ts')
    const styleId = path.join(root, 'page.css')
    const first = path.join(root, 'first.tokens')
    const second = path.join(root, 'second.tokens')
    await Promise.all([
      writeFile(pageId, 'export default {}'),
      writeFile(styleId, '.page { color: red; }'),
      writeFile(first, 'red'),
      writeFile(second, 'blue'),
    ])
    const moduleGraphService = createModuleGraphService()
    moduleGraphService.replaceEntryDependencies(pageId, 'style', [styleId])
    moduleGraphService.replaceTransformDependencies(styleId, [first])
    const provider = await createDevModuleGraphProvider({
      runtimeState: createRuntimeState(),
      configService: { cwd: root, outDir: path.join(root, 'dist') },
      moduleGraphService,
    } as unknown as MutableCompilerContext, { root }, () => {})
    const graph = { getModuleIds: () => [createLogicalEntryId(pageId, 'page')] }
    try {
      await moduleGraphService.syncDevGraph(graph)
      expect(moduleGraphService.collectAffectedEntries(first)).toEqual(new Set([normalizeSourceId(pageId)]))
      moduleGraphService.replaceTransformDependencies(styleId, [second])
      await moduleGraphService.syncDevGraph(graph)
      expect(moduleGraphService.collectAffectedEntries(first)).toEqual(new Set())
      expect(moduleGraphService.collectAffectedEntries(second)).toEqual(new Set([normalizeSourceId(pageId)]))
      moduleGraphService.replaceTransformDependencies(styleId, [])
      await moduleGraphService.syncDevGraph(graph)
      expect(moduleGraphService.collectAffectedEntries(second)).toEqual(new Set())
    }
    finally {
      await provider.close()
    }
  })

  it('ignores generated output while observing source changes', async () => {
    const root = await realpath(await mkdtemp(path.join(tmpdir(), 'weapp-vite-output-watch-')))
    temporaryDirectories.push(root)
    const pageId = path.join(root, 'page.ts')
    const styleId = path.join(root, 'page.css')
    await Promise.all([
      writeFile(pageId, 'export const page = true\n'),
      writeFile(styleId, '.page { color: red; }\n'),
    ])
    const moduleGraphService = createModuleGraphService()
    moduleGraphService.replaceEntryDependencies(pageId, 'style', [styleId])
    const onChange = vi.fn()
    const ready = Promise.withResolvers<void>()
    const outDir = path.join(root, 'dist')
    const provider = await createDevModuleGraphProvider({
      runtimeState: createRuntimeState(),
      configService: {
        cwd: root,
        outDir,
        inlineConfig: { build: { watch: { chokidar: { usePolling: true, interval: 50 } } } },
      },
      moduleGraphService,
    } as unknown as MutableCompilerContext, {
      root,
      plugins: [{ name: 'test:watch-ready', configureServer(server) { server.watcher.once('ready', () => ready.resolve()) } }],
    }, onChange)
    try {
      await ready.promise
      await moduleGraphService.syncDevGraph({ getModuleIds: () => [createLogicalEntryId(pageId, 'page')] })
      // 独立会话内先验证输出忽略，避免前一次源码变更的延迟通知进入负断言窗口。
      const generatedVantConfig = path.join(outDir, 'miniprogram_npm/@vant/weapp/field/index.json')
      await mkdir(path.dirname(generatedVantConfig), { recursive: true })
      await writeFile(generatedVantConfig, '{"component":true}\n', 'utf8')
      await new Promise(resolve => setTimeout(resolve, 500))
      expect(onChange).not.toHaveBeenCalled()

      await writeFile(styleId, '.page { color: blue; }\n', 'utf8')
      await vi.waitFor(() => expect(onChange).toHaveBeenCalledWith({
        event: 'update',
        file: normalizeSourceId(styleId),
      }))
    }
    finally {
      await provider.close()
    }
  })

  it('observes external WXML dependency deletion and recreation without a module node', async () => {
    const root = await realpath(await mkdtemp(path.join(tmpdir(), 'weapp-vite-wxml-input-')))
    temporaryDirectories.push(root)
    const project = path.join(root, 'project')
    const dependency = path.join(root, 'rules.json')
    await mkdir(project)
    await writeFile(dependency, '{}')
    const runtimeState = createRuntimeState()
    runtimeState.wxmlProcessing.references.set(normalizeSourceId(dependency), 1)
    const moduleGraphService = createModuleGraphService()
    const onChange = vi.fn()
    const ready = Promise.withResolvers<void>()
    const provider = await createDevModuleGraphProvider({
      runtimeState,
      configService: { cwd: project, outDir: path.join(project, 'dist') },
      moduleGraphService,
    } as unknown as MutableCompilerContext, {
      root: project,
      plugins: [{ name: 'test:watch-ready', configureServer(server) { server.watcher.once('ready', () => ready.resolve()) } }],
    }, onChange)
    try {
      await ready.promise
      expect(moduleGraphService.hasModule(dependency)).toBe(false)
      await writeFile(dependency, '{"label":"changed"}')
      await vi.waitFor(() => expect(onChange).toHaveBeenCalledWith({ event: 'update', file: normalizeSourceId(dependency) }))
      await rm(dependency)
      await vi.waitFor(() => expect(onChange).toHaveBeenCalledWith({ event: 'delete', file: normalizeSourceId(dependency) }))
      await writeFile(dependency, '{"label":"restored"}')
      await vi.waitFor(() => expect(onChange).toHaveBeenCalledWith({ event: 'create', file: normalizeSourceId(dependency) }))
    }
    finally {
      await provider.close()
    }
  })

  it('observes a later registered existing sibling without another directory mutation', async () => {
    const root = await realpath(await mkdtemp(path.join(tmpdir(), 'weapp-vite-wxml-late-input-')))
    temporaryDirectories.push(root)
    const project = path.join(root, 'project')
    const initial = path.join(root, 'initial.json')
    const sibling = path.join(root, 'sibling.json')
    await mkdir(project)
    await Promise.all([writeFile(initial, '{}'), writeFile(sibling, '{}')])
    const runtimeState = createRuntimeState()
    runtimeState.wxmlProcessing.references.set(normalizeSourceId(initial), 1)
    const ctx = {
      runtimeState,
      configService: { cwd: project, outDir: path.join(project, 'dist') },
      moduleGraphService: createModuleGraphService(),
    } as unknown as MutableCompilerContext
    const onChange = vi.fn()
    const provider = await createDevModuleGraphProvider(ctx, { root: project }, onChange)
    try {
      const transaction = beginWxmlDependencies(ctx, 'main', false)
      transaction.template('page.wxml')(sibling)
      transaction.commit()
      await writeFile(sibling, '{"label":"first-save"}')
      await vi.waitFor(() => expect(onChange).toHaveBeenCalledWith({
        event: expect.stringMatching(/^(?:create|update)$/),
        file: normalizeSourceId(sibling),
      }))
      await rm(sibling)
      await vi.waitFor(() => expect(onChange).toHaveBeenCalledWith({ event: 'delete', file: normalizeSourceId(sibling) }))
      await writeFile(sibling, '{"label":"restored"}')
      await vi.waitFor(() => expect(onChange).toHaveBeenCalledWith({ event: 'create', file: normalizeSourceId(sibling) }))
    }
    finally {
      await provider.close()
    }
  })

  it('releases external input ownership when a middleware host closes', async () => {
    const root = await realpath(await mkdtemp(path.join(tmpdir(), 'weapp-vite-wxml-middleware-')))
    temporaryDirectories.push(root)
    const project = path.join(root, 'project')
    const dependency = path.join(root, 'rules.json')
    await mkdir(project)
    await writeFile(dependency, '{}')
    const runtimeState = createRuntimeState()
    runtimeState.wxmlProcessing.references.set(normalizeSourceId(dependency), 1)
    const ctx = { runtimeState, configService: { cwd: project } } as unknown as MutableCompilerContext
    const unrelated = vi.fn()
    runtimeState.wxmlProcessing.listeners.add(unrelated)
    const server = await createServer({
      configFile: false,
      root: project,
      server: { middlewareMode: true },
      plugins: [createOutputFinalizerPlugin(ctx)],
    })
    try {
      expect(server.httpServer).toBeNull()
      expect(ownsExternalWxmlWatch(ctx, dependency)).toBe(true)
      await server.close()
      expect(ownsExternalWxmlWatch(ctx, dependency)).toBe(false)
      expect(runtimeState.wxmlProcessing.listeners).toEqual(new Set([unrelated]))
      await server.close()
    }
    finally {
      await server.close()
    }
  })

  it('tracks named route data through an external SFC script and conflicting router alias', async () => {
    const root = await realpath(await mkdtemp(path.join(tmpdir(), 'weapp-vite-named-route-graph-')))
    temporaryDirectories.push(root)
    const pageId = path.join(root, 'page.vue')
    const scriptId = path.join(root, 'page-script.ts')
    await Promise.all([
      writeFile(pageId, '<script setup lang="ts" src="@/page-script.ts"></script>\n'),
      writeFile(scriptId, `import { routes } from 'wevu/router/auto-routes'\nconsole.log(routes)\n`),
    ])
    const moduleGraphService = createModuleGraphService()
    const provider = await createDevModuleGraphProvider({
      runtimeState: createRuntimeState(),
      configService: { cwd: root, outDir: path.join(root, 'dist') },
      moduleGraphService,
      autoRoutesService: {
        async ensureFresh() {},
        getNamedModuleCode: () => 'export const routes = [{ name: "home", path: "/page", meta: {} }];',
      },
    } as unknown as MutableCompilerContext, {
      root,
      resolve: {
        alias: {
          '@': root,
          'wevu/router': path.join(root, 'router.mjs'),
        },
      },
    }, () => {})

    try {
      await moduleGraphService.syncDevGraph({
        getModuleIds: () => [createLogicalEntryId(pageId, 'page')],
      })
      const expectedEntries = new Set([normalizeSourceId(pageId)])
      expect(moduleGraphService.collectAffectedEntries(scriptId)).toEqual(expectedEntries)
      expect(moduleGraphService.invalidate(WEVU_AUTO_ROUTES_RESOLVED_MODULE_ID)).toEqual(expectedEntries)
    }
    finally {
      await provider.close()
    }
  })
})
