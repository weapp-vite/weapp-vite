import type { MiniProgram } from '@weapp-vite/miniprogram-automator'
import type { DomCheckpoint, DomPage } from '../utils/domAcceptance/types'
import { WEAPP_VITE_STATEFUL_HMR_CONTROL_FILE, WEVU_IS_PAGE_KEY, WEVU_SCOPED_SLOT_OWNER_REQUIRED_KEY } from '@weapp-core/constants'
import { fs } from '@weapp-core/shared/node'
import { parse } from '@weapp-vite/ast/babel'
import traverse from '@weapp-vite/ast/babelTraverse'
import path from 'pathe'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { launchAutomator, reconnectAutomator } from '../utils/automator'
import { runCleanupSteps } from '../utils/cleanupSteps'
import { startDevProcess } from '../utils/dev-process'
import { createDevProcessEnv } from '../utils/dev-process-env'
import { createDomAcceptance } from '../utils/domAcceptance'
import { disableProjectCompileHotReload, replaceFileByRename } from '../utils/hmr-helpers'
import { resolveRuntimeProviderName } from '../utils/runtimeProvider'

const APP_ROOT = path.resolve(import.meta.dirname, '../../e2e-apps/app-vue-hmr-alias')
const DIST_ROOT = path.join(APP_ROOT, 'dist')
const APP_SOURCE = path.join(APP_ROOT, 'src/app.vue')
const PAGE_SOURCE = path.join(APP_ROOT, 'src/pages/plain/index.vue')
const CLI_PATH = path.resolve(import.meta.dirname, '../../packages/weapp-vite/bin/weapp-vite.js')
const ROUTE = '/pages/plain/index'
const PAGE_DIST_BASE = path.join(DIST_ROOT, ROUTE.slice(1))
const APP_TEMPLATE_RE = /<template>[\s\S]*?<\/template>/
const APP_PAGES_RE = /pages:\s*\[[\s\S]*?\]/
const AUTOMATOR_ENV = {
  WEAPP_VITE_E2E_AUTOMATOR_PREBUILD: '0',
  WEAPP_VITE_E2E_AUTOMATOR_BRIDGE_PREBUILD: '0',
  WEAPP_VITE_E2E_AUTOMATOR_POST_CONNECT_REFRESH: '0',
  WEAPP_VITE_E2E_AUTOMATOR_BRIDGE_POST_CONNECT_REFRESH: '0',
  WEAPP_VITE_E2E_AUTOMATOR_DISABLE_RELAUNCH_CURRENT_READY: '1',
} as const
const STAGES = [
  { id: 'initial', shell: false },
  { id: 'added', shell: true },
  { id: 'removed', shell: false },
  { id: 'restored', shell: true },
] as const

function readScopedSlotMetadata(script: string) {
  let ownerRequired = false
  let declaredFeature = false
  traverse(parse(script, { sourceType: 'unambiguous' }), {
    ObjectProperty(property) {
      const { key, value } = property.node
      const name = key.type === 'Identifier' ? key.name : key.type === 'StringLiteral' ? key.value : ''
      if (value.type !== 'BooleanLiteral' || !value.value) {
        return
      }
      if (name === WEVU_SCOPED_SLOT_OWNER_REQUIRED_KEY) {
        ownerRequired ||= property.parentPath.isObjectExpression() && property.parentPath.node.properties.some((item) => {
          if (item.type !== 'ObjectProperty' || item.value.type !== 'BooleanLiteral' || !item.value.value) {
            return false
          }
          const keyName = item.key.type === 'Identifier'
            ? item.key.name
            : item.key.type === 'StringLiteral' ? item.key.value : ''
          return keyName === WEVU_IS_PAGE_KEY
        })
      }
      if (name === 'scopedSlots') {
        const features = property.parentPath.parentPath
        const manifest = features?.parentPath
        if (!features?.isObjectProperty() || !manifest?.isObjectExpression()) {
          return
        }
        const featuresKey = features.node.key
        const featuresName = featuresKey.type === 'Identifier'
          ? featuresKey.name
          : featuresKey.type === 'StringLiteral' ? featuresKey.value : ''
        declaredFeature ||= featuresName === 'features' && manifest.node.properties.some((item) => {
          if (item.type !== 'ObjectProperty' || item.value.type !== 'StringLiteral') {
            return false
          }
          const keyName = item.key.type === 'Identifier'
            ? item.key.name
            : item.key.type === 'StringLiteral' ? item.key.value : ''
          return keyName === 'sourceFile' && item.value.value === 'src/pages/plain/index.vue'
        })
      }
    },
  })
  return { ownerRequired, declaredFeature }
}

