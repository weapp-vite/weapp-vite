import type { CAC } from 'cac'
import type { GlobalCLIOptions } from '../../types'
import { createDevShutdownScope } from '../../../devLifecycle/shutdown'
import logger from '../../../logger'
import { startServeCommand } from './startup'

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
    .option('--ide-open-strategy <strategy>', '[string] IDE open strategy (cli | automator)', { default: 'cli' })
    .option('--login-retry <mode>', '[string] login retry mode for Wechat DevTools (never | once | always)')
    .option('--login-retry-timeout <ms>', '[number] login retry prompt timeout in milliseconds')
    .option('--non-interactive', '[boolean] fail immediately when Wechat DevTools login has expired')
    .option('--no-open-recovery', '[boolean] disable automatic target-project open retry (preserves existing IDE windows)')
    .option('--mcp', '[boolean] auto start MCP service during dev')
    .option('--no-mcp', '[boolean] disable MCP service during dev')
    .option('--host [host]', `[string] web dev server host`)
    .option('--ui', `[boolean] 启动调试 UI（当前提供分析视图）`, { default: false })
    .option('--ui-host <host>', `[string] 启动调试 UI 并选择宿主（standalone | hub）`)
    .option('--analyze', `[boolean] 启动分包分析仪表盘 (实验特性)`, { default: false })
    .option('--scope <scope>', `[string] 局部构建范围，例如 main,packages/order`)
    .action(async (root: string, options: GlobalCLIOptions) => {
      const shutdown = createDevShutdownScope({ reportError: error => logger.error(error) })
      let failure: unknown
      try {
        const started = await shutdown.run('startup', () => startServeCommand(root, options, shutdown))
        if (started?.waitForExit) {
          await Promise.race([shutdown.signal, started.waitForExit()])
        }
        else if (started?.watch) {
          await shutdown.signal
        }
      }
      catch (error) {
        failure = error
      }
      await shutdown.close(failure)
    })
}
