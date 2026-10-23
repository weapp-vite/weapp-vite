import type { startDevProcess } from '../../e2e/utils/dev-process'
import type { WorkspaceHmrAuditBudget } from './auditDeadline'
import type { WorkspaceHmrStageObserver } from './stageRecorder'
import path from 'node:path'
import { createDevBuildCompletion } from '../../e2e/utils/devBuildCompletion'
import { captureNativePublication } from '../../e2e/utils/nativePublication'
import { inspectSettledClassicPublication } from './classicPublicationBarrier'
import { waitForStableDistSnapshot } from './output'

/** 编辑前复用原生观察器和正式来源完成游标，不能以产物暂时可读替代本轮发布。 */
export function captureWorkspaceClassicPublication(options: {
  project: { root: string, sourceRoot: string, distRoot: string }
  dev: Pick<ReturnType<typeof startDevProcess>, 'getOutput' | 'waitFor'>
  sourceFile: string
  profilePath: string
  mode: 'stateful-experimental' | 'classic'
  stableMs: number
  observe?: WorkspaceHmrStageObserver
}) {
  const { project, dev } = options
  const offset = dev.getOutput().length
  const native = captureNativePublication(dev, project.root, {
    sourceRoot: path.relative(project.root, project.sourceRoot) || '.',
    outputRoot: project.distRoot,
    expectedSourceFiles: [options.sourceFile],
    ...(options.mode === 'stateful-experimental'
      ? { allowSourceFreePublication: (receiptOffset: number) => dev.getOutput().indexOf('[weapp-vite] HMR classic ready ', offset) >= receiptOffset }
      : {}),
  })
  const completion = createDevBuildCompletion(dev, { source: { files: [options.sourceFile], profilePath: options.profilePath } })
  return {
    inspect<T>(budget: WorkspaceHmrAuditBudget, inspect: () => Promise<T>) {
      return inspectSettledClassicPublication({
        observe: options.observe,
        mode: options.mode,
        native,
        completion,
        ready: async () => {
          // waitForScenarioMutation 已验证完整 fallback/ready 记录，此处只比较同一 stdout 游标。
          const ready = dev.getOutput().indexOf('[weapp-vite] HMR classic ready ', offset)
          if (ready < 0) {
            throw new Error('Classic publication has no matching formal ready transition after capture.')
          }
          return ready
        },
        stable: (timeoutMs, signal) => waitForStableDistSnapshot(project.distRoot, options.stableMs, timeoutMs, signal),
        inspect,
      }, budget)
    },
  }
}
