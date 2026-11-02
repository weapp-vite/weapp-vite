import { cleanupTrackedDevProcesses } from './dev-process'
import { DEV_PROCESS_CLEANUP_TIMEOUT_MS } from './devProcessCleanup/shutdown'

export async function cleanupResidualDevProcesses() {
  // 命令行相同不代表当前测试拥有该进程；所有平台只释放仍登记的子进程。
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(new Error('Owned dev-process cleanup exceeded its task deadline.')), DEV_PROCESS_CLEANUP_TIMEOUT_MS)
  try {
    await cleanupTrackedDevProcesses(2_500, { signal: controller.signal, inspectionSignal: controller.signal })
  }
  finally {
    clearTimeout(timer)
  }
}
