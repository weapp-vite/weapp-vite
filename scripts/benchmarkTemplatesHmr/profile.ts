import type { HmrProfileJsonSample } from '../../packages/weapp-vite/src/analyze/hmr'
import { readHmrProfileLines } from '../../packages/weapp-vite/src/analyze/hmr/reader'

export type BenchmarkHmrRuntime = 'stateful' | 'standard'
export type BenchmarkProfileStatus = 'available' | 'disabled' | 'missing' | 'read-error' | 'incompatible' | 'incomplete'

/** 历史无管线记录只属于 standard，不能在回退时混入 stateful 样本。 */
function matchesHmrProfileRuntime(sample: HmrProfileJsonSample, runtime: BenchmarkHmrRuntime) {
  return (sample.pipeline ?? 'standard') === runtime
}

/** 两条管线都读取实际 profile；缺失或不匹配时保留 unknown，不使用外部时长填充。 */
export async function collectBenchmarkHmrProfile<T extends { totalMs?: number }>(
  runtime: BenchmarkHmrRuntime,
  readProfile: () => Promise<T>,
  enabled = true,
): Promise<{ profile: T | Record<string, never>, status: BenchmarkProfileStatus }> {
  if (!enabled) {
    return { profile: {}, status: 'disabled' }
  }
  try {
    const profile = await readProfile()
    const { samples, coverage } = readHmrProfileLines(JSON.stringify(profile))
    const sample = samples[0]
    if (!sample) {
      return { profile: {}, status: coverage.incompatible ? 'incompatible' : coverage.incomplete ? 'incomplete' : 'missing' }
    }
    if (!matchesHmrProfileRuntime(sample, runtime)) {
      return { profile: {}, status: 'incompatible' }
    }
    return { profile, status: 'available' }
  }
  catch {
    return { profile: {}, status: 'read-error' }
  }
}

/** 每次产物发布后重新确认管线；classic 回退不能沿用场景开始时的 stateful 过滤条件。 */
export async function collectBenchmarkHmrPhaseProfile<T extends { totalMs?: number }>(
  runtimeBefore: BenchmarkHmrRuntime,
  readRuntime: () => Promise<BenchmarkHmrRuntime>,
  readProfile: (runtime: BenchmarkHmrRuntime) => Promise<T>,
  enabled = true,
) {
  const runtimeAfter = await readRuntime()
  return {
    ...await collectBenchmarkHmrProfile(runtimeAfter, () => readProfile(runtimeAfter), enabled),
    runtimeBefore,
    runtimeAfter,
  }
}

/** 只接受明确的文件关联；多文件批次从 sourceEvents 匹配，不把无来源样本归给当前编辑。 */
export function matchesHmrProfileSource(sample: HmrProfileJsonSample, expectedPaths: string[]) {
  const normalize = (value: string) => value.replaceAll('\\', '/')
  const expected = new Set(expectedPaths.map(normalize))
  const candidates = [sample.file, sample.relativeFile, sample.sourceRootFile, ...(sample.sourceEvents ?? []).map(event => event.file)]
  return candidates.some(candidate => typeof candidate === 'string' && expected.has(normalize(candidate)))
}

/** 只从本阶段的新记录中选取同管线、同来源的最新样本。 */
export function findBenchmarkHmrProfileSample(samples: HmrProfileJsonSample[], runtime: BenchmarkHmrRuntime, expectedPaths: string[]) {
  return samples.findLast(sample => matchesHmrProfileRuntime(sample, runtime) && matchesHmrProfileSource(sample, expectedPaths))
}
