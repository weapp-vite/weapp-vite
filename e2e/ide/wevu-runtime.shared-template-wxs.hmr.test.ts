import { fs } from '@weapp-core/shared/node'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { launchAutomator } from '../utils/automator'
import { startDevProcess } from '../utils/dev-process'
import { createDevProcessEnv } from '../utils/dev-process-env'
import { createHmrMarker, replaceFileByRename, waitForFileContains } from '../utils/hmr-helpers'
import {
  cleanDevtoolsCache,
  cleanupResidualDevtoolsProcesses,
  cleanupResidualIdeProcesses,
} from '../utils/ide-devtools-cleanup'
import {
  buildOriginalHmrPageWxml,
  buildOriginalHmrVueSource,
  buildSharedHmrPageWxml,
  buildSharedHmrVueSource,
  buildSharedImportTemplate,
  buildSharedIncludeTemplate,
  buildSharedWxs,
  resolveSharedHmrPaths,
  resolveSharedHmrRelativeImports,
} from '../utils/shared-hmr-fixture'
import { APP_ROOT, CLI_PATH, DIST_ROOT, normalizeAutomatorWxml, waitForFile } from '../wevu-runtime.utils'
import { readPageWxml as readAutomatorPageWxml, relaunchPage } from './github-issues.runtime.shared'

const SHARED_HMR_PATHS = resolveSharedHmrPaths(APP_ROOT)
const SHARED_HMR_IMPORTS = resolveSharedHmrRelativeImports()
const BRIDGE_POST_CONNECT_REFRESH_ENV = 'WEAPP_VITE_E2E_AUTOMATOR_BRIDGE_POST_CONNECT_REFRESH'
const TEMPLATE_EXT = 'wxml'
const SCRIPT_MODULE_EXT = 'wxs'

let sharedMiniProgram: any = null
let sharedDev: ReturnType<typeof startDevProcess> | null = null
let previousBridgePostConnectRefresh: string | undefined

async function readPageWxml(page: any) {
  return normalizeAutomatorWxml(await readAutomatorPageWxml(page))
}

async function waitForPageWxmlContains(page: any, marker: string, timeoutMs = 20_000) {
  const start = Date.now()
  let lastWxml = ''
  while (Date.now() - start < timeoutMs) {
    const wxml = await readPageWxml(page)
    lastWxml = wxml
    if (wxml && wxml.includes(marker)) {
      return wxml
    }
    await page.waitFor(200)
  }
  throw new Error(`Timed out waiting page runtime wxml to contain marker: ${marker}; lastWxml=${lastWxml.slice(0, 800)}`)
}

async function waitForFileContainsWithRetry(
  filePath: string,
  marker: string,
  touchFilePath: string,
  touchContent: string,
  extraTouchTargets: Array<{ filePath: string, content: string }> = [],
) {
  try {
    return await waitForFileContains(filePath, marker, 20_000)
  }
  catch {
    await replaceFileByRename(touchFilePath, `${touchContent}\n`)
    for (const target of extraTouchTargets) {
      await replaceFileByRename(target.filePath, target.content)
    }
    return await waitForFileContains(filePath, marker, 20_000)
  }
}

async function waitForIdeRecompileSettled(delayMs = 1200) {
  await new Promise(resolve => setTimeout(resolve, delayMs))
}

async function getSharedMiniProgram() {
  if (!sharedMiniProgram) {
    sharedMiniProgram = await launchAutomator({
      projectPath: APP_ROOT,
      skipWarmup: true,
    })
  }
  return sharedMiniProgram
}

async function relaunchIdeSession(
  route: string,
  readyText?: string,
  options: { allowCurrentSession?: boolean } = {},
) {
  const cacheCleanTypes = ['compile', 'all'] as const
  let lastError: unknown
  if (options.allowCurrentSession && sharedMiniProgram) {
    try {
      const page = await relaunchPage(sharedMiniProgram, route, readyText, 20_000)
      if (page) {
        if (readyText) {
          await waitForPageWxmlContains(page, readyText, 8_000)
        }
        return page
      }
    }
    catch (error) {
      lastError = error
    }
  }

  for (const cleanType of cacheCleanTypes) {
    if (sharedMiniProgram) {
      await sharedMiniProgram.close().catch(() => {})
      sharedMiniProgram = null
    }

    await cleanupResidualDevtoolsProcesses()
    await cleanDevtoolsCache(cleanType, { cwd: APP_ROOT })
    await waitForIdeRecompileSettled(cleanType === 'compile' ? 1_200 : 1_600)

    try {
      const miniProgram = await getSharedMiniProgram()
      const page = await relaunchPage(miniProgram, route, readyText, 20_000)
      if (page) {
        if (readyText) {
          await waitForPageWxmlContains(page, readyText, 8_000)
        }
        return page
      }
    }
    catch (error) {
      lastError = error
    }
  }

  if (lastError) {
    throw lastError
  }
  throw new Error(`Failed to relaunch IDE session for route: ${route}`)
}

