import type { RuntimeErrorCollector } from './runtimeErrors'
import { Buffer } from 'node:buffer'
import fs from 'node:fs/promises'
import os from 'node:os'
import process from 'node:process'
import path from 'pathe'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  connectOpenedAutomator,
  resolveProjectAutomatorPort,
} from 'weapp-ide-cli'
import {
  cleanupTrackedDevProcesses,
  startDevProcess,
} from '../utils/dev-process'
import { createDevProcessEnv } from '../utils/dev-process-env'
import { cleanupResidualIdeProcesses } from '../utils/ide-devtools-cleanup'
import { attachRuntimeErrorCollector } from './runtimeErrors'

const WORKSPACE_ROOT = path.resolve(import.meta.dirname, '../..')
const APP_ROOT = path.resolve(WORKSPACE_ROOT, 'apps/layout-power-demo')
const CLI_PATH = path.join(APP_ROOT, 'node_modules/weapp-vite/bin/weapp-vite.js')
const INDEX_ROUTE = '/pages/index/index'
const BASELINE_MARKER = 'runtime-vendor-hmr-baseline'
const TD_MESSAGE_DUPLICATE_SLOT_RE = /More than one slot named .*tdesign-miniprogram\/message\/message/
const LAYOUTS = ['default', 'command', 'studio', 'split', 'poster'] as const
const CONNECTION_CLOSED_RE = /Connection closed|WebSocket is not open|other side closed|not connected/i
const PROTOCOL_TIMEOUT_RE = /DEVTOOLS_PROTOCOL_TIMEOUT|DevTools did not respond to protocol method App\.(?:callFunction|getCurrentPage|getPageStack)|Operation timed out after/i

function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function resolveAutomatorSessionFile(projectPath: string, port?: number) {
  const normalizedProjectPath = path.resolve(projectPath)
  const sessionKey = port ? `${normalizedProjectPath}#port-${port}` : normalizedProjectPath
  const encodedProjectPath = Buffer.from(sessionKey).toString('base64url')
  return path.join(os.tmpdir(), 'weapp-vite-automator-sessions', `${encodedProjectPath}.json`)
}

async function removeAutomatorSessionFiles() {
  await Promise.all([
    fs.rm(resolveAutomatorSessionFile(APP_ROOT), { force: true }).catch(() => {}),
    fs.rm(resolveAutomatorSessionFile(APP_ROOT, resolveProjectAutomatorPort(APP_ROOT)), { force: true }).catch(() => {}),
  ])
}

async function waitForOpenedAutomator(projectPath: string, timeoutMs = 120_000) {
  const start = Date.now()
  let lastError: unknown
  const port = resolveProjectAutomatorPort(projectPath)

  while (Date.now() - start <= timeoutMs) {
    try {
      return await connectOpenedAutomator({
        projectPath,
        port,
        timeout: 30_000,
      })
    }
    catch (error) {
      lastError = error
    }
    await delay(1_000)
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError))
}

async function relaunchIndexPage(miniProgram: any) {
  const page = await miniProgram.reLaunch(INDEX_ROUTE)
  if (page) {
    return page
  }
  return await miniProgram.currentPage()
}

async function waitForLayoutPowerDom(page: any, timeoutMs = 15_000) {
  const startedAt = Date.now()
  let lastResult: Record<string, any> | null = null

  while (Date.now() - startedAt <= timeoutMs) {
    try {
      const [roots, triggers, switches] = await Promise.all([
        page.renderedNodes('#layout-power-index-page', { timeout: 3_000 }),
        page.renderedNodes('.feedback-trigger', { timeout: 3_000 }),
        page.renderedNodes('.switch', { timeout: 3_000 }),
      ])
      const root = roots?.[0]
      const result = {
        ok: root?.dataset?.e2ePage === 'layout-power-index'
          && Number(root?.width ?? 0) > 0
          && Number(root?.height ?? 0) > 0
          && triggers.length >= 2
          && switches.length >= LAYOUTS.length,
        dataset: root?.dataset ?? {},
        height: root?.height,
        triggerCount: triggers.length,
        switchCount: switches.length,
        width: root?.width,
      }
      lastResult = result
      if (result.ok) {
        return result
      }
    }
    catch (error) {
      lastResult = {
        ok: false,
        reason: error instanceof Error ? error.message : String(error),
      }
    }
    await delay(220)
  }

  throw new Error(`Timed out waiting layout-power DOM: ${JSON.stringify(lastResult, null, 2)}`)
}

async function waitForRunE2EMarker(page: any, marker: string, timeoutMs = 30_000) {
  const startedAt = Date.now()
  let lastResult: unknown

  while (Date.now() - startedAt <= timeoutMs) {
    try {
      lastResult = await page.callMethod('runE2E')
      if ((lastResult as any)?.ok === true && (lastResult as any)?.marker === marker) {
        return lastResult
      }
    }
    catch {}
    await page.waitFor?.(250).catch(() => delay(250))
  }

  throw new Error(`Timed out waiting runE2E marker ${marker}; lastResult=${JSON.stringify(lastResult)}`)
}

