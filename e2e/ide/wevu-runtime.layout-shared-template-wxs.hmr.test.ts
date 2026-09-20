import type { DomCheckpoint } from '../utils/domAcceptance/types'
import { fs } from '@weapp-core/shared/node'
import path from 'pathe'
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest'
import { launchAutomator } from '../utils/automator'
import { startDevProcess } from '../utils/dev-process'
import { createDevProcessEnv } from '../utils/dev-process-env'
import { createDomAcceptance } from '../utils/domAcceptance'
import { createHmrMarker, replaceFileByRename, waitForFileContains } from '../utils/hmr-helpers'
import { captureHmrProbeFailure } from '../utils/hmrProbeFailureDiagnostics'
import { cleanupResidualIdeProcesses } from '../utils/ide-devtools-cleanup'
import { APP_ROOT, CLI_PATH, DIST_ROOT, waitForFile, waitForVendorFileContains } from '../wevu-runtime.utils'
import { CLASSIC_WXS_RELOAD_CHECKPOINT, waitForClassicWxsReload } from './wevuRuntimeDom/classicWxs'

const DEFAULT_LAYOUT_WXML = path.join(APP_ROOT, 'src/layouts/default/index.wxml')
const ADMIN_LAYOUT_WXML = path.join(APP_ROOT, 'src/layouts/admin/index.wxml')
const SHARED_DIR = path.join(APP_ROOT, 'src/shared-layout-hmr')
const SHARED_IMPORT_TEMPLATE = path.join(SHARED_DIR, 'layout-template.wxml')
const SHARED_INCLUDE_TEMPLATE = path.join(SHARED_DIR, 'layout-include.wxml')
const SHARED_WXS = path.join(SHARED_DIR, 'layout-helper.wxs')
const BRIDGE_POST_CONNECT_REFRESH_ENV = 'WEAPP_VITE_E2E_AUTOMATOR_BRIDGE_POST_CONNECT_REFRESH'
const COMMON_JS_OUTPUT_PATH = path.join(DIST_ROOT, 'common.js')
const WEVU_RUNTIME_READY_MARKER = '__wevu_runtime'
const LAYOUT_SHARED_TEMPLATE_STORAGE_KEY = '__weapp_vite_layout_shared_template_probe__'
const LAYOUT_SHARED_INCLUDE_STORAGE_KEY = '__weapp_vite_layout_shared_include_probe__'
const LAYOUT_SHARED_WXS_STORAGE_KEY = '__weapp_vite_layout_shared_wxs_probe__'

let sharedMiniProgram: any = null
let sharedDev: ReturnType<typeof startDevProcess> | null = null
let previousBridgePostConnectRefresh: string | undefined

function buildSharedImportTemplate(marker: string) {
  return [
    '<template name="hmrLayoutCard">',
    `  <e2e-template-probe marker="${marker}" storage-key="${LAYOUT_SHARED_TEMPLATE_STORAGE_KEY}" />`,
    `  <e2e-template-probe marker="{{ label }}" storage-key="${LAYOUT_SHARED_WXS_STORAGE_KEY}" />`,
    `  <view class="layout-shared-template" data-layout-shared-template="${marker}" data-layout-shared-wxs="{{ label }}">${marker}: {{ label }}</view>`,
    '</template>',
    '',
  ].join('\n')
}

function buildSharedIncludeTemplate(marker: string) {
  return [
    `<e2e-template-probe marker="${marker}" storage-key="${LAYOUT_SHARED_INCLUDE_STORAGE_KEY}" />`,
    `<view class="layout-shared-include" data-layout-shared-include="${marker}">${marker}</view>`,
    '',
  ].join('\n')
}

function buildSharedWxs(marker: string) {
  return [
    'module.exports = {',
    '  label: function() {',
    `    return '${marker}'`,
    '  },',
    '}',
    '',
  ].join('\n')
}

function buildOriginalSharedImportTemplate() {
  return buildSharedImportTemplate('LAYOUT-SHARED-TEMPLATE-BASE')
}

function buildOriginalSharedIncludeTemplate() {
  return buildSharedIncludeTemplate('LAYOUT-SHARED-INCLUDE-BASE')
}

function buildOriginalSharedWxs() {
  return buildSharedWxs('LAYOUT-SHARED-WXS-BASE')
}

