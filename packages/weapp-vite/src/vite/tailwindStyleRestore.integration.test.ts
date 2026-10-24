import type { DevOptions } from 'rolldown/experimental'
import type { Plugin, ViteDevServer } from 'vite'
import type { HmrRuntimeSession } from '../runtime/hmrRuntimeSession'
import type { StatefulHmrOutputFile } from '../runtime/statefulHmr/outputWriter'
import type { WeappVitePluginApi } from '../types'
import { readFileSync } from 'node:fs'
import { mkdir, mkdtemp, readdir, readFile, realpath, rename, rm, symlink, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { WEAPP_VITE_STATEFUL_HMR_CLIENT_KEY, WEAPP_VITE_STATEFUL_HMR_CONTROL_FILE, WEAPP_VITE_STATEFUL_HMR_PRELOAD_FILE, WEAPP_VITE_STATEFUL_HMR_UPDATE_FILE } from '@weapp-core/constants'
import { createLogger, createServer } from 'vite'
import { expect, it, onTestFailed, vi } from 'vitest'
import { installStatefulHmrTransport } from '../../../../e2e/utils/statefulHmrTransport'
import { createHeadlessSession } from '../../../../mpcore/packages/simulator/src/runtime'
import { querySelectorAll } from '../../../../mpcore/packages/simulator/src/view/selectors'
import { sanitizeBenchmarkDevLog } from '../../../../scripts/benchmarkTemplatesHmr/diagnostics'
import { getHmrRuntimeSession } from '../runtime/hmrRuntimeSession'
import { StatefulHmrSnapshotScheduler } from '../runtime/statefulHmr/snapshotScheduler'
import { weapp } from './index'
import { createStyleRestoreDiagnostics } from './tailwindStyleRestore/diagnostics'

// 模拟具有增量能力的底层宿主，保留 stateful 交接覆盖；真实微信启动准入另测。
vi.mock('../runtime/hmrRuntimeHostCapabilities', () => ({
  resolveStatefulHmrStartupFallback: () => undefined,
}))

const harness = vi.hoisted(() => ({
  afterWrite: undefined as undefined | ((outDir: string, output: StatefulHmrOutputFile[]) => Promise<void>),
  sourceHook: undefined as undefined | ((file: string, phase: 'entered' | 'completed' | 'failed') => void),
  batch: undefined as undefined | ((result: Parameters<NonNullable<DevOptions['onHmrUpdates']>>[0]) => void),
  snapshot: undefined as undefined | ((line: string) => void),
  log: undefined as undefined | ((source: 'build' | 'vite', level: string, values: unknown[]) => void),
}))

vi.mock('../runtime/statefulHmr/snapshotDiagnostics', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../runtime/statefulHmr/snapshotDiagnostics')>()
  return {
    ...actual,
    createStatefulHmrSnapshotDiagnostics(...[options]: Parameters<typeof actual.createStatefulHmrSnapshotDiagnostics>) {
      return actual.createStatefulHmrSnapshotDiagnostics({
        ...options,
        enabled: process.env.WEAPP_VITE_HMR_STYLE_RESTORE_DIAGNOSTICS === '1' ? '1' : '0',
        emit(line) {
          harness.snapshot?.(line)
        },
      })
    },
  }
})

vi.mock('../logger', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../logger')>()
  return {
    ...actual,
    default: new Proxy(actual.default, {
      get(target, property, receiver) {
        const value: unknown = Reflect.get(target, property, receiver)
        if (typeof value === 'function' && ['info', 'warn', 'error'].includes(String(property))) {
          return (...values: unknown[]) => {
            try {
              harness.log?.('build', String(property), values)
            }
            catch {
              // 只读诊断失败不能改变原日志调用的返回或异常。
            }
            return Reflect.apply(value, target, values)
          }
        }
        return value
      },
    }),
  }
})

vi.mock('../runtime/statefulHmr/outputWriter', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../runtime/statefulHmr/outputWriter')>()
  return {
    ...actual,
    async writeStatefulHmrOutput(...args: Parameters<typeof actual.writeStatefulHmrOutput>) {
      await actual.writeStatefulHmrOutput(...args)
      // 只观察原生 bundler 实际写盘，不伪造快照、资产或交付回调。
      await harness.afterWrite?.(args[0], args[1])
    },
  }
})

