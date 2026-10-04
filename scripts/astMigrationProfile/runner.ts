import type { CompilerObservation } from '../../packages-runtime/wevu-compiler/src/profiling/types'
import type { NativeAnalysisStats } from '../../packages/ast/src/native/observation'
import { createHash } from 'node:crypto'
import { performance } from 'node:perf_hooks'
import process from 'node:process'
import { isDeepStrictEqual } from 'node:util'
import { compileVueFile } from '../../packages-runtime/wevu-compiler/src/plugins/vue/transform/compileVueFile'
import { transformScript } from '../../packages-runtime/wevu-compiler/src/plugins/vue/transform/transformScript'
import { observeNativeAnalysis } from '../../packages/ast/src/native/observation'
import { createTransformScriptFixture, createVueSfcFixture } from './fixtures'
import { observeBatchGc } from './gc'
import { profileCompileVueFilePhases, profileTransformScriptPhases } from './profile'

interface Sample {
  baselineWallMs: number
  observation: CompilerObservation
  outputSha256: string
  native: {
    scope: 'observed real compiler entry; warmup and baseline excluded'
    counters: NativeAnalysisStats
  }
}

function outputHash(value: unknown) {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex')
}

function assertEquivalent(baseline: unknown, observed: unknown) {
  if (!isDeepStrictEqual(baseline, observed)) {
    throw new Error('Observed compiler output, source map or warnings differ from the unobserved real entry.')
  }
}

/** 单进程入口归因仅用于诊断；正式冷热进程及 native 配对采样由独立 runner 负责。 */
async function collectCompilerProfile(options: { iterations?: number, warmup?: number }) {
  const iterations = options.iterations ?? 20
  const warmup = options.warmup ?? 5
  if (!Number.isInteger(iterations) || iterations < 1 || !Number.isInteger(warmup) || warmup < 0) {
    throw new Error('iterations must be a positive integer and warmup a non-negative integer')
  }
  const scriptSource = createTransformScriptFixture()
  const sfcSource = createVueSfcFixture()
  const scriptSamples: Sample[] = []
  const sfcSamples: Sample[] = []
  const filename = 'src/pages/profile/index.vue'
  const compileOptions = { isPage: true, wevuDefaults: { component: { options: { virtualHost: false } } } }

  for (let index = 0; index < warmup + iterations; index++) {
    const scriptWarnings: string[] = []
    const scriptStarted = performance.now()
    const scriptBaseline = transformScript(scriptSource, { isPage: true, warn: message => scriptWarnings.push(message) })
    const baselineScriptWallMs = performance.now() - scriptStarted
    const scriptNative = await observeNativeAnalysis(() => profileTransformScriptPhases(scriptSource, { isPage: true }))
    const scriptObserved = scriptNative.value
    assertEquivalent({ value: scriptBaseline, warnings: scriptWarnings }, { value: scriptObserved.value, warnings: scriptObserved.warnings })

    const sfcWarnings: string[] = []
    const sfcStarted = performance.now()
    const sfcBaseline = await compileVueFile(sfcSource, filename, { ...compileOptions, warn: message => sfcWarnings.push(message) })
    const baselineSfcWallMs = performance.now() - sfcStarted
    const sfcNative = await observeNativeAnalysis(() => profileCompileVueFilePhases(sfcSource, filename, compileOptions))
    const sfcObserved = sfcNative.value
    assertEquivalent({ value: sfcBaseline, warnings: sfcWarnings }, { value: sfcObserved.value, warnings: sfcObserved.warnings })
    if (index >= warmup) {
      scriptSamples.push({ baselineWallMs: baselineScriptWallMs, observation: scriptObserved.observation, native: { scope: 'observed real compiler entry; warmup and baseline excluded', counters: scriptNative.stats }, outputSha256: outputHash({ value: scriptBaseline, warnings: scriptWarnings }) })
      sfcSamples.push({ baselineWallMs: baselineSfcWallMs, observation: sfcObserved.observation, native: { scope: 'observed real compiler entry; warmup and baseline excluded', counters: sfcNative.stats }, outputSha256: outputHash({ value: sfcBaseline, warnings: sfcWarnings }) })
    }
  }
  return {
    schemaVersion: 2,
    measurement: 'Real compiler entry diagnostics; sequential unobserved/observed pairs, not formal speedup evidence.',
    limitations: [
      'Stage durations are inclusive wall time; nested stages must not be summed.',
      'CPU is process-wide root usage; it may include other concurrent work and is not phase CPU.',
      'Babel counters cover compiler wrappers only; Vue/Oxc/native internal parse and generate counts remain unknown.',
      'selfWallMs is time outside observed child spans, not exclusive CPU; asynchronous overlap is subtracted by interval union.',
      'Native counters record instrumented binding calls, input bytes, cache hits and fallbacks; they are not Rust parse counts.',
      'Native counter coverage requires rebuilt @weapp-vite/ast artifacts carrying the shared diagnostic channel; uninstrumented dependencies are outside this scope.',
      'GC is process-wide for the whole diagnostic batch, including warmup and both sides of pairs; it is not phase attribution.',
      'Wall time minus process CPU is not reported as wait time: process CPU may include parallel or unrelated work.',
      'No native speedup or end-to-end build/HMR acceleration is inferred from this report.',
    ],
    environment: { node: process.version, platform: process.platform, arch: process.arch },
    nativeRequested: process.env.WEAPP_VITE_NATIVE === '1',
    iterations,
    warmup,
    scenarios: [
      { id: 'transformScript', inputSha256: outputHash(scriptSource), samples: scriptSamples },
      { id: 'compileVueFile', inputSha256: outputHash(sfcSource), samples: sfcSamples },
    ],
  }
}

/** GC 覆盖整个诊断批次，native 计数另按真实被观察入口隔离。 */
export async function runCompilerProfile(options: { iterations?: number, warmup?: number } = {}) {
  const batch = await observeBatchGc(() => collectCompilerProfile(options))
  return { ...batch.value, gc: batch.gc }
}
