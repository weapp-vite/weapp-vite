import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import * as api from '../../../packages/wxml/src/index'
import { readCorpusArchive } from '../archive'
import { runCorpusCases } from '../assertions/corpus'
import { runMatrixCases } from '../assertions/matrix'
import { collectSyntaxMatrix } from '../assertions/syntax'
import { assertCoverageIdentity, captureCoverageIdentity } from '../coverage/receipt'
import { runFuzz } from '../fuzz'
import { defaultCorpusReports } from '../paths'
import { loadXmlBaseline } from './baseline'
import { readMatrixCases } from './matrix'

const corpusDirectory = fileURLToPath(new URL('../../../packages/wxml/test/corpus/', import.meta.url))
const reportDirectory = path.join(defaultCorpusReports, 'coverage')

describe('source entry strict corpus acceptance', () => {
  it('executes all frozen inputs with the same contracts as built Node and Chromium', async () => {
    const startedAt = new Date().toISOString()
    const identity = await captureCoverageIdentity()
    const { manifest, documents } = await readCorpusArchive(corpusDirectory)
    const baseline = await loadXmlBaseline()
    const report = runCorpusCases(api, documents, manifest.profiles, undefined, baseline.Parser)
    const matrix = runMatrixCases(api, await readMatrixCases(corpusDirectory, manifest, documents), manifest.profiles, undefined, baseline.Parser)
    const syntax = collectSyntaxMatrix(api, manifest.profiles)
    await assertCoverageIdentity(identity)
    await mkdir(reportDirectory, { recursive: true })
    await writeFile(path.join(reportDirectory, 'source-corpus.json'), `${JSON.stringify({ schemaVersion: 1, kind: 'source-corpus', runId: process.env.WEAPP_VITE_CORPUS_COVERAGE_RUN ?? 'standalone', startedAt, finishedAt: new Date().toISOString(), identity, accepted: report.accepted && matrix.accepted && syntax.accepted, corpus: report, matrix, syntax }, null, 2)}\n`)
    expect(report.failures).toEqual([])
    expect(report.accepted).toBe(true)
    expect(report.pending).toBe(0)
    expect(matrix.failures).toEqual([])
    expect(matrix.accepted).toBe(true)
    expect(syntax.failures).toEqual([])
    expect(syntax.accepted).toBe(true)
    expect(Object.keys(syntax.scenarios)).toHaveLength(manifest.profiles.length)
  }, 1_200_000)

  it('executes the fixed formal combination and edit budgets on source', async () => {
    const startedAt = new Date().toISOString()
    const identity = await captureCoverageIdentity()
    const { manifest } = await readCorpusArchive(corpusDirectory)
    const baseline = await loadXmlBaseline()
    const report = runFuzz(api, manifest.profiles, {}, baseline.Parser)
    await assertCoverageIdentity(identity)
    await mkdir(reportDirectory, { recursive: true })
    await writeFile(path.join(reportDirectory, 'source-fuzz.json'), `${JSON.stringify({ ...report, schemaVersion: 1, kind: 'source-fuzz', runId: process.env.WEAPP_VITE_CORPUS_COVERAGE_RUN ?? 'standalone', startedAt, finishedAt: new Date().toISOString(), identity }, null, 2)}\n`)
    expect(report.failures).toEqual([])
    expect(report.accepted).toBe(true)
  }, 1_200_000)
})
