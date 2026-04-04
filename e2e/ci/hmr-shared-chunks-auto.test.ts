import { fs } from '@weapp-core/shared'
import path from 'pathe'
import { startDevProcess } from '../utils/dev-process'
import { cleanupResidualDevProcesses } from '../utils/dev-process-cleanup'
import { createDevProcessEnv } from '../utils/dev-process-env'
import { createHmrMarker, replaceFileByRename, waitForFileContains } from '../utils/hmr-helpers'
import { APP_ROOT, CLI_PATH, DIST_ROOT, waitForFile } from '../wevu-runtime.utils'

const PAGE_HMR_SOURCE_PATH = path.join(APP_ROOT, 'src/pages/hmr/index.ts')
const SHARED_STORE_SOURCE_PATH = path.join(APP_ROOT, 'src/shared/store.ts')
const PAGE_HMR_DIST_PATH = path.join(DIST_ROOT, 'pages/hmr/index.js')
const SHARED_COMMON_DIST_PATH = path.join(DIST_ROOT, 'common.js')

beforeEach(async () => {
  await cleanupResidualDevProcesses()
})

afterEach(async () => {
  await cleanupResidualDevProcesses()
})

describe.sequential('hmr sharedChunks auto diagnostics (dev watch)', () => {
  it('keeps direct page edits incremental without emitAll', async () => {
    await fs.remove(DIST_ROOT)
    const originalSource = await fs.readFile(PAGE_HMR_SOURCE_PATH, 'utf8')
    const marker = createHmrMarker('AUTO-DIRECT', 'weapp')
    const updatedSource = originalSource.replace(`buildResult('hmr',`, `buildResult('${marker}',`)
    if (updatedSource === originalSource) {
      throw new Error('Failed to insert direct-update marker into hmr page source.')
    }

    const dev = startDevProcess('node', ['--import', 'tsx', CLI_PATH, 'dev', APP_ROOT, '--platform', 'weapp', '--skipNpm'], {
      env: {
        ...createDevProcessEnv(),
        DEBUG: 'weapp-vite:load-entry',
      },
      all: true,
    })

    try {
      await dev.waitFor(waitForFile(path.join(DIST_ROOT, 'app.json'), 30_000), 'weapp app.json generated')
      await dev.waitFor(waitForFile(PAGE_HMR_DIST_PATH, 30_000), 'initial hmr page script')

      await replaceFileByRename(PAGE_HMR_SOURCE_PATH, updatedSource)

      let content = ''
      try {
        content = await dev.waitFor(
          waitForFileContains(PAGE_HMR_DIST_PATH, marker, 20_000),
          'updated hmr page script marker',
        )
      }
      catch {
        await replaceFileByRename(PAGE_HMR_SOURCE_PATH, `${updatedSource}\n`)
        content = await dev.waitFor(
          waitForFileContains(PAGE_HMR_DIST_PATH, marker),
          'updated hmr page script marker (retry)',
        )
      }
      expect(content).toContain(marker)

      const output = await dev.waitForOutput(
        /hmr emit dirty=1 resolved=\d+ emitAll=false pending=1/,
        'direct page edit incremental hmr log',
      )
      expect(output).toMatch(/emitAll=false pending=1/)
    }
    finally {
      await dev.stop(5_000)
      await replaceFileByRename(PAGE_HMR_SOURCE_PATH, originalSource)
    }
  })

  it('expands shared dependency edits to multiple importer entries', async () => {
    await fs.remove(DIST_ROOT)
    const originalSource = await fs.readFile(SHARED_STORE_SOURCE_PATH, 'utf8')
    const marker = createHmrMarker('AUTO-SHARED', 'weapp')
    const updatedSource = originalSource.replace(`const name = ref('init')`, `const name = ref('${marker}')`)
    if (updatedSource === originalSource) {
      throw new Error('Failed to insert shared-update marker into shared store source.')
    }

    const dev = startDevProcess('node', ['--import', 'tsx', CLI_PATH, 'dev', APP_ROOT, '--platform', 'weapp', '--skipNpm'], {
      env: {
        ...createDevProcessEnv(),
        DEBUG: 'weapp-vite:load-entry',
      },
      all: true,
    })

    try {
      await dev.waitFor(waitForFile(path.join(DIST_ROOT, 'app.json'), 30_000), 'weapp app.json generated')
      await dev.waitFor(waitForFile(SHARED_COMMON_DIST_PATH, 30_000), 'initial shared common chunk')

      await replaceFileByRename(SHARED_STORE_SOURCE_PATH, updatedSource)

      let content = ''
      try {
        content = await dev.waitFor(
          waitForFileContains(SHARED_COMMON_DIST_PATH, marker, 20_000),
          'updated shared common chunk marker',
        )
      }
      catch {
        await replaceFileByRename(SHARED_STORE_SOURCE_PATH, `${updatedSource}\n`)
        content = await dev.waitFor(
          waitForFileContains(SHARED_COMMON_DIST_PATH, marker),
          'updated shared common chunk marker (retry)',
        )
      }
      expect(content).toContain(marker)

      const output = await dev.waitForOutput(
        /hmr emit dirty=\d+ resolved=\d+ emitAll=(true|false) pending=([2-9]|\d{2,})/,
        'shared dependency edit importer expansion log',
      )
      expect(output).not.toMatch(/pending=1\b/)
    }
    finally {
      await dev.stop(5_000)
      await replaceFileByRename(SHARED_STORE_SOURCE_PATH, originalSource)
    }
  })
})
