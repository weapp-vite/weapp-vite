import { fs } from '@weapp-core/shared/node'
import path from 'pathe'
import { startDevProcess } from '../utils/dev-process'
import { cleanupResidualDevProcesses } from '../utils/dev-process-cleanup'
import { createDevProcessEnv } from '../utils/dev-process-env'
import { createHmrMarker, replaceFileByRename, waitForFileContains } from '../utils/hmr-helpers'
import { waitForWevuVendorChunkContaining } from '../utils/wevu-vendor'
import { APP_ROOT, CLI_PATH, DIST_ROOT } from '../wevu-runtime.utils'

interface HmrProfileSample {
  event?: string
  file?: string
  dirtyCount?: number
  emittedCount?: number
  pendingCount?: number
  pendingReasonSummary?: string[]
}

const CONFIG_PATH = path.join(APP_ROOT, 'weapp-vite.config.ts')
const HMR_PROFILE_PATH = path.join(APP_ROOT, '.weapp-vite/hmr-profile.jsonl')
const PAGE_HMR_SOURCE_PATH = path.join(APP_ROOT, 'src/pages/hmr/index.ts')
const PAGE_HMR_DIST_PATH = path.join(DIST_ROOT, 'pages/hmr/index.js')
const SHARED_STORE_SOURCE_PATH = path.join(APP_ROOT, 'src/shared/store.ts')
const INITIAL_BUILD_READY_RE = /小程序初次构建完成[\s\S]*开发服务已就绪/

function enableHmrProfileJson(configSource: string) {
  const injectedConfig = configSource.replace(
    `export default defineConfig({\n  weapp: {`,
    [
      `export default defineConfig({`,
      `  weapp: {`,
      `    hmr: {`,
      `      profileJson: true,`,
      `      sharedChunks: 'auto',`,
      `    },`,
    ].join('\n'),
  )

  if (injectedConfig === configSource) {
    throw new Error('Failed to inject hmr.profileJson into wevu-runtime-e2e config.')
  }

  return injectedConfig
}

async function readHmrProfileSamples() {
  if (!(await fs.pathExists(HMR_PROFILE_PATH))) {
    return [] satisfies HmrProfileSample[]
  }

  const content = await fs.readFile(HMR_PROFILE_PATH, 'utf8')
  const samples: HmrProfileSample[] = []

  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed) {
      continue
    }
    const parsed = JSON.parse(trimmed) as unknown
    if (!parsed || typeof parsed !== 'object') {
      continue
    }
    samples.push(parsed as HmrProfileSample)
  }

  return samples
}

async function waitForHmrProfileSample(
  predicate: (sample: HmrProfileSample) => boolean,
  timeoutMs = 90_000,
) {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    const samples = await readHmrProfileSamples()
    for (let index = samples.length - 1; index >= 0; index -= 1) {
      const sample = samples[index]
      if (sample && predicate(sample)) {
        return sample
      }
    }
    await new Promise(resolve => setTimeout(resolve, 250))
  }

  const samples = await readHmrProfileSamples()
  const preview = samples.slice(-3)
  throw new Error(
    `Timed out waiting for matching hmr profile sample. `
    + `pathExists=${await fs.pathExists(HMR_PROFILE_PATH)} `
    + `sampleCount=${samples.length} `
    + `recent=${JSON.stringify(preview)}`,
  )
}

beforeEach(async () => {
  await cleanupResidualDevProcesses()
  await fs.remove(HMR_PROFILE_PATH)
})

afterEach(async () => {
  await cleanupResidualDevProcesses()
  await fs.remove(HMR_PROFILE_PATH)
})

