import process from 'node:process'
import { fs } from '@weapp-core/shared/node'
import path from 'pathe'
import { expect } from 'vitest'
import {
  isDevtoolsHttpPortError,
  isDevtoolsLoginRequiredError,
  isDevtoolsSimulatorBootError,
  launchAutomator,
} from '../utils/automator'
import { runWeappViteBuildWithLogCapture } from '../utils/buildLog'
import { cleanDevtoolsCache, cleanupResidualIdeProcesses } from '../utils/ide-devtools-cleanup'
import { appendIdeReportEvent, resolveReportProjectPath } from '../utils/ideWarningReport'
import { E2E_TARGET_FILE_ENV } from '../utils/vitestTargetFile'

const AUTOMATOR_OVERLAY_RE = /\s*\.luna-dom-highlighter[\s\S]*$/
const WHITESPACE_RE = /\s+/g
const REGEXP_ESCAPE_RE = /[.*+?^${}()|[\]\\]/g
const LEADING_SLASH_RE = /^\/+/
const PROJECT_ID_SAFE_RE = /[^\w.-]+/g
const CLI_PATH = path.resolve(import.meta.dirname, '../../packages/weapp-vite/bin/weapp-vite.js')
const REPO_ROOT = path.resolve(import.meta.dirname, '../..')
const SOURCE_APP_ROOT = path.join(REPO_ROOT, 'e2e-apps/github-issues')
const SOURCE_NODE_MODULES = path.join(SOURCE_APP_ROOT, 'node_modules')
const SLOT_FALLBACK_COMPILER_OFF_TARGET = 'github-issues.runtime.slot-fallback-compiler-off.test.ts'
const SLOT_FALLBACK_COMPILER_OFF_ENV = 'WEAPP_GITHUB_SLOT_FALLBACK_COMPILER_OFF'
const APP_SHELL_FREE_TARGETS = new Set([
  'github-issues.runtime.issue642-bug7-default.test.ts',
  'github-issues.runtime.issue642-bug7-performance.test.ts',
  'github-issues.runtime.issue642-bug8.test.ts',
])
const SOURCE_PROJECT_COPY_ENTRIES = [
  '.env',
  'auto-import-components.json',
  'mini.project.json',
  'package.json',
  'project.config.json',
  'project.private.config.json',
  'src',
  'tsconfig.json',
  'typed-router.d.ts',
  'weapp-vite.config.ts',
] as const

function resolveGithubIssuesProjectId() {
  const targetFile = process.env[E2E_TARGET_FILE_ENV]?.replaceAll('\\', '/') ?? 'all'
  return targetFile
    .replace(PROJECT_ID_SAFE_RE, '-')
    .replace(/^-+|-+$/g, '')
    || 'all'
}

function resolveGithubIssuesDistDir() {
  const targetFile = process.env[E2E_TARGET_FILE_ENV]?.replaceAll('\\', '/') ?? ''
  if (
    process.env[SLOT_FALLBACK_COMPILER_OFF_ENV] === 'true'
    || targetFile.endsWith(SLOT_FALLBACK_COMPILER_OFF_TARGET)
  ) {
    return 'dist-slot-fallback-compiler-off'
  }
  return 'dist'
}

function getNormalizedTargetFile() {
  return process.env[E2E_TARGET_FILE_ENV]?.replaceAll('\\', '/') ?? ''
}

function isAppShellFreeTarget() {
  const targetFile = getNormalizedTargetFile()
  return [...APP_SHELL_FREE_TARGETS].some(target => targetFile.endsWith(target))
}

export const APP_ROOT = path.join(REPO_ROOT, '.tmp/e2e-projects/github-issues', resolveGithubIssuesProjectId())
export const DIST_ROOT = path.join(APP_ROOT, resolveGithubIssuesDistDir())
const GITHUB_ISSUES_LAUNCH_RETRIES = 2
const GITHUB_ISSUES_LAUNCH_RETRY_DELAY = 1_200
const AUTOMATOR_BRIDGE_POST_CONNECT_REFRESH_ENV = 'WEAPP_VITE_E2E_AUTOMATOR_BRIDGE_POST_CONNECT_REFRESH'
const CURRENT_PAGE_PROTOCOL_TIMEOUT = 3_000
const PAGE_ROOT_QUERY_PROTOCOL_TIMEOUT = 1_000
const PAGE_WXML_PROTOCOL_TIMEOUT = 1_000
const PAGE_WXML_DIAGNOSTIC_SNIPPET_LENGTH = 1_200
const ROUTE_PAGE_METHOD_PROTOCOL_TIMEOUT = 8_000
const ROUTE_PAGE_METHOD_RETRIES = 3
const ROUTE_PAGE_METHOD_RECOVERY_ATTEMPTS = 2
export const PREPARE_GITHUB_ISSUES_BUILD_TIMEOUT = 120_000

type RelaunchPageReadiness = 'wxml' | 'route' | ((page: any) => boolean | Promise<boolean>)

export interface RelaunchPageOptions {
  readiness?: RelaunchPageReadiness
}

interface CallRoutePageMethodOptions {
  protocolTimeoutMs?: number
  recoveryAttempts?: number
  readiness?: RelaunchPageReadiness
  retries?: number
  retryDelayMs?: number
}

function isRecord(value: unknown): value is Record<string, any> {
  return Boolean(value) && typeof value === 'object'
}

function normalizeRoutePath(routePath: string) {
  return routePath.split('?', 1)[0].split('#', 1)[0].replace(LEADING_SLASH_RE, '').replace(/\/+$/g, '')
}

function resolveRouteQuery(routePath: string) {
  const queryText = routePath.split('#', 1)[0].split('?')[1]
  if (!queryText) {
    return null
  }
  return Object.fromEntries(new URLSearchParams(queryText))
}

function decodeQueryValue(value: string) {
  try {
    return decodeURIComponent(value)
  }
  catch {
    return value
  }
}

function isEquivalentQueryValue(actual: unknown, expected: string) {
  const actualValue = String(actual ?? '')
  return actualValue === expected
    || decodeQueryValue(actualValue) === expected
    || actualValue === encodeURIComponent(expected)
}

