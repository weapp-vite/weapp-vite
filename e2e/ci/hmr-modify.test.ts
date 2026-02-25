import fs from 'fs-extra'
import path from 'pathe'
import { startDevProcess } from '../utils/dev-process'
import { createDevProcessEnv } from '../utils/dev-process-env'
import { createHmrMarker, PLATFORM_EXT, resolvePlatforms, waitForFileContains } from '../utils/hmr-helpers'
import { APP_ROOT, CLI_PATH, DIST_ROOT, waitForFile } from '../wevu-runtime.utils'

/**
 * 页面级 HMR 源文件路径
 */
const HMR_SRC_DIR = path.join(APP_ROOT, 'src/pages/hmr')
const SRC_TEMPLATE = path.join(HMR_SRC_DIR, 'index.wxml')
const SRC_STYLE = path.join(HMR_SRC_DIR, 'index.wxss')
const SRC_SCRIPT = path.join(HMR_SRC_DIR, 'index.ts')
const SRC_JSON = path.join(HMR_SRC_DIR, 'index.json')

const PLATFORM_LIST = resolvePlatforms()

describe.sequential('HMR modify — page-level file changes (dev watch)', () => {
  it.each(PLATFORM_LIST)('修改 .wxml 模板文件 (%s)', async (platform) => {
    await fs.remove(DIST_ROOT)
    const originalSource = await fs.readFile(SRC_TEMPLATE, 'utf8')
    const ext = PLATFORM_EXT[platform]
    const distPath = path.join(DIST_ROOT, `pages/hmr/index.${ext.template}`)
    const marker = createHmrMarker('MODIFY-TEMPLATE', platform)

    const updatedSource = originalSource.replace('HMR', marker)
    if (updatedSource === originalSource) {
      throw new Error('Failed to insert marker into .wxml source.')
    }

    // @ts-expect-error execa v9 overload resolution
    const dev = startDevProcess('node', ['--import', 'tsx', CLI_PATH, 'dev', APP_ROOT, '--platform', platform, '--skipNpm'], {
      env: createDevProcessEnv(),
      stdio: 'inherit',
    })

    try {
      await dev.waitFor(waitForFile(path.join(DIST_ROOT, 'app.json'), 120_000), `${platform} app.json generated`)
      await dev.waitFor(waitForFileContains(distPath, 'HMR'), `${platform} initial template`)

      await fs.writeFile(SRC_TEMPLATE, updatedSource, 'utf8')

      const content = await dev.waitFor(
        waitForFileContains(distPath, marker),
        `${platform} updated template marker`,
      )
      expect(content).toContain(marker)
    }
    finally {
      await dev.stop(5_000)
      await fs.writeFile(SRC_TEMPLATE, originalSource, 'utf8')
    }
  })

  it.each(PLATFORM_LIST)('修改 .wxss 样式文件 (%s)', async (platform) => {
    await fs.remove(DIST_ROOT)
    const originalSource = await fs.readFile(SRC_STYLE, 'utf8')
    const ext = PLATFORM_EXT[platform]
    const distPath = path.join(DIST_ROOT, `pages/hmr/index.${ext.style}`)
    const marker = createHmrMarker('MODIFY-STYLE', platform)

    const updatedSource = originalSource.replace('.page {', `.page { /* ${marker} */`)
    if (updatedSource === originalSource) {
      throw new Error('Failed to insert marker into .wxss source.')
    }

    // @ts-expect-error execa v9 overload resolution
    const dev = startDevProcess('node', ['--import', 'tsx', CLI_PATH, 'dev', APP_ROOT, '--platform', platform, '--skipNpm'], {
      env: createDevProcessEnv(),
      stdio: 'inherit',
    })

    try {
      await dev.waitFor(waitForFile(path.join(DIST_ROOT, 'app.json'), 120_000), `${platform} app.json generated`)
      await dev.waitFor(waitForFileContains(distPath, '.page'), `${platform} initial style`)

      await fs.writeFile(SRC_STYLE, updatedSource, 'utf8')

      const content = await dev.waitFor(
        waitForFileContains(distPath, marker),
        `${platform} updated style marker`,
      )
      expect(content).toContain(marker)
    }
    finally {
      await dev.stop(5_000)
      await fs.writeFile(SRC_STYLE, originalSource, 'utf8')
    }
  })

  it.each(PLATFORM_LIST)('修改 .ts 脚本文件 (%s)', async (platform) => {
    await fs.remove(DIST_ROOT)
    const originalSource = await fs.readFile(SRC_SCRIPT, 'utf8')
    const distPath = path.join(DIST_ROOT, 'pages/hmr/index.js')
    const marker = createHmrMarker('MODIFY-SCRIPT', platform)

    const markerLine = `const hmrMarker = '${marker}'`
    const updatedSource = `${markerLine}\n${originalSource}`

    // @ts-expect-error execa v9 overload resolution
    const dev = startDevProcess('node', ['--import', 'tsx', CLI_PATH, 'dev', APP_ROOT, '--platform', platform, '--skipNpm'], {
      env: createDevProcessEnv(),
      stdio: 'inherit',
    })

    try {
      await dev.waitFor(waitForFile(path.join(DIST_ROOT, 'app.json'), 120_000), `${platform} app.json generated`)
      await dev.waitFor(waitForFileContains(distPath, 'defineComponent'), `${platform} initial script`)

      await fs.writeFile(SRC_SCRIPT, updatedSource, 'utf8')

      const content = await dev.waitFor(
        waitForFileContains(distPath, marker),
        `${platform} updated script marker`,
      )
      expect(content).toContain(marker)
    }
    finally {
      await dev.stop(5_000)
      await fs.writeFile(SRC_SCRIPT, originalSource, 'utf8')
    }
  })

  it.each(PLATFORM_LIST)('修改 .json 配置文件 (%s)', async (platform) => {
    await fs.remove(DIST_ROOT)
    const originalSource = await fs.readFile(SRC_JSON, 'utf8')
    const distPath = path.join(DIST_ROOT, 'pages/hmr/index.json')
    const marker = createHmrMarker('MODIFY-JSON', platform)

    const jsonData = JSON.parse(originalSource)
    jsonData.hmrMarker = marker
    const updatedSource = JSON.stringify(jsonData, null, 2)

    // @ts-expect-error execa v9 overload resolution
    const dev = startDevProcess('node', ['--import', 'tsx', CLI_PATH, 'dev', APP_ROOT, '--platform', platform, '--skipNpm'], {
      env: createDevProcessEnv(),
      stdio: 'inherit',
    })

    try {
      await dev.waitFor(waitForFile(path.join(DIST_ROOT, 'app.json'), 120_000), `${platform} app.json generated`)
      await dev.waitFor(waitForFileContains(distPath, 'component'), `${platform} initial json`)

      await fs.writeFile(SRC_JSON, updatedSource, 'utf8')

      const content = await dev.waitFor(
        waitForFileContains(distPath, marker),
        `${platform} updated json marker`,
      )
      expect(content).toContain(marker)
    }
    finally {
      await dev.stop(5_000)
      await fs.writeFile(SRC_JSON, originalSource, 'utf8')
    }
  })
})

