import type { HmrProfileJsonSample } from '../../packages/weapp-vite/src/analyze/hmr'
import { readHmrProfileLines } from '../../packages/weapp-vite/src/analyze/hmr/reader'

export type BenchmarkHmrRuntime = 'stateful' | 'standard'
export type BenchmarkProfileStatus = 'available' | 'unavailable-stateful' | 'disabled' | 'missing' | 'read-error' | 'incompatible' | 'incomplete'

/** stateful 由传输与输出确认更新，不等待仅标准构建链提供的编译 profile。 */
export async function collectBenchmarkHmrProfile<T extends { totalMs?: number }>(
  runtime: BenchmarkHmrRuntime,
  readProfile: () => Promise<T>,
  enabled = true,
): Promise<{ profile: T | Record<string, never>, status: BenchmarkProfileStatus }> {
  if (!enabled) {
    return { profile: {}, status: 'disabled' }
  }
  if (runtime === 'stateful') {
    return { profile: {}, status: 'unavailable-stateful' }
  }
  try {
    const profile = await readProfile()
    const { samples, coverage } = readHmrProfileLines(JSON.stringify(profile))
    if (!samples.length) {
      return { profile: {}, status: coverage.incompatible ? 'incompatible' : coverage.incomplete ? 'incomplete' : 'missing' }
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
