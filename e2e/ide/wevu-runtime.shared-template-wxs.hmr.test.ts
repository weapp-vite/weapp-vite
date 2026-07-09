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
  buildSharedWxs,
  resolveSharedHmrPaths,
  resolveSharedHmrRelativeImports,
} from '../utils/shared-hmr-fixture'
import { APP_ROOT, CLI_PATH, DIST_ROOT, waitForFile, waitForVendorFileContains } from '../wevu-runtime.utils'

const SHARED_HMR_PATHS = resolveSharedHmrPaths(APP_ROOT)
const SHARED_HMR_IMPORTS = resolveSharedHmrRelativeImports()
const BRIDGE_POST_CONNECT_REFRESH_ENV = 'WEAPP_VITE_E2E_AUTOMATOR_BRIDGE_POST_CONNECT_REFRESH'
const TEMPLATE_EXT = 'wxml'
const SCRIPT_MODULE_EXT = 'wxs'
const COMMON_JS_OUTPUT_PATH = `${DIST_ROOT}/common.js`
const WEVU_RUNTIME_READY_MARKER = '__wevu_runtime'
const SHARED_TEMPLATE_STORAGE_KEY = '__weapp_vite_shared_template_probe__'
const SHARED_INCLUDE_STORAGE_KEY = '__weapp_vite_shared_include_probe__'
const SHARED_WXS_STORAGE_KEY = '__weapp_vite_shared_wxs_probe__'

let sharedMiniProgram: any = null
let sharedDev: ReturnType<typeof startDevProcess> | null = null
let previousBridgePostConnectRefresh: string | undefined

function buildRuntimeSharedImportTemplate(marker: string) {
  return [
    '<template name="hmrSharedCard">',
    `  <e2e-template-probe marker="${marker}" storage-key="${SHARED_TEMPLATE_STORAGE_KEY}" />`,
    `  <e2e-template-probe marker="{{ label }}" storage-key="${SHARED_WXS_STORAGE_KEY}" />`,
    `  <view class="shared-template">${marker}: {{ label }}</view>`,
    '</template>',
    '',
  ].join('\n')
}

function buildRuntimeSharedIncludeTemplate(marker: string) {
  return [
    `<e2e-template-probe marker="${marker}" storage-key="${SHARED_INCLUDE_STORAGE_KEY}" />`,
    `<view class="shared-include">${marker}</view>`,
    '',
  ].join('\n')
}

async function waitForStorageMarker(miniProgram: any, storageKey: string, expected: string, timeoutMs = 20_000) {
  const start = Date.now()
  let lastError: unknown
  let lastState: unknown
  while (Date.now() - start < timeoutMs) {
    try {
      lastState = await miniProgram.callWxMethodWithOptions('getStorageSync', {
        timeout: 5_000,
      }, storageKey)
      lastError = undefined
      if (lastState && typeof lastState === 'object' && (lastState as Record<string, unknown>).marker === expected) {
        return lastState
      }
    }
    catch (error) {
      lastError = error
    }
    await new Promise(resolve => setTimeout(resolve, 220))
  }
  const reason = lastError instanceof Error ? lastError.message : String(lastError ?? 'condition not met')
  throw new Error(`Timed out waiting storage marker: key=${storageKey} expected=${expected}; reason=${reason}; lastState=${JSON.stringify(lastState)}`)
}

async function resetSharedStorageProbes(miniProgram: any) {
  await Promise.all([
    SHARED_TEMPLATE_STORAGE_KEY,
    SHARED_INCLUDE_STORAGE_KEY,
    SHARED_WXS_STORAGE_KEY,
  ].map(storageKey => miniProgram.callWxMethodWithOptions('removeStorageSync', {
    timeout: 2_500,
  }, storageKey).catch(() => {})))
}

async function waitForSharedMarkers(
  miniProgram: any,
  markers: {
    include?: string
    template?: string
    wxs?: string
  },
) {
  if (markers.template) {
    await waitForStorageMarker(miniProgram, SHARED_TEMPLATE_STORAGE_KEY, markers.template)
  }
  if (markers.include) {
    await waitForStorageMarker(miniProgram, SHARED_INCLUDE_STORAGE_KEY, markers.include)
  }
  if (markers.wxs) {
    await waitForStorageMarker(miniProgram, SHARED_WXS_STORAGE_KEY, markers.wxs)
  }
}

