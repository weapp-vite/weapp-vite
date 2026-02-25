import fs from 'fs-extra'
import path from 'pathe'
import { startDevProcess } from '../utils/dev-process'
import { cleanupResidualDevProcesses } from '../utils/dev-process-cleanup'
import { createDevProcessEnv } from '../utils/dev-process-env'
import { createHmrMarker, PLATFORM_EXT, resolvePlatforms, waitForFileContains } from '../utils/hmr-helpers'
import { APP_ROOT, CLI_PATH, DIST_ROOT, waitForFile } from '../wevu-runtime.utils'

/**
 * HTML 模板 HMR 源文件路径
 */
const HTML_SRC_PATH = path.join(APP_ROOT, 'src/pages/hmr-html/index.html')

/**
 * 临时目录用于新增 HTML 模板文件测试
 */
const TEMP_SRC_DIR = path.join(APP_ROOT, 'src/pages/hmr-html-temp')

const PLATFORM_LIST = resolvePlatforms()

function waitForStable(ms = 1_200) {
  return new Promise<void>(resolve => setTimeout(resolve, ms))
}

beforeEach(async () => {
  await cleanupResidualDevProcesses()
})

afterEach(async () => {
  await cleanupResidualDevProcesses()
})

describe.sequential('HMR html template (dev watch)', () => {
  it.each(PLATFORM_LIST)('修改 .html 模板文件 (%s)', async (platform) => {
    await fs.remove(DIST_ROOT)
    const originalSource = await fs.readFile(HTML_SRC_PATH, 'utf8')
    const ext = PLATFORM_EXT[platform]
    const distPath = path.join(DIST_ROOT, `pages/hmr-html/index.${ext.template}`)
    const marker = createHmrMarker('MODIFY-HTML-TEMPLATE', platform)

    const updatedSource = originalSource.replace('HMR-HTML-TEMPLATE', marker)
    if (updatedSource === originalSource) {
      throw new Error('Failed to insert marker into .html source.')
    }

    // @ts-expect-error execa v9 overload resolution
    const dev = startDevProcess('node', ['--import', 'tsx', CLI_PATH, 'dev', APP_ROOT, '--platform', platform, '--skipNpm'], {
      env: createDevProcessEnv(),
      stdio: 'inherit',
    })

    try {
      await dev.waitFor(waitForFile(path.join(DIST_ROOT, 'app.json'), 30_000), `${platform} app.json generated`)
      await dev.waitFor(waitForFileContains(distPath, 'HMR-HTML-TEMPLATE'), `${platform} initial html template`)

      await fs.writeFile(HTML_SRC_PATH, updatedSource, 'utf8')

      const content = await dev.waitFor(
        waitForFileContains(distPath, marker),
        `${platform} updated html template marker`,
      )
      expect(content).toContain(marker)
    }
    finally {
      await dev.stop(5_000)
      await fs.writeFile(HTML_SRC_PATH, originalSource, 'utf8')
    }
  })

  it.each(PLATFORM_LIST)('新增 .html 模板文件 (%s)', async (platform) => {
    await fs.remove(DIST_ROOT)
    const marker = createHmrMarker('ADD-HTML-TEMPLATE', platform)
    const srcFile = path.join(TEMP_SRC_DIR, 'add-test.html')

    // @ts-expect-error execa v9 overload resolution
    const dev = startDevProcess('node', ['--import', 'tsx', CLI_PATH, 'dev', APP_ROOT, '--platform', platform, '--skipNpm'], {
      env: createDevProcessEnv(),
      stdio: 'inherit',
    })

    try {
      await dev.waitFor(waitForFile(path.join(DIST_ROOT, 'app.json'), 30_000), `${platform} app.json generated`)

      await fs.ensureDir(TEMP_SRC_DIR)
      await fs.writeFile(srcFile, `<view>${marker}</view>`, 'utf8')
      await dev.waitFor(waitForStable(), `${platform} dev stable after html add`)
    }
    finally {
      await dev.stop(5_000)
      await fs.remove(TEMP_SRC_DIR)
    }
  })
})
