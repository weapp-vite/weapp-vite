import type { TemplateApi } from '../assertions'
import type { AcceptanceOptions, AcceptanceReport } from './harness'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { pathToFileURL } from 'node:url'
import { readCorpusArchive } from '../archive'
import { runCorpusCases } from '../assertions/corpus'
import { runMatrixCases } from '../assertions/matrix'
import { collectSyntaxMatrix } from '../assertions/syntax'
import { runFuzz } from '../fuzz'
import { loadXmlBaseline } from './baseline'
import { acceptancePaths, assertFrozenIdentity, commandLineOptions, isDirectExecution, repositoryRoot, saveAcceptance, sha256 } from './harness'
import { readMatrixCases } from './matrix'

/** 只从已构建的公开入口加载被测实现，不把源码冒充发布产物。 */
export async function runNodeAcceptance(options: AcceptanceOptions = {}): Promise<AcceptanceReport> {
  const selected = acceptancePaths(options)
  const report: AcceptanceReport = { schemaVersion: 1, startedAt: new Date().toISOString(), accepted: false, runtime: { kind: 'node', version: process.version, platform: process.platform, arch: process.arch }, artifact: { entry: path.relative(repositoryRoot, selected.builtEntry).split(path.sep).join('/'), sha256: '' } }
  try {
    report.artifact.sha256 = sha256(await readFile(selected.builtEntry))
    const manifestPath = path.join(selected.corpusDirectory, 'manifest.json')
    const manifestHash = sha256(await readFile(manifestPath))
    const { manifest, documents } = await readCorpusArchive(selected.corpusDirectory)
    report.frozen = { id: manifest.id, manifestSha256: manifestHash, contentSha256: manifest.contentSha256, documents: documents.length, profiles: manifest.profiles.map(profile => profile.id) }
    const entryUrl = pathToFileURL(selected.builtEntry)
    entryUrl.searchParams.set('corpus-artifact', report.artifact.sha256)
    const api = await import(entryUrl.href) as TemplateApi
    const baseline = await loadXmlBaseline()
    report.baseline = { name: 'htmlparser2', version: baseline.version, entrySha256: baseline.entrySha256 }
    if (selected.suite !== 'fuzz') {
      report.corpus = runCorpusCases(api, documents, manifest.profiles, undefined, baseline.Parser)
      report.matrix = runMatrixCases(api, await readMatrixCases(selected.corpusDirectory, manifest, documents), manifest.profiles, undefined, baseline.Parser)
      report.syntax = collectSyntaxMatrix(api, manifest.profiles)
    }
    if (selected.suite !== 'corpus') {
      report.fuzz = runFuzz(api, manifest.profiles, options.fuzz, baseline.Parser)
    }
    await assertFrozenIdentity(manifestPath, manifestHash, selected.builtEntry, report.artifact.sha256)
    if (sha256(await readFile(baseline.entry)) !== baseline.entrySha256) {
      throw new Error('Frozen htmlparser2 baseline changed during acceptance.')
    }
    report.accepted = (report.corpus ? report.corpus.accepted && report.corpus.cases > 0 : true) && (report.matrix?.accepted ?? true) && (report.syntax?.accepted ?? true) && (report.fuzz?.accepted ?? true)
  }
  catch (error) {
    report.error = String(error instanceof Error ? error.stack : error).replaceAll(repositoryRoot, '<repository>/')
  }
  finally {
    report.finishedAt = new Date().toISOString()
    await saveAcceptance(report, selected.outputDirectory)
  }
  return report
}

if (isDirectExecution(import.meta.url)) {
  const report = await runNodeAcceptance(commandLineOptions(process.argv.slice(2)))
  process.stdout.write(`Node template corpus: ${report.accepted ? 'passed' : 'failed'}\n`)
  process.exitCode = report.accepted ? 0 : 1
}