function isExpectedRoutePage(page: any, expectedPath: string) {
  if (normalizeRoutePath(page?.path ?? '') !== normalizeRoutePath(expectedPath)) {
    return false
  }
  const expectedQuery = resolveRouteQuery(expectedPath)
  if (!expectedQuery) {
    return true
  }
  const actualQuery = page?.query ?? {}
  return Object.entries(expectedQuery).every(([key, value]) => isEquivalentQueryValue(actualQuery[key], value))
}

function resolveRouteRenderedSelectors(routePath: string) {
  const normalizedRoute = normalizeRoutePath(routePath)
  const segments = normalizedRoute.split('/').filter(Boolean)
  const routeName = segments.at(-1) === 'index' ? segments.at(-2) : segments.at(-1)
  if (!routeName) {
    return []
  }

  const compactName = routeName.replace(/[^a-z0-9]/gi, '')
  const compactIssuePrefixName = routeName.replace(/^issue-/i, 'issue')
  return [
    `#${compactName}-page`,
    `#${compactIssuePrefixName}-page`,
    `#${routeName}-page`,
    `.${compactName}-page`,
    `.${compactIssuePrefixName}-page`,
    `.${routeName}-page`,
  ].filter((selector, index, selectors) => selectors.indexOf(selector) === index)
}

async function syncProjectConfigDistRoot() {
  const relativeDistRoot = path.relative(APP_ROOT, DIST_ROOT).replaceAll('\\', '/')
  if (!relativeDistRoot || relativeDistRoot === 'dist') {
    return
  }

  const projectConfigPath = path.join(APP_ROOT, 'project.config.json')
  const config = await fs.readJSON(projectConfigPath).catch(() => undefined) as unknown
  if (!isRecord(config)) {
    return
  }

  config.miniprogramRoot = `${relativeDistRoot}/`

  const setting = config.setting
  if (isRecord(setting) && Array.isArray(setting.packNpmRelationList)) {
    for (const item of setting.packNpmRelationList) {
      if (isRecord(item)) {
        item.miniprogramNpmDistDir = `./${relativeDistRoot}`
      }
    }
  }

  await fs.writeJSON(projectConfigPath, config, {
    spaces: 2,
  })
}

async function prepareIsolatedProjectRoot() {
  await fs.remove(APP_ROOT)
  await fs.ensureDir(APP_ROOT)

  await Promise.all(SOURCE_PROJECT_COPY_ENTRIES.map(async (entry) => {
    const source = path.join(SOURCE_APP_ROOT, entry)
    if (!(await fs.pathExists(source))) {
      return
    }
    await fs.copy(source, path.join(APP_ROOT, entry), {
      dereference: false,
    })
  }))

  if (await fs.pathExists(SOURCE_NODE_MODULES)) {
    await fs.symlink(SOURCE_NODE_MODULES, path.join(APP_ROOT, 'node_modules'), 'junction')
  }

  if (isAppShellFreeTarget()) {
    await fs.remove(path.join(APP_ROOT, 'src/app.vue'))
    await fs.writeFile(path.join(APP_ROOT, 'src/app.ts'), 'App({})\n')
    await fs.writeJSON(path.join(APP_ROOT, 'src/app.json'), {
      pages: [
        'pages/block-slot/index',
        'pages/issue-642-bug7/index',
        'pages/issue-642-bug8/index',
      ],
      subPackages: [],
      subpackages: [],
    }, {
      spaces: 2,
    })
  }

  await syncProjectConfigDistRoot()
}

async function runBuild() {
  await fs.remove(DIST_ROOT)

  await runWeappViteBuildWithLogCapture({
    cliPath: CLI_PATH,
    projectRoot: APP_ROOT,
    platform: 'weapp',
    skipNpm: true,
    cwd: APP_ROOT,
    label: 'ide:github-issues',
  })
}

function resolveAppConfigRoutes(config: Record<string, any>) {
  const pages = Array.isArray(config.pages)
    ? config.pages.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    : []
  const subPackages = [
    ...(Array.isArray(config.subPackages) ? config.subPackages : []),
    ...(Array.isArray(config.subpackages) ? config.subpackages : []),
  ].filter((item): item is Record<string, any> => Boolean(item) && typeof item === 'object')

  return {
    pages,
    subPackages,
  }
}

function resolveAppConfigRoutePaths(config: Record<string, any>) {
  const { pages, subPackages } = resolveAppConfigRoutes(config)
  const routes = [...pages]

  for (const subPackage of subPackages) {
    const root = typeof subPackage.root === 'string'
      ? subPackage.root.replace(/^\/+|\/+$/g, '')
      : ''
    const packagePages = Array.isArray(subPackage.pages)
      ? subPackage.pages.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
      : []
    for (const page of packagePages) {
      routes.push([root, page.replace(/^\/+/, '')].filter(Boolean).join('/'))
    }
  }

  return routes
}

async function normalizeDistAppConfigPackageAliases(config: Record<string, any>) {
  const normalizedSubPackages = Array.isArray(config.subPackages)
    ? config.subPackages
    : Array.isArray(config.subpackages)
      ? config.subpackages
      : []
  if (config.subPackages === normalizedSubPackages && config.subpackages === normalizedSubPackages) {
    return
  }

  config.subPackages = normalizedSubPackages
  config.subpackages = normalizedSubPackages
  await fs.writeJSON(path.join(DIST_ROOT, 'app.json'), config, {
    spaces: 2,
  })
}

async function normalizeDistConfigCustomTabBar(configPath: string, config: Record<string, any>) {
  const usingComponents = isRecord(config.usingComponents) ? config.usingComponents : undefined
  if (usingComponents?.['custom-tab-bar'] !== '/custom-tab-bar/index') {
    return false
  }
  if (await fs.pathExists(path.join(DIST_ROOT, 'custom-tab-bar/index.json'))) {
    return false
  }

  delete usingComponents['custom-tab-bar']
  if (isRecord(config.tabBar) && config.tabBar.custom === true) {
    delete config.tabBar
  }
  await fs.writeJSON(configPath, config, {
    spaces: 2,
  })
  return true
}