vi.mock('../plugins/core/lifecycle/watch', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../plugins/core/lifecycle/watch')>()
  return {
    ...actual,
    createWatchChangeHook(...args: Parameters<typeof actual.createWatchChangeHook>) {
      const original = actual.createWatchChangeHook(...args)
      return function (this: ThisParameterType<typeof original>, ...input: Parameters<typeof original>) {
        harness.sourceHook?.(input[0], 'entered')
        const result = original.apply(this, input)
        // 原 Promise 原样返回；只观察 DevEngine 实际调用的宿主 hook 完成，不发射合成事件。
        void result.then(() => harness.sourceHook?.(input[0], 'completed'), () => harness.sourceHook?.(input[0], 'failed'))
        return result
      }
    },
  }
})

vi.mock('../runtime/statefulHmr/viteDevEngine', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../runtime/statefulHmr/viteDevEngine')>()
  return {
    ...actual,
    createViteDevEngine(...args: Parameters<typeof actual.createViteDevEngine>) {
      const [input, output, options] = args
      return actual.createViteDevEngine(input, output, {
        ...options,
        onHmrUpdates(result) {
          const returned = options?.onHmrUpdates?.(result)
          harness.batch?.(result)
          return returned
        },
      })
    },
  }
})

async function within<T>(operation: Promise<T>, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([operation, new Promise<never>((_resolve, reject) => {
      timer = setTimeout(() => reject(new Error(`Timed out during ${label}`)), 30_000)
    })])
  }
  finally {
    clearTimeout(timer)
  }
}