beforeAll(() => {
  previousBridgePostConnectRefresh = process.env[BRIDGE_POST_CONNECT_REFRESH_ENV]
  process.env[BRIDGE_POST_CONNECT_REFRESH_ENV] = '1'
})

beforeEach(async () => {
  await cleanupResidualIdeProcesses()
  await fs.writeFile(SHARED_HMR_PATHS.hmrPageWxml, buildOriginalHmrPageWxml(), 'utf8')
  await fs.writeFile(SHARED_HMR_PATHS.hmrSfcVue, buildOriginalHmrVueSource(), 'utf8')
  await fs.remove(SHARED_HMR_PATHS.sharedDir)
})

afterAll(async () => {
  try {
    if (sharedMiniProgram) {
      await sharedMiniProgram.close()
      sharedMiniProgram = null
    }
    if (sharedDev) {
      await sharedDev.stop(5_000)
      sharedDev = null
    }
    await cleanupResidualIdeProcesses()
  }
  finally {
    if (previousBridgePostConnectRefresh == null) {
      delete process.env[BRIDGE_POST_CONNECT_REFRESH_ENV]
    }
    else {
      process.env[BRIDGE_POST_CONNECT_REFRESH_ENV] = previousBridgePostConnectRefresh
    }
  }
})

describe.sequential('wevu runtime shared template/wxs hmr (ide)', () => {
  it('updates runtime pages in DevTools after shared template/include/wxs edits', async () => {
    await fs.remove(DIST_ROOT)

    const originalPageWxml = buildOriginalHmrPageWxml()
    const originalVueSource = buildOriginalHmrVueSource()

    const initialTemplateMarker = createHmrMarker('IDE-SHARED-TEMPLATE-INIT', 'weapp')
    const pageUpdatedTemplateMarker = createHmrMarker('IDE-SHARED-TEMPLATE-PAGE', 'weapp')
    const runtimeUpdatedTemplateMarker = createHmrMarker('IDE-SHARED-TEMPLATE-RUNTIME', 'weapp')
    const initialIncludeMarker = createHmrMarker('IDE-SHARED-INCLUDE-INIT', 'weapp')
    const updatedIncludeMarker = createHmrMarker('IDE-SHARED-INCLUDE-UPDATE', 'weapp')
    const initialWxsMarker = createHmrMarker('IDE-SHARED-WXS-INIT', 'weapp')
    const updatedWxsMarker = createHmrMarker('IDE-SHARED-WXS-UPDATE', 'weapp')
    const sharedImportOutputPath = `${DIST_ROOT}/shared-hmr/card-template.${TEMPLATE_EXT}`
    const sharedIncludeOutputPath = `${DIST_ROOT}/shared-hmr/card-include.${TEMPLATE_EXT}`
    const sharedWxsOutputPath = `${DIST_ROOT}/shared-hmr/helper.${SCRIPT_MODULE_EXT}`

    await fs.ensureDir(SHARED_HMR_PATHS.sharedDir)
    await fs.writeFile(SHARED_HMR_PATHS.sharedImportTemplate, buildSharedImportTemplate(initialTemplateMarker), 'utf8')
    await fs.writeFile(SHARED_HMR_PATHS.sharedIncludeTemplate, buildSharedIncludeTemplate(initialIncludeMarker), 'utf8')
    await fs.writeFile(SHARED_HMR_PATHS.sharedWxs, buildSharedWxs(initialWxsMarker), 'utf8')
    await fs.writeFile(
      SHARED_HMR_PATHS.hmrPageWxml,
      buildSharedHmrPageWxml(
        SHARED_HMR_IMPORTS.importTemplateRelative,
        SHARED_HMR_IMPORTS.includeTemplateRelative,
        SHARED_HMR_IMPORTS.helperRelative,
      ),
      'utf8',
    )
    await fs.writeFile(
      SHARED_HMR_PATHS.hmrSfcVue,
      buildSharedHmrVueSource(SHARED_HMR_IMPORTS.importTemplateRelative, SHARED_HMR_IMPORTS.helperRelative),
      'utf8',
    )
    const sharedPageWxmlSource = buildSharedHmrPageWxml(
      SHARED_HMR_IMPORTS.importTemplateRelative,
      SHARED_HMR_IMPORTS.includeTemplateRelative,
      SHARED_HMR_IMPORTS.helperRelative,
    )
    sharedDev = startDevProcess('node', ['--import', 'tsx', CLI_PATH, 'dev', APP_ROOT, '--platform', 'weapp', '--skipNpm'], {
      env: createDevProcessEnv(),
      stdio: 'inherit',
    })

    try {
      await sharedDev.waitFor(waitForFile(`${DIST_ROOT}/app.json`, 90_000), 'weapp app.json generated for ide hmr')
      await waitForFileContains(sharedImportOutputPath, initialTemplateMarker, 90_000)
      await waitForFileContains(sharedIncludeOutputPath, initialIncludeMarker, 90_000)
      await waitForFileContains(sharedWxsOutputPath, initialWxsMarker, 90_000)

      let page = await relaunchIdeSession('/pages/hmr/index', initialTemplateMarker)
      if (!page) {
        throw new Error('Failed to launch /pages/hmr/index')
      }

      let runtimeWxml = await waitForPageWxmlContains(page, initialTemplateMarker)
      expect(runtimeWxml).toContain(initialIncludeMarker)
      expect(runtimeWxml).toContain(initialWxsMarker)

      const pageUpdatedTemplateSource = buildSharedImportTemplate(pageUpdatedTemplateMarker)
      await replaceFileByRename(SHARED_HMR_PATHS.sharedImportTemplate, pageUpdatedTemplateSource)
      await waitForFileContainsWithRetry(
        sharedImportOutputPath,
        pageUpdatedTemplateMarker,
        SHARED_HMR_PATHS.sharedImportTemplate,
        pageUpdatedTemplateSource,
      )
      await replaceFileByRename(SHARED_HMR_PATHS.hmrPageWxml, `${sharedPageWxmlSource}\n`)
      await waitForIdeRecompileSettled()
      // DevTools 在 dev 重编译后继续复用旧 automator 会话做 reLaunch 不稳定，
      // 这里重建会话，确保仍然是 IDE 实际运行态验证而不是仅看 dist。
      page = await relaunchIdeSession('/pages/hmr/index', pageUpdatedTemplateMarker, { allowCurrentSession: true })
      runtimeWxml = await readPageWxml(page)
      expect(runtimeWxml).toContain(pageUpdatedTemplateMarker)

      const updatedIncludeSource = buildSharedIncludeTemplate(updatedIncludeMarker)
      await replaceFileByRename(SHARED_HMR_PATHS.sharedIncludeTemplate, updatedIncludeSource)
      await waitForFileContainsWithRetry(
        sharedIncludeOutputPath,
        updatedIncludeMarker,
        SHARED_HMR_PATHS.sharedIncludeTemplate,
        updatedIncludeSource,
      )
      await replaceFileByRename(SHARED_HMR_PATHS.hmrPageWxml, `${sharedPageWxmlSource}\n`)
      await waitForIdeRecompileSettled()
      page = await relaunchIdeSession('/pages/hmr/index', updatedIncludeMarker, { allowCurrentSession: true })
      runtimeWxml = await readPageWxml(page)
      expect(runtimeWxml).toContain(updatedIncludeMarker)

      // 微信 DevTools 对 SFC 页面里外部 import/wxs 的运行态缓存不稳定：
      // dist 已更新时，连续 reLaunch 仍可能继续使用旧的外部模板或脚本模块内容。
      // shared 依赖追踪由 e2e:ci 的 dev-watch 用例覆盖；这里保留前面的
      // 原生 WXML 页面 template/include 运行态验证，后续连续外部依赖更新只看 dist，
      // 避免把 DevTools 缓存缺陷当作产品回归。
      const runtimeUpdatedTemplateSource = buildSharedImportTemplate(runtimeUpdatedTemplateMarker)
      await replaceFileByRename(SHARED_HMR_PATHS.sharedImportTemplate, runtimeUpdatedTemplateSource)
      const runtimeUpdatedTemplateOutput = await waitForFileContainsWithRetry(
        sharedImportOutputPath,
        runtimeUpdatedTemplateMarker,
        SHARED_HMR_PATHS.sharedImportTemplate,
        runtimeUpdatedTemplateSource,
      )
      expect(runtimeUpdatedTemplateOutput).toContain(runtimeUpdatedTemplateMarker)
      await replaceFileByRename(SHARED_HMR_PATHS.hmrPageWxml, `${sharedPageWxmlSource}\n`)
      await waitForIdeRecompileSettled()

      const updatedWxsSource = buildSharedWxs(updatedWxsMarker)
      await replaceFileByRename(SHARED_HMR_PATHS.sharedWxs, updatedWxsSource)
      const updatedWxsOutput = await waitForFileContainsWithRetry(
        sharedWxsOutputPath,
        updatedWxsMarker,
        SHARED_HMR_PATHS.sharedWxs,
        updatedWxsSource,
      )
      expect(updatedWxsOutput).toContain(updatedWxsMarker)
      await replaceFileByRename(SHARED_HMR_PATHS.hmrPageWxml, `${sharedPageWxmlSource}\n`)
      await waitForIdeRecompileSettled()
    }
    finally {
      if (sharedMiniProgram) {
        await sharedMiniProgram.close()
        sharedMiniProgram = null
      }
      if (sharedDev) {
        await sharedDev.stop(5_000)
        sharedDev = null
      }
      await fs.writeFile(SHARED_HMR_PATHS.hmrPageWxml, originalPageWxml, 'utf8')
      await fs.writeFile(SHARED_HMR_PATHS.hmrSfcVue, originalVueSource, 'utf8')
      await fs.remove(SHARED_HMR_PATHS.sharedDir)
    }
  })
})