async function normalizeDistAppShellConfigCustomTabBar() {
  const appShellConfigPath = path.join(DIST_ROOT, '__weapp_vite_app_shell.json')
  const config = await fs.readJSON(appShellConfigPath).catch(() => undefined) as unknown
  if (!isRecord(config)) {
    return
  }
  await normalizeDistConfigCustomTabBar(appShellConfigPath, config)
}

async function prioritizeProjectPrivateConfigLaunchRoute(route: string) {
  const privateConfigPath = path.join(APP_ROOT, 'project.private.config.json')
  const privateConfig = await fs.readJSON(privateConfigPath).catch(() => undefined) as unknown
  if (!isRecord(privateConfig)) {
    return false
  }

  const condition = isRecord(privateConfig.condition) ? privateConfig.condition : {}
  const miniprogram = isRecord(condition.miniprogram) ? condition.miniprogram : {}
  const originalList = Array.isArray(miniprogram.list) ? miniprogram.list : []
  const targetRoute = normalizeRoutePath(route)
  const targetIndex = originalList.findIndex((item) => {
    return isRecord(item) && normalizeRoutePath(String(item.pathName ?? '')) === targetRoute
  })
  const targetItem = targetIndex >= 0
    ? originalList[targetIndex]
    : {
        launchMode: 'default',
        name: targetRoute,
        pathName: targetRoute,
        query: '',
        scene: null,
      }
  const nextList = [
    targetItem,
    ...originalList.filter((_, index) => index !== targetIndex),
  ]

  privateConfig.condition = {
    ...condition,
    miniprogram: {
      ...miniprogram,
      current: 0,
      list: nextList,
    },
  }

  privateConfig.setting = {
    ...(isRecord(privateConfig.setting) ? privateConfig.setting : {}),
    compileHotReLoad: false,
  }

  await fs.writeJSON(privateConfigPath, privateConfig, {
    spaces: 2,
  })
  return true
}

async function prioritizeDistLaunchRoute(route: string) {
  let prioritized = false
  const appConfigPath = path.join(DIST_ROOT, 'app.json')
  const config = await fs.readJSON(appConfigPath).catch(() => undefined) as unknown
  if (!isRecord(config) || !Array.isArray(config.pages)) {
    return await prioritizeProjectPrivateConfigLaunchRoute(route)
  }

  const targetRoute = normalizeRoutePath(route)
  const routeIndex = config.pages.findIndex(item => typeof item === 'string' && normalizeRoutePath(item) === targetRoute)
  if (routeIndex === 0) {
    prioritized = true
  }
  else if (routeIndex > 0) {
    const pages = config.pages.slice()
    const [targetPage] = pages.splice(routeIndex, 1)
    config.pages = [targetPage, ...pages]
    await fs.writeJSON(appConfigPath, config, {
      spaces: 2,
    })
    prioritized = true
  }

  const privateConfigPrioritized = await prioritizeProjectPrivateConfigLaunchRoute(route)
  if (prioritized || privateConfigPrioritized) {
    process.stdout.write(`[github-issues:launch] prioritize-route route=${route}\n`)
  }
  return prioritized || privateConfigPrioritized
}

async function syncProjectPrivateConfigConditions(config: Record<string, any>) {
  const routePaths = resolveAppConfigRoutePaths(config)
  if (routePaths.length === 0) {
    return
  }

  const privateConfigPath = path.join(APP_ROOT, 'project.private.config.json')
  const privateConfig = await fs.readJSON(privateConfigPath).catch(() => undefined) as unknown
  if (!isRecord(privateConfig)) {
    return
  }

  privateConfig.setting = {
    ...(isRecord(privateConfig.setting) ? privateConfig.setting : {}),
    compileHotReLoad: false,
  }

  const condition = isRecord(privateConfig.condition) ? privateConfig.condition : {}
  const miniprogram = isRecord(condition.miniprogram) ? condition.miniprogram : {}
  const originalList = Array.isArray(miniprogram.list) ? miniprogram.list : []
  const routeSet = new Set(routePaths)
  const filteredList = originalList.filter((item): item is Record<string, any> => {
    return isRecord(item) && typeof item.pathName === 'string' && routeSet.has(item.pathName)
  })
  const knownRoutes = new Set(filteredList.map(item => item.pathName))

  for (const routePath of routePaths) {
    if (knownRoutes.has(routePath)) {
      continue
    }
    filteredList.push({
      launchMode: 'default',
      name: routePath,
      pathName: routePath,
      query: '',
      scene: null,
    })
  }

  privateConfig.condition = {
    ...condition,
    miniprogram: {
      ...miniprogram,
      list: filteredList,
    },
  }

  await fs.writeJSON(privateConfigPath, privateConfig, {
    spaces: 2,
  })
}

async function assertGithubIssuesAppConfigReady() {
  const appConfigPath = path.join(DIST_ROOT, 'app.json')
  const config = await fs.readJSON(appConfigPath).catch(() => undefined) as Record<string, any> | undefined
  if (!config || typeof config !== 'object') {
    throw new Error(`github-issues dist app.json is not readable: ${appConfigPath}`)
  }

  const { pages, subPackages } = resolveAppConfigRoutes(config)
  if (pages.length === 0) {
    throw new Error(`github-issues dist app.json has no pages: ${appConfigPath}`)
  }
  if (config.subPackages != null && !Array.isArray(config.subPackages)) {
    throw new Error(`github-issues dist app.json subPackages is not an array: ${appConfigPath}`)
  }
  if (config.subpackages != null && !Array.isArray(config.subpackages)) {
    throw new Error(`github-issues dist app.json subpackages is not an array: ${appConfigPath}`)
  }

  const routeCount = pages.length + subPackages.reduce((total, subPackage) => {
    const packagePages = Array.isArray(subPackage.pages) ? subPackage.pages.length : 0
    return total + packagePages
  }, 0)
  if (routeCount === 0) {
    throw new Error(`github-issues dist app.json has no routable pages: ${appConfigPath}`)
  }

  await normalizeDistConfigCustomTabBar(appConfigPath, config)
  await normalizeDistAppShellConfigCustomTabBar()
  await normalizeDistAppConfigPackageAliases(config)
  await syncProjectPrivateConfigConditions(config)
}

