import assert from 'node:assert/strict'
import { copyFile, mkdir, readdir, realpath, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { performance } from 'node:perf_hooks'
import process from 'node:process'
import { fileURLToPath, pathToFileURL } from 'node:url'
// eslint-disable-next-line e18e/ban-dependencies -- 使用跨平台启动器运行 Vitest，避免 Windows 的 .cmd 解析差异。
import { execa } from 'execa'
import { coverageLogicalScope } from '../verificationTelemetry/logicalCoverage.mjs'
import { coverageIdentity, digestFile, hash, normalizeInventory, readJson, verifyCoveragePlan, verifyCoverageShards } from './contracts.mjs'

const reporter = fileURLToPath(new URL('./reporter.mjs', import.meta.url))
const shardConfig = fileURLToPath(new URL('./config.mjs', import.meta.url))
const baseArguments = ['--configLoader=bundle', '--exclude=**/.codex-tmp/**']

async function save(filename, value) {
  await mkdir(path.dirname(filename), { recursive: true })
  await writeFile(filename, `${JSON.stringify(value, null, 2)}\n`)
}

export async function createCoveragePlan(root, output, shards = 4) {
  root = await realpath(root)
  assert(Number.isSafeInteger(shards) && shards > 0, 'Invalid coverage shard count')
  const listing = path.join(path.dirname(output), 'inventory.json')
  await mkdir(path.dirname(listing), { recursive: true })
  await execa('pnpm', ['exec', 'vitest', 'list', ...baseArguments, '--filesOnly', `--json=${listing}`], { cwd: root, stdio: 'inherit' })
  const inventory = normalizeInventory(await readJson(listing), root)
  assert(inventory.length > 0, 'Empty coverage test inventory')
  const data = { schemaVersion: 1, identity: await coverageIdentity(root), shards, inventory }
  const plan = { ...data, planHash: hash(JSON.stringify(data)) }
  await save(output, plan)
  return plan
}

const executionFields = ['exitCode', 'signal', 'signalDescription', 'failed', 'timedOut', 'isCanceled', 'isGracefullyCanceled', 'isTerminated', 'isForcefullyTerminated', 'isMaxBuffer', 'code', 'shortMessage', 'originalMessage', 'durationMs']

/** 只保留进程实际提供的退出字段；缺失值不推断为退出码或信号。 */
function describeExecution(result, outcome) {
  return { outcome, ...Object.fromEntries(executionFields.map(field => [field, result?.[field] ?? null])) }
}

export async function runCoverageShard(root, planPath, index, output) {
  root = await realpath(root)
  const plan = await readJson(planPath)
  const identity = await coverageIdentity(root)
  verifyCoveragePlan(plan, identity)
  assert(Number.isSafeInteger(index) && index >= 1 && index <= plan.shards, 'Invalid coverage shard index')
  await mkdir(output, { recursive: true })
  const observedPath = path.join(output, 'observed.json')
  const blob = path.join(output, 'blob.json')
  await Promise.all([observedPath, blob, path.join(output, 'manifest.json')].map(file => rm(file, { force: true })))
  const startedAt = performance.now()
  const failures = []
  const errors = []
  const recordError = (stage, error) => {
    failures.push(error)
    errors.push({ stage, name: error?.name ?? null, code: error?.code ?? null, message: error instanceof Error ? error.message : String(error) })
  }
  let result
  let outcome = 'returned'
  try {
    result = await execa('pnpm', ['exec', 'vitest', 'run', ...baseArguments, `--config=${shardConfig}`, '--coverage.enabled', '--coverage.reporter=json', `--shard=${index}/${plan.shards}`, '--reporter=default', '--reporter=blob', `--reporter=${reporter}`, `--outputFile.blob=${blob}`, `--coverage.reportsDirectory=${path.join(output, 'coverage')}`], { cwd: root, stdio: 'inherit', reject: false, env: { COVERAGE_SHARD_REPORT: observedPath } })
  }
  catch (error) {
    outcome = 'threw'
    result = error
    recordError('execute', error)
  }
  if (outcome === 'returned' && result?.failed === true) {
    recordError('execute', result)
  }
  const execution = describeExecution(result, outcome)
  let observed = { inventory: [], cases: [], passed: false }
  try {
    const value = await readJson(observedPath)
    assert(value !== null && typeof value === 'object' && Array.isArray(value.inventory) && Array.isArray(value.cases) && typeof value.passed === 'boolean', 'Invalid observed coverage report')
    observed = value
  }
  catch (error) {
    recordError('observed', error)
  }
  let blobHash = null
  if (execution.exitCode === 0) {
    try {
      blobHash = await digestFile(blob)
    }
    catch (error) {
      recordError('blob', error)
    }
  }
  const completed = outcome === 'returned' && execution.exitCode === 0 && execution.failed === false && execution.signal === null
    && !['timedOut', 'isCanceled', 'isGracefullyCanceled', 'isTerminated', 'isForcefullyTerminated', 'isMaxBuffer'].some(field => execution[field] === true)
  const report = { schemaVersion: 1, identity, planHash: plan.planHash, index, status: completed && observed.passed && errors.length === 0 ? 'passed' : 'failed', inventory: observed.inventory, cases: observed.cases, durationMs: performance.now() - startedAt, blobHash, execution, errors }
  try {
    await save(path.join(output, 'manifest.json'), report)
  }
  catch (error) {
    throw new AggregateError([...failures, error], `Unable to save coverage shard ${index} manifest: ${JSON.stringify({ execution, errors })}`)
  }
  if (report.status !== 'passed') {
    throw new Error(`Coverage shard ${index} failed: ${JSON.stringify({ execution, errors })}`, { cause: failures.length === 1 ? failures[0] : failures.length ? new AggregateError(failures, 'Coverage shard evidence collection failed') : undefined })
  }
  return report
}

export async function mergeCoverageShards(root, planPath, reportsDirectory, output) {
  root = await realpath(root)
  await Promise.all(['logical-scope.json', 'shard-verdict.json'].map(file => rm(path.join(output, file), { force: true })))
  const plan = await readJson(planPath)
  const entries = await readdir(reportsDirectory, { withFileTypes: true })
  const directories = entries.filter(entry => entry.isDirectory()).map(entry => path.join(reportsDirectory, entry.name))
  const reports = await Promise.all(directories.map(directory => readJson(path.join(directory, 'manifest.json'))))
  verifyCoverageShards(plan, reports, await coverageIdentity(root))
  const logicalScope = coverageLogicalScope(plan, reports)
  const blobs = path.join(root, '.tmp/coverage-merge-blobs')
  await rm(blobs, { recursive: true, force: true })
  await mkdir(blobs, { recursive: true })
  for (const [index, directory] of directories.entries()) {
    const filename = path.join(directory, 'blob.json')
    assert.equal(await digestFile(filename), reports[index].blobHash, 'Coverage blob digest mismatch')
    await copyFile(filename, path.join(blobs, `shard-${reports[index].index}.json`))
  }
  await execa('pnpm', ['exec', 'vitest', ...baseArguments, `--merge-reports=${blobs}`, '--coverage.enabled', '--coverage.reporter=text', '--coverage.reporter=json', '--coverage.reporter=json-summary', '--coverage.reporter=lcov', `--coverage.reportsDirectory=${output}`], { cwd: root, stdio: 'inherit' })
  await save(path.join(output, 'logical-scope.json'), logicalScope)
  await save(path.join(output, 'shard-verdict.json'), { schemaVersion: 1, planHash: plan.planHash, shards: reports.length, tests: plan.inventory.length, status: 'passed' })
}

async function main() {
  const [command, ...arguments_] = process.argv.slice(2)
  const options = Object.fromEntries(arguments_.map((value) => {
    const index = value.indexOf('=')
    assert(value.startsWith('--') && index > 2, 'Expected --key=value arguments')
    return [value.slice(2, index), value.slice(index + 1)]
  }))
  const root = process.cwd()
  assert(options.output, 'Missing --output')
  const output = path.resolve(root, options.output)
  if (command === 'plan') {
    await createCoveragePlan(root, output, Number(options.shards ?? 4))
  }
  else if (command === 'run') {
    await runCoverageShard(root, path.resolve(root, options.plan), Number(options.shard), output)
  }
  else if (command === 'merge') {
    await mergeCoverageShards(root, path.resolve(root, options.plan), path.resolve(root, options.reports), output)
  }
  else {
    throw new Error('Expected plan, run or merge')
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main()
}
