import type { EditSequence } from './driver'
import type { SequenceStepResult } from './measurement'
import { evaluateResourceTrend } from './measurement'
import { buildSequences } from './scenarios'

/** 同一会话循环更新同一依赖；保留每轮完整基线，不通过重启掩盖资源增长。 */
export function createResourceSequence(cycles = 14): EditSequence {
  if (!Number.isInteger(cycles) || cycles < 14 || cycles > 120) {
    throw new Error('Resource observation requires 14–120 cycles')
  }
  return {
    name: 'build-warm-resource-trend',
    files: buildSequences[0]!.files,
    steps: Array.from({ length: cycles }, (_, index) => ({
      name: `continuous dependency edit ${index + 1}`,
      action: { kind: 'write' as const, file: 'value.js', content: `export const value = "cycle-${index + 1}";` },
    })),
  }
}

/** 精确资源计数不允许持续增长；内存使用宽限窗口，超限仅表示需要调查。 */
export function summarizeResourceSequence(steps: SequenceStepResult[]) {
  const samples = steps.map(step => step.measurement)
  if (samples.some(sample => !sample)) {
    throw new Error('Missing incremental worker resource observation')
  }
  if (samples.some(sample => !sample!.processTree || !sample!.gc?.forced || !sample!.session || !sample!.build)) {
    throw new Error('Resource gates require process-tree RSS, forced-GC heap, build scope and session observations')
  }
  const trend = (values: number[], maxGrowth: number) => evaluateResourceTrend(values, { warmup: 3, window: 4, maxGrowth })
  const result = {
    rss: trend(samples.map(sample => sample!.process.memory.rss), 32 * 1024 * 1024),
    heapUsed: trend(samples.map(sample => sample!.process.memory.heapUsed), 16 * 1024 * 1024),
    processTreeRss: trend(samples.map(sample => sample!.processTree!.rssBytes), 32 * 1024 * 1024),
    processTreeCount: trend(samples.map(sample => sample!.processTree!.processCount), 0),
    gcDuration: trend(samples.map(sample => sample!.gc!.durationMs), 50),
    gcCount: trend(samples.map(sample => sample!.gc!.count), 2),
    watchers: trend(samples.map(sample => sample!.session!.watchers), 0),
    engines: trend(samples.map(sample => sample!.session!.engines), 0),
    transformCalls: trend(samples.map(sample => sample!.build!.transformCalls), 0),
    transformedModules: trend(samples.map(sample => sample!.build!.transformedModules.length), 0),
    outputFiles: trend(samples.map(sample => sample!.build!.outputFiles.length), 0),
    resources: Object.fromEntries([...new Set(samples.flatMap(sample => Object.keys(sample!.process.resources)))].sort()
      .map(type => [type, trend(samples.map(sample => sample!.process.resources[type] ?? 0), 0)])),
    processListeners: Object.fromEntries([...new Set(samples.flatMap(sample => Object.keys(sample!.process.processListeners)))].sort()
      .map(type => [type, trend(samples.map(sample => sample!.process.processListeners[type] ?? 0), 0)])),
  }
  return result
}

export function assertResourceSequence(result: ReturnType<typeof summarizeResourceSequence>) {
  const { resources, processListeners, ...direct } = result
  for (const [name, trend] of Object.entries({ ...direct, ...Object.fromEntries(Object.entries(resources).map(([name, value]) => [`resource:${name}`, value])), ...Object.fromEntries(Object.entries(processListeners).map(([name, value]) => [`listener:${name}`, value])) })) {
    if (trend.status !== 'stable') {
      throw new Error(`Resource trend ${name}: ${trend.status}; ${JSON.stringify(trend)} (growth requires investigation, not proof of a leak)`)
    }
  }
}
