import type { CompileSample, CompileScenario, CompileVariant } from './compileProtocol'
import { createHash } from 'node:crypto'
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import { cpus, loadavg } from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { createCompileProcess } from './compileProcess'
import { COMPILE_VARIANTS } from './compileProtocol'
import { compileScenarios } from './compileScenarios'
import { balancedOrders } from './orders'

const root = fileURLToPath(new URL('../../', import.meta.url))
const digest = (value: string) => createHash('sha256').update(value).digest('hex')

function distribution(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b)
  return { p50: sorted[Math.ceil(sorted.length / 2) - 1], p95: sorted[Math.ceil(sorted.length * 0.95) - 1] }
}

async function toolSourceHashes() {
  const prefix = 'scripts/nativeBindingAnalysis/'
  const files = [
    'compile.ts',
    'compileWorker.ts',
    'compileScenarios.ts',
    'compileProcess.ts',
    'workerProcess.ts',
    'workerLifecycle.ts',
    'compileProtocol.ts',
    'globals.ts',
    'orders.ts',
    'replay.ts',
    ...(await readdir(path.join(root, prefix, 'compileBatch'))).filter(name => name.endsWith('.ts') && !name.endsWith('.test.ts')).map(name => `compileBatch/${name}`),
  ].sort()
  return Object.fromEntries(await Promise.all(files.map(async file => [prefix + file, digest(await readFile(path.join(root, prefix, file), 'utf8'))])))
}

async function compilerIdentity(binding: string) {
  const prefix = 'packages-runtime/wevu-compiler/src'
  const files: string[] = []
  const collect = async (directory: string) => {
    for (const entry of await readdir(path.join(root, directory), { withFileTypes: true })) {
      const relative = `${directory}/${entry.name}`
      if (entry.isDirectory()) {
        await collect(relative)
      }
      else if (entry.isFile() && entry.name.endsWith('.ts') && !/\.(?:test|spec)\.ts$/.test(entry.name)) {
        files.push(relative)
      }
    }
  }
  await collect(prefix)
  const manifest = await Promise.all(files.sort().map(async file => [file, digest(await readFile(path.join(root, file), 'utf8'))]))
  return {
    compilerSourceFiles: files.length,
    compilerSourceTreeSha256: digest(JSON.stringify(manifest)),
    lockfileSha256: digest(await readFile(path.join(root, 'pnpm-lock.yaml'), 'utf8')),
    bindingSha256: createHash('sha256').update(await readFile(binding)).digest('hex'),
  }
}

