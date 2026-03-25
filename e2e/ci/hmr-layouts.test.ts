import fs from 'fs-extra'
import path from 'pathe'
import { startDevProcess } from '../utils/dev-process'
import { cleanupResidualDevProcesses } from '../utils/dev-process-cleanup'
import { createDevProcessEnv } from '../utils/dev-process-env'
import { createHmrMarker, PLATFORM_EXT, replaceFileByRename, resolvePlatforms, waitForFileContains } from '../utils/hmr-helpers'
import { waitForFile } from '../wevu-runtime.utils'

const CLI_PATH = path.resolve(import.meta.dirname, '../../packages/weapp-vite/bin/weapp-vite.js')
const APP_ROOT = path.resolve(import.meta.dirname, '../../e2e-apps/wevu-runtime-e2e')
const DIST_ROOT = path.join(APP_ROOT, 'dist')

const LAYOUTS_PAGE_JSON_DIST = path.join(DIST_ROOT, 'pages/layouts/index.json')
const LAYOUTS_PAGE_TEMPLATE_DIST = (platform: string) => path.join(DIST_ROOT, `pages/layouts/index.${PLATFORM_EXT[platform as keyof typeof PLATFORM_EXT].template}`)
const LAYOUTS_PAGE_STYLE_DIST = (platform: string) => path.join(DIST_ROOT, `pages/layouts/index.${PLATFORM_EXT[platform as keyof typeof PLATFORM_EXT].style}`)

interface LayoutHmrCase {
  name: string
  sourcePath: string
  getDistPath: (platform: string) => string
  initialMarker: string
}

const HMR_CASES: LayoutHmrCase[] = [
  {
    name: 'page template',
    sourcePath: path.join(APP_ROOT, 'src/pages/layouts/index.wxml'),
    getDistPath: platform => LAYOUTS_PAGE_TEMPLATE_DIST(platform),
    initialMarker: 'LAYOUTS-PAGE-TEMPLATE-BASE',
  },
  {
    name: 'page style',
    sourcePath: path.join(APP_ROOT, 'src/pages/layouts/index.wxss'),
    getDistPath: platform => LAYOUTS_PAGE_STYLE_DIST(platform),
    initialMarker: 'LAYOUTS-PAGE-STYLE-BASE',
  },
  {
    name: 'page script',
    sourcePath: path.join(APP_ROOT, 'src/pages/layouts/index.ts'),
    getDistPath: () => path.join(DIST_ROOT, 'pages/layouts/index.js'),
    initialMarker: 'LAYOUTS-PAGE-SCRIPT-BASE',
  },
  {
    name: 'page json',
    sourcePath: path.join(APP_ROOT, 'src/pages/layouts/index.json'),
    getDistPath: () => path.join(DIST_ROOT, 'pages/layouts/index.json'),
    initialMarker: 'LAYOUTS-PAGE-JSON-BASE',
  },
  {
    name: 'default layout template',
    sourcePath: path.join(APP_ROOT, 'src/layouts/default/index.wxml'),
    getDistPath: platform => path.join(DIST_ROOT, `layouts/default/index.${PLATFORM_EXT[platform as keyof typeof PLATFORM_EXT].template}`),
    initialMarker: 'DEFAULT-LAYOUT-TEMPLATE-BASE',
  },
  {
    name: 'default layout style',
    sourcePath: path.join(APP_ROOT, 'src/layouts/default/index.wxss'),
    getDistPath: platform => path.join(DIST_ROOT, `layouts/default/index.${PLATFORM_EXT[platform as keyof typeof PLATFORM_EXT].style}`),
    initialMarker: 'DEFAULT-LAYOUT-STYLE-BASE',
  },
  {
    name: 'default layout script',
    sourcePath: path.join(APP_ROOT, 'src/layouts/default/index.ts'),
    getDistPath: () => path.join(DIST_ROOT, 'layouts/default/index.js'),
    initialMarker: 'DEFAULT-LAYOUT-SCRIPT-BASE',
  },
  {
    name: 'default layout json',
    sourcePath: path.join(APP_ROOT, 'src/layouts/default/index.json'),
    getDistPath: () => path.join(DIST_ROOT, 'layouts/default/index.json'),
    initialMarker: 'DEFAULT-LAYOUT-JSON-BASE',
  },
  {
    name: 'admin layout template',
    sourcePath: path.join(APP_ROOT, 'src/layouts/admin/index.wxml'),
    getDistPath: platform => path.join(DIST_ROOT, `layouts/admin/index.${PLATFORM_EXT[platform as keyof typeof PLATFORM_EXT].template}`),
    initialMarker: 'ADMIN-LAYOUT-TEMPLATE-BASE',
  },
  {
    name: 'admin layout style',
    sourcePath: path.join(APP_ROOT, 'src/layouts/admin/index.wxss'),
    getDistPath: platform => path.join(DIST_ROOT, `layouts/admin/index.${PLATFORM_EXT[platform as keyof typeof PLATFORM_EXT].style}`),
    initialMarker: 'ADMIN-LAYOUT-STYLE-BASE',
  },
  {
    name: 'admin layout script',
    sourcePath: path.join(APP_ROOT, 'src/layouts/admin/index.ts'),
    getDistPath: () => path.join(DIST_ROOT, 'layouts/admin/index.js'),
    initialMarker: 'ADMIN-LAYOUT-SCRIPT-BASE',
  },
  {
    name: 'admin layout json',
    sourcePath: path.join(APP_ROOT, 'src/layouts/admin/index.json'),
    getDistPath: () => path.join(DIST_ROOT, 'layouts/admin/index.json'),
    initialMarker: 'ADMIN-LAYOUT-JSON-BASE',
  },
]

