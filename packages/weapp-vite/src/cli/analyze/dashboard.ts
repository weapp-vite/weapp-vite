import type { ViteDevServer } from 'vite'
import type { AnalyzeSubpackagesResult } from '../../analyze/subpackages'
import fs from 'node:fs'
import { createRequire } from 'node:module'
import process from 'node:process'
import { devframeViteBridge } from '@devframes/vite/single'
import { buildOtpAuthUrl, refreshTempAuthCode } from 'devframe/node/auth'
import { resolveCommand } from 'package-manager-detector/commands'
import path from 'pathe'
import { createServer } from 'vite'
import logger, { colors } from '../../logger'
import { parseCommentJson } from '../../utils'
import { createAnalyzeDashboardDevframe } from './dashboardDevframe'

const ANALYZE_DASHBOARD_PACKAGE_NAME = '@weapp-vite/dashboard'
type PackageManagerAgent = Parameters<typeof resolveCommand>[0]
const require = createRequire(import.meta.url)

type DashboardRuntimeEventKind = 'command' | 'build' | 'diagnostic' | 'hmr' | 'system'
type DashboardRuntimeEventLevel = 'info' | 'success' | 'warning' | 'error'

interface DashboardRuntimeEvent {
  id: string
  kind: DashboardRuntimeEventKind
  level: DashboardRuntimeEventLevel
  title: string
  detail: string
  timestamp: string
  source: string
  durationMs?: number
  tags?: string[]
  profile?: DashboardRuntimeEventProfile
}

export interface DashboardRuntimeEventProfile {
  timestamp?: string
  totalMs?: number
  eventId?: string
  event?: string
  file?: string
  relativeFile?: string
  sourceRootFile?: string
  buildCoreMs?: number
  buildStartMs?: number
  pluginResolveMs?: number
  transformMs?: number
  snapshotResolveMs?: number
  snapshotBuildMs?: number
  writeMs?: number
  watchToDirtyMs?: number
  emitMs?: number
  sharedChunkResolveMs?: number
  resolveCount?: number
  dirtyCount?: number
  pendingCount?: number
  emittedCount?: number
  dirtyReasonSummary?: string[]
  pendingReasonSummary?: string[]
}

export interface DashboardRuntimeEventInput {
  kind: DashboardRuntimeEventKind
  level: DashboardRuntimeEventLevel
  title: string
  detail: string
  source?: string
  durationMs?: number
  tags?: string[]
  profile?: DashboardRuntimeEventProfile
}

function createInstallCommand(agent: PackageManagerAgent | undefined) {
  const resolved = resolveCommand(agent ?? 'npm', 'install', [ANALYZE_DASHBOARD_PACKAGE_NAME])
  if (!resolved) {
    return `npm install ${ANALYZE_DASHBOARD_PACKAGE_NAME}`
  }
  return `${resolved.command} ${resolved.args.join(' ')}`
}

interface ResolvedDashboardRoot {
  root: string
  configFile?: string
}

interface DashboardPackageManifest {
  weappViteDashboard?: {
    devConfigFile?: string
    devRoot?: string
    distDir?: string
  }
}

function formatEventTimestamp(date = new Date()) {
  return date.toLocaleTimeString('zh-CN', { hour12: false })
}

function createDashboardRuntimeEvent(input: DashboardRuntimeEventInput) {
  return {
    id: `dashboard:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`,
    kind: input.kind,
    level: input.level,
    title: input.title,
    detail: input.detail,
    timestamp: formatEventTimestamp(),
    source: input.source ?? 'weapp-vite',
    durationMs: input.durationMs,
    tags: input.tags,
    profile: input.profile,
  } satisfies DashboardRuntimeEvent
}

function readDashboardManifest(packageJsonPath: string): DashboardPackageManifest | undefined {
  try {
    return parseCommentJson(fs.readFileSync(packageJsonPath, 'utf8')) as DashboardPackageManifest
  }
  catch {
    return undefined
  }
}

