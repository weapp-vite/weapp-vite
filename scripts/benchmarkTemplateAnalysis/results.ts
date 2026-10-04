export interface AnalysisSample {
  trial: number
  variant: 'shared' | 'duplicate-control'
  condition: 'cold' | 'warm'
  metric: 'timing' | 'allocation'
  outputHash: string
  parseCount: number
  compileMs: number
  sampledAllocationBytes?: number
  processPeakRssBytes: number
  retainedHeapDeltaBytes: number
}

export function assertAnalysisSamples(samples: AnalysisSample[]) {
  if (!samples.length || samples.some(sample => !sample.outputHash) || new Set(samples.map(sample => sample.outputHash)).size !== 1) {
    throw new Error('Full compiler outputs differ between analysis variants or conditions.')
  }
  const expectedTrials = [...new Set(samples.map(sample => sample.trial))].sort((left, right) => left - right)
  if (expectedTrials.some((trial, index) => trial !== index)) {
    throw new Error('Trials must be contiguous and start at zero.')
  }
  for (const variant of ['shared', 'duplicate-control'] as const) {
    for (const condition of ['cold', 'warm'] as const) {
      for (const metric of ['timing', 'allocation'] as const) {
        const matching = samples.filter(sample => sample.variant === variant && sample.condition === condition && sample.metric === metric)
        if (matching.length !== expectedTrials.length || new Set(matching.map(sample => sample.trial)).size !== expectedTrials.length || matching.some(sample => sample.parseCount !== (variant === 'shared' ? 3 : 6))) {
          throw new Error(`Missing or invalid parse evidence for ${variant}/${condition}/${metric}.`)
        }
        if (matching.some(sample => !Number.isFinite(sample.compileMs) || sample.compileMs <= 0 || !Number.isFinite(sample.processPeakRssBytes) || sample.processPeakRssBytes <= 0 || !Number.isFinite(sample.retainedHeapDeltaBytes))) {
          throw new Error('Timing or memory samples are not finite and usable.')
        }
        if (metric === 'allocation' && matching.some(sample => !Number.isFinite(sample.sampledAllocationBytes) || sample.sampledAllocationBytes! <= 0)) {
          throw new Error('Allocation profiling did not produce usable samples.')
        }
      }
    }
  }
}

export function summarizeAnalysisSamples(samples: AnalysisSample[]) {
  assertAnalysisSamples(samples)
  const median = (values: number[]) => {
    const sorted = [...values].sort((left, right) => left - right)
    const middle = Math.floor(sorted.length / 2)
    return sorted.length % 2 ? sorted[middle]! : (sorted[middle - 1]! + sorted[middle]!) / 2
  }
  return ['cold', 'warm'].flatMap(condition => ['duplicate-control', 'shared'].map((variant) => {
    const timing = samples.filter(sample => sample.condition === condition && sample.variant === variant && sample.metric === 'timing')
    const allocation = samples.filter(sample => sample.condition === condition && sample.variant === variant && sample.metric === 'allocation')
    return {
      variant,
      condition,
      compileMedianMs: median(timing.map(sample => sample.compileMs)),
      sampledAllocationMedianBytes: median(allocation.map(sample => sample.sampledAllocationBytes!)),
      processPeakRssMedianBytes: median(timing.map(sample => sample.processPeakRssBytes)),
      retainedHeapDeltaMedianBytes: median(timing.map(sample => sample.retainedHeapDeltaBytes)),
    }
  }))
}