let sharedMiniProgram: any = null
let sharedBuildPrepared = false
let sharedLaunchInfraUnavailableMessage: string | null = null

export async function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

export async function prepareGithubIssuesBuild() {
  if (sharedBuildPrepared) {
    return
  }

  // 同一路径重复打开 github-issues 项目时，微信开发者工具可能沿用旧 compile cache /
  // fileutils 状态，先消费旧 app.json，再去索引新的页面产物，出现“app.json 指向的 wxml 未找到”。
  await cleanupResidualIdeProcesses()
  await prepareIsolatedProjectRoot()
  await cleanDevtoolsCache('all', { cwd: APP_ROOT })
  await runBuild()
  await assertGithubIssuesAppConfigReady()
  await cleanDevtoolsCache('all', { cwd: APP_ROOT })
  await delay(600)
  sharedBuildPrepared = true
}

async function runWithTimeout<T>(factory: () => Promise<T>, timeoutMs: number, label: string) {
  let timer: ReturnType<typeof setTimeout> | null = null
  let settled = false
  const task = Promise.resolve()
    .then(factory)
    .then((value) => {
      settled = true
      return value
    })
    .catch((error) => {
      settled = true
      throw error
    })
  try {
    return await Promise.race([
      task,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => {
          reject(new Error(`Timeout in ${label} after ${timeoutMs}ms`))
        }, timeoutMs)
      }),
    ])
  }
  finally {
    if (timer) {
      clearTimeout(timer)
    }
    if (!settled) {
      void task.catch(() => {})
    }
  }
}

function shouldRetryAutomatorError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error)
  return message.includes('Wait timed out after')
    || message.includes('Timeout in ')
    || message.includes('DevTools did not respond to protocol method')
    || message.includes('Automator page method not ready')
    || message.includes('Execution context was destroyed')
    || message.includes('Target closed')
    || message.includes('Connection closed, check if wechat web devTools is still running')
    || message.includes('WebSocket is not open')
    || message.includes('socket hang up')
}

function shouldRecoverRoutePageMethodError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error)
  return shouldRetryAutomatorError(error)
    || isDevtoolsSimulatorBootError(error)
    || /routeDone with a webviewId/i.test(message)
}

function isRelaunchSessionUnstableError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error)
  return /Timeout in (?:raw )?reLaunch/i.test(message)
    || /Timed out waiting page root after reLaunch/i.test(message)
    || /reLaunch returned empty page/i.test(message)
    || /routeDone with a webviewId/i.test(message)
    || /getPageMetaByWebviewId/i.test(message)
    || /Connection closed, check if wechat web devTools is still running/i.test(message)
    || /socket hang up/i.test(message)
    || /Target closed/i.test(message)
    || /WebSocket is not open/i.test(message)
    || /not connected/i.test(message)
}

async function runAutomatorOp<T>(
  label: string,
  factory: () => Promise<T>,
  options: { timeoutMs?: number, retries?: number, retryDelayMs?: number } = {},
) {
  const {
    timeoutMs = 8_000,
    retries = 2,
    retryDelayMs = 220,
  } = options

  let lastError: unknown
  for (let attempt = 1; attempt <= retries; attempt += 1) {
    try {
      return await runWithTimeout(factory, timeoutMs, `${label}#${attempt}`)
    }
    catch (error) {
      lastError = error
      if (attempt < retries && shouldRetryAutomatorError(error)) {
        await delay(retryDelayMs)
        continue
      }
      throw error
    }
  }

  throw lastError
}

async function closeMiniProgramSafely(miniProgram: any) {
  await runAutomatorOp('close mini program', () => miniProgram.close(), {
    timeoutMs: 6_000,
    retries: 1,
  }).catch(() => {
    if (typeof miniProgram?.disconnect === 'function') {
      miniProgram.disconnect()
    }
  })
}

function stripAutomatorOverlay(wxml: string) {
  return wxml.replace(AUTOMATOR_OVERLAY_RE, '')
}

function compactWxmlSnippet(wxml: string) {
  const compact = wxml.replace(WHITESPACE_RE, ' ').trim()
  return compact.length > PAGE_WXML_DIAGNOSTIC_SNIPPET_LENGTH
    ? `${compact.slice(0, PAGE_WXML_DIAGNOSTIC_SNIPPET_LENGTH)}...`
    : compact
}

function isEmptyRuntimeWxml(wxml: string) {
  const normalized = wxml.trim()
  return !normalized || normalized === '<text></text>'
}

function recordPageWxmlSnapshot(options: {
  channel: string
  route: string
  readyText?: string
  currentPage?: string
  wxml?: string
  error?: unknown
}) {
  const wxml = options.wxml ?? ''
  const errorText = options.error instanceof Error
    ? options.error.message
    : options.error == null
      ? ''
      : String(options.error)
  const snippet = wxml
    ? compactWxmlSnippet(wxml)
    : errorText
      ? `readPageWxml failed: ${errorText}`
      : '<empty>'
  appendIdeReportEvent({
    source: 'runtime',
    kind: 'page-snapshot',
    project: resolveReportProjectPath(APP_ROOT),
    channel: options.channel,
    route: options.route,
    readyText: options.readyText || '<none>',
    currentPage: options.currentPage || '<none>',
    wxmlLength: wxml.length,
    empty: isEmptyRuntimeWxml(wxml),
    text: snippet,
  })
}

