import { isWeappIdeTopLevelCommand, parse as parseWeappIdeCli } from 'weapp-ide-cli'

const WEAPP_VITE_NATIVE_COMMANDS = new Set([
  'dev',
  'serve',
  'build',
  'analyze',
  'init',
  'open',
  'npm',
  'build:npm',
  'build-npm',
  'generate',
  'g',
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
    await parseWeappIdeCli(argv.slice(1))
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
    await parseWeappIdeCli(argv)
    return true
  }

  if (WEAPP_VITE_NATIVE_COMMANDS.has(command) || !isWeappIdeTopLevelCommand(command)) {
    return false
  }

  await parseWeappIdeCli(argv)
  return true
}
