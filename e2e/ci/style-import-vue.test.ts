/* eslint-disable e18e/ban-dependencies -- e2e 测试需要 execa 驱动 CLI 构建。 */
import { fs } from '@weapp-core/shared/node'
import { execa } from 'execa'
import path from 'pathe'
import { describe, expect, it } from 'vitest'
import { startDevProcess } from '../utils/dev-process'
import { cleanupResidualDevProcesses } from '../utils/dev-process-cleanup'
import { createDevProcessEnv } from '../utils/dev-process-env'
import { replaceFileByRename } from '../utils/hmr-helpers'

const CLI_PATH = path.resolve(import.meta.dirname, '../../packages/weapp-vite/src/cli.ts')
const APP_ROOT = path.resolve(import.meta.dirname, '../../e2e-apps/style-import-vue')
const DIST_ROOT = path.join(APP_ROOT, 'dist')
const WXSS_PATH = path.join(DIST_ROOT, 'pages/index/index.wxss')
const PAGE_SOURCE_PATH = path.join(APP_ROOT, 'src/pages/index/index.vue')
const HELLO_CSS_PATH = path.join(APP_ROOT, 'src/pages/index/hello.css')
const SCSS_IMPORT_PATH = path.join(APP_ROOT, 'src/pages/index/scss-import.css')
const EXTERNAL_CSS_PATH = path.join(APP_ROOT, 'src/pages/index/external.css')
const EXPECTED_MARKERS = ['.hello-import', '.scss-imported', '.external-src']

beforeEach(async () => {
  await cleanupResidualDevProcesses()
})

afterEach(async () => {
  await cleanupResidualDevProcesses()
})

async function runBuild(root: string) {
  await execa('node', ['--import', 'tsx', CLI_PATH, 'build', root, '--platform', 'weapp', '--skipNpm'], {
    stdio: 'inherit',
  })
}

async function waitForFileContains(filePath: string, markers: string[], timeoutMs = 30_000) {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    if (await fs.pathExists(filePath)) {
      const content = await fs.readFile(filePath, 'utf8')
      if (markers.every(marker => content.includes(marker))) {
        return content
      }
    }
    await new Promise(resolve => setTimeout(resolve, 250))
  }
  throw new Error(`Timed out waiting for ${filePath} to contain expected markers.`)
}

function injectStyleMarker(source: string, selector: string, marker: string) {
  const updatedSource = source.replace(selector, `${selector} /* ${marker} */`)
  if (updatedSource === source) {
    throw new Error(`Failed to inject style marker for selector: ${selector}`)
  }
  return updatedSource
}

async function waitForFileWithSourceHeartbeat<T>(
  task: () => Promise<T>,
  touchFilePath: string,
  touchContent: string,
  timeoutMs = 60_000,
  heartbeatMs = 2_000,
) {
  const deadline = Date.now() + timeoutMs
  let nextTouchAt = Date.now() + heartbeatMs

  while (Date.now() < deadline) {
    try {
      return await task()
    }
    catch {
      if (Date.now() >= nextTouchAt) {
        await replaceFileByRename(touchFilePath, touchContent)
        nextTouchAt = Date.now() + heartbeatMs
      }
      await new Promise(resolve => setTimeout(resolve, 250))
    }
  }

  return await task()
}