export async function readPageWxml(page: any) {
  return await runAutomatorOp('read page wxml', async () => {
    if (typeof page?.wxml === 'function') {
      return stripAutomatorOverlay(await runWithTimeout(
        () => page.wxml(),
        PAGE_ROOT_QUERY_PROTOCOL_TIMEOUT + PAGE_WXML_PROTOCOL_TIMEOUT,
        'Page.getWXML',
      ))
    }
    let lastError: unknown
    for (const selector of ['page', 'body', 'weapp-app-shell', 'view']) {
      try {
        const element = await runWithTimeout(
          () => page.$(selector),
          PAGE_ROOT_QUERY_PROTOCOL_TIMEOUT,
          `Page.queryPageRoot ${selector}`,
        )
        if (!element) {
          continue
        }
        return stripAutomatorOverlay(await runWithTimeout(
          () => element.wxml(),
          PAGE_WXML_PROTOCOL_TIMEOUT,
          `Element.getWXML ${selector}`,
        ))
      }
      catch (error) {
        lastError = error
      }
    }
    throw lastError instanceof Error ? lastError : new Error('Failed to find page element')
  }, {
    timeoutMs: PAGE_ROOT_QUERY_PROTOCOL_TIMEOUT + PAGE_WXML_PROTOCOL_TIMEOUT + 1_000,
    retries: 1,
    retryDelayMs: 360,
  })
}

async function waitForPageWxml(page: any, readyText?: string, timeoutMs = 15_000) {
  if (typeof page?.waitForRendered === 'function') {
    try {
      return {
        ready: true,
        wxml: stripAutomatorOverlay(await page.waitForRendered({
          ...(readyText ? { text: readyText } : {}),
          timeout: timeoutMs,
        })),
      }
    }
    catch (error) {
      return {
        ready: false,
        wxml: '',
        error,
      }
    }
  }

  const start = Date.now()
  let lastWxml = ''
  let lastError: unknown
  while (Date.now() - start <= timeoutMs) {
    try {
      const wxml = await readPageWxml(page)
      lastWxml = wxml
      lastError = undefined
      const normalized = wxml.trim()
      if (readyText) {
        if (normalized.includes(readyText)) {
          return {
            ready: true,
            wxml,
          }
        }
      }
      else if (normalized && normalized !== '<text></text>') {
        return {
          ready: true,
          wxml,
        }
      }
    }
    catch (error) {
      lastError = error
    }

    if (typeof page?.waitFor === 'function') {
      try {
        await page.waitFor(220)
        continue
      }
      catch {
      }
    }
    await delay(220)
  }
  return {
    ready: false,
    wxml: lastWxml,
    error: lastError,
  }
}

async function waitForAppServiceRoute(miniProgram: any, route: string, timeoutMs: number) {
  const normalizedExpectedPath = normalizeRoutePath(route)
  const start = Date.now()
  while (Date.now() - start <= timeoutMs) {
    try {
      const currentRoute = await runWithTimeout(
        () => miniProgram.evaluate(() => {
          const pages = typeof getCurrentPages === 'function' ? getCurrentPages() : []
          const page = pages[pages.length - 1] as any
          return page?.route || page?.__route__ || page?.path || ''
        }),
        Math.min(CURRENT_PAGE_PROTOCOL_TIMEOUT, Math.max(1, timeoutMs - (Date.now() - start))),
        `app-service current route ${route}`,
      )
      if (normalizeRoutePath(currentRoute) === normalizedExpectedPath) {
        return true
      }
    }
    catch {
    }
    await delay(220)
  }
  return false
}

async function waitForPageReadiness(
  miniProgram: any,
  page: any,
  route: string,
  readyText: string | undefined,
  timeoutMs: number,
  readiness: RelaunchPageReadiness | undefined,
) {
  async function waitForRenderedDom(remainingTimeoutMs: number) {
    let lastError: unknown
    if (typeof page?.waitForRendered === 'function') {
      const timeout = Math.max(1, remainingTimeoutMs)
      for (const selector of resolveRouteRenderedSelectors(route)) {
        try {
          return {
            ready: true,
            wxml: stripAutomatorOverlay(await page.waitForRendered({
              selector,
              timeout: Math.min(timeout, 1_500),
            })),
          }
        }
        catch (error) {
          lastError = error
        }
      }
    }
    if (readyText) {
      return await waitForPageWxml(page, readyText, Math.max(1, remainingTimeoutMs))
    }
    return {
      ready: false,
      wxml: '',
      error: lastError,
    }
  }

  if (readiness === 'route' || (!readiness && !readyText)) {
    const routeStart = Date.now()
    const appServiceReady = await waitForAppServiceRoute(miniProgram, route, timeoutMs)
    if (!appServiceReady) {
      return {
        ready: false,
        wxml: '',
      }
    }
    const domResult = await waitForRenderedDom(timeoutMs - (Date.now() - routeStart))
    return {
      ready: domResult.ready,
      wxml: domResult.wxml,
      error: domResult.error,
    }
  }

  if (typeof readiness !== 'function') {
    return await waitForPageWxml(page, readyText, timeoutMs)
  }

  const start = Date.now()
  let lastError: unknown
  while (Date.now() - start <= timeoutMs) {
    try {
      const remaining = Math.max(1, timeoutMs - (Date.now() - start))
      const ready = await runWithTimeout(
        () => Promise.resolve(readiness(page)),
        Math.min(CURRENT_PAGE_PROTOCOL_TIMEOUT, remaining),
        `runtime ready ${route}`,
      )
      if (ready) {
        return {
          ready: true,
          wxml: '',
        }
      }
    }
    catch (error) {
      lastError = error
    }

    if (typeof page?.waitFor === 'function') {
      try {
        await page.waitFor(220)
        continue
      }
      catch {
      }
    }
    await delay(220)
  }

  return {
    ready: false,
    wxml: '',
    error: lastError,
  }
}

export async function readClassName(page: any, selector: string) {
  return await runAutomatorOp(`read class ${selector}`, async () => {
    const element = await page.$(selector)
    if (!element) {
      throw new Error(`Failed to find element: ${selector}`)
    }

    return (await element.attribute('class') ?? '')
      .trim()
      .replace(WHITESPACE_RE, ' ')
  }, {
    timeoutMs: 5_000,
    retries: 2,
    retryDelayMs: 180,
  })
}

function escapeRegExp(value: string) {
  return value.replace(REGEXP_ESCAPE_RE, '\\$&')
}

