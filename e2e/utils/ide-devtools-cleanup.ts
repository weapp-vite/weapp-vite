import process from 'node:process'
// eslint-disable-next-line e18e/ban-dependencies -- e2e 需要调用所选 DevTools CLI 清理编译缓存
import { execa } from 'execa'
import { cleanupResidualDevProcesses } from './dev-process-cleanup'
import { resolveWechatCliPath } from './devtoolsCli'
import { cleanupOwnedDevtoolsProcesses } from './devtoolsProcessOwnership'
import { waitForDevtoolsLogQuiescence } from './ide-devtools-logs'

const COMPACT_WHITESPACE_PATTERN = /\s+/g
const DEVTOOLS_CACHE_CLEAN_STALE_PORT_PATTERNS = [
  /#initialize-error:\s*wait IDE port timeout/i,
  /IDE may already started at port/i,
  /wait IDE port timeout/i,
] as const

type DevtoolsCacheCleanType = 'compile'

function extractCleanCacheErrorText(error: unknown) {
  if (!error || typeof error !== 'object') {
    return String(error ?? '')
  }

  const candidate = error as {
    message?: unknown
    stderr?: unknown
    stdout?: unknown
  }
  return [candidate.message, candidate.stderr, candidate.stdout]
    .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    .join('\n')
}

function normalizeCleanCacheOutput(value: unknown) {
  return typeof value === 'string'
    ? value.replace(COMPACT_WHITESPACE_PATTERN, ' ').trim()
    : ''
}

function createCleanCacheError(cleanType: DevtoolsCacheCleanType, output: {
  exitCode?: number | null
  stderr?: string
  stdout?: string
}) {
  const stderr = normalizeCleanCacheOutput(output.stderr)
  const stdout = normalizeCleanCacheOutput(output.stdout)
  return new Error(stderr || stdout || `Failed to clean DevTools cache: ${cleanType}`)
}

function isRecoverableCleanCachePortError(error: unknown) {
  const text = extractCleanCacheErrorText(error)
  return DEVTOOLS_CACHE_CLEAN_STALE_PORT_PATTERNS.some(pattern => pattern.test(text))
}

async function runCleanDevtoolsCacheCommand(
  cleanType: DevtoolsCacheCleanType,
  options: {
    cliPath?: string
    cwd?: string
    platform?: NodeJS.Platform
  },
) {
  // 自动恢复只处理构建缓存，不能清除用户授权、登录会话或业务数据。
  if (cleanType !== 'compile') {
    throw new Error('Automatic E2E recovery may clean only compile cache; authentication and user data must be preserved')
  }
  const result = await execa(resolveWechatCliPath(options.cliPath, options.platform), ['cache', '--clean', cleanType], {
    cwd: options.cwd,
    reject: false,
    stdin: 'ignore',
    timeout: 20_000,
  })

  if ((result.exitCode ?? 1) !== 0) {
    throw createCleanCacheError(cleanType, result)
  }
}

export async function cleanupResidualDevtoolsProcesses(_platform = process.platform) {
  // 会话自己的 close/disconnect、CLI 子树由启动生命周期负责；绝不终止手动打开的 IDE。
  // 不删除全局 session/port-lease 目录，其他进程可能仍持有其中的租约。
  await cleanupOwnedDevtoolsProcesses()
  await waitForDevtoolsLogQuiescence()
}

export async function cleanDevtoolsCache(
  cleanType: DevtoolsCacheCleanType,
  options: {
    cliPath?: string
    cwd?: string
    platform?: NodeJS.Platform
  } = {},
) {
  try {
    await runCleanDevtoolsCacheCommand(cleanType, options)
  }
  catch (error) {
    if (!isRecoverableCleanCachePortError(error)) {
      throw error
    }
    await cleanupResidualDevtoolsProcesses(options.platform)
    await runCleanDevtoolsCacheCommand(cleanType, options)
  }
}

export async function cleanDevtoolsCacheAndStop(
  cleanType: DevtoolsCacheCleanType,
  options: {
    cliPath?: string
    cwd?: string
    platform?: NodeJS.Platform
  } = {},
) {
  await cleanDevtoolsCache(cleanType, options)
  await cleanupResidualDevtoolsProcesses(options.platform)
}

export async function cleanupResidualIdeProcesses(platform = process.platform) {
  await cleanupResidualDevProcesses()
  await cleanupResidualDevtoolsProcesses(platform)
}