it('restores a Tailwind SFC saved after native classic CSS write while its first fallback commit is blocked', async () => {
  const root = await realpath(await mkdtemp(path.join(os.tmpdir(), 'weapp-vite-tailwind-style-restore-')))
  const outDir = path.join(root, 'dist')
  const pageStyle = 'pages/index/index.wxss'
  const source = path.join(root, 'src/pages/index/index.vue')
  const initial = `<script setup lang="ts">
import { ref } from 'wevu'
const count = ref(0)
function increment() { count.value += 1 }
</script>
<template><view class="style-restore-probe w-[37px]"><text>count: {{ count }}</text><button id="increment" @click="increment">Increment</button></view></template>
<style>.style-restore-probe { color: #1f1a3f; }</style>`
  const releaseCommit = Promise.withResolvers<void>()
  const wroteBlue = Promise.withResolvers<void>()
  const restoredSourceObserved = Promise.withResolvers<void>()
  const publications: Array<{ mode: 'stateful' | 'classic', files: string[], blue: boolean, green: boolean }> = []
  const repoRoot = fileURLToPath(new URL('../../../../', import.meta.url))
  const sanitize = (value: string) => sanitizeBenchmarkDevLog(value.replaceAll('\\', '/')
    .replaceAll(root.replaceAll('\\', '/'), '<fixture>')
    .replaceAll(path.dirname(root).replaceAll('\\', '/'), '<temp>'), repoRoot)
  let blockBlue = false
  let publicationBlocked = false
  let restoring = false
  let phase = 'fixture'
  let server: ViteDevServer | undefined
  let hmrRuntime: HmrRuntimeSession | undefined
  let runtime: ReturnType<typeof createHeadlessSession> | undefined
  let releaseTransport: (() => void) | undefined
  const diagnostics = createStyleRestoreDiagnostics({ sanitize, phase: () => phase })
  const record = diagnostics.record
  harness.snapshot = diagnostics.snapshot
  harness.log = diagnostics.log
  const viteLogger = createLogger('silent')
  for (const level of ['info', 'warn', 'error'] as const) {
    const original = viteLogger[level]
    viteLogger[level] = (...values) => {
      try {
        harness.log?.('vite', level, values)
      }
      catch {
        // 保留 Vite logger 的原返回值及失败语义。
      }
      return original.apply(viteLogger, values)
    }
  }
  const readStyles = async () => {
    const files = (await readdir(outDir, { recursive: true })).filter(file => file.endsWith('.wxss'))
    return {
      page: await readFile(path.join(outDir, pageStyle), 'utf8'),
      all: (await Promise.all(files.map(file => readFile(path.join(outDir, file), 'utf8')))).join('\n'),
    }
  }
  let finalStyles: Awaited<ReturnType<typeof readStyles>> | undefined
  const save = async (content: string) => {
    diagnostics.source(content)
    record('save:start', { color: content.match(/color: (#[a-f\d]+)/)?.[1] })
    const temporary = `${source}.save.tmp`
    await writeFile(temporary, content)
    await rename(temporary, source)
    record('save:renamed')
  }
  const classicGate: Plugin = {
    name: 'tailwind-classic-publication-gate',
    configureServer(host) {
      if (!hmrRuntime) {
        const api = host.config.plugins.find(plugin => plugin.name === 'weapp-vite:context')?.api as WeappVitePluginApi | undefined
        if (!api) {
          throw new Error('The initial host did not expose its compiler context')
        }
        hmrRuntime = getHmrRuntimeSession(api.ctx)
      }
    },
    writeBundle: {
      order: 'post',
      sequential: true,
      async handler(_options, bundle) {
        if (!hmrRuntime || hmrRuntime.phase === 'stateful') {
          return
        }
        const styles = Object.values(bundle).filter(item => item.type === 'asset' && item.fileName.endsWith('.wxss'))
        const blue = styles.some(item => item.type === 'asset' && String(item.source).includes('#2563eb'))
        publications.push({ mode: 'classic', files: Object.keys(bundle), blue, green: styles.some(item => item.type === 'asset' && String(item.source).includes('#16a34a')) })
        record('classic-output-written', { blue, files: Object.keys(bundle) })
        if (blockBlue && blue && bundle[pageStyle]) {
          blockBlue = false
          publicationBlocked = true
          expect(hmrRuntime.phase).toBe('switching')
          // 原生 classic write 已落盘；暂停提交完成，让真实 watcher 接收期间的恢复保存。
          expect((await readStyles()).page).toContain('#2563eb')
          phase = 'blue-written-classic-commit-blocked'
          record('commit:blocked')
          wroteBlue.resolve()
          await releaseCommit.promise
          publicationBlocked = false
          record('commit:released')
        }
      },
    },
    hotUpdate({ file }) {
      if (publicationBlocked && restoring && path.resolve(file) === source) {
        record('classic-hotUpdate')
        try {
          if (readFileSync(source, 'utf8') === initial) {
            restoredSourceObserved.resolve()
          }
        }
        catch (error) {
          restoredSourceObserved.reject(error)
        }
      }
    },
  }
  onTestFailed(() => {
    process.stderr.write(`[tailwind-style-restore] ${diagnostics.json({ phase, publications, styles: finalStyles })}\n`)
  })
  const originalRequest = StatefulHmrSnapshotScheduler.prototype.request
  const requestObserver = vi.spyOn(StatefulHmrSnapshotScheduler.prototype, 'request').mockImplementation(function (this: StatefulHmrSnapshotScheduler, ...args) {
    try {
      // 默认只同步观察请求；不读取磁盘、不消费单次 iterable，原参数及接收者原样交回。
      diagnostics.request(args[0], args[1])
    }
    catch {
      // 观察失败不覆盖真实 request 的返回值或异常。
    }
    return Reflect.apply(originalRequest, this, args)
  })
  try {
    for (const [file, content] of Object.entries({
      'package.json': '{"name":"tailwind-style-restore-fixture","private":true,"type":"module","dependencies":{"wevu":"*"}}',
      'project.config.json': '{"appid":"wxb3d842a4a7e3440d","compileType":"miniprogram","miniprogramRoot":"dist/","srcMiniprogramRoot":"src/"}',
      'project.private.config.json': '{"setting":{"compileHotReLoad":true},"condition":{"miniprogram":{"list":[{"name":"Style restore","pathName":"pages/index/index"}]}}}',
      'src/app.ts': 'App({})',
      'src/app.json': '{"pages":["pages/index/index"]}',
      'src/app.css': '@import "tailwindcss/utilities" source(none); @source "./pages/**/*.vue";',
      'src/pages/index/index.vue': initial,
    })) {
      await mkdir(path.dirname(path.join(root, file)), { recursive: true })
      await writeFile(path.join(root, file), content)
    }
    const require = createRequire(import.meta.url)
    await mkdir(path.join(root, 'node_modules'))
    await symlink(await realpath(path.dirname(require.resolve('tailwindcss/package.json'))), path.join(root, 'node_modules/tailwindcss'), 'junction')
    await symlink(await realpath(path.resolve(path.dirname(fileURLToPath(import.meta.resolve('wevu'))), '..')), path.join(root, 'node_modules/wevu'), 'junction')
    harness.sourceHook = (file, stage) => {
      if (path.resolve(file) !== source) {
        return
      }
      record(`devengine-watchChange:${stage}`)
    }
    harness.batch = (result) => {
      if (result instanceof Error) {
        record('devengine-batch:error', { error: result.message })
        return
      }
      if (result.changedFiles.some(file => path.resolve(root, file) === source)) {
        diagnostics.batch(result)
        record('devengine-batch', { updates: result.updates.map(item => item.update.type) })
      }
    }
    harness.afterWrite = async (directory, output) => {
      if (path.resolve(directory) !== outDir) {
        return
      }
      diagnostics.output(output)
      const styles = output.filter(item => item.type === 'asset' && item.fileName.endsWith('.wxss'))
      const blue = styles.some(item => item.type === 'asset' && String(item.source).includes('#2563eb'))
      publications.push({ mode: 'stateful', files: output.map(item => item.fileName), blue, green: styles.some(item => item.type === 'asset' && String(item.source).includes('#16a34a')) })
      record('stateful-output-written', { blue, files: output.map(item => item.fileName) })
    }
    server = await createServer({
      root,
      configFile: false,
      logLevel: 'silent',
      customLogger: viteLogger,
      plugins: [weapp(), classicGate],
      weapp: { srcRoot: 'src', autoRoutes: false, hmr: { runtime: 'stateful-experimental' }, tailwindcss: { cssEntries: ['src/app.css'] } },
      build: { minify: false },
      server: { host: '127.0.0.1', port: 0 },
    })
    await server.listen()
    runtime = createHeadlessSession({ projectPath: root })
    releaseTransport = installStatefulHmrTransport(runtime, outDir)
    runtime.reLaunch('/pages/index/index')
    await expect.poll(() => runtime!.evaluateRuntime(`() => globalThis[${JSON.stringify(WEAPP_VITE_STATEFUL_HMR_CLIENT_KEY)}]?.getTransportState().phase`), { timeout: 30_000 }).toBe('polling')
    diagnostics.runtime.install(runtime)
    const page = runtime.getCurrentPages()[0]
    expect(runtime.renderCurrentPage().wxml).toContain('count: 0')
    expect((await readStyles()).page).toContain('#1f1a3f')
    expect((await readStyles()).all).toMatch(/width:\s*37px/)
    const increment = async (expected: number) => {
      const button = querySelectorAll(runtime!.renderCurrentPage().root, '#increment')[0]
      expect(button).toBeDefined()
      diagnostics.runtime.capture(runtime, 'before-tap', { expected })
      runtime!.dispatchNativeNodeEvent(button!, 'tap', {})
      diagnostics.runtime.capture(runtime, 'after-tap-dispatch', { expected })
      await expect.poll(() => diagnostics.render(runtime!.renderCurrentPage().wxml), { timeout: 30_000 }).toContain(`count: ${expected}`)
    }
    const version = () => Number(runtime!.evaluateRuntime(`() => globalThis[${JSON.stringify(WEAPP_VITE_STATEFUL_HMR_CLIENT_KEY)}]?.getVersion()`))
    await increment(1)
    for (const [label, content, expected] of [
      ['script-saved', initial.replace('count.value += 1', 'count.value += 2'), 3],
      ['script-restored', initial, 4],
    ] as const) {
      phase = label
      const previous = version()
      diagnostics.runtime.capture(runtime, 'before-save', { previous })
      await save(content)
      await expect.poll(version, { timeout: 30_000 }).toBeGreaterThan(previous)
      diagnostics.runtime.capture(runtime, 'version-barrier-satisfied', { previous })
      expect(runtime.getCurrentPages()[0]).toBe(page)
      await increment(expected)
    }

    phase = 'saving-blue'
    blockBlue = true
    await save(initial.replace('#1f1a3f', '#2563eb'))
    await within(wroteBlue.promise, phase)
    phase = 'restoring-while-commit-blocked'
    restoring = true
    await save(initial)
    // 旧 DevEngine 已退役；必须观察 classic 宿主真实 hotUpdate，不能发射合成事件。
    await within(restoredSourceObserved.promise, phase)
    expect(await readFile(source, 'utf8')).toBe(initial)
    releaseCommit.resolve()
    phase = 'processing-restoration-after-release'
    await within(hmrRuntime!.whenSettled(), phase)
    await expect.poll(async () => (await readStyles()).page, { timeout: 30_000 }).toContain('#1f1a3f')
    await expect.poll(() => publications.filter(item => item.mode === 'classic').length, { timeout: 30_000 }).toBeGreaterThan(1)
    const restored = await readStyles()
    expect(restored.page).toContain('#1f1a3f')
    expect(restored.page).not.toContain('#2563eb')
    expect(restored.all).not.toContain('#2563eb')
    expect(restored.all).toMatch(/width:\s*37px/)
    expect(hmrRuntime!.phase).toBe('classic')
    expect(hmrRuntime!.fallback?.code).toBe('stylesheet-output')
    expect(server.config.experimental.bundledDev).toBe(false)
    await expect.poll(() => runtime!.evaluateRuntime(`() => globalThis[${JSON.stringify(WEAPP_VITE_STATEFUL_HMR_CLIENT_KEY)}]?.getTransportState().phase`), { timeout: 30_000 }).toBe('stopped')
    for (const file of [WEAPP_VITE_STATEFUL_HMR_CONTROL_FILE, WEAPP_VITE_STATEFUL_HMR_PRELOAD_FILE, WEAPP_VITE_STATEFUL_HMR_UPDATE_FILE]) {
      await expect(readFile(path.join(outDir, file))).rejects.toMatchObject({ code: 'ENOENT' })
    }
    releaseTransport()
    releaseTransport = undefined
    const previousRuntime = runtime
    diagnostics.runtime.capture(previousRuntime, 'stateful-before-close')
    previousRuntime.close()
    expect(previousRuntime.isClosed).toBe(true)
    const openClassicCompanion = async () => {
      runtime?.close()
      // 新 VM 仅验证 classic 实际产物；真实 IDE 的自动重载由对应 runtime suite 验收。
      runtime = createHeadlessSession({ projectPath: root })
      runtime.reLaunch('/pages/index/index')
      expect(runtime.renderCurrentPage().wxml).toContain('count: 0')
      expect(runtime.evaluateRuntime(`() => globalThis[${JSON.stringify(WEAPP_VITE_STATEFUL_HMR_CLIENT_KEY)}] === undefined`)).toBe(true)
      await increment(1)
    }
    await openClassicCompanion()

    for (const [label, content, present, absent] of [
      ['third-color', initial.replace('#1f1a3f', '#16a34a'), '#16a34a', '#2563eb'],
      ['restored-again', initial, '#1f1a3f', '#16a34a'],
    ] as const) {
      phase = label
      const previousPublications = publications.length
      await save(content)
      await expect.poll(async () => (await readStyles()).page, { timeout: 30_000 }).toContain(present)
      await expect.poll(() => publications.length, { timeout: 30_000 }).toBeGreaterThan(previousPublications)
      const current = await readStyles()
      expect(current.page).toContain(present)
      expect(current.page).not.toContain(absent)
      expect(current.all).not.toContain(absent)
      expect(current.all).toMatch(/width:\s*37px/)
      expect(hmrRuntime!.phase).toBe('classic')
      expect(server.config.experimental.bundledDev).toBe(false)
      await openClassicCompanion()
    }
    expect(publications.filter(item => item.mode === 'stateful' && (item.blue || item.green))).toEqual([])
    expect(publications.filter(item => item.mode === 'classic' && item.blue)).toHaveLength(1)
    if (process.env.WEAPP_VITE_HMR_STYLE_RESTORE_DIAGNOSTICS === '1') {
      process.stdout.write(`[tailwind-style-restore:passed] ${diagnostics.json({ phase, publications })}\n`)
    }
  }
  finally {
    diagnostics.runtime.capture(runtime, 'before-cleanup')
    finalStyles = await readStyles().catch(() => undefined)
    releaseCommit.resolve()
    harness.afterWrite = undefined
    harness.sourceHook = undefined
    harness.batch = undefined
    releaseTransport?.()
    runtime?.close()
    try {
      await server?.close()
    }
    finally {
      requestObserver.mockRestore()
      harness.snapshot = undefined
      harness.log = undefined
    }
    await rm(root, { recursive: true, force: true })
  }
}, 120_000)
