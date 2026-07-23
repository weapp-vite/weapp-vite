import { fs } from '@weapp-core/shared/node'
import path from 'pathe'
import { startDevProcess } from '../utils/dev-process'
import { cleanupResidualDevProcesses } from '../utils/dev-process-cleanup'
import { createDevProcessEnv } from '../utils/dev-process-env'
import { createHmrMarker, PLATFORM_EXT, replaceFileByRename, replaceHmrScriptName, replaceHmrSfcTitle, resolvePlatforms, waitForFileContains } from '../utils/hmr-helpers'
import { APP_ROOT, CLI_PATH, DIST_ROOT, waitForFile } from '../wevu-runtime.utils'

/**
 * 页面级 HMR 源文件路径
 */
const HMR_SRC_DIR = path.join(APP_ROOT, 'src/pages/hmr')
const SRC_TEMPLATE = path.join(HMR_SRC_DIR, 'index.wxml')
const SRC_SCRIPT = path.join(HMR_SRC_DIR, 'index.ts')

/**
 * Vue SFC HMR 源文件路径
 */
const SFC_SRC_PATH = path.join(APP_ROOT, 'src/pages/hmr-sfc/index.vue')
const SFC_KEEP_IMPORT_OUTPUT = '@import \'../hmr/index.wxss\';'
const SFC_KEEP_IMPORT_DIRECTIVE = '@wv-keep-import'

const PLATFORM_LIST = resolvePlatforms()
const RAPID_HMR_TIMEOUT = 180_000

async function retryWithSourceTouch<T>(
  task: () => Promise<T>,
  touchFilePath: string,
  touchContent: string,
) {
  try {
    return await task()
  }
  catch {
    await replaceFileByRename(touchFilePath, touchContent)
    return await task()
  }
}

function expectSfcKeepImportResolved(content: string) {
  expect(content).toContain(SFC_KEEP_IMPORT_OUTPUT)
  expect(content).not.toContain(SFC_KEEP_IMPORT_DIRECTIVE)
}

beforeEach(async () => {
  await cleanupResidualDevProcesses()
})

afterEach(async () => {
  await cleanupResidualDevProcesses()
})