export async function waitForCurrentPagePath(miniProgram: any, expectedPath: string, timeoutMs = 12_000) {
  const start = Date.now()
  while (Date.now() - start <= timeoutMs) {
    try {
      const page = await runWithTimeout(
        () => miniProgram.currentPage(),
        Math.min(CURRENT_PAGE_PROTOCOL_TIMEOUT, Math.max(1, timeoutMs - (Date.now() - start))),
        'currentPage',
      )
      if (isExpectedRoutePage(page, expectedPath)) {
        return page
      }
    }
    catch {
    }
    await delay(220)
  }
  return null
}

function isGithubIssuesLaunchRetryableError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error)
  return message.includes('Timeout in warmup reLaunch')
    || message.includes('Timed out waiting page root after warmup reLaunch')
    || message.includes('Timeout in read current page for route')
    || isDevtoolsHttpPortError(error)
    || isDevtoolsSimulatorBootError(error)
}

function isGithubIssuesLaunchInfraUnavailableError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error)
  return isDevtoolsHttpPortError(error)
    || isDevtoolsLoginRequiredError(error)
    || isDevtoolsSimulatorBootError(error)
    || message.includes('Timeout in read current page for route')
}

async function launchGithubIssuesMiniProgramOnce() {
  const previousBridgePostConnectRefresh = process.env[AUTOMATOR_BRIDGE_POST_CONNECT_REFRESH_ENV]
  try {
    process.env[AUTOMATOR_BRIDGE_POST_CONNECT_REFRESH_ENV] = '1'
    const miniProgram = await launchAutomator({
      projectPath: APP_ROOT,
      skipRelaunchPageRootCheck: true,
      skipWarmup: true,
      warmupAllowRelaunch: true,
    })
    await delay(600)
    return miniProgram
  }
  finally {
    if (previousBridgePostConnectRefresh == null) {
      delete process.env[AUTOMATOR_BRIDGE_POST_CONNECT_REFRESH_ENV]
    }
    else {
      process.env[AUTOMATOR_BRIDGE_POST_CONNECT_REFRESH_ENV] = previousBridgePostConnectRefresh
    }
  }
}

async function launchGithubIssuesMiniProgram(ctx?: { skip: (message?: string) => void }) {
  if (sharedLaunchInfraUnavailableMessage) {
    ctx?.skip(sharedLaunchInfraUnavailableMessage)
    throw new Error(sharedLaunchInfraUnavailableMessage)
  }

  await cleanupResidualIdeProcesses()

  await prepareGithubIssuesBuild()

  let lastError: unknown
  for (let attempt = 1; attempt <= GITHUB_ISSUES_LAUNCH_RETRIES; attempt += 1) {
    try {
      return await launchGithubIssuesMiniProgramOnce()
    }
    catch (error) {
      lastError = error
      if (attempt < GITHUB_ISSUES_LAUNCH_RETRIES && isGithubIssuesLaunchRetryableError(error)) {
        process.stdout.write(`[github-issues:launch] retry attempt=${attempt + 1}/${GITHUB_ISSUES_LAUNCH_RETRIES} reason=${error instanceof Error ? error.message : String(error)}\n`)
        await cleanupResidualIdeProcesses()
        await delay(GITHUB_ISSUES_LAUNCH_RETRY_DELAY)
        continue
      }
      break
    }
  }

  if (ctx && isGithubIssuesLaunchInfraUnavailableError(lastError)) {
    const reason = lastError instanceof Error ? lastError.message : String(lastError)
    sharedLaunchInfraUnavailableMessage = `WeChat DevTools 基础设施不可用，跳过 github-issues IDE 自动化用例。reason=${reason}`
    ctx.skip(sharedLaunchInfraUnavailableMessage)
  }
  throw lastError
}

export async function closeSharedMiniProgram() {
  if (!sharedMiniProgram) {
    return
  }
  const miniProgram = sharedMiniProgram
  sharedMiniProgram = null
  await closeMiniProgramSafely(miniProgram)
}

export function disconnectSharedMiniProgram() {
  if (!sharedMiniProgram) {
    return
  }
  sharedMiniProgram = null
}

export async function getSharedMiniProgram(ctx?: { skip: (message?: string) => void }) {
  sharedMiniProgram ??= await launchGithubIssuesMiniProgram(ctx)
  return sharedMiniProgram
}

export async function launchFreshMiniProgram(ctx?: { skip: (message?: string) => void }) {
  return await launchGithubIssuesMiniProgram(ctx)
}

export async function releaseSharedMiniProgram(miniProgram: any) {
  if (sharedMiniProgram === miniProgram) {
    return
  }
  await closeMiniProgramSafely(miniProgram)
}

export async function callCurrentPageMethod<T = any>(miniProgram: any, methodName: string, ...args: any[]): Promise<T> {
  const result = await runAutomatorOp(`call current page method ${methodName}`, async () => {
    const value = await miniProgram.evaluate((name: string, methodArgs: any[]) => {
      const pages = typeof getCurrentPages === 'function' ? getCurrentPages() : []
      const page = pages[pages.length - 1] as any
      const method = page?.[name]
      if (typeof method !== 'function') {
        return {
          missing: true,
          path: page?.route || page?.__route__ || page?.path || '',
        }
      }
      return {
        value: method.apply(page, Array.isArray(methodArgs) ? methodArgs : []),
      }
    }, methodName, args)
    if (value?.missing) {
      throw new Error(`Automator page method not ready: current method=${methodName} page=${value.path || '<empty>'}`)
    }
    return value
  }, {
    timeoutMs: 2_000,
    retries: 15,
    retryDelayMs: 300,
  }) as { value?: T }

  return result?.value as T
}

async function restartSharedMiniProgram(ctx?: { skip: (message?: string) => void }, launchRoute?: string) {
  await closeSharedMiniProgram()
  if (launchRoute) {
    const prioritized = await prioritizeDistLaunchRoute(launchRoute)
    if (prioritized) {
      await cleanupResidualIdeProcesses()
      await cleanDevtoolsCache('all', { cwd: APP_ROOT }).catch(() => {})
      await delay(600)
    }
  }
  return await getSharedMiniProgram(ctx)
}

