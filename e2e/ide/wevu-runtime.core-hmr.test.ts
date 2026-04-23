import { fs } from '@weapp-core/shared/node'
import path from 'pathe'
import { afterAll, describe, expect, it } from 'vitest'
import { isDevtoolsHttpPortError, launchAutomator } from '../utils/automator'
import { startDevProcess } from '../utils/dev-process'
import { createDevProcessEnv } from '../utils/dev-process-env'
import {
  createHmrMarker,
  replaceFileByRename,
  replaceHmrSfcTitle,
  waitForFileContains,
} from '../utils/hmr-helpers'
import {
  cleanDevtoolsCache,
  cleanupResidualDevtoolsProcesses,
  cleanupResidualIdeProcesses,
} from '../utils/ide-devtools-cleanup'
import { APP_ROOT, CLI_PATH, DIST_ROOT, normalizeAutomatorWxml, waitForFile } from '../wevu-runtime.utils'
import { readPageWxml as readAutomatorPageWxml, relaunchPage } from './github-issues.runtime.shared'

const HMR_PAGE_WXML = path.join(APP_ROOT, 'src/pages/hmr/index.wxml')
const HMR_PAGE_SCRIPT = path.join(APP_ROOT, 'src/pages/hmr/index.ts')
const HMR_PAGE_STYLE = path.join(APP_ROOT, 'src/pages/hmr/index.wxss')
const HMR_SFC_PATH = path.join(APP_ROOT, 'src/pages/hmr-sfc/index.vue')
const LAYOUT_PAGE_WXML = path.join(APP_ROOT, 'src/pages/layouts/index.wxml')
const LAYOUT_PAGE_SCRIPT = path.join(APP_ROOT, 'src/pages/layouts/index.ts')
const LAYOUT_PAGE_STYLE = path.join(APP_ROOT, 'src/pages/layouts/index.wxss')

const HMR_PAGE_WXML_DIST = path.join(DIST_ROOT, 'pages/hmr/index.wxml')
const HMR_PAGE_JS_DIST = path.join(DIST_ROOT, 'pages/hmr/index.js')
const HMR_PAGE_WXSS_DIST = path.join(DIST_ROOT, 'pages/hmr/index.wxss')
const HMR_SFC_WXML_DIST = path.join(DIST_ROOT, 'pages/hmr-sfc/index.wxml')
const HMR_SFC_JS_DIST = path.join(DIST_ROOT, 'pages/hmr-sfc/index.js')
const HMR_SFC_WXSS_DIST = path.join(DIST_ROOT, 'pages/hmr-sfc/index.wxss')
const LAYOUT_PAGE_WXML_DIST = path.join(DIST_ROOT, 'pages/layouts/index.wxml')
const LAYOUT_PAGE_JS_DIST = path.join(DIST_ROOT, 'pages/layouts/index.js')
const LAYOUT_PAGE_WXSS_DIST = path.join(DIST_ROOT, 'pages/layouts/index.wxss')

let sharedMiniProgram: any = null

async function readPageWxml(page: any) {
  return normalizeAutomatorWxml(await readAutomatorPageWxml(page))
}

async function waitForPageWxmlContains(page: any, marker: string, timeoutMs = 20_000) {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    const wxml = await readPageWxml(page)
    if (wxml.includes(marker)) {
      return wxml
    }
    await page.waitFor(200)
  }
  throw new Error(`Timed out waiting runtime wxml to contain marker: ${marker}`)
}

async function waitForIdeRecompileSettled(delayMs = 1_200) {
  await new Promise(resolve => setTimeout(resolve, delayMs))
}

async function closeMiniProgram() {
  if (!sharedMiniProgram) {
    return
  }
  await sharedMiniProgram.close().catch(() => {})
  sharedMiniProgram = null
}

async function ensureMiniProgram(ctx: { skip: (message?: string) => void }) {
  try {
    if (sharedMiniProgram) {
      return sharedMiniProgram
    }
    sharedMiniProgram = await launchAutomator({
      projectPath: APP_ROOT,
    })
    return sharedMiniProgram
  }
  catch (error) {
    if (isDevtoolsHttpPortError(error)) {
      ctx.skip('WeChat DevTools 服务端口未开启，跳过 wevu runtime core HMR IDE 自动化用例。')
    }
    throw error
  }
}

