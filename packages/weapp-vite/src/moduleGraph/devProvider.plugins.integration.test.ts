import type { InlineConfig, Plugin, ViteDevServer } from 'vite'
import { mkdtemp, realpath, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { build } from 'vite'
import { afterEach, expect, it, vi } from 'vitest'
import { createRuntimeState } from '../runtime/runtimeState'
import { createDevModuleGraphProvider } from './devProvider'
import { createLogicalEntryId } from './protocol'
import { createModuleGraphService } from './service'
import { normalizeSourceId } from './traversal'

const resources = vi.hoisted(() => ({ servers: [] as ViteDevServer[], roots: [] as string[] }))

vi.mock('vite', async (importOriginal) => {
  const actual = await importOriginal<typeof import('vite')>()
  return {
    ...actual,
    async createServer(options: InlineConfig) {
      const server = await actual.createServer({
        ...options,
        server: { ...options.server, watch: null, hmr: false },
      })
      resources.servers.push(server)
      return server
    },
  }
})

afterEach(async () => {
  await Promise.all(resources.servers.splice(0).map(server => server.close()))
  await Promise.all(resources.roots.splice(0).map(root => rm(root, { recursive: true, force: true })))
})

it('borrows resolver hooks after the real build initializes them without acquiring its lifecycle (#1303)', async () => {
  const root = await realpath(await mkdtemp(path.join(os.tmpdir(), 'graph-plugin-owner-')))
  resources.roots.push(root)
  const entry = path.join(root, 'entry.js')
  const dependency = path.join(root, 'dependency.js')
  await writeFile(entry, 'export { marker } from "virtual:owner-runtime"')
  await writeFile(dependency, 'export const marker = "owner-runtime"')
  let initialized = false
  const lifecycle = { config: vi.fn(), resolved: vi.fn(), start: vi.fn(), close: vi.fn() }
  const owner: Plugin = {
    name: 'third-party:compiler-owner',
    config() { lifecycle.config() },
    configResolved(config) {
      lifecycle.resolved()
      if (!config.plugins.some(plugin => plugin.name === 'weapp-vite:context')) {
        throw new Error('Existing subpackages require the compiler context.')
      }
      initialized = true
    },
    buildStart() {
      lifecycle.start()
      if (!initialized) {
        throw new Error('Build started before target resolution.')
      }
    },
    resolveId(id) {
      return id === 'virtual:owner-runtime' ? '\0owner-runtime' : null
    },
    load(id) {
      if (id === '\0owner-runtime') {
        if (!initialized) {
          throw new Error('Runtime loaded before target resolution.')
        }
        return `export { marker } from ${JSON.stringify(dependency)}`
      }
    },
    closeBundle() { lifecycle.close() },
  }
  const moduleGraphService = createModuleGraphService()
  const config: InlineConfig = {
    root,
    configFile: false,
    logLevel: 'silent',
    optimizeDeps: { noDiscovery: true, include: [] },
    plugins: [{ name: 'weapp-vite:context' }, [Promise.resolve(owner)]],
    build: { write: false, minify: false, rolldownOptions: { input: entry } },
  }
  const provider = await createDevModuleGraphProvider({
    runtimeState: createRuntimeState(),
    configService: { cwd: root, outDir: path.join(root, 'dist'), inlineConfig: {} },
    moduleGraphService,
  } as never, config, () => {})
  try {
    for (const hook of Object.values(lifecycle)) {
      expect(hook).not.toHaveBeenCalled()
    }
    await build(config)
    await moduleGraphService.syncDevGraph({ getModuleIds: () => [createLogicalEntryId(entry, 'page')] })
    expect(moduleGraphService.collectAffectedEntries(dependency)).toEqual(new Set([normalizeSourceId(entry)]))
    for (const hook of Object.values(lifecycle)) {
      expect(hook).toHaveBeenCalledOnce()
    }
  }
  finally {
    await provider.close()
  }
  expect(lifecycle.close).toHaveBeenCalledOnce()
})

it.each(['ts', 'mts', 'cts'])('lets the native graph replace typed %s require.async and callback dependencies instead of retaining stale edges (#1304)', async (extension) => {
  const root = await realpath(await mkdtemp(path.join(os.tmpdir(), 'graph-native-async-')))
  resources.roots.push(root)
  const entry = path.join(root, `entry.${extension}`)
  const first = path.join(root, 'first.ts')
  const second = path.join(root, 'second.ts')
  await writeFile(entry, 'const value: number = 1; export const load = () => require.async("./first.js");')
  await writeFile(first, 'export const marker = "first"')
  await writeFile(second, 'export const marker = "second"')
  const moduleGraphService = createModuleGraphService()
  const provider = await createDevModuleGraphProvider({
    runtimeState: createRuntimeState(),
    configService: { cwd: root, outDir: path.join(root, 'dist'), inlineConfig: {} },
    moduleGraphService,
  } as never, { root, configFile: false, optimizeDeps: { noDiscovery: true, include: [] } }, () => {})
  const graph = { getModuleIds: () => [createLogicalEntryId(entry, 'page')] }
  const expected = new Set([normalizeSourceId(entry)])
  const invalidate = () => resources.servers.at(-1)!.environments.client.moduleGraph.invalidateAll()
  try {
    await moduleGraphService.syncDevGraph(graph)
    expect(moduleGraphService.collectAffectedEntries(first)).toEqual(expected)
    await writeFile(entry, 'export const load = () => require("./second.js", () => {});')
    invalidate()
    await moduleGraphService.syncDevGraph(graph)
    expect(moduleGraphService.collectAffectedEntries(first)).toEqual(new Set())
    expect(moduleGraphService.collectAffectedEntries(second)).toEqual(expected)
    await writeFile(entry, 'export const load = () => "removed";')
    invalidate()
    await moduleGraphService.syncDevGraph(graph)
    expect(moduleGraphService.collectAffectedEntries(second)).toEqual(new Set())
    await writeFile(entry, 'export const load = () => require.async("./first.js");')
    invalidate()
    await moduleGraphService.syncDevGraph(graph)
    expect(moduleGraphService.collectAffectedEntries(first)).toEqual(expected)
  }
  finally {
    await provider.close()
  }
})
