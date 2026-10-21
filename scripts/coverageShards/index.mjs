import assert from 'node:assert/strict'
import { copyFile, mkdir, readdir, realpath, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { performance } from 'node:perf_hooks'
import process from 'node:process'
import { fileURLToPath, pathToFileURL } from 'node:url'
// eslint-disable-next-line e18e/ban-dependencies -- 使用跨平台启动器运行 Vitest，避免 Windows 的 .cmd 解析差异。
import { execa } from 'execa'
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

export async function runCoverageShard(root, planPath, index, output) {
  root = await realpath(root)
  const plan = await readJson(planPath)
  const identity = await coverageIdentity(root)
  verifyCoveragePlan(plan, identity)
  assert(Number.isSafeInteger(index) && index >= 1 && index <= plan.shards, 'Invalid coverage shard index')
  await mkdir(output, { recursive: true })
  const observedPath = path.join(output, 'observed.json')
  const blob = path.join(output, 'blob.json')
  const startedAt = performance.now()
  const result = await execa('pnpm', ['exec', 'vitest', 'run', ...baseArguments, `--config=${shardConfig}`, '--coverage.enabled', '--coverage.reporter=json', `--shard=${index}/${plan.shards}`, '--reporter=default', '--reporter=blob', `--reporter=${reporter}`, `--outputFile.blob=${blob}`, `--coverage.reportsDirectory=${path.join(output, 'coverage')}`], { cwd: root, stdio: 'inherit', reject: false, env: { COVERAGE_SHARD_REPORT: observedPath } })
  let observed = { inventory: [], passed: false }
  try {
    observed = await readJson(observedPath)
  }
  catch (error) {
    if (error.code !== 'ENOENT') {
      throw error
    }
  }
  const report = { schemaVersion: 1, identity, planHash: plan.planHash, index, status: result.exitCode === 0 && observed.passed ? 'passed' : 'failed', inventory: observed.inventory, durationMs: performance.now() - startedAt, blobHash: result.exitCode === 0 ? await digestFile(blob) : null }
  await save(path.join(output, 'manifest.json'), report)
  assert.equal(report.status, 'passed', `Coverage shard ${index} failed`)
  return report
}

export async function mergeCoverageShards(root, planPath, reportsDirectory, output) {
  root = await realpath(root)
  const plan = await readJson(planPath)
  const entries = await readdir(reportsDirectory, { withFileTypes: true })
  const directories = entries.filter(entry => entry.isDirectory()).map(entry => path.join(reportsDirectory, entry.name))
  const reports = await Promise.all(directories.map(directory => readJson(path.join(directory, 'manifest.json'))))
  verifyCoverageShards(plan, reports, await coverageIdentity(root))
  const blobs = path.join(root, '.tmp/coverage-merge-blobs')
  await rm(blobs, { recursive: true, force: true })
  await mkdir(blobs, { recursive: true })
  for (const [index, directory] of directories.entries()) {
    const filename = path.join(directory, 'blob.json')
    assert.equal(await digestFile(filename), reports[index].blobHash, 'Coverage blob digest mismatch')
    await copyFile(filename, path.join(blobs, `shard-${reports[index].index}.json`))
  }
  await execa('pnpm', ['exec', 'vitest', ...baseArguments, `--merge-reports=${blobs}`, '--coverage.enabled', '--coverage.reporter=text', '--coverage.reporter=json', '--coverage.reporter=json-summary', '--coverage.reporter=lcov', `--coverage.reportsDirectory=${output}`], { cwd: root, stdio: 'inherit' })
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
