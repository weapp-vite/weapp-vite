import type { startDevProcess } from '../../utils/dev-process'
import path from 'node:path'
import process from 'node:process'
import { WEAPP_VITE_STATEFUL_HMR_BRIDGE_KEY, WEAPP_VITE_STATEFUL_HMR_CLIENT_KEY, WEAPP_VITE_STATEFUL_HMR_CONTROL_KEY } from '@weapp-core/constants'
import { fs } from '@weapp-core/shared/node'
import { expect, vi } from 'vitest'
import { resolveRuntimeCompilerCli } from '../../../packages/weapp-vite/scripts/consumerRuntimeHost.mjs'
import { launchAutomator, reconnectAutomator } from '../../utils/automator'
import { runCleanupSteps } from '../../utils/cleanupSteps'
import { createDevProcessEnv } from '../../utils/dev-process-env'
import { replaceFileByRename, waitForStatefulHmrControl } from '../../utils/hmr-helpers'
import { createNativeHmrPublication } from '../../utils/nativeHmrPublication'
import { startRuntimeDevProcess } from '../../utils/runtimeDevProcess'
import { resolveRuntimeProviderName } from '../../utils/runtimeProvider'
import { createStatefulHmrProject } from '../../utils/statefulHmrProject'
import { captureScopedSlotDiagnostics } from './scopedSlotDiagnostic'
import { installStatefulHmrTransport } from './transport'

const ROOT = path.resolve(import.meta.dirname, '../../..')
const ROUTE = '/pages/wevu/index?source=compiled-template'
const provider = resolveRuntimeProviderName()