function isRecoverableRuntimeSessionError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error)
  return CONNECTION_CLOSED_RE.test(message)
    || PROTOCOL_TIMEOUT_RE.test(message)
    || (error instanceof Error
      && 'code' in error
      && error.code === 'DEVTOOLS_PROTOCOL_TIMEOUT')
}

async function expectRepeatedMessageTap(page: any, collector: RuntimeErrorCollector) {
  const marker = collector.mark()
  let completedRepeats = 0

  for (let repeat = 0; repeat < 5; repeat += 1) {
    process.stdout.write(`[layout-power-demo:message] tap-repeat=${repeat + 1}\n`)
    let result: any
    try {
      result = await page.callMethod('runLayoutFeedbackE2E')
    }
    catch (error) {
      if (completedRepeats > 0 && isRecoverableRuntimeSessionError(error)) {
        process.stdout.write(`[layout-power-demo:message] page-method-capability-limited completed=${completedRepeats} reason=${error instanceof Error ? error.message : String(error)}\n`)
        break
      }
      throw error
    }
    expect(result?.ok).toBe(true)
    for (const layout of LAYOUTS) {
      expect(result?.results).toEqual(expect.arrayContaining([
        expect.objectContaining({
          feedback: 'message',
          layout,
          ok: true,
        }),
      ]))
    }
    completedRepeats += 1
    await page.waitFor?.(80).catch(() => delay(80))
  }

  expect(completedRepeats).toBeGreaterThanOrEqual(1)
  await page.waitFor?.(2_500).catch(() => delay(2_500))
  expect(collector.getSince(marker)).toEqual([])
  expect(collector.getLogsSince(marker)).not.toEqual(
    expect.arrayContaining([
      expect.stringMatching(TD_MESSAGE_DUPLICATE_SLOT_RE),
    ]),
  )
}

describe.sequential('layout-power-demo message feedback in real WeChat DevTools', () => {
  let miniProgram: any
  let runtimeErrorCollector: RuntimeErrorCollector | undefined
  let devProcess: ReturnType<typeof startDevProcess> | undefined

  beforeAll(async () => {
    await removeAutomatorSessionFiles()
    await cleanupResidualIdeProcesses()
  }, 60_000)

  afterAll(async () => {
    await Promise.resolve(miniProgram?.disconnect?.()).catch(() => {})
    await Promise.resolve(miniProgram?.close?.()).catch(() => {})
    runtimeErrorCollector?.dispose()
    runtimeErrorCollector = undefined
    miniProgram = undefined
    await devProcess?.stop().catch(() => {})
    await cleanupTrackedDevProcesses()
  }, 60_000)

  async function closeRuntimeSession() {
    runtimeErrorCollector?.dispose()
    runtimeErrorCollector = undefined
    await Promise.resolve(miniProgram?.disconnect?.()).catch(() => {})
    await Promise.resolve(miniProgram?.close?.()).catch(() => {})
    miniProgram = undefined
  }

  async function stopDevSession() {
    await closeRuntimeSession()
    await devProcess?.stop().catch(() => {})
    devProcess = undefined
    await cleanupTrackedDevProcesses()
    await removeAutomatorSessionFiles()
    await cleanupResidualIdeProcesses()
  }

  async function startRuntimeSession() {
    devProcess = startDevProcess(process.execPath, [CLI_PATH, 'dev', '-o', '--non-interactive', '--login-retry', 'never'], {
      cwd: APP_ROOT,
      all: true,
      env: createDevProcessEnv(),
      reject: false,
    })
    miniProgram = await devProcess.waitFor(
      waitForOpenedAutomator(APP_ROOT, 180_000),
      'layout-power-demo opened automator',
    )
    runtimeErrorCollector = attachRuntimeErrorCollector(miniProgram)
  }

  async function runMessageTapScenario() {
    const page = await relaunchIndexPage(miniProgram)
    await waitForLayoutPowerDom(page)
    await waitForRunE2EMarker(page, BASELINE_MARKER)
    if (!runtimeErrorCollector) {
      throw new Error('Runtime error collector is not initialized')
    }
    await expectRepeatedMessageTap(page, runtimeErrorCollector)
  }

  it('keeps repeated message taps stable after layout switches', async () => {
    let lastError: unknown
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        await startRuntimeSession()
        await runMessageTapScenario()
        return
      }
      catch (error) {
        lastError = error
        await stopDevSession()
        if (!isRecoverableRuntimeSessionError(error) || attempt === 3) {
          throw error
        }
        process.stdout.write(`[layout-power-demo:message] restart-devtools-session attempt=${attempt} reason=${error instanceof Error ? error.message : String(error)}\n`)
        await delay(5_000)
      }
    }
    throw lastError instanceof Error ? lastError : new Error(String(lastError))
  }, 240_000)
})
