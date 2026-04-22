import type { CAC } from 'cac'
import type { ViteDevServer } from 'vite'
import type { AnalyzeDashboardHandle } from '../../analyze/dashboard'
import type { GlobalCLIOptions } from '../../types'
import { createCompilerContext } from '../../../createContext'
import logger from '../../../logger'
import { startAnalyzeDashboard } from '../../analyze/dashboard'
import { startDevHotkeys } from '../../devHotkeys'
import { formatDuration } from '../../formatDuration'
import { maybeStartForwardConsole } from '../../forwardConsole'
import { logBuildAppFinish } from '../../logBuildAppFinish'
import { openIde, resolveIdeProjectRoot } from '../../openIde'
import { filterDuplicateOptions, isUiEnabled, resolveConfigFile } from '../../options'
import { createInlineConfig, logRuntimeTarget, resolveRuntimeTargets } from '../../runtime'
import { createAnalyzeController } from './analyze'
import { createServeMiniProgramDevActions, resolveWebHost, waitForServeShutdownSignal } from './shared'

export function registerServeCommand(cli: CAC) {
  cli
    .command('[root]', 'start dev server') // 默认命令
    .alias('serve') // 与 Vite API 的命令名保持一致
    .alias('dev') // 与脚本名对齐的别名
    .option('--skipNpm', `[boolean] if skip npm build`)
    .option('-o, --open', `[boolean] open ide`)
    .option('-p, --platform <platform>', `[string] target platform (weapp | h5 | all)`)
    .option('--project-config <path>', `[string] project config path (miniprogram only)`)
    .option('--trust-project', '[boolean] auto trust Wechat DevTools project on open', { default: true })
    .option('--host [host]', `[string] web dev server host`)
    .option('--ui', `[boolean] 启动调试 UI（当前提供分析视图）`, { default: false })
    .option('--analyze', `[boolean] 启动分包分析仪表盘 (实验特性)`, { default: false })
    .action(async (root: string, options: GlobalCLIOptions) => {
      filterDuplicateOptions(options)
      const configFile = resolveConfigFile(options)
      const targets = resolveRuntimeTargets(options)
      let inlineConfig = createInlineConfig(targets.mpPlatform)
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
        cwd: root,
        mode: options.mode ?? 'development',
        isDev: true,
        configFile,
        inlineConfig,
        cliPlatform: targets.rawPlatform,
        projectConfigPath: options.projectConfig,
      })
      const { buildService, configService, webService } = ctx
      logRuntimeTarget(targets, { resolvedConfigPlatform: configService.platform })
      const enableAnalyze = Boolean(isUiEnabled(options) && targets.runMini)
      let analyzeHandle: AnalyzeDashboardHandle | undefined
      const miniProgramDevActions = createServeMiniProgramDevActions({
        build: async () => {
          await buildService.build(options)
        },
        fallbackProjectPath: configService.cwd,
        openIde: async (projectPath) => {
          await openIde(configService.platform, projectPath, {
            reuseOpenedProject: false,
            trustProject: options.trustProject,
          })
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
            mcpConfig: configService.weappViteConfig?.mcp,
            openIde: miniProgramDevActions.openIde,
            platform: configService.platform,
            projectPath: miniProgramDevActions.projectPath ?? configService.cwd,
            rebuild: miniProgramDevActions.rebuild,
            silentStartupHint: true,
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
          logger.success(`小程序初次构建完成，耗时：${formatDuration(Date.now() - miniBuildStartedAt)}`)

          if (enableAnalyze) {
            await analyzeController.startDashboard(startAnalyzeDashboard)
            analyzeHandle = analyzeController.getHandle()
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
          await miniProgramDevActions.openIde()
          devHotkeysSession?.restore()
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
