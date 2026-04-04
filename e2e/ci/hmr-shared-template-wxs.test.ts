import { fs } from '@weapp-core/shared'
import path from 'pathe'
import { startDevProcess } from '../utils/dev-process'
import { cleanupResidualDevProcesses } from '../utils/dev-process-cleanup'
import { createDevProcessEnv } from '../utils/dev-process-env'
import { createHmrMarker, PLATFORM_EXT, replaceFileByRename, resolvePlatforms, waitForFileContains } from '../utils/hmr-helpers'
import { APP_ROOT, CLI_PATH, DIST_ROOT, waitForFile } from '../wevu-runtime.utils'

const HMR_PAGE_WXML = path.join(APP_ROOT, 'src/pages/hmr/index.wxml')
const HMR_SFC_VUE = path.join(APP_ROOT, 'src/pages/hmr-sfc/index.vue')
const SHARED_DIR = path.join(APP_ROOT, 'src/shared-hmr')
const SHARED_IMPORT_TEMPLATE = path.join(SHARED_DIR, 'card-template.wxml')
const SHARED_INCLUDE_TEMPLATE = path.join(SHARED_DIR, 'card-include.wxml')
const SHARED_WXS = path.join(SHARED_DIR, 'helper.wxs')

const SCRIPT_MODULE_EXT: Record<(typeof PLATFORM_LIST)[number], string> = {
  weapp: 'wxs',
  alipay: 'sjs',
  tt: 'sjs',
}

const PLATFORM_LIST = resolvePlatforms()

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

function buildSharedImportTemplate(marker: string) {
  return [
    '<template name="hmrSharedCard">',
    `  <view class="shared-template">${marker}: {{ label }}</view>`,
    '</template>',
    '',
  ].join('\n')
}

