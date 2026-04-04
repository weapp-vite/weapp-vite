import { fs } from '@weapp-core/shared'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { launchAutomator } from '../utils/automator'
import { startDevProcess } from '../utils/dev-process'
import { cleanupResidualDevProcesses } from '../utils/dev-process-cleanup'
import { createDevProcessEnv } from '../utils/dev-process-env'
import { createHmrMarker, replaceFileByRename, waitForFileContains } from '../utils/hmr-helpers'
import {
  buildSharedHmrPageWxml,
  buildSharedHmrVueSource,
  buildSharedImportTemplate,
  buildSharedIncludeTemplate,
  buildSharedWxs,
  resolveSharedHmrPaths,
  resolveSharedHmrRelativeImports,
} from '../utils/shared-hmr-fixture'
import { APP_ROOT, CLI_PATH, DIST_ROOT, normalizeAutomatorWxml, waitForFile } from '../wevu-runtime.utils'

const SHARED_HMR_PATHS = resolveSharedHmrPaths(APP_ROOT)
const SHARED_HMR_IMPORTS = resolveSharedHmrRelativeImports()
const TEMPLATE_EXT = 'wxml'
const SCRIPT_MODULE_EXT = 'wxs'

let sharedMiniProgram: any = null
let sharedDev: ReturnType<typeof startDevProcess> | null = null

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

async function relaunchIdeSession(route: string) {
  if (sharedMiniProgram) {
    await sharedMiniProgram.close()
  }
  sharedMiniProgram = await launchAutomator({
    projectPath: APP_ROOT,
  })
  return await sharedMiniProgram.reLaunch(route)
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

describe.sequential('wevu runtime shared template/wxs hmr (ide)', () => {
  it('updates runtime pages in DevTools after shared template/include/wxs edits', async () => {
    await fs.remove(DIST_ROOT)

    const originalPageWxml = await fs.readFile(SHARED_HMR_PATHS.hmrPageWxml, 'utf8')
    const originalVueSource = await fs.readFile(SHARED_HMR_PATHS.hmrSfcVue, 'utf8')

    const initialTemplateMarker = createHmrMarker('IDE-SHARED-TEMPLATE-INIT', 'weapp')
    const pageUpdatedTemplateMarker = createHmrMarker('IDE-SHARED-TEMPLATE-PAGE', 'weapp')
    const vueUpdatedTemplateMarker = createHmrMarker('IDE-SHARED-TEMPLATE-VUE', 'weapp')
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

    sharedDev = startDevProcess('node', ['--import', 'tsx', CLI_PATH, 'dev', APP_ROOT, '--platform', 'weapp', '--skipNpm'], {
      env: createDevProcessEnv(),
      stdio: 'inherit',
    })

    try {
      await sharedDev.waitFor(waitForFile(`${DIST_ROOT}/app.json`, 90_000), 'weapp app.json generated for ide hmr')
      let page = await relaunchIdeSession('/pages/hmr/index')
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
      // DevTools 在 dev 重编译后继续复用旧 automator 会话做 reLaunch 不稳定，
      // 这里重建会话，确保仍然是 IDE 实际运行态验证而不是仅看 dist。
      page = await relaunchIdeSession('/pages/hmr/index')
      runtimeWxml = await waitForPageWxmlContains(page, pageUpdatedTemplateMarker)
      expect(runtimeWxml).toContain(pageUpdatedTemplateMarker)

      const updatedIncludeSource = buildSharedIncludeTemplate(updatedIncludeMarker)
      await replaceFileByRename(SHARED_HMR_PATHS.sharedIncludeTemplate, updatedIncludeSource)
      await waitForFileContainsWithRetry(
        sharedIncludeOutputPath,
        updatedIncludeMarker,
        SHARED_HMR_PATHS.sharedIncludeTemplate,
        updatedIncludeSource,
      )
      page = await relaunchIdeSession('/pages/hmr/index')
      runtimeWxml = await waitForPageWxmlContains(page, updatedIncludeMarker)
      expect(runtimeWxml).toContain(updatedIncludeMarker)

      page = await relaunchIdeSession('/pages/hmr-sfc/index')
      if (!page) {
        throw new Error('Failed to launch /pages/hmr-sfc/index')
      }

      runtimeWxml = await waitForPageWxmlContains(page, pageUpdatedTemplateMarker)
      expect(runtimeWxml).toContain(initialWxsMarker)

      const vueUpdatedTemplateSource = buildSharedImportTemplate(vueUpdatedTemplateMarker)
      await replaceFileByRename(SHARED_HMR_PATHS.sharedImportTemplate, vueUpdatedTemplateSource)
      await waitForFileContainsWithRetry(
        sharedImportOutputPath,
        vueUpdatedTemplateMarker,
        SHARED_HMR_PATHS.sharedImportTemplate,
        vueUpdatedTemplateSource,
      )
      page = await relaunchIdeSession('/pages/hmr-sfc/index')
      runtimeWxml = await waitForPageWxmlContains(page, vueUpdatedTemplateMarker)
      expect(runtimeWxml).toContain(vueUpdatedTemplateMarker)

      const updatedWxsSource = buildSharedWxs(updatedWxsMarker)
      await replaceFileByRename(SHARED_HMR_PATHS.sharedWxs, updatedWxsSource)
      await waitForFileContainsWithRetry(
        sharedWxsOutputPath,
        updatedWxsMarker,
        SHARED_HMR_PATHS.sharedWxs,
        updatedWxsSource,
      )
      page = await relaunchIdeSession('/pages/hmr-sfc/index')
      runtimeWxml = await waitForPageWxmlContains(page, updatedWxsMarker)
      expect(runtimeWxml).toContain(updatedWxsMarker)

      page = await relaunchIdeSession('/pages/hmr/index')
      if (!page) {
        throw new Error('Failed to relaunch /pages/hmr/index for final wxs check')
      }
      runtimeWxml = await waitForPageWxmlContains(page, updatedWxsMarker)
      expect(runtimeWxml).toContain(vueUpdatedTemplateMarker)
      expect(runtimeWxml).toContain(updatedIncludeMarker)
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
