import { fs } from '@weapp-core/shared/node'
import path from 'pathe'
import { startDevProcess } from '../utils/dev-process'
import { cleanupResidualDevProcesses } from '../utils/dev-process-cleanup'
import { createDevProcessEnv } from '../utils/dev-process-env'
import {
  createHmrMarker,
  PLATFORM_EXT,
  replaceFileByRename,
  replaceSfcTitleMarker,
  resolvePlatforms,
  waitForFileContains,
} from '../utils/hmr-helpers'
import { APP_ROOT, CLI_PATH, DIST_ROOT, waitForFile } from '../wevu-runtime.utils'

const HMR_SRC_DIR = path.join(APP_ROOT, 'src/pages/hmr')
const SRC_TEMPLATE = path.join(HMR_SRC_DIR, 'index.wxml')
const SRC_STYLE = path.join(HMR_SRC_DIR, 'index.wxss')
const SRC_SCRIPT = path.join(HMR_SRC_DIR, 'index.ts')
const SRC_JSON = path.join(HMR_SRC_DIR, 'index.json')
const SFC_SRC_PATH = path.join(APP_ROOT, 'src/pages/hmr-sfc/index.vue')

const PLATFORM_LIST = resolvePlatforms()

async function waitForRenameMarkerWithRetry(options: {
  dev: ReturnType<typeof startDevProcess>
  description: string
  distPath: string
  marker: string
  retrySourcePath: string
  retrySourceContent: string
  timeoutMs?: number
}) {
  const {
    dev,
    description,
    distPath,
    marker,
    retrySourcePath,
    retrySourceContent,
    timeoutMs = 20_000,
  } = options

  try {
    return await dev.waitFor(
      waitForFileContains(distPath, marker, timeoutMs),
      description,
    )
  }
  catch {
    await replaceFileByRename(retrySourcePath, `${retrySourceContent}\n`)
    return await dev.waitFor(
      waitForFileContains(distPath, marker),
      `${description} (retry)`,
    )
  }
}

beforeEach(async () => {
  await cleanupResidualDevProcesses()
})

afterEach(async () => {
  await cleanupResidualDevProcesses()
})