/** 同一 fixture 复用唯一宿主；真实 IDE 更新后只重连，headless 重开单独作为 companion。 */
export function createTemplateFallbackSession(external: boolean, options: { scopedSlots?: boolean } = {}) {
  let fixture: Awaited<ReturnType<typeof createStatefulHmrProject>> | undefined
  let dev: ReturnType<typeof startDevProcess> | undefined
  let publication: ReturnType<typeof createNativeHmrPublication> | undefined
  let transport: ReturnType<typeof installStatefulHmrTransport> | undefined
  let miniProgram: any
  let original = ''
  let source = ''
  let profilePath = ''
  let saveGeneration = 0
  let runtimeReleased = true
  let devReleased = true

  async function assertScopedSlotOutputs() {
    if (!options.scopedSlots) {
      return
    }
    const configFile = path.join(fixture!.projectRoot, 'dist/pages/wevu/index.json')
    const config = await fs.readJson(configFile) as { usingComponents?: Record<string, string> }
    const slots = Object.values(config.usingComponents ?? {}).filter(target => target.includes('.__scoped-slot-'))
    expect(slots.length, 'the page must publish its scoped-slot component dependencies').toBeGreaterThan(0)
    for (const slot of slots) {
      const base = slot.startsWith('/')
        ? path.join(fixture!.projectRoot, 'dist', slot.slice(1))
        : path.resolve(path.dirname(configFile), slot)
      for (const extension of ['js', 'json', 'wxml']) {
        expect(await fs.pathExists(`${base}.${extension}`), `scoped-slot dependency .${extension}`).toBe(true)
      }
    }
  }

  async function connect(stateful: boolean) {
    runtimeReleased = false
    const project = fixture!.projectRoot
    return launchAutomator({
      projectPath: project,
      launchMode: 'bridge',
      trustProject: true,
      timeout: 120_000,
      warmupRoute: ROUTE,
      warmupRootSelectors: ['.page'],
      projectConfig: { setting: { urlCheck: false, useIsolateContext: false, useMultiFrameRuntime: false } },
      ...(stateful
        ? {
            async configureHeadlessSession(session) {
              const control = await waitForStatefulHmrControl(path.join(project, 'dist/__weapp_vite_hmr/control.js'))
              transport = installStatefulHmrTransport(session, control.url, path.join(project, 'dist/__weapp_vite_hmr/update.js'))
            },
          }
        : {}),
      bridgeProjectMode: 'direct',
    })
  }

  async function state() {
    const runtime = await miniProgram.evaluate((keys: string[]) => {
      const pages = getCurrentPages()
      const page = pages[pages.length - 1] as any
      const global = globalThis as any
      return {
        identity: String(page?.__compiledTemplateIdentity ?? ''),
        route: String(page?.route ?? ''),
        pollingStopped: [global[keys[0]!], global.wx?.[keys[0]!]].every(client => !client || client.getTransportState?.().phase === 'stopped'),
        statefulKeys: keys.map(key => Boolean(global[key] || global.wx?.[key])),
      }
    }, [WEAPP_VITE_STATEFUL_HMR_CLIENT_KEY, WEAPP_VITE_STATEFUL_HMR_BRIDGE_KEY, WEAPP_VITE_STATEFUL_HMR_CONTROL_KEY])
    const page = await miniProgram.currentPage()
    const data = await page.data(undefined, { fallback: false })
    return { ...runtime, count: Number(data.count), storeCount: Number(data.storeCount), input: String(data.input ?? ''), marker: String(data.marker) }
  }

  async function observeReload(marker: string) {
    if (provider === 'headless') {
      // 退役响应必须先由原客户端消费，测试 cleanup 不能制造“已停止轮询”的证据。
      await expect.poll(async () => (await state()).pollingStopped, { timeout: 30_000 }).toBe(true)
      await transport?.close()
      transport = undefined
      await miniProgram.close()
      runtimeReleased = true
      miniProgram = await connect(false)
    }
    else {
      miniProgram = await reconnectAutomator(miniProgram)
    }
    await expect.poll(() => state().catch(() => null), { timeout: 90_000 }).toMatchObject({
      marker,
      count: 0,
      storeCount: 0,
      input: '',
      identity: '',
      route: 'pages/wevu/index',
      pollingStopped: true,
      statefulKeys: [false, false, false],
    })
    await publication!.assertClassicRuntime(miniProgram)
    await assertScopedSlotOutputs()
  }

  return {
    get miniProgram() { return miniProgram },
    get original() { return original },
    get external() { return external },
    state,
    async start() {
      const host = process.env.WEAPP_VITE_E2E_COMPILER_HOST ?? 'wv'
      if (!['wv', 'vite', 'vite-plus'].includes(host)) {
        throw new Error(`Unsupported compiled template fixture host: ${host}`)
      }
      fixture = await createStatefulHmrProject(ROOT, { compilerHost: host })
      const project = fixture.projectRoot
      source = path.join(project, 'src/pages/wevu/index.vue')
      original = await fs.readFile(source, 'utf8')
      if (options.scopedSlots) {
        const component = path.join(project, 'src/components/scoped-host/index.vue')
        await fs.ensureDir(path.dirname(component))
        await fs.writeFile(component, '<script setup lang="ts">\nconst value = \'SLOT-READY\'\n</script>\n<template><view><slot :value="value" /></view></template>\n')
        original = original.replace('<input', '<scoped-host id="scoped-host"><template #default="{ value }"><view class="scoped-value">{{ value + \':\' + count }}</view></template></scoped-host>\n    <input')
        await fs.writeFile(source, original)
      }
      if (external) {
        const template = original.match(/<template>([\s\S]*?)<\/template>/)?.[1]
        expect(template).toBeTruthy()
        await fs.writeFile(source, original.replace(/<template>[\s\S]*?<\/template>/, '<template src="./view.html" />'))
        source = path.join(path.dirname(source), 'view.html')
        original = template!
        await fs.writeFile(source, original)
      }
      // 该独立 fixture 的默认页即被验收页，classic 自动重载无需测试导航修正页面。
      const appFile = path.join(project, 'src/app.json')
      const app = await fs.readJson(appFile) as { pages: string[], [key: string]: unknown }
      app.pages = ['pages/wevu/index', ...app.pages.filter(page => page !== 'pages/wevu/index')]
      await fs.writeJson(appFile, app, { spaces: 2 })
      const config = path.join(project, 'weapp-vite.config.ts')
      const observer = path.relative(project, path.join(ROOT, 'e2e/utils/nativePublication/plugin.ts')).replaceAll('\\', '/')
      await fs.writeFile(config, `import { nativePublicationPlugin } from ${JSON.stringify(observer)}\n${await fs.readFile(config, 'utf8')}`
        .replace('export default defineConfig({', 'export default defineConfig({\n  plugins: [nativePublicationPlugin({ profilePath: process.env.WEAPP_VITE_HMR_PROFILE_JSON })],')
        .replace('logLevel: \'verbose\',', `runtime: '${external ? 'stateful-experimental' : 'auto'}', logLevel: 'verbose',`))
      const viteConfig = path.join(project, 'vite.stateful.config.mts')
      await fs.writeFile(viteConfig, (await fs.readFile(viteConfig, 'utf8'))
        .replace('plugins: [weapp()],', 'plugins: [...(config.plugins ?? []), weapp()],')
        .replace('hmr: { runtime: \'stateful-experimental\', logLevel: \'verbose\' },', 'hmr: config.weapp.hmr,'))
      profilePath = path.join(project, '.tmp/hmr-profile.jsonl')
      const cli = resolveRuntimeCompilerCli(host, project, { repositoryRoot: ROOT })
      devReleased = false
      dev = await startRuntimeDevProcess(host, host === 'wv'
        ? [cli, 'dev', project, '--platform', 'weapp', '--skipNpm']
        : [cli, 'dev', '--config', 'vite.stateful.config.mts', '--host', '127.0.0.1', '--port', '0'], {
        cwd: project,
        all: true,
        env: { ...createDevProcessEnv(), WEAPP_VITE_HMR_PROFILE_JSON: profilePath },
        reject: false,
      })
      publication = createNativeHmrPublication(project, dev, external ? 'stateful-experimental' : 'auto', ['native-registration'], profilePath)
      await dev.waitFor(waitForStatefulHmrControl(path.join(project, 'dist/__weapp_vite_hmr/control.js')), 'initial compiled template stateful control')
      await dev.waitForInitialBuild(90_000)
      for (const extension of ['js', 'json', 'wxml']) {
        expect(await fs.pathExists(path.join(project, `dist/pages/wevu/index.${extension}`))).toBe(true)
      }
      await assertScopedSlotOutputs()
      miniProgram = await connect(true)
      await vi.waitFor(async () => {
        expect((await state()).statefulKeys).toEqual([true, true, true])
      }, { timeout: 30_000 })
    },
    async begin() {
      expect(await fs.readFile(source, 'utf8'), 'previous compiled template case must restore its source').toBe(original)
      await miniProgram.reLaunch(ROUTE)
      await expect.poll(async () => (await state()).count).toBe(0)
    },
    async diagnoseScopedSlot(stage: string) {
      if (options.scopedSlots && fixture) {
        await captureScopedSlotDiagnostics(fixture.projectRoot, miniProgram, stage)
      }
    },
    async prepare() {
      await miniProgram.evaluate(() => {
        const pages = getCurrentPages()
        ;(pages[pages.length - 1] as any).__compiledTemplateIdentity = 'before-template-update'
      })
      const page = await miniProgram.currentPage()
      await (await page.$('.input', { fallback: false })).input('held-input')
      await (await page.$('.increment', { fallback: false })).tap()
      await (await page.$('.increment', { fallback: false })).tap()
      await expect.poll(state).toMatchObject({ count: 2, input: 'held-input', identity: 'before-template-update' })
    },
    async tap(selector = '.increment') {
      await (await (await miniProgram.currentPage()).$(selector, { fallback: false })).tap()
    },
    async save(content: string, marker = 'STATEFUL-WEVU-BASE') {
      await miniProgram.evaluate((identity: string) => {
        const pages = getCurrentPages()
        ;(pages[pages.length - 1] as any).__compiledTemplateIdentity = identity
      }, `before-template-save-${++saveGeneration}`)
      const stateful = publication!.stateful
      if (options.scopedSlots) {
        await captureScopedSlotDiagnostics(fixture!.projectRoot, miniProgram, `before-publication-${saveGeneration}`)
      }
      const pending = publication!.capture(source)
      await replaceFileByRename(source, content)
      await pending.wait()
      if (stateful) {
        expect(publication!.stateful, 'compiled template registration must complete the classic handoff').toBe(false)
      }
      try {
        await observeReload(marker)
      }
      catch (error) {
        if (options.scopedSlots) {
          await captureScopedSlotDiagnostics(fixture!.projectRoot, miniProgram, `failed-reload-${saveGeneration}`)
        }
        throw error
      }
      expect(dev!.getBuildErrors()).toEqual([])
    },
    async close() {
      await runCleanupSteps([
        { label: 'compiled template transport', run: async () => { await transport?.close() } },
        { label: 'compiled template runtime', run: async () => {
          if (miniProgram) {
            await miniProgram.close()
            runtimeReleased = true
          }
        } },
        { label: 'compiled template dev process', run: async () => {
          if (dev) {
            await dev.stop(5_000)
            devReleased = true
          }
        } },
        { label: 'compiled template fixture', run: async () => {
          if (!runtimeReleased || !devReleased) {
            throw new Error('Compiled template resources are not released; preserving fixture')
          }
          await fixture?.cleanup()
        } },
      ])
    },
  }
}
