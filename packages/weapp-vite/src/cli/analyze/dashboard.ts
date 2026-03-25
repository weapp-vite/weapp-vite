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
const ANALYZE_DASHBOARD_PACKAGE_NAME = '@weapp-vite/dashboard'
const ANALYZE_SSE_PATH = '/__weapp_vite_analyze'
type PackageManagerAgent = Parameters<typeof resolveCommand>[0]
const require = createRequire(import.meta.url)

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
    devRoot?: string
    devConfigFile?: string
    distDir?: string
  }
}

function readDashboardManifest(packageJsonPath: string): DashboardPackageManifest | undefined {
  try {
    return parseCommentJson(fs.readFileSync(packageJsonPath, 'utf8')) as DashboardPackageManifest
  }
  catch {
    return undefined
  }
}

function resolveDashboardSourceRoot(packageRoot: string, manifest: DashboardPackageManifest | undefined): ResolvedDashboardRoot | undefined {
  const devRoot = manifest?.weappViteDashboard?.devRoot ?? '.'
  const devConfigFile = manifest?.weappViteDashboard?.devConfigFile ?? 'vite.config.ts'
  const resolvedRoot = path.resolve(packageRoot, devRoot)
  const viteConfigPath = path.resolve(packageRoot, devConfigFile)
  const srcRoot = path.join(resolvedRoot, 'src')
  if (!fs.existsSync(viteConfigPath) || !fs.existsSync(srcRoot)) {
    return undefined
  }
  return {
    root: resolvedRoot,
    configFile: viteConfigPath,
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
    if (options?.watch) {
      const sourceResolved = resolveDashboardSourceRoot(dashboardPackageRoot, dashboardManifest)
      if (sourceResolved) {
        return sourceResolved
      }
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

function createAnalyzeHtmlPlugin(
  state: { current: AnalyzeSubpackagesResult },
  onServerInstance: (server: ViteDevServer) => void,
  onBroadcastReady: (broadcast: (payload: AnalyzeSubpackagesResult) => void) => void,
): PluginOption {
  const sseClients = new Set<ServerResponse>()
  const hotBridgeScript = `
    const applyAnalyzePayload = (payload) => {
      window.${ANALYZE_GLOBAL_KEY} = payload
      window.dispatchEvent(new CustomEvent('weapp-analyze:update', { detail: payload }))
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
    }
  `.trim()

  const broadcast = (payload: AnalyzeSubpackagesResult) => {
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
        if (req.url !== ANALYZE_SSE_PATH) {
          next()
          return
        }

        res.statusCode = 200
        res.setHeader('Content-Type', 'text/event-stream')
        res.setHeader('Cache-Control', 'no-cache, no-transform')
        res.setHeader('Connection', 'keep-alive')
        res.write(`data: ${JSON.stringify(state.current)}\n\n`)
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
  update: (result: AnalyzeSubpackagesResult) => Promise<void>
  waitForExit: () => Promise<void>
  close: () => Promise<void>
  urls: string[]
}

export async function startAnalyzeDashboard(
  result: AnalyzeSubpackagesResult,
  options?: { watch?: boolean, cwd?: string, packageManagerAgent?: PackageManagerAgent, silentStartupLog?: boolean },
): Promise<AnalyzeDashboardHandle | void> {
  const resolved = resolveDashboardRoot(options)
  if (!resolved) {
    return
  }
  const { root, configFile } = resolved

  const state = { current: result }
  let serverRef: ViteDevServer | undefined
  let broadcastAnalyzeResult: ((payload: AnalyzeSubpackagesResult) => void) | undefined

  const plugins: PluginOption[] = [
    createAnalyzeHtmlPlugin(
      state,
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
      data: state.current,
    })
  }
  broadcastAnalyzeResult?.(state.current)

  const handle: AnalyzeDashboardHandle = {
    async update(nextResult) {
      state.current = nextResult
      if (serverRef) {
        serverRef.ws.send({
          type: 'custom',
          event: 'weapp-analyze:update',
          data: nextResult,
        })
      }
      broadcastAnalyzeResult?.(nextResult)
    },
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
