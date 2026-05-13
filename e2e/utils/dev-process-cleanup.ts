/* eslint-disable e18e/ban-dependencies -- e2e dev 进程清理需要 execa 调用系统进程工具。 */
import process from 'node:process'
import { execa } from 'execa'
import { cleanupProcessesByCommandPatterns, cleanupTrackedDevProcesses } from './dev-process'

const DEV_WORKSPACE_PATTERNS = [
  'e2e-apps/',
  'apps/',
]
const DEV_COMMAND_PATTERNS = [
  'weapp-vite/bin/weapp-vite.js dev',
  'packages/weapp-vite/src/cli.ts dev',
  'packages/weapp-vite/dist/cli.mjs dev',
]

function buildProcessMatchPatterns(commandPattern: string) {
  return DEV_WORKSPACE_PATTERNS.map(workspacePattern => `${commandPattern}.*${workspacePattern}`)
}

function sleep(ms: number) {
  return new Promise<void>(resolve => setTimeout(resolve, ms))
}

export async function cleanupResidualDevProcesses() {
  if (process.platform === 'win32') {
    return
  }

  await cleanupTrackedDevProcesses(2_500)

  const processMatchPatterns = DEV_COMMAND_PATTERNS.flatMap(buildProcessMatchPatterns)

  for (const commandPattern of DEV_COMMAND_PATTERNS) {
    for (const processMatchPattern of buildProcessMatchPatterns(commandPattern)) {
      await execa('pkill', ['-f', processMatchPattern], {
        reject: false,
        stdin: 'ignore',
        stdout: 'ignore',
        stderr: 'ignore',
      })

      await execa('pkill', ['-9', '-f', processMatchPattern], {
        reject: false,
        stdin: 'ignore',
        stdout: 'ignore',
        stderr: 'ignore',
      })
    }
  }

  try {
    await cleanupProcessesByCommandPatterns(processMatchPatterns, 2_500)
  }
  catch {}
  await sleep(1_000)
}