/**
 * 组件级 HMR 源文件路径
 */
const COMP_SRC_DIR = path.join(APP_ROOT, 'src/components/x-child')
const COMP_SRC_TEMPLATE = path.join(COMP_SRC_DIR, 'index.wxml')
const COMP_SRC_STYLE = path.join(COMP_SRC_DIR, 'index.wxss')
const COMP_SRC_SCRIPT = path.join(COMP_SRC_DIR, 'index.ts')
const COMP_SRC_JSON = path.join(COMP_SRC_DIR, 'index.json')

describe.sequential('HMR modify — component-level file changes (dev watch)', () => {
  it.each(PLATFORM_LIST)('修改组件 .wxml 模板文件 (%s)', async (platform) => {
    await fs.remove(DIST_ROOT)
    const originalSource = await fs.readFile(COMP_SRC_TEMPLATE, 'utf8')
    const ext = PLATFORM_EXT[platform]
    const distPath = path.join(DIST_ROOT, `components/x-child/index.${ext.template}`)
    const marker = createHmrMarker('MODIFY-COMP-TEMPLATE', platform)

    const updatedSource = originalSource.replace('<view class="child">', `<view class="child"><!-- ${marker} -->`)
    if (updatedSource === originalSource) {
      throw new Error('Failed to insert marker into component .wxml source.')
    }

    // @ts-expect-error execa v9 overload resolution
    const dev = startDevProcess('node', ['--import', 'tsx', CLI_PATH, 'dev', APP_ROOT, '--platform', platform, '--skipNpm'], {
      env: createDevProcessEnv(),
      stdio: 'inherit',
    })

    try {
      await dev.waitFor(waitForFile(path.join(DIST_ROOT, 'app.json'), 120_000), `${platform} app.json generated`)
      await dev.waitFor(waitForFileContains(distPath, 'child'), `${platform} initial component template`)

      await fs.writeFile(COMP_SRC_TEMPLATE, updatedSource, 'utf8')

      const content = await dev.waitFor(
        waitForFileContains(distPath, marker),
        `${platform} updated component template marker`,
      )
      expect(content).toContain(marker)
    }
    finally {
      await dev.stop(5_000)
      await fs.writeFile(COMP_SRC_TEMPLATE, originalSource, 'utf8')
    }
  })

  it.each(PLATFORM_LIST)('修改组件 .wxss 样式文件 (%s)', async (platform) => {
    await fs.remove(DIST_ROOT)
    const originalSource = await fs.readFile(COMP_SRC_STYLE, 'utf8')
    const ext = PLATFORM_EXT[platform]
    const distPath = path.join(DIST_ROOT, `components/x-child/index.${ext.style}`)
    const marker = createHmrMarker('MODIFY-COMP-STYLE', platform)

    const updatedSource = originalSource.replace('.child {', `.child { /* ${marker} */`)
    if (updatedSource === originalSource) {
      throw new Error('Failed to insert marker into component .wxss source.')
    }

    // @ts-expect-error execa v9 overload resolution
    const dev = startDevProcess('node', ['--import', 'tsx', CLI_PATH, 'dev', APP_ROOT, '--platform', platform, '--skipNpm'], {
      env: createDevProcessEnv(),
      stdio: 'inherit',
    })

    try {
      await dev.waitFor(waitForFile(path.join(DIST_ROOT, 'app.json'), 120_000), `${platform} app.json generated`)
      await dev.waitFor(waitForFileContains(distPath, '.child'), `${platform} initial component style`)

      await fs.writeFile(COMP_SRC_STYLE, updatedSource, 'utf8')

      const content = await dev.waitFor(
        waitForFileContains(distPath, marker),
        `${platform} updated component style marker`,
      )
      expect(content).toContain(marker)
    }
    finally {
      await dev.stop(5_000)
      await fs.writeFile(COMP_SRC_STYLE, originalSource, 'utf8')
    }
  })

  it.each(PLATFORM_LIST)('修改组件 .ts 脚本文件 (%s)', async (platform) => {
    await fs.remove(DIST_ROOT)
    const originalSource = await fs.readFile(COMP_SRC_SCRIPT, 'utf8')
    const distPath = path.join(DIST_ROOT, 'components/x-child/index.js')
    const marker = createHmrMarker('MODIFY-COMP-SCRIPT', platform)

    const markerLine = `const hmrMarker = '${marker}'`
    const updatedSource = `${markerLine}\n${originalSource}`

    // @ts-expect-error execa v9 overload resolution
    const dev = startDevProcess('node', ['--import', 'tsx', CLI_PATH, 'dev', APP_ROOT, '--platform', platform, '--skipNpm'], {
      env: createDevProcessEnv(),
      stdio: 'inherit',
    })

    try {
      await dev.waitFor(waitForFile(path.join(DIST_ROOT, 'app.json'), 120_000), `${platform} app.json generated`)
      await dev.waitFor(waitForFileContains(distPath, 'defineComponent'), `${platform} initial component script`)

      await fs.writeFile(COMP_SRC_SCRIPT, updatedSource, 'utf8')

      const content = await dev.waitFor(
        waitForFileContains(distPath, marker),
        `${platform} updated component script marker`,
      )
      expect(content).toContain(marker)
    }
    finally {
      await dev.stop(5_000)
      await fs.writeFile(COMP_SRC_SCRIPT, originalSource, 'utf8')
    }
  })

  it.each(PLATFORM_LIST)('修改组件 .json 配置文件 (%s)', async (platform) => {
    await fs.remove(DIST_ROOT)
    const originalSource = await fs.readFile(COMP_SRC_JSON, 'utf8')
    const distPath = path.join(DIST_ROOT, 'components/x-child/index.json')
    const marker = createHmrMarker('MODIFY-COMP-JSON', platform)

    const jsonData = JSON.parse(originalSource)
    jsonData.hmrMarker = marker
    const updatedSource = JSON.stringify(jsonData, null, 2)

    // @ts-expect-error execa v9 overload resolution
    const dev = startDevProcess('node', ['--import', 'tsx', CLI_PATH, 'dev', APP_ROOT, '--platform', platform, '--skipNpm'], {
      env: createDevProcessEnv(),
      stdio: 'inherit',
    })

    try {
      await dev.waitFor(waitForFile(path.join(DIST_ROOT, 'app.json'), 120_000), `${platform} app.json generated`)
      await dev.waitFor(waitForFileContains(distPath, 'component'), `${platform} initial component json`)

      await fs.writeFile(COMP_SRC_JSON, updatedSource, 'utf8')

      const content = await dev.waitFor(
        waitForFileContains(distPath, marker),
        `${platform} updated component json marker`,
      )
      expect(content).toContain(marker)
    }
    finally {
      await dev.stop(5_000)
      await fs.writeFile(COMP_SRC_JSON, originalSource, 'utf8')
    }
  })
})

