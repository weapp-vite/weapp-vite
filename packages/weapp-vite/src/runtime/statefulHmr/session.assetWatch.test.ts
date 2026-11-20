import type { CompilerContext, MutableCompilerContext } from '../../context'
import { tmpdir } from 'node:os'
import { fs } from '@weapp-core/shared/fs'
import path from 'pathe'
import picomatch from 'picomatch'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { createMockViteWatcher } from '../../../test/helpers/viteWatcher'
import { createDevBuildWatcher } from '../buildPlugin/devBuildWatcher'
import { getHmrRuntimeSession } from '../hmrRuntimeSession'
import { createRuntimeState } from '../runtimeState'
import { attachStatefulHmrHost, createStatefulHmrHostPlugins } from './hostPlugins'
import { prepareStatefulClassicHandoff, runStatefulHmrDev } from './session'

const harness = vi.hoisted(() => ({
  createServer: vi.fn(),
  listen: vi.fn(),
  writeOutput: vi.fn(),
  closeAdapter: vi.fn(),
}))

vi.mock('vite', async importOriginal => ({
  ...await importOriginal<typeof import('vite')>(),
  createServer: harness.createServer,
}))
vi.mock('./outputWriter', () => ({ writeStatefulHmrOutput: harness.writeOutput }))
vi.mock('./viteAdapter', () => ({
  StatefulHmrViteAdapter: class {
    install() {}
    async close() { await harness.closeAdapter() }
    async start() { await harness.listen() }
  },
}))
vi.mock('../watch/assets', () => ({
  watchAssetSources: () => ({ ready: Promise.resolve(), close: async () => {} }),
}))

let root: string

beforeEach(async () => {
  vi.resetAllMocks()
  root = await fs.mkdtemp(path.join(tmpdir(), 'stateful-asset-lease-'))
  harness.createServer.mockImplementation(async (inlineConfig = {}) => ({
    config: { inlineConfig, root, publicDir: false, build: {}, server: {}, logger: { error: vi.fn() } },
    watcher: createMockViteWatcher(),
    middlewares: { use: vi.fn() },
    httpServer: { address: () => undefined },
    listen: harness.listen,
    restart: vi.fn(async () => {}),
    close: vi.fn(async () => {}),
  }))
})

