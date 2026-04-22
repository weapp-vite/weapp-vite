import { dispatchWechatCliCommand, isWeappIdeTopLevelCommand } from 'weapp-ide-cli'
import { executeWechatIdeCliCommand } from './openIde/execute'

const WEAPP_VITE_NATIVE_COMMANDS = new Set([
  'dev',
  'serve',
  'build',
  'close',
  'analyze',
  'init',
  'open',
  'npm',
  'build:npm',
  'build-npm',
  'generate',
  'g',
  'mcp',
])

/**
 * @description 让 weapp-vite 在未命中自身命令时，回退到 weapp-ide-cli。
 */
export async function tryRunIdeCommand(argv: string[]) {
  const command = argv[0]
  if (!command) {
    return false
  }

  if (command === 'ide') {
    if (argv[1] === 'logs') {
      return false
    }
    const handledByHelper = await dispatchWechatCliCommand(argv.slice(1))
    if (!handledByHelper) {
      await executeWechatIdeCliCommand(argv.slice(1))
    }
    return true
  }

  if (command.startsWith('-')) {
    return false
  }

  if (command === 'help') {
    const target = argv[1]
    if (!target || WEAPP_VITE_NATIVE_COMMANDS.has(target) || !isWeappIdeTopLevelCommand(target)) {
      return false
    }
    await executeWechatIdeCliCommand(argv)
    return true
  }

  if (WEAPP_VITE_NATIVE_COMMANDS.has(command) || !isWeappIdeTopLevelCommand(command)) {
    return false
  }

  const handledByHelper = await dispatchWechatCliCommand(argv)
  if (!handledByHelper) {
    await executeWechatIdeCliCommand(argv)
  }
  return true
}
