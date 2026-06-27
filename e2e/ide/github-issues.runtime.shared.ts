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
const GITHUB_ISSUES_WARMUP_ROUTE = '/pages/block-slot/index'
const GITHUB_ISSUES_LAUNCH_RETRIES = 2
const GITHUB_ISSUES_LAUNCH_RETRY_DELAY = 1_200
const AUTOMATOR_SKIP_WARMUP_ENV = 'WEAPP_VITE_E2E_AUTOMATOR_SKIP_WARMUP'
const CURRENT_PAGE_PROTOCOL_TIMEOUT = 3_000
const PAGE_ROOT_QUERY_PROTOCOL_TIMEOUT = 8_000
const PAGE_WXML_PROTOCOL_TIMEOUT = 8_000
const PAGE_WXML_DIAGNOSTIC_SNIPPET_LENGTH = 1_200
export const PREPARE_GITHUB_ISSUES_BUILD_TIMEOUT = 120_000

function resolveGithubIssuesWarmupRoute() {
  const targetFile = getNormalizedTargetFile()
  if (
    targetFile.endsWith('github-issues.runtime.issue642-bug7-default.test.ts')
    || targetFile.endsWith('github-issues.runtime.issue642-bug7-performance.test.ts')
  ) {
    return '/pages/issue-642-bug7/index'
  }
  if (targetFile.endsWith('github-issues.runtime.issue642-bug8.test.ts')) {
    return '/pages/issue-642-bug8/index'
  }
  return GITHUB_ISSUES_WARMUP_ROUTE
}

function isRecord(value: unknown): value is Record<string, any> {
  return Boolean(value) && typeof value === 'object'
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
    || message.includes('Execution context was destroyed')
    || message.includes('Target closed')
    || message.includes('Connection closed, check if wechat web devTools is still running')
    || message.includes('WebSocket is not open')
    || message.includes('socket hang up')
}

function isSessionFatalRelaunchError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error)
  return /Timeout in raw reLaunch/i.test(message)
    || /Timed out waiting page root after reLaunch/i.test(message)
    || /reLaunch returned empty page/i.test(message)
    || /simulator not found/i.test(message)
    || /模拟器启动失败/.test(message)
    || /subPackages[\s\S]{0,80}undefined/i.test(message)
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
    timeoutMs: 12_000,
    retries: 2,
    retryDelayMs: 200,
  }).catch(() => {})
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
    const element = await runWithTimeout(
      () => page.$('page'),
      PAGE_ROOT_QUERY_PROTOCOL_TIMEOUT,
      'Page.queryPageRoot',
    )
    if (!element) {
      throw new Error('Failed to find page element')
    }
    return stripAutomatorOverlay(await runWithTimeout(
      () => element.wxml(),
      PAGE_WXML_PROTOCOL_TIMEOUT,
      'Element.getWXML',
    ))
  }, {
    timeoutMs: PAGE_ROOT_QUERY_PROTOCOL_TIMEOUT + PAGE_WXML_PROTOCOL_TIMEOUT + 1_000,
    retries: 5,
    retryDelayMs: 360,
  })
}

