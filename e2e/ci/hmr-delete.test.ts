import fs from 'fs-extra'
import path from 'pathe'
import { startDevProcess } from '../utils/dev-process'
import { createDevProcessEnv } from '../utils/dev-process-env'
import { createHmrMarker, PLATFORM_EXT, resolvePlatforms, waitForFileContains, waitForFileRemoved } from '../utils/hmr-helpers'
import { APP_ROOT, CLI_PATH, DIST_ROOT, waitForFile } from '../wevu-runtime.utils'

/**
 * 页面级删除测试临时目录
 */
const TEMP_SRC_DIR = path.join(APP_ROOT, 'src/pages/hmr-temp')
const TEMP_DIST_DIR = path.join(DIST_ROOT, 'pages/hmr-temp')

/**
 * 组件级删除测试临时目录
 */
const COMP_TEMP_SRC_DIR = path.join(APP_ROOT, 'src/components/hmr-temp-comp')
const COMP_TEMP_DIST_DIR = path.join(DIST_ROOT, 'components/hmr-temp-comp')

const PLATFORM_LIST = resolvePlatforms()

describe.sequential('HMR delete — page-level file deletions (dev watch)', () => {
  it.each(PLATFORM_LIST)('删除 .wxml 模板文件 (%s)', async (platform) => {
    await fs.remove(DIST_ROOT)
    const ext = PLATFORM_EXT[platform]
    const marker = createHmrMarker('DEL-TEMPLATE', platform)
    const srcFile = path.join(TEMP_SRC_DIR, 'del-test.wxml')
    const distFile = path.join(TEMP_DIST_DIR, `del-test.${ext.template}`)

    // @ts-expect-error execa v9 overload resolution
    const dev = startDevProcess('node', ['--import', 'tsx', CLI_PATH, 'dev', APP_ROOT, '--platform', platform, '--skipNpm'], {
      env: createDevProcessEnv(),
      stdio: 'inherit',
    })

    try {
      await dev.waitFor(waitForFile(path.join(DIST_ROOT, 'app.json'), 120_000), `${platform} app.json generated`)

      // 创建临时源文件并等待 dist 生成
      await fs.ensureDir(TEMP_SRC_DIR)
      await fs.writeFile(srcFile, `<view>${marker}</view>`, 'utf8')

      const content = await dev.waitFor(
        waitForFileContains(distFile, marker),
        `${platform} temp template file appeared in dist`,
      )
      expect(content).toContain(marker)

      // 删除源文件并验证 dist 文件被移除
      await fs.remove(srcFile)

      await dev.waitFor(
        waitForFileRemoved(distFile),
        `${platform} deleted template file removed from dist`,
      )
    }
    finally {
      await dev.stop(5_000)
      await fs.remove(TEMP_SRC_DIR)
      await fs.remove(TEMP_DIST_DIR)
    }
  })

  it.each(PLATFORM_LIST)('删除 .wxss 样式文件 (%s)', async (platform) => {
    await fs.remove(DIST_ROOT)
    const ext = PLATFORM_EXT[platform]
    const marker = createHmrMarker('DEL-STYLE', platform)
    const srcFile = path.join(TEMP_SRC_DIR, 'del-test.wxss')
    const distFile = path.join(TEMP_DIST_DIR, `del-test.${ext.style}`)

    // @ts-expect-error execa v9 overload resolution
    const dev = startDevProcess('node', ['--import', 'tsx', CLI_PATH, 'dev', APP_ROOT, '--platform', platform, '--skipNpm'], {
      env: createDevProcessEnv(),
      stdio: 'inherit',
    })

    try {
      await dev.waitFor(waitForFile(path.join(DIST_ROOT, 'app.json'), 120_000), `${platform} app.json generated`)

      // 创建临时源文件并等待 dist 生成
      await fs.ensureDir(TEMP_SRC_DIR)
      await fs.writeFile(srcFile, `.del-test { /* ${marker} */ }`, 'utf8')

      const content = await dev.waitFor(
        waitForFileContains(distFile, marker),
        `${platform} temp style file appeared in dist`,
      )
      expect(content).toContain(marker)

      // 删除源文件并验证 dist 文件被移除
      await fs.remove(srcFile)

      await dev.waitFor(
        waitForFileRemoved(distFile),
        `${platform} deleted style file removed from dist`,
      )
    }
    finally {
      await dev.stop(5_000)
      await fs.remove(TEMP_SRC_DIR)
      await fs.remove(TEMP_DIST_DIR)
    }
  })

  it.each(PLATFORM_LIST)('删除 .ts 脚本文件 (%s)', async (platform) => {
    await fs.remove(DIST_ROOT)
    const marker = createHmrMarker('DEL-SCRIPT', platform)
    const srcFile = path.join(TEMP_SRC_DIR, 'del-test.ts')
    const distFile = path.join(TEMP_DIST_DIR, 'del-test.js')

    // @ts-expect-error execa v9 overload resolution
    const dev = startDevProcess('node', ['--import', 'tsx', CLI_PATH, 'dev', APP_ROOT, '--platform', platform, '--skipNpm'], {
      env: createDevProcessEnv(),
      stdio: 'inherit',
    })

    try {
      await dev.waitFor(waitForFile(path.join(DIST_ROOT, 'app.json'), 120_000), `${platform} app.json generated`)

      // 创建临时源文件并等待 dist 生成
      await fs.ensureDir(TEMP_SRC_DIR)
      await fs.writeFile(srcFile, `const marker = '${marker}'\nconsole.log(marker)\n`, 'utf8')

      const content = await dev.waitFor(
        waitForFileContains(distFile, marker),
        `${platform} temp script file appeared in dist`,
      )
      expect(content).toContain(marker)

      // 删除源文件并验证 dist 文件被移除
      await fs.remove(srcFile)

      await dev.waitFor(
        waitForFileRemoved(distFile),
        `${platform} deleted script file removed from dist`,
      )
    }
    finally {
      await dev.stop(5_000)
      await fs.remove(TEMP_SRC_DIR)
      await fs.remove(TEMP_DIST_DIR)
    }
  })

  it.each(PLATFORM_LIST)('删除 .json 配置文件 (%s)', async (platform) => {
    await fs.remove(DIST_ROOT)
    const marker = createHmrMarker('DEL-JSON', platform)
    const srcFile = path.join(TEMP_SRC_DIR, 'del-test.json')
    const distFile = path.join(TEMP_DIST_DIR, 'del-test.json')

    // @ts-expect-error execa v9 overload resolution
    const dev = startDevProcess('node', ['--import', 'tsx', CLI_PATH, 'dev', APP_ROOT, '--platform', platform, '--skipNpm'], {
      env: createDevProcessEnv(),
      stdio: 'inherit',
    })

    try {
      await dev.waitFor(waitForFile(path.join(DIST_ROOT, 'app.json'), 120_000), `${platform} app.json generated`)

      // 创建临时源文件并等待 dist 生成
      await fs.ensureDir(TEMP_SRC_DIR)
      await fs.writeFile(srcFile, JSON.stringify({ component: true, hmrMarker: marker }, null, 2), 'utf8')

      const content = await dev.waitFor(
        waitForFileContains(distFile, marker),
        `${platform} temp json file appeared in dist`,
      )
      expect(content).toContain(marker)

      // 删除源文件并验证 dist 文件被移除
      await fs.remove(srcFile)

      await dev.waitFor(
        waitForFileRemoved(distFile),
        `${platform} deleted json file removed from dist`,
      )
    }
    finally {
      await dev.stop(5_000)
      await fs.remove(TEMP_SRC_DIR)
      await fs.remove(TEMP_DIST_DIR)
    }
  })

  it.each(PLATFORM_LIST)('删除 .vue SFC 文件 (%s)', async (platform) => {
    await fs.remove(DIST_ROOT)
    const ext = PLATFORM_EXT[platform]
    const marker = createHmrMarker('DEL-SFC', platform)
    const srcFile = path.join(TEMP_SRC_DIR, 'del-test.vue')
    const distTemplate = path.join(TEMP_DIST_DIR, `del-test.${ext.template}`)
    const distStyle = path.join(TEMP_DIST_DIR, `del-test.${ext.style}`)
    const distScript = path.join(TEMP_DIST_DIR, 'del-test.js')

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
      `.del-test-sfc { /* ${marker} */ }`,
      '</style>',
    ].join('\n')

    // @ts-expect-error execa v9 overload resolution
    const dev = startDevProcess('node', ['--import', 'tsx', CLI_PATH, 'dev', APP_ROOT, '--platform', platform, '--skipNpm'], {
      env: createDevProcessEnv(),
      stdio: 'inherit',
    })

    try {
      await dev.waitFor(waitForFile(path.join(DIST_ROOT, 'app.json'), 120_000), `${platform} app.json generated`)

      // 创建临时 SFC 源文件并等待 dist 生成所有输出
      await fs.ensureDir(TEMP_SRC_DIR)
      await fs.writeFile(srcFile, sfcContent, 'utf8')

      const templateContent = await dev.waitFor(
        waitForFileContains(distTemplate, marker),
        `${platform} temp SFC template appeared in dist`,
      )
      expect(templateContent).toContain(marker)

      const styleContent = await dev.waitFor(
        waitForFileContains(distStyle, marker),
        `${platform} temp SFC style appeared in dist`,
      )
      expect(styleContent).toContain(marker)

      const scriptContent = await dev.waitFor(
        waitForFileContains(distScript, marker),
        `${platform} temp SFC script appeared in dist`,
      )
      expect(scriptContent).toContain(marker)

      // 删除 SFC 源文件并验证 dist 中所有输出文件被移除
      await fs.remove(srcFile)

      await dev.waitFor(
        waitForFileRemoved(distTemplate),
        `${platform} deleted SFC template removed from dist`,
      )

      await dev.waitFor(
        waitForFileRemoved(distStyle),
        `${platform} deleted SFC style removed from dist`,
      )

      await dev.waitFor(
        waitForFileRemoved(distScript),
        `${platform} deleted SFC script removed from dist`,
      )
    }
    finally {
      await dev.stop(5_000)
      await fs.remove(TEMP_SRC_DIR)
      await fs.remove(TEMP_DIST_DIR)
    }
  })
})