export async function relaunchPage(
  miniProgram: any,
  route: string,
  readyText?: string,
  timeoutMs = 45_000,
  options: RelaunchPageOptions = {},
) {
  async function waitForRoutePage(targetMiniProgram: any, phase: string, timeout: number) {
    const page = await waitForCurrentPagePath(
      targetMiniProgram,
      route,
      timeout,
    )
    if (page) {
      return page
    }
    process.stdout.write(`[github-issues:relaunch] route-not-current route=${route} phase=${phase}\n`)
    return null
  }

  async function triggerRelaunch(targetMiniProgram: any, phase: 'primary' | 'restart') {
    const routeMethods = normalizeRoutePath(route).startsWith('subpackages/')
      ? ['navigateTo', 'reLaunch'] as const
      : ['reLaunch'] as const
    if (!routeMethods.some(method => typeof targetMiniProgram?.[method] === 'function')) {
      return null
    }

    for (let attempt = 1; attempt <= 3; attempt += 1) {
      for (const routeMethod of routeMethods) {
        if (typeof targetMiniProgram?.[routeMethod] !== 'function') {
          continue
        }
        process.stdout.write(`[github-issues:relaunch] ${routeMethod} route=${route} phase=${phase} attempt=${attempt}/3\n`)
        try {
          const relaunchedPage = await runWithTimeout(
            () => targetMiniProgram[routeMethod](route),
            Math.max(timeoutMs, 45_000),
            `${routeMethod} ${route}`,
          )
          if (isExpectedRoutePage(relaunchedPage, route)) {
            return relaunchedPage
          }
        }
        catch (error) {
          process.stdout.write(`[github-issues:relaunch] ${routeMethod}-failed route=${route} phase=${phase} attempt=${attempt}/3 reason=${error instanceof Error ? error.message : String(error)}\n`)
          if (isRelaunchSessionUnstableError(error)) {
            return null
          }
        }

        const routedPage = await waitForRoutePage(targetMiniProgram, `${phase}:after-${routeMethod}:${attempt}`, Math.min(timeoutMs, 8_000))
        if (routedPage) {
          return routedPage
        }
      }

      await delay(500)
    }

    return null
  }

  async function runAttempts(targetMiniProgram: any, phase: 'primary' | 'restart') {
    process.stdout.write(`[github-issues:relaunch] phase=${phase} route=${route}\n`)
    const alreadyCurrentPage = await waitForRoutePage(
      targetMiniProgram,
      `${phase}:current`,
      Math.min(timeoutMs, phase === 'restart' ? 30_000 : 8_000),
    )
    const page = alreadyCurrentPage ?? await triggerRelaunch(targetMiniProgram, phase)
    if (!page) {
      return null
    }

    const readyResult = await waitForPageReadiness(
      targetMiniProgram,
      page,
      route,
      readyText,
      Math.min(timeoutMs, 12_000),
      options.readiness,
    )
    if (readyResult.ready) {
      process.stdout.write(`[github-issues:relaunch] current-page-ready route=${route} phase=${phase}\n`)
      return page
    }
    process.stdout.write(`[github-issues:relaunch] current-page-ready-timeout route=${route} phase=${phase} readyText=${readyText || '<none>'}\n`)
    recordPageWxmlSnapshot({
      channel: 'github-issues:current-page-ready-timeout',
      route,
      readyText,
      currentPage: page?.path,
      wxml: readyResult.wxml,
      error: readyResult.error,
    })
    return null
  }

  const primaryPage = await runAttempts(miniProgram, 'primary')
  if (primaryPage) {
    return primaryPage
  }

  if (miniProgram === sharedMiniProgram) {
    for (let restartAttempt = 1; restartAttempt <= 2; restartAttempt += 1) {
      process.stdout.write(`[github-issues:relaunch] restart shared automator route=${route} attempt=${restartAttempt}/2\n`)
      const restartedMiniProgram = await restartSharedMiniProgram(undefined, route)
      const restartedPage = await runAttempts(restartedMiniProgram, 'restart')
      if (restartedPage) {
        return restartedPage
      }
    }
  }

  return null
}

export async function callRoutePageMethodWithOptions<T = any>(
  miniProgram: any,
  route: string,
  methodName: string,
  options: CallRoutePageMethodOptions,
  ...args: any[]
): Promise<T> {
  const protocolTimeoutMs = options.protocolTimeoutMs ?? ROUTE_PAGE_METHOD_PROTOCOL_TIMEOUT
  const recoveryAttempts = options.recoveryAttempts ?? ROUTE_PAGE_METHOD_RECOVERY_ATTEMPTS
  const retries = options.retries ?? ROUTE_PAGE_METHOD_RETRIES
  const retryDelayMs = options.retryDelayMs ?? 500

  async function evaluateRoutePageMethod(targetMiniProgram: any) {
    const evaluator = async (expectedRoute: string, name: string, methodArgs: any[]) => {
      const normalizeRoute = (value: unknown) => String(value || '').split('?', 1)[0].split('#', 1)[0].replace(/^\/+/, '').replace(/\/+$/g, '')
      const expected = normalizeRoute(expectedRoute)
      const pages = typeof getCurrentPages === 'function' ? getCurrentPages() : []
      const page = pages
        .slice()
        .reverse()
        .find((item: any) => {
          return [
            item?.route,
            item?.__route__,
            item?.path,
          ].some(value => normalizeRoute(value) === expected)
        }) as any
      const method = page?.[name]
      if (typeof method !== 'function') {
        return {
          missing: true,
          pages: pages.map((item: any) => item?.route || item?.__route__ || item?.path || ''),
        }
      }
      return {
        value: await method.apply(page, Array.isArray(methodArgs) ? methodArgs : []),
      }
    }
    const value = typeof targetMiniProgram.evaluateWithOptions === 'function'
      ? await targetMiniProgram.evaluateWithOptions(evaluator, {
          timeout: protocolTimeoutMs,
        }, route, methodName, args)
      : await targetMiniProgram.evaluate(evaluator, route, methodName, args)
    if (value?.missing) {
      throw new Error(`Automator page method not ready: route=${route} method=${methodName} pages=${(value.pages ?? []).join(',') || '<empty>'}`)
    }
    return value
  }

  let targetMiniProgram = miniProgram
  let lastError: unknown
  for (let recoveryAttempt = 1; recoveryAttempt <= recoveryAttempts; recoveryAttempt += 1) {
    try {
      const result = await runAutomatorOp(`call route page method ${methodName} ${route}`, async () => {
        return await evaluateRoutePageMethod(targetMiniProgram)
      }, {
        timeoutMs: protocolTimeoutMs + 1_000,
        retries,
        retryDelayMs,
      }) as { value?: T }

      return result?.value as T
    }
    catch (error) {
      lastError = error
      if (recoveryAttempt >= recoveryAttempts || !shouldRecoverRoutePageMethodError(error)) {
        throw error
      }

      process.stdout.write(`[github-issues:route-method-recover] route=${route} method=${methodName} attempt=${recoveryAttempt + 1}/${recoveryAttempts} reason=${error instanceof Error ? error.message : String(error)}\n`)
      if (targetMiniProgram === sharedMiniProgram) {
        targetMiniProgram = await restartSharedMiniProgram(undefined, route)
      }
      const page = await relaunchPage(targetMiniProgram, route, undefined, 45_000, {
        readiness: options.readiness,
      })
      if (!page) {
        throw error
      }
      if (sharedMiniProgram) {
        targetMiniProgram = sharedMiniProgram
      }
    }
  }

  throw lastError
}