async function waitForPageWxml(page: any, readyText?: string, timeoutMs = 15_000) {
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

function normalizeRoutePath(routePath: string) {
  return routePath.replace(LEADING_SLASH_RE, '')
}

export async function waitForCurrentPagePath(miniProgram: any, expectedPath: string, timeoutMs = 12_000) {
  const normalizedExpectedPath = normalizeRoutePath(expectedPath)
  const start = Date.now()
  while (Date.now() - start <= timeoutMs) {
    try {
      const page = await runWithTimeout(
        () => miniProgram.currentPage(),
        Math.min(CURRENT_PAGE_PROTOCOL_TIMEOUT, Math.max(1, timeoutMs - (Date.now() - start))),
        'currentPage',
      )
      if (normalizeRoutePath(page?.path ?? '') === normalizedExpectedPath) {
        return page
      }
    }
    catch {
    }
    await delay(220)
  }
  return null
}

async function ensureGithubIssuesWarmupPage(miniProgram: any) {
  const warmupRoute = resolveGithubIssuesWarmupRoute()
  const page = await waitForCurrentPagePath(miniProgram, warmupRoute, 15_000)
    ?? await runAutomatorOp(
      `reLaunch ${warmupRoute}`,
      () => miniProgram.reLaunch(warmupRoute),
      {
        timeoutMs: 30_000,
        retries: 2,
        retryDelayMs: 280,
      },
    )
  if (!page) {
    return null
  }
  const warmupReady = await waitForPageWxml(page, undefined, 15_000)
  return warmupReady.ready ? page : null
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
  const previousSkipWarmup = process.env[AUTOMATOR_SKIP_WARMUP_ENV]
  try {
    delete process.env[AUTOMATOR_SKIP_WARMUP_ENV]
    const warmupRoute = resolveGithubIssuesWarmupRoute()

    const miniProgram = await launchAutomator({
      projectPath: APP_ROOT,
      warmupRoute,
    })

    try {
      const warmupPage = await ensureGithubIssuesWarmupPage(miniProgram)
      if (!warmupPage) {
        process.stdout.write(`[github-issues:launch] warmup-check-skip route=${warmupRoute}\n`)
      }
    }
    catch (error) {
      process.stdout.write(`[github-issues:launch] warmup-check-skip route=${warmupRoute} reason=${error instanceof Error ? error.message : String(error)}\n`)
    }
    await delay(600)
    return miniProgram
  }
  finally {
    if (previousSkipWarmup == null) {
      delete process.env[AUTOMATOR_SKIP_WARMUP_ENV]
    }
    else {
      process.env[AUTOMATOR_SKIP_WARMUP_ENV] = previousSkipWarmup
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

async function restartSharedMiniProgram(ctx?: { skip: (message?: string) => void }) {
  await closeSharedMiniProgram()
  return await getSharedMiniProgram(ctx)
}

export async function relaunchPage(miniProgram: any, route: string, readyText?: string, timeoutMs = 45_000) {
  async function runAttempts(targetMiniProgram: any, phase: 'primary' | 'restart') {
    for (let attempt = 0; attempt < 4; attempt += 1) {
      process.stdout.write(`[github-issues:relaunch] phase=${phase} route=${route} attempt=${attempt + 1}/4\n`)
      let page: any = null
      try {
        page = await runAutomatorOp(
          `raw reLaunch ${route}`,
          () => targetMiniProgram.reLaunch(route),
          {
            timeoutMs: Math.min(timeoutMs, 12_000),
            retries: 1,
          },
        )
      }
      catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        process.stdout.write(`[github-issues:relaunch] error route=${route} phase=${phase} attempt=${attempt + 1} message=${message}\n`)
        if (isSessionFatalRelaunchError(error)) {
          return null
        }
        await delay(280)
        continue
      }
      if (!page) {
        await delay(220)
        continue
      }

      const currentPage = await waitForCurrentPagePath(
        targetMiniProgram,
        route,
        Math.min(timeoutMs, 4_000),
      )
      const targetPage = currentPage ?? page
      const readyResult = targetPage
        ? await waitForPageWxml(targetPage, readyText, timeoutMs)
        : { ready: false, wxml: '' }
      if (readyResult.ready) {
        return targetPage
      }
      process.stdout.write(`[github-issues:relaunch] ready-timeout route=${route} readyText=${readyText || '<none>'} currentPage=${currentPage?.path || '<none>'} fallback=returned-page\n`)
      recordPageWxmlSnapshot({
        channel: 'github-issues:ready-timeout',
        route,
        readyText,
        currentPage: currentPage?.path,
        wxml: readyResult.wxml,
        error: readyResult.error,
      })
      return targetPage
    }

    return null
  }

  const primaryPage = await runAttempts(miniProgram, 'primary')
  if (primaryPage) {
    return primaryPage
  }

  if (miniProgram === sharedMiniProgram) {
    process.stdout.write(`[github-issues:relaunch] restart shared automator route=${route}\n`)
    const restartedMiniProgram = await restartSharedMiniProgram()
    return await runAttempts(restartedMiniProgram, 'restart')
  }

  return null
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
