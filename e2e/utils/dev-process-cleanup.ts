import process from 'node:process'
import { execa } from 'execa'
import { cleanupTrackedDevProcesses } from './dev-process'

const DEV_COMMAND_PATTERN = 'weapp-vite/bin/weapp-vite.js dev'
const E2E_APP_PATTERN = 'e2e-apps/'
const PROCESS_MATCH_PATTERN = `${DEV_COMMAND_PATTERN}.*${E2E_APP_PATTERN}`

function sleep(ms: number) {
  return new Promise<void>(resolve => setTimeout(resolve, ms))
}

export async function cleanupResidualDevProcesses() {
  if (process.platform === 'win32') {
    return
  }

  await cleanupTrackedDevProcesses(2_500)

  await execa('pkill', ['-f', PROCESS_MATCH_PATTERN], {
    reject: false,
    stdin: 'ignore',
    stdout: 'ignore',
    stderr: 'ignore',
  })

  await execa('pkill', ['-9', '-f', PROCESS_MATCH_PATTERN], {
    reject: false,
    stdin: 'ignore',
    stdout: 'ignore',
    stderr: 'ignore',
  })

  await sleep(120)
}