function buildSharedIncludeTemplate(marker: string) {
  return `<view class="shared-include">${marker}</view>\n`
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

function buildPageWxml(importTemplatePath: string, includeTemplatePath: string, helperPath: string) {
  return [
    `<import src="${importTemplatePath}" />`,
    `<include src="${includeTemplatePath}" />`,
    `<wxs module="hmrShared" src="${helperPath}" />`,
    '<view class="page">',
    '  <view class="title">HMR</view>',
    '  <template is="hmrSharedCard" data="{{ label: hmrShared.label() }}" />',
    '  <view class="summary">ok: {{__e2e.ok}}</view>',
    '  <text class="details" selectable>{{__e2eText}}</text>',
    '</view>',
    '',
  ].join('\n')
}

function buildVueSource(importTemplatePath: string, helperPath: string) {
  return [
    '<script lang="ts">',
    '/* HMR-SFC-SCRIPT */',
    'import { defineComponent } from \'wevu\'',
    '',
    'export default defineComponent({',
    '  data: () => ({',
    '    marker: \'HMR-SFC-SCRIPT\',',
    '  }),',
    '})',
    '</script>',
    '',
    '<template>',
    `  <import src="${importTemplatePath}" />`,
    `  <wxs module="hmrShared" src="${helperPath}" />`,
    '  <view class="hmr-sfc-page">',
    '    <view class="title">HMR-SFC</view>',
    '    <view class="marker">{{ marker }}</view>',
    '    <template is="hmrSharedCard" data="{{ label: hmrShared.label() }}" />',
    '  </view>',
    '</template>',
    '',
    '<style>',
    '/* HMR-SFC-STYLE */',
    '.hmr-sfc-page {',
    '  padding: 24rpx;',
    '}',
    '',
    '.title {',
    '  font-weight: 600;',
    '  margin-bottom: 16rpx;',
    '}',
    '',
    '.marker {',
    '  font-size: 28rpx;',
    '}',
    '</style>',
    '',
    '<json>',
    '{',
    '  "component": false',
    '}',
    '</json>',
    '',
  ].join('\n')
}

beforeEach(async () => {
  await cleanupResidualDevProcesses()
})

afterEach(async () => {
  await cleanupResidualDevProcesses()
})

describe.sequential('HMR shared template and wxs dependencies (dev watch)', () => {
  it.each(PLATFORM_LIST)('updates all importers when shared template or wxs changes (%s)', async (platform) => {
    await fs.remove(DIST_ROOT)

    const originalPageWxml = await fs.readFile(HMR_PAGE_WXML, 'utf8')
    const originalVueSource = await fs.readFile(HMR_SFC_VUE, 'utf8')

    const importTemplateRelative = '../../shared-hmr/card-template.wxml'
    const includeTemplateRelative = '../../shared-hmr/card-include.wxml'
    const helperRelative = '../../shared-hmr/helper.wxs'

    const initialTemplateMarker = createHmrMarker('SHARED-TEMPLATE-INIT', platform)
    const updatedTemplateMarker = createHmrMarker('SHARED-TEMPLATE-UPDATE', platform)
    const initialIncludeMarker = createHmrMarker('SHARED-INCLUDE-INIT', platform)
    const updatedIncludeMarker = createHmrMarker('SHARED-INCLUDE-UPDATE', platform)
    const initialWxsMarker = createHmrMarker('SHARED-WXS-INIT', platform)
    const updatedWxsMarker = createHmrMarker('SHARED-WXS-UPDATE', platform)

    const pageOutputPath = path.join(DIST_ROOT, `pages/hmr/index.${PLATFORM_EXT[platform].template}`)
    const vueOutputPath = path.join(DIST_ROOT, `pages/hmr-sfc/index.${PLATFORM_EXT[platform].template}`)
    const sharedImportOutputPath = path.join(DIST_ROOT, `shared-hmr/card-template.${PLATFORM_EXT[platform].template}`)
    const sharedIncludeOutputPath = path.join(DIST_ROOT, `shared-hmr/card-include.${PLATFORM_EXT[platform].template}`)
    const wxsOutputPath = path.join(DIST_ROOT, `shared-hmr/helper.${SCRIPT_MODULE_EXT[platform]}`)

    await fs.ensureDir(SHARED_DIR)
    await fs.writeFile(SHARED_IMPORT_TEMPLATE, buildSharedImportTemplate(initialTemplateMarker), 'utf8')
    await fs.writeFile(SHARED_INCLUDE_TEMPLATE, buildSharedIncludeTemplate(initialIncludeMarker), 'utf8')
    await fs.writeFile(SHARED_WXS, buildSharedWxs(initialWxsMarker), 'utf8')
    await fs.writeFile(HMR_PAGE_WXML, buildPageWxml(importTemplateRelative, includeTemplateRelative, helperRelative), 'utf8')
    await fs.writeFile(HMR_SFC_VUE, buildVueSource(importTemplateRelative, helperRelative), 'utf8')

    // @ts-expect-error execa v9 overload resolution
    const dev = startDevProcess('node', ['--import', 'tsx', CLI_PATH, 'dev', APP_ROOT, '--platform', platform, '--skipNpm'], {
      env: createDevProcessEnv(),
      stdio: 'inherit',
    })

    try {
      await dev.waitFor(waitForFile(path.join(DIST_ROOT, 'app.json'), 90_000), `${platform} app.json generated`)
      await dev.waitFor(waitForFileContains(sharedImportOutputPath, initialTemplateMarker), `${platform} initial shared import output`)
      await dev.waitFor(waitForFileContains(sharedIncludeOutputPath, initialIncludeMarker), `${platform} initial shared include output`)
      await dev.waitFor(waitForFileContains(pageOutputPath, `card-template.${PLATFORM_EXT[platform].template}`), `${platform} wxml importer references shared template`)
      await dev.waitFor(waitForFileContains(pageOutputPath, `card-include.${PLATFORM_EXT[platform].template}`), `${platform} wxml importer references shared include`)
      await dev.waitFor(waitForFileContains(vueOutputPath, `card-template.${PLATFORM_EXT[platform].template}`), `${platform} vue importer references shared template`)
      await dev.waitFor(waitForFileContains(wxsOutputPath, initialWxsMarker), `${platform} initial shared wxs`)

      const updatedSharedTemplate = buildSharedImportTemplate(updatedTemplateMarker)
      await replaceFileByRename(SHARED_IMPORT_TEMPLATE, updatedSharedTemplate)

      const updatedSharedTemplateOutput = await dev.waitFor(
        waitForFileContainsWithRetry(sharedImportOutputPath, updatedTemplateMarker, SHARED_IMPORT_TEMPLATE, updatedSharedTemplate),
        `${platform} updated shared import output`,
      )
      expect(updatedSharedTemplateOutput).toContain(updatedTemplateMarker)

      const updatedIncludeTemplate = buildSharedIncludeTemplate(updatedIncludeMarker)
      await replaceFileByRename(SHARED_INCLUDE_TEMPLATE, updatedIncludeTemplate)

      const includeOutput = await dev.waitFor(
        waitForFileContainsWithRetry(sharedIncludeOutputPath, updatedIncludeMarker, SHARED_INCLUDE_TEMPLATE, updatedIncludeTemplate),
        `${platform} updated shared include output`,
      )
      expect(includeOutput).toContain(updatedIncludeMarker)

      const updatedWxsSource = buildSharedWxs(updatedWxsMarker)
      await replaceFileByRename(SHARED_WXS, updatedWxsSource)

      const wxsOutput = await dev.waitFor(
        waitForFileContainsWithRetry(wxsOutputPath, updatedWxsMarker, SHARED_WXS, updatedWxsSource),
        `${platform} updated shared wxs`,
      )
      expect(wxsOutput).toContain(updatedWxsMarker)
    }
    finally {
      await dev.stop(5_000)
      await fs.writeFile(HMR_PAGE_WXML, originalPageWxml, 'utf8')
      await fs.writeFile(HMR_SFC_VUE, originalVueSource, 'utf8')
      await fs.remove(SHARED_DIR)
    }
  })
})
