import assert from 'node:assert/strict'

/** scope 登记期间取消时，只释放本次尚未启动 child 的 scope。 */
export async function preparePublicWorkerScope({ lease, cleanupKey, signal, start }) {
  signal.throwIfAborted()
  const scope = await lease.createChildScope({ cleanupKey })
  if (signal.aborted) {
    await scope.seal()
    await scope.complete()
    signal.throwIfAborted()
  }
  // 取消复检与同步启动之间不能再插入 await。
  return { scope, execution: start(scope) }
}

/** 类型编译失败保留原始证据，独立 runtime 场景仍按原顺序执行。 */
export async function runCandidateValidation({ report, verifyTypes, runScenario, persist, scenarios, nonApplicableReason, nativePlatform, signal }) {
  signal.throwIfAborted()
  try {
    report.types = await verifyTypes()
  }
  catch (error) {
    report.types = {
      status: 'failed',
      compiler: 'installed-typescript',
      strict: true,
      skipLibCheck: false,
      error: { message: String(error), stack: error?.stack, exitCode: error?.exitCode, stdout: error?.stdout, stderr: error?.stderr },
    }
  }
  await persist()
  for (const scenario of scenarios) {
    signal.throwIfAborted()
    const reason = nonApplicableReason(scenario, nativePlatform)
    const result = reason
      ? { id: scenario.id, status: 'non-applicable', reason, workerStarted: false }
      : await runScenario(scenario)
    report.results.push(result)
    await persist()
    assert(reason || result.cleanupConfirmed, 'Unconfirmed consumer cleanup blocks subsequent scenarios')
  }
  signal.throwIfAborted()
}

export { isConfirmedBaselineRejection as isOriginalRecoveryRejection } from './negativeControl.mjs'

/** 类型与 runtime 分别汇总；任一类型失败都不得将整体验收标记为通过。 */
export function completePublicValidation(report, nativePlatform, planned) {
  const runtimeFailed = report.results.some(item => item.status === 'failed')
  const runtimeCompleted = report.results.length === planned
  const publicTypesPassed = report.types?.status === 'passed'
  const failed = runtimeFailed || !publicTypesPassed || report.negativeControl.status === 'failed'
  const missingWindowsBaseline = nativePlatform === 'win32' && report.negativeControl.status !== 'confirmed-rejected'
  report.status = failed ? 'failed' : !runtimeCompleted || missingWindowsBaseline ? 'incomplete' : 'passed'
  report.acceptance = {
    nativeHostOnly: true,
    publicTypesPassed,
    applicableScenariosPassed: runtimeCompleted && !runtimeFailed,
    actualWindowsRecovery: nativePlatform === 'win32' && report.results.find(item => item.id === 'public-missing-watch-recovery')?.status === 'passed',
    baselineOriginalRejected: report.negativeControl.status === 'confirmed-rejected',
  }
}
