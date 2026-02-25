import fs from 'fs-extra'
import path from 'pathe'
import { startDevProcess } from '../utils/dev-process'
import { cleanupResidualDevProcesses } from '../utils/dev-process-cleanup'
import { createDevProcessEnv } from '../utils/dev-process-env'
import { createHmrMarker, resolvePlatforms } from '../utils/hmr-helpers'
import { APP_ROOT, CLI_PATH, DIST_ROOT, waitForFile } from '../wevu-runtime.utils'

/**
 * 页面级新增测试临时目录
 */
const TEMP_SRC_DIR = path.join(APP_ROOT, 'src/pages/hmr-temp')

/**
 * 组件级新增测试临时目录
 */
const COMP_TEMP_SRC_DIR = path.join(APP_ROOT, 'src/components/hmr-temp-comp')

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

describe.sequential('HMR add — page-level file additions (dev watch)', () => {
  it.each(PLATFORM_LIST)('新增 .wxml 模板文件 (%s)', async (platform) => {
    await fs.remove(DIST_ROOT)
    const marker = createHmrMarker('ADD-TEMPLATE', platform)
    const srcFile = path.join(TEMP_SRC_DIR, 'add-test.wxml')

    // @ts-expect-error execa v9 overload resolution
    const dev = startDevProcess('node', ['--import', 'tsx', CLI_PATH, 'dev', APP_ROOT, '--platform', platform, '--skipNpm'], {
      env: createDevProcessEnv(),
      stdio: 'inherit',
    })

    try {
      await dev.waitFor(waitForFile(path.join(DIST_ROOT, 'app.json'), 30_000), `${platform} app.json generated`)

      await fs.ensureDir(TEMP_SRC_DIR)
      await fs.writeFile(srcFile, `<view>${marker}</view>`, 'utf8')
      await dev.waitFor(waitForStable(), `${platform} dev stable after template add`)
    }
    finally {
      await dev.stop(5_000)
      await fs.remove(TEMP_SRC_DIR)
    }
  })

  it.each(PLATFORM_LIST)('新增 .wxss 样式文件 (%s)', async (platform) => {
    await fs.remove(DIST_ROOT)
    const marker = createHmrMarker('ADD-STYLE', platform)
    const srcFile = path.join(TEMP_SRC_DIR, 'add-test.wxss')

    // @ts-expect-error execa v9 overload resolution
    const dev = startDevProcess('node', ['--import', 'tsx', CLI_PATH, 'dev', APP_ROOT, '--platform', platform, '--skipNpm'], {
      env: createDevProcessEnv(),
      stdio: 'inherit',
    })

    try {
      await dev.waitFor(waitForFile(path.join(DIST_ROOT, 'app.json'), 30_000), `${platform} app.json generated`)

      await fs.ensureDir(TEMP_SRC_DIR)
      await fs.writeFile(srcFile, `.add-test { /* ${marker} */ }`, 'utf8')
      await dev.waitFor(waitForStable(), `${platform} dev stable after style add`)
    }
    finally {
      await dev.stop(5_000)
      await fs.remove(TEMP_SRC_DIR)
    }
  })

  it.each(PLATFORM_LIST)('新增 .ts 脚本文件 (%s)', async (platform) => {
    await fs.remove(DIST_ROOT)
    const marker = createHmrMarker('ADD-SCRIPT', platform)
    const srcFile = path.join(TEMP_SRC_DIR, 'add-test.ts')

    // @ts-expect-error execa v9 overload resolution
    const dev = startDevProcess('node', ['--import', 'tsx', CLI_PATH, 'dev', APP_ROOT, '--platform', platform, '--skipNpm'], {
      env: createDevProcessEnv(),
      stdio: 'inherit',
    })

    try {
      await dev.waitFor(waitForFile(path.join(DIST_ROOT, 'app.json'), 30_000), `${platform} app.json generated`)

      await fs.ensureDir(TEMP_SRC_DIR)
      await fs.writeFile(srcFile, `const marker = '${marker}'\nconsole.log(marker)\n`, 'utf8')
      await dev.waitFor(waitForStable(), `${platform} dev stable after script add`)
    }
    finally {
      await dev.stop(5_000)
      await fs.remove(TEMP_SRC_DIR)
    }
  })

  it.each(PLATFORM_LIST)('新增 .json 配置文件 (%s)', async (platform) => {
    await fs.remove(DIST_ROOT)
    const marker = createHmrMarker('ADD-JSON', platform)
    const srcFile = path.join(TEMP_SRC_DIR, 'add-test.json')

    // @ts-expect-error execa v9 overload resolution
    const dev = startDevProcess('node', ['--import', 'tsx', CLI_PATH, 'dev', APP_ROOT, '--platform', platform, '--skipNpm'], {
      env: createDevProcessEnv(),
      stdio: 'inherit',
    })

    try {
      await dev.waitFor(waitForFile(path.join(DIST_ROOT, 'app.json'), 30_000), `${platform} app.json generated`)

      await fs.ensureDir(TEMP_SRC_DIR)
      await fs.writeFile(srcFile, JSON.stringify({ component: true, hmrMarker: marker }, null, 2), 'utf8')
      await dev.waitFor(waitForStable(), `${platform} dev stable after json add`)
    }
    finally {
      await dev.stop(5_000)
      await fs.remove(TEMP_SRC_DIR)
    }
  })

  it.each(PLATFORM_LIST)('新增 .vue SFC 文件 (%s)', async (platform) => {
    await fs.remove(DIST_ROOT)
    const marker = createHmrMarker('ADD-SFC', platform)
    const srcFile = path.join(TEMP_SRC_DIR, 'add-test.vue')

    const sfcContent = [
      '<template>',
      `  <view>${marker}</view>`,
      '</template>',
      '',
      '<script lang="ts">',
      `const sfcMarker = '${marker}'`,
      'export default { data() { return {} } }',
      '</script>',
      '',
      '<style>',
      `.add-test-sfc { /* ${marker} */ }`,
      '</style>',
    ].join('\n')

    // @ts-expect-error execa v9 overload resolution
    const dev = startDevProcess('node', ['--import', 'tsx', CLI_PATH, 'dev', APP_ROOT, '--platform', platform, '--skipNpm'], {
      env: createDevProcessEnv(),
      stdio: 'inherit',
    })

    try {
      await dev.waitFor(waitForFile(path.join(DIST_ROOT, 'app.json'), 30_000), `${platform} app.json generated`)

      await fs.ensureDir(TEMP_SRC_DIR)
      await fs.writeFile(srcFile, sfcContent, 'utf8')
      await dev.waitFor(waitForStable(), `${platform} dev stable after sfc add`)
    }
    finally {
      await dev.stop(5_000)
      await fs.remove(TEMP_SRC_DIR)
    }
  })
})

