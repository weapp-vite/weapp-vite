import type { PluginOption, ViteDevServer } from 'vite'
import type { AnalyzeSubpackagesResult } from '../../analyze/subpackages'
import fs from 'node:fs'
import { createRequire } from 'node:module'
import process from 'node:process'
import { resolveCommand } from 'package-manager-detector/commands'
import path from 'pathe'
import { createServer } from 'vite'
import logger, { colors } from '../../logger'

const ANALYZE_GLOBAL_KEY = '__WEAPP_VITE_ANALYZE_RESULT__'
const ANALYZE_DASHBOARD_PACKAGE_NAME = '@weapp-vite/dashboard'
type PackageManagerAgent = Parameters<typeof resolveCommand>[0]
const require = createRequire(import.meta.url)

function createInstallCommand(agent: PackageManagerAgent | undefined) {
  const resolved = resolveCommand(agent ?? 'npm', 'install', [ANALYZE_DASHBOARD_PACKAGE_NAME])
  if (!resolved) {
    return `npm install ${ANALYZE_DASHBOARD_PACKAGE_NAME}`
  }
  return `${resolved.command} ${resolved.args.join(' ')}`
}

function resolveDashboardRoot(options?: { cwd?: string, packageManagerAgent?: PackageManagerAgent }) {
  const resolvePaths = options?.cwd && options.cwd !== process.cwd()
    ? [options.cwd, process.cwd()]
    : options?.cwd
      ? [options.cwd]
      : undefined

  let dashboardRoot: string | undefined
  try {
    const dashboardPackageJsonPath = require.resolve(`${ANALYZE_DASHBOARD_PACKAGE_NAME}/package.json`, {
      paths: resolvePaths,
    })
    dashboardRoot = path.resolve(path.dirname(dashboardPackageJsonPath), 'dist')
  }
  catch {
    dashboardRoot = undefined
  }

  if (dashboardRoot && fs.existsSync(dashboardRoot)) {
    return {
      root: dashboardRoot,
    }
  }

  const workspaceFallbackRoots = [
    path.resolve(import.meta.dirname, '../../../../dashboard/dist'),
    path.resolve(import.meta.dirname, '../../dashboard/dist'),
  ]

  for (const candidate of workspaceFallbackRoots) {
    if (fs.existsSync(candidate)) {
      return {
        root: candidate,
      }
    }
  }

  logger.warn(`[weapp-vite ui] 未安装可选仪表盘包 ${colors.bold(colors.green(ANALYZE_DASHBOARD_PACKAGE_NAME))}，已自动降级关闭 dashboard 能力。`)
  logger.info(`如需启用，请执行 ${colors.bold(colors.green(createInstallCommand(options?.packageManagerAgent)))}`)
  return undefined
}

function createAnalyzeHtmlPlugin(
  state: { current: AnalyzeSubpackagesResult },
  onServerInstance: (server: ViteDevServer) => void,
): PluginOption {
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
        ],
      }
    },
    configureServer(server) {
      onServerInstance(server)
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
  options?: { watch?: boolean, cwd?: string, packageManagerAgent?: PackageManagerAgent },
): Promise<AnalyzeDashboardHandle | void> {
  const resolved = resolveDashboardRoot(options)
  if (!resolved) {
    return
  }
  const { root } = resolved

  const state = { current: result }
  let serverRef: ViteDevServer | undefined

  const plugins: PluginOption[] = [
    createAnalyzeHtmlPlugin(state, (server) => {
      serverRef = server
    }),
  ]

  const server = await createServer({
    root,
    clearScreen: false,
    appType: 'spa',
    publicDir: false,
    plugins,
    server: {
      host: '127.0.0.1',
      port: 0,
    },
    logLevel: 'error',
  })

  await server.listen()
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
    },
    waitForExit: () => waitPromise,
    close: async () => {
      await server.close()
    },
    urls,
  }

  if (options?.watch) {
    logger.info('weapp-vite UI 已启动（分析视图，实时模式），按 Ctrl+C 退出。')
    for (const url of handle.urls) {
      logger.info(`weapp-vite UI：${url}`)
    }
    void waitPromise // 允许异步清理
    return handle
  }

  logger.info('weapp-vite UI 已启动（分析视图，静态模式），按 Ctrl+C 退出。')
  for (const url of handle.urls) {
    logger.info(`weapp-vite UI：${url}`)
  }
  await waitPromise
}
