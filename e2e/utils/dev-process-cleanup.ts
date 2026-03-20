import process from 'node:process'
import { execa } from 'execa'
import { cleanupTrackedDevProcesses } from './dev-process'

const E2E_APP_PATTERN = 'e2e-apps/'
const DEV_COMMAND_PATTERNS = [
  'weapp-vite/bin/weapp-vite.js dev',
  'packages/weapp-vite/src/cli.ts dev',
  'packages/weapp-vite/dist/cli.mjs dev',
]

function buildProcessMatchPattern(commandPattern: string) {
  return `${commandPattern}.*${E2E_APP_PATTERN}`
}

function sleep(ms: number) {
  return new Promise<void>(resolve => setTimeout(resolve, ms))
}

export async function cleanupResidualDevProcesses() {
  if (process.platform === 'win32') {
    return
  }

  await cleanupTrackedDevProcesses(2_500)

  for (const commandPattern of DEV_COMMAND_PATTERNS) {
    const processMatchPattern = buildProcessMatchPattern(commandPattern)

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

  await sleep(1_000)
}
