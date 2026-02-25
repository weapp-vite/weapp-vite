import fs from 'fs-extra'
import path from 'pathe'
import { startDevProcess } from '../utils/dev-process'
import { createDevProcessEnv } from '../utils/dev-process-env'
import { createHmrMarker, PLATFORM_EXT, resolvePlatforms, waitForFileContains } from '../utils/hmr-helpers'
import { APP_ROOT, CLI_PATH, DIST_ROOT, waitForFile } from '../wevu-runtime.utils'

/**
 * 页面级新增测试临时目录
 */
const TEMP_SRC_DIR = path.join(APP_ROOT, 'src/pages/hmr-temp')
const TEMP_DIST_DIR = path.join(DIST_ROOT, 'pages/hmr-temp')

/**
 * 组件级新增测试临时目录
 */
const COMP_TEMP_SRC_DIR = path.join(APP_ROOT, 'src/components/hmr-temp-comp')
const COMP_TEMP_DIST_DIR = path.join(DIST_ROOT, 'components/hmr-temp-comp')

const PLATFORM_LIST = resolvePlatforms()

describe.sequential('HMR add — page-level file additions (dev watch)', () => {
  it.each(PLATFORM_LIST)('新增 .wxml 模板文件 (%s)', async (platform) => {
    await fs.remove(DIST_ROOT)
    const ext = PLATFORM_EXT[platform]
    const marker = createHmrMarker('ADD-TEMPLATE', platform)
    const srcFile = path.join(TEMP_SRC_DIR, 'add-test.wxml')
    const distFile = path.join(TEMP_DIST_DIR, `add-test.${ext.template}`)

    // @ts-expect-error execa v9 overload resolution
    const dev = startDevProcess('node', ['--import', 'tsx', CLI_PATH, 'dev', APP_ROOT, '--platform', platform, '--skipNpm'], {
      env: createDevProcessEnv(),
      stdio: 'inherit',
    })

    try {
      await dev.waitFor(waitForFile(path.join(DIST_ROOT, 'app.json'), 120_000), `${platform} app.json generated`)

      await fs.ensureDir(TEMP_SRC_DIR)
      await fs.writeFile(srcFile, `<view>${marker}</view>`, 'utf8')

      const content = await dev.waitFor(
        waitForFileContains(distFile, marker),
        `${platform} added template file`,
      )
      expect(content).toContain(marker)
    }
    finally {
      await dev.stop(5_000)
      await fs.remove(srcFile)
      await fs.remove(TEMP_DIST_DIR)
    }
  })

  it.each(PLATFORM_LIST)('新增 .wxss 样式文件 (%s)', async (platform) => {
    await fs.remove(DIST_ROOT)
    const ext = PLATFORM_EXT[platform]
    const marker = createHmrMarker('ADD-STYLE', platform)
    const srcFile = path.join(TEMP_SRC_DIR, 'add-test.wxss')
    const distFile = path.join(TEMP_DIST_DIR, `add-test.${ext.style}`)

    // @ts-expect-error execa v9 overload resolution
    const dev = startDevProcess('node', ['--import', 'tsx', CLI_PATH, 'dev', APP_ROOT, '--platform', platform, '--skipNpm'], {
      env: createDevProcessEnv(),
      stdio: 'inherit',
    })

    try {
      await dev.waitFor(waitForFile(path.join(DIST_ROOT, 'app.json'), 120_000), `${platform} app.json generated`)

      await fs.ensureDir(TEMP_SRC_DIR)
      await fs.writeFile(srcFile, `.add-test { /* ${marker} */ }`, 'utf8')

      const content = await dev.waitFor(
        waitForFileContains(distFile, marker),
        `${platform} added style file`,
      )
      expect(content).toContain(marker)
    }
    finally {
      await dev.stop(5_000)
      await fs.remove(srcFile)
      await fs.remove(TEMP_DIST_DIR)
    }
  })

  it.each(PLATFORM_LIST)('新增 .ts 脚本文件 (%s)', async (platform) => {
    await fs.remove(DIST_ROOT)
    const marker = createHmrMarker('ADD-SCRIPT', platform)
    const srcFile = path.join(TEMP_SRC_DIR, 'add-test.ts')
    const distFile = path.join(TEMP_DIST_DIR, 'add-test.js')

    // @ts-expect-error execa v9 overload resolution
    const dev = startDevProcess('node', ['--import', 'tsx', CLI_PATH, 'dev', APP_ROOT, '--platform', platform, '--skipNpm'], {
      env: createDevProcessEnv(),
      stdio: 'inherit',
    })

    try {
      await dev.waitFor(waitForFile(path.join(DIST_ROOT, 'app.json'), 120_000), `${platform} app.json generated`)

      await fs.ensureDir(TEMP_SRC_DIR)
      await fs.writeFile(srcFile, `const marker = '${marker}'\nconsole.log(marker)\n`, 'utf8')

      const content = await dev.waitFor(
        waitForFileContains(distFile, marker),
        `${platform} added script file`,
      )
      expect(content).toContain(marker)
    }
    finally {
      await dev.stop(5_000)
      await fs.remove(srcFile)
      await fs.remove(TEMP_DIST_DIR)
    }
  })

  it.each(PLATFORM_LIST)('新增 .json 配置文件 (%s)', async (platform) => {
    await fs.remove(DIST_ROOT)
    const marker = createHmrMarker('ADD-JSON', platform)
    const srcFile = path.join(TEMP_SRC_DIR, 'add-test.json')
    const distFile = path.join(TEMP_DIST_DIR, 'add-test.json')

    // @ts-expect-error execa v9 overload resolution
    const dev = startDevProcess('node', ['--import', 'tsx', CLI_PATH, 'dev', APP_ROOT, '--platform', platform, '--skipNpm'], {
      env: createDevProcessEnv(),
      stdio: 'inherit',
    })

    try {
      await dev.waitFor(waitForFile(path.join(DIST_ROOT, 'app.json'), 120_000), `${platform} app.json generated`)

      await fs.ensureDir(TEMP_SRC_DIR)
      await fs.writeFile(srcFile, JSON.stringify({ component: true, hmrMarker: marker }, null, 2), 'utf8')

      const content = await dev.waitFor(
        waitForFileContains(distFile, marker),
        `${platform} added json file`,
      )
      expect(content).toContain(marker)
    }
    finally {
      await dev.stop(5_000)
      await fs.remove(srcFile)
      await fs.remove(TEMP_DIST_DIR)
    }
  })

  it.each(PLATFORM_LIST)('新增 .vue SFC 文件 (%s)', async (platform) => {
    await fs.remove(DIST_ROOT)
    const ext = PLATFORM_EXT[platform]
    const marker = createHmrMarker('ADD-SFC', platform)
    const srcFile = path.join(TEMP_SRC_DIR, 'add-test.vue')
    const distTemplate = path.join(TEMP_DIST_DIR, `add-test.${ext.template}`)
    const distStyle = path.join(TEMP_DIST_DIR, `add-test.${ext.style}`)
    const distScript = path.join(TEMP_DIST_DIR, 'add-test.js')

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
      await dev.waitFor(waitForFile(path.join(DIST_ROOT, 'app.json'), 120_000), `${platform} app.json generated`)

      await fs.ensureDir(TEMP_SRC_DIR)
      await fs.writeFile(srcFile, sfcContent, 'utf8')

      const templateContent = await dev.waitFor(
        waitForFileContains(distTemplate, marker),
        `${platform} added SFC template`,
      )
      expect(templateContent).toContain(marker)

      const styleContent = await dev.waitFor(
        waitForFileContains(distStyle, marker),
        `${platform} added SFC style`,
      )
      expect(styleContent).toContain(marker)

      const scriptContent = await dev.waitFor(
        waitForFileContains(distScript, marker),
        `${platform} added SFC script`,
      )
      expect(scriptContent).toContain(marker)
    }
    finally {
      await dev.stop(5_000)
      await fs.remove(srcFile)
      await fs.remove(TEMP_DIST_DIR)
    }
  })
})

