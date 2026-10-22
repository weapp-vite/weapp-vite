import { WEAPP_VITE_STATEFUL_HMR_CONTROL_FILE, WEAPP_VITE_STATEFUL_HMR_CONTROL_KEY } from '@weapp-core/constants'
import { fs } from '@weapp-core/shared/node'
import path from 'pathe'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { parseJsLike, traverse } from '../../packages/weapp-vite/src/utils/babel'
import { startDevProcess } from '../utils/dev-process'
import { cleanupResidualDevProcesses } from '../utils/dev-process-cleanup'
import { createDevProcessEnv } from '../utils/dev-process-env'
import { replaceFileByRename } from '../utils/hmr-helpers'
import { createNativeHmrPublication } from '../utils/nativeHmrPublication'
import { addNativePublicationPlugin } from '../utils/nativePublication/fixture'

const CLI_PATH = path.resolve(import.meta.dirname, '../../packages/weapp-vite/src/cli.ts')
const APP_ROOT = path.resolve(import.meta.dirname, '../../e2e-apps/github-issues')
const PAGE_ROOT = path.join(APP_ROOT, 'src/pages/issue-1015')
const EXTERNAL_CSS_PATH = path.join(PAGE_ROOT, 'index.css')
const PAGE_SOURCE_PATH = path.join(PAGE_ROOT, 'index.vue')
const ALTERNATE_CSS_PATH = path.join(PAGE_ROOT, 'hmr-alternate.css')
const DIST_ROOT = path.join(APP_ROOT, 'dist')
const CONFIG_PATH = path.join(APP_ROOT, 'weapp-vite.config.ts')
const PROFILE_PATH = path.join(APP_ROOT, '.weapp-vite/issue-1015-hmr-profile.jsonl')
const PAGE_JS_PATH = path.join(DIST_ROOT, 'pages/issue-1015/index.js')
const CONTROL_JS_PATH = path.join(DIST_ROOT, WEAPP_VITE_STATEFUL_HMR_CONTROL_FILE)
const PAGE_WXML_PATH = path.join(DIST_ROOT, 'pages/issue-1015/index.wxml')
const PAGE_WXSS_PATH = path.join(DIST_ROOT, 'pages/issue-1015/index.wxss')
const RUNTIME_TARGET = 'e2e/ide/github-issues.runtime.issue1015.test.ts'

interface CssVarOutputContract {
  buildId?: string
  cssVarNames: string[]
  registeredCssVarNames: Set<string>
  pageWxml: string
  pageWxss: string
}

function collectCssVarNames(style: string) {
  return [...style.matchAll(/var\(--([^)]+)\)/g)].map(match => match[1]!)
}

async function readBuildId() {
  const controlSource = await fs.readFile(CONTROL_JS_PATH, 'utf8')
  let buildId: string | undefined
  traverse(parseJsLike(controlSource), {
    AssignmentExpression({ node }) {
      if (node.left.type !== 'MemberExpression'
        || node.left.property.type !== 'StringLiteral'
        || node.left.property.value !== WEAPP_VITE_STATEFUL_HMR_CONTROL_KEY
        || node.right.type !== 'ObjectExpression') {
        return
      }
      const property = node.right.properties.find(property =>
        property.type === 'ObjectProperty'
        && property.key.type === 'StringLiteral'
        && property.key.value === 'buildId',
      )
      if (property?.type === 'ObjectProperty' && property.value.type === 'StringLiteral') {
        buildId = property.value.value
      }
    },
  })
  if (!buildId) {
    throw new Error('Stateful HMR control has no buildId')
  }
  return buildId
}

async function readCssVarOutputContract(stateful = false): Promise<CssVarOutputContract> {
  const buildId = stateful ? await readBuildId() : undefined
  // 首构及 classic 都从完整页面脚本核对注册，样式变化后不再消费旧 stateful 增量。
  const [script, pageWxml, pageWxss] = await Promise.all([
    fs.readFile(PAGE_JS_PATH, 'utf8'),
    fs.readFile(PAGE_WXML_PATH, 'utf8'),
    fs.readFile(PAGE_WXSS_PATH, 'utf8'),
  ])
  const registeredCssVarNames = new Set<string>()
  traverse(parseJsLike(script), {
    ObjectProperty(propertyPath) {
      if (!propertyPath.node.computed && propertyPath.node.key.type === 'StringLiteral') {
        registeredCssVarNames.add(propertyPath.node.key.value)
      }
    },
  })
  return {
    buildId,
    cssVarNames: collectCssVarNames(pageWxss),
    registeredCssVarNames,
    pageWxml,
    pageWxss,
  }
}

