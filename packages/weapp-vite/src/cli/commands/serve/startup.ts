import type { ViteDevServer } from 'vite'
import type { DevShutdownScope } from '../../../devLifecycle/shutdown'
import type { AnalyzeDashboardHandle } from '../../analyze/dashboard'
import type { GlobalCLIOptions } from '../../types'
import process from 'node:process'
import { detectAiDevelopmentEnvironment } from '../../../aiEnvironment'
import { getBackendForCapability } from '../../../backends'
import { createCompilerContext } from '../../../createContext'
import logger from '../../../logger'
import { startAnalyzeDashboard } from '../../analyze/dashboard'
import { startDevHotkeys } from '../../devHotkeys'
import { formatDuration } from '../../formatDuration'
import { closeActiveForwardConsole } from '../../forwardConsole'
import { logBuildAppFinish } from '../../logBuildAppFinish'
import { applyMcpCliOptions } from '../../mcpOptions'
import { setCommandNodeEnv } from '../../nodeEnv'
import { filterDuplicateOptions, isUiEnabled, resolveConfigFile } from '../../options'
import { createInlineConfig, logRuntimeTarget, resolveConfiguredRuntimeTargets, resolveRuntimeTargets } from '../../runtime'
import { createServeDevelopmentActions } from './actions'
import { createAnalyzeController } from './analyze'
import { resolveWebHost } from './shared'

