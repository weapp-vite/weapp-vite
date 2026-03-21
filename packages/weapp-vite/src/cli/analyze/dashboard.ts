import type { PluginOption, ViteDevServer } from 'vite'
import type { AnalyzeSubpackagesResult } from '../../analyze/subpackages'
import fs from 'node:fs'
import process from 'node:process'
import { getPackageInfoSync } from 'local-pkg'
import { resolveCommand } from 'package-manager-detector/commands'
import path from 'pathe'
import { createServer } from 'vite'
import logger, { colors } from '../../logger'

const ANALYZE_GLOBAL_KEY = '__WEAPP_VITE_ANALYZE_RESULT__'
const ANALYZE_DASHBOARD_PACKAGE_NAME = '@weapp-vite/dashboard'
type PackageManagerAgent = Parameters<typeof resolveCommand>[0]

function createInstallCommand(agent: PackageManagerAgent | undefined) {
  const resolved = resolveCommand(agent ?? 'npm', 'install', [ANALYZE_DASHBOARD_PACKAGE_NAME])
  if (!resolved) {
    return `npm install ${ANALYZE_DASHBOARD_PACKAGE_NAME}`
  }
  return `${resolved.command} ${resolved.args.join(' ')}`
}

function resolveDashboardRoot(options?: { cwd?: string, packageManagerAgent?: PackageManagerAgent }) {
  const packageInfo = getPackageInfoSync(ANALYZE_DASHBOARD_PACKAGE_NAME, {
    paths: options?.cwd ? [options.cwd] : undefined,
  })
  const dashboardRoot = packageInfo
    ? path.resolve(packageInfo.rootPath, 'dist')
    : undefined

  if (dashboardRoot && fs.existsSync(dashboardRoot)) {
    return {
      root: dashboardRoot,
    }
  }

  logger.warn(`[weapp-vite analyze] 未安装可选仪表盘包 ${colors.bold(colors.green(ANALYZE_DASHBOARD_PACKAGE_NAME))}，已自动降级关闭 dashboard 能力。`)
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
    logger.info('分析仪表盘已启动（实时模式），按 Ctrl+C 退出。')
    for (const url of handle.urls) {
      logger.info(`分包分析仪表盘：${url}`)
    }
    void waitPromise // 允许异步清理
    return handle
  }

  logger.info('分析仪表盘已启动（静态模式），按 Ctrl+C 退出。')
  for (const url of handle.urls) {
    logger.info(`分包分析仪表盘：${url}`)
  }
  await waitPromise
}
