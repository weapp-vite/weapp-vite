import type { CompilerContext, MutableCompilerContext } from '../../context'
import { EventEmitter } from 'node:events'
import { tmpdir } from 'node:os'
import { fs } from '@weapp-core/shared/fs'
import path from 'pathe'
import picomatch from 'picomatch'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { createDevBuildWatcher } from '../buildPlugin/devBuildWatcher'
import { createRuntimeState } from '../runtimeState'
import { attachStatefulHmrHost, createStatefulHmrHostPlugins } from './hostPlugins'
import { runStatefulHmrDev } from './session'

const harness = vi.hoisted(() => ({
  createServer: vi.fn(),
  listen: vi.fn(),
  writeOutput: vi.fn(),
}))

vi.mock('vite', async importOriginal => ({
  ...await importOriginal<typeof import('vite')>(),
  createServer: harness.createServer,
}))
vi.mock('./outputWriter', () => ({ writeStatefulHmrOutput: harness.writeOutput }))
vi.mock('./viteAdapter', () => ({
  StatefulHmrViteAdapter: class {
    install() {}
    async close() {}
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
    watcher: Object.assign(new EventEmitter(), { add: vi.fn() }),
    middlewares: { use: vi.fn() },
    httpServer: { address: () => undefined },
    listen: harness.listen,
    restart: vi.fn(async () => {}),
    close: vi.fn(async () => {}),
  }))
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
