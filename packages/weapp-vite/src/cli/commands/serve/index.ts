import type { CAC } from 'cac'
import type { ViteDevServer } from 'vite'
import type { AnalyzeDashboardHandle } from '../../analyze/dashboard'
import type { GlobalCLIOptions } from '../../types'
import process from 'node:process'
import { detectAiDevelopmentEnvironment } from '../../../aiEnvironment'
import { createCompilerContext } from '../../../createContext'
import logger from '../../../logger'
import { startAnalyzeDashboard } from '../../analyze/dashboard'
import { startDevHotkeys } from '../../devHotkeys'
import { formatDuration } from '../../formatDuration'
import { maybeStartForwardConsole } from '../../forwardConsole'
import { logBuildAppFinish } from '../../logBuildAppFinish'
import { applyMcpCliOptions } from '../../mcpOptions'
import { openIde, resolveIdeProjectRoot } from '../../openIde'
import { filterDuplicateOptions, isUiEnabled, resolveConfigFile } from '../../options'
import { createInlineConfig, logRuntimeTarget, resolveRuntimeTargets } from '../../runtime'
import { createAnalyzeController } from './analyze'
import { createServeMiniProgramDevActions, resolveWebHost, waitForServeShutdownSignal } from './shared'

function writePostOpenSeparator() {
  process.stdout?.write?.('\n')
}

export function registerServeCommand(cli: CAC) {
  cli
    .command('[root]', 'start dev server') // 默认命令
    .alias('serve') // 与 Vite API 的命令名保持一致
    .alias('dev') // 与脚本名对齐的别名
    .option('--skipNpm', `[boolean] if skip npm build`)
    .option('-o, --open', `[boolean] open ide`)
    .option('-p, --platform <platform>', `[string] target platform (weapp | web | all)`)
    .option('--project-config <path>', `[string] project config path (miniprogram only)`)
    .option('--trust-project', '[boolean] auto trust Wechat DevTools project on open', { default: true })
    .option('--login-retry <mode>', '[string] login retry mode for Wechat DevTools (never | once | always)')
    .option('--login-retry-timeout <ms>', '[number] login retry prompt timeout in milliseconds')
    .option('--non-interactive', '[boolean] fail immediately when Wechat DevTools login has expired')
    .option('--no-open-recovery', '[boolean] disable automatic Wechat DevTools close-and-reopen recovery')
    .option('--mcp', '[boolean] auto start MCP service during dev')
    .option('--no-mcp', '[boolean] disable MCP service during dev')
    .option('--host [host]', `[string] web dev server host`)
    .option('--ui', `[boolean] 启动调试 UI（当前提供分析视图）`, { default: false })
    .option('--analyze', `[boolean] 启动分包分析仪表盘 (实验特性)`, { default: false })
    .option('--scope <scope>', `[string] 局部构建范围，例如 main,packages/order`)
    .action(async (root: string, options: GlobalCLIOptions) => {
      filterDuplicateOptions(options)
      const cwd = root ?? process.cwd()
      const configFile = resolveConfigFile(options)
      const targets = resolveRuntimeTargets(options)
      let inlineConfig = createInlineConfig(targets.platform, options.scope)
      if (targets.runWeb) {
        const host = resolveWebHost(options.host)
        if (host !== undefined) {
          inlineConfig = {
            ...inlineConfig,
            server: {
              ...(inlineConfig?.server ?? {}),
              host,
            },
          }
        }
        if (targets.runMini) {
          const existingServer = inlineConfig?.server ?? {}
          inlineConfig = {
            ...inlineConfig,
            build: {
              ...(inlineConfig?.build ?? {}),
              watch: typeof inlineConfig?.build?.watch === 'object' && inlineConfig.build.watch
                ? { ...inlineConfig.build.watch }
                : {},
            },
            server: {
              ...existingServer,
              ...(existingServer.port === undefined ? { port: 0 } : {}),
              watch: {
                ...(existingServer.watch ?? {}),
                usePolling: true,
                interval: 100,
              },
            },
          }
        }
      }
      const ctx = await createCompilerContext({
        cwd,
        mode: options.mode ?? 'development',
        isDev: true,
        configFile,
        inlineConfig,
        cliPlatform: targets.rawPlatform,
        preloadAppEntry: false,
        projectConfigPath: options.projectConfig,
      })
      const { buildService, configService, webService } = ctx
      const aiEnvironment = await detectAiDevelopmentEnvironment()
      const mcpConfig = applyMcpCliOptions(configService.weappViteConfig?.mcp, options)
      logRuntimeTarget(targets, { resolvedConfigPlatform: configService.platform })
      const enableAnalyze = Boolean(isUiEnabled(options) && targets.runMini)
      let analyzeHandle: AnalyzeDashboardHandle | undefined
      const miniProgramDevActions = createServeMiniProgramDevActions({
        build: async () => {
          await buildService.build(options)
        },
        fallbackProjectPath: configService.cwd,
        openIde: async (projectPath, openOptions) => {
          await openIde(configService.platform, projectPath, {
            loginRetry: options.loginRetry,
            loginRetryTimeout: options.loginRetryTimeout,
            nonInteractive: options.nonInteractive,
            openRecovery: false,
            prepareAutomatorSession: openOptions?.forceReopen ? true : 'connect-opened',
            reuseOpenedProject: !openOptions?.forceReopen,
            skipAutomatorCompile: !openOptions?.forceReopen,
            skipPostOpenHealthCheck: true,
            trustProject: options.trustProject,
            useAutomatorOpen: true,
          })
          writePostOpenSeparator()
        },
        projectPath: resolveIdeProjectRoot(configService.mpDistRoot, configService.cwd),
        tryReuseForwardConsole: async () => {
          return await maybeStartForwardConsole({
            platform: configService.platform,
            mpDistRoot: configService.mpDistRoot,
            cwd: configService.cwd,
            weappViteConfig: configService.weappViteConfig,
          })
        },
      })
      const devHotkeysSession = targets.runMini
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
      try {
        const analyzeController = createAnalyzeController({
          configFile,
          ctx,
          options,
          targets,
        })

        if (targets.runMini) {
          const miniBuildStartedAt = Date.now()
          const buildResult = await buildService.build(options)
          const miniBuildDurationMs = Date.now() - miniBuildStartedAt
          logger.success(`小程序初次构建完成，耗时：${formatDuration(miniBuildDurationMs)}`)

          if (enableAnalyze) {
            await analyzeController.startDashboard(startAnalyzeDashboard)
            analyzeHandle = analyzeController.getHandle()
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
          }
        }
        let webServer: ViteDevServer | undefined
        if (targets.runWeb) {
          const webServerStartedAt = Date.now()
          try {
            webServer = await webService?.startDevServer()
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
        if (targets.runMini) {
          logBuildAppFinish(configService, webServer, {
            skipWeb: !targets.runWeb,
            uiUrls: analyzeHandle?.urls,
          })
          devHotkeysSession?.restore()
        }
        else if (targets.runWeb) {
          logBuildAppFinish(configService, webServer, { skipMini: true })
        }
        if (options.open && targets.runMini) {
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
            })
          }
          finally {
            devHotkeysSession?.restore()
          }
        }

        if (analyzeHandle) {
          await analyzeController.waitForExit()
        }
        else if (targets.runMini || targets.runWeb) {
          await waitForServeShutdownSignal()
        }
      }
      finally {
        devHotkeysSession?.close()
        ctx.watcherService?.closeAll()
      }
    })
}
