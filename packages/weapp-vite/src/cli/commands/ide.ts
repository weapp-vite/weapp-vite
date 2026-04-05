import type { CAC } from 'cac'
import type { GlobalCLIOptions } from '../types'
import process from 'node:process'
import logger from '../../logger'
import { resolveForwardConsoleOptions, startForwardConsoleBridge } from '../forwardConsole'
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

/**
 * @description 执行 ide 子命令。
 */
export async function runIdeCommand(action: string | undefined, root: string | undefined, options: GlobalCLIOptions) {
  if (action !== 'logs') {
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

  if (options.open) {
    await openIde(resolved.platform, resolved.projectPath, {
      trustProject: options.trustProject,
    })
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
    .command('ide [action] [root]', 'forward Wechat DevTools console logs to terminal')
    .option('-o, --open', '[boolean] open ide before attaching log bridge')
    .option('-p, --platform <platform>', '[string] target platform (weapp | h5)')
    .option('--project-config <path>', '[string] project config path (miniprogram only)')
    .option('--trust-project', '[boolean] auto trust Wechat DevTools project on open', { default: true })
    .action(async (action: string | undefined, root: string | undefined, options: GlobalCLIOptions) => {
      await runIdeCommand(action, root, options)
    })
}
