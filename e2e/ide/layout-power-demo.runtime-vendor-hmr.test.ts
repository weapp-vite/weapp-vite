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

describe.sequential('layout-power-demo runtime vendor HMR in real WeChat DevTools', () => {
  let originalScript = ''
  let originalTemplate = ''
  let originalCommandLayoutStyle = ''
  let miniProgram: any
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
    miniProgram = undefined
    await devProcess?.stop().catch(() => {})
    await cleanupTrackedDevProcesses()
  }, 60_000)

  it('keeps active runtime vendor chunks available after page script HMR', async () => {
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
    let page = await relaunchIndexPage(miniProgram)
    await waitForRunE2EMarker(page, BASELINE_MARKER)

    const nextScript = originalScript.replace(BASELINE_MARKER, UPDATED_MARKER)
    expect(nextScript).not.toBe(originalScript)
    await replaceFileByRename(PAGE_SCRIPT, nextScript)

    const pageJs = await waitForFileContains(PAGE_JS_DIST, UPDATED_MARKER, 30_000)
    expect(pageJs).toContain('../../weapp-vendors/weapp-vite-runtime.js')
    await waitForFileContains(RUNTIME_VENDOR_DIST, 'setPageLayout', 30_000)

    page = await relaunchIndexPage(miniProgram)
    await waitForRunE2EMarker(page, UPDATED_MARKER)
    expect(devProcess.getOutput()).not.toMatch(MODULE_MISSING_RE)

    const nextTemplate = originalTemplate.replace('页面内容保留，只替换布局、属性和骨架。', `页面内容保留，只替换布局、属性和骨架。${TEMPLATE_MARKER}`)
    expect(nextTemplate).not.toBe(originalTemplate)
    await replaceFileByRename(PAGE_WXML, nextTemplate)
    await waitForFileContains(PAGE_WXML_DIST, TEMPLATE_MARKER, 30_000)
    await waitForFileContains(RUNTIME_VENDOR_DIST, 'setPageLayout', 30_000)

    page = await relaunchIndexPage(miniProgram)
    await waitForRunE2EMarker(page, UPDATED_MARKER)
    expect(devProcess.getOutput()).not.toMatch(MODULE_MISSING_RE)

    const nextCommandLayoutStyle = `${originalCommandLayoutStyle}\n/* ${STYLE_MARKER} */\n`
    expect(nextCommandLayoutStyle).not.toBe(originalCommandLayoutStyle)
    await replaceFileByRename(COMMAND_LAYOUT_WXSS, nextCommandLayoutStyle)
    await waitForFileContains(COMMAND_LAYOUT_WXSS_DIST, STYLE_MARKER, 30_000)
    await waitForFileContains(RUNTIME_VENDOR_DIST, 'setPageLayout', 30_000)

    page = await relaunchIndexPage(miniProgram)
    await waitForRunE2EMarker(page, UPDATED_MARKER)
    expect(devProcess.getOutput()).not.toMatch(MODULE_MISSING_RE)
  }, 420_000)
})