const PLATFORM_LIST = resolvePlatforms()

async function waitForMarkerWithRetry(options: {
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

async function waitForLayoutsOutputs(platform: string) {
  await waitForFile(path.join(DIST_ROOT, 'app.json'), 30_000)
  await waitForFileContains(LAYOUTS_PAGE_JSON_DIST, '/layouts/default/index')
  await waitForFileContains(LAYOUTS_PAGE_JSON_DIST, '/layouts/admin/index')
  await waitForFileContains(LAYOUTS_PAGE_TEMPLATE_DIST(platform), 'weapp-layout-default')
  await waitForFileContains(LAYOUTS_PAGE_TEMPLATE_DIST(platform), 'weapp-layout-admin')
}

describe.sequential('HMR layouts matrix (dev watch)', () => {
  it.each(PLATFORM_LIST)('updates layouts matrix for %s', async (platform) => {
    await fs.remove(DIST_ROOT)

    // @ts-expect-error execa v9 overload resolution
    const dev = startDevProcess('node', ['--import', 'tsx', CLI_PATH, 'dev', APP_ROOT, '--platform', platform, '--skipNpm'], {
      env: createDevProcessEnv(),
      stdio: 'pipe',
    })

    try {
      await dev.waitFor(waitForLayoutsOutputs(platform), `${platform} layouts page outputs generated`)

      for (const testCase of HMR_CASES) {
        const originalSource = await fs.readFile(testCase.sourcePath, 'utf8')
        const marker = createHmrMarker(`LAYOUTS-${testCase.name.replaceAll(' ', '-').toUpperCase()}`, platform)
        const updatedSource = originalSource.replace(testCase.initialMarker, marker)

        if (updatedSource === originalSource) {
          throw new Error(`Failed to insert marker for ${testCase.name}.`)
        }

        const distPath = testCase.getDistPath(platform)

        await dev.waitFor(
          waitForFileContains(distPath, testCase.initialMarker),
          `${platform} initial ${testCase.name} output`,
        )

        await replaceFileByRename(testCase.sourcePath, updatedSource)

        const updatedContent = await waitForMarkerWithRetry({
          dev,
          distPath,
          marker,
          retrySourcePath: testCase.sourcePath,
          retrySourceContent: updatedSource,
          description: `${platform} updated ${testCase.name} marker`,
        })
        expect(updatedContent).toContain(marker)

        await replaceFileByRename(testCase.sourcePath, originalSource)

        const restoredContent = await waitForMarkerWithRetry({
          dev,
          distPath,
          marker: testCase.initialMarker,
          retrySourcePath: testCase.sourcePath,
          retrySourceContent: originalSource,
          description: `${platform} restored ${testCase.name} marker`,
        })
        expect(restoredContent).toContain(testCase.initialMarker)
      }
    }
    finally {
      await dev.stop(5_000)
    }
  })
})
