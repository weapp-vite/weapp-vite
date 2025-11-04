import type { PluginOption, ViteDevServer } from 'vite'
import type { AnalyzeSubpackagesResult } from '../../analyze/subpackages'
import { dirname, resolve } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import fs from 'fs-extra'
import { createServer } from 'vite'
import logger from '../../logger'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const PACKAGE_ROOT = resolve(__dirname, '../../..')
const BUILD_DASHBOARD_ROOT = resolve(PACKAGE_ROOT, 'modules/analyze-dashboard')

const ANALYZE_GLOBAL_KEY = '__WEAPP_VITE_ANALYZE_RESULT__'

function resolveDashboardRoot() {
  if (fs.existsSync(BUILD_DASHBOARD_ROOT)) {
    return {
      root: BUILD_DASHBOARD_ROOT,
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
  logger.info('分析仪表盘已启动（使用预构建资源），按 Ctrl+C 退出。')

  const waitPromise = waitForServerExit(server)

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
  }

  if (options?.watch) {
    void waitPromise
    return handle
  }

  await waitPromise
}