function buildDefaultLayoutWxml() {
  return [
    '<import src="../../shared-layout-hmr/layout-template.wxml" />',
    '<include src="../../shared-layout-hmr/layout-include.wxml" />',
    '<wxs module="layoutShared" src="../../shared-layout-hmr/layout-helper.wxs" />',
    '<view class="layout-default">',
    '  <text class="layout-default__marker">DEFAULT-LAYOUT-TEMPLATE-BASE</text>',
    '  <template is="hmrLayoutCard" data="{{ label: layoutShared.label() }}" />',
    '  <slot />',
    '</view>',
    '',
  ].join('\n')
}

function buildAdminLayoutWxml() {
  return [
    '<import src="../../shared-layout-hmr/layout-template.wxml" />',
    '<wxs module="layoutShared" src="../../shared-layout-hmr/layout-helper.wxs" />',
    '<view class="layout-admin">',
    '  <view class="layout-admin__hero">',
    '    <text class="layout-admin__eyebrow">ADMIN-LAYOUT-TEMPLATE-BASE</text>',
    '    <template is="hmrLayoutCard" data="{{ label: layoutShared.label() }}" />',
    '    <text class="layout-admin__title">{{title || \'admin layout title\'}}</text>',
    '    <text class="layout-admin__subtitle">{{subtitle || \'admin layout subtitle\'}}</text>',
    '  </view>',
    '  <view class="layout-admin__body">',
    '    <slot />',
    '  </view>',
    '</view>',
    '',
  ].join('\n')
}

async function restoreOriginalSharedFiles() {
  await fs.ensureDir(SHARED_DIR)
  await fs.writeFile(SHARED_IMPORT_TEMPLATE, buildOriginalSharedImportTemplate(), 'utf8')
  await fs.writeFile(SHARED_INCLUDE_TEMPLATE, buildOriginalSharedIncludeTemplate(), 'utf8')
  await fs.writeFile(SHARED_WXS, buildOriginalSharedWxs(), 'utf8')
}

async function waitForLayoutPageReady(page: any, timeoutMs = 20_000) {
  if (typeof page?.waitForRendered !== 'function') {
    await page.waitFor(timeoutMs)
    return
  }
  await page.waitForRendered({
    componentSelectors: ['weapp-layout-default', 'weapp-layout-admin'],
    selector: '.page',
    timeout: timeoutMs,
  })
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
  await captureHmrProbeFailure({
    miniProgram,
    route: '/pages/layouts/index',
    storageKey,
    expected,
    files: {
      distRoot: DIST_ROOT,
      relativePaths: ['shared-layout-hmr/layout-template.wxml', 'shared-layout-hmr/layout-include.wxml', 'shared-layout-hmr/layout-helper.wxs'],
    },
  })
  throw new Error(`Timed out waiting storage marker: key=${storageKey} expected=${expected}; reason=${reason}; lastState=${JSON.stringify(lastState)}`)
}

async function resetLayoutStorageProbes(miniProgram: any) {
  await Promise.all([
    LAYOUT_SHARED_TEMPLATE_STORAGE_KEY,
    LAYOUT_SHARED_INCLUDE_STORAGE_KEY,
    LAYOUT_SHARED_WXS_STORAGE_KEY,
  ].map(storageKey => miniProgram.callWxMethodWithOptions('removeStorageSync', {
    timeout: 2_500,
  }, storageKey).catch(() => {})))
}

async function waitForLayoutSharedMarkers(
  miniProgram: any,
  markers: {
    include?: string
    template?: string
    wxs?: string
  },
) {
  if (markers.template) {
    await waitForStorageMarker(miniProgram, LAYOUT_SHARED_TEMPLATE_STORAGE_KEY, markers.template)
  }
  if (markers.include) {
    await waitForStorageMarker(miniProgram, LAYOUT_SHARED_INCLUDE_STORAGE_KEY, markers.include)
  }
  if (markers.wxs) {
    await waitForStorageMarker(miniProgram, LAYOUT_SHARED_WXS_STORAGE_KEY, markers.wxs)
  }
}

