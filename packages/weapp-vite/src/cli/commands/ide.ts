import type { CAC } from 'cac'
import type { GlobalCLIOptions } from '../types'
import process from 'node:process'
import { startForwardConsole as startWechatForwardConsole } from 'weapp-ide-cli'
import logger from '../../logger'
import { resolveForwardConsoleOptions } from '../forwardConsole'
import { openIde, resolveIdeCommandContext } from '../openIde'
import { filterDuplicateOptions, resolveConfigFile } from '../options'
import { resolveRuntimeTargets } from '../runtime'

/**
 * @description 注册 IDE 相关子命令。
 */
export function registerIdeCommand(cli: CAC) {
  cli
    .command('ide [action] [root]', 'forward Wechat DevTools console logs to terminal')
    .option('-o, --open', '[boolean] open ide before attaching log bridge')
    .option('-p, --platform <platform>', '[string] target platform (weapp | h5)')
    .option('--project-config <path>', '[string] project config path (miniprogram only)')
    .action(async (action: string | undefined, root: string | undefined, options: GlobalCLIOptions) => {
      await runIdeCommand(action, root, options)
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
    await openIde(resolved.platform, resolved.projectPath)
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

  const session = await startWechatForwardConsole({
    projectPath: resolved.projectPath,
    logLevels: forwardConsoleOptions.logLevels,
    unhandledErrors: forwardConsoleOptions.unhandledErrors,
    onReady: () => {
      logger.info('[forwardConsole] 已进入持续监听模式，按 Ctrl+C 退出。')
    },
    onLog: (event) => {
      const line = `[mini:${event.level}] ${event.message}`
      if (event.level === 'error') {
        logger.error(line)
        return
      }
      if (event.level === 'warn') {
        logger.warn(line)
        return
      }
      if (event.level === 'info') {
        logger.info(line)
        return
      }
      logger.log(line)
    },
  })

  await waitForTermination(async () => {
    logger.info('[forwardConsole] 正在关闭日志桥接...')
    await session.close()
  })
}

async function waitForTermination(cleanup: () => Promise<void>) {
  await new Promise<void>((resolve) => {
    const signals: NodeJS.Signals[] = ['SIGINT', 'SIGTERM']
    let cleaning = false

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

    const handlers = new Map<NodeJS.Signals, () => void>()
    for (const signal of signals) {
      const handler = () => {
        void teardown()
      }
      handlers.set(signal, handler)
      process.on(signal, handler)
    }
  })
}
