import type { Profiler } from 'node:inspector'
import type { OptimizedCompilerVariant } from './execution'
import type { OptimizedScenario } from './scenarios'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { isDeepStrictEqual } from 'node:util'
import { summarizeCpuProfile } from '../astMigrationProfile/cpuSummary'
import { mergeCpuProfiles } from './cpu'
import { digest, repository } from './identity'
import { object, verifyOptimizedCheck, verifyStartup } from './verify'

/** 逐次摘要绑定原始完整输出；不能只因采样数量足够就忽略编译失败或覆盖缺失。 */
export function verifyCpuObservation(value: unknown, entry: OptimizedScenario, variant: OptimizedCompilerVariant, iteration: number, output: string) {
  const observation = object(value)
  if (observation.outputSha256 !== digest(output)) {
    throw new Error('CPU observation output digest differs from the original compiler')
  }
  verifyOptimizedCheck({ ...observation, output }, entry, variant, iteration)
  return observation
}

/** 父进程重算所有原始图，验证采样数量、区间、hash 与公开归因结果一致。 */
export async function verifyCpuWorker(raw: string, directory: string, entry: OptimizedScenario, variant: OptimizedCompilerVariant, sourceHashes: Record<string, string>, bindingSha256: string, oracle: string) {
  const report = verifyStartup(JSON.parse(raw) as unknown, variant, sourceHashes, bindingSha256)
  if (report.initialOutput !== oracle || !Array.isArray(report.warmups) || report.warmups.length !== 14
    || !Array.isArray(report.samples) || report.samples.length !== 20) {
    throw new Error('CPU worker must preserve the original compiler output and all fixed observations')
  }
  const initial = verifyCpuObservation(report.initial, entry, variant, 0, oracle)
  const warmups = report.warmups.map((value, index) => verifyCpuObservation(value, entry, variant, index, oracle))
  const samples = report.samples.map((value, index) => verifyCpuObservation(value, entry, variant, index, oracle))
  const profiles: Profiler.Profile[] = []
  for (const [index, sample] of samples.entries()) {
    if (sample.profileFile !== `profile-${index}.json`) {
      throw new Error('CPU worker profile order or filename differs')
    }
    const bytes = await readFile(path.join(directory, sample.profileFile))
    if (sample.profileSha256 !== digest(bytes)) {
      throw new Error('CPU raw profile digest differs')
    }
    const profile = JSON.parse(bytes.toString('utf8')) as Profiler.Profile
    if (sample.profileStartTime !== profile.startTime || sample.profileEndTime !== profile.endTime
      || sample.profileDurationMicroseconds !== profile.endTime - profile.startTime
      || sample.profileSamples !== profile.samples?.length) {
      throw new Error('CPU raw profile interval or sample count differs')
    }
    const previous = profiles.at(-1)
    if (previous && profile.startTime < previous.endTime) {
      throw new Error('CPU profile windows overlap or are out of order')
    }
    profiles.push(profile)
  }
  const aggregate = mergeCpuProfiles(profiles)
  const cpuSummary = summarizeCpuProfile(aggregate, repository)
  if (!isDeepStrictEqual(cpuSummary, report.cpuSummary)) {
    throw new Error('CPU worker summary differs from the raw sample trees')
  }
  return {
    variant,
    scenario: entry.scenario.id,
    reportSha256: digest(raw),
    inputSha256: digest(JSON.stringify(entry.scenario)),
    outputSha256: digest(oracle),
    hookSources: report.hookSources,
    initial,
    warmups,
    samples,
    aggregateKind: aggregate.aggregateKind,
    sourceProfileCount: aggregate.sourceProfileCount,
    environment: report.environment,
    cpuSummary,
  }
}
