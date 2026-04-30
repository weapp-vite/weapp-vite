import type { ServerResponse } from 'node:http'
import type { PluginOption, ViteDevServer } from 'vite'
import type { AnalyzeSubpackagesResult } from '../../analyze/subpackages'
import fs from 'node:fs'
import { createRequire } from 'node:module'
import process from 'node:process'
import { resolveCommand } from 'package-manager-detector/commands'
import path from 'pathe'
import { createServer } from 'vite'
import logger, { colors } from '../../logger'
import { parseCommentJson } from '../../utils'

const ANALYZE_GLOBAL_KEY = '__WEAPP_VITE_ANALYZE_RESULT__'
const PREVIOUS_ANALYZE_GLOBAL_KEY = '__WEAPP_VITE_PREVIOUS_ANALYZE_RESULT__'
const DASHBOARD_EVENTS_GLOBAL_KEY = '__WEAPP_VITE_DASHBOARD_EVENTS__'
const ANALYZE_DASHBOARD_PACKAGE_NAME = '@weapp-vite/dashboard'
const ANALYZE_SSE_PATH = '/__weapp_vite_analyze'
const FILE_CONTENT_PATH = '/__weapp_vite_file_content'
const DASHBOARD_EVENT_NAME = 'weapp-dashboard:event'
const MAX_FILE_CONTENT_BYTES = 2 * 1024 * 1024
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
}