async function readPublishedState() {
  const [script, wxml, jsonText, appText] = await Promise.all([
    fs.readFile(`${PAGE_DIST_BASE}.js`, 'utf8'),
    fs.readFile(`${PAGE_DIST_BASE}.wxml`, 'utf8'),
    fs.readFile(`${PAGE_DIST_BASE}.json`, 'utf8'),
    fs.readFile(path.join(DIST_ROOT, 'app.json'), 'utf8'),
  ])
  const config = JSON.parse(jsonText) as { usingComponents?: Record<string, string> }
  const app = JSON.parse(appText) as { pages?: string[] }
  const shellWrapper = wxml.includes('<weapp-app-shell')
  const shellBase = path.join(DIST_ROOT, '__weapp_vite_app_shell')
  // 页面引用移除后仍独立检查磁盘，避免旧壳资产残留被无 wrapper 的分支掩盖。
  const shellFiles = Object.fromEntries(await Promise.all(['js', 'json', 'wxml'].map(async extension => [extension, await fs.pathExists(`${shellBase}.${extension}`)])))
  let shellAssets: boolean | null = null
  if (shellWrapper) {
    const [shellJs, shellWxml, shellJson] = await Promise.all([
      fs.readFile(`${shellBase}.js`, 'utf8'),
      fs.readFile(`${shellBase}.wxml`, 'utf8'),
      fs.readFile(`${shellBase}.json`, 'utf8'),
    ])
    shellAssets = shellJs.length > 0
      && shellWxml.includes('APP-VUE-HMR-ALIAS-APP-BASE')
      && (JSON.parse(shellJson) as { component?: boolean }).component === true
  }
  return {
    ...readScopedSlotMetadata(script),
    shellWrapper,
    shellFiles,
    shellAssets,
    shellComponent: config.usingComponents?.['weapp-app-shell'] ?? null,
    layoutWrapper: wxml.includes('<weapp-layout-'),
    layoutComponents: Object.keys(config.usingComponents ?? {}).filter(name => name.startsWith('weapp-layout-')),
    appPages: app.pages,
    appWxml: await fs.pathExists(path.join(DIST_ROOT, 'app.wxml')),
    statefulControl: await fs.pathExists(path.join(DIST_ROOT, WEAPP_VITE_STATEFUL_HMR_CONTROL_FILE)),
  }
}

function createCheckpoint(id: string, shell: boolean, count: number): DomCheckpoint {
  const visibility = resolveRuntimeProviderName() === 'devtools' ? { visible: true } : {}
  return {
    id,
    route: ROUTE,
    action: `检查 App 模板${shell ? '存在' : '移除'}时 plain 页的 slot 内容与点击计数 ${count}`,
    nodes: [
      { selector: '//*[@class="app-vue-hmr-alias-app"]', query: 'xpath', count: shell ? 1 : 0 },
      { selector: '//*[@class="app-vue-hmr-alias-layout"]', query: 'xpath', count: 0 },
      { selector: '//*[@id="app-shell-plain-title"]', query: 'xpath', text: 'APP-SHELL-PLAIN-PAGE', ...visibility },
      { selector: '//*[@id="app-shell-plain-count"]', query: 'xpath', text: `count: ${count}`, ...visibility },
    ],
  }
}

