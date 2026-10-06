import type { ViteDevServer } from 'vite'
import type { AnalyzeSubpackagesResult } from '../../analyze/subpackages'
import type { AnalyzeDashboardDevframeController, DashboardArtifactFiles, DashboardRuntimeEventInput } from '../../dashboard'
import type { DashboardUiHost } from '../types'
import process from 'node:process'
import { buildOtpAuthUrl, refreshTempAuthCode } from 'devframe/node/auth'
import { resolveCommand } from 'package-manager-detector/commands'
import path from 'pathe'
import { createAnalyzeDashboardDevframe } from '../../dashboard'
import { ANALYZE_DASHBOARD_PACKAGE_NAME, resolveDashboardRoot } from '../../dashboard/assets'
import { getDevServerCloseRecord, replaceDevServerClose } from '../../devLifecycle/server'
import { getDevShutdownScope } from '../../devLifecycle/shutdown'
import { createDevViteServer } from '../../devLifecycle/vite'
import logger, { colors } from '../../logger'

type PackageManagerAgent = Parameters<typeof resolveCommand>[0]

function createInstallCommand(agent: PackageManagerAgent | undefined) {
  const resolved = resolveCommand(agent ?? 'npm', 'install', [ANALYZE_DASHBOARD_PACKAGE_NAME])
  if (!resolved) {
    return `npm install ${ANALYZE_DASHBOARD_PACKAGE_NAME}`
  }
  return `${resolved.command} ${resolved.args.join(' ')}`
}

export interface AnalyzeDashboardHandle extends Pick<AnalyzeDashboardDevframeController, 'update' | 'emitRuntimeEvents'> {
  waitForExit: () => Promise<void>
  close: () => Promise<void>
  urls: string[]
}

