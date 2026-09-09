export type BenchmarkHmrRuntime = 'stateful' | 'standard'
export type BenchmarkProfileStatus = 'available' | 'unavailable-stateful' | 'missing' | 'read-error'

/** stateful 由传输与输出确认更新，不等待仅标准构建链提供的编译 profile。 */
export async function collectBenchmarkHmrProfile<T extends { totalMs?: number }>(
  runtime: BenchmarkHmrRuntime,
  readProfile: () => Promise<T>,
): Promise<{ profile: T | Record<string, never>, status: BenchmarkProfileStatus }> {
  if (runtime === 'stateful') {
    return { profile: {}, status: 'unavailable-stateful' }
  }
  try {
    const profile = await readProfile()
    return { profile, status: typeof profile.totalMs === 'number' ? 'available' : 'missing' }
  }
  catch {
    return { profile: {}, status: 'read-error' }
  }
}
