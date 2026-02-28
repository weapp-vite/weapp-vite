import { parse as parseWeappIdeCli } from 'weapp-ide-cli'

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

const WEAPP_IDE_TOP_LEVEL_COMMANDS = new Set([
  'open',
  'login',
  'islogin',
  'preview',
  'auto-preview',
  'upload',
  'build-npm',
  'auto',
  'auto-replay',
  'reset-fileutils',
  'close',
  'quit',
  'cache',
  'engine',
  'open-other',
  'build-ipa',
  'build-apk',
  'cloud',
  'screenshot',
  'navigate',
  'redirect',
  'back',
  'relaunch',
  'switch-tab',
  'page-stack',
  'current-page',
  'system-info',
  'page-data',
  'tap',
  'input',
  'scroll',
  'audit',
  'remote',
  'config',
  'alipay',
  'ali',
  'minidev',
])

/**
 * @description 让 weapp-vite 复用 weapp-ide-cli 全量命令能力。
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

  if (command === 'help') {
    const target = argv[1]
    if (target && WEAPP_IDE_TOP_LEVEL_COMMANDS.has(target)) {
      await parseWeappIdeCli(argv)
      return true
    }
    return false
  }

  if (!WEAPP_IDE_TOP_LEVEL_COMMANDS.has(command)) {
    return false
  }

  if (WEAPP_VITE_NATIVE_COMMANDS.has(command)) {
    return false
  }

  await parseWeappIdeCli(argv)
  return true
}
