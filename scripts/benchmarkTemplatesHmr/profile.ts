import type { HmrProfileJsonSample } from '../../packages/weapp-vite/src/analyze/hmr'
import { readHmrProfileLines } from '../../packages/weapp-vite/src/analyze/hmr/reader'

export type BenchmarkHmrRuntime = 'stateful' | 'standard'
export type BenchmarkProfileStatus = 'available' | 'disabled' | 'missing' | 'read-error' | 'incompatible' | 'incomplete'

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
    if (!samples.length) {
      return { profile: {}, status: coverage.incompatible ? 'incompatible' : coverage.incomplete ? 'incomplete' : 'missing' }
    }
    if (runtime === 'stateful' && samples[0]?.pipeline !== 'stateful') {
      return { profile: {}, status: 'incompatible' }
    }
    return { profile, status: 'available' }
  }
  catch {
    return { profile: {}, status: 'read-error' }
  }
}

/** 只接受明确的文件关联；多文件批次从 sourceEvents 匹配，不把无来源样本归给当前编辑。 */
export function matchesHmrProfileSource(sample: HmrProfileJsonSample, expectedPaths: string[]) {
  const normalize = (value: string) => value.replaceAll('\\', '/')
  const expected = new Set(expectedPaths.map(normalize))
  const candidates = [sample.file, sample.relativeFile, sample.sourceRootFile, ...(sample.sourceEvents ?? []).map(event => event.file)]
  return candidates.some(candidate => typeof candidate === 'string' && expected.has(normalize(candidate)))
}
