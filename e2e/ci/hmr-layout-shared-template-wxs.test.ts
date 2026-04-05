import { fs } from '@weapp-core/shared'
import path from 'pathe'
import { startDevProcess } from '../utils/dev-process'
import { cleanupResidualDevProcesses } from '../utils/dev-process-cleanup'
import { createDevProcessEnv } from '../utils/dev-process-env'
import { createHmrMarker, PLATFORM_EXT, replaceFileByRename, resolvePlatforms, waitForFileContains } from '../utils/hmr-helpers'
import { APP_ROOT, CLI_PATH, DIST_ROOT, waitForFile } from '../wevu-runtime.utils'

const DEFAULT_LAYOUT_WXML = path.join(APP_ROOT, 'src/layouts/default/index.wxml')
const ADMIN_LAYOUT_WXML = path.join(APP_ROOT, 'src/layouts/admin/index.wxml')
const SHARED_DIR = path.join(APP_ROOT, 'src/shared-layout-hmr')
const SHARED_IMPORT_TEMPLATE = path.join(SHARED_DIR, 'layout-template.wxml')
const SHARED_INCLUDE_TEMPLATE = path.join(SHARED_DIR, 'layout-include.wxml')
const SHARED_WXS = path.join(SHARED_DIR, 'layout-helper.wxs')

const PLATFORM_LIST = resolvePlatforms()

function resolveScriptModuleExt(platform: (typeof PLATFORM_LIST)[number]) {
  return platform === 'weapp' ? 'wxs' : 'sjs'
}

function buildSharedImportTemplate(marker: string) {
  return [
    '<template name="hmrLayoutCard">',
    `  <view class="layout-shared-template">${marker}: {{ label }}</view>`,
    '</template>',
    '',
  ].join('\n')
}

