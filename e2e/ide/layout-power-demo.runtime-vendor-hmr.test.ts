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
import { replaceFileByRename, waitForFileContains } from '../utils/hmr-helpers'
import { cleanupResidualIdeProcesses } from '../utils/ide-devtools-cleanup'
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
const MODULE_MISSING_RE = /module 'weapp-vendors\/[^']*runtime[^']*\.js' is not defined/i
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

async function relaunchIndexPageWithRunE2EMarker(miniProgram: any, marker: string, timeoutMs = 90_000) {
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
    }
    await delay(1_000)
  }

  const lastMessage = lastError instanceof Error ? lastError.message : String(lastError)
  throw new Error(`Timed out relaunching ${INDEX_ROUTE} with runE2E marker ${marker}; lastError=${lastMessage}`)
}

function isStaleRunE2EMarkerError(error: unknown, marker: string) {
  const message = error instanceof Error ? error.message : String(error)
  return message.includes(`Timed out relaunching ${INDEX_ROUTE} with runE2E marker ${marker}`)
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

async function expectLayoutFeedbackByTap(page: any, collector: RuntimeErrorCollector) {
  const marker = collector.mark()

  for (const layout of LAYOUTS) {
    if (layout !== 'default') {
      await tapRequired(page, `[data-e2e-layout="${layout}"]`)
      await waitForCurrentLayout(page, layout)
    }
    for (let index = 0; index < 3; index += 1) {
      await tapRequired(page, '[data-e2e-feedback="message"]')
      await page.waitFor?.(120).catch(() => delay(120))
    }
    await tapRequired(page, '[data-e2e-feedback="toast"]')
    await page.waitFor?.(300).catch(() => delay(300))
  }

  await page.waitFor?.(2_500).catch(() => delay(2_500))
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
    return miniProgram
  }

  async function relaunchIndexPageWithRecoveredSession(marker: string) {
    try {
      return await relaunchIndexPageWithRunE2EMarker(miniProgram, marker)
    }
    catch (error) {
      if (!isStaleRunE2EMarkerError(error, marker)) {
        throw error
      }

      const message = error instanceof Error ? error.message : String(error)
      process.stdout.write(`[layout-power-demo:hmr] restart-devtools-session marker=${marker} reason=${message}\n`)
      await stopDevSession()
      await waitForIdeRecompileSettled(1_600)
      await startDevSession()
      return await relaunchIndexPageWithRunE2EMarker(miniProgram, marker)
    }
  }

  it('keeps active runtime vendor chunks available after page script HMR', async () => {
    await startDevSession()
    let page = await relaunchIndexPage(miniProgram)
    await waitForRunE2EMarker(page, BASELINE_MARKER)
    await expectLayoutFeedback(page, runtimeErrorCollector)
    await expectLayoutFeedbackByTap(page, runtimeErrorCollector)

    const nextScript = originalScript.replace(BASELINE_MARKER, UPDATED_MARKER)
    expect(nextScript).not.toBe(originalScript)
    await replaceFileByRename(PAGE_SCRIPT, nextScript)

    const pageJs = await waitForFileContains(PAGE_JS_DIST, UPDATED_MARKER, 30_000)
    expect(pageJs).toContain('../../weapp-vendors/weapp-vite-runtime.js')
    await waitForFileContains(RUNTIME_VENDOR_DIST, 'setPageLayout', 30_000)
    await waitForIdeRecompileSettled()

    page = await relaunchIndexPageWithRecoveredSession(UPDATED_MARKER)
    await expectLayoutFeedback(page, runtimeErrorCollector)
    await expectLayoutFeedbackByTap(page, runtimeErrorCollector)
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
