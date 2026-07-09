import type { RuntimeErrorCollector } from './runtimeErrors'
import { Buffer } from 'node:buffer'
import fs from 'node:fs/promises'
import os from 'node:os'
import process from 'node:process'
import path from 'pathe'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { resolveProjectAutomatorPort } from 'weapp-ide-cli'
import {
  cleanupTrackedDevProcesses,
  startDevProcess,
} from '../utils/dev-process'
import { createDevProcessEnv } from '../utils/dev-process-env'
import { replaceFileByRename, waitForFileContains } from '../utils/hmr-helpers'
import { cleanupResidualIdeProcesses } from '../utils/ide-devtools-cleanup'
import { waitForOpenedAutomator } from '../utils/opened-automator'
import { attachRuntimeErrorCollector } from './runtimeErrors'

const WORKSPACE_ROOT = path.resolve(import.meta.dirname, '../..')
const APP_ROOT = path.resolve(WORKSPACE_ROOT, 'apps/layout-power-demo')
const CLI_PATH = path.join(APP_ROOT, 'node_modules/weapp-vite/bin/weapp-vite.js')
const PAGE_SCRIPT = path.join(APP_ROOT, 'src/pages/index/index.ts')
const PAGE_WXML = path.join(APP_ROOT, 'src/pages/index/index.wxml')
const COMMAND_LAYOUT_WXSS = path.join(APP_ROOT, 'src/layouts/command/index.wxss')
const PAGE_JS_DIST = path.join(APP_ROOT, 'dist/pages/index/index.js')
const PAGE_WXML_DIST = path.join(APP_ROOT, 'dist/pages/index/index.wxml')
const COMMAND_LAYOUT_WXSS_DIST = path.join(APP_ROOT, 'dist/layouts/command/index.wxss')
const RUNTIME_VENDOR_DIST = path.join(APP_ROOT, 'dist/weapp-vendors/weapp-vite-runtime.js')
const INDEX_ROUTE = '/pages/index/index'
const BASELINE_MARKER = 'runtime-vendor-hmr-baseline'
const UPDATED_MARKER = 'runtime-vendor-hmr-updated'
const TEMPLATE_MARKER = 'runtime-vendor-template-hmr'
const STYLE_MARKER = 'runtime-vendor-style-hmr'
const LAYOUTS = ['default', 'command', 'studio', 'split', 'poster'] as const
const MODULE_MISSING_RE = /module 'weapp-vendors\/[^']*runtime[^']*\.js' is not defined/i
const TD_MESSAGE_DUPLICATE_SLOT_RE = /More than one slot named .*tdesign-miniprogram\/message\/message/
const STALE_RUN_E2E_MARKER_RE = /Stale runE2E marker/

function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function resolveAutomatorSessionFile(projectPath: string, port?: number) {
  const normalizedProjectPath = path.resolve(projectPath)
  const sessionKey = port ? `${normalizedProjectPath}#port-${port}` : normalizedProjectPath
  const encodedProjectPath = Buffer.from(sessionKey).toString('base64url')
  return path.join(os.tmpdir(), 'weapp-vite-automator-sessions', `${encodedProjectPath}.json`)
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

async function waitForCurrentIndexPageDom(miniProgram: any, timeoutMs = 30_000) {
  const startedAt = Date.now()
  let lastError: unknown

  while (Date.now() - startedAt <= timeoutMs) {
    try {
      const page = await miniProgram.currentPage()
      await waitForLayoutPowerDom(page, 3_000)
      return page
    }
    catch (error) {
      lastError = error
    }
    await delay(300)
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError))
}

async function relaunchIndexPage(miniProgram: any) {
  await miniProgram.reLaunch(INDEX_ROUTE)
  return await waitForCurrentIndexPageDom(miniProgram)
}

function isStaleRunE2EPageMarkerError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error)
  return STALE_RUN_E2E_MARKER_RE.test(message)
}