async function waitForHmrPageReady(page: any, timeoutMs = 20_000) {
  if (typeof page?.waitForRendered !== 'function') {
    await page.waitFor(timeoutMs)
    return
  }
  await page.waitForRendered({
    selector: '.page',
    timeout: timeoutMs,
  })
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

async function waitForInitialAppserviceReady() {
  await waitForFileContains(COMMON_JS_OUTPUT_PATH, 'useSetupStore', 90_000)
  await waitForVendorFileContains(DIST_ROOT, WEVU_RUNTIME_READY_MARKER, 90_000)
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
  options: { allowCurrentSession?: boolean } = {},
) {
  const cacheCleanTypes = ['compile', 'all'] as const
  let lastError: unknown
  if (options.allowCurrentSession && sharedMiniProgram) {
    try {
      const page = await sharedMiniProgram.reLaunch(route)
      if (page) {
        await waitForHmrPageReady(page)
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
      const page = await miniProgram.reLaunch(route)
      if (page) {
        await waitForHmrPageReady(page)
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
    await fs.writeFile(SHARED_HMR_PATHS.sharedImportTemplate, buildRuntimeSharedImportTemplate(initialTemplateMarker), 'utf8')
    await fs.writeFile(SHARED_HMR_PATHS.sharedIncludeTemplate, buildRuntimeSharedIncludeTemplate(initialIncludeMarker), 'utf8')
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
      await waitForInitialAppserviceReady()

      let miniProgram = await getSharedMiniProgram()
      await resetSharedStorageProbes(miniProgram)
      let page = await relaunchIdeSession('/pages/hmr/index')
      if (!page) {
        throw new Error('Failed to launch /pages/hmr/index')
      }
      miniProgram = await getSharedMiniProgram()

      await waitForSharedMarkers(miniProgram, {
        include: initialIncludeMarker,
        template: initialTemplateMarker,
        wxs: initialWxsMarker,
      })

      const pageUpdatedTemplateSource = buildRuntimeSharedImportTemplate(pageUpdatedTemplateMarker)
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
      await resetSharedStorageProbes(miniProgram)
      page = await relaunchIdeSession('/pages/hmr/index', { allowCurrentSession: true })
      miniProgram = await getSharedMiniProgram()
      await waitForSharedMarkers(miniProgram, {
        template: pageUpdatedTemplateMarker,
      })

      const updatedIncludeSource = buildRuntimeSharedIncludeTemplate(updatedIncludeMarker)
      await replaceFileByRename(SHARED_HMR_PATHS.sharedIncludeTemplate, updatedIncludeSource)
      await waitForFileContainsWithRetry(
        sharedIncludeOutputPath,
        updatedIncludeMarker,
        SHARED_HMR_PATHS.sharedIncludeTemplate,
        updatedIncludeSource,
      )
      await replaceFileByRename(SHARED_HMR_PATHS.hmrPageWxml, `${sharedPageWxmlSource}\n`)
      await waitForIdeRecompileSettled()
      await resetSharedStorageProbes(miniProgram)
      page = await relaunchIdeSession('/pages/hmr/index', { allowCurrentSession: true })
      miniProgram = await getSharedMiniProgram()
      await waitForSharedMarkers(miniProgram, {
        include: updatedIncludeMarker,
      })

      // 微信 DevTools 对 SFC 页面里外部 import/wxs 的运行态缓存不稳定：
      // dist 已更新时，连续 reLaunch 仍可能继续使用旧的外部模板或脚本模块内容。
      // shared 依赖追踪由 e2e:ci 的 dev-watch 用例覆盖；这里保留前面的
      // 原生 WXML 页面 template/include 运行态验证，后续连续外部依赖更新只看 dist，
      // 避免把 DevTools 缓存缺陷当作产品回归。
      const runtimeUpdatedTemplateSource = buildRuntimeSharedImportTemplate(runtimeUpdatedTemplateMarker)
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
