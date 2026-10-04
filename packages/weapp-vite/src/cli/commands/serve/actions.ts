import type { ResolvedPlatformBackend } from '../../../backends/types'
import type { CompilerContext } from '../../../context'
import type { DevShutdownScope } from '../../../devLifecycle/shutdown'
import type { GlobalCLIOptions } from '../../types'
import process from 'node:process'
import { maybeStartForwardConsole } from '../../forwardConsole'
import { openIde, resolveIdeProjectRoot } from '../../openIde'
import { createServeMiniProgramDevActions, resolveServeIdeOpenStrategy } from './shared'

/** 启动与热键共用动作，退出后不再创建新的 IDE 或日志消费者。 */
export function createServeDevelopmentActions(ctx: CompilerContext, miniBackend: ResolvedPlatformBackend | undefined, options: GlobalCLIOptions, shutdown: DevShutdownScope) {
  const { configService } = ctx
  const generatedProjectConfig = configService.multiPlatform.projectConfigs !== undefined
  return createServeMiniProgramDevActions({
    build: async () => {
      if (!shutdown.stopping) {
        await shutdown.run('startup', () => miniBackend?.driver.dev(ctx, options))
      }
    },
    fallbackProjectPath: configService.cwd,
    openIde: async (projectPath, openOptions) => {
      if (shutdown.stopping) {
        return
      }
      const forceReopen = openOptions?.forceReopen === true
      const openStrategy = resolveServeIdeOpenStrategy(openOptions, options.ideOpenStrategy)
      const useAutomatorOpen = openStrategy === 'automator'
      await openIde(configService.platform, projectPath, {
        loginRetry: options.loginRetry,
        loginRetryTimeout: options.loginRetryTimeout,
        nonInteractive: options.nonInteractive,
        openRecovery: false,
        prepareAutomatorSession: useAutomatorOpen,
        reuseOpenedProject: !forceReopen,
        skipAutomatorCompile: !forceReopen,
        skipPostOpenHealthCheck: true,
        trustProject: options.trustProject,
        openStrategy,
        useAutomatorOpen,
      })
      process.stdout?.write?.('\n')
    },
    projectPath: resolveIdeProjectRoot(configService.mpDistRoot, configService.cwd, generatedProjectConfig),
    startForwardConsole: async (openOptions) => {
      if (shutdown.stopping) {
        return false
      }
      if (resolveServeIdeOpenStrategy(openOptions, options.ideOpenStrategy) === 'automator') {
        // IDE 启动由 openIde 负责；日志消费者只能连接，不能再次启动或恢复项目。
        return await maybeStartForwardConsole({
          openedOnly: true,
          preferOpenedSession: true,
          platform: configService.platform,
          mpDistRoot: configService.mpDistRoot,
          cwd: configService.cwd,
          weappViteConfig: configService.weappViteConfig,
        })
      }
      return await maybeStartForwardConsole({
        platform: configService.platform,
        mpDistRoot: configService.mpDistRoot,
        cwd: configService.cwd,
        preferOpenedSession: false,
        recoverAutomatorSession: async () => {
          if (shutdown.stopping) {
            return
          }
          const projectPath = resolveIdeProjectRoot(configService.mpDistRoot, configService.cwd, generatedProjectConfig)
          await openIde(configService.platform, projectPath, {
            loginRetry: options.loginRetry,
            loginRetryTimeout: options.loginRetryTimeout,
            nonInteractive: options.nonInteractive,
            openRecovery: false,
            openStrategy: 'automator',
            prepareAutomatorSession: true,
            reuseOpenedProject: false,
            skipAutomatorCompile: false,
            skipPostOpenHealthCheck: true,
            trustProject: options.trustProject,
            useAutomatorOpen: true,
          })
        },
        weappViteConfig: configService.weappViteConfig,
      })
    },
    tryReuseForwardConsole: async () => {
      if (shutdown.stopping) {
        return false
      }
      return await maybeStartForwardConsole({
        openedOnly: true,
        platform: configService.platform,
        mpDistRoot: configService.mpDistRoot,
        cwd: configService.cwd,
        weappViteConfig: configService.weappViteConfig,
      })
    },
  })
}
