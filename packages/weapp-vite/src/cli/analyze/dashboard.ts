import type { PluginOption, ViteDevServer } from 'vite'
import type { AnalyzeSubpackagesResult } from '../../analyze/subpackages'
import process from 'node:process'
import fs from 'fs-extra'
import { createServer } from 'vite'
import logger from '../../logger'
import { ANALYZE_DASHBOARD_ROOT } from '../../packagePaths'

const ANALYZE_GLOBAL_KEY = '__WEAPP_VITE_ANALYZE_RESULT__'

function resolveDashboardRoot() {
  if (fs.existsSync(ANALYZE_DASHBOARD_ROOT)) {
    return {
      root: ANALYZE_DASHBOARD_ROOT,
    }
  }
  throw new Error(
    '[weapp-vite analyze] 未找到仪表盘产物，请先执行 `pnpm --filter weapp-vite run build:dashboard` 生成。',
  )
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
  options?: { watch?: boolean },
): Promise<AnalyzeDashboardHandle | void> {
  const { root } = resolveDashboardRoot()

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
