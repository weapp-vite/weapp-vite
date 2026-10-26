import type { Plugin, ViteDevServer } from 'vite'
import { randomUUID } from 'node:crypto'
import { mkdir, mkdtemp, readdir, readFile, realpath, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import {
  WEAPP_VITE_STATEFUL_HMR_BRIDGE_KEY,
  WEAPP_VITE_STATEFUL_HMR_CONTROL_FILE,
  WEAPP_VITE_STATEFUL_HMR_CONTROL_KEY,
  WEAPP_VITE_STATEFUL_HMR_PRELOAD_FILE,
  WEAPP_VITE_STATEFUL_HMR_UPDATE_FILE,
} from '@weapp-core/constants'
import { createServer } from 'vite'
import { expect, it, vi } from 'vitest'
import { assertNoStatefulInstallations } from '../../scripts/consumerHmr/installedRuntime.mjs'
import { observeClassicFallback } from './hmrFallback/settlementProbe'
import { weapp } from './index'

// 模拟具有增量能力的底层宿主，保留 stateful 交接覆盖；真实微信启动准入另测。
vi.mock('../runtime/hmrRuntimeHostCapabilities', () => ({
  resolveStatefulHmrStartupFallback: () => undefined,
}))

const deliveryFiles = [
  WEAPP_VITE_STATEFUL_HMR_CONTROL_FILE,
  WEAPP_VITE_STATEFUL_HMR_PRELOAD_FILE,
  WEAPP_VITE_STATEFUL_HMR_UPDATE_FILE,
]

async function readOutputScripts(root: string): Promise<Record<string, string>> {
  const outDir = path.join(root, 'dist')
  const files = (await readdir(outDir, { recursive: true }))
    .map(file => file.replaceAll('\\', '/'))
    .filter(file => file.endsWith('.js'))
    .sort()
  return Object.fromEntries(await Promise.all(files.map(async file => [file, await readFile(path.join(outDir, file), 'utf8')])))
}

async function expectClassicOutput(root: string): Promise<void> {
  const retiredFiles = new Set(deliveryFiles)
  await expect.poll(async () => Object.entries(await readOutputScripts(root))
    .filter(([file, source]) => {
      // 退役 realm 的只读入口 guard 可以保留；安装、轮询和控制链路仍须全部移除。
      assertNoStatefulInstallations(file, source)
      return retiredFiles.has(file) || [
        WEAPP_VITE_STATEFUL_HMR_BRIDGE_KEY,
        WEAPP_VITE_STATEFUL_HMR_CONTROL_KEY,
      ].some(marker => source.includes(marker))
    })
    .map(([file]) => file)).toEqual([])
}

async function fixture() {
  const root = await realpath(await mkdtemp(path.join(os.tmpdir(), 'weapp-vite-classic-handoff-')))
  const factoryKey = `weapp-vite-test-factory-${randomUUID()}`
  // 配置 bundler 不继承 Vitest 的源码别名；只跨加载器传入已由 Vitest 解析的真实源码工厂。
  const configSource = (message: string) => `const weapp = globalThis[${JSON.stringify(factoryKey)}]
export default {
  plugins: [weapp()],
  define: { FIXTURE_MESSAGE: ${JSON.stringify(JSON.stringify(message))} },
  weapp: { srcRoot: 'src', autoRoutes: false, vue: { enable: false }, hmr: { runtime: 'stateful-experimental' } }
}`
  for (const [file, content] of Object.entries({
    'package.json': '{"name":"classic-handoff-fixture","type":"module"}',
    'project.config.json': '{"miniprogramRoot":"dist"}',
    'project.private.config.json': '{"setting":{"compileHotReLoad":true}}',
    'vite.config.mjs': configSource('initial-script'),
    'src/app.js': 'App({})',
    'src/app.json': '{"pages":["pages/home/index"]}',
    'src/pages/home/index.js': 'Page({ data: { message: FIXTURE_MESSAGE } })',
    'src/pages/home/index.json': '{}',
    'src/pages/home/index.wxml': '<view>{{message}}</view>',
  })) {
    await mkdir(path.dirname(path.join(root, file)), { recursive: true })
    await writeFile(path.join(root, file), content)
  }
  Object.defineProperty(globalThis, factoryKey, { configurable: true, value: weapp })
  return {
    root,
    configSource,
    read: (file: string) => readFile(path.join(root, 'dist', file), 'utf8'),
    start: (plugins: Plugin[] = []) => createServer({ root, plugins, logLevel: 'silent', server: { middlewareMode: true, host: '127.0.0.1', port: 0 } }),
    cleanup: async () => {
      Reflect.deleteProperty(globalThis, factoryKey)
      await rm(root, { recursive: true, force: true })
    },
  }
}

function expectClassicHost(server: ViteDevServer) {
  expect(server.config.experimental.bundledDev).toBe(false)
  // 工厂阶段的空槽保持固定；classic 不能保留上一代的任何 stateful 实现和 API。
  for (const plugin of server.config.plugins.filter(plugin => [
    'weapp-vite:stateful-style-client',
    'weapp-vite:hmr-input',
    'weapp-vite:stateful-hmr-sidecar',
    'weapp-vite:stateful-hmr-session',
  ].includes(plugin.name))) {
    expect(plugin.api).toBeUndefined()
    for (const hook of ['resolveId', 'load', 'transform', 'watchChange', 'renderChunk'] as const) {
      expect(plugin[hook]).toBeUndefined()
    }
  }
  expect(Object.values(server.config.define).join('\n')).not.toContain(WEAPP_VITE_STATEFUL_HMR_BRIDGE_KEY)
}

it('keeps classic across source restoration, config reload and fresh plugin factories, resetting only for a new command', async () => {
  const project = await fixture()
  let server: ViteDevServer | undefined
  try {
    server = await project.start()
    expect(server.config.experimental.bundledDev).toBe(true)
    expect(await project.read('pages/home/index.js')).toContain('initial-script')
    const statefulScripts = await readOutputScripts(project.root)
    expect(Object.keys(statefulScripts)).toEqual(expect.arrayContaining(deliveryFiles))
    expect(statefulScripts[WEAPP_VITE_STATEFUL_HMR_CONTROL_FILE]).toContain(WEAPP_VITE_STATEFUL_HMR_CONTROL_KEY)
    // 从真实首构语义定位旧运行时，不把打包器生成的文件名或 hash 固化为断言。
    const statefulRuntimeFiles = Object.entries(statefulScripts)
      .filter(([file, source]) => !['app.js', 'pages/home/index.js', ...deliveryFiles].includes(file)
        && source.includes(WEAPP_VITE_STATEFUL_HMR_BRIDGE_KEY))
      .map(([file]) => file)
    expect(statefulRuntimeFiles.length).toBeGreaterThan(0)
    const runtime = await observeClassicFallback(server, () => writeFile(path.join(project.root, 'src/pages/home/index.json'), '{"navigationBarTitleText":"classic-title"}'))
    expect(runtime.fallback?.code).toBe('config-json')
    expect(runtime.phase).toBe('classic')
    expect(server.config.experimental.bundledDev).toBe(false)
    expectClassicHost(server)
    await expect.poll(() => project.read('pages/home/index.json')).toContain('classic-title')
    await expectClassicOutput(project.root)
    await writeFile(path.join(project.root, 'src/pages/home/index.json'), '{}')
    await writeFile(path.join(project.root, 'src/pages/home/index.js'), 'Page({ data: { message: "classic-script-update" } })')
    await expect.poll(() => project.read('pages/home/index.js')).toContain('classic-script-update')
    expectClassicHost(server)
    await expectClassicOutput(project.root)
    await writeFile(path.join(project.root, 'vite.config.mjs'), project.configSource('reloaded-config'))
    await writeFile(path.join(project.root, 'src/pages/home/index.js'), 'Page({ data: { message: FIXTURE_MESSAGE } })')
    await expect.poll(() => project.read('pages/home/index.js')).toContain('reloaded-config')
    expectClassicHost(server)
    await expectClassicOutput(project.root)
    expect(server.config.weapp?.hmr?.runtime).toBe('stateful-experimental')
    await server.restart(true)
    expectClassicHost(server)
    await expectClassicOutput(project.root)
    await Promise.all([server.close(), server.close()])
    server = await project.start()
    expect(server.config.experimental.bundledDev).toBe(true)
    expect(await project.read('pages/home/index.js')).toContain('reloaded-config')
    expect(await project.read(WEAPP_VITE_STATEFUL_HMR_CONTROL_FILE)).toContain(WEAPP_VITE_STATEFUL_HMR_CONTROL_KEY)
    expect(JSON.parse(await readFile(path.join(project.root, 'project.private.config.json'), 'utf8')) as unknown).toMatchObject({ setting: { compileHotReLoad: true } })
  }
  finally {
    await server?.close()
    await project.cleanup()
  }
})

it('uses classic after a startup capability request without retaining the failed stateful engine', async () => {
  const project = await fixture()
  let server: ViteDevServer | undefined
  try {
    await writeFile(path.join(project.root, 'src/app.json'), '{"pages":["pages/home/index"],"renderer":"skyline"}')
    server = await project.start()
    await expect.poll(() => server!.config.experimental.bundledDev).toBe(false)
    expectClassicHost(server)
    await expect.poll(() => project.read('app.json')).toContain('skyline')
    expect(await project.read('pages/home/index.js')).toContain('initial-script')
  }
  finally {
    await server?.close()
    await project.cleanup()
  }
})

it('starts a legacy content provider in classic before preparing a bundled host', async () => {
  const project = await fixture()
  let server: ViteDevServer | undefined
  try {
    await writeFile(path.join(project.root, 'vite.config.mjs'), project.configSource('legacy-provider-classic')
      .replace('weapp: { srcRoot:', 'weapp: { compilerPlugins: [{ name: "legacy-content", capabilities: { content: true }, create() { return {} } }], srcRoot:'))
    server = await project.start()
    expectClassicHost(server)
    expect(server.config.weapp?.hmr?.runtime).toBe('stateful-experimental')
    expect(await project.read('pages/home/index.js')).toContain('legacy-provider-classic')
  }
  finally {
    await server?.close()
    await project.cleanup()
  }
})

it.each([false, true])('revalidates startup snapshots saved before the host attaches (unsupported=%s)', async (unsupported) => {
  const project = await fixture()
  let changed = false
  let snapshots = 0
  const gate: Plugin = {
    name: 'startup-snapshot-admission-gate',
    buildStart() {
      if (this.environment.mode === 'build') {
        snapshots++
      }
    },
    async configResolved(config) {
      if (changed || config.command !== 'serve') {
        return
      }
      changed = true
      await writeFile(path.join(project.root, 'src/pages/home/index.js'), 'Page({ data: { message: "saved-before-startup-host" } })')
      if (unsupported) {
        await writeFile(path.join(project.root, 'src/app.json'), '{"pages":["pages/home/index"],"renderer":"skyline"}')
      }
    },
  }
  let server: ViteDevServer | undefined
  try {
    server = await project.start([gate])
    await expect.poll(() => project.read('pages/home/index.js')).toContain('saved-before-startup-host')
    if (unsupported) {
      await expect.poll(() => server!.config.experimental.bundledDev).toBe(false)
      expectClassicHost(server)
      expect(await project.read('app.json')).toContain('skyline')
    }
    else {
      expect(server.config.experimental.bundledDev).toBe(true)
      // 预检之后保存必须废弃候选；正式首构重取一次，而非发布过期快照。
      expect(snapshots).toBe(2)
    }
  }
  finally {
    await server?.close()
    await project.cleanup()
  }
})

it('captures saves before classic watchers attach and while its first publication is still blocked', async () => {
  const project = await fixture()
  const publishing = Promise.withResolvers<void>()
  const sourceObserved = Promise.withResolvers<void>()
  const releasePublication = Promise.withResolvers<void>()
  const sourceFile = path.join(project.root, 'src/pages/home/index.js')
  let blockNextPublication = false
  let publicationBlocked = false
  const gate: Plugin = {
    name: 'classic-transition-publication-gate',
    async configResolved(config) {
      if (blockNextPublication && config.command === 'serve' && config.experimental.bundledDev === false) {
        // 编译会话已准备，但 Vite 尚未创建下一代 watcher，仍须以最新配置开始 classic 首构。
        await writeFile(path.join(project.root, 'src/app.json'), '{"pages":["pages/home/index"],"window":{"navigationBarTitleText":"saved-before-classic-watcher"}}')
      }
    },
    async generateBundle() {
      if (!blockNextPublication) {
        return
      }
      blockNextPublication = false
      publicationBlocked = true
      publishing.resolve()
      await releasePublication.promise
    },
    hotUpdate({ file }) {
      if (publicationBlocked && path.resolve(file) === sourceFile) {
        sourceObserved.resolve()
      }
    },
  }
  let server: ViteDevServer | undefined
  try {
    server = await project.start([gate])
    blockNextPublication = true
    const runtime = await observeClassicFallback(server, async () => {
      await writeFile(path.join(project.root, 'src/pages/home/index.json'), '{"navigationBarTitleText":"classic-transition"}')
      await publishing.promise
      // 首次 classic 写出被门闩阻挡，确保保存发生在 switching 中，而非已经就绪后。
      await writeFile(sourceFile, 'Page({ data: { message: "saved-during-classic-transition" } })')
      await sourceObserved.promise
      releasePublication.resolve()
    })
    // 最新文件写出仍可能早于宿主重启完成；以命令级交接完成作为宿主断言的边界。
    expect(runtime.fallback?.code).toBe('config-json')
    expect(runtime.phase).toBe('classic')
    await expect.poll(() => project.read('pages/home/index.js')).toContain('saved-during-classic-transition')
    expectClassicHost(server)
    await expect.poll(() => project.read('pages/home/index.json')).toContain('classic-transition')
    await expect.poll(() => project.read('app.json')).toContain('saved-before-classic-watcher')
  }
  finally {
    releasePublication.resolve()
    await server?.close()
    await project.cleanup()
  }
})

it('reprepares explicit stateful on another mini-program platform as classic without changing the request', async () => {
  const project = await fixture()
  let server: ViteDevServer | undefined
  try {
    await writeFile(path.join(project.root, 'mini.project.json'), '{"miniprogramRoot":"dist"}')
    await writeFile(path.join(project.root, 'vite.config.mjs'), project.configSource('alipay-classic')
      .replace('weapp: { srcRoot:', 'weapp: { platform: \'alipay\', srcRoot:'))
    server = await project.start()
    expectClassicHost(server)
    expect(server.config.weapp?.hmr?.runtime).toBe('stateful-experimental')
    expect(await project.read('pages/home/index.js')).toContain('alipay-classic')
  }
  finally {
    await server?.close()
    await project.cleanup()
  }
})