async function waitForCssVarOutput(
  accept: (output: CssVarOutputContract) => boolean,
  stateful = false,
  timeoutMs = 60_000,
) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    try {
      const output = await readCssVarOutputContract(stateful)
      if (accept(output)) {
        return output
      }
    }
    catch {
      // dev 首轮构建尚未写齐页面产物时继续等待。
    }
    // 子进程中的 Vite write 阶段没有可跨进程订阅的完成事件，只能轮询三个关联产物的同一语义状态。
    const { promise, resolve } = Promise.withResolvers<void>()
    setTimeout(resolve, 250)
    await promise
  }
  const output = await readCssVarOutputContract(stateful)
  if (!accept(output)) {
    throw new Error('Timed out waiting for coherent external CSS variable output')
  }
  return output
}

function hasRegisteredCssVars(output: CssVarOutputContract) {
  return output.cssVarNames.length > 0
    && output.cssVarNames.every(cssVarName => output.registeredCssVarNames.has(cssVarName))
    && /style="\{\{__wv_style_\d+\}\}"/.test(output.pageWxml)
}

beforeEach(async () => {
  await cleanupResidualDevProcesses()
})

afterEach(async () => {
  await cleanupResidualDevProcesses()
})

describe('issue #1015 external CSS variables HMR', { concurrent: false }, () => {
  it.each(['classic', 'stateful-experimental'] as const)('updates external CSS variable registration in %s mode', async (runtime) => {
    await fs.remove(DIST_ROOT)
    const originalCss = await fs.readFile(EXTERNAL_CSS_PATH, 'utf8')
    const originalPageSource = await fs.readFile(PAGE_SOURCE_PATH, 'utf8')
    const originalConfig = await fs.readFile(CONFIG_PATH, 'utf8')
    expect(await fs.pathExists(ALTERNATE_CSS_PATH)).toBe(false)
    await fs.writeFile(ALTERNATE_CSS_PATH, originalCss.replace('\n}', '\n  --issue-1015-hmr: source-switched;\n}'), 'utf8')
    await addNativePublicationPlugin(CONFIG_PATH)
    await fs.remove(PROFILE_PATH)
    const devEnv = createDevProcessEnv()
    devEnv.WEAPP_VITE_E2E_TARGET_FILE = RUNTIME_TARGET
    devEnv.WEAPP_GITHUB_ISSUE_1015_HMR_RUNTIME = runtime
    devEnv.WEAPP_VITE_HMR_PROFILE_JSON = PROFILE_PATH
    const stateful = runtime === 'stateful-experimental'
    const devProcess = startDevProcess(
      'node',
      ['--import', 'tsx', CLI_PATH, 'dev', APP_ROOT, '--platform', 'weapp', '--skipNpm'],
      {
        env: devEnv,
        stdio: 'inherit',
      },
    )
    const publication = createNativeHmrPublication(APP_ROOT, devProcess, runtime, ['stylesheet-output'], PROFILE_PATH)

    try {
      await devProcess.waitForInitialBuild()
      const initial = await devProcess.waitFor(
        waitForCssVarOutput(output => hasRegisteredCssVars(output), stateful),
        'issue-1015 initial external CSS variable output',
      )
      expect(initial.cssVarNames).toHaveLength(1)
      expect(publication.stateful).toBe(stateful)

      const styleOnlyCss = originalCss.replace('\n}', '\n  --issue-1015-hmr: style-only;\n}')
      const stylePublication = publication.capture(EXTERNAL_CSS_PATH)
      await replaceFileByRename(EXTERNAL_CSS_PATH, styleOnlyCss)
      await stylePublication.wait()
      const styleOnly = await devProcess.waitFor(
        waitForCssVarOutput(output => (
          output.pageWxss.includes('--issue-1015-hmr: style-only')
          && hasRegisteredCssVars(output)
        )),
        'issue-1015 unchanged CSS variable registration',
      )
      expect(styleOnly.cssVarNames).toEqual(initial.cssVarNames)
      expect(styleOnly.buildId).toBeUndefined()
      expect(publication.stateful).toBe(false)

      const switchedPublication = publication.capture(PAGE_SOURCE_PATH)
      await replaceFileByRename(
        PAGE_SOURCE_PATH,
        originalPageSource.replace('src="./index.css"', 'src="./hmr-alternate.css"'),
      )
      await switchedPublication.wait()
      const switched = await devProcess.waitFor(
        waitForCssVarOutput(output => (
          output.pageWxss.includes('--issue-1015-hmr: source-switched')
          && hasRegisteredCssVars(output)
        )),
        'issue-1015 switched external style source',
      )
      expect(switched.cssVarNames).toEqual(initial.cssVarNames)
      expect(publication.stateful).toBe(false)

      const changedCss = originalCss
        .replace('v-bind(themeColor)', 'v-bind(accentColor)')
        .replace('\n}', '\n  --issue-1015-hmr: changed;\n}')
      const changedPublication = publication.capture(ALTERNATE_CSS_PATH)
      await replaceFileByRename(ALTERNATE_CSS_PATH, changedCss)
      await changedPublication.wait()
      const changed = await devProcess.waitFor(
        waitForCssVarOutput(output => (
          output.pageWxss.includes('--issue-1015-hmr: changed')
          && hasRegisteredCssVars(output)
          && output.cssVarNames.every(cssVarName => !initial.cssVarNames.includes(cssVarName))
        )),
        'issue-1015 changed external CSS variable output',
      )
      expect(changed.cssVarNames).toHaveLength(1)
      for (const initialName of initial.cssVarNames) {
        expect(changed.registeredCssVarNames).not.toContain(initialName)
      }

      const removedCss = '.issue1015-page {\n  color: black;\n  --issue-1015-hmr: removed;\n}\n'
      const removedPublication = publication.capture(ALTERNATE_CSS_PATH)
      await replaceFileByRename(ALTERNATE_CSS_PATH, removedCss)
      await removedPublication.wait()
      const removed = await devProcess.waitFor(
        waitForCssVarOutput(output => (
          output.pageWxss.includes('--issue-1015-hmr: removed')
          && output.cssVarNames.length === 0
          && !/style="\{\{__wv_style_\d+\}\}"/.test(output.pageWxml)
          && [...initial.cssVarNames, ...changed.cssVarNames].every(cssVarName => !output.registeredCssVarNames.has(cssVarName))
        )),
        'issue-1015 removed external CSS variable output',
      )
      for (const changedName of changed.cssVarNames) {
        expect(removed.registeredCssVarNames).not.toContain(changedName)
      }
      await publication.assertClassicOutput()

      const readdedCss = originalCss.replace('\n}', '\n  --issue-1015-hmr: readded;\n}')
      const readdedPublication = publication.capture(ALTERNATE_CSS_PATH)
      await replaceFileByRename(ALTERNATE_CSS_PATH, readdedCss)
      await readdedPublication.wait()
      const readded = await devProcess.waitFor(
        waitForCssVarOutput(output => (
          output.pageWxss.includes('--issue-1015-hmr: readded')
          && hasRegisteredCssVars(output)
          && output.cssVarNames.length === initial.cssVarNames.length
        )),
        'issue-1015 readded external CSS variable output',
      )
      expect(readded.cssVarNames).toEqual(initial.cssVarNames)
      await publication.assertClassicOutput()

      // 原文件此时不在依赖图；先恢复它，再归因重新接入该文件的页面保存。
      await replaceFileByRename(EXTERNAL_CSS_PATH, originalCss)
      const restoredPublication = publication.capture(PAGE_SOURCE_PATH)
      await replaceFileByRename(PAGE_SOURCE_PATH, originalPageSource)
      await restoredPublication.wait()
      const restored = await devProcess.waitFor(
        waitForCssVarOutput(output => hasRegisteredCssVars(output)
          && output.cssVarNames.length === initial.cssVarNames.length
          && !output.pageWxss.includes('--issue-1015-hmr:')),
        'issue-1015 restored external style source in classic',
      )
      expect(restored.cssVarNames).toEqual(initial.cssVarNames)
      expect(restored.pageWxml).toBe(initial.pageWxml)
      expect(restored.pageWxss).toBe(initial.pageWxss)
      await publication.assertClassicOutput()
      expect(devProcess.getBuildErrors()).toEqual([])
    }
    finally {
      try {
        await devProcess.stop(2_000)
      }
      finally {
        await Promise.all([
          fs.writeFile(EXTERNAL_CSS_PATH, originalCss, 'utf8'),
          fs.writeFile(PAGE_SOURCE_PATH, originalPageSource, 'utf8'),
          fs.writeFile(CONFIG_PATH, originalConfig, 'utf8'),
          fs.remove(ALTERNATE_CSS_PATH),
          fs.remove(PROFILE_PATH),
        ])
      }
    }
  })
})
