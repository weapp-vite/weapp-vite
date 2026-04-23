import { access, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import path from 'pathe'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { startDevProcess } from '../utils/dev-process'
import { cleanupResidualDevProcesses } from '../utils/dev-process-cleanup'
import { createDevProcessEnv } from '../utils/dev-process-env'
import { createHmrMarker, replaceFileByRename, resolvePlatforms } from '../utils/hmr-helpers'
import { waitForFile } from '../wevu-runtime.utils'

const CLI_PATH = path.resolve(import.meta.dirname, '../../packages/weapp-vite/bin/weapp-vite.js')
const APP_ROOT = path.resolve(import.meta.dirname, '../../e2e-apps/issue-340-hoist')
const DIST_ROOT = path.join(APP_ROOT, 'dist')
const CONFIG_PATH = path.join(APP_ROOT, 'weapp-vite.config.ts')
const SHARED_SOURCE_PATH = path.join(APP_ROOT, 'src/shared/issue-340-shared.ts')
const APP_JS_PATH = path.join(DIST_ROOT, 'app.js')
const APP_JSON_PATH = path.join(DIST_ROOT, 'app.json')
const ITEM_PAGE_JS_PATH = path.join(DIST_ROOT, 'subpackages/item/login-required/index.js')
const USER_PAGE_JS_PATH = path.join(DIST_ROOT, 'subpackages/user/register/form.js')
const PLATFORM_LIST = resolvePlatforms()

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

function applyCommentChunkConfig(config: string) {
  if (!config.includes(ORIGINAL_CHUNK_CONFIG)) {
    throw new Error('Failed to find the original chunk config block for issue-340-hoist.')
  }

  return config.replace(ORIGINAL_CHUNK_CONFIG, COMMENT_CHUNK_CONFIG)
}

async function pathExists(filePath: string) {
  try {
    await access(filePath)
    return true
  }
  catch {
    return false
  }
}

async function collectJsFiles(root: string): Promise<string[]> {
  const entries = await readdir(root, { withFileTypes: true })
  const files = await Promise.all(entries.map(async (entry) => {
    const entryPath = path.join(root, entry.name)
    if (entry.isDirectory()) {
      return collectJsFiles(entryPath)
    }
    return entry.isFile() && entry.name.endsWith('.js') ? [entryPath] : []
  }))
  return files.flat()
}

async function findSharedCarrierFiles(marker: string) {
  const jsFiles = await collectJsFiles(DIST_ROOT)
  const matched: string[] = []

  for (const filePath of jsFiles) {
    const content = await readFile(filePath, 'utf8')
    if (content.includes(marker)) {
      matched.push(filePath)
    }
  }

  return matched.sort()
}

async function waitForSharedCarrierFiles(
  marker: string,
  timeoutMs = 90_000,
) {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    const matched = await findSharedCarrierFiles(marker)
    if (matched.length > 0) {
      return matched
    }
    await new Promise(resolve => setTimeout(resolve, 250))
  }
  throw new Error(`Timed out waiting for shared outputs to contain marker: ${marker}`)
}

async function waitForSharedCarrierFilesWithoutMarker(
  marker: string,
  timeoutMs = 90_000,
) {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    const matched = await findSharedCarrierFiles(marker)
    if (matched.length === 0) {
      return
    }
    await new Promise(resolve => setTimeout(resolve, 250))
  }
  throw new Error(`Timed out waiting for shared outputs to remove marker: ${marker}`)
}

beforeEach(async () => {
  await cleanupResidualDevProcesses()
})

afterEach(async () => {
  await cleanupResidualDevProcesses()
})