async function relaunchIdeRoute(
  route: string,
  readyText: string | undefined,
  ctx: { skip: (message?: string) => void },
) {
  // 小程序 IDE 的文件型热更新在 compile 后会频繁残留陈旧的 automator 会话；
  // 这里统一重建连接，验证的是“IDE 已感知并重新运行最新产物”，而不是浏览器式模块常驻 HMR。
  for (const cleanType of ['compile', 'all'] as const) {
    await closeMiniProgram()
    await cleanupResidualDevtoolsProcesses()
    await cleanDevtoolsCache(cleanType, { cwd: APP_ROOT }).catch(() => {})
    await waitForIdeRecompileSettled(cleanType === 'compile' ? 1_200 : 1_600)

    const miniProgram = await ensureMiniProgram(ctx)
    const page = await relaunchPage(miniProgram, route, readyText, 24_000)
    if (page) {
      return page
    }
  }

  throw new Error(`Failed to relaunch IDE route: ${route}`)
}

async function waitForFileContainsWithRetry(
  filePath: string,
  marker: string,
  touchFilePath: string,
  touchContent: string,
  timeoutMs = 20_000,
) {
  try {
    return await waitForFileContains(filePath, marker, timeoutMs)
  }
  catch {
    await replaceFileByRename(touchFilePath, `${touchContent}\n`)
    return await waitForFileContains(filePath, marker, timeoutMs)
  }
}

async function updateSourceAndWait(options: {
  sourcePath: string
  distPath: string
  nextSource: string
  marker: string
  timeoutMs?: number
}) {
  const { sourcePath, distPath, nextSource, marker, timeoutMs = 20_000 } = options
  await replaceFileByRename(sourcePath, nextSource)
  return await waitForFileContainsWithRetry(distPath, marker, sourcePath, nextSource, timeoutMs)
}