describe.sequential('HMR add — component-level file additions (dev watch)', () => {
  it.each(PLATFORM_LIST)('新增完整组件 (%s)', async (platform) => {
    await fs.remove(DIST_ROOT)
    const marker = createHmrMarker('ADD-COMP', platform)

    const srcTemplate = path.join(COMP_TEMP_SRC_DIR, 'index.wxml')
    const srcScript = path.join(COMP_TEMP_SRC_DIR, 'index.ts')
    const srcStyle = path.join(COMP_TEMP_SRC_DIR, 'index.wxss')
    const srcJson = path.join(COMP_TEMP_SRC_DIR, 'index.json')

    // @ts-expect-error execa v9 overload resolution
    const dev = startDevProcess('node', ['--import', 'tsx', CLI_PATH, 'dev', APP_ROOT, '--platform', platform, '--skipNpm'], {
      env: createDevProcessEnv(),
      stdio: 'inherit',
    })

    try {
      await dev.waitFor(waitForFile(path.join(DIST_ROOT, 'app.json'), 30_000), `${platform} app.json generated`)

      await fs.ensureDir(COMP_TEMP_SRC_DIR)
      await fs.writeFile(srcTemplate, `<view>${marker}</view>`, 'utf8')
      await fs.writeFile(srcScript, `const marker = '${marker}'\nComponent({})\n`, 'utf8')
      await fs.writeFile(srcStyle, `.hmr-temp-comp { /* ${marker} */ }`, 'utf8')
      await fs.writeFile(srcJson, JSON.stringify({ component: true, hmrMarker: marker }, null, 2), 'utf8')
      await dev.waitFor(waitForStable(), `${platform} dev stable after full component add`)
    }
    finally {
      await dev.stop(5_000)
      await fs.remove(COMP_TEMP_SRC_DIR)
    }
  })

  it.each(PLATFORM_LIST)('在现有组件中新增 .wxss 样式文件 (%s)', async (platform) => {
    await fs.remove(DIST_ROOT)
    const marker = createHmrMarker('ADD-COMP-STYLE', platform)

    const srcTemplate = path.join(COMP_TEMP_SRC_DIR, 'index.wxml')
    const srcScript = path.join(COMP_TEMP_SRC_DIR, 'index.ts')
    const srcJson = path.join(COMP_TEMP_SRC_DIR, 'index.json')
    const srcExtraStyle = path.join(COMP_TEMP_SRC_DIR, 'extra.wxss')

    // @ts-expect-error execa v9 overload resolution
    const dev = startDevProcess('node', ['--import', 'tsx', CLI_PATH, 'dev', APP_ROOT, '--platform', platform, '--skipNpm'], {
      env: createDevProcessEnv(),
      stdio: 'inherit',
    })

    try {
      await dev.waitFor(waitForFile(path.join(DIST_ROOT, 'app.json'), 30_000), `${platform} app.json generated`)

      await fs.ensureDir(COMP_TEMP_SRC_DIR)
      await fs.writeFile(srcTemplate, '<view>temp-comp</view>', 'utf8')
      await fs.writeFile(srcScript, 'Component({})\n', 'utf8')
      await fs.writeFile(srcJson, JSON.stringify({ component: true }, null, 2), 'utf8')
      await dev.waitFor(waitForStable(), `${platform} dev stable after base component add`)

      await fs.writeFile(srcExtraStyle, `.extra-style { /* ${marker} */ }`, 'utf8')
      await dev.waitFor(waitForStable(), `${platform} dev stable after extra style add`)
    }
    finally {
      await dev.stop(5_000)
      await fs.remove(COMP_TEMP_SRC_DIR)
    }
  })
})