function resolveDashboardDistRoot(packageRoot: string, manifest: DashboardPackageManifest | undefined): ResolvedDashboardRoot | undefined {
  const distDir = manifest?.weappViteDashboard?.distDir ?? 'dist'
  const distRoot = path.resolve(packageRoot, distDir)
  if (!fs.existsSync(distRoot)) {
    return undefined
  }
  return {
    root: distRoot,
  }
}

function resolveDashboardDevRoot(packageRoot: string, manifest: DashboardPackageManifest | undefined): ResolvedDashboardRoot | undefined {
  const devRoot = manifest?.weappViteDashboard?.devRoot
  const devConfigFile = manifest?.weappViteDashboard?.devConfigFile

  if (!devRoot || !devConfigFile) {
    return undefined
  }

  const root = path.resolve(packageRoot, devRoot)
  const configFile = path.resolve(root, devConfigFile)

  if (!fs.existsSync(root) || !fs.existsSync(configFile)) {
    return undefined
  }

  return {
    root,
    configFile,
  }
}

function resolveDashboardRoot(options?: { cwd?: string, packageManagerAgent?: PackageManagerAgent, watch?: boolean }) {
  const resolvePaths = options?.cwd && options.cwd !== process.cwd()
    ? [options.cwd, process.cwd()]
    : options?.cwd
      ? [options.cwd]
      : undefined

  let dashboardPackageRoot: string | undefined
  let dashboardManifest: DashboardPackageManifest | undefined
  try {
    const dashboardPackageJsonPath = require.resolve(`${ANALYZE_DASHBOARD_PACKAGE_NAME}/package.json`, {
      paths: resolvePaths,
    })
    dashboardPackageRoot = path.dirname(dashboardPackageJsonPath)
    dashboardManifest = readDashboardManifest(dashboardPackageJsonPath)
  }
  catch {
    dashboardPackageRoot = undefined
    dashboardManifest = undefined
  }

  if (dashboardPackageRoot) {
    const devResolved = resolveDashboardDevRoot(dashboardPackageRoot, dashboardManifest)
    if (devResolved) {
      return devResolved
    }

    const distResolved = resolveDashboardDistRoot(dashboardPackageRoot, dashboardManifest)
    if (distResolved) {
      return distResolved
    }
  }

  logger.warn(`[weapp-vite ui] 未安装可选仪表盘包 ${colors.bold(colors.green(ANALYZE_DASHBOARD_PACKAGE_NAME))}，已自动降级关闭 dashboard 能力。`)
  logger.info(`如需启用，请执行 ${colors.bold(colors.green(createInstallCommand(options?.packageManagerAgent)))}`)
  return undefined
}

async function waitForServerExit(server: ViteDevServer) {
  let resolved = false

  const cleanup = async () => {
    if (resolved) {
      return
    }
    resolved = true
    try {
      await server.close()
    }
    catch (error) {
      logger.error(error)
    }
  }

  const signals: NodeJS.Signals[] = ['SIGINT', 'SIGTERM']

  await new Promise<void>((resolvePromise) => {
    const resolveOnce = async () => {
      await cleanup()
      signals.forEach((signal) => {
        process.removeListener(signal, resolveOnce)
      })
      resolvePromise()
    }

    signals.forEach((signal) => {
      process.once(signal, resolveOnce)
    })

    server.httpServer?.once('close', resolveOnce)
  })
}

export interface AnalyzeDashboardHandle {
  update: (result: AnalyzeSubpackagesResult, previousResult?: AnalyzeSubpackagesResult | null) => Promise<void>
  emitRuntimeEvents: (events: DashboardRuntimeEventInput[]) => void
  waitForExit: () => Promise<void>
  close: () => Promise<void>
  urls: string[]
}

