import fs from 'node:fs/promises'
import path from 'node:path'

export function summarizeReport(report) {
  const productFailures = report.failures.filter(failure => failure.kind === 'product').length
  const networkFailures = report.failures.filter(failure => failure.kind === 'network').length
  const registryFailures = report.failures.filter(failure => failure.kind === 'registry-unavailable').length
  const laggingRegistries = [...new Set([
    ...report.registries.filter(registry => registry.lag === 'behind').map(registry => registry.name),
    ...[...(report.results ?? []), ...report.failures].filter(row => row.lag === 'behind').map(row => row.registryProfile),
  ])]
  const status = productFailures
    ? 'product-failure'
    : networkFailures
      ? 'environment-limited'
      : registryFailures
        ? 'registry-incomplete'
        : laggingRegistries.length ? 'passed-with-registry-lag' : 'passed'
  return { status, productFailures, networkFailures, registryFailures, laggingRegistries }
}

/** 接收调用方已脱敏的错误，立即保留原始诊断，避免等待临时目录清理后才输出。 */
export function recordSmokeFailure(report, failure) {
  report.failures.push(failure)
  const label = [failure.registryProfile, failure.scenario, failure.template, failure.stage, failure.kind].filter(Boolean).join('/')
  console.error(`[${label}] ${failure.error}`)
}

/** 增量报告明确标记尚未完成，只有整轮计划结算后才发布最终状态。 */
export async function writeSmokeReport(report, reportFile, { complete = false } = {}) {
  const summary = summarizeReport(report)
  report.complete = complete
  report.summary = complete ? summary : { ...summary, status: 'in-progress' }
  if (reportFile) {
    await fs.mkdir(path.dirname(reportFile), { recursive: true })
    await fs.writeFile(reportFile, `${JSON.stringify(report, null, 2)}\n`)
  }
}

/** 只记录清理阶段与耗时，不打印临时路径；删除失败继续由调用方处理。 */
export async function cleanupSmokeDirectory(directory) {
  const started = performance.now()
  console.log(`[smoke-cleanup] ${JSON.stringify({ event: 'begin' })}`)
  let complete = false
  try {
    await fs.rm(directory, { recursive: true, force: true })
    complete = true
  }
  finally {
    console.log(`[smoke-cleanup] ${JSON.stringify({ event: 'end', complete, elapsedMs: Math.round(performance.now() - started) })}`)
  }
}
