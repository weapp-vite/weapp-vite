import { policy, shards, smokeMetrics } from './contract.mjs'

/** 冒烟只证明当前提交的产物和生命周期完整，不接受任何完整门禁结论。 */
export function verifySmoke(report, headSha) {
  if (report.schemaVersion !== 2 || report.purpose !== 'smoke' || report.headSha !== headSha || report.driverSha !== headSha || report.baselineSha !== policy.baselineSha || report.samplingContract !== policy.samplingContract || report.status !== 'passed' || report.fullAcceptance !== 'not-run' || report.gate !== undefined || report.errors?.length !== 0) {
    throw new Error('Invalid smoke report identity or conclusion')
  }
  if (report.executionPlan?.headOnly !== true || report.executionPlan.confirmation?.length !== 0 || JSON.stringify(report.executionPlan.metrics) !== JSON.stringify(shards.flatMap(smokeMetrics)) || report.stages?.length !== shards.length) {
    throw new Error('Invalid smoke execution plan')
  }
  for (const shard of shards) {
    const rows = report.stages.filter(row => row.shard === shard)
    const expected = smokeMetrics(shard)
    if (rows.length !== 1 || rows[0].values.length !== expected.length || expected.some(id => rows[0].values.filter(v => v.id === id && Number.isFinite(v.ms) && v.ms > 0).length !== 1)) {
      throw new Error('Missing smoke lifecycle evidence')
    }
    for (const value of rows[0].values.filter(v => v.id.startsWith('build:') || v.id.startsWith('auto-build:'))) {
      const output = value.output
      if (!output || !Number.isInteger(output.pageCount) || output.pageCount < 1 || !/^[a-f0-9]{64}$/.test(output.configDigest) || !/^[a-f0-9]{64}$/.test(output.templateDigest)) {
        throw new Error('Missing smoke output evidence')
      }
    }
  }
}
