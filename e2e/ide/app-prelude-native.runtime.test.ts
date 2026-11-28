import type { TestContext } from 'vitest'
import process from 'node:process'
import { APP_PRELUDE_CHUNK_MARKER } from '@weapp-core/constants'
import { fs } from '@weapp-core/shared/node'
import path from 'pathe'
import { describe, expect, it } from 'vitest'
import { launchAutomator } from '../utils/automator'
import { runWeappViteBuildWithLogCapture } from '../utils/buildLog'
import { createDomAcceptance } from '../utils/domAcceptance'
import { startRequestClientsRealServer } from '../utils/requestClientsRealServer'
import { resolveRuntimeProviderName } from '../utils/runtimeProvider'

const CLI_PATH = path.resolve(import.meta.dirname, '../../packages/weapp-vite/bin/weapp-vite.js')
const SOURCE_APP_ROOT = path.resolve(import.meta.dirname, '../../e2e-apps/app-prelude-native')
const PROJECTS_ROOT = path.resolve(import.meta.dirname, '../../.tmp/e2e-projects/app-prelude-native')
const PROJECT_COPY_ENTRIES = ['package.json', 'project.config.json', 'project.private.config.json', 'src', 'tsconfig.json', 'weapp-vite.config.ts']
const ROUTES = [
  { route: '/pages/index/index', label: 'main' },
  { route: '/subpackages/normal/pages/entry/index', label: 'normal-subpackage' },
  { route: '/subpackages/independent/pages/entry/index', label: 'independent-subpackage' },
]
const NATIVE_API_ROUTE = '/pages/native-api/index'
const NATIVE_VUE_ROUTE = '/pages/native-vue/index'
const ALL_ROUTES = [...ROUTES, { route: NATIVE_API_ROUTE, label: 'native-api' }, { route: NATIVE_VUE_ROUTE, label: 'native-vue' }]
const REQUEST_RUNTIME = {
  fetch: 'function',
  headers: 'function',
  request: 'function',
  response: 'function',
  xmlHttpRequest: 'undefined',
  webSocket: 'undefined',
  url: 'function',
  urlSearchParams: 'function',
  blob: 'function',
  formData: 'function',
}
const NATIVE_REQUEST_RUNTIME = {
  ...REQUEST_RUNTIME,
  xmlHttpRequest: 'function',
  webSocket: 'function',
}
const NATIVE_API_SUMMARY = 'native|native|/b|false|ok|true'
type Mode = 'default' | 'inline' | 'default-request-runtime' | 'native-request-runtime' | 'legacy-es5-request-runtime'
const requestedMode = process.env.WEAPP_VITE_E2E_APP_PRELUDE_MODE
const runtimeProvider = resolveRuntimeProviderName()
if (requestedMode !== undefined && !['default', 'inline', 'default-request-runtime', 'native-request-runtime', 'legacy-es5-request-runtime'].includes(requestedMode)) {
  throw new Error(`Unknown app prelude mode: ${requestedMode}`)
}