describe('App template presence HMR on an unchanged plain page', { concurrent: false }, () => {
  let dev: ReturnType<typeof startDevProcess> | undefined
  let miniProgram: Awaited<ReturnType<typeof launchAutomator>> | undefined
  let originalAppSource = ''
  let originalPageSource = ''
  let withShell = ''
  let withoutShell = ''
  let restoreCompileHotReload: (() => Promise<void>) | undefined
  const previousAutomatorEnv = new Map<string, string | undefined>()

  async function connect() {
    return await launchAutomator({
      bridgeProjectMode: 'direct',
      launchMode: 'bridge',
      projectPath: APP_ROOT,
      refreshProjectAfterConnect: false,
      skipWarmup: true,
      maxLaunchRetries: 1,
      disableRelaunchSessionRecovery: true,
    })
  }

  beforeAll(async () => {
    for (const [key, value] of Object.entries(AUTOMATOR_ENV)) {
      previousAutomatorEnv.set(key, process.env[key])
      process.env[key] = value
    }
    originalAppSource = await fs.readFile(APP_SOURCE, 'utf8')
    originalPageSource = await fs.readFile(PAGE_SOURCE, 'utf8')
    expect(originalAppSource).toMatch(APP_TEMPLATE_RE)
    expect(originalAppSource).toMatch(APP_PAGES_RE)
    // 裁剪为唯一 plain 路由，避免默认 layout 页面在启动时预装 scoped-slot 能力。
    withShell = originalAppSource.replace(APP_PAGES_RE, 'pages: [\'pages/plain/index\']')
    withoutShell = withShell.replace(APP_TEMPLATE_RE, '')
    restoreCompileHotReload = await disableProjectCompileHotReload(APP_ROOT)
    await fs.writeFile(APP_SOURCE, withoutShell, 'utf8')
    await fs.remove(DIST_ROOT)
    dev = startDevProcess(process.execPath, ['--import', 'tsx', CLI_PATH, 'dev', APP_ROOT, '--platform', 'weapp', '--skipNpm'], {
      cwd: APP_ROOT,
      env: createDevProcessEnv(),
      all: true,
    })
    await dev.waitForInitialBuild()
  }, 180_000)

  afterAll(async () => {
    await runCleanupSteps([
      { label: 'close owned app shell runtime', run: async () => await miniProgram?.close() },
      { label: 'stop app shell dev process', run: async () => await dev?.stop(5_000) },
      { label: 'restore original App source', run: async () => {
        if (originalAppSource) {
          await fs.writeFile(APP_SOURCE, originalAppSource, 'utf8')
        }
      } },
      { label: 'restore compile hot reload', run: async () => await restoreCompileHotReload?.() },
      { label: 'restore exact automator environment', run: () => {
        for (const [key, value] of previousAutomatorEnv) {
          if (value === undefined) {
            delete process.env[key]
          }
          else {
            process.env[key] = value
          }
        }
        previousAutomatorEnv.clear()
      } },
    ])
  }, 60_000)

  it('adds, removes and restores App template slot ownership, rendered page content and events without editing the page', async (ctx) => {
    ctx.onTestFailed(() => {
      process.stdout.write(dev?.getOutput().slice(-12_000) ?? '')
    })
    await expect.poll(readPublishedState, { timeout: 90_000 }).toMatchObject({
      ownerRequired: false,
      declaredFeature: false,
      shellWrapper: false,
      shellFiles: { js: false, json: false, wxml: false },
      shellAssets: null,
      shellComponent: null,
      layoutWrapper: false,
      layoutComponents: [],
      appPages: ['pages/plain/index'],
      appWxml: false,
      statefulControl: false,
    })
    miniProgram = await connect()
    const checkpoints = STAGES.flatMap(stage => [
      ...(stage.id === 'initial' ? [] : [createCheckpoint(`${stage.id}:published`, stage.shell, 0)]),
      createCheckpoint(`${stage.id}:ready`, stage.shell, 0),
      createCheckpoint(`${stage.id}:tap`, stage.shell, 1),
    ])
    const dom = createDomAcceptance(ctx, 'e2e-apps/app-vue-hmr-alias', checkpoints)

    for (const stage of STAGES) {
      if (stage.id !== 'initial') {
        await replaceFileByRename(APP_SOURCE, stage.shell ? withShell : withoutShell)
        await dev!.waitFor(expect.poll(readPublishedState, { timeout: 90_000 }).toEqual({
          ownerRequired: stage.shell,
          declaredFeature: stage.shell,
          shellWrapper: stage.shell,
          shellFiles: { js: stage.shell, json: stage.shell, wxml: stage.shell },
          shellAssets: stage.shell ? true : null,
          shellComponent: stage.shell ? '/__weapp_vite_app_shell' : null,
          layoutWrapper: false,
          layoutComponents: [],
          appPages: ['pages/plain/index'],
          appWxml: false,
          statefulControl: false,
        }), `${stage.id} page JS/WXML/JSON agree`)

        if (resolveRuntimeProviderName() === 'headless') {
          // headless 没有 IDE 完整重载；每代从新产物冷启，复用相同 DOM 与事件契约。
          await miniProgram!.close()
          miniProgram = await connect()
        }
        else {
          // 只重连同一个已登记宿主，不另开 IDE、不主动 compile、不重试导航。
          miniProgram = await reconnectAutomator(miniProgram as MiniProgram)
        }
        const publishedDeadline = Date.now() + 45_000
        let publishedPage: DomPage | null | undefined
        await expect.poll(async () => {
          publishedPage = await miniProgram!.currentPage({
            appFunctionFallback: false,
            pageStackFallback: false,
            retries: 1,
            timeout: Math.max(1, Math.min(5_000, publishedDeadline - Date.now())),
          })
          return publishedPage?.path
        }, { timeout: Math.max(1, publishedDeadline - Date.now()) }).toBe(ROUTE.slice(1))
        await dom.check(`${stage.id}:published`, miniProgram!, publishedPage!, Math.max(1, publishedDeadline - Date.now()))
      }

      const page = await miniProgram!.reLaunch(ROUTE)
      await dom.check(`${stage.id}:ready`, miniProgram!, page)
      expect(await page.data('count', { fallback: false, timeout: 2_500 })).toBe(0)
      const buttons = await page.getElementsByXpath('//*[@id="app-shell-plain-increment"]')
      expect(buttons).toHaveLength(1)
      await buttons[0]!.tap()
      await dom.check(`${stage.id}:tap`, miniProgram!, page)
      expect(await page.data('count', { fallback: false, timeout: 2_500 })).toBe(1)
      expect(await fs.readFile(PAGE_SOURCE, 'utf8')).toBe(originalPageSource)
    }
  }, 300_000)
})
