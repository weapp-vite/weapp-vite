import fs from 'fs-extra'
import path from 'pathe'
import { startDevProcess } from '../utils/dev-process'
import { createDevProcessEnv } from '../utils/dev-process-env'
import { createHmrMarker, PLATFORM_EXT, resolvePlatforms, waitForFileContains } from '../utils/hmr-helpers'
import { APP_ROOT, CLI_PATH, DIST_ROOT, waitForFile } from '../wevu-runtime.utils'

/**
 * app.json 源文件和 dist 文件路径
 */
const APP_JSON_SRC = path.join(APP_ROOT, 'src/app.json')
const APP_JSON_DIST = path.join(DIST_ROOT, 'app.json')

/**
 * 临时页面源目录和 dist 目录
 */
const TEMP_PAGE_SRC_DIR = path.join(APP_ROOT, 'src/pages/hmr-config-temp')
const TEMP_PAGE_DIST_DIR = path.join(DIST_ROOT, 'pages/hmr-config-temp')

const PLATFORM_LIST = resolvePlatforms()

describe.sequential('HMR app.json config (dev watch)', () => {
  it.each(PLATFORM_LIST)('修改 app.json window 配置 (%s)', async (platform) => {
    await fs.remove(DIST_ROOT)
    const originalSource = await fs.readFile(APP_JSON_SRC, 'utf8')
    const marker = createHmrMarker('APP-CONFIG-WINDOW', platform)

    const config = JSON.parse(originalSource)
    config.window.navigationBarTitleText = marker
    const updatedSource = JSON.stringify(config, null, 2)

    // @ts-expect-error execa v9 overload resolution
    const dev = startDevProcess('node', ['--import', 'tsx', CLI_PATH, 'dev', APP_ROOT, '--platform', platform, '--skipNpm'], {
      env: createDevProcessEnv(),
      stdio: 'inherit',
    })

    try {
      await dev.waitFor(waitForFile(APP_JSON_DIST, 120_000), `${platform} app.json generated`)
      await dev.waitFor(waitForFileContains(APP_JSON_DIST, 'Wevu Runtime E2E'), `${platform} initial app.json content`)

      await fs.writeFile(APP_JSON_SRC, updatedSource, 'utf8')

      const content = await dev.waitFor(
        waitForFileContains(APP_JSON_DIST, marker),
        `${platform} app.json window config updated`,
      )
      expect(content).toContain(marker)
    }
    finally {
      await dev.stop(5_000)
      await fs.writeFile(APP_JSON_SRC, originalSource, 'utf8')
    }
  })

  it.each(PLATFORM_LIST)('修改 app.json pages 数组新增页面 (%s)', async (platform) => {
    await fs.remove(DIST_ROOT)
    const originalSource = await fs.readFile(APP_JSON_SRC, 'utf8')
    const ext = PLATFORM_EXT[platform]
    const marker = createHmrMarker('APP-CONFIG-PAGE', platform)
    const newPagePath = 'pages/hmr-config-temp/index'

    // @ts-expect-error execa v9 overload resolution
    const dev = startDevProcess('node', ['--import', 'tsx', CLI_PATH, 'dev', APP_ROOT, '--platform', platform, '--skipNpm'], {
      env: createDevProcessEnv(),
      stdio: 'inherit',
    })

    try {
      await dev.waitFor(waitForFile(APP_JSON_DIST, 120_000), `${platform} app.json generated`)
      await dev.waitFor(waitForFileContains(APP_JSON_DIST, 'pages/hmr/index'), `${platform} initial pages content`)

      // 创建新页面源文件
      await fs.ensureDir(TEMP_PAGE_SRC_DIR)
      await fs.writeFile(path.join(TEMP_PAGE_SRC_DIR, 'index.wxml'), `<view>${marker}</view>`, 'utf8')
      await fs.writeFile(path.join(TEMP_PAGE_SRC_DIR, 'index.ts'), `const marker = '${marker}'\nPage({})\n`, 'utf8')
      await fs.writeFile(path.join(TEMP_PAGE_SRC_DIR, 'index.json'), JSON.stringify({ hmrMarker: marker }, null, 2), 'utf8')

      // 向 pages 数组新增页面路径
      const config = JSON.parse(originalSource)
      config.pages.push(newPagePath)
      await fs.writeFile(APP_JSON_SRC, JSON.stringify(config, null, 2), 'utf8')

      // 验证 dist/app.json 包含新页面路径
      const appJsonContent = await dev.waitFor(
        waitForFileContains(APP_JSON_DIST, 'hmr-config-temp'),
        `${platform} app.json pages array updated`,
      )
      expect(appJsonContent).toContain(newPagePath)

      // 验证 dist 中生成新页面的输出文件
      const distTemplate = path.join(TEMP_PAGE_DIST_DIR, `index.${ext.template}`)
      const templateContent = await dev.waitFor(
        waitForFileContains(distTemplate, marker),
        `${platform} new page template generated`,
      )
      expect(templateContent).toContain(marker)
    }
    finally {
      await dev.stop(5_000)
      await fs.writeFile(APP_JSON_SRC, originalSource, 'utf8')
      await fs.remove(TEMP_PAGE_SRC_DIR)
      await fs.remove(TEMP_PAGE_DIST_DIR)
    }
  })
})