async function launchMode(mode: Mode, options: { coldStartIndependent?: boolean } = {}) {
  // 每种 prelude 构建拓扑必须独立冷启动，避免模块缓存掩盖重复副作用。
  const projectRoot = path.join(PROJECTS_ROOT, mode)
  await fs.remove(projectRoot)
  await fs.ensureDir(projectRoot)
  await Promise.all(PROJECT_COPY_ENTRIES.map(entry => fs.copy(path.join(SOURCE_APP_ROOT, entry), path.join(projectRoot, entry))))
  if (options.coldStartIndependent) {
    // 把独立分包页面设为宿主启动页，才能验证真正的首次冷启动，而不是主包加载后的 reLaunch。
    const appJsonPath = path.join(projectRoot, 'src/app.json')
    const appJson = JSON.parse(await fs.readFile(appJsonPath, 'utf8')) as { pages: string[] }
    appJson.pages = [
      'subpackages/independent/pages/entry/index',
      ...appJson.pages.filter(page => page !== 'subpackages/independent/pages/entry/index'),
    ]
    await fs.writeFile(appJsonPath, `${JSON.stringify(appJson, null, 2)}\n`)
  }
  await fs.symlink(path.join(SOURCE_APP_ROOT, 'node_modules'), path.join(projectRoot, 'node_modules'), 'junction')
  await runWeappViteBuildWithLogCapture({
    cliPath: CLI_PATH,
    projectRoot,
    platform: 'weapp',
    cwd: projectRoot,
    label: `ide:app-prelude-native:${mode}`,
    skipNpm: true,
    env: {
      ...(mode === 'inline' ? { APP_PRELUDE_MODE: 'inline' } : {}),
      ...(mode === 'native-request-runtime' ? { APP_PRELUDE_MODE: 'native' } : {}),
      ...(['default-request-runtime', 'native-request-runtime', 'legacy-es5-request-runtime'].includes(mode) ? { APP_PRELUDE_REQUEST_GLOBALS: '1' } : {}),
      ...(mode === 'legacy-es5-request-runtime' ? { APP_PRELUDE_ES5_MINIFY: '1' } : {}),
    },
  })
  for (const { route } of ALL_ROUTES) {
    for (const extension of ['js', 'wxml', 'json']) {
      expect(await fs.pathExists(path.join(projectRoot, 'dist', `${route.slice(1)}.${extension}`))).toBe(true)
    }
  }
  if (mode === 'legacy-es5-request-runtime') {
    const distRoot = path.join(projectRoot, 'dist')
    const jsFiles = (await fs.readdir(distRoot, { recursive: true }))
      .filter((file): file is string => typeof file === 'string' && file.endsWith('.js'))
    expect(jsFiles.length).toBeGreaterThan(0)
    for (const file of jsFiles) {
      const code = await fs.readFile(path.join(distRoot, file), 'utf8')
      expect(code, file).not.toMatch(/\?\.|=>|\b(?:const|let)\s/u)
      expect(code, file).not.toMatch(/\n[ \t]+\S/u)
    }
    expect(await fs.readFile(path.join(distRoot, 'app.prelude.js'), 'utf8')).toContain(APP_PRELUDE_CHUNK_MARKER)
  }
  return launchAutomator({
    projectPath: projectRoot,
    timeout: 180_000,
    warmupRoute: options.coldStartIndependent ? ROUTES[2]!.route : ROUTES[0]!.route,
    warmupRootSelectors: ['#route'],
    warmupAllowRelaunch: options.coldStartIndependent ? false : undefined,
  })
}

async function verifyPrelude(context: TestContext, mode: 'default' | 'inline' | 'legacy-es5-request-runtime') {
  const acceptance = createDomAcceptance(context, 'e2e-apps/app-prelude-native', ROUTES.map(({ route, label }) => ({
    id: label,
    route,
    action: `reLaunch ${label} and inspect the prelude execution log`,
    nodes: [
      { selector: '#route', text: label },
      { selector: '#prelude-log-count', text: '1' },
      { selector: '.prelude-log-item', count: 1, text: 'app.prelude.ts:/app.prelude.ts' },
      ...(mode === 'legacy-es5-request-runtime' && label === 'main'
        ? Object.entries(REQUEST_RUNTIME).map(([name, type]) => ({ selector: `#runtime-${name}`, text: `${name}=${type}` }))
        : []),
    ],
  })))
  const miniProgram = await launchMode(mode)
  try {
    for (const { route, label } of ROUTES) {
      const page = await miniProgram.reLaunch(route)
      await acceptance.check(label, miniProgram, page)
      if (mode === 'legacy-es5-request-runtime' && label === 'main') {
        expect(await page.data('requestRuntime')).toEqual(REQUEST_RUNTIME)
      }
      expect(await miniProgram.evaluate(() => getApp<{ getPreludeLog: () => string[] }>().getPreludeLog()))
        .toEqual(['app.prelude.ts:/app.prelude.ts'])
    }
  }
  finally {
    await miniProgram.close()
  }
}

