export interface TemplatesHmrReport {
  iterations?: number
  summary?: Record<string, unknown>
  templates: Array<{
    id: string
    error?: string
    scenarioCount?: number
    scenarios: Array<{
      id: string
      group: string
      label: string
      error?: string
      samples: Array<{
        buildCoreMs?: number
        emitMs?: number
        heapUsedBytes?: number
        rssBytes?: number
        totalMs?: number
        transformMs?: number
        wallMs?: number
        writeMs?: number
      }>
    }>
  }>
}

function record(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

function rows(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? value.map(record) : []
}

/** 在渲染比较报告前检查可遍历结构；完整性和执行状态由独立门禁判断。 */
export function parseTemplatesHmrReport(value: unknown): TemplatesHmrReport {
  const report = record(value)
  if (!Array.isArray(report.templates) || report.templates.some((item) => {
    const template = record(item)
    return typeof template.id !== 'string' || !Array.isArray(template.scenarios) || template.scenarios.some((entry) => {
      const scenario = record(entry)
      return typeof scenario.id !== 'string' || typeof scenario.group !== 'string' || typeof scenario.label !== 'string'
        || !Array.isArray(scenario.samples) || scenario.samples.some(sample => Object.keys(record(sample)).length === 0)
    })
  })) {
    throw new Error('HMR report has an invalid templates/scenarios/samples structure')
  }
  return value as TemplatesHmrReport
}

function positiveInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0
}

function validDuration(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
}

function inspectIds(items: Record<string, unknown>[], label: string, failures: string[], key = 'id') {
  const ids = items.map(item => item[key])
  if (!items.length || ids.some(id => typeof id !== 'string' || !id) || new Set(ids).size !== ids.length) {
    failures.push(`${label}: missing, empty or duplicate entries`)
  }
  return ids
}

function sameIds(left: unknown[], right: unknown[]) {
  return left.length === right.length && new Set(left).size === left.length && left.every(id => right.includes(id))
}

