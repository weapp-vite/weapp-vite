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

async function waitForCurrentLayout(page: any, layout: string, timeoutMs = 8_000) {
  const startedAt = Date.now()
  let latest: unknown

  while (Date.now() - startedAt <= timeoutMs) {
    latest = await page.data('currentLayout').catch(() => undefined)
    if (latest === layout) {
      return latest
    }
    await page.waitFor?.(120).catch(() => delay(120))
  }

  throw new Error(`Timed out waiting currentLayout=${layout}; latest=${String(latest)}`)
}

async function tapRequired(page: any, selector: string) {
  const element = await page.$(selector)
  if (!element) {
    throw new Error(`Failed to query element: ${selector}`)
  }
  await element.tap()
}

async function expectRepeatedMessageTap(page: any, collector: RuntimeErrorCollector) {
  const marker = collector.mark()

  for (const layout of LAYOUTS) {
    if (layout !== 'default') {
      await tapRequired(page, `[data-e2e-layout="${layout}"]`)
      await waitForCurrentLayout(page, layout)
    }
    for (let index = 0; index < 5; index += 1) {
      await tapRequired(page, '[data-e2e-feedback="message"]')
      await page.waitFor?.(80).catch(() => delay(80))
    }
  }

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

  it('keeps repeated message taps stable after layout switches', async () => {
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

    const page = await relaunchIndexPage(miniProgram)
    await waitForRunE2EMarker(page, BASELINE_MARKER)
    await expectRepeatedMessageTap(page, runtimeErrorCollector)
  }, 240_000)
})