async function verifyNativeCore(context: TestContext, options: { network?: boolean } = {}) {
  const acceptance = createDomAcceptance(context, 'e2e-apps/app-prelude-native', [
    {
      id: 'independent-cold-start',
      route: ROUTES[2]!.route,
      action: 'cold-start the independent subpackage as the initial page',
      nodes: [
        { selector: '#route', text: 'independent-subpackage' },
        { selector: '#prelude-log-count', text: '1' },
        { selector: '.prelude-log-item', count: 1, text: 'app.prelude.ts:/app.prelude.ts' },
        ...Object.entries(NATIVE_REQUEST_RUNTIME).map(([name, type]) => ({ selector: `#runtime-${name}`, text: `${name}=${type}` })),
      ],
    },
    {
      id: 'main-lazy-prelude',
      route: ROUTES[0]!.route,
      action: 'load the main package after the independent package and inspect reference-driven bindings',
      nodes: [
        { selector: '#route', text: 'main' },
        { selector: '#prelude-log-count', text: '1' },
        { selector: '.prelude-log-item', count: 1, text: 'app.prelude.ts:/app.prelude.ts' },
        ...Object.entries(NATIVE_REQUEST_RUNTIME).map(([name, type]) => ({ selector: `#runtime-${name}`, text: `${name}=${type}` })),
      ],
    },
    {
      id: 'normal-subpackage',
      route: ROUTES[1]!.route,
      action: 'load the normal subpackage and inspect its scoped prelude',
      nodes: [
        { selector: '#route', text: 'normal-subpackage' },
        { selector: '#prelude-log-count', text: '1' },
        { selector: '.prelude-log-item', count: 1, text: 'app.prelude.ts:/app.prelude.ts' },
      ],
    },
    ...(options.network
      ? [{
          id: 'native-api',
          route: NATIVE_API_ROUTE,
          action: 'invoke Fetch through globalThis dotted injection and execute axios, WebSocket and non-network Web APIs through native bindings',
          nodes: [
            { selector: '#route', text: 'native-api' },
            { selector: '#native-status', text: 'ready' },
            { selector: '#native-fetch', text: 'fetch' },
            { selector: '#native-axios', text: 'axios' },
            { selector: '#native-websocket', text: 'connected' },
            { selector: '#native-api-summary', text: NATIVE_API_SUMMARY },
            { selector: '#native-error', text: '' },
          ],
        }]
      : []),
    {
      id: 'native-vue',
      route: NATIVE_VUE_ROUTE,
      action: 'execute a Vue SFC with injected free identifiers and a lexical fetch shadow',
      nodes: [
        { selector: '#route', text: 'native-vue' },
        { selector: '#native-vue-result', text: 'vue|/b|function|shadowed' },
      ],
    },
  ])
  const server = options.network ? await startRequestClientsRealServer({ port: 0 }) : undefined
  const miniProgram = await launchMode('native-request-runtime', { coldStartIndependent: true })
  try {
    const independentPage = await miniProgram.currentPage()
    if (!independentPage) {
      throw new Error('Missing initial independent subpackage page')
    }
    await acceptance.check('independent-cold-start', miniProgram, independentPage)
    expect(await miniProgram.evaluate(() => (globalThis as typeof globalThis & {
      __appPreludeMainPageLoads__?: number
      __appPreludeIndependentPageLoads__?: number
    }).__appPreludeMainPageLoads__ ?? 0)).toBe(0)
    expect(await miniProgram.evaluate(() => (globalThis as typeof globalThis & {
      __appPreludeMainPageLoads__?: number
      __appPreludeIndependentPageLoads__?: number
    }).__appPreludeIndependentPageLoads__)).toBe(1)
    expect(await miniProgram.evaluate(() => (globalThis as typeof globalThis & {
      __appPreludeRuntimeState__?: { fetch: string, url: string, webRuntimeInstalled: boolean }
    }).__appPreludeRuntimeState__)).toEqual(expect.objectContaining({
      fetch: 'function',
      url: 'function',
      webRuntimeInstalled: false,
    }))
    expect(await independentPage.data('requestRuntime')).toEqual(NATIVE_REQUEST_RUNTIME)

    const mainPage = await miniProgram.reLaunch(ROUTES[0]!.route)
    await acceptance.check('main-lazy-prelude', miniProgram, mainPage)
    expect(await mainPage.data('requestRuntime')).toEqual(NATIVE_REQUEST_RUNTIME)
    expect(await miniProgram.evaluate(() => (globalThis as typeof globalThis & {
      __appPreludeMainPageLoads__?: number
      __appPreludeIndependentPageLoads__?: number
    }).__appPreludeMainPageLoads__)).toBe(1)

    const normalPage = await miniProgram.reLaunch(ROUTES[1]!.route)
    await acceptance.check('normal-subpackage', miniProgram, normalPage)

    if (options.network && server) {
      const requestCountsBefore = { ...server.requestCounts }
      const apiPage = await miniProgram.reLaunch(`${NATIVE_API_ROUTE}?baseUrl=${encodeURIComponent(server.baseUrl)}`)
      await acceptance.check('native-api', miniProgram, apiPage, 30_000)
      expect(server.requestCounts.fetch).toBeGreaterThan(requestCountsBefore.fetch)
      expect(server.requestCounts.axios).toBeGreaterThan(requestCountsBefore.axios)
      expect(server.requestCounts.websocket).toBeGreaterThan(requestCountsBefore.websocket)

      const trace = await miniProgram.evaluate(() => (globalThis as typeof globalThis & {
        __appPreludeNativeNetworkTrace__?: {
          requestCalls: Array<{ url: string, method: string, timeout?: number, enableHttp2?: boolean, enableChunked?: boolean }>
          socketCalls: Array<{ url: string, timeout?: number, perMessageDeflate?: boolean, header?: Record<string, string> }>
        }
      }).__appPreludeNativeNetworkTrace__)
      expect(trace).toBeDefined()
      expect(trace?.requestCalls.find(call => call.url.endsWith('/fetch'))).toMatchObject({
        method: 'POST',
        timeout: 4800,
        enableHttp2: true,
        enableChunked: true,
      })
      expect(trace?.socketCalls.find(call => call.url.endsWith('/ws'))).toMatchObject({
        timeout: 4600,
        perMessageDeflate: false,
        header: { 'x-native-default': 'socket' },
      })
    }

    const vuePage = await miniProgram.reLaunch(NATIVE_VUE_ROUTE)
    await acceptance.check('native-vue', miniProgram, vuePage)
  }
  finally {
    try {
      await miniProgram.close()
    }
    finally {
      await server?.stop()
    }
  }
}

