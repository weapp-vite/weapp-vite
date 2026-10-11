import type { CAC } from 'cac'
import type { GlobalCLIOptions } from '../../types'

export async function runIdeCommand(action: string | undefined, root: string | undefined, options: GlobalCLIOptions) {
  const { runIdeCommand } = await import('./action')
  return runIdeCommand(action, root, options)
}

/**
 * @description 注册 IDE 相关子命令。
 */
export function registerIdeCommand(cli: CAC) {
  cli
    .command('ide [action] [root]', 'run Wechat DevTools utility actions and log bridge commands')
    .option('-o, --open', '[boolean] open ide before attaching log bridge')
    .option('-p, --platform <platform>', '[string] target platform (weapp | web)')
    .option('--project-config <path>', '[string] project config path (miniprogram only)')
    .option('--json', '[boolean] output the doctor report as JSON')
    .option('--ticket <value>', '[string] ticket used by `ide ticket:set`')
    .option('--trust-project', '[boolean] auto trust Wechat DevTools project on open', { default: true })
    .option('--ide-open-strategy <strategy>', '[string] IDE open strategy (cli | automator)', { default: 'cli' })
    .option('--strict', '[boolean] fail when doctor finds blocking environment errors')
    .option('--no-open-recovery', '[boolean] disable automatic target-project open retry (preserves existing IDE windows)')
    .action(async (action: string | undefined, root: string | undefined, options: GlobalCLIOptions) => {
      await runIdeCommand(action, root, options)
    })
}
