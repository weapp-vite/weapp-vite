import process from 'node:process'
import { cleanupResidualDevProcesses } from './dev-process-cleanup'
import { cleanupOwnedDevtoolsProcesses } from './devtoolsProcessOwnership'
import { waitForDevtoolsLogQuiescence } from './ide-devtools-logs'
import { resolveRuntimeProviderName } from './runtimeProvider'

export async function cleanupResidualDevtoolsProcesses(_platform = process.platform) {
  if (resolveRuntimeProviderName() === 'headless') {
    return
  }
  // 会话自己的 close/disconnect、CLI 子树由启动生命周期负责；绝不终止手动打开的 IDE。
  // 不删除全局 session/port-lease 目录，其他进程可能仍持有其中的租约。
  await cleanupOwnedDevtoolsProcesses()
  await waitForDevtoolsLogQuiescence()
}

export async function cleanupResidualIdeProcesses(platform = process.platform) {
  await cleanupResidualDevProcesses()
  await cleanupResidualDevtoolsProcesses(platform)
}
