import { fs } from '@weapp-core/shared/node'
import path from 'pathe'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { launchAutomator } from '../utils/automator'
import { startDevProcess } from '../utils/dev-process'
import { cleanupResidualDevProcesses } from '../utils/dev-process-cleanup'
import { createDevProcessEnv } from '../utils/dev-process-env'
import { createHmrMarker, replaceFileByRename, waitForFileContains } from '../utils/hmr-helpers'
import { APP_ROOT, CLI_PATH, DIST_ROOT, normalizeAutomatorWxml, waitForFile } from '../wevu-runtime.utils'

const DEFAULT_LAYOUT_WXML = path.join(APP_ROOT, 'src/layouts/default/index.wxml')
const ADMIN_LAYOUT_WXML = path.join(APP_ROOT, 'src/layouts/admin/index.wxml')
const SHARED_DIR = path.join(APP_ROOT, 'src/shared-layout-hmr')
const SHARED_IMPORT_TEMPLATE = path.join(SHARED_DIR, 'layout-template.wxml')
const SHARED_INCLUDE_TEMPLATE = path.join(SHARED_DIR, 'layout-include.wxml')
const SHARED_WXS = path.join(SHARED_DIR, 'layout-helper.wxs')

let sharedMiniProgram: any = null
let sharedDev: ReturnType<typeof startDevProcess> | null = null

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

async function readPageWxml(page: any) {
  const root = await page.$('page')
  if (!root) {
    return null
  }
  return normalizeAutomatorWxml(await root.wxml())
}

async function waitForPageWxmlContains(page: any, marker: string, timeoutMs = 20_000) {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    const wxml = await readPageWxml(page)
    if (wxml && wxml.includes(marker)) {
      return wxml
    }
    await page.waitFor(200)
  }
  throw new Error(`Timed out waiting page runtime wxml to contain marker: ${marker}`)
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

async function getSharedMiniProgram() {
  if (!sharedMiniProgram) {
    sharedMiniProgram = await launchAutomator({
      projectPath: APP_ROOT,
    })
  }
  return sharedMiniProgram
}

async function relaunchIdeSession(route: string) {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    if (sharedMiniProgram) {
      await sharedMiniProgram.close()
      sharedMiniProgram = null
    }

    try {
      const miniProgram = await getSharedMiniProgram()
      return await miniProgram.reLaunch(route)
    }
    catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      if (attempt === 1 || (!message.includes('Timeout in launch automator') && !message.includes('startsWith'))) {
        throw error
      }
    }
  }

  throw new Error(`Failed to relaunch IDE session for route: ${route}`)
}

beforeEach(async () => {
  await cleanupResidualDevProcesses()
})

afterAll(async () => {
  if (sharedMiniProgram) {
    await sharedMiniProgram.close()
    sharedMiniProgram = null
  }
  if (sharedDev) {
    await sharedDev.stop(5_000)
    sharedDev = null
  }
  await cleanupResidualDevProcesses()
})

describe.sequential('wevu runtime layout shared template/wxs hmr (ide)', () => {
  it('updates layout runtime output in DevTools after shared template/include/wxs edits', async () => {
    await fs.remove(DIST_ROOT)

    const originalDefaultLayout = await fs.readFile(DEFAULT_LAYOUT_WXML, 'utf8')
    const originalAdminLayout = await fs.readFile(ADMIN_LAYOUT_WXML, 'utf8')
    const originalSharedFiles = await captureOriginalSharedFiles()

    const initialTemplateMarker = createHmrMarker('IDE-LAYOUT-SHARED-TEMPLATE-INIT', 'weapp')
    const updatedTemplateMarker = createHmrMarker('IDE-LAYOUT-SHARED-TEMPLATE-UPDATE', 'weapp')
    const initialIncludeMarker = createHmrMarker('IDE-LAYOUT-SHARED-INCLUDE-INIT', 'weapp')
    const updatedIncludeMarker = createHmrMarker('IDE-LAYOUT-SHARED-INCLUDE-UPDATE', 'weapp')
    const initialWxsMarker = createHmrMarker('IDE-LAYOUT-SHARED-WXS-INIT', 'weapp')
    const updatedWxsMarker = createHmrMarker('IDE-LAYOUT-SHARED-WXS-UPDATE', 'weapp')

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

      let page = await relaunchIdeSession('/pages/layouts/index')
      if (!page) {
        throw new Error('Failed to launch /pages/layouts/index')
      }

      let runtimeWxml = await waitForPageWxmlContains(page, initialTemplateMarker)
      expect(runtimeWxml).toContain(initialIncludeMarker)
      expect(runtimeWxml).toContain(initialWxsMarker)

      const updatedTemplate = buildSharedImportTemplate(updatedTemplateMarker)
      await replaceFileByRename(SHARED_IMPORT_TEMPLATE, updatedTemplate)
      await waitForFileContainsWithRetry(sharedImportOutput, updatedTemplateMarker, SHARED_IMPORT_TEMPLATE, updatedTemplate)
      await waitForIdeRecompileSettled()
      page = await relaunchIdeSession('/pages/layouts/index')
      runtimeWxml = await waitForPageWxmlContains(page, updatedTemplateMarker)
      expect(runtimeWxml).toContain(updatedTemplateMarker)

      const updatedInclude = buildSharedIncludeTemplate(updatedIncludeMarker)
      await replaceFileByRename(SHARED_INCLUDE_TEMPLATE, updatedInclude)
      await waitForFileContainsWithRetry(sharedIncludeOutput, updatedIncludeMarker, SHARED_INCLUDE_TEMPLATE, updatedInclude)
      await waitForIdeRecompileSettled()
      page = await relaunchIdeSession('/pages/layouts/index')
      runtimeWxml = await waitForPageWxmlContains(page, updatedIncludeMarker)
      expect(runtimeWxml).toContain(updatedIncludeMarker)

      await page.callMethod('applyAdminLayout')
      await page.waitFor(200)
      runtimeWxml = await waitForPageWxmlContains(page, updatedTemplateMarker)
      expect(runtimeWxml).toContain(updatedTemplateMarker)

      const updatedWxs = buildSharedWxs(updatedWxsMarker)
      await replaceFileByRename(SHARED_WXS, updatedWxs)
      await waitForFileContainsWithRetry(sharedWxsOutput, updatedWxsMarker, SHARED_WXS, updatedWxs)
      await waitForIdeRecompileSettled()
      page = await relaunchIdeSession('/pages/layouts/index')
      await page.callMethod('applyAdminLayout')
      await page.waitFor(200)
      runtimeWxml = await waitForPageWxmlContains(page, updatedWxsMarker)
      expect(runtimeWxml).toContain(updatedWxsMarker)
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
      await restoreOriginalSharedFiles(originalSharedFiles)
    }
  })
})
