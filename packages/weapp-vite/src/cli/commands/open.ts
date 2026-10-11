import type { CAC } from 'cac'
import type { GlobalCLIOptions } from '../types'
import process from 'node:process'
import logger from '../../logger'
import { filterDuplicateOptions, resolveConfigFile } from '../options'

export function registerOpenCommand(cli: CAC) {
  cli
    .command('open [root]')
    .option('-p, --platform <platform>', `[string] target platform (weapp | web)`)
    .option('--trust-project', '[boolean] auto trust Wechat DevTools project on open', { default: true })
    .option('--ide-open-strategy <strategy>', '[string] IDE open strategy (cli | automator)', { default: 'cli' })
    .option('--login-retry <mode>', '[string] login retry mode for Wechat DevTools (never | once | always)')
    .option('--login-retry-timeout <ms>', '[number] login retry prompt timeout in milliseconds')
    .option('--non-interactive', '[boolean] fail immediately when Wechat DevTools login has expired')
    .option('--no-open-recovery', '[boolean] disable automatic target-project open retry (preserves existing IDE windows)')
    .option('--mcp', '[boolean] auto start MCP service before opening IDE')
    .option('--no-mcp', '[boolean] disable MCP service before opening IDE')
    .action(async (root: string | undefined, options: GlobalCLIOptions) => {
      const { withWechatDevtoolsSelection } = await import('weapp-ide-cli')
      const { detectAiDevelopmentEnvironment } = await import('../../aiEnvironment')
      const { getBackendForCapability } = await import('../../backends')
      const { readLatestHmrProfileSummary } = await import('../hmrProfileSummary')
      const { maybeStartDetachedMcpServer } = await import('../mcpDetached')
      const { applyMcpCliOptions } = await import('../mcpOptions')
      const { openIde, resolveIdeCommandContext, resolveIdeProjectRoot } = await import('../openIde')
      const { resolveRuntimeTargets } = await import('../runtime')
      filterDuplicateOptions(options)
      const configFile = resolveConfigFile(options)
      const targets = resolveRuntimeTargets(options)
      const ideBackend = getBackendForCapability(targets, 'miniprogram', 'ide')
      if (!ideBackend) {
        throw new Error('`weapp-vite open` 当前仅支持小程序平台。')
      }
      const { cwd, platform, projectPath, mpDistRoot, weappViteConfig } = await resolveIdeCommandContext({
        configFile,
        mode: options.mode ?? 'development',
        platform: ideBackend.platform as typeof targets.platform,
        projectPath: root,
        cliPlatform: targets.rawPlatform,
      })
      const latestHmrSummary = await readLatestHmrProfileSummary({
        cwd: cwd ?? process.cwd(),
        relativeCwd: value => cwd ? value.replace(`${cwd}/`, '') : value,
        weappViteConfig,
      })
      if (latestHmrSummary) {
        logger.info(latestHmrSummary.line)
      }
      const cwdForMcp = cwd ?? process.cwd()
      const aiEnvironment = await detectAiDevelopmentEnvironment()
      const openSelected = async () => {
        await maybeStartDetachedMcpServer({
          agentName: aiEnvironment.agentName,
          cwd: cwdForMcp,
          isAgent: aiEnvironment.isAgent,
          mcpConfig: applyMcpCliOptions(weappViteConfig?.mcp, options),
        })

        await openIde(platform, projectPath ?? resolveIdeProjectRoot(mpDistRoot, process.cwd()), {
          loginRetry: options.loginRetry,
          loginRetryTimeout: options.loginRetryTimeout,
          nonInteractive: options.nonInteractive,
          openRecovery: options.openRecovery,
          trustProject: options.trustProject,
          openStrategy: options.ideOpenStrategy,
        })
      }
      if (platform === 'weapp') {
        await withWechatDevtoolsSelection({}, openSelected)
      }
      else {
        await openSelected()
      }
    })
}