/** 启动阶段只取得资源；退出协调器负责等待在途操作并统一释放。 */
export async function startServeCommand(root: string, options: GlobalCLIOptions, shutdown: DevShutdownScope) {
  if (shutdown.stopping) {
    return
  }
  filterDuplicateOptions(options)
  setCommandNodeEnv('development')
  const cwd = root ?? process.cwd()
  const configFile = resolveConfigFile(options)
  let targets = resolveRuntimeTargets(options)
  const host = resolveWebHost(options.host)
  const inlineConfig = createInlineConfig(targets, {
    scope: options.scope,
    host,
    inlineConfig: host === undefined ? undefined : { server: { host } },
  })
  const ctx = await createCompilerContext({
    cwd,
    mode: options.mode ?? 'development',
    isDev: true,
    configFile,
    inlineConfig,
    cliPlatform: targets.rawPlatform,
    preloadAppEntry: false,
    syncAutoImportSupportFiles: false,
    projectConfigPath: options.projectConfig,
  })
  const { configService } = ctx
  targets = resolveConfiguredRuntimeTargets(targets, configService.options?.sourceConfig?.weapp?.platform)
  for (const backend of targets.select('dev')) {
    shutdown.own(() => backend.driver.close(ctx))
  }
  if (shutdown.stopping) {
    return
  }
  const webBackend = getBackendForCapability(targets, 'web', 'dev')
  const miniBackend = getBackendForCapability(targets, 'miniprogram', 'dev')
  const aiEnvironment = await detectAiDevelopmentEnvironment()
  if (shutdown.stopping) {
    return
  }
  const mcpConfig = applyMcpCliOptions(configService.weappViteConfig?.mcp, options)
  logRuntimeTarget(targets, { resolvedConfigPlatform: configService.platform })
  const enableAnalyze = Boolean(isUiEnabled(options) && miniBackend)
  let analyzeHandle: AnalyzeDashboardHandle | undefined
  const miniProgramDevActions = createServeDevelopmentActions(ctx, miniBackend, options, shutdown)
  const devHotkeysSession = miniBackend
    ? startDevHotkeys({
        cwd: configService.cwd,
        agentName: aiEnvironment.agentName,
        isAgent: aiEnvironment.isAgent,
        mcpConfig,
        openIde: async () => await miniProgramDevActions.openIde({
          forceOpen: true,
          forceReopen: true,
        }),
        platform: configService.platform,
        projectPath: miniProgramDevActions.projectPath ?? configService.cwd,
        rebuild: miniProgramDevActions.rebuild,
        silentStartupHint: true,
        weappViteConfig: configService.weappViteConfig,
      })
    : undefined
  shutdown.own(() => devHotkeysSession?.close())
  shutdown.own(closeActiveForwardConsole)
  shutdown.own(() => analyzeHandle?.close())
  const analyzeController = createAnalyzeController({
    configFile,
    ctx,
    options,
    targets,
    shutdown,
  })

  let webServer: ViteDevServer | undefined
  for (const backend of targets.select('dev')) {
    if (shutdown.stopping) {
      return
    }
    if (backend.descriptor.id === 'miniprogram') {
      const miniBuildStartedAt = Date.now()
      const buildResult = await backend.driver.dev(ctx, options)
      if (shutdown.stopping) {
        return
      }
      const miniBuildDurationMs = Date.now() - miniBuildStartedAt
      logger.success(`小程序初次构建完成，耗时：${formatDuration(miniBuildDurationMs)}`)
      void shutdown.run('startup', async () => {
        await ctx.autoImportService?.syncSupportFileResolverComponents().catch((error) => {
          const message = error instanceof Error ? error.message : String(error)
          logger.warn(`[prepare] 后台同步 .weapp-vite 支持文件失败：${message}`)
        })
      })

      if (enableAnalyze) {
        await analyzeController.startDashboard(startAnalyzeDashboard)
        analyzeHandle = analyzeController.getHandle()
        if (shutdown.stopping) {
          return
        }
        analyzeController.emitRuntimeEvents([
          {
            kind: 'build',
            level: 'success',
            title: 'mini initial build completed',
            detail: '小程序开发态初次构建已完成，dashboard 可继续监听后续刷新。',
            durationMs: miniBuildDurationMs,
            tags: ['dev', 'mini', 'initial'],
          },
        ])
        const watcherControl = analyzeController.bindWatcher(buildResult)
        await watcherControl.runInitialUpdate()
        if (shutdown.stopping) {
          return
        }
      }
      continue
    }

    if (backend.descriptor.id !== 'web') {
      continue
    }
    const webServerStartedAt = Date.now()
    try {
      webServer = await backend.driver.dev(ctx, options) as ViteDevServer | undefined
      if (shutdown.stopping) {
        return
      }
      logger.success(`Web 开发服务启动完成，耗时：${formatDuration(Date.now() - webServerStartedAt)}`)
      analyzeController.emitRuntimeEvents([
        {
          kind: 'system',
          level: 'success',
          title: 'web dev server started',
          detail: 'Web 开发服务器已启动，可与小程序调试 UI 并行工作。',
          durationMs: Date.now() - webServerStartedAt,
          tags: ['dev', 'web'],
        },
      ])
    }
    catch (error) {
      analyzeController.emitRuntimeEvents([
        {
          kind: 'diagnostic',
          level: 'error',
          title: 'web dev server failed',
          detail: error instanceof Error ? error.message : String(error),
          durationMs: Date.now() - webServerStartedAt,
          tags: ['dev', 'web'],
        },
      ])
      logger.error(error)
      throw error
    }
  }
  if (shutdown.stopping) {
    return
  }
  if (miniBackend) {
    logBuildAppFinish(configService, webServer, {
      skipWeb: !webBackend,
      uiUrls: analyzeHandle?.urls,
    })
    devHotkeysSession?.restore()
  }
  else if (webBackend) {
    logBuildAppFinish(configService, webServer, { skipMini: true })
  }
  if (options.open && getBackendForCapability(targets, 'miniprogram', 'ide')) {
    analyzeController.emitRuntimeEvents([
      {
        kind: 'command',
        level: 'info',
        title: 'opening ide',
        detail: '开发服务已就绪，准备打开 IDE 项目。',
        tags: ['ide', 'open'],
      },
    ])
    devHotkeysSession?.suspend()
    try {
      await miniProgramDevActions.openIde({
        forceOpen: true,
        forceReopen: false,
        openStrategy: options.ideOpenStrategy ?? 'cli',
      })
    }
    finally {
      devHotkeysSession?.restore()
    }
  }

  return {
    watch: targets.has('dev'),
    waitForExit: analyzeHandle ? () => analyzeController.waitForExit() : undefined,
  }
}
