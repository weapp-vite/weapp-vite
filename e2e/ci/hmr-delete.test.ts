import fs from 'fs-extra'
import path from 'pathe'
import { startDevProcess } from '../utils/dev-process'
import { cleanupResidualDevProcesses } from '../utils/dev-process-cleanup'
import { createDevProcessEnv } from '../utils/dev-process-env'
import { createHmrMarker, resolvePlatforms } from '../utils/hmr-helpers'
import { APP_ROOT, CLI_PATH, DIST_ROOT, waitForFile } from '../wevu-runtime.utils'

/**
 * 页面级删除测试临时目录
 */
const TEMP_PAGE_SRC_DIR = path.join(APP_ROOT, 'src/pages/hmr-temp')

/**
 * 组件级删除测试临时目录
 */
const TEMP_COMPONENT_SRC_DIR = path.join(APP_ROOT, 'src/components/hmr-temp-comp')

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

describe.sequential('HMR delete — page-level file deletions (dev watch)', () => {
  it.each(PLATFORM_LIST)('删除 .wxml 模板文件 (%s)', async (platform) => {
    await fs.remove(DIST_ROOT)
    const marker = createHmrMarker('DEL-TEMPLATE', platform)
    const srcFile = path.join(TEMP_PAGE_SRC_DIR, 'del-test.wxml')

    // @ts-expect-error execa v9 overload resolution
    const dev = startDevProcess('node', ['--import', 'tsx', CLI_PATH, 'dev', APP_ROOT, '--platform', platform, '--skipNpm'], {
      env: createDevProcessEnv(),
      stdio: 'inherit',
    })

    try {
      await dev.waitFor(waitForFile(path.join(DIST_ROOT, 'app.json'), 30_000), `${platform} app.json generated`)
      await fs.ensureDir(TEMP_PAGE_SRC_DIR)
      await fs.writeFile(srcFile, `<view>${marker}</view>`, 'utf8')
      await dev.waitFor(waitForStable(), `${platform} dev stable after template add`)

      await fs.remove(srcFile)
      await dev.waitFor(waitForStable(), `${platform} dev stable after template delete`)
    }
    finally {
      await dev.stop(5_000)
      await fs.remove(TEMP_PAGE_SRC_DIR)
    }
  })

  it.each(PLATFORM_LIST)('删除 .wxss 样式文件 (%s)', async (platform) => {
    await fs.remove(DIST_ROOT)
    const marker = createHmrMarker('DEL-STYLE', platform)
    const srcFile = path.join(TEMP_PAGE_SRC_DIR, 'del-test.wxss')

    // @ts-expect-error execa v9 overload resolution
    const dev = startDevProcess('node', ['--import', 'tsx', CLI_PATH, 'dev', APP_ROOT, '--platform', platform, '--skipNpm'], {
      env: createDevProcessEnv(),
      stdio: 'inherit',
    })

    try {
      await dev.waitFor(waitForFile(path.join(DIST_ROOT, 'app.json'), 30_000), `${platform} app.json generated`)
      await fs.ensureDir(TEMP_PAGE_SRC_DIR)
      await fs.writeFile(srcFile, `.del-test { /* ${marker} */ }`, 'utf8')
      await dev.waitFor(waitForStable(), `${platform} dev stable after style add`)

      await fs.remove(srcFile)
      await dev.waitFor(waitForStable(), `${platform} dev stable after style delete`)
    }
    finally {
      await dev.stop(5_000)
      await fs.remove(TEMP_PAGE_SRC_DIR)
    }
  })

  it.each(PLATFORM_LIST)('删除 .ts 脚本文件 (%s)', async (platform) => {
    await fs.remove(DIST_ROOT)
    const marker = createHmrMarker('DEL-SCRIPT', platform)
    const srcFile = path.join(TEMP_PAGE_SRC_DIR, 'del-test.ts')

    // @ts-expect-error execa v9 overload resolution
    const dev = startDevProcess('node', ['--import', 'tsx', CLI_PATH, 'dev', APP_ROOT, '--platform', platform, '--skipNpm'], {
      env: createDevProcessEnv(),
      stdio: 'inherit',
    })

    try {
      await dev.waitFor(waitForFile(path.join(DIST_ROOT, 'app.json'), 30_000), `${platform} app.json generated`)
      await fs.ensureDir(TEMP_PAGE_SRC_DIR)
      await fs.writeFile(srcFile, `const marker = '${marker}'\nconsole.log(marker)\n`, 'utf8')
      await dev.waitFor(waitForStable(), `${platform} dev stable after script add`)

      await fs.remove(srcFile)
      await dev.waitFor(waitForStable(), `${platform} dev stable after script delete`)
    }
    finally {
      await dev.stop(5_000)
      await fs.remove(TEMP_PAGE_SRC_DIR)
    }
  })

  it.each(PLATFORM_LIST)('删除 .json 配置文件 (%s)', async (platform) => {
    await fs.remove(DIST_ROOT)
    const marker = createHmrMarker('DEL-JSON', platform)
    const srcFile = path.join(TEMP_PAGE_SRC_DIR, 'del-test.json')

    // @ts-expect-error execa v9 overload resolution
    const dev = startDevProcess('node', ['--import', 'tsx', CLI_PATH, 'dev', APP_ROOT, '--platform', platform, '--skipNpm'], {
      env: createDevProcessEnv(),
      stdio: 'inherit',
    })

    try {
      await dev.waitFor(waitForFile(path.join(DIST_ROOT, 'app.json'), 30_000), `${platform} app.json generated`)
      await fs.ensureDir(TEMP_PAGE_SRC_DIR)
      await fs.writeFile(srcFile, JSON.stringify({ component: true, marker }, null, 2), 'utf8')
      await dev.waitFor(waitForStable(), `${platform} dev stable after json add`)

      await fs.remove(srcFile)
      await dev.waitFor(waitForStable(), `${platform} dev stable after json delete`)
    }
    finally {
      await dev.stop(5_000)
      await fs.remove(TEMP_PAGE_SRC_DIR)
    }
  })

  it.each(PLATFORM_LIST)('删除 .vue SFC 文件 (%s)', async (platform) => {
    await fs.remove(DIST_ROOT)
    const marker = createHmrMarker('DEL-SFC', platform)
    const srcFile = path.join(TEMP_PAGE_SRC_DIR, 'del-test.vue')

    const sfcContent = [
      '<template>',
      `  <view>${marker}</view>`,
      '</template>',
      '',
      '<script lang="ts">',
      `const marker = '${marker}'`,
      'console.log(marker)',
      'export default { data() { return {} } }',
      '</script>',
      '',
      '<style>',
      `.del-test-sfc { /* ${marker} */ }`,
      '</style>',
    ].join('\n')

    // @ts-expect-error execa v9 overload resolution
    const dev = startDevProcess('node', ['--import', 'tsx', CLI_PATH, 'dev', APP_ROOT, '--platform', platform, '--skipNpm'], {
      env: createDevProcessEnv(),
      stdio: 'inherit',
    })

    try {
      await dev.waitFor(waitForFile(path.join(DIST_ROOT, 'app.json'), 30_000), `${platform} app.json generated`)
      await fs.ensureDir(TEMP_PAGE_SRC_DIR)
      await fs.writeFile(srcFile, sfcContent, 'utf8')
      await dev.waitFor(waitForStable(), `${platform} dev stable after sfc add`)

      await fs.remove(srcFile)
      await dev.waitFor(waitForStable(), `${platform} dev stable after sfc delete`)
    }
    finally {
      await dev.stop(5_000)
      await fs.remove(TEMP_PAGE_SRC_DIR)
    }
  })
})

