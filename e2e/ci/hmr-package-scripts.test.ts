import { fs } from '@weapp-core/shared/node'
import path from 'pathe'
import { describe, expect, it } from 'vitest'
import { startDevProcess } from '../utils/dev-process'
import { cleanupResidualDevProcesses } from '../utils/dev-process-cleanup'
import { createDevProcessEnv } from '../utils/dev-process-env'
import { createHmrMarker, replaceFileByRename, waitForFileContains } from '../utils/hmr-helpers'
import { waitForFile } from '../wevu-runtime.utils'

interface PackageScriptHmrCase {
  appRoot: string
  distPath: string
  env?: NodeJS.ProcessEnv
  label: string
  originalMarker: string
  script: string
  sourcePath: string
  sourceReplacement: (source: string, marker: string) => string
}

const ROOT = path.resolve(import.meta.dirname, '../..')
const PACKAGE_SCRIPT_HMR_CASES: PackageScriptHmrCase[] = [
  {
    label: 'e2e-apps/base native dev script',
    appRoot: path.resolve(ROOT, 'e2e-apps/base'),
    script: 'dev',
    sourcePath: path.resolve(ROOT, 'e2e-apps/base/src/pages/index/index.wxml'),
    distPath: path.resolve(ROOT, 'e2e-apps/base/dist/pages/index/index.wxml'),
    originalMarker: 'Hello',
    sourceReplacement: (source, marker) => source.replace('Hello', marker),
  },
  {
    label: 'apps/vite-native-ts native dev script',
    appRoot: path.resolve(ROOT, 'apps/vite-native-ts'),
    script: 'dev',
    sourcePath: path.resolve(ROOT, 'apps/vite-native-ts/miniprogram/pages/index/index.wxml'),
    distPath: path.resolve(ROOT, 'apps/vite-native-ts/dist/pages/index/index.wxml'),
    originalMarker: '首页',
    sourceReplacement: (source, marker) => source.replace('首页', marker),
  },
  {
    label: 'apps/wevu-vue-demo Vue SFC dev script',
    appRoot: path.resolve(ROOT, 'apps/wevu-vue-demo'),
    script: 'dev',
    sourcePath: path.resolve(ROOT, 'apps/wevu-vue-demo/src/pages/config-ts/index.vue'),
    distPath: path.resolve(ROOT, 'apps/wevu-vue-demo/dist/pages/config-ts/index.js'),
    originalMarker: '使用 TypeScript 编写页面配置',
    sourceReplacement: (source, marker) => source.replace('使用 TypeScript 编写页面配置', marker),
  },
]

beforeEach(async () => {
  await cleanupResidualDevProcesses()
})

afterEach(async () => {
  await cleanupResidualDevProcesses()
})

describe.sequential('HMR package scripts — apps and e2e-apps dev entrypoints', () => {
  it.each(PACKAGE_SCRIPT_HMR_CASES)('$label keeps package-script dev HMR working', async (fixture) => {
    const distRoot = path.join(fixture.appRoot, 'dist')
    const originalSource = await fs.readFile(fixture.sourcePath, 'utf8')
    const marker = createHmrMarker('PACKAGE-SCRIPT', path.basename(fixture.appRoot).replaceAll(/[^a-z0-9]+/gi, '-').toUpperCase())
    const updatedSource = fixture.sourceReplacement(originalSource, marker)

    if (updatedSource === originalSource) {
      throw new Error(`Failed to insert HMR marker for ${fixture.label}.`)
    }

    await fs.remove(distRoot)

    const dev = startDevProcess('pnpm', [
      '--dir',
      fixture.appRoot,
      'run',
      fixture.script,
      '--',
      '--platform',
      'weapp',
      '--skipNpm',
    ], {
      env: {
        ...createDevProcessEnv(),
        ...fixture.env,
      },
      all: true,
    })

    try {
      await dev.waitFor(waitForFile(path.join(distRoot, 'app.json'), 90_000), `${fixture.label} initial app.json`)
      await dev.waitFor(waitForFileContains(fixture.distPath, fixture.originalMarker), `${fixture.label} initial output`)

      await replaceFileByRename(fixture.sourcePath, updatedSource)

      const content = await dev.waitFor(
        waitForFileContains(fixture.distPath, marker),
        `${fixture.label} hot-updated output`,
      )
      expect(content).toContain(marker)
    }
    finally {
      await dev.stop(5_000)
      await fs.writeFile(fixture.sourcePath, originalSource, 'utf8')
    }
  })
})