function buildSharedIncludeTemplate(marker: string) {
  return `<view class="layout-shared-include">${marker}</view>\n`
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

async function captureOriginalSharedFiles() {
  const existed = await fs.pathExists(SHARED_DIR)
  return {
    existed,
    template: await fs.readFile(SHARED_IMPORT_TEMPLATE, 'utf8').catch(() => undefined),
    include: await fs.readFile(SHARED_INCLUDE_TEMPLATE, 'utf8').catch(() => undefined),
    wxs: await fs.readFile(SHARED_WXS, 'utf8').catch(() => undefined),
  }
}

async function restoreOriginalSharedFiles(snapshot: Awaited<ReturnType<typeof captureOriginalSharedFiles>>) {
  if (!snapshot.existed) {
    await fs.remove(SHARED_DIR)
    return
  }

  await fs.ensureDir(SHARED_DIR)

  if (snapshot.template !== undefined) {
    await fs.writeFile(SHARED_IMPORT_TEMPLATE, snapshot.template, 'utf8')
  }
  if (snapshot.include !== undefined) {
    await fs.writeFile(SHARED_INCLUDE_TEMPLATE, snapshot.include, 'utf8')
  }
  if (snapshot.wxs !== undefined) {
    await fs.writeFile(SHARED_WXS, snapshot.wxs, 'utf8')
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

beforeEach(async () => {
  await cleanupResidualDevProcesses()
})

afterEach(async () => {
  await cleanupResidualDevProcesses()
})

describe.sequential('HMR layout shared template and wxs dependencies (dev watch)', () => {
  it.each(PLATFORM_LIST)('updates shared deps imported by layouts (%s)', async (platform) => {
    await fs.remove(DIST_ROOT)

    const originalDefaultLayout = await fs.readFile(DEFAULT_LAYOUT_WXML, 'utf8')
    const originalAdminLayout = await fs.readFile(ADMIN_LAYOUT_WXML, 'utf8')
    const originalSharedFiles = await captureOriginalSharedFiles()

    const initialTemplateMarker = createHmrMarker('LAYOUT-SHARED-TEMPLATE-INIT', platform)
    const updatedTemplateMarker = createHmrMarker('LAYOUT-SHARED-TEMPLATE-UPDATE', platform)
    const initialIncludeMarker = createHmrMarker('LAYOUT-SHARED-INCLUDE-INIT', platform)
    const updatedIncludeMarker = createHmrMarker('LAYOUT-SHARED-INCLUDE-UPDATE', platform)
    const initialWxsMarker = createHmrMarker('LAYOUT-SHARED-WXS-INIT', platform)
    const updatedWxsMarker = createHmrMarker('LAYOUT-SHARED-WXS-UPDATE', platform)

    const templateExt = PLATFORM_EXT[platform].template
    const defaultLayoutOutput = path.join(DIST_ROOT, `layouts/default/index.${templateExt}`)
    const adminLayoutOutput = path.join(DIST_ROOT, `layouts/admin/index.${templateExt}`)
    const sharedImportOutput = path.join(DIST_ROOT, `shared-layout-hmr/layout-template.${templateExt}`)
    const sharedIncludeOutput = path.join(DIST_ROOT, `shared-layout-hmr/layout-include.${templateExt}`)
    const sharedWxsOutput = path.join(DIST_ROOT, `shared-layout-hmr/layout-helper.${resolveScriptModuleExt(platform)}`)

    await fs.ensureDir(SHARED_DIR)
    await fs.writeFile(SHARED_IMPORT_TEMPLATE, buildSharedImportTemplate(initialTemplateMarker), 'utf8')
    await fs.writeFile(SHARED_INCLUDE_TEMPLATE, buildSharedIncludeTemplate(initialIncludeMarker), 'utf8')
    await fs.writeFile(SHARED_WXS, buildSharedWxs(initialWxsMarker), 'utf8')
    await fs.writeFile(DEFAULT_LAYOUT_WXML, buildDefaultLayoutWxml(), 'utf8')
    await fs.writeFile(ADMIN_LAYOUT_WXML, buildAdminLayoutWxml(), 'utf8')

    // @ts-expect-error execa v9 overload resolution
    const dev = startDevProcess('node', ['--import', 'tsx', CLI_PATH, 'dev', APP_ROOT, '--platform', platform, '--skipNpm'], {
      env: createDevProcessEnv(),
      stdio: 'inherit',
    })

    try {
      await dev.waitFor(waitForFile(path.join(DIST_ROOT, 'app.json'), 90_000), `${platform} app.json generated`)
      await dev.waitFor(waitForFileContains(sharedImportOutput, initialTemplateMarker), `${platform} initial layout shared template output`)
      await dev.waitFor(waitForFileContains(sharedIncludeOutput, initialIncludeMarker), `${platform} initial layout shared include output`)
      await dev.waitFor(waitForFileContains(sharedWxsOutput, initialWxsMarker), `${platform} initial layout shared wxs output`)
      await dev.waitFor(waitForFileContains(defaultLayoutOutput, `layout-template.${templateExt}`), `${platform} default layout references shared template`)
      await dev.waitFor(waitForFileContains(defaultLayoutOutput, `layout-include.${templateExt}`), `${platform} default layout references shared include`)
      await dev.waitFor(waitForFileContains(adminLayoutOutput, `layout-template.${templateExt}`), `${platform} admin layout references shared template`)

      const updatedTemplate = buildSharedImportTemplate(updatedTemplateMarker)
      await replaceFileByRename(SHARED_IMPORT_TEMPLATE, updatedTemplate)
      expect(await dev.waitFor(
        waitForFileContainsWithRetry(sharedImportOutput, updatedTemplateMarker, SHARED_IMPORT_TEMPLATE, updatedTemplate),
        `${platform} updated layout shared template output`,
      )).toContain(updatedTemplateMarker)

      const updatedInclude = buildSharedIncludeTemplate(updatedIncludeMarker)
      await replaceFileByRename(SHARED_INCLUDE_TEMPLATE, updatedInclude)
      expect(await dev.waitFor(
        waitForFileContainsWithRetry(sharedIncludeOutput, updatedIncludeMarker, SHARED_INCLUDE_TEMPLATE, updatedInclude),
        `${platform} updated layout shared include output`,
      )).toContain(updatedIncludeMarker)

      const updatedWxs = buildSharedWxs(updatedWxsMarker)
      await replaceFileByRename(SHARED_WXS, updatedWxs)
      expect(await dev.waitFor(
        waitForFileContainsWithRetry(sharedWxsOutput, updatedWxsMarker, SHARED_WXS, updatedWxs),
        `${platform} updated layout shared wxs output`,
      )).toContain(updatedWxsMarker)
    }
    finally {
      await dev.stop(5_000)
      await fs.writeFile(DEFAULT_LAYOUT_WXML, originalDefaultLayout, 'utf8')
      await fs.writeFile(ADMIN_LAYOUT_WXML, originalAdminLayout, 'utf8')
      await restoreOriginalSharedFiles(originalSharedFiles)
    }
  })
})
