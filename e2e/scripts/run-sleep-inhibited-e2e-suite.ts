/* eslint-disable e18e/ban-dependencies -- E2E runner 需要跨平台透传子进程退出码和 stdio。 */
import path from 'node:path'
import process from 'node:process'
import { pathToFileURL } from 'node:url'
import { execa } from 'execa'

const E2E_SUITE_RUNNER_PATH = path.resolve(import.meta.dirname, 'run-e2e-suite.ts')

export interface SleepInhibitedCommand {
  command: string
  args: string[]
}

export function createSleepInhibitedE2ECommand(
  args: readonly string[],
  platform: NodeJS.Platform = process.platform,
  nodePath = process.execPath,
): SleepInhibitedCommand {
  const runnerArgs = [
    '--import',
    'tsx',
    E2E_SUITE_RUNNER_PATH,
    ...args,
  ]

  if (platform === 'darwin') {
    return {
      command: 'caffeinate',
      args: ['-dimsu', '--', nodePath, ...runnerArgs],
    }
  }

  return {
    command: nodePath,
    args: runnerArgs,
  }
}

export async function runSleepInhibitedE2ESuite(args = process.argv.slice(2)) {
  const invocation = createSleepInhibitedE2ECommand(args)
  if (invocation.command === 'caffeinate') {
    console.log('[e2e:sleep-inhibitor] caffeinate -dimsu enabled')
  }
  const result = await execa(invocation.command, invocation.args, {
    reject: false,
    stdio: 'inherit',
  })
  process.exitCode = result.exitCode ?? 1
}

function isCurrentModuleEntry(entryArg: string | undefined, moduleUrl: string) {
  if (!entryArg) {
    return false
  }
  const resolvedEntryPath = path.isAbsolute(entryArg) ? entryArg : path.resolve(entryArg)
  return moduleUrl === pathToFileURL(resolvedEntryPath).href
}

if (isCurrentModuleEntry(process.argv[1], import.meta.url)) {
  await runSleepInhibitedE2ESuite()
}
