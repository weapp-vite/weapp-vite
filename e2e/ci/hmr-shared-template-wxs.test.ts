import { fs } from '@weapp-core/shared'
import path from 'pathe'
import { startDevProcess } from '../utils/dev-process'
import { cleanupResidualDevProcesses } from '../utils/dev-process-cleanup'
import { createDevProcessEnv } from '../utils/dev-process-env'
import { createHmrMarker, PLATFORM_EXT, replaceFileByRename, resolvePlatforms, waitForFileContains } from '../utils/hmr-helpers'
import {
  buildSharedHmrPageWxml,
  buildSharedHmrVueSource,
  buildSharedImportTemplate,
  buildSharedIncludeTemplate,
  buildSharedWxs,
  resolveSharedHmrPaths,
  resolveSharedHmrRelativeImports,
  resolveSharedHmrScriptModuleExt,
} from '../utils/shared-hmr-fixture'
import { APP_ROOT, CLI_PATH, DIST_ROOT, waitForFile } from '../wevu-runtime.utils'

const SHARED_HMR_PATHS = resolveSharedHmrPaths(APP_ROOT)
const SHARED_HMR_IMPORTS = resolveSharedHmrRelativeImports()

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

beforeEach(async () => {
  await cleanupResidualDevProcesses()
})

afterEach(async () => {
  await cleanupResidualDevProcesses()
})

describe.sequential('HMR shared template and wxs dependencies (dev watch)', () => {
  it.each(PLATFORM_LIST)('updates all importers when shared template or wxs changes (%s)', async (platform) => {
    await fs.remove(DIST_ROOT)

    const originalPageWxml = await fs.readFile(SHARED_HMR_PATHS.hmrPageWxml, 'utf8')
    const originalVueSource = await fs.readFile(SHARED_HMR_PATHS.hmrSfcVue, 'utf8')

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
    const wxsOutputPath = path.join(DIST_ROOT, `shared-hmr/helper.${resolveSharedHmrScriptModuleExt(platform)}`)

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
      await replaceFileByRename(SHARED_HMR_PATHS.sharedImportTemplate, updatedSharedTemplate)

      const updatedSharedTemplateOutput = await dev.waitFor(
        waitForFileContainsWithRetry(sharedImportOutputPath, updatedTemplateMarker, SHARED_HMR_PATHS.sharedImportTemplate, updatedSharedTemplate),
        `${platform} updated shared import output`,
      )
      expect(updatedSharedTemplateOutput).toContain(updatedTemplateMarker)

      const updatedIncludeTemplate = buildSharedIncludeTemplate(updatedIncludeMarker)
      await replaceFileByRename(SHARED_HMR_PATHS.sharedIncludeTemplate, updatedIncludeTemplate)

      const includeOutput = await dev.waitFor(
        waitForFileContainsWithRetry(sharedIncludeOutputPath, updatedIncludeMarker, SHARED_HMR_PATHS.sharedIncludeTemplate, updatedIncludeTemplate),
        `${platform} updated shared include output`,
      )
      expect(includeOutput).toContain(updatedIncludeMarker)

      const updatedWxsSource = buildSharedWxs(updatedWxsMarker)
      await replaceFileByRename(SHARED_HMR_PATHS.sharedWxs, updatedWxsSource)

      const wxsOutput = await dev.waitFor(
        waitForFileContainsWithRetry(wxsOutputPath, updatedWxsMarker, SHARED_HMR_PATHS.sharedWxs, updatedWxsSource),
        `${platform} updated shared wxs`,
      )
      expect(wxsOutput).toContain(updatedWxsMarker)
    }
    finally {
      await dev.stop(5_000)
      await fs.writeFile(SHARED_HMR_PATHS.hmrPageWxml, originalPageWxml, 'utf8')
      await fs.writeFile(SHARED_HMR_PATHS.hmrSfcVue, originalVueSource, 'utf8')
      await fs.remove(SHARED_HMR_PATHS.sharedDir)
    }
  })
})
