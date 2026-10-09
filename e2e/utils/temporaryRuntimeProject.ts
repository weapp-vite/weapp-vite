import { rm } from 'node:fs/promises'
import { runCleanupSteps } from './cleanupSteps'
import { cleanupResidualIdeProcesses } from './ide-devtools-cleanup'

interface TemporaryRuntimeProject {
  project?: string
  disposeTransport?: () => void
  closeSession: () => void | Promise<void>
  stopDev: () => void | Promise<void>
}

/** 启动失败可能尚未返回会话；窗口日志完成清理前必须保留 IDE 的项目目录。 */
export async function cleanupTemporaryRuntimeProject(options: TemporaryRuntimeProject) {
  await runCleanupSteps([
    { label: 'temporary runtime transport', run: () => options.disposeTransport?.() },
    { label: 'temporary runtime session', run: options.closeSession },
    { label: 'temporary runtime dev process', run: options.stopDev },
    { label: 'temporary runtime owned resources', run: cleanupResidualIdeProcesses },
  ])
  if (options.project) {
    await rm(options.project, { recursive: true, force: true })
  }
}
