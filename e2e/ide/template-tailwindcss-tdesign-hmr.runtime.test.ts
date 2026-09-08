import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { WEAPP_VITE_STATEFUL_HMR_GLOBAL_STYLE_BASENAME } from '@weapp-core/constants'
import { closeSharedMiniProgram } from '@weapp-vite/devtools-runtime'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { launchAutomator } from '../utils/automator'
import {
  cleanupTrackedDevProcesses,
  startDevProcess,
} from '../utils/dev-process'
import { createDevProcessEnv } from '../utils/dev-process-env'
import { createDomAcceptance } from '../utils/domAcceptance'
import { waitForEmittedStylesheet } from '../utils/emittedStylesheet'
import { replaceFileByRename, waitForFileContains } from '../utils/hmr-helpers'
import { createHmrRuntimeDiagnostics } from '../utils/hmrRuntimeDiagnostics'
import { cleanupResidualIdeProcesses } from '../utils/ide-devtools-cleanup'
import { createTdesignNativeScriptUpdate, tdesignNativeScriptCheckpoints } from './tdesignHmr/nativeScript'

const WORKSPACE_ROOT = path.resolve(import.meta.dirname, '../..')
const TEMPLATE_ROOT = path.resolve(WORKSPACE_ROOT, 'templates/weapp-vite-tailwindcss-tdesign-template')
const DIST_ROOT = path.resolve(TEMPLATE_ROOT, 'dist')
const INDEX_WXML = path.resolve(TEMPLATE_ROOT, 'src/pages/index/index.wxml')
const INDEX_SOURCE = path.resolve(TEMPLATE_ROOT, 'src/pages/index/index.ts')
const APP_SOURCE = path.resolve(TEMPLATE_ROOT, 'src/app.ts')
const INDEX_WXML_DIST = path.resolve(TEMPLATE_ROOT, 'dist/pages/index/index.wxml')
const APP_WXSS_DIST = path.resolve(TEMPLATE_ROOT, 'dist/app.wxss')
const INDEX_ROUTE = '/pages/index/index'
const ROOT_MARKUP_RE = /<view class="min-h-screen \{\{ mode === 'light'\?'[^']+':'bg-gray-900 text-slate-200' \}\} transition-colors duration-500">/
const LIGHT_BACKGROUND_CLASS_RE = /bg-(?:\[#([0-9a-fA-F]{6})\]|gray-100)/
const INITIAL_BACKGROUND_HEX = 'f3f4f6'
const UPDATED_BACKGROUND_HEX = '10b981'
const INITIAL_BACKGROUND_CSS = 'background-color: #f3f4f6'
const UPDATED_BACKGROUND_CSS = 'background-color: #10b981'
const INITIAL_ESCAPED_CLASS = 'bg-_b_hf3f4f6_B'
const UPDATED_ESCAPED_CLASS = 'bg-_b_h10b981_B'
const PROBE_ID = 'tailwind-hmr-probe'
const CURRENT_PAGE_READ_TIMEOUT = 3_000
const CURRENT_PAGE_READ_RETRIES = 2
const ROUTE_READY_TIMEOUT = 30_000

function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function isDevtoolsPageProtocolUnavailable(error: unknown) {
  const message = error instanceof Error ? error.message : String(error)
  return message.includes('DevTools did not respond to protocol method App.getCurrentPage')
    || message.includes('DevTools did not respond to protocol method App.getPageStack')
    || message.includes('DevTools did not respond to protocol method App.callFunction')
    || message.includes('DevTools did not respond to protocol method App.captureScreenshot')
    || message.includes('Timeout in raw reLaunch')
    || message.includes('Operation timed out after')
    || message.includes('Connection closed, check if wechat web devTools is still running')
    || message.includes('WebSocket is not open')
    || message.includes('socket hang up')
    || message.includes('Target closed')
}

function replaceLightBackgroundClass(markup: string, hex: string) {
  const updated = markup.replace(LIGHT_BACKGROUND_CLASS_RE, `bg-[#${hex}]`)
  if (updated === markup) {
    throw new Error('Expected Tailwind HMR root markup to contain a replaceable light background class')
  }
  return updated
}

async function waitForIndexPage(miniProgram: any, timeoutMs = ROUTE_READY_TIMEOUT) {
  const start = Date.now()
  let lastError: unknown

  while (Date.now() - start <= timeoutMs) {
    try {
      const page = await miniProgram.currentPage({
        appFunctionFallback: false,
        timeout: CURRENT_PAGE_READ_TIMEOUT,
        retries: CURRENT_PAGE_READ_RETRIES,
      })
      const currentPath = String(page?.path ?? '').replace(/^\/+/, '')
      if (currentPath === INDEX_ROUTE.replace(/^\/+/, '')) {
        return page
      }
    }
    catch (error) {
      lastError = error
      if (!isDevtoolsPageProtocolUnavailable(error)) {
        throw error
      }
    }
    await delay(300)
  }

  throw lastError instanceof Error
    ? lastError
    : new Error(`Timed out waiting for ${INDEX_ROUTE}`)
}

describe('template TailwindCSS TDesign HMR in real WeChat DevTools', { concurrent: false }, () => {
  let initialWxml = ''
  let originalWxml = ''
  let originalAppSource = ''
  let originalIndexSource = ''
  let miniProgram: any
  let diagnostics: ReturnType<typeof createHmrRuntimeDiagnostics> | undefined
  let devProcess: ReturnType<typeof startDevProcess> | undefined

  async function stopDevSession() {
    if (miniProgram) {
      if (typeof miniProgram.close === 'function') {
        await Promise.resolve(miniProgram.close()).catch(() => {})
      }
      else {
        await Promise.resolve(miniProgram.disconnect?.()).catch(() => {})
      }
      miniProgram = undefined
    }
    await closeSharedMiniProgram(TEMPLATE_ROOT).catch(() => {})
    await devProcess?.stop().catch(() => {})
    devProcess = undefined
    await cleanupResidualIdeProcesses()
  }

  afterAll(async () => {
    await diagnostics?.capture('finally')
    await stopDevSession()
    if (originalWxml) {
      await fs.writeFile(INDEX_WXML, originalWxml, 'utf8').catch(() => {})
    }
    if (originalIndexSource) {
      await fs.writeFile(INDEX_SOURCE, originalIndexSource, 'utf8')
    }
    if (originalAppSource) {
      await fs.writeFile(APP_SOURCE, originalAppSource, 'utf8')
    }
    await cleanupTrackedDevProcesses()
  }, 60_000)

  async function launchRuntimeAutomator() {
    miniProgram = await launchAutomator({
      bridgeProjectMode: 'direct',
      launchMode: 'bridge',
      maxLaunchRetries: 1,
      projectPath: TEMPLATE_ROOT,
      warmupAllowRelaunch: false,
      warmupRoute: INDEX_ROUTE,
      warmupRootSelectors: [`#${PROBE_ID}`],
    })
    return miniProgram
  }

  async function startDevSessionForDist(label: string, escapedClass: string, backgroundCss: string) {
    process.stdout.write(`[template-tailwindcss-tdesign:hmr] start-dev-session label=${label}\n`)
    devProcess = startDevProcess('pnpm', ['exec', 'wv', 'dev', '--non-interactive'], {
      cwd: TEMPLATE_ROOT,
      env: createDevProcessEnv(),
      reject: false,
    })
    process.stdout.write(`[template-tailwindcss-tdesign:hmr] dev-process-started pid=${devProcess.pid ?? 'unknown'}\n`)
    await devProcess.waitForInitialBuild()
    await devProcess.waitFor(
      Promise.all([
        waitForFileContains(INDEX_WXML_DIST, escapedClass),
        waitForEmittedStylesheet(APP_WXSS_DIST, backgroundCss),
        waitForFileContains(path.join(DIST_ROOT, 'app.wxss'), `@import "./${WEAPP_VITE_STATEFUL_HMR_GLOBAL_STYLE_BASENAME}.wxss";`),
      ]),
      `tailwindcss tdesign ${label} dist ready`,
    )
    await launchRuntimeAutomator()
    process.stdout.write('[template-tailwindcss-tdesign:hmr] automator-connected mode=bridge\n')
    return miniProgram
  }

  async function startDevSession() {
    return await startDevSessionForDist(
      'initial Tailwind background',
      INITIAL_ESCAPED_CLASS,
      INITIAL_BACKGROUND_CSS,
    )
  }

  async function tapModeControl() {
    const page = await waitForIndexPage(miniProgram)
    const controls = await page.$$('#tailwind-mode', { fallback: false, timeout: 5_000 })
    expect(controls).toHaveLength(1)
    await controls[0].tap()
  }

  beforeAll(async () => {
    originalIndexSource = await fs.readFile(INDEX_SOURCE, 'utf8')
    originalWxml = await fs.readFile(INDEX_WXML, 'utf8')
    const rootMarkupMatch = originalWxml.match(ROOT_MARKUP_RE)
    if (!rootMarkupMatch) {
      throw new Error(`Expected ${INDEX_WXML} to contain the Tailwind HMR root markup`)
    }
    const probedRootMarkup = replaceLightBackgroundClass(
      rootMarkupMatch[0].replace('<view ', `<view id="${PROBE_ID}" data-e2e-bg="${INITIAL_BACKGROUND_HEX}" `),
      INITIAL_BACKGROUND_HEX,
    )
    initialWxml = originalWxml.replace(rootMarkupMatch[0], probedRootMarkup)
      .replace('<view bind:tap="switchMode"', '<view id="tailwind-mode" bind:tap="switchMode"')
    await replaceFileByRename(INDEX_WXML, initialWxml)
    originalAppSource = await fs.readFile(APP_SOURCE, 'utf8')
    expect(originalAppSource.includes('onLaunch() {')).toBe(true)
    await fs.writeFile(APP_SOURCE, originalAppSource.replace('onLaunch() {', `onLaunch() {
    this.__e2eHmrLaunch = Date.now()
    console.info('[hmr-diagnostics:app-launch]', this.__e2eHmrLaunch)`), 'utf8')
    await closeSharedMiniProgram(TEMPLATE_ROOT).catch(() => {})
    await cleanupResidualIdeProcesses()
    await fs.rm(DIST_ROOT, { force: true, recursive: true })
    await startDevSession()
    diagnostics = createHmrRuntimeDiagnostics(miniProgram, 'templates/weapp-vite-tailwindcss-tdesign-template')
  }, 420_000)

  it('updates and restores native Page methods with external npm while retaining rendered interaction state', async (context) => {
    const dom = createDomAcceptance(context, 'templates/weapp-vite-tailwindcss-tdesign-template', tdesignNativeScriptCheckpoints)
    await dom.check('native-script:initial', miniProgram, await waitForIndexPage(miniProgram))
    await tapModeControl()
    await dom.check('native-script:dark', miniProgram, await waitForIndexPage(miniProgram))
    const initialIdentity = await diagnostics!.initialize()
    const nativeScript = createTdesignNativeScriptUpdate({
      diagnostics: diagnostics!,
      initialIdentity,
      miniProgram,
      originalSource: originalIndexSource,
      sourceFile: INDEX_SOURCE,
    })
    await nativeScript.patch()
    await dom.check('native-script:patched-state', miniProgram, await waitForIndexPage(miniProgram))
    await nativeScript.checkIdentity('native-script:patched-state')
    await tapModeControl()
    await dom.check('native-script:patched-tap', miniProgram, await waitForIndexPage(miniProgram))
    await nativeScript.checkIdentity('native-script:patched-tap')
    await nativeScript.restore()
    await dom.check('native-script:restored-state', miniProgram, await waitForIndexPage(miniProgram))
    await nativeScript.checkIdentity('native-script:restored-state')
    await tapModeControl()
    await dom.check('native-script:restored-tap', miniProgram, await waitForIndexPage(miniProgram))
    await nativeScript.checkIdentity('native-script:restored-tap')
  }, 420_000)

  it('updates the visible Tailwind arbitrary background color through dev HMR', async (context) => {
    const dom = createDomAcceptance(context, 'templates/weapp-vite-tailwindcss-tdesign-template', [
      { id: 'tailwind:initial', route: INDEX_ROUTE, action: '初始浅色背景的计算样式、布局和模式文本', nodes: [
        { selector: `#${PROBE_ID}`, styles: { 'background-color': 'rgb(243, 244, 246)' }, visible: true },
        { selector: '#tailwind-mode', text: '当前模式 light 切换模式' },
      ] },
      { id: 'tailwind:dark', route: INDEX_ROUTE, action: '切换暗色模式并记录交互状态', nodes: [
        { selector: `#${PROBE_ID}`, styles: { 'background-color': 'rgb(16, 24, 40)' }, visible: true },
        { selector: '#tailwind-mode', text: '当前模式 dark 切换模式' },
      ] },
      { id: 'tailwind:hmr-preserved', route: INDEX_ROUTE, action: '修改浅色背景后保留当前暗色交互状态', nodes: [
        { selector: `#${PROBE_ID}`, attributes: { 'data-e2e-bg': UPDATED_BACKGROUND_HEX }, styles: { 'background-color': 'rgb(16, 24, 40)' }, visible: true },
        { selector: '#tailwind-mode', text: '当前模式 dark 切换模式' },
      ] },
      { id: 'tailwind:updated', route: INDEX_ROUTE, action: '切回浅色后验收更新背景和真实布局', nodes: [
        { selector: `#${PROBE_ID}`, styles: { 'background-color': 'rgb(16, 185, 129)' }, visible: true },
        { selector: '#tailwind-mode', text: '当前模式 light 切换模式' },
      ] },
      { id: 'tailwind:updated-dark', route: INDEX_ROUTE, action: '在原页面实例再次切换暗色并确认更新仍生效', nodes: [
        { selector: `#${PROBE_ID}`, attributes: { 'data-e2e-bg': UPDATED_BACKGROUND_HEX }, styles: { 'background-color': 'rgb(16, 24, 40)' }, visible: true },
        { selector: '#tailwind-mode', text: '当前模式 dark 切换模式' },
      ] },
    ])
    await waitForFileContains(INDEX_WXML_DIST, PROBE_ID)
    await waitForFileContains(INDEX_WXML_DIST, `data-e2e-bg="${INITIAL_BACKGROUND_HEX}"`)
    await waitForFileContains(INDEX_WXML_DIST, INITIAL_ESCAPED_CLASS)
    await waitForEmittedStylesheet(APP_WXSS_DIST, INITIAL_BACKGROUND_CSS)
    process.stdout.write(`[template-tailwindcss-tdesign:hmr] dist-ready label=initial Tailwind background template=${INITIAL_ESCAPED_CLASS} css=${INITIAL_BACKGROUND_CSS}\n`)
    const page = await waitForIndexPage(miniProgram)
    await dom.check('tailwind:initial', miniProgram, page)
    await tapModeControl()
    await dom.check('tailwind:dark', miniProgram, page)
    const initialIdentity = await diagnostics!.initialize()

    const updatedWxml = replaceLightBackgroundClass(
      initialWxml.replace(`data-e2e-bg="${INITIAL_BACKGROUND_HEX}"`, `data-e2e-bg="${UPDATED_BACKGROUND_HEX}"`),
      UPDATED_BACKGROUND_HEX,
    )
    expect(updatedWxml).not.toBe(initialWxml)
    await replaceFileByRename(INDEX_WXML, updatedWxml)
    await waitForFileContains(INDEX_WXML_DIST, `data-e2e-bg="${UPDATED_BACKGROUND_HEX}"`)
    await waitForFileContains(INDEX_WXML_DIST, UPDATED_ESCAPED_CLASS)
    await waitForEmittedStylesheet(APP_WXSS_DIST, UPDATED_BACKGROUND_CSS)
    await diagnostics!.capture('tailwind:updated-output')
    await dom.check('tailwind:hmr-preserved', miniProgram, await waitForIndexPage(miniProgram))
    const preservedIdentity = await diagnostics!.capture('tailwind:preserved-rendered')
    expect(preservedIdentity.errors).toEqual([])
    expect(preservedIdentity.pageId).toBe(initialIdentity.pageId)
    expect(preservedIdentity.runtime).toMatchObject({ pageMarkerRetained: true, appMarkerRetained: true })
    await tapModeControl()
    process.stdout.write(`[template-tailwindcss-tdesign:hmr] dist-ready label=updated Tailwind background template=${UPDATED_ESCAPED_CLASS} css=${UPDATED_BACKGROUND_CSS}\n`)
    await dom.check('tailwind:updated', miniProgram, await waitForIndexPage(miniProgram))
    const updatedIdentity = await diagnostics!.capture('tailwind:updated-rendered')
    expect(updatedIdentity.errors).toEqual([])
    expect(updatedIdentity.pageId).toBe(initialIdentity.pageId)
    expect(updatedIdentity.runtime).toMatchObject({ pageMarkerRetained: true, appMarkerRetained: true })
    await tapModeControl()
    await dom.check('tailwind:updated-dark', miniProgram, await waitForIndexPage(miniProgram))
    const finalIdentity = await diagnostics!.capture('tailwind:updated-dark-rendered')
    expect(finalIdentity.errors).toEqual([])
    expect(finalIdentity.pageId).toBe(initialIdentity.pageId)
    expect(finalIdentity.runtime).toMatchObject({ pageMarkerRetained: true, appMarkerRetained: true })
  }, 420_000)
})
