import type { ProfileMeasurement } from './types'
import assert from 'node:assert/strict'
import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { parseArgs } from 'node:util'
import { withMachineE2ELease } from '../../../packages/devtools-runtime/src/lease/machine'
import { assertNodeStackBudget } from '../../benchmarkWxmlParser/runtime'
import { readCorpusArchive } from '../archive'
import { corpusHash } from '../integrity'
import { defaultCorpusDirectory, defaultCorpusReports, repositoryRoot } from '../paths'
import { isDirectExecution } from '../test/harness'
import { profileFixtures, profileGroups } from './fixtures'
import { readProfileInputs } from './inputs'
import { reserveProfileOutput } from './output'
import { assertProfileArtifacts, prepareProfile } from './prepare'
import { profileMarkdown } from './report'

/** 独立新语料画像入口，不运行 package build，也不改写旧性能基线。 */
export async function profileMain(args = process.argv.slice(2)): Promise<void> {
  const { values } = parseArgs({ args, options: {
    corpus: { type: 'string', default: defaultCorpusDirectory },
    output: { type: 'string', default: path.join(defaultCorpusReports, 'performance-profile') },
    entry: { type: 'string', default: path.join(repositoryRoot, 'packages/wxml/dist/index.mjs') },
    runtime: { type: 'string', default: 'both' },
    rounds: { type: 'string', default: '40' },
    warmup: { type: 'string', default: '10' },
    group: { type: 'string', multiple: true },
  } })
  assert.ok(['node', 'chromium', 'both'].includes(values.runtime), 'Profile runtime must be node, chromium, or both')
  const options = { rounds: Number(values.rounds), warmup: Number(values.warmup), groups: values.group }
  assert.ok(Number.isSafeInteger(options.rounds) && options.rounds > 0 && Number.isSafeInteger(options.warmup) && options.warmup >= 0, 'Invalid paired profile sample budget')
  assertNodeStackBudget(process.execArgv)
  const output = path.resolve(values.output)
  await reserveProfileOutput(output)
  const report: Record<string, unknown> = { schemaVersion: 1, purpose: 'independent-corpus-profile', status: 'running', startedAt: new Date().toISOString(), sampleBudget: options, formalBudget: options.rounds === 40 && options.warmup === 10, oldPerformanceGate: 'unchanged-464-document-bench:check' }
  const save = () => writeFile(path.join(output, 'report.json'), `${JSON.stringify(report, null, 2)}\n`)
  const measurements: Record<string, ProfileMeasurement> = {}
  try {
    await withMachineE2ELease(async () => {
      const manifestPath = path.join(path.resolve(values.corpus), 'manifest.json')
      const manifestHash = corpusHash(await readFile(manifestPath))
      const { manifest, documents } = await readCorpusArchive(path.resolve(values.corpus))
      const inputs = await readProfileInputs(path.resolve(values.corpus), manifest, documents)
      const { fixtures, excluded, matrixExpectations } = profileFixtures(documents, manifest, inputs)
      const groups = profileGroups(fixtures)
      assert.ok(fixtures.length && groups.length, 'Frozen corpus has no valid performance profile inputs')
      assert.ok(!options.groups || (options.groups.length > 0 && options.groups.every(group => groups.some(candidate => candidate.id === group))), 'Unknown or empty performance group selection')
      const prepared = await prepareProfile(path.resolve(values.entry), output, values.runtime !== 'node')
      report.identity = { corpusId: manifest.id, contentSha256: manifest.contentSha256, manifestSha256: manifestHash, uniqueDocuments: documents.length, realSourceCases: fixtures.filter(fixture => fixture.quotaEligible).length, controlledMatrixOutputs: inputs.matrix.length, controlledMatrixExpectations: matrixExpectations, controlledMatrixCases: fixtures.filter(fixture => !fixture.quotaEligible).length, cases: fixtures.length, excluded, artifacts: prepared.artifacts, versions: prepared.versions }
      report.groups = groups
      report.fixtureInventory = fixtures.map(({ source: _source, ...fixture }) => fixture)
      report.bundle = prepared.bundle
      report.boundary = 'All file IO, corpus verification, correctness assertions and harness bundling are outside timed batches. Candidate includes default complete AST/token metadata. Scan collects identical opening names and decoded attributes. Canonical performs full traversal on prebuilt trees. Controlled matrix cases retain quotaEligible=false in separate groups without changing real-source denominators. Expected framework versions require frozen recipe/snapshot identity; unidentified cases remain unknown. Shared XML is preclassified independently; other syntax has candidate throughput only. First passes reuse one module runtime and are informational, not cold process/module measurements. Ratios are descriptive; the original 464-document formal gate remains required.'
      await save()
      if (values.runtime !== 'chromium') {
        const memoryBefore = process.memoryUsage()
        const result = prepared.run(fixtures, groups, options)
        measurements.node = result
        report.node = { runtime: process.version, moduleLoadMs: prepared.moduleLoadMs, memoryBefore, memoryAfter: process.memoryUsage(), memoryBoundary: 'Whole runner resident process snapshots, including corpus and prebuilt trees; not per-operation allocation or peak RSS.', result }
        await save()
      }
      if (values.runtime !== 'node') {
        const { profileChromium } = await import('./browser')
        const browser = await profileChromium(prepared.browserCode!, fixtures, groups, options)
        measurements.chromium = browser.result
        report.chromium = browser
        await save()
      }
      await assertProfileArtifacts(prepared.artifacts)
      assert.equal(corpusHash(await readFile(manifestPath)), manifestHash, 'Frozen profile corpus manifest changed during sampling')
      await readCorpusArchive(path.resolve(values.corpus))
      const complete = Object.values(measurements).every(result => !result.errors.length && result.summaries.length && result.summaries.every(summary => summary.status === 'complete'))
      report.status = complete ? 'profile-complete' : 'incomplete'
      await writeFile(path.join(output, 'report.md'), profileMarkdown({ corpus: manifest.id, documents: documents.length, cases: fixtures.length, matrixCases: fixtures.filter(fixture => !fixture.quotaEligible).length, excluded: excluded.length }, measurements))
      if (!complete) {
        process.exitCode = 1
      }
    })
  }
  catch (error) {
    report.status = 'failed'
    report.error = String(error instanceof Error ? error.stack : error).replaceAll(repositoryRoot, '<repository>')
    process.exitCode = 1
  }
  finally {
    report.finishedAt = new Date().toISOString()
    await save()
    process.stdout.write(`Template corpus performance profile: ${String(report.status)}; ${path.relative(repositoryRoot, output)}/report.json\n`)
  }
}

if (isDirectExecution(import.meta.url)) {
  await profileMain()
}