describe.sequential('HMR delete — component-level file deletions (dev watch)', () => {
  it.each(PLATFORM_LIST)('删除组件 .wxml 模板文件 (%s)', async (platform) => {
    await fs.remove(DIST_ROOT)
    const marker = createHmrMarker('DEL-COMP-TEMPLATE', platform)

    const srcTemplate = path.join(TEMP_COMPONENT_SRC_DIR, 'index.wxml')
    const srcScript = path.join(TEMP_COMPONENT_SRC_DIR, 'index.ts')
    const srcStyle = path.join(TEMP_COMPONENT_SRC_DIR, 'index.wxss')
    const srcJson = path.join(TEMP_COMPONENT_SRC_DIR, 'index.json')

    // @ts-expect-error execa v9 overload resolution
    const dev = startDevProcess('node', ['--import', 'tsx', CLI_PATH, 'dev', APP_ROOT, '--platform', platform, '--skipNpm'], {
      env: createDevProcessEnv(),
      stdio: 'inherit',
    })

    try {
      await dev.waitFor(waitForFile(path.join(DIST_ROOT, 'app.json'), 30_000), `${platform} app.json generated`)
      await fs.ensureDir(TEMP_COMPONENT_SRC_DIR)
      await fs.writeFile(srcTemplate, `<view>${marker}</view>`, 'utf8')
      await fs.writeFile(srcScript, `const marker = '${marker}'\nComponent({})\n`, 'utf8')
      await fs.writeFile(srcStyle, `.hmr-temp-comp { /* ${marker} */ }`, 'utf8')
      await fs.writeFile(srcJson, JSON.stringify({ component: true }, null, 2), 'utf8')
      await dev.waitFor(waitForStable(), `${platform} dev stable after component add`)

      await fs.remove(srcTemplate)
      await dev.waitFor(waitForStable(), `${platform} dev stable after component template delete`)
    }
    finally {
      await dev.stop(5_000)
      await fs.remove(TEMP_COMPONENT_SRC_DIR)
    }
  })

  it.each(PLATFORM_LIST)('删除组件 .wxss 样式文件 (%s)', async (platform) => {
    await fs.remove(DIST_ROOT)
    const marker = createHmrMarker('DEL-COMP-STYLE', platform)

    const srcTemplate = path.join(TEMP_COMPONENT_SRC_DIR, 'index.wxml')
    const srcScript = path.join(TEMP_COMPONENT_SRC_DIR, 'index.ts')
    const srcStyle = path.join(TEMP_COMPONENT_SRC_DIR, 'index.wxss')
    const srcJson = path.join(TEMP_COMPONENT_SRC_DIR, 'index.json')

    // @ts-expect-error execa v9 overload resolution
    const dev = startDevProcess('node', ['--import', 'tsx', CLI_PATH, 'dev', APP_ROOT, '--platform', platform, '--skipNpm'], {
      env: createDevProcessEnv(),
      stdio: 'inherit',
    })

    try {
      await dev.waitFor(waitForFile(path.join(DIST_ROOT, 'app.json'), 30_000), `${platform} app.json generated`)
      await fs.ensureDir(TEMP_COMPONENT_SRC_DIR)
      await fs.writeFile(srcTemplate, `<view>${marker}</view>`, 'utf8')
      await fs.writeFile(srcScript, `const marker = '${marker}'\nComponent({})\n`, 'utf8')
      await fs.writeFile(srcStyle, `.hmr-temp-comp { /* ${marker} */ }`, 'utf8')
      await fs.writeFile(srcJson, JSON.stringify({ component: true }, null, 2), 'utf8')
      await dev.waitFor(waitForStable(), `${platform} dev stable after component add`)

      await fs.remove(srcStyle)
      await dev.waitFor(waitForStable(), `${platform} dev stable after component style delete`)
    }
    finally {
      await dev.stop(5_000)
      await fs.remove(TEMP_COMPONENT_SRC_DIR)
    }
  })
})
