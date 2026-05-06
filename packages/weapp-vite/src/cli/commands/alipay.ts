import type { CAC } from 'cac'
import type { GlobalCLIOptions } from '../types'
import path from 'pathe'
import logger from '../../logger'
import { resolveIdeCommandContext } from '../openIde'
import { filterDuplicateOptions, resolveConfigFile } from '../options'
import { spawnMinidev } from './alipayExecute'

type AlipayAction = 'ide' | 'login' | 'preview' | 'upload'

export interface RunMinidevCommandOptions extends GlobalCLIOptions {
  appId?: string
  clientType?: string
  minidev?: string
  project?: string
  version?: string
}

function normalizePassthroughArgs(args: unknown) {
  return Array.isArray(args)
    ? args.filter((arg): arg is string => typeof arg === 'string')
    : []
}

function appendOption(argv: string[], name: string, value: unknown) {
  if (typeof value === 'string' && value.trim()) {
    argv.push(name, value)
  }
}

function hasOption(argv: readonly string[], ...names: string[]) {
  return argv.some(arg => names.includes(arg) || names.some(name => arg.startsWith(`${name}=`)))
}

function normalizeAlipayAction(action: string | undefined): AlipayAction {
  if (action === 'open') {
    return 'ide'
  }
  if (action === 'ide' || action === 'login' || action === 'preview' || action === 'upload') {
    return action
  }
  throw new Error(`未知 alipay 子命令: ${action ?? '(empty)'}`)
}

function resolveProjectPath(root: string | undefined, resolvedProjectPath: string | undefined, options: RunMinidevCommandOptions) {
  if (typeof options.project === 'string' && options.project.trim()) {
    return options.project
  }
  return root ?? resolvedProjectPath
}

function resolveMinidevCommand(options: Pick<RunMinidevCommandOptions, 'minidev'>) {
  return typeof options.minidev === 'string' && options.minidev.trim()
    ? options.minidev
    : 'minidev'
}

export function createMinidevArgv(
  action: AlipayAction,
  root: string | undefined,
  resolvedProjectPath: string | undefined,
  options: RunMinidevCommandOptions,
) {
  const passthroughArgs = normalizePassthroughArgs(options['--'])
  const argv: string[] = [action]
  const projectPath = resolveProjectPath(root, resolvedProjectPath, options)

  if ((action === 'ide' || action === 'preview' || action === 'upload') && projectPath && !hasOption(passthroughArgs, '--project', '-p')) {
    argv.push('--project', path.normalize(projectPath))
  }
  if ((action === 'preview' || action === 'upload') && !hasOption(passthroughArgs, '--app-id', '-a')) {
    appendOption(argv, '--app-id', options.appId)
  }
  if ((action === 'login' || action === 'preview' || action === 'upload') && !hasOption(passthroughArgs, '--client-type', '-c')) {
    appendOption(argv, '--client-type', options.clientType)
  }
  if (action === 'upload' && !hasOption(passthroughArgs, '--version', '-v')) {
    appendOption(argv, '--version', options.version)
  }

  argv.push(...passthroughArgs)
  return argv
}

export async function runAlipayCommand(action: string | undefined, root: string | undefined, options: RunMinidevCommandOptions) {
  const normalizedAction = normalizeAlipayAction(action)

  filterDuplicateOptions(options)
  const configFile = resolveConfigFile(options)
  const resolved = await resolveIdeCommandContext({
    configFile,
    mode: options.mode ?? (normalizedAction === 'upload' ? 'production' : 'development'),
    platform: 'alipay',
    projectPath: root ?? options.project,
    cliPlatform: 'alipay',
  })
  const argv = createMinidevArgv(normalizedAction, root, resolved.projectPath, options)
  const command = resolveMinidevCommand(options)

  logger.info(`执行支付宝小程序 CLI：${command} ${argv.join(' ')}`)
  await spawnMinidev(command, argv)
}

export function registerAlipayCommand(cli: CAC) {
  cli
    .command('alipay [action] [root]', 'run Alipay minidev ide, login, preview, or upload')
    .option('-a, --app-id <appId>', '[string] Alipay mini program appId')
    .option('-c, --client-type <clientType>', '[string] minidev client type')
    .option('--minidev <command>', '[string] minidev executable path or command name')
    .option('--project <path>', '[string] Alipay mini program project path')
    .option('--version <version>', '[string] upload version')
    .allowUnknownOptions()
    .action(async (action: string | undefined, root: string | undefined, options: RunMinidevCommandOptions) => {
      await runAlipayCommand(action, root, options)
    })
}