export async function callRoutePageMethod<T = any>(miniProgram: any, route: string, methodName: string, ...args: any[]): Promise<T> {
  return await callRoutePageMethodWithOptions(miniProgram, route, methodName, {}, ...args)
}

export function expectPropsProbeCase(
  wxml: string,
  options: { caseId: string, boolText: 'true' | 'false', strText: string },
) {
  const { caseId, boolText, strText } = options
  const casePattern = escapeRegExp(caseId)
  const boolPattern = escapeRegExp(boolText)
  const strPattern = escapeRegExp(strText)

  const destructuredPattern = new RegExp(
    `<text(?=[^>]*class="[^"]*issue300-probe-destructured[^"]*")(?=[^>]*data-case-id="${casePattern}")(?=[^>]*data-destructured-bool="${boolPattern}")(?=[^>]*data-destructured-str="${strPattern}")[^>]*>`,
  )
  const propsPattern = new RegExp(
    `<text(?=[^>]*class="[^"]*issue300-probe-props[^"]*")(?=[^>]*data-case-id="${casePattern}")(?=[^>]*data-props-bool="${boolPattern}")(?=[^>]*data-props-bool-raw="${boolPattern}")(?=[^>]*data-props-str="${strPattern}")[^>]*>`,
  )
  const strictPattern = new RegExp(
    `<text(?=[^>]*class="[^"]*issue300-strict-probe[^"]*")(?=[^>]*data-case-id="${casePattern}")(?=[^>]*data-strict-bool="${boolPattern}")(?=[^>]*data-strict-bool-raw="${boolPattern}")(?=[^>]*data-strict-str="${strPattern}")[^>]*>`,
  )

  expect(wxml).toMatch(destructuredPattern)
  expect(wxml).toMatch(propsPattern)
  expect(wxml).toMatch(strictPattern)
}

function normalizeClassValue(className: string) {
  return className.trim().replace(WHITESPACE_RE, ' ')
}

export function readFirstClassFromWxmlByToken(wxml: string, token: string) {
  const escapedToken = escapeRegExp(token)
  const pattern = new RegExp(`<[^>]*\\bclass=(['"])([^'"]*\\b${escapedToken}\\b[^'"]*)\\1[^>]*>`, 'i')
  const className = pattern.exec(wxml)?.[2] ?? ''
  return normalizeClassValue(className)
}

export async function tapControlAndReadClass(page: any, tapSelector: string, classSelector = tapSelector) {
  return await runAutomatorOp(`tap and read class ${tapSelector}`, async () => {
    const controlElement = await page.$(tapSelector)
    if (!controlElement) {
      throw new Error(`Failed to find tap element: ${tapSelector}`)
    }

    const beforeClass = await readClassName(page, classSelector)

    async function fireTapLikeEvent(mode: 'tap' | 'trigger' | 'touch' | 'dispatch') {
      if (mode === 'tap') {
        await controlElement.tap()
        return
      }
      if (mode === 'trigger') {
        await controlElement.trigger('tap')
        return
      }
      if (mode === 'touch') {
        await controlElement.touchstart()
        await controlElement.touchend()
        return
      }
      await controlElement.dispatchEvent({ eventName: 'tap' })
    }

    for (const mode of ['tap', 'trigger', 'touch', 'dispatch'] as const) {
      for (let index = 0; index < 2; index += 1) {
        try {
          await fireTapLikeEvent(mode)
        }
        catch {
        }
        await page.waitFor(220)
        const currentClass = await readClassName(page, classSelector)
        if (currentClass !== beforeClass) {
          return currentClass
        }
      }
    }

    return await readClassName(page, classSelector)
  }, {
    timeoutMs: 8_000,
    retries: 2,
    retryDelayMs: 180,
  })
}

export async function tapElement(page: any, selector: string) {
  const element = await page.$(selector)
  if (!element) {
    throw new Error(`Failed to find tap element: ${selector}`)
  }

  async function fireTapLikeEvent(mode: 'tap' | 'trigger' | 'touch' | 'dispatch') {
    if (mode === 'tap') {
      await element.tap()
      return
    }
    if (mode === 'trigger') {
      await element.trigger('tap')
      return
    }
    if (mode === 'touch') {
      await element.touchstart()
      await element.touchend()
      return
    }
    await element.dispatchEvent({ eventName: 'tap' })
  }

  let lastError: unknown
  for (const mode of ['tap', 'trigger', 'touch', 'dispatch'] as const) {
    try {
      await fireTapLikeEvent(mode)
      await page.waitFor(240)
      return
    }
    catch (error) {
      lastError = error
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error(`Failed to tap element: ${selector}`)
}