describe.sequential('HMR delete — component-level file deletions (dev watch)', () => {
  it.each(PLATFORM_LIST)('删除组件 .wxml 模板文件 (%s)', async (platform) => {
    await fs.remove(DIST_ROOT)
    const ext = PLATFORM_EXT[platform]
    const marker = createHmrMarker('DEL-COMP-TEMPLATE', platform)

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

      // 创建完整组件并等待 dist 生成所有文件
      await fs.ensureDir(COMP_TEMP_SRC_DIR)
      await fs.writeFile(srcTemplate, `<view>${marker}</view>`, 'utf8')
      await fs.writeFile(srcScript, `const marker = '${marker}'\nComponent({})\n`, 'utf8')
      await fs.writeFile(srcStyle, `.hmr-temp-comp { /* ${marker} */ }`, 'utf8')
      await fs.writeFile(srcJson, JSON.stringify({ component: true, hmrMarker: marker }, null, 2), 'utf8')

      const templateContent = await dev.waitFor(
        waitForFileContains(distTemplate, marker),
        `${platform} component template appeared in dist`,
      )
      expect(templateContent).toContain(marker)

      await dev.waitFor(
        waitForFileContains(distScript, marker),
        `${platform} component script appeared in dist`,
      )
      await dev.waitFor(
        waitForFileContains(distStyle, marker),
        `${platform} component style appeared in dist`,
      )
      await dev.waitFor(
        waitForFileContains(distJson, marker),
        `${platform} component json appeared in dist`,
      )

      // 删除组件模板源文件并验证 dist 中对应平台模板文件被移除
      await fs.remove(srcTemplate)

      await dev.waitFor(
        waitForFileRemoved(distTemplate),
        `${platform} deleted component template removed from dist`,
      )
    }
    finally {
      await dev.stop(5_000)
      await fs.remove(COMP_TEMP_SRC_DIR)
      await fs.remove(COMP_TEMP_DIST_DIR)
    }
  })

  it.each(PLATFORM_LIST)('删除组件 .wxss 样式文件 (%s)', async (platform) => {
    await fs.remove(DIST_ROOT)
    const ext = PLATFORM_EXT[platform]
    const marker = createHmrMarker('DEL-COMP-STYLE', platform)

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

      // 创建完整组件并等待 dist 生成所有文件
      await fs.ensureDir(COMP_TEMP_SRC_DIR)
      await fs.writeFile(srcTemplate, `<view>${marker}</view>`, 'utf8')
      await fs.writeFile(srcScript, `const marker = '${marker}'\nComponent({})\n`, 'utf8')
      await fs.writeFile(srcStyle, `.hmr-temp-comp { /* ${marker} */ }`, 'utf8')
      await fs.writeFile(srcJson, JSON.stringify({ component: true, hmrMarker: marker }, null, 2), 'utf8')

      await dev.waitFor(
        waitForFileContains(distTemplate, marker),
        `${platform} component template appeared in dist`,
      )
      await dev.waitFor(
        waitForFileContains(distScript, marker),
        `${platform} component script appeared in dist`,
      )

      const styleContent = await dev.waitFor(
        waitForFileContains(distStyle, marker),
        `${platform} component style appeared in dist`,
      )
      expect(styleContent).toContain(marker)

      await dev.waitFor(
        waitForFileContains(distJson, marker),
        `${platform} component json appeared in dist`,
      )

      // 删除组件样式源文件并验证 dist 中对应平台样式文件被移除
      await fs.remove(srcStyle)

      await dev.waitFor(
        waitForFileRemoved(distStyle),
        `${platform} deleted component style removed from dist`,
      )
    }
    finally {
      await dev.stop(5_000)
      await fs.remove(COMP_TEMP_SRC_DIR)
      await fs.remove(COMP_TEMP_DIST_DIR)
    }
  })
})
