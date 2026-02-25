import fs from 'fs-extra'
import path from 'pathe'
import { startDevProcess } from '../utils/dev-process'
import { cleanupResidualDevProcesses } from '../utils/dev-process-cleanup'
import { createDevProcessEnv } from '../utils/dev-process-env'
import { PLATFORM_EXT, resolvePlatforms, waitForFileContains } from '../utils/hmr-helpers'
import { APP_ROOT, CLI_PATH, DIST_ROOT, waitForFile } from '../wevu-runtime.utils'

const HMR_SOURCE_TEMPLATE_PATH = path.join(APP_ROOT, 'src/pages/hmr/index.wxml')

const PLATFORM_LIST = resolvePlatforms()

beforeEach(async () => {
  await cleanupResidualDevProcesses()
})

afterEach(async () => {
  await cleanupResidualDevProcesses()
})

describe.sequential('wevu runtime hmr (dev watch)', () => {
  it.each(PLATFORM_LIST)('updates dist template after source change (%s)', async (platform) => {
    await fs.remove(DIST_ROOT)
    const originalSource = await fs.readFile(HMR_SOURCE_TEMPLATE_PATH, 'utf8')
    const distTemplatePath = path.join(DIST_ROOT, `pages/hmr/index.${PLATFORM_EXT[platform].template}`)
    const marker = `HMR-HOT-${platform.toUpperCase()}`

    const updatedSource = originalSource.replace('HMR', marker)
    if (updatedSource === originalSource) {
      throw new Error('Failed to update hmr source marker.')
    }

    // @ts-expect-error execa v9 overload resolution
    const dev = startDevProcess('node', ['--import', 'tsx', CLI_PATH, 'dev', APP_ROOT, '--platform', platform, '--skipNpm'], {
      env: createDevProcessEnv(),
      stdio: 'inherit',
    })

    try {
      await dev.waitFor(waitForFile(path.join(DIST_ROOT, 'app.json'), 30_000), `${platform} app.json generated`)
      await dev.waitFor(waitForFileContains(distTemplatePath, 'HMR'), `${platform} initial hmr template`)

      await fs.writeFile(HMR_SOURCE_TEMPLATE_PATH, updatedSource, 'utf8')

      const nextTemplate = await dev.waitFor(
        waitForFileContains(distTemplatePath, marker),
        `${platform} updated hmr marker`,
      )
      expect(nextTemplate).toContain(marker)
    }
    finally {
      await dev.stop(5_000)

      await fs.writeFile(HMR_SOURCE_TEMPLATE_PATH, originalSource, 'utf8')
    }
  })
})
