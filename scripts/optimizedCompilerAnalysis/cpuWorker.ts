import type { Profiler } from 'node:inspector'
import type { CpuWorkloadState } from './cpuWorkload'
import type { OptimizedCompilerVariant } from './execution'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { isDeepStrictEqual } from 'node:util'
import { summarizeCpuProfile } from '../astMigrationProfile/cpuSummary'
import { sanitizeScriptDiagnostic } from '../scriptAnalysisBaseline/diagnostics'
import { scriptScenarios } from '../scriptAnalysisBaseline/scenarios'
import { TIMING_CORPORA } from '../scriptAnalysisBaseline/timing/types'
import { createCompilerCpuProfiler, mergeCpuProfiles } from './cpu'
import { collectCompilerCpuWorkload, CPU_SAMPLE_ROUNDS, CPU_WARMUP_ROUNDS } from './cpuWorkload'
import { serializeDiagnosticError } from './diagnosticError'
import { createOptimizedCompilerExecution, OPTIMIZED_COMPILER_VARIANTS } from './execution'
import { digest, optimizedSourceIdentity, repository } from './identity'
import { expectedHookSources } from './verify'

/** 每个代表 SFC 和组合模式独占进程；只归因 V8 主线程采样，不输出加速或耗时比较。 */
async function main() {
  const args = process.argv.slice(2)
  const [variant, bindingArgument, scenarioId, outputArgument] = args as [OptimizedCompilerVariant, string, typeof TIMING_CORPORA[number], string]
  if (args.length !== 4 || !OPTIMIZED_COMPILER_VARIANTS.includes(variant) || !bindingArgument?.endsWith('.node')
    || !TIMING_CORPORA.includes(scenarioId) || !outputArgument || process.env.WEAPP_VITE_NATIVE !== '0') {
    throw new Error('Expected <variant> <experimental .node> <sfc-pressure|sfc-retail|sfc-wevu> <new output directory> and WEAPP_VITE_NATIVE=0')
  }
  const output = path.resolve(outputArgument)
  const bindingPath = path.resolve(bindingArgument)
  await mkdir(output)
  const startedAt = new Date().toISOString()
  const initialLoad = os.loadavg()
  const failures: unknown[] = []
  const cleanupErrors: unknown[] = []
  let sourceHashes: Record<string, string> = {}
  let sourceHashesAfter: Record<string, string> = {}
  let hookSources: Record<string, string> = {}
  let bindingSha256: string | undefined
  let bindingSha256After: string | undefined
  let scenario: Awaited<ReturnType<typeof scriptScenarios>>[number] | undefined
  let workload: CpuWorkloadState = { observations: [], profileArtifacts: [], failures: [] }
  let cpuSummary: ReturnType<typeof summarizeCpuProfile> | undefined
  let execution: Awaited<ReturnType<typeof createOptimizedCompilerExecution>> | undefined
  let profiler: Awaited<ReturnType<typeof createCompilerCpuProfiler>> | undefined
  try {
    sourceHashes = await optimizedSourceIdentity()
    bindingSha256 = digest(await readFile(bindingPath))
    scenario = (await scriptScenarios()).find(entry => entry.kind === 'sfc' && entry.id === scenarioId)
    if (!scenario) {
      throw new Error('Representative CPU scenario is missing')
    }
    execution = await createOptimizedCompilerExecution(variant, bindingPath)
    hookSources = execution.sourceHashes
    if (!isDeepStrictEqual(hookSources, expectedHookSources(variant, sourceHashes))
      || (variant === 'optimized-native' && execution.bindingSha256 !== bindingSha256)) {
      throw new Error('Compiler hook or loaded binding identity differs from the frozen input')
    }
    profiler = await createCompilerCpuProfiler()
    workload = await collectCompilerCpuWorkload(scenario, variant, {
      execution,
      profiler,
      async saveProfile(index, profile) {
        const file = `profile-${index}.json`
        const raw = `${JSON.stringify(profile)}\n`
        await writeFile(path.join(output, file), raw, { flag: 'wx', mode: 0o600 })
        if (!Number.isFinite(profile.startTime) || !Number.isFinite(profile.endTime) || profile.endTime < profile.startTime || !Array.isArray(profile.samples)) {
          throw new Error('Inspector produced an invalid profile interval or samples')
        }
        return { index, file, sha256: digest(raw), startTime: profile.startTime, endTime: profile.endTime, durationMicroseconds: profile.endTime - profile.startTime, sampleCount: profile.samples.length }
      },
    })
    failures.push(...workload.failures)
  }
  catch (error) {
    failures.push(error)
  }
  finally {
    for (const owner of [profiler, execution]) {
      try {
        await owner?.dispose()
      }
      catch (error) {
        cleanupErrors.push(error)
      }
    }
  }
  try {
    sourceHashesAfter = await optimizedSourceIdentity()
  }
  catch (error) {
    failures.push(error)
  }
  try {
    bindingSha256After = digest(await readFile(bindingPath))
  }
  catch (error) {
    failures.push(error)
  }
  try {
    if (workload.profileArtifacts.length) {
      const profiles: Profiler.Profile[] = []
      for (const artifact of workload.profileArtifacts) {
        const raw = await readFile(path.join(output, artifact.file), 'utf8')
        if (digest(raw) !== artifact.sha256) {
          throw new Error('Saved CPU profile identity changed')
        }
        profiles.push(JSON.parse(raw) as Profiler.Profile)
      }
      cpuSummary = summarizeCpuProfile(mergeCpuProfiles(profiles), repository)
    }
  }
  catch (error) {
    failures.push(error)
  }
  const sourcesUnchanged = Object.keys(sourceHashes).length > 0 && isDeepStrictEqual(sourceHashes, sourceHashesAfter)
  const bindingUnchanged = bindingSha256 !== undefined && bindingSha256 === bindingSha256After
  const initial = workload.observations.find(row => row.phase === 'initial')
  const warmups = workload.observations.filter(row => row.phase === 'warmup')
  const samples = workload.observations.filter(row => row.phase === 'sample').map((row) => {
    const artifact = workload.profileArtifacts.find(entry => entry.index === row.index)
    return {
      ...row,
      profileFile: artifact?.file,
      profileSha256: artifact?.sha256,
      profileStartTime: artifact?.startTime,
      profileEndTime: artifact?.endTime,
      profileDurationMicroseconds: artifact?.durationMicroseconds,
      profileSamples: artifact?.sampleCount,
    }
  })
  const report = {
    schemaVersion: 1,
    scope: 'Sequential per-call V8 main-thread attribution of the complete compiler; not performance or build/HMR/runtime acceptance',
    variant,
    scenario: { id: scenarioId, inputSha256: scenario ? digest(JSON.stringify(scenario)) : undefined, sourceSha256: scenario ? digest(scenario.source) : undefined },
    passed: failures.length === 0 && cleanupErrors.length === 0 && sourcesUnchanged && bindingUnchanged
      && workload.observations.length === 1 + CPU_WARMUP_ROUNDS + CPU_SAMPLE_ROUNDS
      && workload.profileArtifacts.length === CPU_SAMPLE_ROUNDS && cpuSummary !== undefined,
    failure: failures.length ? failures.map(serializeDiagnosticError) : undefined,
    cleanupErrors: cleanupErrors.map(serializeDiagnosticError),
    sourceHashes,
    sourceHashesAfter,
    hookSources,
    sourcesUnchanged,
    bindingSha256,
    bindingSha256After,
    bindingUnchanged,
    samplingIntervalMicroseconds: 1000,
    requestedWarmupRounds: CPU_WARMUP_ROUNDS,
    requestedSamples: CPU_SAMPLE_ROUNDS,
    completedWarmupRounds: warmups.length,
    completedSamples: samples.length,
    initialOutput: workload.initialOutput,
    initial,
    warmups,
    samples,
    profileArtifacts: workload.profileArtifacts,
    mismatch: workload.mismatch,
    aggregateKind: 'counts-only',
    cpuSummary,
    environment: { node: process.version, platform: process.platform, arch: process.arch, cpus: os.cpus().length, startedAt, finishedAt: new Date().toISOString(), initialLoad, finalLoad: os.loadavg() },
    limitations: [
      'Only compileVueFile runs inside each inspector window; imports, warmups, hashes, serialization, output validation and metric snapshots run outside it.',
      'All initial, warmup and sampled outputs, maps, warnings and diagnostics must exactly match this worker first output; cross-variant equality is checked by the parent collector.',
      'V8 samples describe the main thread only, not Rust internals, worker threads, child processes, process-wide CPU time or wall-time speedup.',
      'Inspector start/stop overhead and scheduling affect samples; zero-sample individual windows remain explicit.',
      'Raw profile trees are saved and released between calls; only after all calls are finished are they merged for global function ranking.',
      'The aggregate contains counts only, with a zero synthetic timeline and no timeDeltas; gaps between original profiles are never concatenated into elapsed time.',
      'Inclusive rows overlap and must not be summed; GC, idle and unattributed samples remain in the denominator.',
      'Raw profiles and report.json contain original URLs or full compiler outputs and remain private; summary.json is sanitized.',
      'Source/configuration/lockfile identities do not verify every installed dependency file or establish the native binary build revision.',
    ],
  }
  await writeFile(path.join(output, 'report.json'), `${JSON.stringify(report, null, 2)}\n`, { flag: 'wx', mode: 0o600 })
  const { initialOutput, mismatch: _mismatch, ...publicReport } = report
  const summary = sanitizeScriptDiagnostic({ ...publicReport, initialOutputSha256: initialOutput === undefined ? undefined : digest(initialOutput) }, [output, repository, path.dirname(bindingPath), process.cwd(), os.homedir()])
  await writeFile(path.join(output, 'summary.json'), `${JSON.stringify(summary, null, 2)}\n`, { flag: 'wx' })
  if (!report.passed) {
    process.exitCode = 1
  }
}

main().catch((error: unknown) => {
  console.error(error)
  process.exitCode = 1
})