async function waitForRunE2EMarker(page: any, marker: string, timeoutMs = 30_000) {
  const startedAt = Date.now()
  const staleMarkerTimeoutMs = Math.min(5_000, Math.max(1_500, Math.floor(timeoutMs / 2)))
  let lastResult: unknown
  let domReady = false
  let staleMarkerStartedAt = 0

  while (Date.now() - startedAt <= timeoutMs) {
    try {
      if (!domReady) {
        await waitForLayoutPowerDom(page, 3_000)
        domReady = true
      }
      lastResult = await page.callMethod('runE2E')
      if ((lastResult as any)?.ok === true && (lastResult as any)?.marker === marker) {
        return lastResult
      }
      if ((lastResult as any)?.ok === true && typeof (lastResult as any)?.marker === 'string' && (lastResult as any)?.marker !== marker) {
        staleMarkerStartedAt ||= Date.now()
        if (Date.now() - staleMarkerStartedAt >= staleMarkerTimeoutMs) {
          throw new Error(`Stale runE2E marker ${String((lastResult as any).marker)} while waiting ${marker}`)
        }
      }
      else {
        staleMarkerStartedAt = 0
      }
    }
    catch (error) {
      if (isStaleRunE2EPageMarkerError(error)) {
        throw error
      }
    }
    try {
      await page.waitFor?.(250)
    }
    catch {
      await delay(250)
    }
  }

  throw new Error(`Timed out waiting runE2E marker ${marker}; lastResult=${JSON.stringify(lastResult)}`)
}

async function waitForIdeRecompileSettled(delayMs = 1_500) {
  await delay(delayMs)
}

async function relaunchIndexPageWithRunE2EMarker(miniProgram: any, marker: string, timeoutMs = 24_000) {
  const startedAt = Date.now()
  let lastError: unknown

  while (Date.now() - startedAt <= timeoutMs) {
    try {
      const page = await relaunchIndexPage(miniProgram)
      await waitForRunE2EMarker(page, marker, 3_000)
      return page
    }
    catch (error) {
      lastError = error
      if (isStaleRunE2EPageMarkerError(error)) {
        throw error
      }
    }
    await delay(1_000)
  }

  const lastMessage = lastError instanceof Error ? lastError.message : String(lastError)
  throw new Error(`Timed out relaunching ${INDEX_ROUTE} with runE2E marker ${marker}; lastError=${lastMessage}`)
}

function isRecoverableRunE2EMarkerError(error: unknown, marker: string) {
  const message = error instanceof Error ? error.message : String(error)
  return message.includes(`Timed out relaunching ${INDEX_ROUTE} with runE2E marker ${marker}`)
    || message.includes(`while waiting ${marker}`)
}

async function expectLayoutFeedback(page: any, collector: RuntimeErrorCollector) {
  const marker = collector.mark()
  const result = await page.callMethod('runLayoutFeedbackE2E')
  await page.waitFor?.(600).catch(() => delay(600))
  expect(result).toMatchObject({
    ok: true,
    results: [
      {
        feedback: 'message',
        layout: 'default',
        messageTheme: 'info',
        toastTheme: 'success',
        toastPlacement: 'middle',
        toastDirection: 'row',
      },
      {
        feedback: 'toast',
        layout: 'default',
        messageTheme: 'info',
        toastTheme: 'success',
        toastPlacement: 'middle',
        toastDirection: 'row',
      },
      {
        feedback: 'message',
        layout: 'command',
        messageTheme: 'warning',
        toastTheme: 'loading',
        toastPlacement: 'top',
        toastDirection: 'column',
      },
      {
        feedback: 'toast',
        layout: 'command',
        messageTheme: 'warning',
        toastTheme: 'loading',
        toastPlacement: 'top',
        toastDirection: 'column',
      },
      {
        feedback: 'message',
        layout: 'studio',
        messageTheme: 'success',
        toastTheme: 'success',
        toastPlacement: 'bottom',
        toastDirection: 'column',
      },
      {
        feedback: 'toast',
        layout: 'studio',
        messageTheme: 'success',
        toastTheme: 'success',
        toastPlacement: 'bottom',
        toastDirection: 'column',
      },
      {
        feedback: 'message',
        layout: 'split',
        messageTheme: 'warning',
        toastTheme: 'warning',
        toastPlacement: 'middle',
        toastDirection: 'row',
      },
      {
        feedback: 'toast',
        layout: 'split',
        messageTheme: 'warning',
        toastTheme: 'warning',
        toastPlacement: 'middle',
        toastDirection: 'row',
      },
      {
        feedback: 'message',
        layout: 'poster',
        messageTheme: 'error',
        toastTheme: 'error',
        toastPlacement: 'bottom',
        toastDirection: 'column',
      },
      {
        feedback: 'toast',
        layout: 'poster',
        messageTheme: 'error',
        toastTheme: 'error',
        toastPlacement: 'bottom',
        toastDirection: 'column',
      },
    ],
  })
  for (const feedbackResult of result.results) {
    expect(feedbackResult.messageOffsetTop).toBeGreaterThan(70)
  }
  expect(collector.getSince(marker)).toEqual([])
  expect(collector.getLogsSince(marker)).not.toEqual(
    expect.arrayContaining([
      expect.stringMatching(TD_MESSAGE_DUPLICATE_SLOT_RE),
    ]),
  )
}

