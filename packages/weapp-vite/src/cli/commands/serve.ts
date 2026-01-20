import type { CAC } from 'cac'
import type { RolldownWatcher } from 'rolldown'
import type { ViteDevServer } from 'vite'
import type { AnalyzeDashboardHandle } from '../analyze/dashboard'
import type { GlobalCLIOptions } from '../types'
import { analyzeSubpackages } from '../../analyze/subpackages'
import { createCompilerContext } from '../../createContext'
import logger from '../../logger'
import { startAnalyzeDashboard } from '../analyze/dashboard'
import { logBuildAppFinish } from '../logBuildAppFinish'
import { openIde } from '../openIde'
import { filterDuplicateOptions, resolveConfigFile } from '../options'
import { createInlineConfig, logRuntimeTarget, resolveRuntimeTargets } from '../runtime'

export function registerServeCommand(cli: CAC) {
  cli
    .command('[root]', 'start dev server') // 默认命令
    .alias('serve') // 与 Vite API 的命令名保持一致
    .alias('dev') // 与脚本名对齐的别名
    .option('--skipNpm', `[boolean] if skip npm build`)
    .option('-o, --open', `[boolean] open ide`)
    .option('-p, --platform <platform>', `[string] target platform (weapp | h5)`)
    .option('--host [host]', `[string] web dev server host`)
    .option('--analyze', `[boolean] 启动分包分析仪表盘 (实验特性)`, { default: false })
    .action(async (root: string, options: GlobalCLIOptions) => {
      filterDuplicateOptions(options)
      const configFile = resolveConfigFile(options)
      const targets = resolveRuntimeTargets(options)
      logRuntimeTarget(targets)
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
      }
      const ctx = await createCompilerContext({
        cwd: root,
        mode: options.mode ?? 'development',
        isDev: true,
        configFile,
        inlineConfig,
      })
      const { buildService, configService, webService } = ctx
      const enableAnalyze = Boolean(options.analyze && targets.runMini)
      let analyzeHandle: AnalyzeDashboardHandle | undefined

      const triggerAnalyzeUpdate = async () => {
        if (!analyzeHandle) {
          return
        }
        const next = await analyzeSubpackages(ctx)
        await analyzeHandle.update(next)
      }

      if (targets.runMini) {
        const buildResult = await buildService.build(options)

        if (enableAnalyze) {
          const initialResult = await analyzeSubpackages(ctx)
          analyzeHandle = await startAnalyzeDashboard(initialResult, { watch: true }) ?? undefined

          if (analyzeHandle && buildResult && typeof (buildResult as RolldownWatcher).on === 'function') {
            const watcher = buildResult as RolldownWatcher
            let updating = false
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
          else if (analyzeHandle) {
            await triggerAnalyzeUpdate()
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
        logBuildAppFinish(configService, webServer, { skipWeb: !targets.runWeb })
      }
      else if (targets.runWeb) {
        logBuildAppFinish(configService, webServer, { skipMini: true })
      }
      if (options.open && targets.runMini) {
        await openIde()
      }

      if (analyzeHandle) {
        await analyzeHandle.waitForExit()
      }
    })
}

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
