import fs from 'fs-extra'
import path from 'pathe'
import { startDevProcess } from '../utils/dev-process'
import { cleanupResidualDevProcesses } from '../utils/dev-process-cleanup'
import { createDevProcessEnv } from '../utils/dev-process-env'
import { createHmrMarker, resolvePlatforms } from '../utils/hmr-helpers'
import { APP_ROOT, CLI_PATH, DIST_ROOT, waitForFile } from '../wevu-runtime.utils'

/**
 * 文件重命名测试临时目录
 */
const TEMP_SRC_DIR = path.join(APP_ROOT, 'src/pages/hmr-rename-temp')

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

describe.sequential('HMR rename (dev watch)', () => {
  it.each(PLATFORM_LIST)('重命名 .wxml 模板文件 (%s)', async (platform) => {
    await fs.remove(DIST_ROOT)
    const marker = createHmrMarker('RENAME-TEMPLATE', platform)
    const oldSrcFile = path.join(TEMP_SRC_DIR, 'old-name.wxml')
    const newSrcFile = path.join(TEMP_SRC_DIR, 'new-name.wxml')

    // @ts-expect-error execa v9 overload resolution
    const dev = startDevProcess('node', ['--import', 'tsx', CLI_PATH, 'dev', APP_ROOT, '--platform', platform, '--skipNpm'], {
      env: createDevProcessEnv(),
      stdio: 'inherit',
    })

    try {
      await dev.waitFor(waitForFile(path.join(DIST_ROOT, 'app.json'), 30_000), `${platform} app.json generated`)

      await fs.ensureDir(TEMP_SRC_DIR)
      await fs.writeFile(oldSrcFile, `<view>${marker}</view>`, 'utf8')
      await dev.waitFor(waitForStable(), `${platform} dev stable after old template add`)

      await fs.rename(oldSrcFile, newSrcFile)
      await dev.waitFor(waitForStable(), `${platform} dev stable after template rename`)
    }
    finally {
      await dev.stop(5_000)
      await fs.remove(TEMP_SRC_DIR)
    }
  })

  it.each(PLATFORM_LIST)('重命名 .ts 脚本文件 (%s)', async (platform) => {
    await fs.remove(DIST_ROOT)
    const marker = createHmrMarker('RENAME-SCRIPT', platform)
    const oldSrcFile = path.join(TEMP_SRC_DIR, 'old-name.ts')
    const newSrcFile = path.join(TEMP_SRC_DIR, 'new-name.ts')

    // @ts-expect-error execa v9 overload resolution
    const dev = startDevProcess('node', ['--import', 'tsx', CLI_PATH, 'dev', APP_ROOT, '--platform', platform, '--skipNpm'], {
      env: createDevProcessEnv(),
      stdio: 'inherit',
    })

    try {
      await dev.waitFor(waitForFile(path.join(DIST_ROOT, 'app.json'), 30_000), `${platform} app.json generated`)

      await fs.ensureDir(TEMP_SRC_DIR)
      await fs.writeFile(oldSrcFile, `const marker = '${marker}'\nconsole.log(marker)\n`, 'utf8')
      await dev.waitFor(waitForStable(), `${platform} dev stable after old script add`)

      await fs.rename(oldSrcFile, newSrcFile)
      await dev.waitFor(waitForStable(), `${platform} dev stable after script rename`)
    }
    finally {
      await dev.stop(5_000)
      await fs.remove(TEMP_SRC_DIR)
    }
  })
})
