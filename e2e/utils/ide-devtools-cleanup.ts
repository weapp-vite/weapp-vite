import * as fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
// eslint-disable-next-line e18e/ban-dependencies -- e2e 需要直接调用 taskkill 进行 Windows DevTools 进程清理
import { execa } from 'execa'
import { cleanupProcessesByCommandPatterns } from './dev-process'
import { cleanupResidualDevProcesses } from './dev-process-cleanup'

const AUTOMATOR_SESSION_DIR = path.join(os.tmpdir(), 'weapp-vite-automator-sessions')
const IDE_PROCESS_SETTLE_DELAY = 1_000

const UNIX_DEVTOOLS_PROCESS_PATTERNS = [
  'e2e/utils/automator.cli-bridge.ts',
  'wechatwebdevtools.app/Contents/MacOS/cli',
  'wechatwebdevtools.app/Contents/MacOS/wechatwebdevtools',
  'wechatwebdevtools',
] as const

function sleep(ms: number) {
  return new Promise<void>(resolve => setTimeout(resolve, ms))
}

export function resolveIdeDevtoolsProcessPatterns(platform = process.platform) {
  if (platform === 'win32') {
    return [] as string[]
  }

  return [...UNIX_DEVTOOLS_PROCESS_PATTERNS]
}

export async function cleanupResidualIdeProcesses(platform = process.platform) {
  await cleanupResidualDevProcesses()

  if (platform === 'win32') {
    await execa('taskkill', ['/F', '/IM', 'wechatdevtools.exe', '/T'], {
      reject: false,
      stdin: 'ignore',
      stdout: 'ignore',
      stderr: 'ignore',
    })
  }
  else {
    const processPatterns = resolveIdeDevtoolsProcessPatterns(platform)
    if (processPatterns.length > 0) {
      try {
        await cleanupProcessesByCommandPatterns(processPatterns, 2_500)
      }
      catch {}
    }
  }

  await fs.rm(AUTOMATOR_SESSION_DIR, {
    recursive: true,
    force: true,
  }).catch(() => {})

  await sleep(IDE_PROCESS_SETTLE_DELAY)
}
