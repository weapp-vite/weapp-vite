import type { CAC } from 'cac'
import type { RolldownWatcher } from 'rolldown'
import type { ViteDevServer } from 'vite'
import type { AnalyzeDashboardHandle } from '../analyze/dashboard'
import type { GlobalCLIOptions } from '../types'
import { analyzeSubpackages } from '../../analyze/subpackages'
import { createCompilerContext } from '../../createContext'
import logger from '../../logger'
import { startAnalyzeDashboard } from '../analyze/dashboard'
import { maybeStartForwardConsole } from '../forwardConsole'
import { logBuildAppFinish } from '../logBuildAppFinish'
import { openIde, resolveIdeProjectRoot } from '../openIde'
import { filterDuplicateOptions, isUiEnabled, resolveConfigFile } from '../options'
import { createInlineConfig, logRuntimeTarget, resolveRuntimeTargets } from '../runtime'

function resolveWebHost(host: GlobalCLIOptions['host']) {
  if (host === undefined) {
    return undefined
  }
  if (typeof host === 'boolean') {
    return host
  }
  if (typeof host === 'string') {
    return host
  }
  return String(host)
}

export function registerServeCommand(cli: CAC) {
  cli
    .command('[root]', 'start dev server') // 默认命令
    .alias('serve') // 与 Vite API 的命令名保持一致
    .alias('dev') // 与脚本名对齐的别名
    .option('--skipNpm', `[boolean] if skip npm build`)
    .option('-o, --open', `[boolean] open ide`)
    .option('-p, --platform <platform>', `[string] target platform (weapp | h5 | all)`)
    .option('--project-config <path>', `[string] project config path (miniprogram only)`)
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
          const buildWatch = typeof inlineConfig?.build?.watch === 'object' && inlineConfig.build.watch
            ? inlineConfig.build.watch
            : {}
          const buildChokidar = 'chokidar' in buildWatch
            ? (buildWatch as { chokidar?: Record<string, unknown> }).chokidar
            : undefined
          const existingServer = inlineConfig?.server ?? {}
          inlineConfig = {
            ...inlineConfig,
            build: {
              ...(inlineConfig?.build ?? {}),
              watch: {
                ...buildWatch,
                chokidar: {
                  ...(buildChokidar ?? {}),
                  usePolling: true,
                  interval: 100,
                },
              },
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

      const runAnalyze = async () => analyzeSubpackages(ctx)

      const triggerAnalyzeUpdate = async () => {
        if (!analyzeHandle) {
          return
        }
        const next = await runAnalyze()
        await analyzeHandle.update(next)
      }

      if (targets.runMini) {
        const buildResult = await buildService.build(options)

        if (enableAnalyze) {
          const initialResult = await runAnalyze()
          analyzeHandle = await startAnalyzeDashboard(initialResult, {
            watch: true,
            cwd: configService.cwd,
            packageManagerAgent: configService.packageManager.agent,
            silentStartupLog: true,
          }) ?? undefined

          let updating = false
          if (analyzeHandle && buildResult && typeof (buildResult as RolldownWatcher).on === 'function') {
            const watcher = buildResult as RolldownWatcher
            watcher.on('event', (event) => {
              if (event.code !== 'END' || updating) {
                return
              }
              updating = true
              triggerAnalyzeUpdate().finally(() => {
                updating = false
              })
            })
          }
          if (analyzeHandle) {
            updating = true
            await triggerAnalyzeUpdate()
            updating = false
          }
        }
      }
      let webServer: ViteDevServer | undefined
      if (targets.runWeb) {
        try {
          webServer = await webService?.startDevServer()
        }
        catch (error) {
          logger.error(error)
          throw error
        }
      }
      if (targets.runMini) {
        logBuildAppFinish(configService, webServer, {
          skipWeb: !targets.runWeb,
          uiUrls: analyzeHandle?.urls,
        })
      }
      else if (targets.runWeb) {
        logBuildAppFinish(configService, webServer, { skipMini: true })
      }
      if (options.open && targets.runMini) {
        const openedByForwardConsole = await maybeStartForwardConsole({
          platform: configService.platform,
          mpDistRoot: configService.mpDistRoot,
          cwd: configService.cwd,
          weappViteConfig: configService.weappViteConfig,
        })
        if (!openedByForwardConsole) {
          await openIde(configService.platform, resolveIdeProjectRoot(configService.mpDistRoot, configService.cwd))
        }
      }

      if (analyzeHandle) {
        await analyzeHandle.waitForExit()
      }
    })
}