export async function startAnalyzeDashboard(
  result: AnalyzeSubpackagesResult,
  options: {
    artifacts: DashboardArtifactFiles
    uiHost?: DashboardUiHost
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
  const shutdown = getDevShutdownScope()
  const resolved = resolveDashboardRoot(options)
  if (!resolved) {
    logger.warn(`[weapp-vite ui] 未安装可选仪表盘包 ${colors.bold(colors.green(ANALYZE_DASHBOARD_PACKAGE_NAME))}，已自动降级关闭 dashboard 能力。`)
    logger.info(`如需启用，请执行 ${colors.bold(colors.green(createInstallCommand(options.packageManagerAgent)))}`)
    return
  }
  const { root, configFile } = resolved
  // 可选面板缺失时必须在加载传输前返回，静态导入会破坏这个 CLI 加载边界。
  const { ANALYZE_DASHBOARD_DEVFRAME_BASE, ANALYZE_DASHBOARD_HUB_BASE, createAnalyzeDashboardViteBridge } = await import('./dashboardViteBridge')
  const devframe = createAnalyzeDashboardDevframe({
    clientAssets: options.uiHost === 'hub' ? root : undefined,
    snapshot: { current: result, previous: options.previousResult ?? null, artifacts: options.artifacts },
    initialEvents: [
      {
        kind: 'command',
        level: 'success',
        title: options.watch ? 'dashboard watch session started' : 'dashboard static session started',
        detail: options.watch
          ? 'weapp-vite UI 已进入实时分析模式，后续 analyze 结果会继续推送到 dashboard。'
          : 'weapp-vite UI 已进入静态分析模式，当前页面展示的是一次性分析结果。',
        tags: options.watch ? ['watch', 'analyze'] : ['static', 'analyze'],
      },
      ...(options.initialEvents ?? []),
    ],
    roots: {
      pluginRoot: options.pluginRoot,
      projectRoot: options.cwd,
      srcRoot: options.srcRoot ?? (options.cwd ? path.resolve(options.cwd, 'src') : undefined),
    },
  })
  const bridge = createAnalyzeDashboardViteBridge(devframe, {
    projectRoot: options.cwd ?? process.cwd(),
    uiHost: options.uiHost,
  })

  let server: ViteDevServer | undefined
  let onHostClose: (() => void) | undefined
  const closeResources = async () => {
    const results = await Promise.allSettled([
      Promise.resolve().then(() => devframe.dispose()),
      Promise.resolve().then(() => bridge.close()),
      Promise.resolve().then(() => shutdown
        ? shutdown.run('cleanup', () => server?.close())
        : server?.close()),
    ])
    return results.filter(result => result.status === 'rejected').map(result => result.reason)
  }
  try {
    server = await createDevViteServer({
      root,
      base: ANALYZE_DASHBOARD_DEVFRAME_BASE,
      configFile: configFile ?? false,
      clearScreen: false,
      appType: 'spa',
      publicDir: false,
      plugins: [
        {
          name: 'weapp-vite:dashboard-lifetime',
          enforce: 'pre',
          configureServer(createdServer) {
            // Vite 原生重启更新稳定宿主；失败候选不能覆盖它的关闭入口或结束等待。
            server ??= createdServer
            const record = getDevServerCloseRecord(createdServer)
            const close = record.close
            replaceDevServerClose(createdServer, async () => {
              try {
                await close()
              }
              finally {
                if (server && getDevServerCloseRecord(server) === record) {
                  onHostClose?.()
                }
              }
            })
          },
        },
        bridge,
      ],
      server: {
        host: '127.0.0.1',
        port: 0,
        watch: { ignored: ['**/*'] },
      },
      logLevel: 'error',
    })
    if (!shutdown?.stopping) {
      await server.listen(0)
    }
  }
  catch (error) {
    const cleanupErrors = await closeResources()
    if (cleanupErrors.length) {
      throw new AggregateError([error, ...cleanupErrors], 'Dashboard 启动及资源清理失败', { cause: error })
    }
    throw error
  }

  const activeServer = server
  const urls = [
    ...(activeServer.resolvedUrls?.local ?? []),
    ...(activeServer.resolvedUrls?.network ?? []),
  ]
  const authCode = refreshTempAuthCode()
  const authenticatedUrls = urls.map((url) => {
    const entryUrl = options.uiHost === 'hub' ? new URL(ANALYZE_DASHBOARD_HUB_BASE, url).href : url
    return buildOtpAuthUrl(entryUrl, authCode)
  })
  let closing: Promise<void> | undefined
  let resolveExit!: () => void
  const waitPromise = new Promise<void>((resolve) => {
    resolveExit = resolve
  })
  const signals: NodeJS.Signals[] = ['SIGINT', 'SIGTERM']
  let onExit: () => Promise<void>
  let releaseOwnership: (() => void) | undefined
  const finish = () => {
    for (const signal of signals) {
      process.removeListener(signal, onExit)
    }
    releaseOwnership?.()
    resolveExit()
  }
  onHostClose = () => {
    // 主动关闭仍需等待 controller 清理；原生重启不会触发此通知。
    if (!closing) {
      finish()
    }
  }
  const close = () => {
    if (!closing) {
      closing = closeResources().then((errors) => {
        if (errors.length === 1) {
          throw errors[0]
        }
        if (errors.length > 1) {
          throw new AggregateError(errors, 'Dashboard 资源清理失败')
        }
      }).finally(finish)
    }
    return closing
  }
  onExit = async () => {
    await close().catch(error => logger.error(error))
  }
  if (!shutdown) {
    for (const signal of signals) {
      process.once(signal, onExit)
    }
  }

  const handle: AnalyzeDashboardHandle = {
    update: devframe.update,
    emitRuntimeEvents: devframe.emitRuntimeEvents,
    waitForExit: () => waitPromise,
    close,
    urls: authenticatedUrls,
  }
  releaseOwnership = shutdown?.own(close)
  if (shutdown?.stopping) {
    await close()
    return
  }

  if (options.watch) {
    if (!options.silentStartupLog) {
      logger.info('weapp-vite UI 已启动（分析视图，实时模式），按 Ctrl+C 退出。')
      for (const url of handle.urls) {
        logger.info(`  ➜  ${colors.bold(colors.cyan(url))}`)
      }
    }
    return handle
  }

  if (!options.silentStartupLog) {
    logger.info('weapp-vite UI 已启动（分析视图，静态模式），按 Ctrl+C 退出。')
    for (const url of handle.urls) {
      logger.info(`  ➜  ${colors.bold(colors.cyan(url))}`)
    }
  }
  await waitPromise
}
