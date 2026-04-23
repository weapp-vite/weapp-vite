import type { CAC } from 'cac'
import type { GlobalCLIOptions } from '../types'
import process from 'node:process'
import {
  bootstrapWechatDevtoolsSettings,
  getWechatIdeTestAccounts,
  getWechatIdeTicket,
  getWechatIdeToolInfo,
  refreshWechatIdeTicket,
  setWechatIdeTicket,
} from 'weapp-ide-cli'
import logger from '../../logger'
import { resolveForwardConsoleOptions, startForwardConsoleBridge } from '../forwardConsole'
import { readLatestHmrProfileSummary } from '../hmrProfileSummary'
import { openIde, resolveIdeCommandContext } from '../openIde'
import { filterDuplicateOptions, resolveConfigFile } from '../options'
import { resolveRuntimeTargets } from '../runtime'

async function waitForTermination(cleanup: () => Promise<void>) {
  await new Promise<void>((resolve) => {
    const signals: NodeJS.Signals[] = ['SIGINT', 'SIGTERM']
    let cleaning = false
    const handlers = new Map<NodeJS.Signals, () => void>()

    const teardown = async () => {
      if (cleaning) {
        return
      }
      cleaning = true
      for (const signal of signals) {
        process.off(signal, handlers.get(signal)!)
      }
      await cleanup()
      resolve()
    }

    for (const signal of signals) {
      const handler = () => {
        void teardown()
      }
      handlers.set(signal, handler)
      process.on(signal, handler)
    }
  })
}

function formatIdeOutput(data: unknown, options: Pick<GlobalCLIOptions, 'json'>) {
  if (options.json) {
    return JSON.stringify(data, null, 2)
  }
  return JSON.stringify(data, null, 2)
}

/**
 * @description 执行 ide 子命令。
 */
export async function runIdeCommand(action: string | undefined, root: string | undefined, options: GlobalCLIOptions) {
  if (
    action !== 'logs'
    && action !== 'setup'
    && action !== 'info'
    && action !== 'test-accounts'
    && action !== 'ticket'
    && action !== 'ticket:set'
    && action !== 'ticket:refresh'
  ) {
    throw new Error(`未知 ide 子命令: ${action ?? '(empty)'}`)
  }
  filterDuplicateOptions(options)
  const configFile = resolveConfigFile(options)
  const targets = resolveRuntimeTargets(options)
  const resolved = await resolveIdeCommandContext({
    configFile,
    mode: options.mode ?? 'development',
    platform: targets.mpPlatform,
    projectPath: root,
    cliPlatform: targets.rawPlatform,
  })

  if (resolved.platform !== 'weapp') {
    throw new Error('`weapp-vite ide logs` 当前仅支持微信小程序平台。')
  }
  if (!resolved.projectPath) {
    throw new Error('无法解析微信开发者工具项目目录，请显式传入 root 或检查 project.config.json。')
  }

  if (action === 'setup') {
    const result = await bootstrapWechatDevtoolsSettings({
      projectPath: resolved.projectPath,
      trustProject: options.trustProject,
    })
    logger.info(`已完成微信开发者工具配置预热：扫描实例 ${result.touchedInstanceCount} 个，检测服务端口配置 ${result.detectedSecurityCount} 处，写入项目信任 ${result.trustedProjectCount} 处。`)
    return
  }

  if (options.open) {
    await openIde(resolved.platform, resolved.projectPath, {
      trustProject: options.trustProject,
    })
  }

  if (action === 'info') {
    const result = await getWechatIdeToolInfo({
      projectPath: resolved.projectPath,
    })
    logger.info(formatIdeOutput(result, options))
    return
  }

  if (action === 'test-accounts') {
    const result = await getWechatIdeTestAccounts({
      projectPath: resolved.projectPath,
    })
    logger.info(formatIdeOutput(result, options))
    return
  }

  if (action === 'ticket') {
    const result = await getWechatIdeTicket({
      projectPath: resolved.projectPath,
    })
    logger.info(formatIdeOutput(result, options))
    return
  }

  if (action === 'ticket:set') {
    if (!options.ticket) {
      throw new Error('`weapp-vite ide ticket:set` 需要提供 --ticket。')
    }
    await setWechatIdeTicket({
      projectPath: resolved.projectPath,
      ticket: options.ticket,
    })
    logger.info(`已设置微信开发者工具 ticket：${options.ticket}`)
    return
  }

  if (action === 'ticket:refresh') {
    await refreshWechatIdeTicket({
      projectPath: resolved.projectPath,
    })
    logger.info('已刷新微信开发者工具 ticket。')
    return
  }

  const forwardConsoleOptions = await resolveForwardConsoleOptions({
    ...resolved.weappViteConfig,
    forwardConsole: resolved.weappViteConfig?.forwardConsole === false
      ? { enabled: true }
      : {
          ...(typeof resolved.weappViteConfig?.forwardConsole === 'object' ? resolved.weappViteConfig.forwardConsole : {}),
          enabled: true,
        },
  })

  const latestHmrSummary = await readLatestHmrProfileSummary({
    cwd: resolved.cwd ?? process.cwd(),
    relativeCwd: value => resolved.cwd ? value.replace(`${resolved.cwd}/`, '') : value,
    weappViteConfig: resolved.weappViteConfig,
  })
  if (latestHmrSummary) {
    logger.info(latestHmrSummary.line)
  }

  const session = await startForwardConsoleBridge({
    projectPath: resolved.projectPath,
    agentName: undefined,
    logLevels: forwardConsoleOptions.logLevels,
    unhandledErrors: forwardConsoleOptions.unhandledErrors,
    onReadyMessage: '[forwardConsole] 已进入持续监听模式，按 Ctrl+C 退出。',
  })

  await waitForTermination(async () => {
    logger.info('[forwardConsole] 正在关闭日志桥接...')
    await session.close()
  })
}

/**
 * @description 注册 IDE 相关子命令。
 */
export function registerIdeCommand(cli: CAC) {
  cli
    .command('ide [action] [root]', 'run Wechat DevTools utility actions and log bridge commands')
    .option('-o, --open', '[boolean] open ide before attaching log bridge')
    .option('-p, --platform <platform>', '[string] target platform (weapp | h5)')
    .option('--project-config <path>', '[string] project config path (miniprogram only)')
    .option('--ticket <value>', '[string] ticket used by `ide ticket:set`')
    .option('--trust-project', '[boolean] auto trust Wechat DevTools project on open', { default: true })
    .action(async (action: string | undefined, root: string | undefined, options: GlobalCLIOptions) => {
      await runIdeCommand(action, root, options)
    })
}
