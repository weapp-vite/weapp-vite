export interface TimingPair {
  baseline: number
  current: number
}

export interface GateScenario {
  id: string
  requiredPairs: number
  pairs: TimingPair[]
  error?: string
}

export interface GateSummary {
  status: 'passed' | 'regression' | 'unstable' | 'incomplete'
  thresholdPercent: number
  scenarios: Array<{
    id: string
    status: GateSummary['status']
    primary: ReturnType<typeof summarizePairs>
    confirmation?: ReturnType<typeof summarizePairs>
    error?: string
  }>
}

/** 固定上分位法，保留所有样本；不以最小值替代正常编辑耗时。 */
export function percentile(samples: number[], fraction: number): number | null {
  if (!samples.length) {
    return null
  }
  const sorted = [...samples].sort((a, b) => a - b)
  if (fraction === 0.5 && sorted.length % 2 === 0) {
    return (sorted[sorted.length / 2 - 1]! + sorted[sorted.length / 2]!) / 2
  }
  return sorted[Math.max(0, Math.ceil(sorted.length * fraction) - 1)]!
}

/** 以同场景两侧中位数比较，同时报告成对增量和 P95。 */
export function summarizePairs(pairs: TimingPair[]) {
  const baseline = pairs.map(pair => pair.baseline)
  const current = pairs.map(pair => pair.current)
  const before = percentile(baseline, 0.5)
  const after = percentile(current, 0.5)
  return {
    count: pairs.length,
    baselineMedianMs: before,
    currentMedianMs: after,
    baselineP95Ms: percentile(baseline, 0.95),
    currentP95Ms: percentile(current, 0.95),
    pairedDeltaMedianMs: percentile(pairs.map(pair => pair.current - pair.baseline), 0.5),
    changePercent: before !== null && before > 0 && after !== null ? (after - before) / before * 100 : null,
  }
}

function complete(scenario: GateScenario) {
  return !scenario.error && Number.isInteger(scenario.requiredPairs) && scenario.requiredPairs > 0
    && scenario.pairs.length === scenario.requiredPairs
    && scenario.pairs.every(pair => Number.isFinite(pair.baseline) && pair.baseline > 0 && Number.isFinite(pair.current) && pair.current > 0)
}

/** 越线只接受一次等量复核；冲突结论保持不稳定，不以复测较快值覆盖首批。 */
export function evaluateGate(primary: GateScenario[], confirmation: GateScenario[] = [], thresholdPercent = 5): GateSummary {
  if (!Number.isFinite(thresholdPercent) || thresholdPercent < 0) {
    throw new Error('Invalid performance threshold')
  }
  const seen = new Set<string>()
  const scenarios = primary.map((scenario): GateSummary['scenarios'][number] => {
    const summary = summarizePairs(scenario.pairs)
    const duplicate = seen.has(scenario.id)
    seen.add(scenario.id)
    if (duplicate || !complete(scenario)) {
      return { id: scenario.id, status: 'incomplete', primary: summary, error: scenario.error ?? 'Missing, duplicate or invalid paired samples' }
    }
    if (summary.changePercent! <= thresholdPercent) {
      return { id: scenario.id, status: 'passed', primary: summary }
    }
    const repeats = confirmation.filter(item => item.id === scenario.id)
    const repeat = repeats[0]
    if (repeats.length !== 1 || !repeat || repeat.requiredPairs !== scenario.requiredPairs || !complete(repeat)) {
      return { id: scenario.id, status: 'incomplete', primary: summary, error: 'One complete equal-size confirmation batch is required' }
    }
    const repeated = summarizePairs(repeat.pairs)
    return { id: scenario.id, status: repeated.changePercent! > thresholdPercent ? 'regression' : 'unstable', primary: summary, confirmation: repeated }
  })
  const status = scenarios.some(row => row.status === 'regression')
    ? 'regression'
    : !scenarios.length || scenarios.some(row => row.status === 'incomplete')
        ? 'incomplete'
        : scenarios.some(row => row.status === 'unstable') ? 'unstable' : 'passed'
  return { status, thresholdPercent, scenarios }
}

/** 独立退出断言，防止采集进程成功掩盖性能结论。 */
export function assertGatePassed(gate: GateSummary) {
  if (gate.status !== 'passed') {
    throw new Error(`Performance gate ${gate.status}: ${gate.scenarios.filter(row => row.status !== 'passed').map(row => row.id).join(', ')}`)
  }
}
