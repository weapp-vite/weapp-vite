import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { launchAutomator, reconnectAutomator } from '../utils/automator'
import { startDevProcess } from '../utils/dev-process'
import { createDevProcessEnv } from '../utils/dev-process-env'
import { createDomAcceptance } from '../utils/domAcceptance'
import { renameAtomicFile } from '../utils/hmrAtomicRename'
import { createNativeBatchProject, NATIVE_BATCH_CLI, NATIVE_BATCH_STEPS, readNativeBatchOutput, readNativeBatchSources, writeNativeBatch } from '../utils/nativeBatchProject'
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
  const stateful = runtime === 'stateful-experimental'

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
    dev = startDevProcess(process.execPath, [NATIVE_BATCH_CLI, 'dev', '--non-interactive'], {
      cwd: project,
      env: createDevProcessEnv(),
      all: true,
    })
    await dev.waitForInitialBuild()
    miniProgram = await connect()
  }, 180_000)

  afterAll(async () => {
    await cleanupTemporaryRuntimeProject({
      project,
      disposeTransport,
      closeSession: async () => { await miniProgram?.close() },
      stopDev: async () => { await dev?.stop() },
    })
  }, 60_000)

  it('renders matching script, template, style and config batches on repeated saves and restoration', async (context) => {
    context.onTestFailed(() => {
      process.stdout.write(dev?.getOutput().slice(-16_000) ?? '')
    })
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
        await writeNativeBatch(project, source, step, index % 2 === 0)
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
