import process from 'node:process'
import { cleanupProcessesByCommandPatterns, cleanupTrackedDevProcesses } from './dev-process'

const DEV_PROCESS_MATCH_PATTERNS = [
  /(?:^|\s)(?:\S*\/)?pnpm(?:\.[cm]?js)?(?:\s+--dir\s+\S*(?:e2e-apps|apps)\/\S+\s+run\s+\S+|\s+run\s+\S+\s+--dir\s+\S*(?:e2e-apps|apps)\/\S+)/,
  /(?:^|\s)(?:\S*\/)?weapp-vite\/bin\/weapp-vite\.js\s+dev[^\n]*(?:e2e-apps|apps|\.tmp)\//,
  /(?:^|\s)(?:\S*\/)?weapp-vite\.js\s+mcp[^\n]*--workspace-root\s+\S*(?:e2e-apps|apps|templates|\.tmp)\//,
  /(?:^|\s)(?:\S*\/)?packages\/weapp-vite\/src\/cli\.ts\s+dev[^\n]*(?:e2e-apps|apps|\.tmp)\//,
  /(?:^|\s)(?:\S*\/)?packages\/weapp-vite\/dist\/cli\.mjs\s+dev[^\n]*(?:e2e-apps|apps|\.tmp)\//,
  /(?:^|\s)(?:\S*\/)?packages\/weapp-vite\/bin\/weapp-vite\.js\s+mcp[^\n]*--workspace-root\s+\S*(?:e2e-apps|apps|templates|\.tmp)\//,
]

function sleep(ms: number) {
  return new Promise<void>(resolve => setTimeout(resolve, ms))
}

export async function cleanupResidualDevProcesses() {
  if (process.platform === 'win32') {
    return
  }

  await cleanupTrackedDevProcesses(2_500)

  try {
    await cleanupProcessesByCommandPatterns(DEV_PROCESS_MATCH_PATTERNS, 2_500)
  }
  catch {}
  await sleep(200)
}

export function isResidualDevProcessCommand(command: string) {
  return DEV_PROCESS_MATCH_PATTERNS.some((pattern) => {
    pattern.lastIndex = 0
    return pattern.test(command)
  })
}