describe.sequential('HMR add — component-level file additions (dev watch)', () => {
  it.each(PLATFORM_LIST)('新增完整组件 (%s)', async (platform) => {
    await fs.remove(DIST_ROOT)
    const ext = PLATFORM_EXT[platform]
    const marker = createHmrMarker('ADD-COMP', platform)

    const srcTemplate = path.join(COMP_TEMP_SRC_DIR, 'index.wxml')
    const srcScript = path.join(COMP_TEMP_SRC_DIR, 'index.ts')
    const srcStyle = path.join(COMP_TEMP_SRC_DIR, 'index.wxss')
    const srcJson = path.join(COMP_TEMP_SRC_DIR, 'index.json')

    const distTemplate = path.join(COMP_TEMP_DIST_DIR, `index.${ext.template}`)
    const distScript = path.join(COMP_TEMP_DIST_DIR, 'index.js')
    const distStyle = path.join(COMP_TEMP_DIST_DIR, `index.${ext.style}`)
    const distJson = path.join(COMP_TEMP_DIST_DIR, 'index.json')

    // @ts-expect-error execa v9 overload resolution
    const dev = startDevProcess('node', ['--import', 'tsx', CLI_PATH, 'dev', APP_ROOT, '--platform', platform, '--skipNpm'], {
      env: createDevProcessEnv(),
      stdio: 'inherit',
    })

    try {
      await dev.waitFor(waitForFile(path.join(DIST_ROOT, 'app.json'), 120_000), `${platform} app.json generated`)

      await fs.ensureDir(COMP_TEMP_SRC_DIR)
      await fs.writeFile(srcTemplate, `<view>${marker}</view>`, 'utf8')
      await fs.writeFile(srcScript, `const marker = '${marker}'\nComponent({})\n`, 'utf8')
      await fs.writeFile(srcStyle, `.hmr-temp-comp { /* ${marker} */ }`, 'utf8')
      await fs.writeFile(srcJson, JSON.stringify({ component: true, hmrMarker: marker }, null, 2), 'utf8')

      const templateContent = await dev.waitFor(
        waitForFileContains(distTemplate, marker),
        `${platform} added component template`,
      )
      expect(templateContent).toContain(marker)

      const scriptContent = await dev.waitFor(
        waitForFileContains(distScript, marker),
        `${platform} added component script`,
      )
      expect(scriptContent).toContain(marker)

      const styleContent = await dev.waitFor(
        waitForFileContains(distStyle, marker),
        `${platform} added component style`,
      )
      expect(styleContent).toContain(marker)

      const jsonContent = await dev.waitFor(
        waitForFileContains(distJson, marker),
        `${platform} added component json`,
      )
      expect(jsonContent).toContain(marker)
    }
    finally {
      await dev.stop(5_000)
      await fs.remove(COMP_TEMP_SRC_DIR)
      await fs.remove(COMP_TEMP_DIST_DIR)
    }
  })

  it.each(PLATFORM_LIST)('在现有组件中新增 .wxss 样式文件 (%s)', async (platform) => {
    await fs.remove(DIST_ROOT)
    const ext = PLATFORM_EXT[platform]
    const marker = createHmrMarker('ADD-COMP-STYLE', platform)

    const srcTemplate = path.join(COMP_TEMP_SRC_DIR, 'index.wxml')
    const srcScript = path.join(COMP_TEMP_SRC_DIR, 'index.ts')
    const srcJson = path.join(COMP_TEMP_SRC_DIR, 'index.json')
    const srcExtraStyle = path.join(COMP_TEMP_SRC_DIR, 'extra.wxss')
    const distExtraStyle = path.join(COMP_TEMP_DIST_DIR, `extra.${ext.style}`)

    // @ts-expect-error execa v9 overload resolution
    const dev = startDevProcess('node', ['--import', 'tsx', CLI_PATH, 'dev', APP_ROOT, '--platform', platform, '--skipNpm'], {
      env: createDevProcessEnv(),
      stdio: 'inherit',
    })

    try {
      await dev.waitFor(waitForFile(path.join(DIST_ROOT, 'app.json'), 120_000), `${platform} app.json generated`)

      // 先创建基础组件文件
      await fs.ensureDir(COMP_TEMP_SRC_DIR)
      await fs.writeFile(srcTemplate, '<view>temp-comp</view>', 'utf8')
      await fs.writeFile(srcScript, 'Component({})\n', 'utf8')
      await fs.writeFile(srcJson, JSON.stringify({ component: true }, null, 2), 'utf8')

      // 等待基础组件构建完成
      const distTemplate = path.join(COMP_TEMP_DIST_DIR, `index.${ext.template}`)
      await dev.waitFor(waitForFileContains(distTemplate, 'temp-comp'), `${platform} base component built`)

      // 新增额外样式文件
      await fs.writeFile(srcExtraStyle, `.extra-style { /* ${marker} */ }`, 'utf8')

      const content = await dev.waitFor(
        waitForFileContains(distExtraStyle, marker),
        `${platform} added extra style to component`,
      )
      expect(content).toContain(marker)
    }
    finally {
      await dev.stop(5_000)
      await fs.remove(COMP_TEMP_SRC_DIR)
      await fs.remove(COMP_TEMP_DIST_DIR)
    }
  })
})
