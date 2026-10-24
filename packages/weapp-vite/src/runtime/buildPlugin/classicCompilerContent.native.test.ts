import type { Plugin } from 'vite'
import type { NativeOutputPublicationApi, NativeOutputPublicationSnapshot } from '../../plugins/outputFinalizer/publicationObservation'
import { readFileSync } from 'node:fs'
import { mkdir, mkdtemp, readFile, realpath, rm, symlink, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { WEAPP_VITE_OUTPUT_PUBLICATION_PLUGIN_NAME } from '@weapp-core/constants'
import { expect, it, onTestFailed, vi } from 'vitest'
import { getCompilerSourceSnapshot } from '../../plugins/utils/sourceSnapshot'
import { CompilerSession } from '../compilerSession'
import { getHmrStyleUpdatePlan } from '../hmrStyleUpdate'
import * as vueStyleSnapshot from './vueStyleSnapshot'

interface PublicationReceipt {
  files: string[]
  epoch: number
  snapshotCall: number
  writtenStyles: string
  capturedHandler?: number
  emittedHandler?: number
  profile: { eventId?: string, batchId?: string, event?: string, file?: string }
  snapshot?: NativeOutputPublicationSnapshot
  plan?: { id: string, full: boolean, sourceFiles: string[], styleFiles: string[], compilerContentOwners: Array<readonly [string, string]> }
}

it.each(['vue', 'native'] as const)('publishes %s App compiler styles across consecutive classic utility edits and keeps handler edits local', async (appKind) => {
  const root = await realpath(await mkdtemp(path.join(os.tmpdir(), 'weapp-classic-compiler-content-')))
  const outDir = path.join(root, 'dist')
  const page = path.join(root, 'src/pages/index/index.vue')
  const pageId = page.replaceAll('\\', '/')
  const appOwner = path.join(root, 'src', appKind === 'vue' ? 'app.vue' : 'app.js').replaceAll('\\', '/')
  const shared = path.join(root, 'src/shared.ts')
  const added = path.join(root, 'src/new-source.ts')
  const markdown = path.join(root, 'src/content.md')
  const initialColor = '#fce7f3'
  const source = (color: string, handler = 17001) => `<script setup lang="ts">
import { ref } from 'wevu'
const count = ref(0)
const utility = 'w-[37px] bg-[${color}]'
function increment() { count.value += ${handler}; return { handlerStep: ${handler} } }
</script>
<template><view :class="utility"><text>{{ count }}</text><button @click="increment">Increment</button></view></template>`
  const session = new CompilerSession()
  const receipts: PublicationReceipt[] = []
  const observations: Promise<void>[] = []
  const errors: unknown[] = []
  const buildErrors: Error[] = []
  const writeFailure = new Error('classic compiler content deliberate native write failure')
  const handlerStep = (code: unknown) => {
    const value = /["']?handlerStep["']?\s*:\s*(\d+)\b/.exec(String(code))?.[1]
    return value === undefined ? undefined : Number(value)
  }
  const sourceVersion = (file: string) => {
    const relativeFile = path.relative(root, file).replaceAll('\\', '/')
    try {
      return { file: relativeFile, diskHandler: handlerStep(readFileSync(file, 'utf8')) }
    }
    catch (error) {
      return { file: relativeFile, readCode: (error as NodeJS.ErrnoException).code ?? 'unknown' }
    }
  }
  const snapshotDiagnostics: Array<{
    ordinal: number
    stage: 'run' | 'drift'
    forceFullRescan?: boolean
    capturedHandler?: number
    sources: Array<{ file: string, event?: string, diskHandler?: number, readCode?: string }>
  }> = []
  const originalSnapshot = vueStyleSnapshot.withVueStyleDependencySnapshot
  let snapshotOrdinal = 0
  const snapshotBuilds = vi.spyOn(vueStyleSnapshot, 'withVueStyleDependencySnapshot').mockImplementation((...args) => {
    const ordinal = ++snapshotOrdinal
    const [ctx, affectedEntries, changedFiles, run, onDrift, preparation] = args
    return originalSnapshot(ctx, affectedEntries, changedFiles, (options) => {
      snapshotDiagnostics.push({
        ordinal,
        stage: 'run',
        forceFullRescan: options?.forceFullRescan,
        capturedHandler: handlerStep(getCompilerSourceSnapshot(ctx.configService)?.get(pageId)),
        // 只读取可重复数组，不能为诊断消费一次性 Iterable。
        sources: Array.isArray(changedFiles) ? changedFiles.map(sourceVersion) : [],
      })
      return run(options)
    }, (files) => {
      snapshotDiagnostics.push({
        ordinal,
        stage: 'drift',
        sources: files.map(change => ({ ...sourceVersion(change.file), event: change.event })),
      })
      onDrift(files)
    }, preparation)
  })
  let drainedSnapshots = 0
  const drainSnapshotBuilds = async (expectedFailure?: Error) => {
    const failures: unknown[] = []
    // 发布提交早于 END 与源码漂移检查；等待真实调用的返回值，不能用延时猜测收尾。
    while (drainedSnapshots < snapshotBuilds.mock.results.length) {
      const result = snapshotBuilds.mock.results[drainedSnapshots++]!
      if (result.type !== 'return') {
        throw new Error('Snapshot observation did not return its completion', { cause: result.value })
      }
      try {
        await result.value
      }
      catch (error) {
        if (!expectedFailure) {
          throw error
        }
        expect(error).toBeInstanceOf(Error)
        expect((error as Error).message).toContain(expectedFailure.message)
        failures.push(error)
      }
    }
    expect(failures).toHaveLength(expectedFailure ? 1 : 0)
  }
  let failNextWrite = false
  let failedWrite: PublicationReceipt | undefined
  let initialAppJson: string | undefined
  const pending = new WeakMap<object, { api: NativeOutputPublicationApi, epoch: number }>()
  const observer: Plugin = {
    name: 'classic-compiler-content-native-observer',
    generateBundle: {
      order: 'post',
      sequential: true,
      handler() {
        const api = this.environment.config.plugins.find(plugin => plugin.name === WEAPP_VITE_OUTPUT_PUBLICATION_PLUGIN_NAME)?.api as NativeOutputPublicationApi | undefined
        if (!api) {
          throw new Error('Classic build has no native publication observer')
        }
        pending.set(this.environment, { api, epoch: api.getEpoch() })
      },
    },
    writeBundle: {
      order: 'post',
      sequential: true,
      handler(_options, bundle) {
        const publication = pending.get(this.environment)
        if (!publication) {
          throw new Error('Native write has no matching generation')
        }
        pending.delete(this.environment)
        const plan = getHmrStyleUpdatePlan(session.context.configService)
        const profile = session.context.runtimeState.build.hmr.profile
        const pageScript = bundle['pages/index/index.js']
        const receipt: PublicationReceipt = {
          files: Object.keys(bundle),
          epoch: publication.epoch,
          snapshotCall: snapshotBuilds.mock.calls.length,
          writtenStyles: readFileSync(path.join(outDir, 'app.wxss'), 'utf8'),
          capturedHandler: handlerStep(getCompilerSourceSnapshot(session.context.configService)?.get(pageId)),
          emittedHandler: handlerStep(pageScript?.type === 'chunk' ? pageScript.code : undefined),
          profile: { eventId: profile.eventId, batchId: profile.batchId, event: profile.event, file: profile.file },
          plan: plan ? { id: plan.id, full: plan.full, sourceFiles: [...plan.sourceFiles], styleFiles: [...plan.styleFiles], compilerContentOwners: [...plan.compilerContentOwners] } : undefined,
        }
        if (failNextWrite) {
          failNextWrite = false
          failedWrite = receipt
          throw writeFailure
        }
        receipts.push(receipt)
        // 观察原生发布完成；不能在 write hook 等待后置提交，或自行写出样式。
        observations.push(publication.api.whenCommitted(outDir, publication.epoch).then((snapshot) => {
          receipt.snapshot = snapshot
          expect(snapshot?.epoch).toBe(receipt.epoch)
          expect(receipt.writtenStyles).toBe(snapshot?.outputs.get('app.wxss'))
        }).catch((error: unknown) => { errors.push(error) }))
      },
    },
  }
  const waitForPublication = async (cursor: number, color: string, handler: number, acceptStyles?: (styles: string) => boolean) => {
    const find = () => receipts.slice(cursor).find((receipt) => {
      const outputs = receipt.snapshot?.outputs
      const styles = String(outputs?.get('app.wxss'))
      return styles.includes(color)
        && new RegExp(`["']?handlerStep["']?\\s*:\\s*${handler}\\b`).test(String(outputs?.get('pages/index/index.js')))
        && (!acceptStyles || acceptStyles(styles))
    })
    await expect.poll(() => Boolean(find()), { timeout: 15_000 }).toBe(true)
    const receipt = find()!
    if (cursor > 0) {
      // 每次下游修改必须关联到尚未收尾的真实快照调用，避免 spy 失效时屏障退化为空操作。
      expect(receipt.snapshotCall).toBeGreaterThan(drainedSnapshots)
      expect(snapshotBuilds.mock.calls[receipt.snapshotCall - 1]?.[0].configService).toBe(session.context.configService)
    }
    await drainSnapshotBuilds()
    const styles = receipt.snapshot!.outputs.get('app.wxss')
    expect(styles).toBeTypeOf('string')
    expect(styles).toContain(color)
    expect(styles).toContain('author-app')
    expect(styles).toMatch(/width:\s*37px/)
    expect(receipt.writtenStyles).toBe(styles)
    for (const file of ['app.js', 'app.json', 'pages/index/index.js', 'pages/index/index.json', 'pages/index/index.wxml']) {
      expect(receipt.snapshot!.outputs.has(file)).toBe(true)
      expect((await readFile(path.join(outDir, file))).length).toBeGreaterThan(0)
    }
    const appJson = await readFile(path.join(outDir, 'app.json'), 'utf8')
    initialAppJson ??= appJson
    expect(appJson).toBe(initialAppJson)
    expect(receipt.snapshot!.outputs.get('app.json')).toBe(initialAppJson)
    return receipt
  }
  onTestFailed(() => {
    process.stderr.write(`[classic-compiler-content-native] ${JSON.stringify({
      receipts: receipts.map((receipt) => {
        const styles = String(receipt.snapshot?.outputs.get('app.wxss') ?? '')
        return { files: receipt.files, epoch: receipt.epoch, snapshotCall: receipt.snapshotCall, capturedHandler: receipt.capturedHandler, emittedHandler: receipt.emittedHandler, committedHandler: handlerStep(receipt.snapshot?.outputs.get('pages/index/index.js')), profile: receipt.profile, committed: Boolean(receipt.snapshot), plan: receipt.plan, styles: { length: styles.length, colors: styles.match(/background-color:[^;]+/g), nonce: styles.match(/weapp-vite tailwind-content [^*]+/)?.[0] } }
      }),
      errors: errors.map(String),
      failedWrite,
      snapshots: snapshotDiagnostics,
    })}\n`)
  })
  try {
    const files = {
      'package.json': JSON.stringify({ name: 'classic-compiler-content-native', private: true, type: 'module', dependencies: { wevu: '*' } }),
      'project.config.json': JSON.stringify({ appid: 'wxb3d842a4a7e3440d', compileType: 'miniprogram', miniprogramRoot: 'dist/', srcMiniprogramRoot: 'src/' }),
      ...(appKind === 'vue'
        ? { 'src/app.vue': '<script setup>defineAppJson({ pages: ["pages/index/index"] })</script>' }
        : { 'src/app.js': 'App({})', 'src/app.json': JSON.stringify({ pages: ['pages/index/index'] }) }),
      'src/app.css': '@import "tailwindcss";\n@source "./pages/**/*.vue";\n@source "./shared.ts";\n@source "./new-*.ts";\n@source "./content.md";\n.author-app { color: #112234; }',
      'src/shared.ts': 'export const utility = "h-[19px]"',
      'src/content.md': '<view class="max-w-[43px]" />',
      'src/pages/index/index.vue': source(initialColor),
    }
    for (const [file, content] of Object.entries(files)) {
      const target = path.join(root, file)
      await mkdir(path.dirname(target), { recursive: true })
      await writeFile(target, content)
    }
    const require = createRequire(import.meta.url)
    await mkdir(path.join(root, 'node_modules'))
    for (const [name, target] of [
      ['tailwindcss', path.dirname(require.resolve('tailwindcss/package.json'))],
      ['wevu', path.resolve(path.dirname(fileURLToPath(import.meta.resolve('wevu'))), '..')],
      ['weapp-vite', path.resolve(import.meta.dirname, '../../..')],
    ]) {
      await symlink(await realpath(target!), path.join(root, 'node_modules', name!), 'junction')
    }
    const ctx = await session.initialize({
      cwd: root,
      isDev: true,
      mode: 'development',
      inlineConfig: {
        configFile: false,
        logLevel: 'silent',
        plugins: [observer],
        weapp: {
          srcRoot: 'src',
          autoRoutes: false,
          hmr: { runtime: 'classic' },
          styles: [{ source: 'app.css', include: appKind === 'vue' ? 'app.vue' : 'app.js' }],
          tailwindcss: { cssEntries: [path.join(root, 'src/app.css')] },
        },
        build: { minify: true, cssMinify: true, sourcemap: true },
      },
    })
    session.onClose(() => ctx.watcherService.closeAll())
    const watcher = await session.run(() => ctx.buildService.build({ skipNpm: true }))
    if (Array.isArray(watcher) || !('on' in watcher)) {
      throw new Error('Classic development build did not return its watcher')
    }
    watcher.on('event', (event) => {
      if (event.code === 'ERROR') {
        buildErrors.push(event.error)
      }
    })
    await waitForPublication(0, initialColor, 17001)

    for (const color of ['#dbeafe', '#dcfce7', initialColor]) {
      const cursor = receipts.length
      await writeFile(page, source(color))
      const receipt = await waitForPublication(cursor, color, 17001)
      expect(receipt.files).toContain('app.wxss')
      // 原生 JSON 缓存省略未变配置时，发布清单仍必须持有它；Vue 元数据可重新发射。
      if (appKind === 'native') {
        expect(receipt.files).not.toContain('app.json')
      }
    }

    const cursor = receipts.length
    // 动态 class 会保守扫描所有脚本字符串；用数值步长修改真正的纯事件逻辑。
    await writeFile(page, source(initialColor, 17002))
    const handler = await waitForPublication(cursor, initialColor, 17002)
    expect(handler.files).toContain('pages/index/index.js')
    // 纯业务逻辑不应重新生成全局编译器样式，原生发布仍须保留其所有权。
    expect(handler.files).not.toContain('app.wxss')

    const retryCursor = receipts.length
    const failedSnapshotCursor = snapshotBuilds.mock.calls.length
    failNextWrite = true
    await writeFile(page, source('#fef3c7', 17002))
    await expect.poll(() => buildErrors.map(error => error.message), { timeout: 15_000 }).toEqual([
      expect.stringContaining(writeFailure.message),
    ])
    expect(snapshotBuilds.mock.calls.length).toBeGreaterThan(drainedSnapshots)
    await drainSnapshotBuilds(writeFailure)
    expect(failedWrite).toBeDefined()
    const failed = failedWrite!
    expect(failed.snapshotCall).toBeGreaterThan(failedSnapshotCursor)
    expect(failed.emittedHandler).toBe(17002)
    expect(failed.files).toContain('app.wxss')
    expect(failed.plan?.compilerContentOwners).toContainEqual([appOwner, 'tailwind-content'])
    // 已排队的保存可能先于显式 handler 修改完成重试；失败前冻结 cursor，认领首个真实成功提交。
    await writeFile(page, source('#fef3c7', 17003))
    const retryHandler = await waitForPublication(retryCursor, '#fef3c7', 17003)
    const retry = receipts.slice(retryCursor).find(receipt => receipt.snapshot)!
    expect(retry.snapshot).toBeDefined()
    expect(retry.epoch).toBeGreaterThan(failed.epoch)
    expect(retry.snapshotCall).toBeGreaterThan(failed.snapshotCall)
    expect(snapshotBuilds.mock.calls[retry.snapshotCall - 1]?.[0].configService).toBe(session.context.configService)
    expect(retry.snapshot!.epoch).toBe(retry.epoch)
    expect(retry.files).toContain('app.wxss')
    expect(retry.plan?.compilerContentOwners).toContainEqual([appOwner, 'tailwind-content'])
    expect([17002, 17003]).toContain(retry.emittedHandler)
    expect(retry.capturedHandler).toBe(retry.emittedHandler)
    expect(handlerStep(retry.snapshot!.outputs.get('pages/index/index.js'))).toBe(retry.emittedHandler)
    const retriedStyles = retry.snapshot!.outputs.get('app.wxss')
    expect(retriedStyles).toContain('#fef3c7')
    expect(retriedStyles).toBe(retryHandler.snapshot!.outputs.get('app.wxss'))
    expect(retry.writtenStyles).toBe(retriedStyles)
    if (retry !== retryHandler) {
      expect(retryHandler.files).not.toContain('app.wxss')
      expect(retryHandler.plan?.compilerContentOwners).toEqual([])
    }
    // owner 交付成功后，两个 handler 值的后续修改都必须保持局部，不能继续重发全局样式。
    for (const nextHandler of [17004, 17003, 17004]) {
      const localCursor = receipts.length
      await writeFile(page, source('#fef3c7', nextHandler))
      const local = await waitForPublication(localCursor, '#fef3c7', nextHandler)
      expect(local.files).toContain('pages/index/index.js')
      expect(local.files).not.toContain('app.wxss')
      expect(local.plan?.compilerContentOwners).toEqual([])
      expect(local.snapshot!.outputs.get('app.wxss')).toBe(retriedStyles)
      expect(local.snapshot!.outputs.get('app.wxss')).toMatch(/height:\s*19px/)
      expect(local.snapshot!.outputs.get('app.wxss')).toMatch(/max-width:\s*43px/)
    }

    // 仅供 @source 扫描的脚本没有模块导入，更新、删除和恢复仍须驱动原生样式发布。
    const sharedUpdateCursor = receipts.length
    await writeFile(shared, 'export const utility = "h-[23px]"')
    const sharedUpdate = await waitForPublication(sharedUpdateCursor, '#fef3c7', 17004, styles => /height:\s*23px/.test(styles))
    expect(sharedUpdate.files).toContain('app.wxss')
    expect(sharedUpdate.snapshot!.outputs.get('app.wxss')).not.toMatch(/height:\s*19px/)
    const sharedDeleteCursor = receipts.length
    await rm(shared)
    const sharedDelete = await waitForPublication(sharedDeleteCursor, '#fef3c7', 17004, styles => !/height:\s*(?:19|23)px/.test(styles))
    expect(sharedDelete.files).toContain('app.wxss')
    const sharedRestoreCursor = receipts.length
    await writeFile(shared, 'export const utility = "h-[19px]"')
    const sharedRestore = await waitForPublication(sharedRestoreCursor, '#fef3c7', 17004, styles => /height:\s*19px/.test(styles))
    expect(sharedRestore.files).toContain('app.wxss')
    expect(sharedRestore.snapshot!.outputs.get('app.wxss')).not.toMatch(/height:\s*23px/)
    // 显式 glob 范围内首次出现的来源没有旧模块和旧候选，也须进入同一发布队列。
    const addedCursor = receipts.length
    await writeFile(added, 'export const utility = "min-h-[47px]"')
    const addedSource = await waitForPublication(addedCursor, '#fef3c7', 17004, styles => /min-height:\s*47px/.test(styles))
    expect(addedSource.files).toContain('app.wxss')
    // 显式内容范围不只接受 JS 扩展名；Markdown 不进入脚本模块图。
    const markdownCursor = receipts.length
    await writeFile(markdown, '<view class="max-w-[61px]" />')
    const markdownUpdate = await waitForPublication(markdownCursor, '#fef3c7', 17004, styles => /max-width:\s*61px/.test(styles))
    expect(markdownUpdate.files).toContain('app.wxss')
    expect(markdownUpdate.snapshot!.outputs.get('app.wxss')).not.toMatch(/max-width:\s*43px/)
    const markdownRestoreCursor = receipts.length
    await writeFile(markdown, '<view class="max-w-[43px]" />')
    const markdownRestore = await waitForPublication(markdownRestoreCursor, '#fef3c7', 17004, styles => /max-width:\s*43px/.test(styles))
    expect(markdownRestore.files).toContain('app.wxss')
    expect(markdownRestore.snapshot!.outputs.get('app.wxss')).not.toMatch(/max-width:\s*61px/)
    expect(buildErrors).toHaveLength(1)
    expect(ctx.watcherService.rollupWatcherMap.size).toBeGreaterThan(0)
    await session.close()
    await drainSnapshotBuilds()
    await Promise.all(observations)
    const finalReceipt = receipts.at(-1)!
    expect(finalReceipt.snapshot).toBeDefined()
    const finalSnapshot = finalReceipt.snapshot!
    const finalStyles = finalSnapshot.outputs.get('app.wxss')
    expect(finalStyles).toBeTypeOf('string')
    expect(finalStyles).toContain('#fef3c7')
    expect(finalStyles).toContain('author-app')
    expect(finalStyles).toMatch(/width:\s*37px/)
    expect(finalStyles).toMatch(/height:\s*19px/)
    expect(finalStyles).toMatch(/min-height:\s*47px/)
    expect(finalStyles).toMatch(/max-width:\s*43px/)
    expect(finalStyles).not.toMatch(/max-width:\s*61px/)
    expect(handlerStep(finalSnapshot.outputs.get('pages/index/index.js'))).toBe(17004)
    expect(finalSnapshot.outputs.get('app.json')).toBe(initialAppJson)
    for (const file of ['app.wxss', 'app.js', 'app.json', 'pages/index/index.js', 'pages/index/index.json', 'pages/index/index.wxml']) {
      expect(finalSnapshot.outputs.has(file)).toBe(true)
      expect(await readFile(path.join(outDir, file), 'utf8')).toBe(finalSnapshot.outputs.get(file))
    }
    expect(errors).toEqual([])
  }
  finally {
    try {
      await session.close()
      await session.close()
      await Promise.all(observations)
      expect(session.context.watcherService.rollupWatcherMap.size).toBe(0)
      expect(session.context.watcherService.sidecarWatcherMap.size).toBe(0)
      expect(session.context.runtimeState.build.independent.watchListeners.size).toBe(0)
      expect(errors).toEqual([])
    }
    finally {
      snapshotBuilds.mockRestore()
      await rm(root, { recursive: true, force: true })
    }
  }
}, 90_000)
