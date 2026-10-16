import { rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { runPrAdmission } from '../check-pr-admission.mjs'
import { liveFixture, localFixture, writeLocalFixture } from './fixtures.mjs'

const roots = []

afterEach(async () => {
  await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true })))
})

async function fixture() {
  const root = await writeLocalFixture()
  roots.push(root)
  const write = vi.fn()
  const gh = vi.fn(() => {
    throw new Error('offline mode must never invoke gh')
  })
  return { root, write, gh }
}

describe('PR admission command', () => {
  it('runs offline without GitHub access and prints expected and actual values', async () => {
    const options = await fixture()
    expect(await runPrAdmission([], options)).toBe(0)
    expect(options.gh).not.toHaveBeenCalled()
    const environment = JSON.stringify(localFixture().policy.environment)
    expect(options.write.mock.calls.flat().join('')).toContain(`[PASS] 审批 Environment: expected=${environment} actual=${environment}`)
  })

  it('returns 1 for drift in isolated workflow fixtures', async () => {
    const options = await fixture()
    await writeFile(path.join(options.root, '.github/workflows/extra.yaml'), 'on: [pull_request]\njobs: {}\n')
    expect(await runPrAdmission([], options)).toBe(1)
    expect(options.write.mock.calls.flat().join('')).toContain('[FAIL] 唯一 PR 入口')
    expect(options.gh).not.toHaveBeenCalled()
  })

  it.each(['--unknown', '--repo', '--live --repo invalid', '--repo example/project'])('rejects invalid arguments: %s', async (args) => {
    const write = vi.fn()
    const gh = vi.fn()
    expect(await runPrAdmission(args.split(' '), { write, gh })).toBe(2)
    expect(write.mock.calls.flat().join('')).toContain('核验未完成')
    expect(gh).not.toHaveBeenCalled()
  })

  it('prints help without reading files or contacting GitHub', async () => {
    const options = await fixture()
    await rm(path.join(options.root, '.github'), { recursive: true })
    expect(await runPrAdmission(['--help'], options)).toBe(0)
    expect(options.write.mock.calls[0][0]).toContain('Usage:')
    expect(options.gh).not.toHaveBeenCalled()
  })

  it('returns 2 for malformed YAML and missing policy fields', async () => {
    const options = await fixture()
    await writeFile(path.join(options.root, '.github/workflows/extra.yml'), 'on: [broken\n')
    expect(await runPrAdmission([], options)).toBe(2)
    await rm(path.join(options.root, '.github/workflows/extra.yml'))
    await writeFile(path.join(options.root, '.github/pr-admission.json'), '{}')
    expect(await runPrAdmission([], options)).toBe(2)
  })

  it('runs live queries only when requested and honors an explicit repository', async () => {
    const options = await fixture()
    const { environment, fork } = liveFixture()
    options.gh.mockResolvedValueOnce(JSON.stringify(environment)).mockResolvedValueOnce(JSON.stringify(fork))
    expect(await runPrAdmission(['--live', '--repo', 'example/project'], options)).toBe(0)
    expect(options.gh.mock.calls.map(([args]) => args.slice(0, 3))).toEqual([
      ['api', '--method', 'GET'],
      ['api', '--method', 'GET'],
    ])
  })

  it('prioritizes incomplete live checks over local drift', async () => {
    const options = await fixture()
    await writeFile(path.join(options.root, '.github/workflows/extra.yaml'), 'on: pull_request\njobs: {}\n')
    expect(await runPrAdmission(['--live'], options)).toBe(2)
    const report = options.write.mock.calls.flat().join('')
    expect(report).toContain('[FAIL] 唯一 PR 入口')
    expect(report).toContain('[ERROR] 识别线上仓库')
  })

  it('rejects malformed expected configuration instead of passing a weakened comparison', async () => {
    const options = await fixture()
    const { policy } = localFixture()
    policy.reviewers = []
    await writeFile(path.join(options.root, '.github/pr-admission.json'), JSON.stringify(policy))
    expect(await runPrAdmission([], options)).toBe(2)
  })
})
