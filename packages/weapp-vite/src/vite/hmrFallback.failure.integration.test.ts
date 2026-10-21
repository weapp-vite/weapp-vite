import type { Logger, Plugin, ViteDevServer } from 'vite'
import type { HmrRuntimePhase } from '../runtime/hmrRuntimeSession'
import type { WeappVitePluginApi } from '../types'
import { mkdir, mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { createServer } from 'vite'
import { expect, it, vi } from 'vitest'
import { logger as buildLogger } from '../context/shared'
import { getHmrRuntimeSession } from '../runtime/hmrRuntimeSession'
import { weapp } from './index'

async function fixture() {
  const root = await realpath(await mkdtemp(path.join(os.tmpdir(), 'weapp-vite-classic-failure-')))
  const failure = new Error('classic-first-publication-failed')
  const phasesAtFailure: HmrRuntimePhase[] = []
  const hosts: Array<{
    server: ViteDevServer
    watcher: ViteDevServer['watcher']
    watcherCloseCalls: () => number
    wsCloseCalls: () => number
    restore: () => void
  }> = []
  const logger = {
    info: vi.fn(),
    warn: vi.fn(),
    warnOnce: vi.fn(),
    error: vi.fn<Logger['error']>(),
    clearScreen: vi.fn(),
    hasErrorLogged: vi.fn(() => false),
    hasWarned: false,
  } satisfies Logger
  const buildErrors = vi.spyOn(buildLogger, 'error')
  let failClassicPublication = false
  let publications = 0
  for (const [file, content] of Object.entries({
    'package.json': '{"name":"classic-failure-fixture","type":"module"}',
    'project.config.json': '{"miniprogramRoot":"dist"}',
    'project.private.config.json': '{"setting":{"compileHotReLoad":true}}',
    'src/app.js': 'App({})',
    'src/app.json': '{"pages":["pages/home/index"]}',
    'src/pages/home/index.js': 'Page({ data: { marker: "before-classic-failure" } })',
    'src/pages/home/index.json': '{}',
    'src/pages/home/index.wxml': '<view>{{marker}}</view>',
  })) {
    await mkdir(path.dirname(path.join(root, file)), { recursive: true })
    await writeFile(path.join(root, file), content)
  }
  const probe: Plugin = {
    name: 'classic-first-publication-failure',
    enforce: 'pre',
    configResolved(config) {
      if (config.command === 'serve' && config.experimental.bundledDev === false) {
        failClassicPublication = true
      }
    },
    configureServer(server) {
      // 先登记原生 owner，下一插件的 classic 首构失败时也必须观察到它的释放。
      const watcherClose = vi.spyOn(server.watcher, 'close')
      const wsClose = vi.spyOn(server.ws, 'close')
      hosts.push({
        server,
        watcher: server.watcher,
        watcherCloseCalls: () => watcherClose.mock.calls.length,
        wsCloseCalls: () => wsClose.mock.calls.length,
        restore() {
          watcherClose.mockRestore()
          wsClose.mockRestore()
        },
      })
    },
    generateBundle() {
      if (!failClassicPublication || this.environment.mode !== 'build') {
        return
      }
      failClassicPublication = false
      const api = this.environment.config.plugins.find(plugin => plugin.name === 'weapp-vite:context')?.api as WeappVitePluginApi | undefined
      if (!api) {
        throw new Error('Classic build did not expose its compiler context')
      }
      phasesAtFailure.push(getHmrRuntimeSession(api.ctx).phase)
      throw failure
    },
    writeBundle() {
      publications += 1
    },
  }
  return {
    root,
    hosts,
    logger,
    buildErrors,
    failure,
    phasesAtFailure,
    publications: () => publications,
    read: (file: string) => readFile(path.join(root, 'dist', file), 'utf8'),
    save: (marker: string) => writeFile(path.join(root, 'src/pages/home/index.js'), `Page({ data: { marker: ${JSON.stringify(marker)} } })`),
    start: (requested: 'classic' | 'stateful-experimental', unsupported = false) => createServer({
      root,
      configFile: false,
      customLogger: logger,
      logLevel: 'silent',
      weapp: {
        srcRoot: 'src',
        autoRoutes: false,
        vue: { enable: false },
        hmr: { runtime: requested },
        compilerPlugins: unsupported
          ? [{ name: 'legacy-content', capabilities: { content: true }, create() { return {} } }]
          : [],
      },
      // 错误注入不使用 Web 客户端，独立关闭其 WebSocket 以免测试 worker 争用默认端口。
      server: { middlewareMode: true, host: '127.0.0.1', port: 0, ws: false },
      plugins: [probe, weapp()],
    }),
    cleanup: async () => {
      try {
        await Promise.all(hosts.map(host => host.server.close()))
      }
      finally {
        buildErrors.mockRestore()
        for (const host of hosts) {
          host.restore()
        }
        await rm(root, { recursive: true, force: true })
      }
    },
  }
}

type Fixture = Awaited<ReturnType<typeof fixture>>

function expectOwnersClosed(project: Fixture) {
  for (const host of project.hosts) {
    expect(host.watcherCloseCalls()).toBe(1)
    expect(host.wsCloseCalls()).toBe(1)
    expect(host.watcher.getWatched()).toEqual({})
  }
}

function expectOriginalFailure(project: Fixture) {
  // 借用宿主的原生重启走 Vite logger，普通 classic 的纠错构建走仓库 logger。
  const messages = [...project.logger.error.mock.calls, ...project.buildErrors.mock.calls].flat()
  expect(messages.some(message => (message instanceof Error ? message.message : String(message)).includes(project.failure.message))).toBe(true)
}

async function readPublishedScript(project: Fixture): Promise<string | undefined> {
  try {
    return await project.read('pages/home/index.js')
  }
  catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
      return undefined
    }
    throw error
  }
}

