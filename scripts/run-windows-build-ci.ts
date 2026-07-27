import type { SpawnSyncOptions } from 'node:child_process'
import { spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

interface SpawnResult {
  error?: Error
  status: number | null
}

type SpawnCommand = (
  command: string,
  args: string[],
  options: SpawnSyncOptions,
) => SpawnResult

export interface WindowsBuildCiOptions {
  cwd?: string
  env?: NodeJS.ProcessEnv
  execPath?: string
  runReport?: () => Promise<unknown>
  spawn?: SpawnCommand
  turboEntry?: string
}

export const WINDOWS_TURBO_BUILD_ARGS = [
  'run',
  'build',
  '--concurrency=1',
  '--filter=!./apps/*',
  '--filter=!./templates/*',
  '--filter=!./website',
  '--filter=!@weapp-vite/sfc-playground',
  '--filter=!e2e-issue-814-tailwind4-broken',
]

const ROOT = path.resolve(import.meta.dirname, '..')

function resolveTurboEntry() {
  return createRequire(import.meta.url).resolve('turbo/bin/turbo')
}

/**
 * 在同一个 Node 进程内串联 Windows 全量构建与体积报告，避免构建后再次初始化 Node。
 */
export async function runWindowsBuildCi(options: WindowsBuildCiOptions = {}) {
  const result = (options.spawn ?? spawnSync)(
    options.execPath ?? process.execPath,
    [options.turboEntry ?? resolveTurboEntry(), ...WINDOWS_TURBO_BUILD_ARGS],
    {
      cwd: options.cwd ?? ROOT,
      env: options.env ?? process.env,
      stdio: 'inherit',
    },
  )

  if (result.error) {
    throw result.error
  }
  if (result.status !== 0) {
    return result.status ?? 1
  }

  await (options.runReport ?? (() => import('./print-dist-size-report')))()
  return 0
}

const entrypoint = process.argv[1] ? path.resolve(process.argv[1]) : ''
if (entrypoint === fileURLToPath(import.meta.url)) {
  process.exitCode = await runWindowsBuildCi()
}
