import assert from 'node:assert/strict'
import path from 'node:path'

export function parseProductArguments(args) {
  assert.equal(args.length, 2, 'Usage: run.mjs --report <file>')
  assert.equal(args[0], '--report', 'Product contracts require the complete inventory; only --report is supported')
  assert.ok(args[1]?.trim() && !args[1].startsWith('--'), 'A report file is required')
  return { reportFile: path.resolve(args[1]) }
}

export function describeFailure(error) {
  return {
    name: error?.name,
    message: error?.message ?? String(error),
    stack: error?.stack,
    actual: error?.actual,
    expected: error?.expected,
    errors: error?.errors?.map(describeFailure),
  }
}

export function createProductReport(dependency, planned) {
  assert.ok(planned.length > 0 && new Set(planned).size === planned.length, 'A product inventory must be nonempty and unique')
  return {
    schemaVersion: 1,
    suite: 'product-lifecycle',
    dependency,
    status: 'running',
    startedAt: new Date().toISOString(),
    planned: [...planned],
    completed: [],
    results: [],
  }
}

function assertProductObservation(item) {
  assert.equal(item?.status, 'passed', `${item?.name} did not pass`)
  assert.ok(item.observations && typeof item.observations === 'object' && !Array.isArray(item.observations) && Object.keys(item.observations).length > 0, `${item.name} has no observations`)
  if (item.durationMs !== undefined) {
    assert.ok(Number.isFinite(item.durationMs) && item.durationMs >= 0, `${item.name} has an invalid duration`)
  }
}

/** 每项通过后立即登记，后续失败仍保留先前实际完成的证据。 */
export function recordProductResult(report, item) {
  assert.equal(report.status, 'running')
  assert.equal(item?.name, report.planned[report.results.length], 'Product observations must follow the required plan')
  assertProductObservation(item)
  report.results.push(item)
  report.completed.push(item.name)
  delete report.currentContract
}

/** 仅接受逐项真实观察，不将部分完成、空观察或失败改写为通过。 */
export function completeProductReport(report, planned) {
  assert.equal(report.suite, 'product-lifecycle')
  assert.equal(report.status, 'running', 'Only a running product report can complete')
  assert.deepEqual(report.planned, [...planned], 'The product plan must match the required inventory')
  assert.ok(Array.isArray(report.results), 'Product results must be an array')
  assert.deepEqual(report.results.map(item => item?.name), [...planned], 'Every product contract must complete exactly once in order')
  for (const item of report.results) {
    assertProductObservation(item)
  }
  assert.equal(report.error, undefined, 'A report with an error cannot pass')
  return { ...report, status: 'passed', completed: [...planned] }
}

export function failProductReport(report, error) {
  const completed = []
  for (const [index, item] of (Array.isArray(report.results) ? report.results : []).entries()) {
    if (item?.name !== report.planned[index] || item.status !== 'passed' || !item.observations || typeof item.observations !== 'object' || Array.isArray(item.observations) || Object.keys(item.observations).length === 0) {
      break
    }
    completed.push(item.name)
  }
  const failed = report.currentContract ?? report.results?.[completed.length]?.name
  return {
    ...report,
    status: 'failed',
    completed,
    failed,
    notExecuted: report.planned.slice(completed.length + (failed ? 1 : 0)),
    error: describeFailure(error),
  }
}
