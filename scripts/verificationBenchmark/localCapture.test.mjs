import { Buffer } from 'node:buffer'
import { mkdir, mkdtemp, readdir, readFile, realpath, rm, symlink, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, expect, it, vi } from 'vitest'
import { captureVerificationSample } from './localCapture.mjs'

const mocks = vi.hoisted(() => ({ run: vi.fn(), identity: vi.fn(), inputs: vi.fn() }))
vi.mock('execa', () => ({ execa: mocks.run }))
vi.mock('./localFiles.mjs', () => ({ localIdentity: mocks.identity }))
vi.mock('./localFramework.mjs', () => ({ localFrameworkInputs: mocks.inputs }))
const roots = []

afterEach(async () => {
  vi.resetAllMocks()
  vi.unstubAllEnvs()
  await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true })))
})

async function fixture() {
  const root = await realpath(await mkdtemp(path.join(os.tmpdir(), 'local-capture-')))
  roots.push(root)
  await mkdir(path.join(root, '.tmp'))
  await mkdir(path.join(root, 'scripts/verification'), { recursive: true })
  await writeFile(path.join(root, 'scripts/verification/prepare.ts'), `export async function prepareVerificationPlan() {
    return { tasks: [{ env: { REPOCTL_RELEASE_PNPM_VERSION: 'pnpm@12.11.2' } }], resources: { cpus: 2, cpuBudget: 2, jobs: 1, workersPerTask: 2, buildConcurrency: 1 } }
  }\n`)
  await writeFile(path.join(root, 'package.json'), JSON.stringify({ type: 'module', scripts: { verify: 'node --import tsx scripts/verification/cli.ts run' } }))
  mocks.identity.mockImplementation((_root, runId) => ({ runId, commitSha: 'a'.repeat(40), workingTreeDirty: false, fingerprint: 'b'.repeat(64) }))
  mocks.inputs.mockResolvedValue({ inputDigest: 'c'.repeat(64) })
  mocks.run.mockResolvedValue({ exitCode: 0, stdout: '', stderr: '' })
  const config = { schemaVersion: 1, id: 'raw-1', variant: 'baseline', mode: 'quick', inputPolicy: 'framework-tree-v2', cachePolicy: 'fixture' }
  return { root, config, output: path.join(root, '.tmp/sample.json') }
}

it.each(['', '.capture.json'])('preserves an existing local %s evidence file without preparing or launching', async (suffix) => {
  const { root, config, output } = await fixture()
  const bytes = Buffer.from('original local evidence\r\n\u0000')
  await writeFile(`${output}${suffix}`, bytes)
  const before = await readdir(path.dirname(output))
  await expect(captureVerificationSample(config, output, root)).rejects.toThrow('already exists')
  expect(mocks.identity).not.toHaveBeenCalled()
  expect(mocks.run).not.toHaveBeenCalled()
  expect(await readFile(`${output}${suffix}`)).toEqual(bytes)
  expect(await readdir(path.dirname(output))).toEqual(before)
})

it('retains unique raw provenance and permits only one same-output capture', async () => {
  const { root, config, output } = await fixture()
  const results = await Promise.allSettled([captureVerificationSample(config, output, root), captureVerificationSample({ ...config, id: 'raw-2' }, output, root)])
  const winner = results.find(result => result.status === 'fulfilled')
  expect(results.filter(result => result.status === 'rejected')).toHaveLength(1)
  expect(winner?.value).toMatchObject({ outcome: 'partial', complete: false })
  expect(mocks.run).toHaveBeenCalledTimes(1)
  const sample = winner.value
  const reservation = JSON.parse(await readFile(path.join(root, sample.evidence.reservation.path), 'utf8'))
  expect(reservation).toMatchObject({ runId: sample.evidence.runId, rawDirectory: `.tmp/verification-benchmark/${sample.evidence.runId}` })
  expect(sample.evidence.reservation.runId).toBe(sample.evidence.runId)
  const names = await readdir(path.join(root, '.tmp/verification-benchmark'))
  expect(names).toEqual([sample.evidence.runId])
  const files = [output, sample.evidence.reservation.path, sample.evidence.inputReceipt.path, sample.evidence.frozen.path, sample.evidence.raw.path].map(file => path.resolve(root, file))
  const before = await Promise.all(files.map(file => readFile(file)))
  await expect(captureVerificationSample(config, output, root)).rejects.toThrow('already exists')
  expect(await Promise.all(files.map(file => readFile(file)))).toEqual(before)
})

it('keeps a failed reservation and rejects a raw-directory symlink before writing through it', async () => {
  const { root, config, output } = await fixture()
  const outside = path.join(root, 'outside')
  await mkdir(outside)
  await symlink(outside, path.join(root, '.tmp/verification-benchmark'), 'junction')
  await expect(captureVerificationSample(config, output, root)).rejects.toThrow('symbolic links')
  expect(await readdir(outside)).toEqual([])
  expect(mocks.run).not.toHaveBeenCalled()
  const reservation = await readFile(`${output}.capture.json`)
  await expect(captureVerificationSample(config, output, root)).rejects.toThrow('already exists')
  expect(await readFile(`${output}.capture.json`)).toEqual(reservation)
})

it('rejects a changed reservation and retains the failed raw sample', async () => {
  const { root, config, output } = await fixture()
  mocks.run.mockImplementation(async () => {
    await writeFile(`${output}.capture.json`, '{}\n')
    return { exitCode: 0, stdout: '', stderr: '' }
  })
  const sample = await captureVerificationSample(config, output, root)
  expect(sample).toMatchObject({ complete: false, outcome: 'partial', evidence: { error: expect.stringContaining('reservation changed') } })
  expect(JSON.parse(await readFile(path.join(root, sample.evidence.raw.path), 'utf8'))).toMatchObject({ error: expect.stringContaining('reservation changed') })
})

it('does not overwrite a competing local sample created after the reservation', async () => {
  const { root, config, output } = await fixture()
  const bytes = Buffer.from('another local writer owns the sample\n')
  mocks.run.mockImplementation(async () => {
    await writeFile(output, bytes, { flag: 'wx' })
    return { exitCode: 0, stdout: '', stderr: '' }
  })
  await expect(captureVerificationSample(config, output, root)).rejects.toMatchObject({ code: 'EEXIST' })
  expect(await readFile(output)).toEqual(bytes)
  const reservation = JSON.parse(await readFile(`${output}.capture.json`, 'utf8'))
  expect(JSON.parse(await readFile(path.join(root, reservation.rawDirectory, 'raw.json'), 'utf8'))).toMatchObject({ runId: reservation.runId, exitCode: 0 })
})

it.each(['inputs.json', 'frozen.json', 'CAPTURE.JSON'])('rejects local reserved output suffix %s before preparing or writing', async (suffix) => {
  const { root, config, output } = await fixture()
  const before = (await readdir(path.dirname(output))).sort()
  await expect(captureVerificationSample(config, `${output}.${suffix}`, root)).rejects.toThrow('reserved evidence suffix')
  expect(mocks.identity).not.toHaveBeenCalled()
  expect(mocks.run).not.toHaveBeenCalled()
  expect((await readdir(path.dirname(output))).sort()).toEqual(before)
})