async function waitForFileContainsWithRetry(
  filePath: string,
  marker: string,
  touchFilePath: string,
  touchContent: string,
) {
  try {
    return await waitForFileContains(filePath, marker, 20_000)
  }
  catch {
    await replaceFileByRename(touchFilePath, `${touchContent}\n`)
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
      bridgeProjectMode: 'direct',
      projectPath: APP_ROOT,
      retryWarmupTimeout: true,
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
  await waitForLayoutPageReady(page)
  return page
}

beforeAll(() => {
  previousBridgePostConnectRefresh = process.env[BRIDGE_POST_CONNECT_REFRESH_ENV]
  process.env[BRIDGE_POST_CONNECT_REFRESH_ENV] = '1'
})

beforeEach(async () => {
  await cleanupResidualIdeProcesses()
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

describe('wevu runtime layout shared template/wxs hmr (ide)', { concurrent: false }, () => {
  it('updates layout runtime output in DevTools after shared template/include/wxs edits', async (context) => {
    await fs.remove(DIST_ROOT)

    const originalDefaultLayout = await fs.readFile(DEFAULT_LAYOUT_WXML, 'utf8')
    const originalAdminLayout = await fs.readFile(ADMIN_LAYOUT_WXML, 'utf8')

    const initialTemplateMarker = createHmrMarker('IDE-LAYOUT-SHARED-TEMPLATE-INIT', 'weapp')
    const updatedTemplateMarker = createHmrMarker('IDE-LAYOUT-SHARED-TEMPLATE-UPDATE', 'weapp')
    const initialIncludeMarker = createHmrMarker('IDE-LAYOUT-SHARED-INCLUDE-INIT', 'weapp')
    const updatedIncludeMarker = createHmrMarker('IDE-LAYOUT-SHARED-INCLUDE-UPDATE', 'weapp')
    const initialWxsMarker = createHmrMarker('IDE-LAYOUT-SHARED-WXS-INIT', 'weapp')
    const updatedWxsMarker = createHmrMarker('IDE-LAYOUT-SHARED-WXS-UPDATE', 'weapp')
    const stages = [
      { layout: 'default', template: initialTemplateMarker, include: initialIncludeMarker, wxs: initialWxsMarker },
      { layout: 'default', template: updatedTemplateMarker, include: initialIncludeMarker, wxs: initialWxsMarker },
      { layout: 'default', template: updatedTemplateMarker, include: updatedIncludeMarker, wxs: initialWxsMarker },
      { layout: 'admin', template: updatedTemplateMarker, wxs: initialWxsMarker },
      { layout: 'default', template: updatedTemplateMarker, include: updatedIncludeMarker, wxs: updatedWxsMarker },
      { layout: 'admin', template: updatedTemplateMarker, wxs: updatedWxsMarker },
    ]
    const checkpoints: DomCheckpoint[] = stages.map((stage, index) => ({
      id: `layout-shared:${index}`,
      route: '/pages/layouts/index',
      action: index === 4
        ? 'classic WXS 全量刷新后重新进入 layouts 页面，验收默认布局及新的 WXS 文本'
        : index === 5
          ? '刷新后显式重新切换 admin 布局，验收新的 WXS 文本'
          : `共享布局阶段 ${index}：模板、include、WXS 结果与当前布局，模板更新不重新导航`,
      nodes: [
        { selector: '#layout-current', text: `current: ${stage.layout}` },
        { selector: '.layout-shared-template', scope: [{ has: `.layout-${stage.layout}` }], text: `${stage.template}: ${stage.wxs}` },
        ...(stage.include ? [{ selector: '.layout-shared-include', scope: [{ has: `.layout-${stage.layout}` }], text: stage.include }] : []),
        { selector: '.card__title', count: 3 },
      ],
    }))
    checkpoints.splice(4, 0, CLASSIC_WXS_RELOAD_CHECKPOINT)
    const dom = createDomAcceptance(context, 'e2e-apps/wevu-runtime-e2e', checkpoints)

    await fs.ensureDir(SHARED_DIR)
    await fs.writeFile(SHARED_IMPORT_TEMPLATE, buildSharedImportTemplate(initialTemplateMarker), 'utf8')
    await fs.writeFile(SHARED_INCLUDE_TEMPLATE, buildSharedIncludeTemplate(initialIncludeMarker), 'utf8')
    await fs.writeFile(SHARED_WXS, buildSharedWxs(initialWxsMarker), 'utf8')
    await fs.writeFile(DEFAULT_LAYOUT_WXML, buildDefaultLayoutWxml(), 'utf8')
    await fs.writeFile(ADMIN_LAYOUT_WXML, buildAdminLayoutWxml(), 'utf8')

    const sharedImportOutput = path.join(DIST_ROOT, 'shared-layout-hmr/layout-template.wxml')
    const sharedIncludeOutput = path.join(DIST_ROOT, 'shared-layout-hmr/layout-include.wxml')
    const sharedWxsOutput = path.join(DIST_ROOT, 'shared-layout-hmr/layout-helper.wxs')

    sharedDev = startDevProcess('node', ['--import', 'tsx', CLI_PATH, 'dev', APP_ROOT, '--platform', 'weapp', '--skipNpm'], {
      env: createDevProcessEnv(),
      stdio: 'inherit',
    })

    try {
      await sharedDev.waitFor(waitForFile(path.join(DIST_ROOT, 'app.json'), 90_000), 'weapp app.json generated for layout ide hmr')
      await waitForFileContains(sharedImportOutput, initialTemplateMarker, 90_000)
      await waitForFileContains(sharedIncludeOutput, initialIncludeMarker, 90_000)
      await waitForFileContains(sharedWxsOutput, initialWxsMarker, 90_000)
      await waitForInitialAppserviceReady()

      let miniProgram = await getSharedMiniProgram()
      await resetLayoutStorageProbes(miniProgram)
      let page = await relaunchIdeSession('/pages/layouts/index')
      if (!page) {
        throw new Error('Failed to launch /pages/layouts/index')
      }
      miniProgram = await getSharedMiniProgram()

      await waitForLayoutSharedMarkers(miniProgram, {
        include: initialIncludeMarker,
        template: initialTemplateMarker,
        wxs: initialWxsMarker,
      })
      await dom.check('layout-shared:0', miniProgram, page)

      const updatedTemplate = buildSharedImportTemplate(updatedTemplateMarker)
      await replaceFileByRename(SHARED_IMPORT_TEMPLATE, updatedTemplate)
      await waitForFileContainsWithRetry(sharedImportOutput, updatedTemplateMarker, SHARED_IMPORT_TEMPLATE, updatedTemplate)
      await waitForIdeRecompileSettled()
      await waitForLayoutSharedMarkers(miniProgram, {
        template: updatedTemplateMarker,
      })
      await dom.check('layout-shared:1', miniProgram, page)

      const updatedInclude = buildSharedIncludeTemplate(updatedIncludeMarker)
      await replaceFileByRename(SHARED_INCLUDE_TEMPLATE, updatedInclude)
      await waitForFileContainsWithRetry(sharedIncludeOutput, updatedIncludeMarker, SHARED_INCLUDE_TEMPLATE, updatedInclude)
      await waitForIdeRecompileSettled()
      await waitForLayoutSharedMarkers(miniProgram, {
        include: updatedIncludeMarker,
      })
      await dom.check('layout-shared:2', miniProgram, page)

      await resetLayoutStorageProbes(miniProgram)
      await page.callMethodWithOptions('applyAdminLayout', { routeOnly: true })
      await page.waitFor(200)
      await waitForLayoutSharedMarkers(miniProgram, {
        template: updatedTemplateMarker,
      })
      await dom.check('layout-shared:3', miniProgram, page)

      const updatedWxs = buildSharedWxs(updatedWxsMarker)
      await replaceFileByRename(SHARED_WXS, updatedWxs)
      await waitForFileContainsWithRetry(sharedWxsOutput, updatedWxsMarker, SHARED_WXS, updatedWxs)
      // classic 的全量刷新会丢弃 admin 选择；先验收新页面的默认状态，再进行新的交互。
      await dom.check(CLASSIC_WXS_RELOAD_CHECKPOINT.id, miniProgram, await waitForClassicWxsReload(miniProgram))
      page = await miniProgram.reLaunch('/pages/layouts/index')
      if (!page) {
        throw new Error('Failed to re-enter /pages/layouts/index after classic WXS reload')
      }
      await dom.check('layout-shared:4', miniProgram, page)
      await page.callMethodWithOptions('applyAdminLayout', { routeOnly: true })
      await dom.check('layout-shared:5', miniProgram, page)
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
      await fs.writeFile(DEFAULT_LAYOUT_WXML, originalDefaultLayout, 'utf8')
      await fs.writeFile(ADMIN_LAYOUT_WXML, originalAdminLayout, 'utf8')
      await restoreOriginalSharedFiles()
    }
  })
})
