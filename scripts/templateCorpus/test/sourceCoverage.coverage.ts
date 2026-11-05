import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import * as core from '../../../packages/wxml/src/core'
import * as root from '../../../packages/wxml/src/index'
import * as presets from '../../../packages/wxml/src/presets'
import { readCorpusArchive } from '../archive'
import { runCorpusCases } from '../assertions/corpus'
import { runMatrixCases } from '../assertions/matrix'
import { collectSyntaxMatrix } from '../assertions/syntax'
import { assertCoverageIdentity, captureCoverageIdentity } from '../coverage/receipt'
import { runFuzz } from '../fuzz'
import { defaultCorpusReports } from '../paths'
import { loadXmlBaseline } from './baseline'
import { createCoreTemplateApi } from './coreApi'
import { runEntryContracts } from './entryContracts'
import { readMatrixCases } from './matrix'
import { runPresetContracts } from './presetContracts'

const corpusDirectory = fileURLToPath(new URL('../../../packages/wxml/test/corpus/', import.meta.url))
const reportDirectory = path.join(defaultCorpusReports, 'coverage')
const variants = [['root', root, root], ['core', createCoreTemplateApi(core), core]] as const

describe('source entry strict corpus acceptance', () => {
  it.each(variants)('%s executes all frozen inputs with the same contracts as built Node and Chromium', async (apiVariant, api, module) => {
    const startedAt = new Date().toISOString()
    const identity = await captureCoverageIdentity()
    const { manifest, documents } = await readCorpusArchive(corpusDirectory)
    const baseline = await loadXmlBaseline()
    const entryContract = runEntryContracts(module, apiVariant)
    const presetContract = runPresetContracts(presets)
    const report = runCorpusCases(api, documents, manifest.profiles, undefined, baseline.Parser)
    const matrix = runMatrixCases(api, await readMatrixCases(corpusDirectory, manifest, documents), manifest.profiles, undefined, baseline.Parser)
    const syntax = collectSyntaxMatrix(api, manifest.profiles)
    await assertCoverageIdentity(identity)
    await mkdir(reportDirectory, { recursive: true })
    await writeFile(path.join(reportDirectory, `source-corpus-${apiVariant}.json`), `${JSON.stringify({ schemaVersion: 1, kind: 'source-corpus', apiVariant, runId: process.env.WEAPP_VITE_CORPUS_COVERAGE_RUN ?? 'standalone', startedAt, finishedAt: new Date().toISOString(), identity, accepted: entryContract.accepted && presetContract.accepted && report.accepted && matrix.accepted && syntax.accepted, entryContract, presetContract, corpus: report, matrix, syntax }, null, 2)}\n`)
    expect(entryContract.failures).toEqual([])
    expect(entryContract.accepted).toBe(true)
    expect(presetContract.failures).toEqual([])
    expect(presetContract.accepted).toBe(true)
    expect(report.failures).toEqual([])
    expect(report.accepted).toBe(true)
    expect(report.pending).toBe(0)
    expect(matrix.failures).toEqual([])
    expect(matrix.accepted).toBe(true)
    expect(syntax.failures).toEqual([])
    expect(syntax.accepted).toBe(true)
    expect(Object.keys(syntax.scenarios)).toHaveLength(manifest.profiles.length)
  }, 1_200_000)

  it.each(variants)('%s executes the fixed formal combination and edit budgets on source', async (apiVariant, api, module) => {
    const startedAt = new Date().toISOString()
    const identity = await captureCoverageIdentity()
    const { manifest } = await readCorpusArchive(corpusDirectory)
    const baseline = await loadXmlBaseline()
    const entryContract = runEntryContracts(module, apiVariant)
    const presetContract = runPresetContracts(presets)
    const report = runFuzz(api, manifest.profiles, {}, baseline.Parser)
    await assertCoverageIdentity(identity)
    await mkdir(reportDirectory, { recursive: true })
    await writeFile(path.join(reportDirectory, `source-fuzz-${apiVariant}.json`), `${JSON.stringify({ ...report, schemaVersion: 1, kind: 'source-fuzz', apiVariant, runId: process.env.WEAPP_VITE_CORPUS_COVERAGE_RUN ?? 'standalone', startedAt, finishedAt: new Date().toISOString(), identity, entryContract, presetContract, accepted: entryContract.accepted && presetContract.accepted && report.accepted }, null, 2)}\n`)
    expect(entryContract.failures).toEqual([])
    expect(entryContract.accepted).toBe(true)
    expect(presetContract.failures).toEqual([])
    expect(presetContract.accepted).toBe(true)
    expect(report.failures).toEqual([])
    expect(report.accepted).toBe(true)
  }, 1_200_000)
})
