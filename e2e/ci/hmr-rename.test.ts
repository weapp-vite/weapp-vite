import fs from 'fs-extra'
import path from 'pathe'
import { startDevProcess } from '../utils/dev-process'
import { createDevProcessEnv } from '../utils/dev-process-env'
import { createHmrMarker, PLATFORM_EXT, resolvePlatforms, waitForFileContains, waitForFileRemoved } from '../utils/hmr-helpers'
import { APP_ROOT, CLI_PATH, DIST_ROOT, waitForFile } from '../wevu-runtime.utils'

/**
 * 文件重命名测试临时目录
 */
const TEMP_SRC_DIR = path.join(APP_ROOT, 'src/pages/hmr-rename-temp')
const TEMP_DIST_DIR = path.join(DIST_ROOT, 'pages/hmr-rename-temp')

const PLATFORM_LIST = resolvePlatforms()

describe.sequential('HMR rename (dev watch)', () => {
  it.each(PLATFORM_LIST)('重命名 .wxml 模板文件 (%s)', async (platform) => {
    await fs.remove(DIST_ROOT)
    const ext = PLATFORM_EXT[platform]
    const marker = createHmrMarker('RENAME-TEMPLATE', platform)
    const oldSrcFile = path.join(TEMP_SRC_DIR, 'old-name.wxml')
    const newSrcFile = path.join(TEMP_SRC_DIR, 'new-name.wxml')
    const oldDistFile = path.join(TEMP_DIST_DIR, `old-name.${ext.template}`)
    const newDistFile = path.join(TEMP_DIST_DIR, `new-name.${ext.template}`)

    // @ts-expect-error execa v9 overload resolution
    const dev = startDevProcess('node', ['--import', 'tsx', CLI_PATH, 'dev', APP_ROOT, '--platform', platform, '--skipNpm'], {
      env: createDevProcessEnv(),
      stdio: 'inherit',
    })

    try {
      await dev.waitFor(waitForFile(path.join(DIST_ROOT, 'app.json'), 120_000), `${platform} app.json generated`)

      // 创建临时源文件并等待 dist 生成
      await fs.ensureDir(TEMP_SRC_DIR)
      await fs.writeFile(oldSrcFile, `<view>${marker}</view>`, 'utf8')

      const content = await dev.waitFor(
        waitForFileContains(oldDistFile, marker),
        `${platform} old template file appeared in dist`,
      )
      expect(content).toContain(marker)

      // 重命名源文件
      await fs.rename(oldSrcFile, newSrcFile)

      // 验证旧 dist 文件被移除
      await dev.waitFor(
        waitForFileRemoved(oldDistFile),
        `${platform} old template file removed from dist`,
      )

      // 验证新 dist 文件生成
      const newContent = await dev.waitFor(
        waitForFileContains(newDistFile, marker),
        `${platform} new template file appeared in dist`,
      )
      expect(newContent).toContain(marker)
    }
    finally {
      await dev.stop(5_000)
      await fs.remove(TEMP_SRC_DIR)
      await fs.remove(TEMP_DIST_DIR)
    }
  })

  it.each(PLATFORM_LIST)('重命名 .ts 脚本文件 (%s)', async (platform) => {
    await fs.remove(DIST_ROOT)
    const marker = createHmrMarker('RENAME-SCRIPT', platform)
    const oldSrcFile = path.join(TEMP_SRC_DIR, 'old-name.ts')
    const newSrcFile = path.join(TEMP_SRC_DIR, 'new-name.ts')
    const oldDistFile = path.join(TEMP_DIST_DIR, 'old-name.js')
    const newDistFile = path.join(TEMP_DIST_DIR, 'new-name.js')

    // @ts-expect-error execa v9 overload resolution
    const dev = startDevProcess('node', ['--import', 'tsx', CLI_PATH, 'dev', APP_ROOT, '--platform', platform, '--skipNpm'], {
      env: createDevProcessEnv(),
      stdio: 'inherit',
    })

    try {
      await dev.waitFor(waitForFile(path.join(DIST_ROOT, 'app.json'), 120_000), `${platform} app.json generated`)

      // 创建临时源文件并等待 dist 生成
      await fs.ensureDir(TEMP_SRC_DIR)
      await fs.writeFile(oldSrcFile, `const marker = '${marker}'\nconsole.log(marker)\n`, 'utf8')

      const content = await dev.waitFor(
        waitForFileContains(oldDistFile, marker),
        `${platform} old script file appeared in dist`,
      )
      expect(content).toContain(marker)

      // 重命名源文件
      await fs.rename(oldSrcFile, newSrcFile)

      // 验证旧 dist 文件被移除
      await dev.waitFor(
        waitForFileRemoved(oldDistFile),
        `${platform} old script file removed from dist`,
      )

      // 验证新 dist 文件生成
      const newContent = await dev.waitFor(
        waitForFileContains(newDistFile, marker),
        `${platform} new script file appeared in dist`,
      )
      expect(newContent).toContain(marker)
    }
    finally {
      await dev.stop(5_000)
      await fs.remove(TEMP_SRC_DIR)
      await fs.remove(TEMP_DIST_DIR)
    }
  })
})
