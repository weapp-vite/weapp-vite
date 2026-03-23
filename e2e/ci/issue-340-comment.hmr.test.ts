import fs from 'fs-extra'
import path from 'pathe'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { startDevProcess } from '../utils/dev-process'
import { cleanupResidualDevProcesses } from '../utils/dev-process-cleanup'
import { createDevProcessEnv } from '../utils/dev-process-env'
import { createHmrMarker, waitForFileContains } from '../utils/hmr-helpers'
import { waitForFile } from '../wevu-runtime.utils'

const CLI_PATH = path.resolve(import.meta.dirname, '../../packages/weapp-vite/bin/weapp-vite.js')
const APP_ROOT = path.resolve(import.meta.dirname, '../../e2e-apps/issue-340-hoist')
const DIST_ROOT = path.join(APP_ROOT, 'dist')
const CONFIG_PATH = path.join(APP_ROOT, 'weapp-vite.config.ts')
const SHARED_SOURCE_PATH = path.join(APP_ROOT, 'src/shared/issue-340-shared.ts')
const APP_JS_PATH = path.join(DIST_ROOT, 'app.js')
const APP_JSON_PATH = path.join(DIST_ROOT, 'app.json')
const SHARED_CHUNK_PATH = path.join(DIST_ROOT, 'issue-340-shared.js')
const ITEM_PAGE_JS_PATH = path.join(DIST_ROOT, 'subpackages/item/login-required/index.js')
const USER_PAGE_JS_PATH = path.join(DIST_ROOT, 'subpackages/user/register/form.js')

const ORIGINAL_CHUNK_CONFIG = `    chunks: {
      sharedStrategy: 'hoist',
      sharedMode: 'common',
      dynamicImports: 'preserve',
    },`

const COMMENT_CHUNK_CONFIG = `    chunks: {
      sharedStrategy: 'duplicate',
      sharedMode: 'path',
      sharedPathRoot: 'src/shared',
      dynamicImports: 'preserve',
    },`

beforeEach(async () => {
  await cleanupResidualDevProcesses()
})

afterEach(async () => {
  await cleanupResidualDevProcesses()
})

describe.sequential('issue #340 comment regression (dev watch)', () => {
  it('keeps app and cross-subpackage shared outputs stable after a direct shared-source edit', async () => {
    await fs.remove(DIST_ROOT)

    const originalConfig = await fs.readFile(CONFIG_PATH, 'utf8')
    const originalSharedSource = await fs.readFile(SHARED_SOURCE_PATH, 'utf8')
    const marker = createHmrMarker('ISSUE-340-COMMENT', 'weapp')

    if (!originalConfig.includes(ORIGINAL_CHUNK_CONFIG)) {
      throw new Error('Failed to find the original chunk config block for issue-340-hoist.')
    }

    const updatedConfig = originalConfig.replace(ORIGINAL_CHUNK_CONFIG, COMMENT_CHUNK_CONFIG)
    const updatedSharedSource = originalSharedSource.replace(`ref('issue-340-hoist')`, `ref('${marker}')`)

    if (updatedSharedSource === originalSharedSource) {
      throw new Error('Failed to inject HMR marker into issue-340 shared source.')
    }

    await fs.writeFile(CONFIG_PATH, updatedConfig, 'utf8')

    const dev = startDevProcess('node', ['--import', 'tsx', CLI_PATH, 'dev', APP_ROOT, '--platform', 'weapp', '--skipNpm'], {
      env: {
        ...createDevProcessEnv(),
        DEBUG: 'weapp-vite:load-entry',
      },
      all: true,
    })

    try {
      await dev.waitFor(waitForFile(APP_JSON_PATH, 30_000), 'issue-340-hoist app.json generated')
      await dev.waitFor(waitForFile(APP_JS_PATH, 30_000), 'initial app.js generated')
      await dev.waitFor(waitForFile(SHARED_CHUNK_PATH, 30_000), 'initial shared chunk generated')
      await dev.waitFor(waitForFile(ITEM_PAGE_JS_PATH, 30_000), 'initial item page script generated')
      await dev.waitFor(waitForFile(USER_PAGE_JS_PATH, 30_000), 'initial user page script generated')

      await fs.writeFile(SHARED_SOURCE_PATH, updatedSharedSource, 'utf8')

      const sharedChunkContent = await dev.waitFor(
        waitForFileContains(SHARED_CHUNK_PATH, marker),
        'updated shared chunk marker',
      )
      expect(sharedChunkContent).toContain(marker)

      const [appJsonExists, appJs, itemPageJs, userPageJs] = await Promise.all([
        fs.pathExists(APP_JSON_PATH),
        fs.readFile(APP_JS_PATH, 'utf8'),
        fs.readFile(ITEM_PAGE_JS_PATH, 'utf8'),
        fs.readFile(USER_PAGE_JS_PATH, 'utf8'),
      ])

      expect(appJsonExists).toBe(true)
      expect(appJs).not.toContain('node_modules/wevu/dist/index.js')
      expect(itemPageJs).toContain('require("../../../issue-340-shared.js")')
      expect(userPageJs).toContain('require("../../../issue-340-shared.js")')
      expect(itemPageJs).not.toContain('node_modules/wevu/dist/index.js')
      expect(userPageJs).not.toContain('node_modules/wevu/dist/index.js')
    }
    finally {
      await dev.stop(5_000)
      await fs.writeFile(CONFIG_PATH, originalConfig, 'utf8')
      await fs.writeFile(SHARED_SOURCE_PATH, originalSharedSource, 'utf8')
      await fs.remove(DIST_ROOT)
    }
  })
})
