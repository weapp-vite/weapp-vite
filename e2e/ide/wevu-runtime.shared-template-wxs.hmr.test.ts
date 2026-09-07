import type { DomCheckpoint } from '../utils/domAcceptance/types'
import { fs } from '@weapp-core/shared/node'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { launchAutomator } from '../utils/automator'
import { startDevProcess } from '../utils/dev-process'
import { createDevProcessEnv } from '../utils/dev-process-env'
import { createDomAcceptance } from '../utils/domAcceptance'
import { createHmrMarker, replaceFileByRename, waitForFileContains } from '../utils/hmr-helpers'
import { cleanupResidualIdeProcesses } from '../utils/ide-devtools-cleanup'
import {
  buildSharedHmrPageWxml,
  buildSharedHmrVueSource,
  buildSharedWxs,
  resolveSharedHmrPaths,
  resolveSharedHmrRelativeImports,
} from '../utils/shared-hmr-fixture'
import { APP_ROOT, CLI_PATH, DIST_ROOT, waitForFile, waitForVendorFileContains } from '../wevu-runtime.utils'
import { CLASSIC_WXS_RELOAD_CHECKPOINT, waitForClassicWxsReload } from './wevuRuntimeDom/classicWxs'

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

async function relaunchIdeSession(route: string) {
  const miniProgram = await getSharedMiniProgram()
  const page = await miniProgram.reLaunch(route)
  if (!page) {
    throw new Error(`Failed to navigate the shared IDE session to route: ${route}`)
  }
  await waitForHmrPageReady(page)
  return page
}

beforeAll(() => {
  previousBridgePostConnectRefresh = process.env[BRIDGE_POST_CONNECT_REFRESH_ENV]
  process.env[BRIDGE_POST_CONNECT_REFRESH_ENV] = '1'
})

beforeEach(async () => {
  await cleanupResidualIdeProcesses()
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

describe('wevu runtime shared template/wxs hmr (ide)', { concurrent: false }, () => {
  it('updates runtime pages in DevTools after shared template/include/wxs edits', async (context) => {
    await fs.remove(DIST_ROOT)

    const originalPageWxml = await fs.readFile(SHARED_HMR_PATHS.hmrPageWxml, 'utf8')
    const originalVueSource = await fs.readFile(SHARED_HMR_PATHS.hmrSfcVue, 'utf8')

    const initialTemplateMarker = createHmrMarker('IDE-SHARED-TEMPLATE-INIT', 'weapp')
    const pageUpdatedTemplateMarker = createHmrMarker('IDE-SHARED-TEMPLATE-PAGE', 'weapp')
    const runtimeUpdatedTemplateMarker = createHmrMarker('IDE-SHARED-TEMPLATE-RUNTIME', 'weapp')
    const initialIncludeMarker = createHmrMarker('IDE-SHARED-INCLUDE-INIT', 'weapp')
    const updatedIncludeMarker = createHmrMarker('IDE-SHARED-INCLUDE-UPDATE', 'weapp')
    const initialWxsMarker = createHmrMarker('IDE-SHARED-WXS-INIT', 'weapp')
    const updatedWxsMarker = createHmrMarker('IDE-SHARED-WXS-UPDATE', 'weapp')
    const stages = [
      { route: '/pages/hmr/index', title: 'HMR', template: initialTemplateMarker, include: initialIncludeMarker, wxs: initialWxsMarker },
      { route: '/pages/hmr/index', title: 'HMR', template: initialTemplateMarker, include: initialIncludeMarker, wxs: initialWxsMarker },
      { route: '/pages/hmr/index', title: 'HMR', template: pageUpdatedTemplateMarker, include: initialIncludeMarker, wxs: initialWxsMarker },
      { route: '/pages/hmr/index', title: 'HMR', template: pageUpdatedTemplateMarker, include: updatedIncludeMarker, wxs: initialWxsMarker },
      { route: '/pages/hmr-sfc/index', title: 'HMR-SFC', template: pageUpdatedTemplateMarker, wxs: initialWxsMarker },
      { route: '/pages/hmr-sfc/index', title: 'HMR-SFC', template: runtimeUpdatedTemplateMarker, wxs: initialWxsMarker },
      { route: '/pages/hmr-sfc/index', title: 'HMR-SFC', template: runtimeUpdatedTemplateMarker, wxs: updatedWxsMarker },
    ]
    const checkpoints: DomCheckpoint[] = stages.map((stage, index) => ({
      id: `shared:${index}`,
      route: stage.route,
      action: index === 6
        ? 'classic WXS 全量刷新后重新进入 SFC 页面，验收重新求值后的 WXS 文本'
        : `共享模板阶段 ${index}：当前页面的 template/include/WXS 实际文本，模板更新不重新导航`,
      nodes: [
        { selector: '.title', text: stage.title },
        { selector: '.shared-template', text: `${stage.template}: ${stage.wxs}` },
        ...(stage.include ? [{ selector: '.shared-include', text: stage.include }] : [{ selector: '.marker', text: 'HMR-SFC-SCRIPT' }]),
        ...(stage.include ? [{ selector: '#shared-hmr-count', text: `count: ${index === 0 ? 0 : 1}` }] : []),
      ],
    }))
    checkpoints.splice(6, 0, CLASSIC_WXS_RELOAD_CHECKPOINT)
    const dom = createDomAcceptance(context, 'e2e-apps/wevu-runtime-e2e', checkpoints)
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
      ).replace('<view class="title">HMR</view>', '<view class="title">HMR</view><view id="shared-hmr-count">count: {{count}}</view>'),
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
    ).replace('<view class="title">HMR</view>', '<view class="title">HMR</view><view id="shared-hmr-count">count: {{count}}</view>')
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
      await dom.check('shared:0', miniProgram, page)
      await page.callMethodWithOptions('increment', { routeOnly: true })
      await dom.check('shared:1', miniProgram, page)

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
      await waitForSharedMarkers(miniProgram, {
        template: pageUpdatedTemplateMarker,
      })
      await dom.check('shared:2', miniProgram, page)

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
      await waitForSharedMarkers(miniProgram, {
        include: updatedIncludeMarker,
      })
      await dom.check('shared:3', miniProgram, page)

      page = await miniProgram.reLaunch('/pages/hmr-sfc/index')
      if (!page) {
        throw new Error('Failed to launch /pages/hmr-sfc/index')
      }
      await dom.check('shared:4', miniProgram, page)
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
      await dom.check('shared:5', miniProgram, page)

      const updatedWxsSource = buildSharedWxs(updatedWxsMarker)
      await replaceFileByRename(SHARED_HMR_PATHS.sharedWxs, updatedWxsSource)
      const updatedWxsOutput = await waitForFileContainsWithRetry(
        sharedWxsOutputPath,
        updatedWxsMarker,
        SHARED_HMR_PATHS.sharedWxs,
        updatedWxsSource,
      )
      expect(updatedWxsOutput).toContain(updatedWxsMarker)
      // classic 的 WXS 更新重启 AppService；这里显式验收刷新，不能按 stateful 状态保持处理。
      await dom.check(CLASSIC_WXS_RELOAD_CHECKPOINT.id, miniProgram, await waitForClassicWxsReload(miniProgram))
      page = await miniProgram.reLaunch('/pages/hmr-sfc/index')
      if (!page) {
        throw new Error('Failed to re-enter /pages/hmr-sfc/index after classic WXS reload')
      }
      await dom.check('shared:6', miniProgram, page)
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