export interface DashboardRuntimeEventInput {
  kind: DashboardRuntimeEventKind
  level: DashboardRuntimeEventLevel
  title: string
  detail: string
  source?: string
  durationMs?: number
  tags?: string[]
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

interface DashboardContentRoots {
  artifactRoot?: string
  sourceRoot?: string
}

interface DashboardContentAllowlist {
  artifactPaths: Set<string>
  sourcePaths: Set<string>
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

function normalizeDashboardRelativePath(value: string) {
  return value.replaceAll('\\', '/')
}

function stripDashboardFileQuery(value: string) {
  const queryIndex = value.indexOf('?')
  return queryIndex === -1 ? value : value.slice(0, queryIndex)
}

function addDashboardAllowedPath(paths: Set<string>, value: string | undefined) {
  if (!value || value.includes('\0')) {
    return
  }
  const normalizedPath = normalizeDashboardRelativePath(stripDashboardFileQuery(value))
  if (!normalizedPath || path.isAbsolute(normalizedPath)) {
    return
  }
  paths.add(normalizedPath)
}

function createDashboardContentAllowlist(result: AnalyzeSubpackagesResult): DashboardContentAllowlist {
  const artifactPaths = new Set<string>()
  const sourcePaths = new Set<string>()

  for (const packageReport of result.packages) {
    for (const file of packageReport.files) {
      addDashboardAllowedPath(artifactPaths, file.file)
      addDashboardAllowedPath(sourcePaths, file.source)
      for (const module of file.modules ?? []) {
        addDashboardAllowedPath(sourcePaths, module.source)
      }
    }
  }

  return {
    artifactPaths,
    sourcePaths,
  }
}

function resolveDashboardContentPath(
  root: string | undefined,
  requestPath: string | null,
  options: { allowParent?: boolean, allowedPaths: Set<string> },
) {
  if (!root || !requestPath || requestPath.includes('\0')) {
    return undefined
  }

  const normalizedRequestPath = normalizeDashboardRelativePath(stripDashboardFileQuery(requestPath))
  if (path.isAbsolute(normalizedRequestPath)) {
    return undefined
  }
  if (!options.allowedPaths.has(normalizedRequestPath)) {
    return undefined
  }

  const resolvedRoot = path.resolve(root)
  const absolutePath = path.resolve(resolvedRoot, normalizedRequestPath)
  const relativePath = path.relative(resolvedRoot, absolutePath)

  if (!relativePath) {
    return undefined
  }
  if (!options.allowParent && (relativePath.startsWith('..') || path.isAbsolute(relativePath))) {
    return undefined
  }

  return {
    absolutePath,
    relativePath: options.allowParent
      ? normalizedRequestPath
      : normalizeDashboardRelativePath(relativePath),
  }
}

function resolveDashboardFileLanguage(filePath: string) {
  const extension = path.extname(filePath).toLowerCase()
  if (extension === '.js' || extension === '.mjs' || extension === '.cjs' || extension === '.wxs' || extension === '.sjs') {
    return 'javascript'
  }
  if (extension === '.ts' || extension === '.mts' || extension === '.cts') {
    return 'typescript'
  }
  if (extension === '.json' || extension === '.map') {
    return 'json'
  }
  if (extension === '.css' || extension === '.wxss' || extension === '.scss' || extension === '.sass' || extension === '.less') {
    return 'css'
  }
  if (extension === '.vue' || extension === '.wxml' || extension === '.html') {
    return 'html'
  }
  return 'plaintext'
}

function sendDashboardJson(res: ServerResponse, statusCode: number, payload: unknown) {
  res.statusCode = statusCode
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.end(JSON.stringify(payload))
}

async function sendDashboardFileContent(
  res: ServerResponse,
  roots: DashboardContentRoots,
  allowlist: DashboardContentAllowlist,
  kind: string | null,
  requestPath: string | null,
) {
  const root = kind === 'artifact'
    ? roots.artifactRoot
    : kind === 'source'
      ? roots.sourceRoot
      : undefined
  const resolved = resolveDashboardContentPath(root, requestPath, {
    allowParent: kind === 'source',
    allowedPaths: kind === 'artifact'
      ? allowlist.artifactPaths
      : allowlist.sourcePaths,
  })

  if (!resolved || (kind !== 'source' && kind !== 'artifact')) {
    sendDashboardJson(res, 400, {
      error: 'invalid_request',
      message: '必须传入合法的 kind 和相对路径。',
    })
    return
  }

  try {
    const stat = await fs.promises.stat(resolved.absolutePath)
    if (!stat.isFile()) {
      sendDashboardJson(res, 400, {
        error: 'not_file',
        message: '目标路径不是文件。',
      })
      return
    }
    if (stat.size > MAX_FILE_CONTENT_BYTES) {
      sendDashboardJson(res, 413, {
        error: 'file_too_large',
        message: `文件超过 ${MAX_FILE_CONTENT_BYTES} 字节，已拒绝读取。`,
      })
      return
    }

    sendDashboardJson(res, 200, {
      kind,
      path: resolved.relativePath,
      language: resolveDashboardFileLanguage(resolved.relativePath),
      size: stat.size,
      content: await fs.promises.readFile(resolved.absolutePath, 'utf8'),
    })
  }
  catch (error) {
    const code = typeof error === 'object' && error && 'code' in error
      ? String((error as { code?: unknown }).code)
      : ''
    sendDashboardJson(res, code === 'ENOENT' ? 404 : 500, {
      error: code === 'ENOENT' ? 'not_found' : 'read_failed',
      message: code === 'ENOENT' ? '文件不存在。' : '读取文件失败。',
    })
  }
}

function createAnalyzeHtmlPlugin(
  state: { current: AnalyzeSubpackagesResult, previous: AnalyzeSubpackagesResult | null },
  runtimeEvents: { current: DashboardRuntimeEvent[] },
  contentRoots: DashboardContentRoots,
  contentAllowlist: { current: DashboardContentAllowlist },
  onServerInstance: (server: ViteDevServer) => void,
  onBroadcastReady: (broadcast: (payload: { current: AnalyzeSubpackagesResult, previous: AnalyzeSubpackagesResult | null }) => void) => void,
): PluginOption {
  const sseClients = new Set<ServerResponse>()
  const hotBridgeScript = `
    const applyAnalyzePayload = (payload) => {
      const current = payload?.current ?? payload
      const previous = payload?.previous ?? window.${PREVIOUS_ANALYZE_GLOBAL_KEY} ?? null
      window.${ANALYZE_GLOBAL_KEY} = current
      window.${PREVIOUS_ANALYZE_GLOBAL_KEY} = previous
      window.dispatchEvent(new CustomEvent('weapp-analyze:update', { detail: { current, previous } }))
    }
    const applyDashboardEvents = (payload) => {
      const events = Array.isArray(payload) ? payload : [payload]
      const nextEvents = events.filter(Boolean)
      if (nextEvents.length === 0) {
        return
      }
      window.${DASHBOARD_EVENTS_GLOBAL_KEY} = [
        ...(window.${DASHBOARD_EVENTS_GLOBAL_KEY} ?? []),
        ...nextEvents,
      ]
      window.dispatchEvent(new CustomEvent('${DASHBOARD_EVENT_NAME}', { detail: nextEvents }))
    }
    const source = new EventSource('${ANALYZE_SSE_PATH}')
    source.onmessage = (event) => {
      try {
        applyAnalyzePayload(JSON.parse(event.data))
      }
      catch {}
    }
    if (import.meta.hot) {
      import.meta.hot.on('weapp-analyze:update', (payload) => {
        applyAnalyzePayload(payload)
      })
      import.meta.hot.on('${DASHBOARD_EVENT_NAME}', (payload) => {
        applyDashboardEvents(payload)
      })
    }
  `.trim()

  const broadcast = (payload: { current: AnalyzeSubpackagesResult, previous: AnalyzeSubpackagesResult | null }) => {
    const serialized = `data: ${JSON.stringify(payload)}\n\n`
    for (const client of sseClients) {
      client.write(serialized)
    }
  }

  onBroadcastReady(broadcast)

  return {
    name: 'weapp-vite-analyze-html',
    transformIndexHtml(html: string) {
      return {
        html,
        tags: [
          {
            tag: 'script',
            children: `window.${ANALYZE_GLOBAL_KEY} = ${JSON.stringify(state.current)}`,
            injectTo: 'head-prepend',
          },
          {
            tag: 'script',
            children: `window.${PREVIOUS_ANALYZE_GLOBAL_KEY} = ${JSON.stringify(state.previous)}`,
            injectTo: 'head-prepend',
          },
          {
            tag: 'script',
            children: `window.${DASHBOARD_EVENTS_GLOBAL_KEY} = ${JSON.stringify(runtimeEvents.current)}`,
            injectTo: 'head-prepend',
          },
          {
            tag: 'script',
            attrs: {
              type: 'module',
              src: '/@vite/client',
            },
            injectTo: 'head',
          },
          {
            tag: 'script',
            attrs: {
              type: 'module',
            },
            children: hotBridgeScript,
            injectTo: 'body',
          },
        ],
      }
    },
    configureServer(server) {
      onServerInstance(server)
      server.middlewares.use((req, res, next) => {
        const url = new URL(req.url ?? '/', 'http://127.0.0.1')
        if (url.pathname === FILE_CONTENT_PATH) {
          void sendDashboardFileContent(
            res,
            contentRoots,
            contentAllowlist.current,
            url.searchParams.get('kind'),
            url.searchParams.get('path'),
          )
          return
        }

        if (url.pathname !== ANALYZE_SSE_PATH) {
          next()
          return
        }

        res.statusCode = 200
        res.setHeader('Content-Type', 'text/event-stream')
        res.setHeader('Cache-Control', 'no-cache, no-transform')
        res.setHeader('Connection', 'keep-alive')
        res.write(`data: ${JSON.stringify(state)}\n\n`)
        sseClients.add(res)

        req.on('close', () => {
          sseClients.delete(res)
        })
      })
    },
  }
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
  const contentAllowlist = { current: createDashboardContentAllowlist(result) }
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
  let serverRef: ViteDevServer | undefined
  let broadcastAnalyzeResult: ((payload: { current: AnalyzeSubpackagesResult, previous: AnalyzeSubpackagesResult | null }) => void) | undefined

  const plugins: PluginOption[] = [
    createAnalyzeHtmlPlugin(
      state,
      runtimeEvents,
      {
        artifactRoot: options?.artifactRoot ?? (options?.cwd ? path.resolve(options.cwd, 'dist') : undefined),
        sourceRoot: options?.cwd,
      },
      contentAllowlist,
      (server) => {
        serverRef = server
      },
      (broadcast) => {
        broadcastAnalyzeResult = broadcast
      },
    ),
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
  serverRef ??= server
  server.printUrls()
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

  const waitPromise = waitForServerExit(server)

  if (serverRef?.ws) {
    serverRef.ws.send({
      type: 'custom',
      event: 'weapp-analyze:update',
      data: state,
    })
    serverRef.ws.send({
      type: 'custom',
      event: DASHBOARD_EVENT_NAME,
      data: runtimeEvents.current,
    })
  }
  broadcastAnalyzeResult?.(state)

  const emitRuntimeEvents = (events: DashboardRuntimeEventInput[]) => {
    if (events.length === 0) {
      return
    }

    const nextEvents = events.map(event => createDashboardRuntimeEvent(event))
    runtimeEvents.current = [...nextEvents, ...runtimeEvents.current].slice(0, 24)

    if (serverRef) {
      serverRef.ws.send({
        type: 'custom',
        event: DASHBOARD_EVENT_NAME,
        data: nextEvents,
      })
    }
  }

  const handle: AnalyzeDashboardHandle = {
    async update(nextResult, previousResult) {
      state.previous = previousResult ?? state.current
      state.current = nextResult
      contentAllowlist.current = createDashboardContentAllowlist(nextResult)
      emitRuntimeEvents([
        {
          kind: 'build',
          level: 'info',
          title: 'analyze payload refreshed',
          detail: `已推送新的 analyze 结果，当前包含 ${nextResult.packages.length} 个包与 ${nextResult.modules.length} 个模块。`,
          tags: ['analyze', 'refresh'],
        },
      ])
      if (serverRef) {
        serverRef.ws.send({
          type: 'custom',
          event: 'weapp-analyze:update',
          data: state,
        })
      }
      broadcastAnalyzeResult?.(state)
    },
    emitRuntimeEvents,
    waitForExit: () => waitPromise,
    close: async () => {
      await server.close()
    },
    urls,
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
