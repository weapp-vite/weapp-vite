import { mkdir, mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { coverageIdentity, hash } from './contracts.mjs'
import { runCoverageShard } from './index.mjs'

const mocks = vi.hoisted(() => ({ execa: vi.fn(), manifestFailure: undefined }))
vi.mock('execa', () => ({ execa: mocks.execa }))
vi.mock('node:fs/promises', async (original) => {
  const actual = await original()
  return {
    ...actual,
    writeFile: (file, ...args) => {
      if (mocks.manifestFailure && /[/\\]manifest\.json$/.test(String(file))) {
        return Promise.reject(mocks.manifestFailure)
      }
      return actual.writeFile(file, ...args)
    },
  }
})

let root
let planPath
let output
let observedText
let blobText
let execution
let thrown
const inventory = [{ file: 'case.test.mjs', projectName: 'fixture' }]
const cases = [{ ...inventory[0], name: 'original case', state: 'passed' }]

beforeEach(async () => {
  root = await realpath(await mkdtemp(path.join(os.tmpdir(), 'coverage-execution-')))
  planPath = path.join(root, 'plan.json')
  output = path.join(root, 'result')
  mocks.manifestFailure = undefined
  mocks.execa.mockReset()
  thrown = undefined
  observedText = JSON.stringify({ inventory, cases, passed: true })
  blobText = 'original blob'
  execution = { exitCode: 0, failed: false, timedOut: false, isCanceled: false, isGracefullyCanceled: false, isTerminated: false, isForcefullyTerminated: false, isMaxBuffer: false, durationMs: 42 }
  mocks.execa.mockImplementation(async (command, args, options) => {
    expect(command).toBe('pnpm')
    if (args[0] === '--version') {
      return { stdout: '12.16.1\n' }
    }
    const observedPath = options.env.COVERAGE_SHARD_REPORT
    await mkdir(path.dirname(observedPath), { recursive: true })
    if (observedText !== undefined) {
      await writeFile(observedPath, observedText)
    }
    if (blobText !== undefined) {
      const blob = args.find(argument => argument.startsWith('--outputFile.blob=')).slice('--outputFile.blob='.length)
      await writeFile(blob, blobText)
    }
    if (thrown) {
      throw thrown
    }
    return execution
  })
  vi.stubEnv('BUILD_ARTIFACT_EXPECTED_COMMIT', 'a'.repeat(40))
  for (const file of ['pnpm-lock.yaml', 'vitest.config.mts', 'vitest.coverage.ts']) {
    await writeFile(path.join(root, file), 'frozen input')
  }
  const data = { schemaVersion: 1, identity: await coverageIdentity(root), shards: 4, inventory }
  await writeFile(planPath, JSON.stringify({ ...data, planHash: hash(JSON.stringify(data)) }))
})
afterEach(async () => {
  mocks.manifestFailure = undefined
  vi.unstubAllEnvs()
  await rm(root, { recursive: true, force: true })
})

async function failedReport() {
  const failure = await runCoverageShard(root, planPath, 1, output).then(() => undefined, error => error)
  expect(failure).toBeInstanceOf(Error)
  expect(failure.message).toContain('Coverage shard 1 failed')
  const report = JSON.parse(await readFile(path.join(output, 'manifest.json'), 'utf8'))
  expect(report.status).toBe('failed')
  expect(mocks.execa.mock.calls.filter(([, args]) => args[0] === 'exec')).toHaveLength(1)
  return { report, failure }
}

it('preserves the original command, complete observation, blob digest and exact successful execution', async () => {
  const report = await runCoverageShard(root, planPath, 1, output)
  expect(report).toMatchObject({ status: 'passed', inventory, cases, blobHash: hash(blobText), execution: { outcome: 'returned', ...execution, signal: null, code: null }, errors: [] })
  const invocations = mocks.execa.mock.calls.filter(([, args]) => args[0] === 'exec')
  expect(invocations).toHaveLength(1)
  const [command, args, options] = invocations[0]
  expect(command).toBe('pnpm')
  expect(args).toEqual([
    'exec',
    'vitest',
    'run',
    '--configLoader=bundle',
    '--exclude=**/.codex-tmp/**',
    `--config=${path.join(import.meta.dirname, 'config.mjs')}`,
    '--coverage.enabled',
    '--coverage.reporter=json',
    '--shard=1/4',
    '--reporter=default',
    '--reporter=blob',
    `--reporter=${path.join(import.meta.dirname, 'reporter.mjs')}`,
    `--outputFile.blob=${path.join(output, 'blob.json')}`,
    `--coverage.reportsDirectory=${path.join(output, 'coverage')}`,
  ])
  expect(options).toEqual({ cwd: root, stdio: 'inherit', reject: false, env: { COVERAGE_SHARD_REPORT: path.join(output, 'observed.json') } })
})

it.each([
  { exitCode: 7 },
  { exitCode: undefined, signal: 'SIGKILL', signalDescription: 'Forced termination' },
  { exitCode: undefined, code: 'ENOENT', shortMessage: 'Command failed with ENOENT' },
  { exitCode: undefined, timedOut: true },
  { exitCode: undefined, isCanceled: true },
  { exitCode: 0, isCanceled: true, isGracefullyCanceled: true },
  { exitCode: undefined, isTerminated: true, isForcefullyTerminated: true },
])('saves exact failed execution before rejecting: %j', async (details) => {
  execution = Object.assign(new Error('original execution failure'), execution, details, { failed: true })
  const { report, failure } = await failedReport()
  expect(report.execution).toMatchObject({ outcome: 'returned', ...Object.fromEntries(Object.entries(details).map(([key, value]) => [key, value ?? null])), failed: true })
  expect(report.inventory).toEqual(inventory)
  expect(report.errors).toEqual([expect.objectContaining({ stage: 'execute', message: 'original execution failure' })])
  expect(failure.cause).toBe(execution)
  expect(report.blobHash).toBe(details.exitCode === 0 ? hash(blobText) : null)
})

it.each([undefined, '{bad-json', 'null', '{}', '{"inventory":[],"cases":[],"passed":"yes"}'])('keeps execution evidence when observed is absent or invalid: %j', async (text) => {
  observedText = text
  const { report } = await failedReport()
  expect(report.execution).toMatchObject({ exitCode: 0, failed: false })
  expect(report.inventory).toEqual([])
  expect(report.cases).toEqual([])
  expect(report.errors).toEqual([expect.objectContaining({ stage: 'observed' })])
})

it('writes a failure manifest when a successful process produces no blob', async () => {
  blobText = undefined
  const { report } = await failedReport()
  expect(report.blobHash).toBeNull()
  expect(report.errors).toEqual([expect.objectContaining({ stage: 'blob', code: 'ENOENT' })])
})

it('retains execution failure when reporters never produce their files', async () => {
  execution = Object.assign(new Error('execution ended before reporters'), execution, { exitCode: undefined, signal: 'SIGKILL', failed: true })
  observedText = undefined
  blobText = undefined
  const { report, failure } = await failedReport()
  expect(report.execution).toMatchObject({ outcome: 'returned', exitCode: null, signal: 'SIGKILL', failed: true })
  expect(report.inventory).toEqual([])
  expect(report.cases).toEqual([])
  expect(report.blobHash).toBeNull()
  expect(report.errors.map(error => error.stage)).toEqual(['execute', 'observed'])
  expect(failure.cause.errors[0]).toBe(execution)
})

it('retains the original thrown launch error with independent missing-report evidence', async () => {
  thrown = Object.assign(new Error('launch rejected'), { code: 'EINVAL' })
  observedText = undefined
  blobText = undefined
  const { report, failure } = await failedReport()
  expect(report.execution).toMatchObject({ outcome: 'threw', exitCode: null, signal: null, code: 'EINVAL' })
  expect(report.errors.map(error => error.stage)).toEqual(['execute', 'observed'])
  expect(failure.cause).toBeInstanceOf(AggregateError)
  expect(failure.cause.errors[0]).toBe(thrown)
})

it('rejects unknown success state rather than inventing a successful execution', async () => {
  delete execution.failed
  const { report } = await failedReport()
  expect(report.execution.failed).toBeNull()
})

it('preserves the execution failure when the manifest itself cannot be saved', async () => {
  execution = Object.assign(new Error('original execution failure'), execution, { exitCode: 7, failed: true })
  mocks.manifestFailure = Object.assign(new Error('manifest denied'), { code: 'EACCES' })
  const failure = await runCoverageShard(root, planPath, 1, output).catch(error => error)
  expect(failure).toBeInstanceOf(AggregateError)
  expect(failure.errors).toEqual([execution, mocks.manifestFailure])
  expect(failure.message).toContain('Unable to save coverage shard 1 manifest')
  await expect(readFile(path.join(output, 'manifest.json'))).rejects.toMatchObject({ code: 'ENOENT' })
  expect(mocks.execa.mock.calls.filter(([, args]) => args[0] === 'exec')).toHaveLength(1)
})
