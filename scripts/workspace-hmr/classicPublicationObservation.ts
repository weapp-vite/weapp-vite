import type { startDevProcess } from '../../e2e/utils/dev-process'
import type { WorkspaceHmrAuditBudget } from './auditDeadline'
import type { WorkspaceHmrRuntime } from './scenarios'
import type { WorkspaceHmrStageObserver } from './stageRecorder'
import path from 'node:path'
import { createDevBuildCompletion } from '../../e2e/utils/devBuildCompletion'
import { captureNativePublication } from '../../e2e/utils/nativePublication'
import { assertHmrAuditBudget } from './auditDeadline'
import { inspectSettledClassicPublication } from './classicPublicationBarrier'
import { waitForStableDistSnapshot } from './output'

export function isWorkspaceClassicPublication(runtime: WorkspaceHmrRuntime, actualMode?: 'stateful-experimental' | 'classic') {
  return runtime === 'standard' || actualMode === 'classic'
}

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

/** 更新与恢复共用完整发布 gate；场景可选样式也必须真实存在于最终快照。 */
export async function inspectWorkspaceScenarioPublication<T extends { snapshot: ReadonlyMap<string, unknown> }>(options: {
  project: { distRoot: string }
  outputPath: string
  deliveredOutput?: string
  captured?: ReturnType<typeof captureWorkspaceClassicPublication>
  inspect: () => Promise<T>
  stableMs: number
  budget: WorkspaceHmrAuditBudget
  observe?: WorkspaceHmrStageObserver
}) {
  const observe: WorkspaceHmrStageObserver = options.observe ?? (async (_step, action) => await action())
  const remaining = () => {
    assertHmrAuditBudget(options.budget, 'Workspace scenario publication deadline exceeded.')
    return options.budget.deadline - Date.now()
  }
  const inspect = async () => {
    const result = await options.inspect()
    const outputPath = options.deliveredOutput === undefined
      ? options.outputPath
      : path.resolve(options.project.distRoot, options.deliveredOutput)
    const output = path.relative(options.project.distRoot, outputPath).split(path.sep).join('/')
    if (output === '..' || output.startsWith('../') || path.isAbsolute(output) || !result.snapshot.has(output)) {
      throw new Error(`Workspace HMR publication is missing scenario output: ${output}`)
    }
    return result
  }
  if (options.captured) {
    return options.captured.inspect(options.budget, inspect)
  }
  // 原字节没有产生新保存；只观察现有发布，不制造来源收据或正式 END。
  await observe('publication.stable-output', () => waitForStableDistSnapshot(options.project.distRoot, options.stableMs, remaining(), options.budget.signal))
  remaining()
  const result = await observe('publication.inspect-output', inspect)
  remaining()
  return result
}