describe.sequential('wevu runtime core hmr matrix (ide)', () => {
  afterAll(async () => {
    await closeMiniProgram()
    await cleanupResidualIdeProcesses()
  })

  it('keeps DevTools runtime aligned with core page, sfc and layout hmr updates', async (ctx) => {
    await cleanupResidualIdeProcesses()
    await fs.remove(DIST_ROOT)

    const originalSources = new Map<string, string>()
    for (const filePath of [
      HMR_PAGE_WXML,
      HMR_PAGE_SCRIPT,
      HMR_PAGE_STYLE,
      HMR_SFC_PATH,
      LAYOUT_PAGE_WXML,
      LAYOUT_PAGE_SCRIPT,
      LAYOUT_PAGE_STYLE,
    ]) {
      originalSources.set(filePath, await fs.readFile(filePath, 'utf8'))
    }

    const dev = startDevProcess('node', ['--import', 'tsx', CLI_PATH, 'dev', APP_ROOT, '--platform', 'weapp', '--skipNpm'], {
      env: createDevProcessEnv(),
      stdio: 'inherit',
    })

    try {
      await dev.waitFor(waitForFile(path.join(DIST_ROOT, 'app.json'), 90_000), 'weapp app.json generated for core ide hmr')

      const pageTemplateMarker = createHmrMarker('IDE-CORE-PAGE-TEMPLATE', 'weapp')
      const updatedPageWxml = originalSources
        .get(HMR_PAGE_WXML)!
        .replace('<view class="title">HMR</view>', `<view class="title">${pageTemplateMarker}</view>`)
      await dev.waitFor(
        updateSourceAndWait({
          sourcePath: HMR_PAGE_WXML,
          distPath: HMR_PAGE_WXML_DIST,
          nextSource: updatedPageWxml,
          marker: pageTemplateMarker,
        }),
        'page template hmr marker emitted',
      )
      await waitForIdeRecompileSettled()
      let page = await relaunchIdeRoute('/pages/hmr/index', pageTemplateMarker, ctx)
      expect(await waitForPageWxmlContains(page, pageTemplateMarker)).toContain(pageTemplateMarker)

      const pageScriptMarker = createHmrMarker('IDE-CORE-PAGE-SCRIPT', 'weapp')
      const updatedPageScript = originalSources
        .get(HMR_PAGE_SCRIPT)!
        .replace(`buildResult('hmr',`, `buildResult('${pageScriptMarker}',`)
      await dev.waitFor(
        updateSourceAndWait({
          sourcePath: HMR_PAGE_SCRIPT,
          distPath: HMR_PAGE_JS_DIST,
          nextSource: updatedPageScript,
          marker: pageScriptMarker,
        }),
        'page script hmr marker emitted',
      )
      await waitForIdeRecompileSettled()
      page = await relaunchIdeRoute('/pages/hmr/index', pageTemplateMarker, ctx)
      const pageScriptResult = await page.callMethod('runE2E')
      expect(pageScriptResult?.name).toBe(pageScriptMarker)
      expect(pageScriptResult?.ok).toBe(true)
      expect(await page.data('__e2eText')).toContain(pageScriptMarker)

      const pageStyleMarker = createHmrMarker('IDE-CORE-PAGE-STYLE', 'weapp')
      const updatedPageStyle = originalSources
        .get(HMR_PAGE_STYLE)!
        .replace('.page {', `.page {\n  --hmr-marker: '${pageStyleMarker}';`)
      const pageStyleOutput = await dev.waitFor(
        updateSourceAndWait({
          sourcePath: HMR_PAGE_STYLE,
          distPath: HMR_PAGE_WXSS_DIST,
          nextSource: updatedPageStyle,
          marker: pageStyleMarker,
        }),
        'page style hmr marker emitted',
      )
      expect(pageStyleOutput).toContain(pageStyleMarker)
      await waitForIdeRecompileSettled()
      page = await relaunchIdeRoute('/pages/hmr/index', pageTemplateMarker, ctx)
      expect((await page.callMethod('runE2E'))?.ok).toBe(true)

      const sfcTemplateMarker = createHmrMarker('IDE-CORE-SFC-TEMPLATE', 'weapp')
      const updatedSfcTemplate = replaceHmrSfcTitle(
        originalSources.get(HMR_SFC_PATH)!,
        sfcTemplateMarker,
      )
      await dev.waitFor(
        updateSourceAndWait({
          sourcePath: HMR_SFC_PATH,
          distPath: HMR_SFC_WXML_DIST,
          nextSource: updatedSfcTemplate,
          marker: sfcTemplateMarker,
        }),
        'sfc template hmr marker emitted',
      )
      await waitForIdeRecompileSettled()
      page = await relaunchIdeRoute('/pages/hmr-sfc/index', sfcTemplateMarker, ctx)
      expect(await waitForPageWxmlContains(page, sfcTemplateMarker)).toContain(sfcTemplateMarker)

      const sfcScriptMarker = createHmrMarker('IDE-CORE-SFC-SCRIPT', 'weapp')
      const updatedSfcScript = updatedSfcTemplate
        .replace(`marker: 'HMR-SFC-SCRIPT'`, `marker: '${sfcScriptMarker}'`)
      await dev.waitFor(
        updateSourceAndWait({
          sourcePath: HMR_SFC_PATH,
          distPath: HMR_SFC_JS_DIST,
          nextSource: updatedSfcScript,
          marker: sfcScriptMarker,
        }),
        'sfc script hmr marker emitted',
      )
      await waitForIdeRecompileSettled()
      page = await relaunchIdeRoute('/pages/hmr-sfc/index', sfcTemplateMarker, ctx)
      expect(await waitForPageWxmlContains(page, sfcScriptMarker)).toContain(sfcScriptMarker)
      expect(await page.data('marker')).toBe(sfcScriptMarker)

      const sfcStyleMarker = createHmrMarker('IDE-CORE-SFC-STYLE', 'weapp')
      const updatedSfcStyle = updatedSfcScript
        .replace('.marker {', `.marker {\n  --hmr-marker: '${sfcStyleMarker}';`)
      const sfcStyleOutput = await dev.waitFor(
        updateSourceAndWait({
          sourcePath: HMR_SFC_PATH,
          distPath: HMR_SFC_WXSS_DIST,
          nextSource: updatedSfcStyle,
          marker: sfcStyleMarker,
        }),
        'sfc style hmr marker emitted',
      )
      expect(sfcStyleOutput).toContain(sfcStyleMarker)
      await waitForIdeRecompileSettled()
      page = await relaunchIdeRoute('/pages/hmr-sfc/index', sfcTemplateMarker, ctx)
      expect(await page.data('marker')).toBe(sfcScriptMarker)

      const layoutPageTemplateMarker = createHmrMarker('IDE-CORE-LAYOUT-PAGE-TEMPLATE', 'weapp')
      const updatedLayoutPageWxml = originalSources
        .get(LAYOUT_PAGE_WXML)!
        .replace('LAYOUTS-PAGE-TEMPLATE-BASE', layoutPageTemplateMarker)
      await dev.waitFor(
        updateSourceAndWait({
          sourcePath: LAYOUT_PAGE_WXML,
          distPath: LAYOUT_PAGE_WXML_DIST,
          nextSource: updatedLayoutPageWxml,
          marker: layoutPageTemplateMarker,
        }),
        'layout page template hmr marker emitted',
      )
      await waitForIdeRecompileSettled()
      page = await relaunchIdeRoute('/pages/layouts/index', layoutPageTemplateMarker, ctx)
      expect(await waitForPageWxmlContains(page, layoutPageTemplateMarker)).toContain(layoutPageTemplateMarker)

      const layoutPageScriptMarker = createHmrMarker('IDE-CORE-LAYOUT-PAGE-SCRIPT', 'weapp')
      const updatedLayoutPageScript = originalSources
        .get(LAYOUT_PAGE_SCRIPT)!
        .replace(`scriptMarker: 'LAYOUTS-PAGE-SCRIPT-BASE'`, `scriptMarker: '${layoutPageScriptMarker}'`)
      await dev.waitFor(
        updateSourceAndWait({
          sourcePath: LAYOUT_PAGE_SCRIPT,
          distPath: LAYOUT_PAGE_JS_DIST,
          nextSource: updatedLayoutPageScript,
          marker: layoutPageScriptMarker,
        }),
        'layout page script hmr marker emitted',
      )
      await waitForIdeRecompileSettled()
      page = await relaunchIdeRoute('/pages/layouts/index', layoutPageTemplateMarker, ctx)
      expect(await waitForPageWxmlContains(page, layoutPageScriptMarker)).toContain(layoutPageScriptMarker)

      const layoutPageStyleMarker = createHmrMarker('IDE-CORE-LAYOUT-PAGE-STYLE', 'weapp')
      const updatedLayoutPageStyle = originalSources
        .get(LAYOUT_PAGE_STYLE)!
        .replace(`'LAYOUTS-PAGE-STYLE-BASE'`, `'${layoutPageStyleMarker}'`)
      const layoutPageStyleOutput = await dev.waitFor(
        updateSourceAndWait({
          sourcePath: LAYOUT_PAGE_STYLE,
          distPath: LAYOUT_PAGE_WXSS_DIST,
          nextSource: updatedLayoutPageStyle,
          marker: layoutPageStyleMarker,
        }),
        'layout page style hmr marker emitted',
      )
      expect(layoutPageStyleOutput).toContain(layoutPageStyleMarker)
      await waitForIdeRecompileSettled()
      page = await relaunchIdeRoute('/pages/layouts/index', layoutPageTemplateMarker, ctx)
      expect(await waitForPageWxmlContains(page, layoutPageScriptMarker)).toContain(layoutPageScriptMarker)
    }
    finally {
      await closeMiniProgram()
      await dev.stop(5_000)
      for (const [filePath, source] of originalSources) {
        await fs.writeFile(filePath, source, 'utf8')
      }
      await cleanupResidualIdeProcesses()
    }
  })
})
