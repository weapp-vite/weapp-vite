import { fs } from '@weapp-core/shared/node'
import path from 'pathe'
import { createClassicAssetScriptContract } from '../utils/classicAssetScriptContract'
import { startDevProcess } from '../utils/dev-process'
import { cleanupResidualDevProcesses } from '../utils/dev-process-cleanup'
import { createDevProcessEnv } from '../utils/dev-process-env'
import { createDevBuildCompletion } from '../utils/devBuildCompletion'
import { PLATFORM_EXT, replaceFileByRename, resolvePlatforms, waitForFileContains } from '../utils/hmr-helpers'
import { APP_ROOT, CLI_PATH, DIST_ROOT, waitForFile } from '../wevu-runtime.utils'

const HMR_SOURCE_TEMPLATE_PATH = path.join(APP_ROOT, 'src/pages/hmr/index.wxml')

const PLATFORM_LIST = resolvePlatforms()

beforeEach(async () => {
  await cleanupResidualDevProcesses()
})

afterEach(async () => {
  await cleanupResidualDevProcesses()
})

describe('wevu runtime hmr (dev watch)', { concurrent: false }, () => {
  it.each(PLATFORM_LIST)('updates dist template after source change (%s)', async (platform) => {
    await fs.remove(DIST_ROOT)
    const originalSource = await fs.readFile(HMR_SOURCE_TEMPLATE_PATH, 'utf8')
    const distTemplatePath = path.join(DIST_ROOT, `pages/hmr/index.${PLATFORM_EXT[platform].template}`)
    const profilePath = path.join(APP_ROOT, '.tmp', `wevu-runtime-hmr-${platform}.jsonl`)
    const marker = `HMR-HOT-${platform.toUpperCase()}`

    const updatedSource = originalSource.replace('HMR', marker)
    if (updatedSource === originalSource) {
      throw new Error('Failed to update hmr source marker.')
    }

    await fs.remove(profilePath)
    const dev = startDevProcess('node', ['--import', 'tsx', CLI_PATH, 'dev', APP_ROOT, '--platform', platform, '--skipNpm'], {
      env: { ...createDevProcessEnv(), WEAPP_VITE_HMR_PROFILE_JSON: profilePath },
      stdio: 'inherit',
    })

    try {
      await dev.waitForInitialBuild()
      await dev.waitFor(waitForFile(path.join(DIST_ROOT, 'app.json')), `${platform} app.json generated`)
      const initialTemplate = await dev.waitFor(waitForFileContains(distTemplatePath, 'HMR'), `${platform} initial hmr template`)
      expect(dev.getOutput()).toContain('HMR 模式：classic')
      const scripts = await createClassicAssetScriptContract(DIST_ROOT, platform)

      const publishTemplate = async (source: string, expectedMarker: string) => {
        const completion = createDevBuildCompletion(dev, {
          source: { file: HMR_SOURCE_TEMPLATE_PATH, profilePath },
        })
        await replaceFileByRename(HMR_SOURCE_TEMPLATE_PATH, source)
        await completion.wait(90_000)
        const template = await dev.waitFor(waitForFileContains(distTemplatePath, expectedMarker), `${platform} published hmr template`)
        await scripts.assertUpdated()
        expect(dev.getBuildErrors()).toEqual([])
        return template
      }

      const nextTemplate = await publishTemplate(updatedSource, marker)
      expect(nextTemplate).toContain(marker)
      expect(await publishTemplate(originalSource, 'HMR')).toBe(initialTemplate)
      expect(await fs.readFile(HMR_SOURCE_TEMPLATE_PATH, 'utf8')).toBe(originalSource)
    }
    finally {
      await dev.stop(5_000)

      if (await fs.readFile(HMR_SOURCE_TEMPLATE_PATH, 'utf8') !== originalSource) {
        await replaceFileByRename(HMR_SOURCE_TEMPLATE_PATH, originalSource)
      }
    }
  })
})
