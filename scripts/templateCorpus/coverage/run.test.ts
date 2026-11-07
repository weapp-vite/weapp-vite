import type { CorpusFileIdentity } from '../types'
import type { CoverageRunIdentity } from './receipt'
import { createHash } from 'node:crypto'
import { mkdir, mkdtemp, readFile, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { afterEach, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({ root: '', reports: '', output: '', childRemovedOutput: false }))
const originalExitCode = process.exitCode
const file = { file: 'fixture.json', bytes: 1, sha256: 'a'.repeat(64) }
const group = { files: [], sha256: 'b'.repeat(64) }
const identity: CoverageRunIdentity = {
  schemaVersion: 1,
  frozen: { id: 'frozen-corpus', contentSha256: 'c'.repeat(64), manifest: file },
  production: group,
  built: file,
  builtModules: group,
  tests: group,
  configuration: group,
  lock: file,
}

vi.mock('../paths', () => ({
  get defaultCorpusReports() { return state.reports },
  get repositoryRoot() { return state.root },
}))

vi.mock('execa', () => ({
  execa: vi.fn(async () => {
    await rm(state.output, { recursive: true })
    state.childRemovedOutput = true
    return { exitCode: 1 }
  }),
}))

vi.mock('./receipt', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./receipt')>()
  return {
    ...actual,
    captureCoverageIdentity: async () => identity,
    assertCoverageIdentity: async () => {},
    coverageFileIdentity: (file: string) => actual.coverageFileIdentity(file, state.root),
  }
})

afterEach(async () => {
  process.exitCode = originalExitCode
  vi.restoreAllMocks()
  if (state.root) {
    await rm(state.root, { recursive: true, force: true })
  }
  vi.resetModules()
})

it('retains a failed run receipt after the child cleans its coverage directory', async () => {
  state.root = await mkdtemp(path.join(os.tmpdir(), 'corpus-coverage-finalization-'))
  state.reports = path.join(state.root, 'reports')
  state.output = path.join(state.reports, 'coverage')
  state.childRemovedOutput = false
  await mkdir(state.output, { recursive: true })
  vi.spyOn(process.stdout, 'write').mockReturnValue(true)

  await import('./run')

  const verdictBytes = await readFile(path.join(state.output, 'strict-verdict.json'))
  const verdict = JSON.parse(verdictBytes.toString('utf8')) as { accepted: boolean, coverageAccepted: boolean, errors: string[] }
  const receipt = JSON.parse(await readFile(path.join(state.output, 'run-receipt.json'), 'utf8')) as {
    accepted: boolean
    exitCode: number
    identityUnchanged: boolean
    errors: string[]
    reports: Record<string, CorpusFileIdentity>
  }
  expect(state.childRemovedOutput).toBe(true)
  expect(process.exitCode).toBe(1)
  expect(verdict).toMatchObject({ accepted: false, coverageAccepted: false })
  expect(verdict.errors).toHaveLength(1)
  expect(verdict.errors[0]).toContain('coverage-final.json')
  expect(verdict.errors[0]).not.toContain(state.root)
  expect(receipt).toMatchObject({ accepted: false, exitCode: 1, identityUnchanged: false, errors: verdict.errors })
  expect(receipt.reports.verdict).toEqual({
    file: 'reports/coverage/strict-verdict.json',
    bytes: verdictBytes.length,
    sha256: createHash('sha256').update(verdictBytes).digest('hex'),
  })
})
