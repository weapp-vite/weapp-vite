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
const DEFAULT_WECHAT_CLI_MACOS_PATH = '/Applications/wechatwebdevtools.app/Contents/MacOS/cli'
const DEFAULT_WECHAT_CLI_WINDOWS_PATH = 'C:/Program Files (x86)/Tencent/微信web开发者工具/cli.bat'

const UNIX_DEVTOOLS_PROCESS_PATTERNS = [
  'e2e/utils/automator.cli-bridge.ts',
  'wechatwebdevtools.app/Contents/MacOS/cli',
  'wechatwebdevtools.app/Contents/MacOS/wechatwebdevtools',
  'wechatwebdevtools',
] as const

type DevtoolsCacheCleanType = 'compile' | 'network' | 'all'

function sleep(ms: number) {
  return new Promise<void>(resolve => setTimeout(resolve, ms))
}

export function resolveIdeDevtoolsProcessPatterns(platform = process.platform) {
  if (platform === 'win32') {
    return [] as string[]
  }

  return [...UNIX_DEVTOOLS_PROCESS_PATTERNS]
}

function resolveWechatCliPath(cliPath?: string) {
  if (typeof cliPath === 'string' && cliPath.trim()) {
    return cliPath.trim()
  }
  if (process.platform === 'win32') {
    return DEFAULT_WECHAT_CLI_WINDOWS_PATH
  }
  return DEFAULT_WECHAT_CLI_MACOS_PATH
}

async function cleanupAutomatorSessionArtifacts() {
  await fs.rm(AUTOMATOR_SESSION_DIR, {
    recursive: true,
    force: true,
  }).catch(() => {})

  await sleep(IDE_PROCESS_SETTLE_DELAY)
}

export async function cleanupResidualDevtoolsProcesses(platform = process.platform) {
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

  await cleanupAutomatorSessionArtifacts()
}

export async function cleanDevtoolsCache(
  cleanType: DevtoolsCacheCleanType,
  options: {
    cliPath?: string
    cwd?: string
  } = {},
) {
  const result = await execa(resolveWechatCliPath(options.cliPath), ['cache', '--clean', cleanType], {
    cwd: options.cwd,
    reject: false,
    stdin: 'ignore',
    timeout: 20_000,
  })

  if ((result.exitCode ?? 1) === 0) {
    return
  }

  const stderr = typeof result.stderr === 'string' ? result.stderr.trim() : ''
  const stdout = typeof result.stdout === 'string' ? result.stdout.trim() : ''
  throw new Error(stderr || stdout || `Failed to clean DevTools cache: ${cleanType}`)
}

export async function cleanupResidualIdeProcesses(platform = process.platform) {
  await cleanupResidualDevProcesses()
  await cleanupResidualDevtoolsProcesses(platform)
}