/**
 * Vue SFC HMR 源文件路径
 */
const SFC_SRC_PATH = path.join(APP_ROOT, 'src/pages/hmr-sfc/index.vue')

describe.sequential('HMR modify — Vue SFC changes (dev watch)', () => {
  it.each(PLATFORM_LIST)('修改 .vue SFC template 部分 (%s)', async (platform) => {
    await fs.remove(DIST_ROOT)
    const originalSource = await fs.readFile(SFC_SRC_PATH, 'utf8')
    const ext = PLATFORM_EXT[platform]
    const distPath = path.join(DIST_ROOT, `pages/hmr-sfc/index.${ext.template}`)
    const marker = createHmrMarker('MODIFY-SFC-TEMPLATE', platform)

    const updatedSource = originalSource.replace('HMR-SFC</view>', `${marker}</view>`)
    if (updatedSource === originalSource) {
      throw new Error('Failed to insert marker into .vue template section.')
    }

    // @ts-expect-error execa v9 overload resolution
    const dev = startDevProcess('node', ['--import', 'tsx', CLI_PATH, 'dev', APP_ROOT, '--platform', platform, '--skipNpm'], {
      env: createDevProcessEnv(),
      stdio: 'inherit',
    })

    try {
      await dev.waitFor(waitForFile(path.join(DIST_ROOT, 'app.json'), 120_000), `${platform} app.json generated`)
      await dev.waitFor(waitForFileContains(distPath, 'HMR-SFC'), `${platform} initial SFC template`)

      await fs.writeFile(SFC_SRC_PATH, updatedSource, 'utf8')

      const content = await dev.waitFor(
        waitForFileContains(distPath, marker),
        `${platform} updated SFC template marker`,
      )
      expect(content).toContain(marker)
    }
    finally {
      await dev.stop(5_000)
      await fs.writeFile(SFC_SRC_PATH, originalSource, 'utf8')
    }
  })

  it.each(PLATFORM_LIST)('修改 .vue SFC style 部分 (%s)', async (platform) => {
    await fs.remove(DIST_ROOT)
    const originalSource = await fs.readFile(SFC_SRC_PATH, 'utf8')
    const ext = PLATFORM_EXT[platform]
    const distPath = path.join(DIST_ROOT, `pages/hmr-sfc/index.${ext.style}`)
    const marker = createHmrMarker('MODIFY-SFC-STYLE', platform)

    const updatedSource = originalSource.replace('/* HMR-SFC-STYLE */', `/* ${marker} */`)
    if (updatedSource === originalSource) {
      throw new Error('Failed to insert marker into .vue style section.')
    }

    // @ts-expect-error execa v9 overload resolution
    const dev = startDevProcess('node', ['--import', 'tsx', CLI_PATH, 'dev', APP_ROOT, '--platform', platform, '--skipNpm'], {
      env: createDevProcessEnv(),
      stdio: 'inherit',
    })

    try {
      await dev.waitFor(waitForFile(path.join(DIST_ROOT, 'app.json'), 120_000), `${platform} app.json generated`)
      await dev.waitFor(waitForFileContains(distPath, 'hmr-sfc-page'), `${platform} initial SFC style`)

      await fs.writeFile(SFC_SRC_PATH, updatedSource, 'utf8')

      const content = await dev.waitFor(
        waitForFileContains(distPath, marker),
        `${platform} updated SFC style marker`,
      )
      expect(content).toContain(marker)
    }
    finally {
      await dev.stop(5_000)
      await fs.writeFile(SFC_SRC_PATH, originalSource, 'utf8')
    }
  })

  it.each(PLATFORM_LIST)('修改 .vue SFC script 部分 (%s)', async (platform) => {
    await fs.remove(DIST_ROOT)
    const originalSource = await fs.readFile(SFC_SRC_PATH, 'utf8')
    const distPath = path.join(DIST_ROOT, 'pages/hmr-sfc/index.js')
    const marker = createHmrMarker('MODIFY-SFC-SCRIPT', platform)

    const updatedSource = originalSource.replace('/* HMR-SFC-SCRIPT */', `/* ${marker} */`)
    if (updatedSource === originalSource) {
      throw new Error('Failed to insert marker into .vue script section.')
    }

    // @ts-expect-error execa v9 overload resolution
    const dev = startDevProcess('node', ['--import', 'tsx', CLI_PATH, 'dev', APP_ROOT, '--platform', platform, '--skipNpm'], {
      env: createDevProcessEnv(),
      stdio: 'inherit',
    })

    try {
      await dev.waitFor(waitForFile(path.join(DIST_ROOT, 'app.json'), 120_000), `${platform} app.json generated`)
      await dev.waitFor(waitForFileContains(distPath, 'HMR-SFC-SCRIPT'), `${platform} initial SFC script`)

      await fs.writeFile(SFC_SRC_PATH, updatedSource, 'utf8')

      const content = await dev.waitFor(
        waitForFileContains(distPath, marker),
        `${platform} updated SFC script marker`,
      )
      expect(content).toContain(marker)
    }
    finally {
      await dev.stop(5_000)
      await fs.writeFile(SFC_SRC_PATH, originalSource, 'utf8')
    }
  })
})