describe.sequential('vue style @import resolution (e2e)', () => {
  it('build inlines css/scss/src imports into wxss', async () => {
    await fs.remove(DIST_ROOT)
    await runBuild(APP_ROOT)

    const wxss = await fs.readFile(WXSS_PATH, 'utf8')
    for (const marker of EXPECTED_MARKERS) {
      expect(wxss).toContain(marker)
    }
  })

  it('dev build inlines css/scss/src imports into wxss', async () => {
    await fs.remove(DIST_ROOT)
    const originalSource = await fs.readFile(PAGE_SOURCE_PATH, 'utf8')
    const devProcess = startDevProcess('node', ['--import', 'tsx', CLI_PATH, 'dev', APP_ROOT, '--platform', 'weapp', '--skipNpm'], {
      env: createDevProcessEnv(),
      stdio: 'inherit',
    })

    try {
      const wxss = await devProcess.waitFor(
        waitForFileWithSourceHeartbeat(
          () => waitForFileContains(WXSS_PATH, EXPECTED_MARKERS, 1_000),
          PAGE_SOURCE_PATH,
          originalSource,
        ),
        'weapp style import output',
      )
      for (const marker of EXPECTED_MARKERS) {
        expect(wxss).toContain(marker)
      }
    }
    finally {
      await devProcess.stop(2_000)
    }
  })

  it('dev watch updates wxss when imported style dependencies change', async () => {
    await fs.remove(DIST_ROOT)

    const originalPageSource = await fs.readFile(PAGE_SOURCE_PATH, 'utf8')
    const originalHelloCss = await fs.readFile(HELLO_CSS_PATH, 'utf8')
    const originalScssImport = await fs.readFile(SCSS_IMPORT_PATH, 'utf8')
    const originalExternalCss = await fs.readFile(EXTERNAL_CSS_PATH, 'utf8')

    const helloMarker = 'STYLE-IMPORT-HMR-HELLO'
    const scssMarker = 'STYLE-IMPORT-HMR-SCSS'
    const externalMarker = 'STYLE-IMPORT-HMR-EXTERNAL'

    const updatedHelloCss = injectStyleMarker(originalHelloCss, '.hello-import {', helloMarker)
    const updatedScssImport = injectStyleMarker(originalScssImport, '.scss-imported {', scssMarker)
    const updatedExternalCss = injectStyleMarker(originalExternalCss, '.external-src {', externalMarker)

    const devProcess = startDevProcess('node', ['--import', 'tsx', CLI_PATH, 'dev', APP_ROOT, '--platform', 'weapp', '--skipNpm'], {
      env: createDevProcessEnv(),
      stdio: 'inherit',
    })

    try {
      await devProcess.waitFor(
        waitForFileWithSourceHeartbeat(
          () => waitForFileContains(WXSS_PATH, EXPECTED_MARKERS, 1_000),
          PAGE_SOURCE_PATH,
          originalPageSource,
        ),
        'weapp initial style import output',
      )

      await replaceFileByRename(HELLO_CSS_PATH, updatedHelloCss)
      const helloWxss = await devProcess.waitFor(
        waitForFileWithSourceHeartbeat(
          () => waitForFileContains(WXSS_PATH, [helloMarker], 1_000),
          HELLO_CSS_PATH,
          updatedHelloCss,
        ),
        'weapp hello.css hmr output',
      )
      expect(helloWxss).toContain(helloMarker)

      await replaceFileByRename(SCSS_IMPORT_PATH, updatedScssImport)
      const scssWxss = await devProcess.waitFor(
        waitForFileWithSourceHeartbeat(
          () => waitForFileContains(WXSS_PATH, [scssMarker], 1_000),
          SCSS_IMPORT_PATH,
          updatedScssImport,
        ),
        'weapp scss import hmr output',
      )
      expect(scssWxss).toContain(scssMarker)

      await replaceFileByRename(EXTERNAL_CSS_PATH, updatedExternalCss)
      const externalWxss = await devProcess.waitFor(
        waitForFileWithSourceHeartbeat(
          () => waitForFileContains(WXSS_PATH, [externalMarker], 1_000),
          EXTERNAL_CSS_PATH,
          updatedExternalCss,
        ),
        'weapp external style src hmr output',
      )
      expect(externalWxss).toContain(externalMarker)
      expect(devProcess.getOutput()).not.toContain('Build failed')
    }
    finally {
      await devProcess.stop(2_000)
      await fs.writeFile(HELLO_CSS_PATH, originalHelloCss, 'utf8')
      await fs.writeFile(SCSS_IMPORT_PATH, originalScssImport, 'utf8')
      await fs.writeFile(EXTERNAL_CSS_PATH, originalExternalCss, 'utf8')
    }
  })
})
