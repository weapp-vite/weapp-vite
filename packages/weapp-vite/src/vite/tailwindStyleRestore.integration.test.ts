import type { DevOptions } from 'rolldown/experimental'
import type { ViteDevServer } from 'vite'
import type { StatefulHmrOutputFile } from '../runtime/statefulHmr/outputWriter'
import { readFileSync } from 'node:fs'
import { mkdir, mkdtemp, readFile, realpath, rename, rm, symlink, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { WEAPP_VITE_STATEFUL_HMR_CLIENT_KEY, WEAPP_VITE_STATEFUL_HMR_GLOBAL_STYLE_BASENAME } from '@weapp-core/constants'
import { createServer } from 'vite'
import { expect, it, onTestFailed, vi } from 'vitest'
import { installStatefulHmrTransport } from '../../../../e2e/utils/statefulHmrTransport'
import { createHeadlessSession } from '../../../../mpcore/packages/simulator/src/runtime'
import { querySelectorAll } from '../../../../mpcore/packages/simulator/src/view/selectors'
import { weapp } from './index'

const harness = vi.hoisted(() => ({
  afterWrite: undefined as undefined | ((outDir: string, output: StatefulHmrOutputFile[]) => Promise<void>),
  sourceHook: undefined as undefined | ((file: string, phase: 'entered' | 'completed' | 'failed') => void),
  batch: undefined as undefined | ((result: Parameters<NonNullable<DevOptions['onHmrUpdates']>>[0]) => void),
}))

vi.mock('../runtime/statefulHmr/outputWriter', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../runtime/statefulHmr/outputWriter')>()
  return {
    ...actual,
    async writeStatefulHmrOutput(...args: Parameters<typeof actual.writeStatefulHmrOutput>) {
      await actual.writeStatefulHmrOutput(...args)
      // 原生 bundler 已实际写盘；这里只暂停当前提交完成，不伪造快照、资产或交付回调。
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

it('restores a Tailwind SFC saved after native CSS write while its first commit is blocked', async () => {
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
  const restoredBatchObserved = Promise.withResolvers<void>()
  const publications: Array<{ files: string[], blue: boolean, green: boolean }> = []
  const events: Array<Record<string, unknown>> = []
  const startedAt = performance.now()
  let blockBlue = false
  let restoring = false
  let phase = 'fixture'
  let server: ViteDevServer | undefined
  let runtime: ReturnType<typeof createHeadlessSession> | undefined
  let releaseTransport: (() => void) | undefined
  const record = (event: string, details: Record<string, unknown> = {}) => {
    events.push({ at: Math.round(performance.now() - startedAt), event, phase, ...details })
    if (events.length > 100) {
      events.shift()
    }
  }
  const readStyles = async () => ({
    page: await readFile(path.join(outDir, pageStyle), 'utf8'),
    global: await readFile(path.join(outDir, `${WEAPP_VITE_STATEFUL_HMR_GLOBAL_STYLE_BASENAME}.wxss`), 'utf8'),
  })
  let finalStyles: Awaited<ReturnType<typeof readStyles>> | undefined
  const save = async (content: string) => {
    record('save:start', { color: content.match(/color: (#[a-f\d]+)/)?.[1] })
    const temporary = `${source}.save.tmp`
    await writeFile(temporary, content)
    await rename(temporary, source)
    record('save:renamed')
  }
  onTestFailed(() => {
    process.stderr.write(`[tailwind-style-restore] ${JSON.stringify({ phase, publications, events, styles: finalStyles })}\n`)
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
      if (restoring && stage === 'completed') {
        try {
          if (readFileSync(source, 'utf8') === initial) {
            restoredSourceObserved.resolve()
          }
        }
        catch (error) {
          restoredSourceObserved.reject(error)
        }
      }
    }
    harness.batch = (result) => {
      if (result instanceof Error) {
        record('devengine-batch:error', { error: result.message })
        return
      }
      if (result.changedFiles.some(file => path.resolve(root, file) === source)) {
        record('devengine-batch', { updates: result.updates.map(item => item.update.type) })
        if (restoring) {
          restoredBatchObserved.resolve()
        }
      }
    }
    harness.afterWrite = async (directory, output) => {
      if (path.resolve(directory) !== outDir) {
        return
      }
      const styles = output.filter(item => item.type === 'asset' && item.fileName.endsWith('.wxss'))
      const blue = styles.some(item => item.type === 'asset' && String(item.source).includes('#2563eb'))
      publications.push({ files: output.map(item => item.fileName), blue, green: styles.some(item => item.type === 'asset' && String(item.source).includes('#16a34a')) })
      record('output-written', { blue, files: output.map(item => item.fileName) })
      if (blockBlue && blue && output.some(item => item.fileName === pageStyle)) {
        blockBlue = false
        expect((await readStyles()).page).toContain('#2563eb')
        phase = 'blue-written-commit-blocked'
        record('commit:blocked')
        wroteBlue.resolve()
        await releaseCommit.promise
        record('commit:released')
      }
    }
    server = await createServer({
      root,
      configFile: false,
      logLevel: 'silent',
      plugins: [weapp()],
      weapp: { srcRoot: 'src', autoRoutes: false, hmr: { runtime: 'stateful-experimental' }, tailwindcss: { cssEntries: ['src/app.css'] } },
      build: { minify: false },
      server: { host: '127.0.0.1', port: 0 },
    })
    await server.listen()
    const settlement = server.config.plugins.find(plugin => plugin.name === 'weapp-vite:stateful-hmr-session')?.api as { whenSettled?: () => Promise<void> } | undefined
    if (!settlement?.whenSettled) {
      throw new Error('The real stateful session did not expose settlement')
    }
    const settle = () => within(settlement.whenSettled!(), phase)
    runtime = createHeadlessSession({ projectPath: root })
    releaseTransport = installStatefulHmrTransport(runtime, outDir)
    runtime.reLaunch('/pages/index/index')
    await expect.poll(() => runtime!.evaluateRuntime(`() => globalThis[${JSON.stringify(WEAPP_VITE_STATEFUL_HMR_CLIENT_KEY)}]?.getTransportState().phase`), { timeout: 30_000 }).toBe('polling')
    const page = runtime.getCurrentPages()[0]
    expect(runtime.renderCurrentPage().wxml).toContain('count: 0')
    expect((await readStyles()).page).toContain('#1f1a3f')
    const increment = async (expected: number) => {
      const button = querySelectorAll(runtime!.renderCurrentPage().root, '#increment')[0]
      expect(button).toBeDefined()
      runtime!.dispatchNativeNodeEvent(button!, 'tap', {})
      await expect.poll(() => runtime!.renderCurrentPage().wxml, { timeout: 30_000 }).toContain(`count: ${expected}`)
    }
    const version = () => Number(runtime!.evaluateRuntime(`() => globalThis[${JSON.stringify(WEAPP_VITE_STATEFUL_HMR_CLIENT_KEY)}]?.getVersion()`))
    await increment(1)
    for (const [label, content, expected] of [
      ['script-saved', initial.replace('count.value += 1', 'count.value += 2'), 3],
      ['script-restored', initial, 4],
    ] as const) {
      phase = label
      const previous = version()
      await save(content)
      await expect.poll(version, { timeout: 30_000 }).toBeGreaterThan(previous)
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
    // bundledDev 的源码由 DevEngine 自己持有；必须观察真实宿主 watchChange，不能依赖 Vite 根 watcher。
    await within(restoredSourceObserved.promise, phase)
    expect(await readFile(source, 'utf8')).toBe(initial)
    releaseCommit.resolve()
    phase = 'processing-restoration-after-release'
    await within(restoredBatchObserved.promise, phase)
    phase = 'settling-restoration'
    await settle()
    const restored = await readStyles()
    expect(restored.page).toContain('#1f1a3f')
    expect(restored.page).not.toContain('#2563eb')
    expect(restored.global).not.toContain('#2563eb')
    expect(runtime.renderCurrentPage().wxml).toContain('count: 4')

    for (const [label, content, present, absent] of [
      ['third-color', initial.replace('#1f1a3f', '#16a34a'), '#16a34a', '#2563eb'],
      ['restored-again', initial, '#1f1a3f', '#16a34a'],
    ] as const) {
      phase = label
      await save(content)
      await expect.poll(async () => (await readStyles()).page, { timeout: 30_000 }).toContain(present)
      await settle()
      const current = await readStyles()
      expect(current.page).toContain(present)
      expect(current.page).not.toContain(absent)
      expect(current.global).not.toContain(absent)
      expect(runtime.getCurrentPages()[0]).toBe(page)
      expect(server.config.experimental.bundledDev).toBe(true)
    }
    if (process.env.WEAPP_VITE_HMR_STYLE_RESTORE_DIAGNOSTICS === '1') {
      process.stdout.write(`[tailwind-style-restore:passed] ${JSON.stringify({ phase, events, publications })}\n`)
    }
  }
  finally {
    finalStyles = await readStyles().catch(() => undefined)
    releaseCommit.resolve()
    harness.afterWrite = undefined
    harness.sourceHook = undefined
    harness.batch = undefined
    releaseTransport?.()
    runtime?.close()
    await server?.close()
    await rm(root, { recursive: true, force: true })
  }
}, 120_000)