it.each([false, true])('hands the asset lease to classic only after every old resource closes: borrowed %s', async (borrowed) => {
  const configPath = path.join(root, 'project.private.config.json')
  const original = '{"setting":{"compileHotReLoad":true}}'
  await fs.writeFile(configPath, original)
  const ctx = {
    runtimeState: createRuntimeState(),
    configService: {
      platform: 'weapp',
      cwd: root,
      absoluteSrcRoot: path.join(root, 'src'),
      outDir: path.join(root, 'dist'),
      projectPrivateConfigPath: configPath,
      multiPlatform: { enabled: false },
      weappViteConfig: {},
    },
  } as unknown as MutableCompilerContext
  const host = borrowed ? await harness.createServer() : undefined
  const detach = host ? attachStatefulHmrHost(ctx as CompilerContext, { server: host, controller: createStatefulHmrHostPlugins(ctx as CompilerContext) }) : undefined
  const watcher = await runStatefulHmrDev(ctx, { root }, async () => {}, {
    entryIds: [],
    initial: { output: [], componentPageGlobalStyleRoutes: [], glassEaselAnalysisByOwner: new Map() },
    rebuild: async () => { throw new Error('Unexpected snapshot') },
  }, createDevBuildWatcher())
  const runtime = getHmrRuntimeSession(ctx)
  const closing = Promise.withResolvers<void>()
  const release = Promise.withResolvers<void>()
  harness.closeAdapter.mockImplementation(async () => {
    closing.resolve()
    await release.promise
  })
  const activate = vi.spyOn(runtime.classicIdeConfig, 'activate')
  const handoff = vi.spyOn(runtime.classicIdeConfig, 'addPendingAssetHandoff')
  prepareStatefulClassicHandoff(ctx)
  const task = watcher.close()
  await closing.promise
  expect(activate).not.toHaveBeenCalled()
  expect(handoff).not.toHaveBeenCalled()
  expect((await fs.readJSON(configPath) as { setting: { compileHotReLoad: boolean } }).setting.compileHotReLoad).toBe(true)
  release.resolve()
  await task
  expect(activate).not.toHaveBeenCalled()
  expect(handoff).toHaveBeenCalledExactlyOnceWith(configPath, { assetOwner: expect.any(String), outDir: ctx.configService!.outDir })
  expect(runtime.classicIdeConfig.hasPendingAssetHandoff(configPath, ctx.configService!.outDir)).toBe(true)
  expect((await fs.readJSON(configPath) as { setting: { compileHotReLoad: boolean } }).setting.compileHotReLoad).toBe(true)
  expect(await runtime.classicIdeConfig.readRequested(configPath)).toBe(original)
  // 完整 classic 原生发布才激活交接；关闭旧 adapter 本身不能提前改变 IDE 重载模式。
  expect(await runtime.classicIdeConfig.activatePendingAssetHandoff(configPath, ctx.configService!.outDir)).toBe(true)
  expect(runtime.classicIdeConfig.hasPendingAssetHandoff(configPath)).toBe(false)
  expect(await fs.readJSON(configPath)).toEqual({ setting: { compileHotReLoad: false } })
  expect(await runtime.classicIdeConfig.readRequested(configPath)).toBe(original)
  await runtime.classicIdeConfig.close()
  expect(await fs.readFile(configPath, 'utf8')).toBe(original)
  detach?.()
})

it.each(['failed-resource', 'terminal-started', 'different-project'] as const)('does not transfer an unsafe or unrelated close: %s', async (kind) => {
  const configPath = path.join(root, 'project.private.config.json')
  const original = '{"setting":{"compileHotReLoad":true}}'
  await fs.writeFile(configPath, original)
  const ctx = {
    runtimeState: createRuntimeState(),
    configService: {
      platform: 'weapp',
      cwd: root,
      absoluteSrcRoot: path.join(root, 'src'),
      outDir: path.join(root, 'dist'),
      projectPrivateConfigPath: configPath,
      multiPlatform: { enabled: false },
      weappViteConfig: {},
    },
  } as unknown as MutableCompilerContext
  const watcher = await runStatefulHmrDev(ctx, { root }, async () => {}, {
    entryIds: [],
    initial: { output: [], componentPageGlobalStyleRoutes: [], glassEaselAnalysisByOwner: new Map() },
    rebuild: async () => { throw new Error('Unexpected snapshot') },
  }, createDevBuildWatcher())
  const runtime = getHmrRuntimeSession(ctx)
  const activate = vi.spyOn(runtime.classicIdeConfig, 'activate')
  const handoff = vi.spyOn(runtime.classicIdeConfig, 'addPendingAssetHandoff')
  const failure = new Error('old adapter close failed')
  const entered = Promise.withResolvers<void>()
  const release = Promise.withResolvers<void>()
  if (kind === 'terminal-started') {
    harness.closeAdapter.mockImplementation(async () => {
      entered.resolve()
      await release.promise
    })
  }
  if (kind === 'failed-resource') {
    harness.closeAdapter.mockRejectedValueOnce(failure)
    prepareStatefulClassicHandoff(ctx)
  }
  if (kind === 'different-project') {
    prepareStatefulClassicHandoff({})
  }
  const task = watcher.close()
  if (kind === 'terminal-started') {
    // standalone host 在 microtask 中关闭会话；等待 adapter 进入关闭，锁住 terminal 意图。
    await entered.promise
    prepareStatefulClassicHandoff(ctx)
    release.resolve()
  }
  if (kind === 'failed-resource') {
    await expect(task).rejects.toBe(failure)
    await expect(watcher.close()).rejects.toBe(failure)
  }
  else {
    await task
  }
  expect(activate).not.toHaveBeenCalled()
  expect(handoff).not.toHaveBeenCalled()
  expect(runtime.classicIdeConfig.hasPendingAssetHandoff(configPath)).toBe(false)
  expect(await fs.readFile(configPath, 'utf8')).toBe(original)
  await runtime.classicIdeConfig.close()
})