/** 五个独立进程串行编译同一输入；每轮完整校验，不用计时外分析结果预填缓存。 */
async function main() {
  const argument = (name: string) => process.argv.find(arg => arg.startsWith(`--${name}=`))?.slice(name.length + 3)
  const binding = argument('binding')
  const output = argument('output')
  const selected = argument('scenario') ?? 'all'
  const iterations = Number(argument('iterations') ?? '0')
  const orders = balancedOrders(COMPILE_VARIANTS)
  if (!binding || !output || !Number.isSafeInteger(iterations) || iterations < 0
    || (iterations > 0 && (iterations % orders.length !== 0 || !['pressure', 'wevu', 'retail'].includes(selected)))) {
    throw new Error(`Expected --binding=<feature .node> --output=<new directory> [--scenario=all|pressure|wevu|retail] [--iterations=<multiple of ${orders.length}; default 0>]`)
  }
  const scenarios = (await compileScenarios()).filter(scenario => selected === 'all' || scenario.id === selected)
  if (!scenarios.length) {
    throw new Error('Unknown compiler scenario')
  }
  await mkdir(path.dirname(output), { recursive: true })
  await mkdir(output)
  const children = new Map<CompileVariant, Awaited<ReturnType<typeof createCompileProcess>>>()
  const checks: Array<Record<string, unknown>> = []
  const samples: Array<{ pair: number, order: CompileVariant[], variants: Partial<Record<CompileVariant, Omit<CompileSample, 'output'>>> }> = []
  const startup: Partial<Record<CompileVariant, unknown>> = {}
  const startedAt = new Date().toISOString()
  const initialLoad = loadavg()
  let failure: string | undefined
  const cleanupErrors: string[] = []
  const toolSources = await toolSourceHashes()
  const compiler = await compilerIdentity(binding)
  const scrub = (value: unknown) => String(value).replaceAll(root, '<repo>/').replaceAll(root.replaceAll('/', '\\'), '<repo>\\')
  const expected = new Map<string, string>()
  let warmupRounds = 0
  const check = async (scenario: CompileScenario, variant: CompileVariant) => {
    const result = await children.get(variant)!.compile(scenario)
    if (result.failed !== Boolean(scenario.expectError)) {
      await writeFile(path.join(output, `${scenario.id}-${variant}-unexpected.json`), result.output)
      throw new Error(`Unexpected compiler ${result.failed ? 'failure' : 'success'}: ${scenario.id}/${variant}`)
    }
    if (result.metrics.pendingInputs || result.metrics.pendingRecords) {
      throw new Error(`Pending binding work: ${scenario.id}/${variant}`)
    }
    if (variant === 'planned-native' && !scenario.expectError) {
      if (scenario.nativeFault ? !result.metrics.fallbackCount : result.metrics.fallbackCount) {
        throw new Error(`Unexpected fallback coverage: ${scenario.id}`)
      }
      if (!['jsx', 'static-template'].includes(scenario.id) && !result.metrics.nativeCalls) {
        throw new Error(`Native experiment was not exercised: ${scenario.id}`)
      }
      if (scenario.id === 'scoped-slots' && (!result.metrics.directRecords || (result.metrics.flushCount ?? 0) < 2)) {
        throw new Error('Scoped slot fixture did not exercise direct insertion and separate child consumption')
      }
      if (scenario.id === 'jsx' && !result.metrics.unbatchedCalls) {
        throw new Error('JSX fixture did not exercise eager synthetic analysis')
      }
    }
    const baseline = expected.get(scenario.id)
    if (baseline === undefined) {
      if (variant !== 'baseline') {
        throw new Error('The first correctness result must be the unmodified compiler')
      }
      expected.set(scenario.id, result.output)
    }
    else if (baseline !== result.output) {
      await writeFile(path.join(output, `${scenario.id}-expected.json`), baseline)
      await writeFile(path.join(output, `${scenario.id}-${variant}-actual.json`), result.output)
      throw new Error(`Full output, map, warning or error mismatch: ${scenario.id}/${variant}`)
    }
    return result
  }
  try {
    for (const variant of COMPILE_VARIANTS) {
      const child = await createCompileProcess(variant, path.resolve(binding))
      children.set(variant, child)
      startup[variant] = child.ready
      if (child.ready.bindingSha256 !== compiler.bindingSha256) {
        throw new Error('Worker native binary identity differs from the controller')
      }
    }
    for (const scenario of scenarios) {
      const results: Partial<Record<CompileVariant, unknown>> = {}
      for (const variant of COMPILE_VARIANTS) {
        const result = await check(scenario, variant)
        results[variant] = { outputSha256: digest(result.output), failed: result.failed, metrics: result.metrics }
      }
      checks.push({ scenario: scenario.id, filename: scenario.filename, sourceSha256: digest(scenario.source), options: scenario.options, variants: results })
    }
    if (iterations) {
      const scenario = scenarios[0]!
      for (let round = 0; round < orders.length; round++) {
        for (const variant of orders[round % orders.length]!) {
          await check(scenario, variant)
        }
        warmupRounds++
      }
      for (let pair = 0; pair < iterations; pair++) {
        const order = orders[pair % orders.length]!
        const variants: Partial<Record<CompileVariant, Omit<CompileSample, 'output'>>> = {}
        for (const variant of order) {
          const { output: _output, ...sample } = await check(scenario, variant)
          variants[variant] = sample
        }
        samples.push({ pair, order, variants })
      }
    }
  }
  catch (error) {
    failure = scrub(error)
  }
  finally {
    for (const child of [...children.values()].reverse()) {
      try {
        await child.close()
      }
      catch (error) {
        cleanupErrors.push(scrub(error))
      }
    }
  }
  const sourcesUnchanged = JSON.stringify(toolSources) === JSON.stringify(await toolSourceHashes())
  const compilerInputsUnchanged = JSON.stringify(compiler) === JSON.stringify(await compilerIdentity(binding))
  if (!sourcesUnchanged || !compilerInputsUnchanged) {
    failure = `${failure ?? ''} Measured source or binding identities changed during collection`.trim()
  }
  const report = {
    schemaVersion: 1,
    scope: 'Complete compileVueFile with fixed options; excludes Vite orchestration, process startup and HMR. Default-off diagnostic hooks only.',
    environment: { node: process.version, platform: process.platform, arch: process.arch, cpus: cpus().length, startedAt, finishedAt: new Date().toISOString(), initialLoad, finalLoad: loadavg() },
    startup,
    toolSources,
    sourcesUnchanged,
    compiler,
    compilerInputsUnchanged,
    checks,
    requestedIterations: iterations,
    warmupRounds,
    orderPeriod: orders.length,
    completedPairs: samples.length,
    fullyBalanced: samples.length > 0 && samples.length % orders.length === 0,
    passed: !failure && cleanupErrors.length === 0 && checks.length === scenarios.length && samples.length === iterations,
    failure,
    cleanupErrors,
    measured: samples.length
      ? Object.fromEntries(COMPILE_VARIANTS.map(variant => [variant, {
          wallMs: distribution(samples.map(sample => sample.variants[variant]!.wallMs)),
          cpuMicroseconds: distribution(samples.map(sample => sample.variants[variant]!.cpuMicroseconds)),
          rssAfterBytes: distribution(samples.map(sample => sample.variants[variant]!.rssAfterBytes)),
        }]))
      : undefined,
    samples,
    limitations: [
      'Each variant owns an isolated persistent process; workers are exercised serially, and caches are not shared across variants.',
      'All source normalization, planning, JS/Rust analysis and manifest consumption happen inside the timed compilation.',
      'One balanced order cycle of warmups follows one correctness compile; these measurements describe warm compilation only.',
      'control-js uses identical TypeScript stripping hooks without changing compiler logic, separating loader/code-generation effects from batching.',
      'IPC, output serialization, equality checks and metrics snapshots are outside the timing window.',
      'RSS is the root worker snapshot immediately after compilation, not peak RSS or the process-tree total.',
      'Every returned value, source map, warning and expected error is compared using complete JSON output on every invocation.',
      'A single shared-machine run is not formal build/HMR performance acceptance or evidence to enable native by default.',
      'Identity checks cover the listed diagnostic sources, compiler TypeScript source tree, native binary and lockfile; installed transitive dependency files are not rehashed.',
    ],
  }
  await writeFile(path.join(output, 'report.json'), `${JSON.stringify(report, null, 2)}\n`, { flag: 'wx' })
  console.log(JSON.stringify({ passed: report.passed, checked: checks.length, pairs: samples.length, failure, cleanupErrors, measured: report.measured }))
  if (!report.passed) {
    process.exitCode = 1
  }
}

main().catch((error: unknown) => {
  console.error(error)
  process.exitCode = 1
})
