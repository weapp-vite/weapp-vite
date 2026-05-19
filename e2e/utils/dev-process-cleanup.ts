/* eslint-disable e18e/ban-dependencies -- e2e dev 进程清理需要 execa 调用系统进程工具。 */
import process from 'node:process'
import { execa } from 'execa'
import { cleanupProcessesByCommandPatterns, cleanupTrackedDevProcesses } from './dev-process'

const DEV_PROCESS_MATCH_PATTERNS = [
  /(?:^|\s)(?:\S*\/)?pnpm(?:\.[cm]?js)?(?:\s+--dir\s+\S*(?:e2e-apps|apps)\/\S+\s+run\s+\S+|\s+run\s+\S+\s+--dir\s+\S*(?:e2e-apps|apps)\/\S+)/,
  /(?:^|\s)weapp-vite\/bin\/weapp-vite\.js\s+dev[^\n]*(?:e2e-apps|apps)\//,
  /(?:^|\s)packages\/weapp-vite\/src\/cli\.ts\s+dev[^\n]*(?:e2e-apps|apps)\//,
  /(?:^|\s)packages\/weapp-vite\/dist\/cli\.mjs\s+dev[^\n]*(?:e2e-apps|apps)\//,
]

const DEV_PROCESS_PKILL_PATTERNS = [
  'pnpm.*--dir.*e2e-apps/.+ run ',
  'pnpm.*--dir.*apps/.+ run ',
  'weapp-vite/bin/weapp-vite.js dev.*e2e-apps/',
  'weapp-vite/bin/weapp-vite.js dev.*apps/',
  'packages/weapp-vite/src/cli.ts dev.*e2e-apps/',
  'packages/weapp-vite/src/cli.ts dev.*apps/',
  'packages/weapp-vite/dist/cli.mjs dev.*e2e-apps/',
  'packages/weapp-vite/dist/cli.mjs dev.*apps/',
]

function sleep(ms: number) {
  return new Promise<void>(resolve => setTimeout(resolve, ms))
}

export async function cleanupResidualDevProcesses() {
  if (process.platform === 'win32') {
    return
  }

  await cleanupTrackedDevProcesses(2_500)

  for (const pattern of DEV_PROCESS_PKILL_PATTERNS) {
    await execa('pkill', ['-f', pattern], {
      reject: false,
      stdin: 'ignore',
      stdout: 'ignore',
      stderr: 'ignore',
    })

    await execa('pkill', ['-9', '-f', pattern], {
      reject: false,
      stdin: 'ignore',
      stdout: 'ignore',
      stderr: 'ignore',
    })
  }

  try {
    await cleanupProcessesByCommandPatterns(DEV_PROCESS_MATCH_PATTERNS, 2_500)
  }
  catch {}
  await sleep(1_000)
}