describe.sequential('HMR rename-style save (dev watch)', () => {
  it.each(PLATFORM_LIST)('通过 rename-save 更新 .wxml 模板文件 (%s)', async (platform) => {
    await fs.remove(DIST_ROOT)
    const originalSource = await fs.readFile(SRC_TEMPLATE, 'utf8')
    const ext = PLATFORM_EXT[platform]
    const distPath = path.join(DIST_ROOT, `pages/hmr/index.${ext.template}`)
    const marker = createHmrMarker('RENAME-TEMPLATE', platform)
    const updatedSource = originalSource.replace('HMR', marker)

    // @ts-expect-error execa v9 overload resolution
    const dev = startDevProcess('node', ['--import', 'tsx', CLI_PATH, 'dev', APP_ROOT, '--platform', platform, '--skipNpm'], {
      env: createDevProcessEnv(),
      all: true,
    })

    try {
      await dev.waitFor(waitForFile(path.join(DIST_ROOT, 'app.json'), 30_000), `${platform} app.json generated`)
      await dev.waitFor(waitForFileContains(distPath, 'HMR'), `${platform} initial template`)

      await replaceFileByRename(SRC_TEMPLATE, updatedSource)

      const content = await waitForRenameMarkerWithRetry({
        dev,
        distPath,
        marker,
        retrySourcePath: SRC_TEMPLATE,
        retrySourceContent: updatedSource,
        description: `${platform} rename-saved template marker`,
      })
      expect(content).toContain(marker)
    }
    finally {
      await dev.stop(5_000)
      await replaceFileByRename(SRC_TEMPLATE, originalSource)
    }
  })

  it.each(PLATFORM_LIST)('通过 rename-save 更新 .wxss 样式文件 (%s)', async (platform) => {
    await fs.remove(DIST_ROOT)
    const originalSource = await fs.readFile(SRC_STYLE, 'utf8')
    const ext = PLATFORM_EXT[platform]
    const distPath = path.join(DIST_ROOT, `pages/hmr/index.${ext.style}`)
    const marker = createHmrMarker('RENAME-STYLE', platform)
    const updatedSource = originalSource.replace('.page {', `.page { /* ${marker} */`)

    // @ts-expect-error execa v9 overload resolution
    const dev = startDevProcess('node', ['--import', 'tsx', CLI_PATH, 'dev', APP_ROOT, '--platform', platform, '--skipNpm'], {
      env: createDevProcessEnv(),
      stdio: 'inherit',
    })

    try {
      await dev.waitFor(waitForFile(path.join(DIST_ROOT, 'app.json'), 30_000), `${platform} app.json generated`)
      await dev.waitFor(waitForFileContains(distPath, '.page'), `${platform} initial style`)

      await replaceFileByRename(SRC_STYLE, updatedSource)

      const content = await waitForRenameMarkerWithRetry({
        dev,
        distPath,
        marker,
        retrySourcePath: SRC_STYLE,
        retrySourceContent: updatedSource,
        description: `${platform} rename-saved style marker`,
      })
      expect(content).toContain(marker)
    }
    finally {
      await dev.stop(5_000)
      await replaceFileByRename(SRC_STYLE, originalSource)
    }
  })

  it.each(PLATFORM_LIST)('通过 rename-save 更新 .ts 脚本文件 (%s)', async (platform) => {
    await fs.remove(DIST_ROOT)
    const originalSource = await fs.readFile(SRC_SCRIPT, 'utf8')
    const distPath = path.join(DIST_ROOT, 'pages/hmr/index.js')
    const marker = createHmrMarker('RENAME-SCRIPT', platform)
    const updatedSource = originalSource.replace(`buildResult('hmr',`, `buildResult('${marker}',`)

    // @ts-expect-error execa v9 overload resolution
    const dev = startDevProcess('node', ['--import', 'tsx', CLI_PATH, 'dev', APP_ROOT, '--platform', platform, '--skipNpm'], {
      env: createDevProcessEnv(),
      stdio: 'inherit',
    })

    try {
      await dev.waitFor(waitForFile(path.join(DIST_ROOT, 'app.json'), 30_000), `${platform} app.json generated`)
      await dev.waitFor(waitForFile(distPath, 30_000), `${platform} initial script output`)

      await replaceFileByRename(SRC_SCRIPT, updatedSource)

      const content = await waitForRenameMarkerWithRetry({
        dev,
        distPath,
        marker,
        retrySourcePath: SRC_SCRIPT,
        retrySourceContent: updatedSource,
        description: `${platform} rename-saved script marker`,
      })
      expect(content).toContain(marker)
      expect(dev.getOutput()).not.toContain('Build failed')
    }
    finally {
      await dev.stop(5_000)
      await replaceFileByRename(SRC_SCRIPT, originalSource)
    }
  })

  it.each(PLATFORM_LIST)('通过 rename-save 更新 .json 配置文件 (%s)', async (platform) => {
    await fs.remove(DIST_ROOT)
    const originalSource = await fs.readFile(SRC_JSON, 'utf8')
    const distPath = path.join(DIST_ROOT, 'pages/hmr/index.json')
    const marker = createHmrMarker('RENAME-JSON', platform)
    const nextJson = JSON.parse(originalSource)
    nextJson.hmrMarker = marker
    const updatedSource = `${JSON.stringify(nextJson, null, 2)}\n`

    // @ts-expect-error execa v9 overload resolution
    const dev = startDevProcess('node', ['--import', 'tsx', CLI_PATH, 'dev', APP_ROOT, '--platform', platform, '--skipNpm'], {
      env: createDevProcessEnv(),
      stdio: 'inherit',
    })

    try {
      await dev.waitFor(waitForFile(path.join(DIST_ROOT, 'app.json'), 30_000), `${platform} app.json generated`)
      await dev.waitFor(waitForFileContains(distPath, 'component'), `${platform} initial json`)

      await replaceFileByRename(SRC_JSON, updatedSource)

      const content = await waitForRenameMarkerWithRetry({
        dev,
        distPath,
        marker,
        retrySourcePath: SRC_JSON,
        retrySourceContent: updatedSource,
        description: `${platform} rename-saved json marker`,
      })
      expect(content).toContain(marker)
    }
    finally {
      await dev.stop(5_000)
      await replaceFileByRename(SRC_JSON, originalSource)
    }
  })

  it.each(PLATFORM_LIST)('通过 rename-save 更新 .vue SFC 文件 (%s)', async (platform) => {
    await fs.remove(DIST_ROOT)
    const originalSource = await fs.readFile(SFC_SRC_PATH, 'utf8')
    const ext = PLATFORM_EXT[platform]
    const distPath = path.join(DIST_ROOT, `pages/hmr-sfc/index.${ext.template}`)
    const marker = createHmrMarker('RENAME-SFC', platform)
    const updatedSource = replaceSfcTitleMarker(originalSource, marker)

    // @ts-expect-error execa v9 overload resolution
    const dev = startDevProcess('node', ['--import', 'tsx', CLI_PATH, 'dev', APP_ROOT, '--platform', platform, '--skipNpm'], {
      env: createDevProcessEnv(),
      stdio: 'inherit',
    })

    try {
      await dev.waitFor(waitForFile(path.join(DIST_ROOT, 'app.json'), 30_000), `${platform} app.json generated`)
      await dev.waitFor(waitForFileContains(distPath, 'HMR-SFC'), `${platform} initial SFC template`)

      await replaceFileByRename(SFC_SRC_PATH, updatedSource)

      const content = await waitForRenameMarkerWithRetry({
        dev,
        distPath,
        marker,
        retrySourcePath: SFC_SRC_PATH,
        retrySourceContent: updatedSource,
        description: `${platform} rename-saved SFC marker`,
      })
      expect(content).toContain(marker)
    }
    finally {
      await dev.stop(5_000)
      await replaceFileByRename(SFC_SRC_PATH, originalSource)
    }
  })
})
