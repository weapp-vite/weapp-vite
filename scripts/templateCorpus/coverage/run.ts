import type { CorpusFileIdentity } from '../types'
import type { StrictCoverageReport } from './index'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
// eslint-disable-next-line e18e/ban-dependencies -- 覆盖率子进程需要跨平台命令解析与完整退出结果。
import { execa } from 'execa'
import { corpusJson } from '../archive'
import { corpusHash } from '../integrity'
import { defaultCorpusReports, repositoryRoot } from '../paths'
import { auditCoverage } from './index'
import { assertCoverageIdentity, assertSourceCoverageEvidence, captureCoverageIdentity, coverageFileIdentity } from './receipt'

const output = path.join(defaultCorpusReports, 'coverage')
await mkdir(output, { recursive: true })
const startedAt = new Date().toISOString()
const runId = randomUUID()
const identity = await captureCoverageIdentity()
const reports: Record<string, CorpusFileIdentity> = {}
const errors: string[] = []
let coverage: StrictCoverageReport | undefined
let exitCode: number | undefined
let identityUnchanged = false
try {
  const result = await execa('pnpm', ['exec', 'vitest', 'run', '--config', './vitest.coverage.config.ts'], {
    cwd: path.join(repositoryRoot, 'packages/wxml'),
    stdio: 'inherit',
    reject: false,
    env: { WEAPP_VITE_CORPUS_COVERAGE_RUN: runId },
  })
  exitCode = result.exitCode
  await assertCoverageIdentity(identity)
  reports.raw = await coverageFileIdentity(path.join(output, 'coverage-final.json'))
  coverage = await auditCoverage(path.join(repositoryRoot, 'packages/wxml/src'), path.join(output, 'coverage-final.json'))
  assert.deepEqual(await coverageFileIdentity(path.join(output, 'coverage-final.json')), reports.raw, 'Raw coverage report changed during its audit')
  for (const [key, file] of [['sourceCorpus', 'source-corpus.json'], ['sourceFuzz', 'source-fuzz.json']] as const) {
    const bytes = await readFile(path.join(output, file))
    const value: unknown = JSON.parse(bytes.toString('utf8'))
    assertSourceCoverageEvidence(value, runId, identity)
    reports[key] = await coverageFileIdentity(path.join(output, file))
    assert.equal(reports[key].sha256, corpusHash(bytes), 'Source coverage report changed during its audit')
    assert.equal(reports[key].bytes, bytes.length, 'Source coverage report changed during its audit')
  }
  await assertCoverageIdentity(identity)
  identityUnchanged = true
}
catch (error) {
  errors.push((error instanceof Error ? error.message : String(error)).split(repositoryRoot).join('<repository>'))
}
const accepted = exitCode === 0 && identityUnchanged && coverage?.accepted === true && errors.length === 0
await writeFile(path.join(output, 'strict-verdict.json'), `${corpusJson({ ...coverage, schemaVersion: 1, runId, identity, accepted, coverageAccepted: coverage?.accepted ?? false, errors })}\n`)
reports.verdict = await coverageFileIdentity(path.join(output, 'strict-verdict.json'))
await writeFile(path.join(output, 'run-receipt.json'), `${corpusJson({ schemaVersion: 1, kind: 'source-coverage', runId, startedAt, finishedAt: new Date().toISOString(), identity, identityUnchanged, exitCode: exitCode ?? null, accepted, reports, errors })}\n`)
process.stdout.write(`${corpusJson({ accepted, totals: coverage?.totals, missingFiles: coverage?.missingFiles, ignoredFiles: coverage?.ignoredFiles, receipt: path.relative(repositoryRoot, path.join(output, 'run-receipt.json')).split(path.sep).join('/'), errors })}\n`)
process.exitCode = accepted ? 0 : 1