describe.sequential('hmr sharedChunks auto diagnostics (dev watch)', () => {
  it('keeps direct page edits incremental without emitAll', async () => {
    await fs.remove(DIST_ROOT)
    const originalConfig = await fs.readFile(CONFIG_PATH, 'utf8')
    const originalSource = await fs.readFile(PAGE_HMR_SOURCE_PATH, 'utf8')
    const marker = createHmrMarker('AUTO-DIRECT', 'weapp')
    const updatedSource = originalSource.replace(`buildResult('hmr',`, `buildResult('${marker}',`)
    if (updatedSource === originalSource) {
      throw new Error('Failed to insert direct-update marker into hmr page source.')
    }

    await fs.writeFile(CONFIG_PATH, enableHmrProfileJson(originalConfig), 'utf8')

    const dev = startDevProcess('node', ['--import', 'tsx', CLI_PATH, 'dev', APP_ROOT, '--platform', 'weapp', '--skipNpm'], {
      env: {
        ...createDevProcessEnv({ disableSidecarWatch: true }),
        DEBUG: 'weapp-vite:load-entry',
      },
      all: true,
    })

    try {
      await dev.waitForOutput(INITIAL_BUILD_READY_RE, 'initial mini-program dev build ready', 30_000)

      await replaceFileByRename(PAGE_HMR_SOURCE_PATH, updatedSource)

      const updatedOutput = await dev.waitFor(
        waitForFileContains(PAGE_HMR_DIST_PATH, marker),
        'direct page edit output updated',
      )
      expect(updatedOutput).toContain(marker)

      const sample = await dev.waitFor(
        waitForHmrProfileSample(profile =>
          profile.file === PAGE_HMR_SOURCE_PATH
          && (profile.event === 'create' || profile.event === 'update')
          && typeof profile.pendingCount === 'number'
          && profile.pendingCount > 1
          && typeof profile.emittedCount === 'number'
          && profile.emittedCount === profile.pendingCount
          && (profile.pendingReasonSummary ?? []).some(reason => reason.startsWith('shared-chunk(') && reason.endsWith(':direct')),
        ),
        'direct page edit shared-chunk auto hmr profile',
      )
      expect(sample.dirtyCount).toBeGreaterThan(0)
      expect(sample.pendingCount).toBeGreaterThan(1)
      expect(dev.getOutput()).toContain('小程序已重新构建（')
    }
    finally {
      await dev.stop(5_000)
      await fs.writeFile(CONFIG_PATH, originalConfig, 'utf8')
      await replaceFileByRename(PAGE_HMR_SOURCE_PATH, originalSource)
    }
  })

  it('expands shared dependency edits to multiple importer entries', async () => {
    await fs.remove(DIST_ROOT)
    const originalConfig = await fs.readFile(CONFIG_PATH, 'utf8')
    const originalSource = await fs.readFile(SHARED_STORE_SOURCE_PATH, 'utf8')
    const marker = createHmrMarker('AUTO-SHARED', 'weapp')
    const updatedSource = originalSource.replace(`const name = ref('init')`, `const name = ref('${marker}')`)
    if (updatedSource === originalSource) {
      throw new Error('Failed to insert shared-update marker into shared store source.')
    }

    await fs.writeFile(CONFIG_PATH, enableHmrProfileJson(originalConfig), 'utf8')

    const dev = startDevProcess('node', ['--import', 'tsx', CLI_PATH, 'dev', APP_ROOT, '--platform', 'weapp', '--skipNpm'], {
      env: {
        ...createDevProcessEnv({ disableSidecarWatch: true }),
        DEBUG: 'weapp-vite:load-entry',
      },
      all: true,
    })

    try {
      await dev.waitForOutput(INITIAL_BUILD_READY_RE, 'initial mini-program dev build ready', 30_000)

      await replaceFileByRename(SHARED_STORE_SOURCE_PATH, updatedSource)

      const updatedOutput = await dev.waitFor(
        waitForWevuVendorChunkContaining(DIST_ROOT, marker),
        'shared dependency output updated',
      )
      expect(updatedOutput.code).toContain(marker)

      const sample = await dev.waitFor(
        waitForHmrProfileSample(profile =>
          profile.file === SHARED_STORE_SOURCE_PATH
          && (profile.event === 'create' || profile.event === 'update')
          && typeof profile.pendingCount === 'number'
          && profile.pendingCount > 1
          && typeof profile.emittedCount === 'number'
          && profile.emittedCount > 1
          && (profile.dirtyReasonSummary ?? []).some(reason => reason.startsWith('importer-graph:')),
        ),
        'shared dependency rebuild hmr profile',
      )
      expect(sample.pendingCount).toBeGreaterThan(1)
      expect(sample.emittedCount).toBeGreaterThan(1)
      expect(dev.getOutput()).toContain('小程序已重新构建（')
    }
    finally {
      await dev.stop(5_000)
      await fs.writeFile(CONFIG_PATH, originalConfig, 'utf8')
      await replaceFileByRename(SHARED_STORE_SOURCE_PATH, originalSource)
    }
  })
})