/** 只约束执行成功和证据完整性；不改变性能预算或回归阈值。 */
export function collectTemplatesPerformanceFailures(input: unknown) {
  const report = record(input)
  const failures: string[] = []
  for (const field of ['buildIterations', 'hmrIterations']) {
    if (!positiveInteger(report[field])) {
      failures.push(`${field}: missing or invalid iteration count`)
    }
  }
  const buildIds: unknown[][] = []
  const hmrIds: unknown[][] = []
  for (const checkoutId of ['baseline', 'optimized']) {
    const checkout = record(report[checkoutId])
    const templates = rows(checkout.templates)
    const ids = inspectIds(templates, `${checkoutId} build templates`, failures)
    if (Array.isArray(report.templateFilter) && report.templateFilter.some(filter => typeof filter !== 'string'
      || !ids.some(id => typeof id === 'string' && id.includes(filter)))) {
      failures.push(`${checkoutId} build filter selected a template absent from the report`)
    }
    buildIds.push(ids)
    const build = record(checkout.build)
    const samples = rows(build.samples)
    const buildTemplates = rows(build.templates)
    if (!sameIds(ids, inspectIds(buildTemplates, `${checkoutId} build summaries`, failures))) {
      failures.push(`${checkoutId} build summaries do not cover the planned templates`)
    }
    if (samples.some(sample => !ids.includes(sample.template))) {
      failures.push(`${checkoutId} build contains unplanned samples`)
    }
    const raw = record(build.raw)
    const successCount = samples.filter(sample => sample.status === 0).length
    if (raw.count !== successCount || raw.failedCount !== samples.length - successCount || raw.failedCount !== 0) {
      failures.push(`${checkoutId} build summary contains failed or inconsistent counts`)
    }
    for (const id of ids) {
      const selected = samples.filter(sample => sample.template === id)
      const iterations = selected.map(sample => sample.iteration)
      if (selected.length !== report.buildIterations || new Set(iterations).size !== iterations.length
        || iterations.some(iteration => !positiveInteger(iteration) || iteration > Number(report.buildIterations))) {
        failures.push(`${checkoutId} build ${id}: incomplete or duplicate iterations`)
      }
      if (selected.some(sample => sample.status !== 0 || sample.error || !validDuration(sample.totalMs))) {
        failures.push(`${checkoutId} build ${id}: failed command or invalid timing`)
      }
    }
    if (checkout.hmrError) {
      failures.push(`${checkoutId} HMR collection failed: ${checkout.hmrError}`)
    }
    const hmr = record(checkout.hmr)
    const hmrTemplates = rows(hmr.templates)
    const templateIds = inspectIds(hmrTemplates, `${checkoutId} HMR templates`, failures)
    const summary = record(hmr.summary)
    const scenarios = hmrTemplates.flatMap(template => rows(template.scenarios))
    const expectedSummary = {
      templateCount: hmrTemplates.length,
      scenarioCount: scenarios.length,
      measuredScenarioCount: scenarios.filter(scenario => rows(scenario.samples).length > 0).length,
      failedTemplateCount: hmrTemplates.filter(template => template.error).length,
      failedScenarioCount: scenarios.filter(scenario => scenario.error).length,
    }
    for (const [key, value] of Object.entries(expectedSummary)) {
      if (summary[key] !== value) {
        failures.push(`${checkoutId} HMR summary.${key}: missing or inconsistent count`)
      }
    }
    if (expectedSummary.failedTemplateCount || expectedSummary.failedScenarioCount) {
      failures.push(`${checkoutId} HMR reports failed templates or scenarios`)
    }
    if (hmr.iterations !== report.hmrIterations) {
      failures.push(`${checkoutId} HMR iteration configuration does not match the comparison`)
    }
    const keys: string[] = []
    for (const template of hmrTemplates) {
      const entries = rows(template.scenarios)
      inspectIds(entries.map(scenario => ({ ...scenario, key: `${scenario.id}:${scenario.label}` })), `${checkoutId} HMR ${template.id} scenarios`, failures, 'key')
      if (!positiveInteger(template.scenarioCount) || template.scenarioCount !== entries.length) {
        failures.push(`${checkoutId} HMR ${template.id}: planned scenarios were not all executed`)
      }
      for (const scenario of entries) {
        keys.push(`${template.id}:${scenario.id}:${scenario.label}`)
        const measured = rows(scenario.samples)
        if (measured.length !== report.hmrIterations || measured.some(sample => !validDuration(sample.totalMs) || !validDuration(sample.wallMs))) {
          failures.push(`${checkoutId} HMR ${template.id}/${scenario.id}: incomplete samples or invalid timing`)
        }
      }
    }
    hmrIds.push(keys)
    const filters = typeof report.hmrFilter === 'string' ? report.hmrFilter.split(',').map(value => value.trim()).filter(Boolean) : []
    if (filters.some(filter => !templateIds.some(id => typeof id === 'string' && id.includes(filter)))) {
      failures.push(`${checkoutId} HMR filter selected a template absent from the report`)
    }
  }
  for (const [kind, ids] of [['build', buildIds], ['hmr', hmrIds]] as const) {
    const comparison = record(report[kind])
    const entries = rows(comparison.rows)
    const key = kind === 'build' ? 'id' : 'key'
    const actual = inspectIds(entries, `${kind} comparison`, failures, key)
    if (!sameIds(ids[0]!, ids[1]!) || !sameIds(actual, ids[0]!)) {
      failures.push(`${kind} comparison is missing planned baseline or optimized entries`)
    }
    if (!Array.isArray(comparison.failed) || comparison.failed.length > 0 || entries.some(entry => entry.comparable !== true)) {
      failures.push(`${kind} comparison contains failed or incomparable entries`)
    }
  }
  return failures
}

export function assertTemplatesPerformanceComplete(report: unknown) {
  const failures = collectTemplatesPerformanceFailures(report)
  if (failures.length) {
    throw new Error(`Templates performance benchmark failed integrity checks:\n${failures.map(failure => `- ${failure}`).join('\n')}`)
  }
}