describe.sequential('issue #340 comment regression (dev watch)', () => {
  it.each(PLATFORM_LIST)('keeps app and cross-subpackage shared outputs stable after a shared-source edit (%s)', async (platform) => {
    await rm(DIST_ROOT, { recursive: true, force: true })

    const originalConfig = await readFile(CONFIG_PATH, 'utf8')
    const originalSharedSource = await readFile(SHARED_SOURCE_PATH, 'utf8')
    const marker = createHmrMarker('ISSUE-340-COMMENT', platform)

    const updatedConfig = applyCommentChunkConfig(originalConfig)
    const updatedSharedSourceWithCjsImport = originalSharedSource
      .replace(
        `import { computed, ref } from 'wevu'`,
        [
          `import { computed, ref } from 'wevu'`,
          `import merge from 'merge'`,
        ].join('\n'),
      )
      .replace(
        ['const scoped = computed(() => `', '$', '{scope}', ':', '$', '{issue340Seed.value}', ':shared`)'].join(''),
        [
          'const scoped = computed(() => {',
          '  const payload = merge(true, { scope }, { seed: issue340Seed.value })',
          ['  return `', '$', '{payload.scope}', ':', '$', '{payload.seed}', ':shared`'].join(''),
          '})',
        ].join('\n'),
      )
    const updatedSharedSource = updatedSharedSourceWithCjsImport.replace(`ref('issue-340-hoist')`, `ref('${marker}')`)

    if (updatedSharedSource === originalSharedSource) {
      throw new Error('Failed to inject HMR marker into issue-340 shared source.')
    }

    await writeFile(CONFIG_PATH, updatedConfig, 'utf8')

    const dev = startDevProcess('node', ['--import', 'tsx', CLI_PATH, 'dev', APP_ROOT, '--platform', platform, '--skipNpm'], {
      env: {
        ...createDevProcessEnv(),
        DEBUG: 'weapp-vite:load-entry',
      },
      all: true,
    })

    try {
      await dev.waitFor(waitForFile(APP_JSON_PATH, 240_000), `${platform} issue-340-hoist app.json generated`)
      await dev.waitFor(waitForFile(APP_JS_PATH, 240_000), `${platform} initial app.js generated`)
      await dev.waitFor(waitForFile(ITEM_PAGE_JS_PATH, 240_000), `${platform} initial item page script generated`)
      await dev.waitFor(waitForFile(USER_PAGE_JS_PATH, 240_000), `${platform} initial user page script generated`)
      await dev.waitForOutput('开发服务已就绪', `${platform} dev server ready banner`)

      expect((await findSharedCarrierFiles('issue-340-hoist')).length).toBeGreaterThan(0)

      await replaceFileByRename(SHARED_SOURCE_PATH, updatedSharedSource)

      const updatedSharedCarrierFiles = await dev.waitFor(waitForSharedCarrierFiles(
        marker,
      ), `${platform} updated shared output marker`)
      const sharedOutputContents = await Promise.all(updatedSharedCarrierFiles.map(filePath => readFile(filePath, 'utf8')))
      sharedOutputContents.forEach(content => expect(content).toContain(marker))

      const [appJsonExists, appJs, itemPageJs, userPageJs] = await Promise.all([
        pathExists(APP_JSON_PATH),
        readFile(APP_JS_PATH, 'utf8'),
        readFile(ITEM_PAGE_JS_PATH, 'utf8'),
        readFile(USER_PAGE_JS_PATH, 'utf8'),
      ])

      expect(appJsonExists).toBe(true)
      expect(appJs).not.toContain('node_modules/wevu/dist/index.js')
      expect(itemPageJs).not.toContain('node_modules/wevu/dist/index.js')
      expect(userPageJs).not.toContain('node_modules/wevu/dist/index.js')
    }
    finally {
      await dev.stop(5_000)
      await writeFile(CONFIG_PATH, originalConfig, 'utf8')
      await writeFile(SHARED_SOURCE_PATH, originalSharedSource, 'utf8')
      await rm(DIST_ROOT, { recursive: true, force: true })
    }
  })

  it.each(PLATFORM_LIST)('converges to the last cross-subpackage shared output after rapid shared-source edits (%s)', async (platform) => {
    await rm(DIST_ROOT, { recursive: true, force: true })

    const originalConfig = await readFile(CONFIG_PATH, 'utf8')
    const originalSharedSource = await readFile(SHARED_SOURCE_PATH, 'utf8')
    const firstMarker = createHmrMarker('ISSUE-340-FIRST', platform)
    const secondMarker = createHmrMarker('ISSUE-340-SECOND', platform)
    const firstUpdatedSource = originalSharedSource.replace(`ref('issue-340-hoist')`, `ref('${firstMarker}')`)
    const secondUpdatedSource = originalSharedSource.replace(`ref('issue-340-hoist')`, `ref('${secondMarker}')`)
    const updatedConfig = applyCommentChunkConfig(originalConfig)

    if (firstUpdatedSource === originalSharedSource || secondUpdatedSource === originalSharedSource) {
      throw new Error('Failed to inject rapid HMR markers into issue-340 shared source.')
    }

    await writeFile(CONFIG_PATH, updatedConfig, 'utf8')

    const dev = startDevProcess('node', ['--import', 'tsx', CLI_PATH, 'dev', APP_ROOT, '--platform', platform, '--skipNpm'], {
      env: {
        ...createDevProcessEnv(),
        DEBUG: 'weapp-vite:load-entry',
      },
      all: true,
    })

    try {
      await dev.waitFor(waitForFile(APP_JSON_PATH, 240_000), `${platform} issue-340-hoist app.json generated`)
      await dev.waitFor(waitForFile(ITEM_PAGE_JS_PATH, 240_000), `${platform} initial item page script generated`)
      await dev.waitFor(waitForFile(USER_PAGE_JS_PATH, 240_000), `${platform} initial user page script generated`)
      await dev.waitForOutput('开发服务已就绪', `${platform} dev server ready banner`)

      expect((await findSharedCarrierFiles('issue-340-hoist')).length).toBeGreaterThan(0)

      await replaceFileByRename(SHARED_SOURCE_PATH, firstUpdatedSource)
      await replaceFileByRename(SHARED_SOURCE_PATH, secondUpdatedSource)

      const updatedSharedCarrierFiles = await dev.waitFor((async () => {
        await waitForSharedCarrierFilesWithoutMarker(firstMarker)
        return await waitForSharedCarrierFiles(secondMarker)
      })(), `${platform} updated second shared output marker`)
      const sharedOutputContents = await Promise.all(updatedSharedCarrierFiles.map(filePath => readFile(filePath, 'utf8')))

      sharedOutputContents.forEach((content) => {
        expect(content).toContain(secondMarker)
        expect(content).not.toContain(firstMarker)
      })
      expect(dev.getOutput()).not.toContain('Build failed')

      const [itemPageJs, userPageJs] = await Promise.all([
        readFile(ITEM_PAGE_JS_PATH, 'utf8'),
        readFile(USER_PAGE_JS_PATH, 'utf8'),
      ])

      expect(itemPageJs).not.toContain('node_modules/wevu/dist/index.js')
      expect(userPageJs).not.toContain('node_modules/wevu/dist/index.js')
    }
    finally {
      await dev.stop(5_000)
      await writeFile(CONFIG_PATH, originalConfig, 'utf8')
      await writeFile(SHARED_SOURCE_PATH, originalSharedSource, 'utf8')
      await rm(DIST_ROOT, { recursive: true, force: true })
    }
  })
})
