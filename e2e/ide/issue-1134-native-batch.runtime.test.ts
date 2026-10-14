import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { PassThrough } from 'node:stream'
import { pathToFileURL } from 'node:url'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { launchAutomator, reconnectAutomator } from '../utils/automator'
import { startDevProcess } from '../utils/dev-process'
import { createDevProcessEnv } from '../utils/dev-process-env'
import { createDevBuildCompletion } from '../utils/devBuildCompletion'
import { createDomAcceptance } from '../utils/domAcceptance'
import { renameAtomicFile } from '../utils/hmrAtomicRename'
import { createNativeBatchProject, NATIVE_BATCH_CLI, NATIVE_BATCH_EXTENSIONS, NATIVE_BATCH_STEPS, readNativeBatchDiagnostics, readNativeBatchOutput, readNativeBatchSources, writeNativeBatch } from '../utils/nativeBatchProject'
import { NATIVE_BATCH_SETTLEMENT_PREFIX } from '../utils/nativeBatchSettlementPlugin'
import { createNativeBatchSourceNotification } from '../utils/nativeBatchSourceNotification'
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
  const stateful = runtime === 'stateful-experimental'
  const settlementInput = stateful ? new PassThrough() : undefined
  const notification = createNativeBatchSourceNotification(() => {
    const file = path.join(project, 'src/pages/index/index.js')
    lateScriptSave = (async () => {
      await writeFile(`${file}.tmp`, source.js.replaceAll('BATCH_BASE', 'BATCH_FIRST'))
      await renameAtomicFile(`${file}.tmp`, file)
    })()
    // 原断言会读取该失败；流回调不能提前产生未处理的 rejection。
    void lateScriptSave.catch(() => {})
  })

  function capturePublication() {
    return createDevBuildCompletion(dev!, settlementInput
      ? {
          snapshot: {
            files: NATIVE_BATCH_EXTENSIONS.map(extension => path.join(project, `src/pages/index/index.${extension}`)),
            profilePath: path.join(project, '.weapp-vite/hmr-profile.jsonl'),
            requestSettlement: (id) => {
              settlementInput.write(`${NATIVE_BATCH_SETTLEMENT_PREFIX}${JSON.stringify({ id })}\n`)
            },
          },
        }
      : { completed: '小程序已重新构建' })
  }

  async function connect() {
    return await launchAutomator({
      projectPath: project,
      bridgeProjectMode: 'direct',
      warmupRoute: route,
      warmupRootSelectors: ['#batch'],
      configureHeadlessSession: stateful
        ? (session) => { disposeTransport = installStatefulHmrTransport(session, path.join(project, 'dist')) }
        : undefined,
    })
  }

  beforeAll(async () => {
    project = await createNativeBatchProject(runtime)
    source = await readNativeBatchSources(project)
    if (stateful) {
      const config = path.join(project, 'weapp-vite.config.ts')
      const plugin = pathToFileURL(path.resolve(import.meta.dirname, '../utils/nativeBatchSettlementPlugin.ts')).href
      await writeFile(config, `import { nativeBatchSettlementPlugin } from ${JSON.stringify(plugin)}\n${(await readFile(config, 'utf8')).replace('defineConfig({', 'defineConfig({\n  plugins: [nativeBatchSettlementPlugin()],')}`)
    }
    dev = startDevProcess(process.execPath, [NATIVE_BATCH_CLI, 'dev', '--non-interactive'], {
      cwd: project,
      env: {
        ...createDevProcessEnv(),
        ...(stateful
          ? {
              WEAPP_VITE_STATEFUL_HMR_SNAPSHOT_TRACE: '1',
              WEAPP_VITE_HMR_PROFILE_JSON: path.join(project, '.weapp-vite/hmr-profile.jsonl'),
            }
          : {}),
      },
      ...(stateful ? { stdout: ['pipe', notification.stream] as const } : {}),
      ...(settlementInput ? { input: settlementInput } : {}),
      all: true,
    })
    await dev.waitForInitialBuild()
    miniProgram = await connect()
  }, 180_000)

  afterAll(async () => {
    notification.disarm()
    await lateScriptSave?.catch(() => {})
    await cleanupTemporaryRuntimeProject({
      project,
      disposeTransport,
      closeSession: async () => { await miniProgram?.close() },
      stopDev: async () => {
        settlementInput?.end()
        await dev?.stop()
      },
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
      const dom = createDomAcceptance(context, fixture, [{
        id: 'late-script-notification',
        route,
        action: '检查真实侧车通知后保存的脚本与同轮资产',
        nodes: [
          { selector: '#batch', text: step.marker, ...(resolveRuntimeProviderName() === 'devtools' ? { styles: { color: step.computed } } : {}) },
          { selector: '#script', text: step.marker },
          { selector: '#increment', text: '1' },
        ],
      }])
      await expect.poll(() => miniProgram!.evaluate(() => (globalThis as any).__WEAPP_VITE_STATEFUL_HMR_CLIENT__.getTransportState().initialReady), { timeout: 30_000 }).toBe(true)
      const controlFile = path.join(project, 'dist/__weapp_vite_hmr/control.js')
      const previousControl = await readFile(controlFile, 'utf8')
      const publication = capturePublication()
      notification.arm()
      // 各文件只保存一次；脚本在父进程收到真实通知后保存，不阻塞监听或改变轮询参数。
      for (const extension of ['json', 'wxss', 'wxml'] as const) {
        const file = path.join(project, `src/pages/index/index.${extension}`)
        await writeFile(`${file}.tmp`, source[extension].replaceAll('BATCH_BASE', step.marker).replace(/color: #[\da-f]+/i, `color: ${step.color}`))
        await renameAtomicFile(`${file}.tmp`, file)
      }
      await expect.poll(() => notification.triggered, { timeout: 30_000 }).toBe(true)
      await lateScriptSave
      await publication.wait()
      await expect.poll(() => readNativeBatchOutput(project, step.marker), { timeout: 30_000 }).toEqual({ js: true, wxml: true, wxss: true, json: true })
      await expect.poll(() => readFile(controlFile, 'utf8'), { timeout: 30_000 }).not.toBe(previousControl)
      disposeTransport?.()
      if (resolveRuntimeProviderName() === 'headless') {
        await miniProgram!.close()
        miniProgram = await connect()
      }
      else {
        miniProgram = await reconnectAutomator(miniProgram!)
      }
      await miniProgram.reLaunch(route)
      await expect.poll(() => miniProgram!.evaluate(() => (globalThis as any).__WEAPP_VITE_STATEFUL_HMR_CLIENT__.getTransportState().initialReady), { timeout: 30_000 }).toBe(true)
      await (await (await miniProgram.currentPage()).$('#increment'))!.tap()
      await dom.check('late-script-notification', miniProgram, await miniProgram.currentPage())
      // 完整恢复同一会话的初始输入与发布基线，再运行原重复保存断言。
      const restored = NATIVE_BATCH_STEPS[0]
      const controlBeforeRestore = await readFile(controlFile, 'utf8')
      const restoration = capturePublication()
      await writeNativeBatch(project, source, restored, true)
      await restoration.wait()
      await expect.poll(() => readNativeBatchOutput(project, restored.marker), { timeout: 30_000 }).toEqual({ js: true, wxml: true, wxss: true, json: true })
      await expect.poll(() => readFile(controlFile, 'utf8'), { timeout: 30_000 }).not.toBe(controlBeforeRestore)
      disposeTransport?.()
      if (resolveRuntimeProviderName() === 'headless') {
        await miniProgram.close()
        miniProgram = await connect()
      }
      else {
        miniProgram = await reconnectAutomator(miniProgram)
      }
      await miniProgram.reLaunch(route)
      await expect.poll(() => miniProgram!.evaluate(() => (globalThis as any).__WEAPP_VITE_STATEFUL_HMR_CLIENT__.getTransportState().initialReady), { timeout: 30_000 }).toBe(true)
      await expect.poll(async () => (await (await miniProgram!.currentPage()).$('#batch'))?.text(), { timeout: 30_000 }).toBe(restored.marker)
      await expect.poll(async () => (await (await miniProgram!.currentPage()).$('#script'))?.text(), { timeout: 30_000 }).toBe(restored.marker)
      expect(dev!.getOutput()).not.toMatch(/Build failed|delivery failed|patch transform failed/)
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
      checkpoints.push({ id: 'script-patch', route, action: '确认脚本补丁保留点击状态', nodes: [{ selector: '#batch', text: 'BATCH_BASE' }, { selector: '#script', text: 'BATCH_BASE' }, { selector: '#increment', text: '3' }] })
    }
    const dom = createDomAcceptance(context, fixture, checkpoints)
    await miniProgram!.reLaunch(route)
    if (stateful) {
      await expect.poll(() => miniProgram!.evaluate(() => (globalThis as any).__WEAPP_VITE_STATEFUL_HMR_CLIENT__.getTransportState().initialReady), { timeout: 30_000 }).toBe(true)
    }
    for (const [index, step] of NATIVE_BATCH_STEPS.entries()) {
      if (index) {
        const controlFile = path.join(project, 'dist/__weapp_vite_hmr/control.js')
        const previousControl = stateful ? await readFile(controlFile, 'utf8') : undefined
        const publication = capturePublication()
        await writeNativeBatch(project, source, step, index % 2 === 0)
        await publication.wait()
        await expect.poll(() => readNativeBatchOutput(project, step.marker), { timeout: 30_000 }).toEqual({ js: true, wxml: true, wxss: true, json: true })
        if (stateful) {
          // 混合原生 JS 与 sidecar 按现有契约完整重载，必须交付新的构建身份。
          await expect.poll(() => readFile(controlFile, 'utf8'), { timeout: 30_000 }).not.toBe(previousControl)
        }
        // 完整构建替换 VM；headless 没有 IDE 编译重启能力，须关闭旧 VM 后读取新产物。
        // DevTools 只断开并重连本项目 bridge，不关闭或重新启动共享 IDE 宿主。
        disposeTransport?.()
        if (resolveRuntimeProviderName() === 'headless') {
          await miniProgram!.close()
          miniProgram = await connect()
        }
        else {
          miniProgram = await reconnectAutomator(miniProgram!)
        }
        await miniProgram.reLaunch(route)
        if (stateful) {
          await expect.poll(() => miniProgram!.evaluate(() => (globalThis as any).__WEAPP_VITE_STATEFUL_HMR_CLIENT__.getTransportState().initialReady), { timeout: 30_000 }).toBe(true)
        }
      }
      await expect.poll(async () => (await (await miniProgram!.currentPage()).$('#batch'))?.text(), { timeout: 30_000 }).toBe(step.marker)
      await (await (await miniProgram!.currentPage()).$('#increment'))!.tap()
      await dom.check(`batch-${index}`, miniProgram!, await miniProgram!.currentPage())
    }
    if (stateful) {
      const version = await miniProgram!.evaluate(() => (globalThis as any).__WEAPP_VITE_STATEFUL_HMR_CLIENT__.getVersion())
      const file = path.join(project, 'src/pages/index/index.js')
      await writeFile(`${file}.tmp`, source.js.replace('this.data.count + 1', 'this.data.count + 2'))
      await renameAtomicFile(`${file}.tmp`, file)
      await expect.poll(() => miniProgram!.evaluate(() => (globalThis as any).__WEAPP_VITE_STATEFUL_HMR_CLIENT__.getVersion()), { timeout: 30_000 }).toBeGreaterThan(version)
      await (await (await miniProgram!.currentPage()).$('#increment'))!.tap()
      await dom.check('script-patch', miniProgram!, await miniProgram!.currentPage())
    }
    expect(dev!.getOutput()).not.toMatch(/Build failed|delivery failed|patch transform failed/)
  }, 240_000)
})
