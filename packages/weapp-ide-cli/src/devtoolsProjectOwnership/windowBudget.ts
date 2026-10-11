import type { BeginManagedWechatProjectOptions, ManagedWechatProjectRecord } from './types'
import path from 'node:path'
import process from 'node:process'
import { MANAGED_PROJECT_MAX_WINDOWS_ENV } from './journal/constants'

function maximumOwnedWindows(options: BeginManagedWechatProjectOptions) {
  const selected = options.maxOwnedWindows ?? process.env[MANAGED_PROJECT_MAX_WINDOWS_ENV] ?? 1
  if (selected !== 1 && selected !== 2 && selected !== '1' && selected !== '2') {
    throw new Error('Managed DevTools maximum owned windows must be 1 or 2.')
  }
  return Number(selected)
}

function sameTarget(first: ManagedWechatProjectRecord['target'], second: BeginManagedWechatProjectOptions['target']) {
  return first.installationId === second.installationId && first.cliPath === second.cliPath
    && first.appPath === second.appPath && first.profileDir === second.profileDir
    && first.version === second.version && first.channel === second.channel
}

/** 调用方持有根日志锁；重复项目必须只连接已有端点，不能再次派发可能开窗的启动命令。 */
export function checkManagedWindowBudget(records: ManagedWechatProjectRecord[], options: BeginManagedWechatProjectOptions) {
  const maximum = maximumOwnedWindows(options)
  const projectPath = path.resolve(options.projectPath)
  if (records.some(record => record.state !== 'released'
    && record.projectPath === projectPath && sameTarget(record.target, options.target))) {
    throw new Error('Managed DevTools project already has an active session; use its existing endpoint in connect-only mode instead of starting it again.')
  }
  const owned = records.filter(record => record.state === 'owned').length
  if (owned >= maximum) {
    throw new Error(`Managed DevTools window budget exhausted (${owned}/${maximum}); close the previous owned project before another start.`)
  }
}