afterEach(async () => {
  await fs.remove(root)
})

it.each([
  { multiPlatform: false, failStartup: false },
  { multiPlatform: true, failStartup: false },
  { multiPlatform: false, failStartup: true },
].flatMap(options => [false, true].map(borrowed => ({ ...options, borrowed }))))('owns and restores the IDE asset rule: $multiPlatform / startup failure $failStartup / borrowed $borrowed', async ({ multiPlatform, failStartup, borrowed }) => {
  const sourceConfigPath = path.join(root, 'project.private.config.json')
  const outDir = path.join(root, multiPlatform ? 'dist/weapp' : 'dist')
  const configPath = multiPlatform ? path.join(root, 'dist/project.private.config.json') : sourceConfigPath
  const original = '{"setting":{"compileHotReLoad":true},"watchOptions":{"ignore":["scratch/**"]}}\n'
  await fs.outputFile(configPath, original)
  const ctx = {
    runtimeState: createRuntimeState(),
    configService: {
      platform: 'weapp',
      cwd: root,
      absoluteSrcRoot: path.join(root, 'src'),
      outDir,
      projectPrivateConfigPath: sourceConfigPath,
      multiPlatform: { enabled: multiPlatform },
      weappViteConfig: {},
    },
  } as unknown as MutableCompilerContext
  const assertRule = async () => {
    const config = await fs.readJSON(configPath) as { watchOptions: { ignore: string[] } }
    const ignored = picomatch(config.watchOptions.ignore)
    const prefix = multiPlatform ? 'weapp' : 'dist'
    expect(ignored(`${prefix}/resources/changed.png`)).toBe(true)
    expect(ignored(`${prefix}/tab.png`)).toBe(false)
    expect(ignored(`${prefix}/pages/index.js`)).toBe(false)
  }
  harness.listen.mockImplementation(async () => {
    await assertRule()
    if (failStartup) {
      throw new Error('Host startup failed')
    }
  })
  harness.writeOutput.mockImplementation(assertRule)
  const hostServer = borrowed ? await harness.createServer() : undefined
  const detach = hostServer
    ? attachStatefulHmrHost(ctx as CompilerContext, {
        server: hostServer,
        controller: createStatefulHmrHostPlugins(ctx as CompilerContext),
      })
    : undefined
  const start = runStatefulHmrDev(ctx, { root }, async () => {}, {
    entryIds: [],
    initial: {
      output: [{ type: 'asset', fileName: 'app.json', source: JSON.stringify({ tabBar: { list: [{ iconPath: 'tab.png' }] } }) }],
      componentPageGlobalStyleRoutes: [],
      glassEaselAnalysisByOwner: new Map(),
    },
    rebuild: async () => { throw new Error('Unexpected snapshot') },
  }, createDevBuildWatcher())
  if (failStartup) {
    await expect(start).rejects.toThrow('Host startup failed')
  }
  else {
    const watcher = await start
    await assertRule()
    if (!borrowed) {
      // Vite 的信号退出直接关闭服务器，不一定经过公开 watcher。
      const server = await harness.createServer.mock.results[0]!.value
      await server.close()
    }
    await watcher.close()
    await watcher.close()
  }
  expect(await fs.readFile(configPath, 'utf8')).toBe(original)
  expect(await fs.pathExists(path.join(path.dirname(configPath), '.weapp-vite/ide-asset-watch.json'))).toBe(false)
  if (hostServer) {
    expect(hostServer.close).not.toHaveBeenCalled()
  }
  detach?.()
})