describe.sequential('HMR rapid modifications (dev watch)', () => {
  it.each(PLATFORM_LIST)('连续快速修改 .wxml 模板文件 (%s)', async (platform) => {
    await fs.remove(DIST_ROOT)
    const originalSource = await fs.readFile(SRC_TEMPLATE, 'utf8')
    const ext = PLATFORM_EXT[platform]
    const distPath = path.join(DIST_ROOT, `pages/hmr/index.${ext.template}`)
    const firstMarker = createHmrMarker('RAPID-FIRST-TEMPLATE', platform)
    const secondMarker = createHmrMarker('RAPID-SECOND-TEMPLATE', platform)

    const dev = startDevProcess('node', ['--import', 'tsx', CLI_PATH, 'dev', APP_ROOT, '--platform', platform, '--skipNpm'], {
      env: createDevProcessEnv(),
      stdio: 'inherit',
    })

    try {
      await dev.waitFor(
        retryWithSourceTouch(
          () => waitForFile(path.join(DIST_ROOT, 'app.json'), 30_000),
          SRC_TEMPLATE,
          originalSource,
        ),
        `${platform} app.json generated`,
      )
      await dev.waitFor(waitForFileContains(distPath, 'HMR'), `${platform} initial template`)

      // 第一次修改
      const firstUpdate = originalSource.replace('HMR', firstMarker)
      await replaceFileByRename(SRC_TEMPLATE, firstUpdate)

      // 第二次修改（无延迟，连续快速写入）
      const secondUpdate = originalSource.replace('HMR', secondMarker)
      await replaceFileByRename(SRC_TEMPLATE, secondUpdate)

      // 等待 dist 包含第二次标记
      let content = ''
      try {
        content = await dev.waitFor(
          waitForFileContains(distPath, secondMarker, RAPID_HMR_TIMEOUT),
          `${platform} rapid second template marker`,
        )
      }
      catch {
        await replaceFileByRename(SRC_TEMPLATE, `${secondUpdate}\n`)
        content = await dev.waitFor(
          waitForFileContains(distPath, secondMarker, RAPID_HMR_TIMEOUT),
          `${platform} rapid second template marker (retry)`,
        )
      }
      expect(content).toContain(secondMarker)
      expect(content).not.toContain(firstMarker)
    }
    finally {
      await dev.stop(5_000)
      await fs.writeFile(SRC_TEMPLATE, originalSource, 'utf8')
    }
  })

  it.each(PLATFORM_LIST)('连续快速修改 .ts 脚本文件 (%s)', async (platform) => {
    await fs.remove(DIST_ROOT)
    const originalSource = await fs.readFile(SRC_SCRIPT, 'utf8')
    const distPath = path.join(DIST_ROOT, 'pages/hmr/index.js')
    const firstMarker = createHmrMarker('RAPID-FIRST-SCRIPT', platform)
    const secondMarker = createHmrMarker('RAPID-SECOND-SCRIPT', platform)

    const dev = startDevProcess('node', ['--import', 'tsx', CLI_PATH, 'dev', APP_ROOT, '--platform', platform, '--skipNpm'], {
      env: createDevProcessEnv(),
      stdio: 'inherit',
    })

    try {
      await dev.waitFor(waitForFile(path.join(DIST_ROOT, 'app.json'), 30_000), `${platform} app.json generated`)
      await dev.waitFor(waitForFile(distPath, 30_000), `${platform} initial script output`)

      // 第一次修改
      const firstUpdate = replaceHmrScriptName(originalSource, firstMarker)
      if (firstUpdate === originalSource) {
        throw new Error('Failed to insert first marker into .ts script source.')
      }
      await replaceFileByRename(SRC_SCRIPT, firstUpdate)

      // 第二次修改（无延迟，连续快速写入）
      const secondUpdate = replaceHmrScriptName(originalSource, secondMarker)
      if (secondUpdate === originalSource) {
        throw new Error('Failed to insert second marker into .ts script source.')
      }
      await replaceFileByRename(SRC_SCRIPT, secondUpdate)

      // 等待 dist 包含第二次标记
      const content = await dev.waitFor(
        waitForFileContains(distPath, secondMarker, RAPID_HMR_TIMEOUT),
        `${platform} rapid second script marker`,
      )
      expect(content).toContain(secondMarker)
      expect(content).not.toContain(firstMarker)
      expect(dev.getOutput()).not.toContain('Build failed')
    }
    finally {
      await dev.stop(5_000)
      await fs.writeFile(SRC_SCRIPT, originalSource, 'utf8')
    }
  })

  it.each(PLATFORM_LIST)('连续快速修改 .vue SFC 文件 (%s)', async (platform) => {
    await fs.remove(DIST_ROOT)
    const originalSource = await fs.readFile(SFC_SRC_PATH, 'utf8')
    const ext = PLATFORM_EXT[platform]
    const distPath = path.join(DIST_ROOT, `pages/hmr-sfc/index.${ext.template}`)
    const firstMarker = createHmrMarker('RAPID-FIRST-SFC', platform)
    const secondMarker = createHmrMarker('RAPID-SECOND-SFC', platform)

    const dev = startDevProcess('node', ['--import', 'tsx', CLI_PATH, 'dev', APP_ROOT, '--platform', platform, '--skipNpm'], {
      env: createDevProcessEnv(),
      stdio: 'inherit',
    })

    try {
      await dev.waitFor(waitForFile(path.join(DIST_ROOT, 'app.json'), 30_000), `${platform} app.json generated`)
      await dev.waitFor(waitForFileContains(distPath, 'HMR-SFC'), `${platform} initial SFC template`)

      // 第一次修改
      const firstUpdate = replaceHmrSfcTitle(originalSource, firstMarker)
      if (firstUpdate === originalSource) {
        throw new Error('Failed to insert first marker into .vue SFC template source.')
      }
      await replaceFileByRename(SFC_SRC_PATH, firstUpdate)

      // 第二次修改（无延迟，连续快速写入）
      const secondUpdate = replaceHmrSfcTitle(originalSource, secondMarker)
      if (secondUpdate === originalSource) {
        throw new Error('Failed to insert second marker into .vue SFC template source.')
      }
      await replaceFileByRename(SFC_SRC_PATH, secondUpdate)

      // 等待 dist 中模板文件包含第二次标记
      let content = ''
      try {
        content = await dev.waitFor(
          waitForFileContains(distPath, secondMarker, RAPID_HMR_TIMEOUT),
          `${platform} rapid second SFC marker`,
        )
      }
      catch {
        await replaceFileByRename(SFC_SRC_PATH, `${secondUpdate}\n`)
        content = await dev.waitFor(
          waitForFileContains(distPath, secondMarker, RAPID_HMR_TIMEOUT),
          `${platform} rapid second SFC marker (retry)`,
        )
      }
      expect(content).toContain(secondMarker)
      expect(content).not.toContain(firstMarker)
    }
    finally {
      await dev.stop(5_000)
      await fs.writeFile(SFC_SRC_PATH, originalSource, 'utf8')
    }
  })

  it.each(PLATFORM_LIST)('连续快速修改 .vue SFC style 部分 (%s)', async (platform) => {
    await fs.remove(DIST_ROOT)
    const originalSource = await fs.readFile(SFC_SRC_PATH, 'utf8')
    const ext = PLATFORM_EXT[platform]
    const distPath = path.join(DIST_ROOT, `pages/hmr-sfc/index.${ext.style}`)
    const firstMarker = createHmrMarker('RAPID-FIRST-SFC-STYLE', platform)
    const secondMarker = createHmrMarker('RAPID-SECOND-SFC-STYLE', platform)

    const firstUpdate = originalSource.replace('.marker {', `.marker {\n  --hmr-marker: '${firstMarker}';`)
    const secondUpdate = originalSource.replace('.marker {', `.marker {\n  --hmr-marker: '${secondMarker}';`)
    if (firstUpdate === originalSource || secondUpdate === originalSource) {
      throw new Error('Failed to insert marker into .vue SFC style source.')
    }

    const dev = startDevProcess('node', ['--import', 'tsx', CLI_PATH, 'dev', APP_ROOT, '--platform', platform, '--skipNpm'], {
      env: createDevProcessEnv(),
      stdio: 'inherit',
    })

    try {
      await dev.waitFor(waitForFile(path.join(DIST_ROOT, 'app.json'), 30_000), `${platform} app.json generated`)
      const initialStyle = await dev.waitFor(waitForFileContains(distPath, 'hmr-sfc-page'), `${platform} initial SFC style`)
      expectSfcKeepImportResolved(initialStyle)

      await replaceFileByRename(SFC_SRC_PATH, firstUpdate)
      await replaceFileByRename(SFC_SRC_PATH, secondUpdate)

      let content = ''
      try {
        content = await dev.waitFor(
          waitForFileContains(distPath, secondMarker, RAPID_HMR_TIMEOUT),
          `${platform} rapid second SFC style marker`,
        )
      }
      catch {
        await replaceFileByRename(SFC_SRC_PATH, `${secondUpdate}\n`)
        content = await dev.waitFor(
          waitForFileContains(distPath, secondMarker, RAPID_HMR_TIMEOUT),
          `${platform} rapid second SFC style marker (retry)`,
        )
      }
      expect(content).toContain(secondMarker)
      expect(content).not.toContain(firstMarker)
      expectSfcKeepImportResolved(content)
      expect(dev.getOutput()).not.toContain('Build failed')
    }
    finally {
      await dev.stop(5_000)
      await fs.writeFile(SFC_SRC_PATH, originalSource, 'utf8')
    }
  })
})
