import type { CAC } from 'cac'
import type { GlobalCLIOptions } from '../types'
import process from 'node:process'
import { detectAiDevelopmentEnvironment } from '../../aiEnvironment'
import logger from '../../logger'
import { readLatestHmrProfileSummary } from '../hmrProfileSummary'
import { maybeStartDetachedMcpServer } from '../mcpDetached'
import { applyMcpCliOptions } from '../mcpOptions'
import { openIde, resolveIdeCommandContext, resolveIdeProjectRoot } from '../openIde'
import { filterDuplicateOptions, resolveConfigFile } from '../options'
import { resolveRuntimeTargets } from '../runtime'

export function registerOpenCommand(cli: CAC) {
  cli
    .command('open [root]')
    .option('-p, --platform <platform>', `[string] target platform (weapp | web)`)
    .option('--trust-project', '[boolean] auto trust Wechat DevTools project on open', { default: true })
    .option('--login-retry <mode>', '[string] login retry mode for Wechat DevTools (never | once | always)')
    .option('--login-retry-timeout <ms>', '[number] login retry prompt timeout in milliseconds')
    .option('--non-interactive', '[boolean] fail immediately when Wechat DevTools login has expired')
    .option('--mcp', '[boolean] auto start MCP service before opening IDE')
    .option('--no-mcp', '[boolean] disable MCP service before opening IDE')
    .action(async (root: string | undefined, options: GlobalCLIOptions) => {
      filterDuplicateOptions(options)
      const configFile = resolveConfigFile(options)
      const targets = resolveRuntimeTargets(options)
      const { cwd, platform, projectPath, mpDistRoot, weappViteConfig } = await resolveIdeCommandContext({
        configFile,
        mode: options.mode ?? 'development',
        platform: targets.platform,
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
        trustProject: options.trustProject,
      })
    })
}
