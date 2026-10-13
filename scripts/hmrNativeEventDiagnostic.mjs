import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { lstat, mkdir, readFile, realpath, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { stripVTControlCharacters } from 'node:util'

export const BASELINE_SHA = '73b76f4acde84a4ac8c25f4b816119b19704ac28'
export const CANDIDATE_SHA = '4dede68ef91956a0af36223856f7cbed1f7f8d25'
export const TRACE_FILTER = 'notify_debouncer_full=trace,rolldown_dev::bundle_coordinator=trace,rolldown_dev::bundling_task=trace'
const scenarioOrder = ['vue-page-json-macro', 'vue-page-template', 'vue-page-script', 'vue-page-style']
const hash = value => createHash('sha256').update(value).digest('hex')
const git = (root, args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim()
const load = (root, file) => import(pathToFileURL(path.join(root, file)).href)
const posix = value => value.replaceAll('\\', '/')

function parseArgs(args) {
  const values = new Map()
  for (let index = 0; index < args.length; index += 2) {
    const key = args[index]
    const value = args[index + 1]
    if (!['--tools', '--controller-sha', '--baseline', '--candidate', '--output'].includes(key)
      || !value || value.startsWith('--') || values.has(key)) {
      throw new Error('Invalid or duplicate diagnostic option')
    }
    values.set(key, value)
  }
  if (values.size !== 5 || !/^[a-f\d]{40}$/.test(values.get('--controller-sha') ?? '')) {
    throw new Error('Require controller SHA and distinct tools, baseline, candidate and new output paths')
  }
  return Object.fromEntries([...values].map(([key, value]) => [key.slice(2), key.endsWith('-sha') ? value : path.resolve(value)]))
}

async function absent(file) {
  return lstat(file).then(() => false, (error) => {
    if (error.code === 'ENOENT') {
      return true
    }
    throw error
  })
}

async function releaseMachineLease(lease, state, credentialKey) {
  const ownOwner = JSON.parse(lease.environment[credentialKey])
  await lease.release()
  const ownerFile = path.join(state, 'machine-e2e', 'owner.json')
  const currentOwner = await readFile(ownerFile, 'utf8').then(JSON.parse).catch((error) => {
    if (error.code === 'ENOENT') {
      return undefined
    }
    throw error
  })
  if (currentOwner && (!Number.isInteger(currentOwner.pid) || currentOwner.pid <= 0 || typeof currentOwner.token !== 'string' || !currentOwner.token)) {
    throw new Error('Machine lease owner readback is invalid')
  }
  const ownOwnerAbsent = !currentOwner || currentOwner.token !== ownOwner.token || currentOwner.pid !== ownOwner.pid
  if (!lease.released || !ownOwnerAbsent) {
    throw new Error('Machine lease release readback is incomplete')
  }
  return { released: lease.released, ownOwnerAbsent, anotherOwnerPresent: Boolean(currentOwner && ownOwnerAbsent) }
}

/** 仅探测本次安装的 loader；不注入或观察原 dev 进程，也不重编 native。 */
function nativeIdentity(root, expectedVersion) {
  const code = `
    import { createRequire } from 'node:module'
    import { createHash } from 'node:crypto'
    import { readFileSync, realpathSync } from 'node:fs'
    import path from 'node:path'
    import { pathToFileURL } from 'node:url'
    const root = realpathSync(process.cwd())
    const require = createRequire(path.join(root, 'packages/weapp-vite/package.json'))
    const entry = realpathSync(require.resolve('rolldown'))
    const packageFile = realpathSync(require.resolve('rolldown/package.json'))
    const manifest = JSON.parse(readFileSync(packageFile, 'utf8'))
    await import(pathToFileURL(entry).href)
    const binaries = Object.keys(require.cache).filter(file => file.endsWith('.node')).map(file => {
      const binary = realpathSync(file)
      const pkg = JSON.parse(readFileSync(path.join(path.dirname(binary), 'package.json'), 'utf8'))
      const relative = path.relative(root, binary).replaceAll('\\\\', '/')
      if (relative.startsWith('../') || path.isAbsolute(relative)) throw new Error('Native loader escaped owning checkout')
      return { package: pkg.name, version: pkg.version, file: relative,
        bytes: readFileSync(binary).length,
        sha256: createHash('sha256').update(readFileSync(binary)).digest('hex') }
    })
    const bindings = binaries.filter(binary => binary.package.startsWith('@rolldown/binding-'))
    if (bindings.length !== 1 || bindings[0].package !== '@rolldown/binding-linux-x64-gnu'
      || bindings[0].version !== process.argv[1] || manifest.version !== process.argv[1]) throw new Error('Unexpected loaded Rolldown native binding')
    process.stdout.write(JSON.stringify({ kind: 'same-install-loader-probe', observedProcess: 'separate short Node probe',
      measuredDevProcessObserved: false, package: manifest.name, version: manifest.version,
      packageSha256: createHash('sha256').update(readFileSync(packageFile)).digest('hex'), binaries }) + '\\n')
  `
  const output = execFileSync(process.execPath, ['--input-type=module', '-e', code, expectedVersion], { cwd: root, encoding: 'utf8', timeout: 120_000 })
  return JSON.parse(output.trim())
}

/** 完整报告由原 collector 在 dev.stop 完成后发布；样本本身不授予资源终结。 */
export async function auditRunEvidence(directory, run, input, manifest) {
  if (run.error || run.stop || run.retainedInput) {
    throw new Error('Collector did not complete with confirmed resource cleanup')
  }
  const expectedIds = scenarioOrder.flatMap(scenario => ['first', 'repeat'].flatMap(cycle => ['edit', 'restore'].map(phase => `${input.id}:${scenario}:${cycle}:${phase}`)))
  if (run.round !== 0 || run.input !== input.id || run.markerSeed !== 'hmr-attribution-primary-0'
    || !['baseline', 'candidate'].includes(run.side)
    || JSON.stringify(run.samples.map(sample => sample.id).sort()) !== JSON.stringify(expectedIds.sort())) {
    throw new Error('Complete unique original sample IDs are required')
  }
  if (!await absent(path.join(directory, 'failures', input.id, 'cleanup', 'report.json'))) {
    throw new Error('Original collector retained a cleanup failure')
  }
  const original = JSON.parse(await readFile(path.join(directory, 'report.json'), 'utf8'))
  const template = original.templates?.[0]
  if (original.templates?.length !== 1 || template?.id !== input.id || template.error
    || original.iterations !== 2 || original.sampleMode !== 'edit-only' || original.budgetMs !== 500
    || original.timeoutMs !== 30_000 || original.profileTimeoutMs !== 15_000
    || original.markerSeed !== 'hmr-attribution-primary-0' || !original.outputScopeEnabled
    || original.profileEnabled !== (run.side === 'candidate')
    || JSON.stringify(template.scenarios?.map(row => row.id)) !== JSON.stringify(scenarioOrder)
    || template.devLog !== `logs/${input.id}.dev.log` || run.samples.length !== 16) {
    throw new Error('Original report, profile mode or complete scenario order changed')
  }
  const recordedManifest = JSON.parse(await readFile(path.join(directory, 'input-manifest.json'), 'utf8'))
  if (JSON.stringify(recordedManifest) !== JSON.stringify(manifest) || run.inputDigest !== hash(JSON.stringify(manifest))) {
    throw new Error('Fixture input manifest changed')
  }
  for (const row of template.scenarios) {
    const files = Object.keys(manifest).filter(file => posix(row.sourceFile).endsWith(`/${file}`))
    if (files.length !== 1 || row.error || row.diagnostics?.cleanupError || row.cycles?.length !== 2
      || row.cycles.some(cycle => cycle.restore.inputSha256 !== manifest[files[0]])) {
      throw new Error('Original source restoration evidence is missing or unequal')
    }
  }
  const rawLog = await readFile(path.join(directory, template.devLog), 'utf8')
  if (!rawLog.trim()) {
    throw new Error('Original complete dev log is missing')
  }
  const parsedCopy = stripVTControlCharacters(rawLog)
  const messagePresence = {
    rawEvent: parsedCopy.includes('raw event:'),
    deliveredWatchEvent: /\[BundleCoordinator\] received message\r?\n\s*- message:\s*WatchEvent/.test(parsedCopy),
    scheduledTask: parsedCopy.includes('[BundleCoordinator] scheduling new build task'),
    taskStarted: parsedCopy.includes('[BundlingTask] starts to run.'),
    hmrStarted: parsedCopy.includes('[BundlingTask] starts to generate HMR updates'),
    hmrCompleted: parsedCopy.includes('[BundlingTask] completed generating HMR updates'),
  }
  const trace = Object.fromEntries([
    ['notify_debouncer_full', messagePresence.rawEvent],
    ['rolldown_dev::bundle_coordinator', messagePresence.deliveredWatchEvent && messagePresence.scheduledTask],
    ['rolldown_dev::bundling_task', messagePresence.taskStarted && messagePresence.hmrStarted && messagePresence.hmrCompleted],
  ].map(([target, observed]) => [target, observed ? 'observed' : 'missing-or-unavailable']))
  return { resourcesTerminal: true, basis: 'original owned collector successful return; post-stop report/devLog; no cleanup failure; restored source hashes', devLog: template.devLog, devLogSha256: hash(rawLog), trace, messagePresence, taskAssociation: 'unknown; no parser or unique task identity', clocks: 'Rust wall-clock intervals only; JS/profile clocks cannot be subtracted' }
}

export async function runNativeEventDiagnostic(args) {
  const paths = parseArgs(args)
  const tools = await realpath(paths.tools)
  const output = path.join(await realpath(path.dirname(paths.output)), path.basename(paths.output))
  const options = { baseline: await realpath(paths.baseline), candidate: await realpath(paths.candidate), candidateSha: CANDIDATE_SHA, runtime: 'stateful-experimental', output }
  const controllerSha = paths['controller-sha']
  if (process.platform !== 'linux' || process.arch !== 'x64' || process.version !== 'v24.18.0'
    || await realpath(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')) !== tools
    || await realpath(process.cwd()) !== options.candidate
    || git(tools, ['rev-parse', 'HEAD']) !== controllerSha || process.env.GITHUB_SHA !== controllerSha
    || git(options.baseline, ['rev-parse', 'HEAD']) !== BASELINE_SHA || git(options.candidate, ['rev-parse', 'HEAD']) !== CANDIDATE_SHA
    || [tools, options.baseline, options.candidate].some(root => git(root, ['status', '--porcelain', '--untracked-files=normal']))) {
    throw new Error('Require Linux Node 24.18.0 and the exact clean dispatched controller; run from candidate')
  }
  const roots = [tools, options.baseline, options.candidate, options.output]
  if (new Set(roots).size !== roots.length || roots.slice(0, 3).some((root) => {
    const relative = path.relative(root, options.output)
    return !relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative)
  }) || process.env.RD_LOG_OUTPUT !== 'readable' || process.env.RD_LOG !== TRACE_FILTER) {
    throw new Error('Require a fresh external output and only the fixed readable trace filter')
  }
  const contract = await load(options.candidate, 'scripts/benchmarkTemplatesHmr/acceptanceContract.ts')
  const runner = await load(options.candidate, 'scripts/benchmarkTemplatesHmr/acceptanceRunner.ts')
  const { collectorStop } = await load(options.candidate, 'scripts/performanceGate/collectorStop.ts')
  const { acquireMachineE2ELease } = await load(options.candidate, 'packages/devtools-runtime/src/lease/machine.ts')
  const { machineStateDirectory } = await load(options.candidate, 'packages/devtools-runtime/src/lease/machineContext.ts')
  const { INHERITED_LEASE_ENV } = await load(options.candidate, 'packages/devtools-runtime/src/lease/machineScope.ts')
  await runner.verifyAcceptanceCheckout(options.baseline, BASELINE_SHA)
  await runner.verifyAcceptanceCheckout(options.candidate, CANDIDATE_SHA)
  await mkdir(options.output, { recursive: false })
  const report = { schemaVersion: 1, kind: 'diagnostic', performanceVerdict: false, status: 'incomplete', controllerSha, baselineSha: BASELINE_SHA, candidateSha: CANDIDATE_SHA, collectorSha: CANDIDATE_SHA, historicalInstallTree: 'unavailable; this is a fresh exact-source install, not its reconstruction', originalRegression: 'preserved; diagnostic success cannot revoke the formal primary or confirmation', environment: { node: process.version, platform: process.platform, arch: process.arch, release: os.release(), cpu: os.cpus()[0]?.model, cpuCount: os.availableParallelism(), git: git(tools, ['--version']), runnerImage: process.env.ImageOS, runnerImageVersion: process.env.ImageVersion }, sampling: { runtime: options.runtime, rounds: 1, cycles: 2, mutationsPerSide: 16, seed: 'hmr-attribution-primary-0', order: ['baseline', 'candidate'], scenarioOrder, profile: { baseline: 'off', candidate: 'on' }, settleMs: 300, pollMs: 120, budgetMs: 500, scenarioTimeoutMs: 30_000, startupTimeoutMs: 120_000 }, trace: { output: 'readable', filter: TRACE_FILTER, overhead: 'enabled and unquantified; wall/profile values are diagnostic only', parsing: 'message presence only; readable subscriber disables target output; original sanitized logs retain ANSI; inspect a stripped copy', association: 'unknown when ambiguous', clocks: 'same Rust wall-clock interval only; no cross-clock subtraction or derived watcher latency' }, preparation: {}, inputs: [], runs: [], lease: { acquired: false, released: false }, errors: [], stop: undefined, stableDevtoolsValidation: 'not-run-final-runtime-acceptance-incomplete' }
  const checkpoint = () => writeFile(path.join(options.output, 'report.json'), runner.sanitizeAcceptanceText(`${JSON.stringify(report, null, 2)}\n`, roots))
  const deadline = Date.now() + 165 * 60_000
  let lease
  let resourcesTerminal = true
  await checkpoint()
  try {
    lease = await acquireMachineE2ELease({ env: {} })
    report.lease = { acquired: true, borrowed: lease.borrowed, released: false }
    resourcesTerminal = false
    report.preparation = await runner.rebuildAcceptanceCheckouts(options)
    resourcesTerminal = true
    for (const side of ['baseline', 'candidate']) {
      report.preparation[side].native = nativeIdentity(options[side], side === 'baseline' ? '1.2.12' : '1.2.13')
    }
    const input = contract.HMR_INPUTS[0]
    const manifest = await runner.acceptanceInputManifest(path.join(options.candidate, input.source))
    report.inputs.push({ id: input.id, scenarios: input.scenarios, digest: hash(JSON.stringify(manifest)), files: manifest })
    await checkpoint()
    process.stdout.write('dist sync: rebuilt weapp-vite before downstream validation\n')
    for (const side of ['baseline', 'candidate']) {
      if (Date.now() >= deadline) {
        throw new Error('Original total deadline exceeded')
      }
      resourcesTerminal = false
      const run = await runner.collectAcceptanceRun(options, side, input, 0, 'primary', deadline)
      report.runs.push(run)
      report.stop = run.stop
      await checkpoint()
      const directory = path.join(options.output, 'primary', input.id, '0', side)
      run.diagnostic = await auditRunEvidence(directory, run, input, manifest)
      resourcesTerminal = true
      await checkpoint()
      if (Object.values(run.diagnostic.trace).some(value => value !== 'observed')) {
        throw new Error('Native trace observation surface is missing or unavailable; do not attribute phases')
      }
    }
    const [before, after] = report.runs
    const sampleHashes = run => run.samples.map(sample => [sample.id, sample.inputSha256]).sort(([a], [b]) => a.localeCompare(b))
    if (JSON.stringify(sampleHashes(before)) !== JSON.stringify(sampleHashes(after))) {
      throw new Error('Sides do not share the original mutation and restoration hashes')
    }
    await runner.verifyAcceptanceCheckout(options.baseline, BASELINE_SHA)
    await runner.verifyAcceptanceCheckout(options.candidate, CANDIDATE_SHA)
    report.status = 'diagnostic-complete'
  }
  catch (error) {
    report.stop ??= collectorStop(error)
    report.errors.push(runner.sanitizeAcceptanceText(String(error), roots))
  }
  finally {
    if (lease && resourcesTerminal) {
      try {
        report.lease = { ...report.lease, ...await releaseMachineLease(lease, machineStateDirectory({}), INHERITED_LEASE_ENV) }
      }
      catch (error) {
        report.errors.push(runner.sanitizeAcceptanceText(String(error), roots))
        report.status = 'incomplete'
      }
    }
    else if (lease) {
      report.lease.retained = true
      report.lease.reason = 'resource terminal evidence incomplete; no global cleanup or next-side launch'
    }
    await checkpoint()
  }
  if (report.status !== 'diagnostic-complete') {
    throw new Error('Native event diagnostic incomplete; see report.json and original partial logs')
  }
  return report
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  runNativeEventDiagnostic(process.argv.slice(2)).catch(() => {
    process.stderr.write('Native event diagnostic failed; retained evidence does not change the original performance verdict.\n')
    process.exitCode = 1
  })
}