export async function startAnalyzeDashboard(
  result: AnalyzeSubpackagesResult,
  options?: {
    artifactRoot?: string
    watch?: boolean
    cwd?: string
    packageManagerAgent?: PackageManagerAgent
    pluginRoot?: string
    srcRoot?: string
    silentStartupLog?: boolean
    initialEvents?: DashboardRuntimeEventInput[]
    previousResult?: AnalyzeSubpackagesResult | null
  },
): Promise<AnalyzeDashboardHandle | void> {
  const resolved = resolveDashboardRoot(options)
  if (!resolved) {
    return
  }
  const { root, configFile } = resolved

  const state = { current: result, previous: options?.previousResult ?? null }
  const runtimeEvents = {
    current: [
      createDashboardRuntimeEvent({
        kind: 'command',
        level: 'success',
        title: options?.watch ? 'dashboard watch session started' : 'dashboard static session started',
        detail: options?.watch
          ? 'weapp-vite UI 已进入实时分析模式，后续 analyze 结果会继续推送到 dashboard。'
          : 'weapp-vite UI 已进入静态分析模式，当前页面展示的是一次性分析结果。',
        tags: options?.watch ? ['watch', 'analyze'] : ['static', 'analyze'],
      }),
      ...(options?.initialEvents ?? []).map(event => createDashboardRuntimeEvent(event)),
    ],
  }
  const devframe = createAnalyzeDashboardDevframe({
    getAnalyzeSnapshot: () => state,
    getRuntimeEvents: () => runtimeEvents.current,
    roots: {
      artifactRoot: options?.artifactRoot ?? (options?.cwd ? path.resolve(options.cwd, 'dist') : undefined),
      pluginRoot: options?.pluginRoot,
      projectRoot: options?.cwd,
      srcRoot: options?.srcRoot ?? (options?.cwd ? path.resolve(options.cwd, 'src') : undefined),
    },
  })
  const plugins = [
    devframeViteBridge(devframe.definition, {
      base: '/__weapp-vite/',
      mcp: false,
    }),
  ]

  const serverOptions = {
    root,
    configFile: configFile ?? false,
    clearScreen: false,
    appType: 'spa',
    publicDir: false,
    plugins,
    server: {
      host: '127.0.0.1',
      port: 0,
      watch: {
        ignored: ['**/*'],
      },
    },
    logLevel: 'error',
  } satisfies Parameters<typeof createServer>[0]

  const server = await createServer(serverOptions)

  const requestedPort = typeof serverOptions.server?.port === 'number'
    ? serverOptions.server.port
    : undefined
  await server.listen(requestedPort)
  const urls = (() => {
    const resolved = server.resolvedUrls
    if (!resolved) {
      return []
    }
    return [
      ...(resolved.local ?? []),
      ...(resolved.network ?? []),
    ]
  })()
  const authCode = refreshTempAuthCode()
  const authenticatedUrls = urls.map(url => buildOtpAuthUrl(url, authCode))

  const waitPromise = waitForServerExit(server)

  const emitRuntimeEvents = (events: DashboardRuntimeEventInput[]) => {
    if (events.length === 0) {
      return
    }

    const nextEvents = events.map(event => createDashboardRuntimeEvent(event))
    runtimeEvents.current = [...nextEvents, ...runtimeEvents.current].slice(0, 24)

    devframe.syncRuntimeEvents()
  }

  const handle: AnalyzeDashboardHandle = {
    async update(nextResult, previousResult) {
      state.previous = previousResult ?? state.current
      state.current = nextResult
      emitRuntimeEvents([
        {
          kind: 'build',
          level: 'info',
          title: 'analyze payload refreshed',
          detail: `已推送新的 analyze 结果，当前包含 ${nextResult.packages.length} 个包与 ${nextResult.modules.length} 个模块。`,
          tags: ['analyze', 'refresh'],
        },
      ])
      devframe.notifyAnalyzeUpdate()
    },
    emitRuntimeEvents,
    waitForExit: () => waitPromise,
    close: async () => {
      await server.close()
    },
    urls: authenticatedUrls,
  }

  if (options?.watch) {
    if (!options.silentStartupLog) {
      logger.info('weapp-vite UI 已启动（分析视图，实时模式），按 Ctrl+C 退出。')
      for (const url of handle.urls) {
        logger.info(`  ➜  ${colors.bold(colors.cyan(url))}`)
      }
    }
    void waitPromise // 允许异步清理
    return handle
  }

  if (!options?.silentStartupLog) {
    logger.info('weapp-vite UI 已启动（分析视图，静态模式），按 Ctrl+C 退出。')
    for (const url of handle.urls) {
      logger.info(`  ➜  ${colors.bold(colors.cyan(url))}`)
    }
  }
  await waitPromise
}