describe.sequential('layout-power-demo runtime vendor HMR in real WeChat DevTools', () => {
  let originalScript = ''
  let originalTemplate = ''
  let originalCommandLayoutStyle = ''
  let miniProgram: any
  let runtimeErrorCollector: RuntimeErrorCollector | undefined
  let devProcess: ReturnType<typeof startDevProcess> | undefined

  beforeAll(async () => {
    ;[originalScript, originalTemplate, originalCommandLayoutStyle] = await Promise.all([
      fs.readFile(PAGE_SCRIPT, 'utf8'),
      fs.readFile(PAGE_WXML, 'utf8'),
      fs.readFile(COMMAND_LAYOUT_WXSS, 'utf8'),
    ])
    if (!originalScript.includes(BASELINE_MARKER)) {
      throw new Error(`Expected ${PAGE_SCRIPT} to contain ${BASELINE_MARKER}`)
    }
    await Promise.all([
      fs.rm(resolveAutomatorSessionFile(APP_ROOT), { force: true }).catch(() => {}),
      fs.rm(resolveAutomatorSessionFile(APP_ROOT, resolveProjectAutomatorPort(APP_ROOT)), { force: true }).catch(() => {}),
    ])
    await cleanupResidualIdeProcesses()
  }, 60_000)

  afterAll(async () => {
    if (originalScript) {
      await fs.writeFile(PAGE_SCRIPT, originalScript, 'utf8').catch(() => {})
    }
    if (originalTemplate) {
      await fs.writeFile(PAGE_WXML, originalTemplate, 'utf8').catch(() => {})
    }
    if (originalCommandLayoutStyle) {
      await fs.writeFile(COMMAND_LAYOUT_WXSS, originalCommandLayoutStyle, 'utf8').catch(() => {})
    }
    await Promise.resolve(miniProgram?.disconnect?.()).catch(() => {})
    await Promise.resolve(miniProgram?.close?.()).catch(() => {})
    runtimeErrorCollector?.dispose()
    runtimeErrorCollector = undefined
    miniProgram = undefined
    await devProcess?.stop().catch(() => {})
    await cleanupTrackedDevProcesses()
  }, 60_000)

  async function removeAutomatorSessionFiles() {
    await Promise.all([
      fs.rm(resolveAutomatorSessionFile(APP_ROOT), { force: true }).catch(() => {}),
      fs.rm(resolveAutomatorSessionFile(APP_ROOT, resolveProjectAutomatorPort(APP_ROOT)), { force: true }).catch(() => {}),
    ])
  }

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

  async function startDevSession() {
    process.stdout.write('[layout-power-demo:hmr] start-dev-session\n')
    devProcess = startDevProcess(process.execPath, [CLI_PATH, 'dev', '-o', '--non-interactive', '--login-retry', 'never'], {
      cwd: APP_ROOT,
      all: true,
      env: createDevProcessEnv(),
      reject: false,
    })
    process.stdout.write(`[layout-power-demo:hmr] dev-process-started pid=${devProcess.pid ?? 'unknown'}\n`)
    const session = await devProcess.waitFor(
      waitForOpenedAutomator(APP_ROOT, { timeoutMs: 120_000 }),
      'layout-power-demo opened automator',
    )
    miniProgram = session.miniProgram
    process.stdout.write(`[layout-power-demo:hmr] automator-connected endpoint=${session.metadata.wsEndpoint}\n`)
    runtimeErrorCollector = attachRuntimeErrorCollector(miniProgram)
    return miniProgram
  }

  async function relaunchIndexPageWithRecoveredSession(marker: string) {
    let lastError: unknown
    for (let restartAttempt = 0; restartAttempt <= 3; restartAttempt += 1) {
      try {
        return await relaunchIndexPageWithRunE2EMarker(miniProgram, marker)
      }
      catch (error) {
        if (!isRecoverableRunE2EMarkerError(error, marker) || restartAttempt >= 3) {
          throw error
        }
        lastError = error
      }
      const message = lastError instanceof Error ? lastError.message : String(lastError)
      process.stdout.write(`[layout-power-demo:hmr] restart-devtools-session marker=${marker} attempt=${restartAttempt + 1}/3 reason=${message}\n`)
      await stopDevSession()
      await waitForIdeRecompileSettled(2_000)
      await startDevSession()
    }
    throw lastError instanceof Error ? lastError : new Error(String(lastError))
  }

  it('keeps active runtime vendor chunks available after page script HMR', async () => {
    await startDevSession()
    let page = await relaunchIndexPage(miniProgram)
    await waitForRunE2EMarker(page, BASELINE_MARKER)
    await expectLayoutFeedback(page, runtimeErrorCollector)

    const nextScript = originalScript.replace(BASELINE_MARKER, UPDATED_MARKER)
    expect(nextScript).not.toBe(originalScript)
    await replaceFileByRename(PAGE_SCRIPT, nextScript)

    const pageJs = await waitForFileContains(PAGE_JS_DIST, UPDATED_MARKER, 30_000)
    expect(pageJs).toContain('../../weapp-vendors/weapp-vite-runtime.js')
    await waitForFileContains(RUNTIME_VENDOR_DIST, 'setPageLayout', 30_000)
    await waitForIdeRecompileSettled()

    page = await relaunchIndexPageWithRecoveredSession(UPDATED_MARKER)
    await expectLayoutFeedback(page, runtimeErrorCollector)
    expect(devProcess.getOutput()).not.toMatch(MODULE_MISSING_RE)

    const nextTemplate = originalTemplate.replace('页面内容保留，只替换布局、属性和骨架。', `页面内容保留，只替换布局、属性和骨架。${TEMPLATE_MARKER}`)
    expect(nextTemplate).not.toBe(originalTemplate)
    await replaceFileByRename(PAGE_WXML, nextTemplate)
    await waitForFileContains(PAGE_WXML_DIST, TEMPLATE_MARKER, 30_000)
    await waitForFileContains(RUNTIME_VENDOR_DIST, 'setPageLayout', 30_000)
    await waitForIdeRecompileSettled()

    page = await relaunchIndexPageWithRecoveredSession(UPDATED_MARKER)
    expect(devProcess.getOutput()).not.toMatch(MODULE_MISSING_RE)

    const nextCommandLayoutStyle = `${originalCommandLayoutStyle}\n/* ${STYLE_MARKER} */\n`
    expect(nextCommandLayoutStyle).not.toBe(originalCommandLayoutStyle)
    await replaceFileByRename(COMMAND_LAYOUT_WXSS, nextCommandLayoutStyle)
    await waitForFileContains(COMMAND_LAYOUT_WXSS_DIST, STYLE_MARKER, 30_000)
    await waitForFileContains(RUNTIME_VENDOR_DIST, 'setPageLayout', 30_000)
    await waitForIdeRecompileSettled()

    page = await relaunchIndexPageWithRecoveredSession(UPDATED_MARKER)
    expect(devProcess.getOutput()).not.toMatch(MODULE_MISSING_RE)
  }, 420_000)
})