it('rejects a startup capability fallback when its first classic publication fails and closes the failed host', async () => {
  const project = await fixture()
  try {
    await expect(project.start('stateful-experimental', true)).rejects.toThrow(project.failure.message)
    expect(project.phasesAtFailure).toEqual(['switching'])
    expect(project.hosts).toHaveLength(1)
    // 初始化失败直接拒绝调用方；上述原始错误断言即为该入口的错误证据。
    expectOwnersClosed(project)
    await Promise.all(project.hosts.map(host => host.server.close()))
    expectOwnersClosed(project)
  }
  finally {
    await project.cleanup()
  }
}, 60_000)

it('rejects a running fallback after a failed first classic publication and leaves both hosts stopped', async () => {
  const project = await fixture()
  try {
    const server = await project.start('stateful-experimental')
    const api = server.config.plugins.find(plugin => plugin.name === 'weapp-vite:context')?.api as WeappVitePluginApi | undefined
    expect(api).toBeDefined()
    const runtime = getHmrRuntimeSession(api!.ctx)
    expect(runtime.phase).toBe('stateful')
    await writeFile(path.join(project.root, 'src/pages/home/index.json'), '{"navigationBarTitleText":"classic-failure"}')
    await expect.poll(() => runtime.fallback?.code, { timeout: 15_000 }).toBe('config-json')
    let settled: { status: 'resolved' } | { status: 'rejected', error: unknown } | undefined
    void runtime.whenSettled().then(() => {
      settled = { status: 'resolved' }
    }, (error) => {
      settled = { status: 'rejected', error }
    })
    await expect.poll(() => settled, { timeout: 15_000 }).toMatchObject({ status: 'rejected', error: expect.any(Error) })
    expect(runtime.phase).toBe('switching')
    expect(project.phasesAtFailure).toEqual(['switching'])
    expect(project.hosts).toHaveLength(2)
    expectOriginalFailure(project)
    expectOwnersClosed(project)
    const publications = project.publications()
    // classic 原生首构可能已清空旧输出；缺失也是失败停止后的稳定产物状态。
    const previousOutput = await readPublishedScript(project)
    await project.save('must-not-publish-after-failed-fallback')
    await Promise.all(project.hosts.map(host => host.server.close()))
    expect(project.publications()).toBe(publications)
    expect(await readPublishedScript(project)).toBe(previousOutput)
    expectOwnersClosed(project)
    expect(JSON.parse(await readFile(path.join(project.root, 'project.private.config.json'), 'utf8')) as unknown).toEqual({ setting: { compileHotReLoad: true } })
  }
  finally {
    await project.cleanup()
  }
}, 60_000)

it('keeps ordinary classic startup failures recoverable after the source is corrected', async () => {
  const project = await fixture()
  try {
    const server = await project.start('classic')
    expect(project.phasesAtFailure).toEqual(['stateful'])
    expect(project.hosts).toHaveLength(1)
    expectOriginalFailure(project)
    expect(project.hosts[0]!.watcherCloseCalls()).toBe(0)
    await project.save('ordinary-classic-recovered')
    await expect.poll(() => project.read('pages/home/index.js').catch(() => ''), { timeout: 15_000 }).toContain('ordinary-classic-recovered')
    expect(project.publications()).toBeGreaterThan(0)
    expect(server.config.experimental.bundledDev).toBe(false)
    await server.close()
    expectOwnersClosed(project)
  }
  finally {
    await project.cleanup()
  }
}, 60_000)
