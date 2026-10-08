import type { Profiler } from 'node:inspector'
import { createHash } from 'node:crypto'
import { access, readFile, writeFile } from 'node:fs/promises'
import { Session } from 'node:inspector/promises'
import { cpus, loadavg } from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { isDeepStrictEqual } from 'node:util'
import { compileVueFile } from '../../packages-runtime/wevu-compiler/src/plugins/vue/transform/compileVueFile'
import { summarizeCpuProfile } from './cpuSummary'
import { createVueSfcFixture } from './fixtures'

const repositoryRoot = fileURLToPath(new URL('../../', import.meta.url))
const args = process.argv.slice(2)
const argument = (name: string) => args.find(arg => arg.startsWith(`--${name}=`))?.slice(name.length + 3)

function digest(value: string) {
  return createHash('sha256').update(value).digest('hex')
}

async function assertNewFile(filename: string) {
  try {
    await access(filename)
  }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return
    }
    throw error
  }
  throw new Error('CPU profile output already exists')
}

/** 只采样真实编译入口的主线程；导入、预热、输出校验和报告生成在采样窗口外。 */
async function main() {
  const output = argument('output')
  const rawOutput = argument('raw-profile')
  const sourceFile = argument('source')
  const iterations = Number(argument('iterations') ?? '60')
  if (!output || !rawOutput || path.resolve(output) === path.resolve(rawOutput)
    || !Number.isSafeInteger(iterations) || iterations < 1 || process.env.WEAPP_VITE_NATIVE === '1') {
    throw new Error('Expected --output=<new summary.json> --raw-profile=<new local.cpuprofile> [--source=<repository SFC>] [--iterations=60], with WEAPP_VITE_NATIVE unset/0')
  }
  await Promise.all([assertNewFile(output), assertNewFile(rawOutput)])
  const filename = sourceFile
    ? path.relative(repositoryRoot, path.resolve(sourceFile)).split(path.sep).join('/')
    : 'src/pages/profile/index.vue'
  if (filename.startsWith('../') || path.isAbsolute(filename) || !filename.endsWith('.vue')) {
    throw new Error('Expected a repository-relative Vue SFC')
  }
  const fixture = sourceFile ? await readFile(sourceFile, 'utf8') : createVueSfcFixture()
  const [compilerSource, bindingSource] = await Promise.all([
    readFile(new URL('../../packages-runtime/wevu-compiler/src/plugins/vue/transform/compileVueFile/index.ts', import.meta.url), 'utf8'),
    readFile(new URL('../../packages-runtime/wevu-compiler/src/plugins/vue/compiler/template/bindingManifest.ts', import.meta.url), 'utf8'),
  ])
  const compileOptions = { isPage: true, wevuDefaults: { component: { options: { virtualHost: false } } } }
  let warnings: string[] = []
  const compile = () => {
    warnings = []
    return compileVueFile(fixture, filename, { ...compileOptions, warn: message => warnings.push(message) })
  }
  let result = await compile()
  for (let index = 1; index < 5; index++) {
    result = await compile()
  }
  const baseline = { value: result, warnings }
  const initialLoad = loadavg()
  const session = new Session()
  session.connect()
  const startedAt = new Date().toISOString()
  let profile: Profiler.Profile
  try {
    await session.post('Profiler.enable')
    await session.post('Profiler.setSamplingInterval', { interval: 1000 })
    await session.post('Profiler.start')
    try {
      for (let index = 0; index < iterations; index++) {
        result = await compile()
      }
    }
    finally {
      const stopped = await session.post('Profiler.stop')
      profile = stopped.profile
    }
  }
  finally {
    session.disconnect()
  }
  const finishedAt = new Date().toISOString()
  if (!isDeepStrictEqual(baseline, { value: result, warnings })) {
    throw new Error('The final sampled compilation differs from the warmup output, map or warnings')
  }
  const raw = `${JSON.stringify(profile)}\n`
  const report = {
    schemaVersion: 1,
    scope: 'V8 main-thread samples during repeated real compileVueFile calls; not phase CPU percentages, native internals, or speedup evidence.',
    fixture: sourceFile ? filename : 'scripts/astMigrationProfile/fixtures.ts:createVueSfcFixture',
    fixtureSha256: digest(fixture),
    compilerEntrySourceSha256: digest(compilerSource),
    bindingAnalysisSourceSha256: digest(bindingSource),
    outputSha256: digest(JSON.stringify({ value: result, warnings })),
    lastOutputMatchesWarmup: true,
    compileOptions,
    iterations,
    warmup: 5,
    samplingIntervalMicroseconds: 1000,
    rawProfileSha256: digest(raw),
    profileDurationMicroseconds: profile.endTime - profile.startTime,
    environment: { node: process.version, platform: process.platform, arch: process.arch, cpus: cpus().length, startedAt, finishedAt, initialLoad, finalLoad: loadavg() },
    limitations: [
      'Sample proportions describe the V8 main thread only; Rust, worker threads and child processes are not separately profiled.',
      'Inspector and OS scheduling affect sampling; counts are not process-wide CPU time or performance acceptance.',
      'Inclusive rows overlap and must not be summed. Recursion counts once per sample per function or module.',
      'GC, idle and unattributed samples remain in the denominator; import and warmup are outside the sampling window.',
      'Frame line/column locations come from V8 generated code, without source-map remapping.',
      'Only the final sampled output, map and warnings are compared with the last warmup output; intermediate outputs are not retained.',
      'The local raw cpuprofile includes original source URLs and must be reviewed before sharing; this summary sanitizes URLs.',
      'Source hashes identify the named compiler entry and binding module only, not every compiler file or dependency.',
    ],
    ...summarizeCpuProfile(profile, repositoryRoot),
  }
  await writeFile(rawOutput, raw, { flag: 'wx' })
  await writeFile(output, `${JSON.stringify(report, null, 2)}\n`, { flag: 'wx' })
  console.log(JSON.stringify({ iterations, totalSamples: report.totalSamples, lastOutputMatchesWarmup: true }))
}

main().catch((error: unknown) => {
  console.error(error)
  process.exitCode = 1
})
