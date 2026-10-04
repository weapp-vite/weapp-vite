import type { DomCheckpoint, DomElement, DomPage, DomSession } from '../../e2e/utils/domAcceptance/types'
import type { ConsumerRuntimeObservation } from './consumerRuntime'
import assert from 'node:assert/strict'
import { mkdir, readFile, realpath, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { captureDomCheckpoint } from '../../e2e/utils/domAcceptance/checkpoint'
import { readConsumerCounter } from './consumerRuntime'

interface ConsumerDevtoolsPage extends DomPage {
  $$: (selector: string, options: { fallback: false, timeout: number }) => Promise<Array<DomElement & { tap: () => Promise<void> }>>
}

interface ConsumerDevtoolsHost extends DomSession {
  reLaunch: (route: string) => Promise<ConsumerDevtoolsPage>
  toolInfo: () => Promise<{ version?: string, SDKVersion?: string }>
  flushConsole: () => Promise<void>
  disconnect: () => void | Promise<void>
}

export class ConsumerDevtoolsRuntimeError extends Error {
  constructor(readonly phase: string, readonly category: 'environment' | 'runtime', cause: unknown) {
    super(`Published consumer DevTools ${phase} failed: ${cause instanceof Error ? cause.message : String(cause)}`, { cause })
    this.name = 'ConsumerDevtoolsRuntimeError'
  }
}

async function prepareProject(root: string) {
  const publicConfig = JSON.parse(await readFile(path.join(root, 'project.config.json'), 'utf8')) as Record<string, unknown>
  const filename = path.join(root, 'project.private.config.json')
  const original = await readFile(filename, 'utf8').catch((error: NodeJS.ErrnoException) => {
    if (error.code !== 'ENOENT') {
      throw error
    }
    return undefined
  })
  const privateConfig = original === undefined ? {} : JSON.parse(original) as Record<string, unknown>
  const config = { ...publicConfig, ...privateConfig }
  assert.match(String(config.appid), /^wx[\da-f]{16}$/i, 'DevTools consumer requires a real WeChat AppID')
  assert.equal(await realpath(path.resolve(root, String(config.miniprogramRoot ?? ''))), await realpath(path.join(root, 'dist')), 'DevTools must read the exact consumer dist directory')
  const condition = privateConfig.condition as Record<string, unknown> | undefined
  // 临时消费者只留下当前实际生成的页面条件，避免历史 benchmark 路由启动旧页面。
  await writeFile(filename, `${JSON.stringify({
    ...privateConfig,
    condition: { ...condition, miniprogram: { current: 0, list: [{ id: 0, name: 'published consumer', pathName: 'pages/index/index', query: '', scene: null }] } },
  }, null, 2)}\n`)
  return async () => {
    if (original === undefined) {
      await rm(filename)
    }
    else {
      await writeFile(filename, original)
    }
  }
}

async function readDiagnostics(filename: string, requireEvents: boolean) {
  const counts: Record<string, number> = {}
  const failures: string[] = []
  const lines = (await readFile(filename, 'utf8')).split(/\r?\n/).filter(Boolean)
  assert.ok(!requireEvents || lines.length > 0, 'DevTools runtime diagnostic journal is empty')
  for (const line of lines) {
    const event = JSON.parse(line) as { source?: string, kind?: string, level?: string, text?: string, error?: number, exception?: number }
    if (event.source === 'runtime' && event.kind === 'stats') {
      assert.ok(!event.error && !event.exception, 'Published consumer runtime diagnostic summary reports errors')
    }
    if (event.source !== 'runtime' || event.kind !== 'message' || !event.level) {
      continue
    }
    counts[event.level] = (counts[event.level] ?? 0) + 1
    if (event.level === 'error' || event.level === 'exception') {
      failures.push(event.text ?? event.level)
    }
  }
  assert.equal(failures.length, 0, `Published consumer runtime reported errors:\n${failures.join('\n')}`)
  return counts
}

/** 每个互斥产物场景重新连接同一消费者；仅释放自己的连接，宿主窗口由验收执行者管理。 */
export async function verifyConsumerDevtoolsRuntime(root: string, scenario: 'minimal' | 'typical'): Promise<ConsumerRuntimeObservation> {
  const cliPath = process.env.WEAPP_VITE_E2E_DEVTOOLS_CLI_PATH?.trim()
  if (!cliPath) {
    throw new ConsumerDevtoolsRuntimeError('preflight', 'environment', new Error('Set WEAPP_VITE_E2E_DEVTOOLS_CLI_PATH to the verified official Stable CLI.'))
  }
  const journal = path.join(root, 'runtime-attribution-evidence', `${scenario}-devtools-events.jsonl`)
  await mkdir(path.dirname(journal), { recursive: true })
  await writeFile(journal, '')
  const environment = {
    WEAPP_VITE_E2E_RUNTIME_PROVIDER: 'devtools',
    WEAPP_VITE_E2E_REPORT_EVENT_LOG_FILE: journal,
    WEAPP_VITE_E2E_IDE_WARNING_REPORT_SLUG: `consumer-${scenario}`,
    WEAPP_VITE_E2E_IDE_WARNING_REPORT_DIR: path.dirname(journal),
    WEAPP_VITE_E2E_IDE_WARNING_REPORT_MD_FILE: path.join(path.dirname(journal), `${scenario}-devtools.md`),
    WEAPP_VITE_E2E_IDE_WARNING_REPORT_JSON_FILE: path.join(path.dirname(journal), `${scenario}-devtools.json`),
    WEAPP_VITE_E2E_AUTOMATOR_PREBUILD: '0',
    WEAPP_VITE_E2E_AUTOMATOR_BRIDGE_PREBUILD: '0',
    WEAPP_VITE_E2E_AUTOMATOR_SKIP_WARMUP: undefined,
    WEAPP_VITE_E2E_SKIP_DEVTOOLS_LOGIN_CHECK: undefined,
  }
  const previous = new Map(Object.keys(environment).map(key => [key, process.env[key]]))
  for (const [key, value] of Object.entries(environment)) {
    if (value === undefined) {
      delete process.env[key]
    }
    else {
      process.env[key] = value
    }
  }
  let host: ConsumerDevtoolsHost | undefined
  let restoreProject: (() => Promise<void>) | undefined
  let phase = 'preflight'
  let observation: Omit<ConsumerRuntimeObservation, 'diagnosticCounts' | 'closed'> | undefined
  const failures: unknown[] = []
  try {
    // provider 环境先设置，再加载会读取启动配置的现有 launcher。
    const { assertDevtoolsLoggedIn, launchAutomator, isDevtoolsHttpPortError, isDevtoolsLoginRequiredError, isDevtoolsSimulatorBootError } = await import('../../e2e/utils/automator')
    try {
      restoreProject = await prepareProject(root)
      await assertDevtoolsLoggedIn(root)
      phase = 'launch'
      const route = '/pages/index/index'
      const selector = scenario === 'minimal' ? 'view' : 'button'
      host = await launchAutomator({
        projectPath: root,
        cliPath,
        bridgeProjectMode: 'direct',
        launchMode: 'bridge',
        trustProject: true,
        skipWarmup: false,
        refreshProjectAfterConnect: true,
        maxLaunchRetries: 1,
        disableRelaunchSessionRecovery: true,
        warmupRoute: route,
        warmupRootSelectors: [selector],
      }) as ConsumerDevtoolsHost
      phase = 'observe'
      const info = await host.toolInfo()
      assert.ok(info.version?.trim() && info.SDKVersion?.trim(), 'DevTools must report actual IDE and base library versions')
      const page = await host.reLaunch(route)
      const domEvidence: NonNullable<ConsumerRuntimeObservation['domEvidence']> = []
      const check = async (id: string, text: string) => {
        await host!.flushConsole()
        const checkpoint: DomCheckpoint = { id, route, action: id, nodes: [{ selector, text }] }
        const evidence = await captureDomCheckpoint(host!, page, checkpoint, 'devtools')
        domEvidence.push(evidence)
        return evidence.nodes[0]!.nodes[0]!.text!
      }
      const text = await check('initial', scenario === 'minimal' ? 'minimal published consumer' : '1 / 2')
      const initial = scenario === 'minimal' ? { text } : readConsumerCounter(text)
      let afterTap: ConsumerRuntimeObservation['afterTap']
      if (scenario === 'typical') {
        const buttons = await page.$$('button', { fallback: false, timeout: 15_000 })
        assert.equal(buttons.length, 1)
        await buttons[0]!.tap()
        afterTap = readConsumerCounter(await check('after-tap', '2 / 4'))
      }
      const finalInfo = await host.toolInfo()
      assert.deepEqual({ version: finalInfo.version, SDKVersion: finalInfo.SDKVersion }, { version: info.version, SDKVersion: info.SDKVersion }, 'DevTools host versions changed during acceptance')
      observation = { scenario, provider: 'devtools', route, initial, ...(afterTap ? { afterTap } : {}), host: { ideVersion: info.version!, baseLibraryVersion: info.SDKVersion! }, domEvidence, cleanup: 'owned-connection-disconnected' }
    }
    catch (error) {
      const category = isDevtoolsHttpPortError(error) || isDevtoolsLoginRequiredError(error) || isDevtoolsSimulatorBootError(error) ? 'environment' : 'runtime'
      throw new ConsumerDevtoolsRuntimeError(phase, category, error)
    }
  }
  catch (error) {
    failures.push(error)
  }
  finally {
    if (host) {
      try {
        await host.flushConsole()
      }
      catch (error) {
        failures.push(error)
      }
      try {
        await host.disconnect()
      }
      catch (error) {
        failures.push(error)
      }
    }
    try {
      await restoreProject?.()
    }
    catch (error) {
      failures.push(error)
    }
    for (const [key, value] of previous) {
      if (value === undefined) {
        delete process.env[key]
      }
      else {
        process.env[key] = value
      }
    }
  }
  let diagnosticCounts: Record<string, number> = {}
  try {
    diagnosticCounts = await readDiagnostics(journal, observation !== undefined)
  }
  catch (error) {
    failures.push(error)
  }
  if (failures.length === 1) {
    throw failures[0]
  }
  if (failures.length > 1) {
    throw new AggregateError(failures, 'Published consumer runtime verification or cleanup failed')
  }
  assert.ok(observation)
  return { ...observation, diagnosticCounts, closed: true }
}
