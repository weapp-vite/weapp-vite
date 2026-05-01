import { fs } from '@weapp-core/shared/node'
import path from 'pathe'
import { startDevProcess } from '../utils/dev-process'
import { cleanupResidualDevProcesses } from '../utils/dev-process-cleanup'
import { createDevProcessEnv } from '../utils/dev-process-env'
import { createHmrMarker, replaceFileByRename, resolvePlatforms } from '../utils/hmr-helpers'
import { toRelativeImport, waitForWevuVendorChunkContaining } from '../utils/wevu-vendor'
import { APP_ROOT, CLI_PATH, DIST_ROOT, waitForFile } from '../wevu-runtime.utils'

const SHARED_STORE_SOURCE_PATH = path.join(APP_ROOT, 'src/shared/store.ts')
const STORE_PAGE_JS_PATH = path.join(DIST_ROOT, 'pages/store/index.js')
const STORE_SHARE_PAGE_JS_PATH = path.join(DIST_ROOT, 'pages/store-share/index.js')
const PLATFORM_LIST = resolvePlatforms()

function replaceSharedStoreMarker(source: string, marker: string) {
  const updated = source.replace(`const name = ref('init')`, `const name = ref('${marker}')`)
  if (updated === source) {
    throw new Error('Failed to inject HMR marker into shared store source.')
  }
  return updated
}

async function waitForCommonMarkerWithRetry(
  marker: string,
  retrySourceContent: string,
) {
  try {
    return await waitForWevuVendorChunkContaining(DIST_ROOT, marker, 20_000)
  }
  catch {
    await replaceFileByRename(SHARED_STORE_SOURCE_PATH, `${retrySourceContent}\n`)
    return await waitForWevuVendorChunkContaining(DIST_ROOT, marker, 20_000)
  }
}

beforeEach(async () => {
  await cleanupResidualDevProcesses()
})

afterEach(async () => {
  await cleanupResidualDevProcesses()
})

describe.sequential('HMR shared runtime dependencies (dev watch)', () => {
  it.each(PLATFORM_LIST)('keeps shared runtime exports stable after rename-save updates (%s)', async (platform) => {
    await fs.remove(DIST_ROOT)

    const originalSource = await fs.readFile(SHARED_STORE_SOURCE_PATH, 'utf8')
    const marker = createHmrMarker('SHARED-RUNTIME-RENAME', platform)
    const updatedSource = replaceSharedStoreMarker(originalSource, marker)

    const dev = startDevProcess('node', ['--import', 'tsx', CLI_PATH, 'dev', APP_ROOT, '--platform', platform, '--skipNpm'], {
      env: createDevProcessEnv(),
      all: true,
    })

    try {
      await dev.waitFor(waitForFile(path.join(DIST_ROOT, 'app.json'), 90_000), `${platform} app.json generated`)
      await dev.waitFor(waitForWevuVendorChunkContaining(DIST_ROOT, 'setupCounter', 90_000), `${platform} initial shared runtime`)
      await dev.waitFor(waitForFile(STORE_PAGE_JS_PATH, 90_000), `${platform} initial store page js`)
      await dev.waitFor(waitForFile(STORE_SHARE_PAGE_JS_PATH, 90_000), `${platform} initial store-share page js`)

      await replaceFileByRename(SHARED_STORE_SOURCE_PATH, updatedSource)

      const sharedRuntime = await dev.waitFor(
        waitForCommonMarkerWithRetry(marker, updatedSource),
        `${platform} updated shared store marker`,
      )
      const commonJs = sharedRuntime.code
      expect(commonJs).toContain(marker)
      expect(commonJs).toContain('setupCounter')
      expect(commonJs).toContain('optionsCounter')

      const [storePageJs, storeSharePageJs] = await Promise.all([
        fs.readFile(STORE_PAGE_JS_PATH, 'utf8'),
        fs.readFile(STORE_SHARE_PAGE_JS_PATH, 'utf8'),
      ])

      expect(storePageJs).toContain(`require("${toRelativeImport(STORE_PAGE_JS_PATH, sharedRuntime.path)}")`)
      expect(storeSharePageJs).toContain(`require("${toRelativeImport(STORE_SHARE_PAGE_JS_PATH, sharedRuntime.path)}")`)
      expect(dev.getOutput()).not.toContain('Build failed')
    }
    finally {
      await dev.stop(5_000)
      await fs.writeFile(SHARED_STORE_SOURCE_PATH, originalSource, 'utf8')
    }
  })

  it.each(PLATFORM_LIST)('converges to the last shared runtime update after rapid rename-save writes (%s)', async (platform) => {
    await fs.remove(DIST_ROOT)

    const originalSource = await fs.readFile(SHARED_STORE_SOURCE_PATH, 'utf8')
    const firstMarker = createHmrMarker('SHARED-RUNTIME-FIRST', platform)
    const secondMarker = createHmrMarker('SHARED-RUNTIME-SECOND', platform)
    const firstUpdatedSource = replaceSharedStoreMarker(originalSource, firstMarker)
    const secondUpdatedSource = replaceSharedStoreMarker(originalSource, secondMarker)

    const dev = startDevProcess('node', ['--import', 'tsx', CLI_PATH, 'dev', APP_ROOT, '--platform', platform, '--skipNpm'], {
      env: createDevProcessEnv(),
      all: true,
    })

    try {
      await dev.waitFor(waitForFile(path.join(DIST_ROOT, 'app.json'), 90_000), `${platform} app.json generated`)
      await dev.waitFor(waitForWevuVendorChunkContaining(DIST_ROOT, 'setupCounter', 90_000), `${platform} initial shared runtime`)

      await replaceFileByRename(SHARED_STORE_SOURCE_PATH, firstUpdatedSource)
      await replaceFileByRename(SHARED_STORE_SOURCE_PATH, secondUpdatedSource)

      const sharedRuntime = await dev.waitFor(
        waitForCommonMarkerWithRetry(secondMarker, secondUpdatedSource),
        `${platform} updated shared store second marker`,
      )
      const commonJs = sharedRuntime.code
      expect(commonJs).toContain(secondMarker)
      expect(commonJs).not.toContain(firstMarker)
      expect(commonJs).toContain('setupCounter')
      expect(commonJs).toContain('optionsCounter')
      expect(dev.getOutput()).not.toContain('Build failed')
    }
    finally {
      await dev.stop(5_000)
      await fs.writeFile(SHARED_STORE_SOURCE_PATH, originalSource, 'utf8')
    }
  })
})
