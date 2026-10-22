import type { RolldownWatcher, RolldownWatcherEvent } from 'rolldown'
import type { Plugin, ViteDevServer } from 'vite'
import type { NativeOutputPublicationApi, NativeOutputPublicationSnapshot } from '../plugins/outputFinalizer/publicationObservation'
import type { HmrRuntimeSession } from '../runtime/hmrRuntimeSession'
import type { WeappVitePluginApi } from '../types'
import { mkdir, mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import { WEAPP_VITE_OUTPUT_PUBLICATION_PLUGIN_NAME, WEAPP_VITE_STATEFUL_HMR_CONTROL_FILE, WEAPP_VITE_STATEFUL_HMR_PRELOAD_FILE, WEAPP_VITE_STATEFUL_HMR_UPDATE_FILE } from '@weapp-core/constants'
import path from 'pathe'
import { createServer } from 'vite'
import { expect, it } from 'vitest'
import { getHmrRuntimeSession } from '../runtime/hmrRuntimeSession'
import { weapp } from './index'

interface BuildReceipt {
  generated: boolean
  wrote: boolean
  error?: Error
  publication?: { api: NativeOutputPublicationApi, epoch: number }
  committed?: NativeOutputPublicationSnapshot
  fingerprint?: string
}

it('replaces optional stylesheet ownership and preserves required import errors after classic handoff', async () => {
  const root = await realpath(await mkdtemp(path.join(os.tmpdir(), 'weapp-vite-classic-style-scan-')))
  const style = path.join(root, 'src/pages/home/index.wxss')
  const requiredStyle = path.join(root, 'src/pages/home/required.css')
  let runtime: HmrRuntimeSession | undefined
  let server: ViteDevServer | undefined
  const builds: BuildReceipt[] = []
  const currentBuilds = new WeakMap<object, BuildReceipt>()
  const observations: Promise<void>[] = []
  const observationErrors: unknown[] = []
  let classicContext: WeappVitePluginApi['ctx'] | undefined
  const outDir = path.join(root, 'dist')
  const styleName = 'pages/home/index.wxss'
  let heldWrite: BuildReceipt | undefined
  const releaseFinalWrite = Promise.withResolvers<void>()
  let releaseWatcher: (() => void) | undefined
  let holdClassicPublication = true
  let classicPrewriteEntered = false
  const releaseClassicPrewrite = Promise.withResolvers<void>()
  const probe: Plugin = {
    name: 'classic-style-scan-publication-probe',
    buildStart() {
      if (runtime && runtime.phase !== 'stateful' && this.environment.config.build.write !== false) {
        const receipt: BuildReceipt = { generated: false, wrote: false }
        builds.push(receipt)
        currentBuilds.set(this.environment, receipt)
      }
    },
    configureServer(host) {
      if (!runtime) {
        const api = host.config.plugins.find(plugin => plugin.name === 'weapp-vite:context')?.api as WeappVitePluginApi | undefined
        if (!api) {
          throw new Error('The style scan fixture did not expose its compiler context')
        }
        runtime = getHmrRuntimeSession(api.ctx)
      }
    },
    buildEnd(error) {
      const receipt = currentBuilds.get(this.environment)
      if (error && receipt) {
        receipt.error = error
      }
    },
    generateBundle: {
      order: 'post',
      sequential: true,
      async handler() {
        const receipt = currentBuilds.get(this.environment)
        if (receipt) {
          receipt.generated = true
          const context = this.environment.config.plugins.find(plugin => plugin.name === 'weapp-vite:context')?.api as WeappVitePluginApi | undefined
          if (!context) {
            throw new Error('The classic build did not expose its compiler context')
          }
          classicContext = context.ctx
          const api = this.environment.config.plugins.find(plugin => plugin.name === WEAPP_VITE_OUTPUT_PUBLICATION_PLUGIN_NAME)?.api as NativeOutputPublicationApi | undefined
          if (!api) {
            throw new Error('The classic build did not expose its native publication API')
          }
          receipt.publication = { api, epoch: api.getEpoch() }
        }
        if (!holdClassicPublication || !runtime?.fallback || this.environment.config.build.write === false) {
          return
        }
        holdClassicPublication = false
        classicPrewriteEntered = true
        await releaseClassicPrewrite.promise
      },
    },
    writeBundle: {
      order: 'post',
      sequential: true,
      async handler() {
        const receipt = currentBuilds.get(this.environment)
        if (!receipt?.publication) {
          return
        }
        receipt.wrote = true
        if (!heldWrite && (await readFile(path.join(outDir, styleName), 'utf8')).includes('7px')) {
          heldWrite = receipt
          await releaseFinalWrite.promise
        }
        const { api, epoch } = receipt.publication
        // 不阻塞后置原生提交；观察结果始终绑定同一插件实例与代次。
        observations.push(api.whenCommitted(outDir, epoch).then((snapshot) => {
          if (snapshot) {
            expect(snapshot.root).toBe(outDir)
            expect(snapshot.epoch).toBe(epoch)
            receipt.committed = snapshot
            receipt.fingerprint = runtime!.outputGenerations.get(outDir)?.fingerprint
          }
        }).catch((error: unknown) => { observationErrors.push(error) }))
      },
    },
  }
  const readStyle = () => readFile(path.join(outDir, styleName), 'utf8')
  const committedStyle = (receipt: BuildReceipt) => receipt.committed?.outputs.get(styleName)
  const styleView = (output: string) => ({
    hasSourceColor: output.includes('#1f1a3f'),
    padding: Array.from(output.matchAll(/padding-left\s*:\s*([^;}\s]+)/g), match => match[1]),
    border: Array.from(output.matchAll(/border-top-width\s*:\s*([^;}\s]+)/g), match => match[1]),
  })
  const waitForStyle = async (cursor: number, width: number | undefined, padding = 13) => {
    const expected = { hasSourceColor: true, padding: [`${padding}px`], border: width === undefined ? [] : [`${width}px`] }
    const find = () => builds.slice(cursor).find((receipt) => {
      const output = committedStyle(receipt)
      return typeof output === 'string' && JSON.stringify(styleView(output)) === JSON.stringify(expected)
    })
    await expect.poll(() => Boolean(find()), { timeout: 15_000 }).toBe(true)
    const receipt = find()!
    expect(styleView(committedStyle(receipt) as string)).toEqual(expected)
    expect(await readStyle()).toBe(committedStyle(receipt))
    return receipt
  }
  const expectClassic = async () => {
    expect(runtime!.phase).toBe('classic')
    expect(server!.config.experimental.bundledDev).toBe(false)
    for (const file of [WEAPP_VITE_STATEFUL_HMR_CONTROL_FILE, WEAPP_VITE_STATEFUL_HMR_PRELOAD_FILE, WEAPP_VITE_STATEFUL_HMR_UPDATE_FILE]) {
      await expect(readFile(path.join(root, 'dist', file))).rejects.toMatchObject({ code: 'ENOENT' })
    }
  }
  try {
    for (const [file, content] of Object.entries({
      'package.json': '{"name":"classic-style-scan-fixture","type":"module"}',
      'project.config.json': '{"appid":"wxb3d842a4a7e3440d","miniprogramRoot":"dist"}',
      'project.private.config.json': '{"setting":{"compileHotReLoad":true},"condition":{"miniprogram":{"list":[{"name":"Style scan","pathName":"pages/home/index"}]}}}',
      'src/app.js': 'App({})',
      'src/app.json': '{"pages":["pages/home/index"]}',
      'src/pages/home/index.js': 'import "./index.css"; import "./required.css"; Page({ data: { message: "style-scan-owner" } })',
      'src/pages/home/index.json': '{}',
      'src/pages/home/index.wxml': '<view class="owner">{{message}}</view>',
      'src/pages/home/index.css': '.owner { color: #1f1a3f; }',
      'src/pages/home/index.wxss': '.owner { border-top-width: 1px; }',
      'src/pages/home/required.css': '.owner { padding-left: 13px; }',
    })) {
      await mkdir(path.dirname(path.join(root, file)), { recursive: true })
      await writeFile(path.join(root, file), content)
    }
    server = await createServer({
      root,
      configFile: false,
      logLevel: 'silent',
      plugins: [weapp(), probe],
      weapp: { srcRoot: 'src', autoRoutes: false, vue: { enable: false }, hmr: { runtime: 'stateful-experimental' } },
      server: { middlewareMode: true, host: '127.0.0.1', port: 0, ws: false },
      build: { minify: false, cssMinify: false },
    })
    const statefulStyle = await readStyle()
    expect(statefulStyle).toContain('1px')
    await writeFile(style, '.owner { border-top-width: 3px; }')
    await expect.poll(() => runtime!.fallback?.code, { timeout: 15_000 }).toBe('stylesheet-output')
    await expect.poll(() => classicPrewriteEntered, { timeout: 15_000 }).toBe(true)
    expect(runtime!.phase).toBe('switching')
    expect(builds.some(receipt => receipt.wrote || receipt.committed)).toBe(false)
    expect(await readStyle()).toBe(statefulStyle)
    releaseClassicPrewrite.resolve()
    await runtime!.whenSettled()
    await expect.poll(readStyle, { timeout: 15_000 }).toContain('3px')
    await expectClassic()

    for (const width of [undefined, 5, undefined]) {
      const cursor = builds.length
      if (width === undefined) {
        await rm(style)
      }
      else {
        await writeFile(style, `.owner { border-top-width: ${width}px; }`)
      }
      await waitForStyle(cursor, width)
      await expectClassic()
    }

    // 固定复现旧成功代尚未结束、下一次删除已到达的时序，禁止跨代计数归因。
    await writeFile(style, '.owner { border-top-width: 7px; }')
    await expect.poll(() => Boolean(heldWrite), { timeout: 15_000 }).toBe(true)
    const lastSuccessfulStyle = await readStyle()
    expect(styleView(lastSuccessfulStyle)).toEqual({ hasSourceColor: true, padding: ['13px'], border: ['7px'] })
    const watcher = classicContext!.watcherService!.rollupWatcherMap.get('/') as RolldownWatcher
    const watcherErrors: Error[] = []
    const onEvent = (event: RolldownWatcherEvent) => {
      if (event.code === 'ERROR') {
        watcherErrors.push(event.error)
      }
    }
    watcher.on('event', onEvent)
    releaseWatcher = () => watcher.off('event', onEvent)
    const cursor = builds.length
    await rm(requiredStyle)
    releaseFinalWrite.resolve()
    await expect.poll(() => Boolean(heldWrite!.committed), { timeout: 15_000 }).toBe(true)
    const lastFingerprint = heldWrite!.fingerprint
    expect(lastFingerprint).toBeTypeOf('string')
    await expect.poll(() => watcherErrors.some(error => error.message.includes('required.css')), { timeout: 15_000 }).toBe(true)
    const failures = builds.slice(cursor).filter(receipt => receipt.error)
    expect(failures.length).toBeGreaterThan(0)
    for (const receipt of failures) {
      expect(receipt.error!.message).toContain('required.css')
      expect(receipt).toMatchObject({ generated: false, wrote: false })
      expect(receipt.publication).toBeUndefined()
      expect(receipt.committed).toBeUndefined()
    }
    expect(runtime!.outputGenerations.get(outDir)?.fingerprint).toBe(lastFingerprint)
    expect(await readStyle()).toBe(lastSuccessfulStyle)
    await expectClassic()

    const restoreCursor = builds.length
    await writeFile(requiredStyle, '.owner { padding-left: 17px; }')
    const restored = await waitForStyle(restoreCursor, 7, 17)
    expect(restored.fingerprint).not.toBe(lastFingerprint)
    await expectClassic()
  }
  finally {
    releaseClassicPrewrite.resolve()
    releaseFinalWrite.resolve()
    releaseWatcher?.()
    try {
      await server?.close()
      await Promise.all(observations)
      expect(observationErrors).toEqual([])
      // 保存全部提交视图，避免错误写出被后续恢复覆盖后漏检。
      for (const receipt of builds) {
        if (receipt.error) {
          expect(receipt).toMatchObject({ generated: false, wrote: false })
          expect(receipt.committed).toBeUndefined()
        }
        if (receipt.committed) {
          const output = committedStyle(receipt)
          expect(output).toBeTypeOf('string')
          const view = styleView(output as string)
          expect(view.hasSourceColor).toBe(true)
          expect([['13px'], ['17px']]).toContainEqual(view.padding)
        }
      }
    }
    finally {
      await rm(root, { recursive: true, force: true })
    }
  }
}, 90_000)