describe('e2e app: app-prelude-native runtime', { concurrent: false }, () => {
  it.skipIf(requestedMode !== undefined && requestedMode !== 'inline')('executes inline app prelude once even after relaunching main and subpackage pages', async (context) => {
    await verifyPrelude(context, 'inline')
  })

  it.skipIf(requestedMode !== undefined && requestedMode !== 'default')('keeps one prelude side effect per package scope under default require mode', async (context) => {
    await verifyPrelude(context, 'default')
  })

  it.skipIf(requestedMode !== undefined && requestedMode !== 'legacy-es5-request-runtime')('keeps minified ES5 request runtime and prelude side effects across package scopes', async (context) => {
    await verifyPrelude(context, 'legacy-es5-request-runtime')
  })

  // provider 守卫独立成 skipIf：DOM analyzer 把跨多个 case 使用的 process.env 模式守卫视为不确定，
  // 复合条件会被计划进所有 provider（devtools-only case 误入 headless）。模式选择由 case 内部
  // launchMode 完成；代价是 devtools/headless 的 native case 会在各自 provider 的所有模式任务里运行。
  it.skipIf(runtimeProvider !== 'devtools')('cold-starts independent packages and executes native APIs, Vue SFCs and network defaults', async (context) => {
    await verifyNativeCore(context, { network: true })
  })

  it.skipIf(runtimeProvider !== 'headless')('cold-starts independent packages and executes native constructors and Vue SFCs in the headless runtime', async (context) => {
    await verifyNativeCore(context)
  })

  it.skipIf(requestedMode !== undefined && requestedMode !== 'default-request-runtime')('installs request runtime globals through app.prelude.js under default require mode', async (context) => {
    const acceptance = createDomAcceptance(context, 'e2e-apps/app-prelude-native', [{
      id: 'request-runtime',
      route: ROUTES[0]!.route,
      action: 'inspect the installed request API constructors on the first page',
      nodes: Object.entries(REQUEST_RUNTIME).map(([name, type]) => ({ selector: `#runtime-${name}`, text: `${name}=${type}` })),
    }])
    const miniProgram = await launchMode('default-request-runtime')
    try {
      const page = await miniProgram.currentPage()
      if (!page) {
        throw new Error('Missing initial page after request runtime startup')
      }
      await acceptance.check('request-runtime', miniProgram, page)
      expect(await page.data('requestRuntime')).toEqual(REQUEST_RUNTIME)
    }
    finally {
      await miniProgram.close()
    }
  })
})
