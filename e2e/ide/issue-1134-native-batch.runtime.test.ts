import { writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { WEAPP_VITE_STATEFUL_HMR_CLIENT_KEY } from '@weapp-core/constants'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { captureAppReloadMarker, waitForAppReload } from '../utils/appReload'
import { launchAutomator, reconnectAutomator } from '../utils/automator'
import { startDevProcess } from '../utils/dev-process'
import { createDevProcessEnv } from '../utils/dev-process-env'
import { createDomAcceptance } from '../utils/domAcceptance'
import { renameAtomicFile } from '../utils/hmrAtomicRename'
import { createNativeBatchProject, NATIVE_BATCH_CLI, NATIVE_BATCH_STEPS, readNativeBatchDiagnostics, readNativeBatchOutput, readNativeBatchSources, writeNativeBatch } from '../utils/nativeBatchProject'
import { createNativeBatchSourceNotification } from '../utils/nativeBatchSourceNotification'
import { createNativeHmrPublication } from '../utils/nativeHmrPublication'
import { installNativePublicationObserver } from '../utils/nativePublication/project'
import { resolveRuntimeProviderName } from '../utils/runtimeProvider'
import { installStatefulHmrTransport } from '../utils/statefulHmrTransport'
import { cleanupTemporaryRuntimeProject } from '../utils/temporaryRuntimeProject'

const route = '/pages/index/index'
const fixture = 'e2e-apps/github-issues/fixtures/issue-1134-native-batch'

describe.each(['classic', 'stateful-experimental'] as const)('issue #1134 native four-file runtime (%s)', (runtime) => {
  let project: string
  let source: Awaited<ReturnType<typeof readNativeBatchSources>>
  let dev: ReturnType<typeof startDevProcess> | undefined
  let miniProgram: Awaited<ReturnType<typeof launchAutomator>> | undefined
  let disposeTransport: (() => void) | undefined
  let lateScriptSave: Promise<void> | undefined
  let publication: ReturnType<typeof createNativeHmrPublication>
  let profilePath = ''
  const stateful = runtime === 'stateful-experimental'

  async function saveScript(contents: string) {
    const file = path.join(project, 'src/pages/index/index.js')
    await writeFile(`${file}.tmp`, contents)
    await renameAtomicFile(`${file}.tmp`, file)
  }

  const notification = createNativeBatchSourceNotification(() => {
    lateScriptSave = saveScript(source.js.replaceAll('BATCH_BASE', 'BATCH_FIRST'))
    // 原断言会读取该失败；流回调不能提前产生未处理的 rejection。
    void lateScriptSave.catch(() => {})
  })

  async function waitInitialReady() {
    await expect.poll(() => miniProgram!.evaluate((key: string) => (globalThis as any)[key].getTransportState().initialReady, WEAPP_VITE_STATEFUL_HMR_CLIENT_KEY), { timeout: 30_000 }).toBe(true)
  }

  function readVersion() {
    return miniProgram!.evaluate((key: string) => (globalThis as any)[key].getVersion(), WEAPP_VITE_STATEFUL_HMR_CLIENT_KEY)
  }

  async function connect() {
    return await launchAutomator({
      projectPath: project,
      bridgeProjectMode: 'direct',
      warmupRoute: route,
      warmupRootSelectors: ['#batch'],
      configureHeadlessSession: publication.stateful
        ? (session) => { disposeTransport = installStatefulHmrTransport(session, path.join(project, 'dist')) }
        : undefined,
    })
  }

  async function reconnect(marker: Awaited<ReturnType<typeof captureAppReloadMarker>>) {
    await publication.settleMode()
    disposeTransport?.()
    disposeTransport = undefined
    if (resolveRuntimeProviderName() === 'headless') {
      // companion 只验证新产物；真实 IDE 分支独立观察既有窗口的自动重载。
      await miniProgram!.close()
      miniProgram = await connect()
    }
    else {
      miniProgram = await reconnectAutomator(miniProgram!)
    }
    // 协议重连不证明引擎已更新；任何后续导航前先核对 App 替换和原生根。
    await waitForAppReload(miniProgram!, marker, '#batch')
    await publication.assertClassicRuntime(miniProgram!)
  }

  async function assertCurrentBatch(marker: string) {
    await expect.poll(async () => {
      const page = await miniProgram!.currentPage()
      return {
        native: await miniProgram!.evaluate(() => {
          const pages = getCurrentPages()
          const current = pages[pages.length - 1]
          return current ? { route: current.route, marker: current.data.marker, count: current.data.count } : null
        }),
        template: await (await page.$('#batch'))?.text(),
        script: await (await page.$('#script'))?.text(),
        count: await (await page.$('#increment'))?.text(),
      }
    }, { timeout: 30_000 }).toMatchObject({
      native: { route: route.slice(1), marker, count: 0 },
      template: marker,
      script: marker,
      count: '0',
    })
  }

  beforeAll(async () => {
    project = await createNativeBatchProject(runtime)
    await installNativePublicationObserver(project)
    profilePath = path.join(project, '.tmp/hmr-profile.jsonl')
    source = await readNativeBatchSources(project)
    dev = startDevProcess(process.execPath, [NATIVE_BATCH_CLI, 'dev', '--non-interactive'], {
      cwd: project,
      env: {
        ...createDevProcessEnv(),
        WEAPP_VITE_HMR_PROFILE_JSON: profilePath,
        ...(stateful ? { WEAPP_VITE_STATEFUL_HMR_SNAPSHOT_TRACE: '1' } : {}),
      },
      ...(stateful ? { stdout: ['pipe', notification.stream] as const } : {}),
      all: true,
    })
    await dev.waitForInitialBuild()
    publication = createNativeHmrPublication(project, dev, runtime, ['config-json'], profilePath)
    miniProgram = await connect()
  }, 180_000)

  afterAll(async () => {
    notification.disarm()
    await lateScriptSave?.catch(() => {})
    await cleanupTemporaryRuntimeProject({
      project,
      disposeTransport,
      closeSession: async () => { await miniProgram?.close() },
      stopDev: async () => { await dev?.stop() },
    })
  }, 60_000)

  if (stateful) {
    it('persists a native script saved on the first actual sidecar notification', async (context) => {
      context.onTestFailed(async () => {
        try {
          process.stdout.write(dev?.getOutput() ?? '')
          process.stdout.write(`[native-batch-diagnostics] ${JSON.stringify({ runtime, files: await readNativeBatchDiagnostics(project) })}\n`)
        }
        catch {
          // 诊断失败不能替换原四文件与 runtime 断言。
        }
      })
      const step = NATIVE_BATCH_STEPS[1]
      const dom = createDomAcceptance(context, fixture, [
        { id: 'script-patch', route, action: '首次 JSON 前确认安全脚本补丁保留点击状态', nodes: [{ selector: '#batch', text: 'BATCH_BASE' }, { selector: '#script', text: 'BATCH_BASE' }, { selector: '#increment', text: '3' }] },
        {
          id: 'late-script-notification',
          route,
          action: '检查真实侧车通知后保存的脚本与同轮资产',
          nodes: [
            { selector: '#batch', text: step.marker, ...(resolveRuntimeProviderName() === 'devtools' ? { styles: { color: step.computed } } : {}) },
            { selector: '#script', text: step.marker },
            { selector: '#increment', text: '1' },
          ],
        },
      ])
      await waitInitialReady()
      await (await (await miniProgram!.currentPage()).$('#increment'))!.tap()
      const version = await readVersion()
      await saveScript(source.js.replace('this.data.count + 1', 'this.data.count + 2'))
      await expect.poll(readVersion, { timeout: 30_000 }).toBeGreaterThan(version)
      await (await (await miniProgram!.currentPage()).$('#increment'))!.tap()
      await dom.check('script-patch', miniProgram!, await miniProgram!.currentPage())
      const patchedVersion = await readVersion()
      await saveScript(source.js)
      await expect.poll(readVersion, { timeout: 30_000 }).toBeGreaterThan(patchedVersion)
      await miniProgram!.reLaunch(route)
      await waitInitialReady()
      expect(publication.stateful).toBe(true)

      const reload = await captureAppReloadMarker(miniProgram!)
      const pending = publication.capture(path.join(project, 'src/pages/index/index.js'))
      notification.arm()
      // 各文件只保存一次；脚本由真实 source-change 通知触发，不阻塞或延迟 watcher。
      for (const extension of ['json', 'wxss', 'wxml'] as const) {
        const file = path.join(project, `src/pages/index/index.${extension}`)
        await writeFile(`${file}.tmp`, source[extension].replaceAll('BATCH_BASE', step.marker).replace(/color: #[\da-f]+/i, `color: ${step.color}`))
        await renameAtomicFile(`${file}.tmp`, file)
      }
      await expect.poll(() => notification.triggered, { timeout: 30_000 }).toBe(true)
      await lateScriptSave
      await pending.wait()
      await expect.poll(() => readNativeBatchOutput(project, step.marker), { timeout: 30_000 }).toEqual({ js: true, wxml: true, wxss: true, json: true })
      await reconnect(reload)
      await assertCurrentBatch(step.marker)
      await (await (await miniProgram!.currentPage()).$('#increment'))!.tap()
      await dom.check('late-script-notification', miniProgram!, await miniProgram!.currentPage())
      await miniProgram!.reLaunch(route)

      // 恢复源码后仍由同一 classic owner 发布，不能重建旧 stateful client 或 transport。
      const restored = NATIVE_BATCH_STEPS[0]
      const restoreReload = await captureAppReloadMarker(miniProgram!)
      const restoration = publication.capture(path.join(project, 'src/pages/index/index.js'))
      await writeNativeBatch(project, source, restored, true)
      await restoration.wait()
      await expect.poll(() => readNativeBatchOutput(project, restored.marker), { timeout: 30_000 }).toEqual({ js: true, wxml: true, wxss: true, json: true })
      await reconnect(restoreReload)
      await assertCurrentBatch(restored.marker)
      await expect.poll(async () => (await (await miniProgram!.currentPage()).$('#batch'))?.text(), { timeout: 30_000 }).toBe(restored.marker)
      await expect.poll(async () => (await (await miniProgram!.currentPage()).$('#script'))?.text(), { timeout: 30_000 }).toBe(restored.marker)
      await miniProgram!.reLaunch(route)
      await publication.assertClassicRuntime(miniProgram!)
    }, 240_000)
  }

  it('renders matching script, template, style and config batches on repeated saves and restoration', async (context) => {
    context.onTestFailed(async () => {
      try {
        process.stdout.write(dev?.getOutput().slice(-16_000) ?? '')
        process.stdout.write(`[native-batch-diagnostics] ${JSON.stringify({ runtime, files: await readNativeBatchDiagnostics(project) })}\n`)
      }
      catch {
        // 诊断失败不能覆盖原始四文件交付断言。
      }
    })
    if (process.env.WEAPP_VITE_STATEFUL_HMR_SNAPSHOT_TRACE === '1') {
      context.onTestFinished(() => {
        process.stdout.write(dev?.getOutput() ?? '')
      })
    }
    const checkpoints = NATIVE_BATCH_STEPS.map((step, index) => ({
      id: `batch-${index}`,
      route,
      action: '检查同轮四文件批次、计算样式和点击状态',
      nodes: [
        { selector: '#batch', text: step.marker, ...(resolveRuntimeProviderName() === 'devtools' ? { styles: { color: step.computed } } : {}) },
        { selector: '#script', text: step.marker },
        { selector: '#increment', text: '1' },
      ],
    }))
    if (stateful) {
      checkpoints.push({ id: 'classic-script', route, action: '确认降级后的脚本保存自动重载并重置点击状态', nodes: [{ selector: '#batch', text: 'BATCH_BASE' }, { selector: '#script', text: 'BATCH_BASE' }, { selector: '#increment', text: '2' }] })
    }
    const dom = createDomAcceptance(context, fixture, checkpoints)
    await miniProgram!.reLaunch(route)
    if (publication.stateful) {
      await waitInitialReady()
    }
    for (const [index, step] of NATIVE_BATCH_STEPS.entries()) {
      if (index) {
        const reload = await captureAppReloadMarker(miniProgram!)
        const pending = publication.capture(path.join(project, `src/pages/index/index.${index % 2 === 0 ? 'js' : 'json'}`))
        await writeNativeBatch(project, source, step, index % 2 === 0)
        await pending.wait()
        await expect.poll(() => readNativeBatchOutput(project, step.marker), { timeout: 30_000 }).toEqual({ js: true, wxml: true, wxss: true, json: true })
        await reconnect(reload)
        await assertCurrentBatch(step.marker)
      }
      await expect.poll(async () => (await (await miniProgram!.currentPage()).$('#batch'))?.text(), { timeout: 30_000 }).toBe(step.marker)
      await (await (await miniProgram!.currentPage()).$('#increment'))!.tap()
      await dom.check(`batch-${index}`, miniProgram!, await miniProgram!.currentPage())
      if (index) {
        await miniProgram!.reLaunch(route)
      }
    }
    if (stateful) {
      const reload = await captureAppReloadMarker(miniProgram!)
      const pending = publication.capture(path.join(project, 'src/pages/index/index.js'))
      await saveScript(source.js.replace('this.data.count + 1', 'this.data.count + 2'))
      await pending.wait()
      await expect.poll(() => readNativeBatchOutput(project, 'BATCH_BASE'), { timeout: 30_000 }).toEqual({ js: true, wxml: true, wxss: true, json: true })
      await reconnect(reload)
      await assertCurrentBatch('BATCH_BASE')
      await (await (await miniProgram!.currentPage()).$('#increment'))!.tap()
      await dom.check('classic-script', miniProgram!, await miniProgram!.currentPage())
    }
    await publication.assertClassicRuntime(miniProgram!)
  }, 240_000)
})
