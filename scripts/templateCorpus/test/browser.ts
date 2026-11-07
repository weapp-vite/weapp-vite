import type { CorpusCaseReport } from '../assertions/corpus'
import type { MatrixCaseReport, MatrixTemplateCase } from '../assertions/matrix'
import type { collectSyntaxMatrix } from '../assertions/syntax'
import type { FuzzOptions, FuzzReport } from '../fuzz'
import type { CorpusDocument, CorpusProfile } from '../types'
import type { EntryContractReport } from './entryContracts'
import type { AcceptanceOptions, AcceptanceReport, ApiVariant } from './harness'
import { Buffer } from 'node:buffer'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { chromium } from 'playwright'
import { readCorpusArchive } from '../archive'
import { loadXmlBaseline } from './baseline'
import { bundleBrowserRuntime } from './bundle'
import { acceptanceArtifact, acceptancePaths, assertArtifactIdentity, assertFrozenIdentity, commandLineOptions, isDirectExecution, repositoryRoot, saveAcceptance, sha256 } from './harness'
import { readMatrixCases } from './matrix'

interface BrowserApi {
  entryContract: () => EntryContractReport
  presetContract: () => EntryContractReport
  corpus: (documents: CorpusDocument[], profiles: CorpusProfile[]) => CorpusCaseReport
  matrix: (templates: MatrixTemplateCase[], profiles: CorpusProfile[]) => MatrixCaseReport
  syntax: (profiles: CorpusProfile[]) => ReturnType<typeof collectSyntaxMatrix>
  fuzz: (profiles: CorpusProfile[], options?: FuzzOptions) => FuzzReport
}

function mergeCorpus(target: CorpusCaseReport | undefined, next: CorpusCaseReport): CorpusCaseReport {
  if (!target) {
    return next
  }
  target.cases += next.cases
  target.documents += next.documents
  target.pending += next.pending
  target.accepted &&= next.accepted
  target.failures.push(...next.failures)
  for (const key of ['executed', 'passed', 'failed', 'skipped'] as const) {
    target.differential[key] += next.differential[key]
  }
  for (const [reason, count] of Object.entries(next.differential.reasons)) {
    target.differential.reasons[reason] = (target.differential.reasons[reason] ?? 0) + count
  }
  for (const entry of ['default', 'resolver'] as const) {
    for (const key of Object.keys(target.entries[entry]) as Array<keyof typeof target.entries.default>) {
      target.entries[entry][key] += next.entries[entry][key]
    }
  }
  for (const [name, counts] of Object.entries(next.platforms)) {
    const platform = target.platforms[name] ??= { valid: 0, invalid: 0, pending: 0, failed: 0 }
    for (const key of ['valid', 'invalid', 'pending', 'failed'] as const) {
      platform[key] += counts[key]
    }
  }
  return target
}

async function bundleRuntime(entry: string, presetsEntry: string, baseline: string, directory: string, variant: ApiVariant) {
  const modulePath = (file: string) => JSON.stringify(file.split(path.sep).join('/'))
  const source = `import * as entry from ${modulePath(entry)};
import * as presets from ${modulePath(presetsEntry)};
import { createCoreTemplateApi } from ${modulePath(path.join(repositoryRoot, 'scripts/templateCorpus/test/coreApi.ts'))};
import { runEntryContracts } from ${modulePath(path.join(repositoryRoot, 'scripts/templateCorpus/test/entryContracts.ts'))};
import { runPresetContracts } from ${modulePath(path.join(repositoryRoot, 'scripts/templateCorpus/test/presetContracts.ts'))};
import { Parser } from ${modulePath(baseline)};
import { runCorpusCases } from ${modulePath(path.join(repositoryRoot, 'scripts/templateCorpus/assertions/corpus.ts'))};
import { runMatrixCases } from ${modulePath(path.join(repositoryRoot, 'scripts/templateCorpus/assertions/matrix.ts'))};
import { collectSyntaxMatrix } from ${modulePath(path.join(repositoryRoot, 'scripts/templateCorpus/assertions/syntax.ts'))};
import { runFuzz } from ${modulePath(path.join(repositoryRoot, 'scripts/templateCorpus/fuzz/index.ts'))};
const api = ${variant === 'core' ? 'createCoreTemplateApi(entry)' : 'entry'};
globalThis.WxmlCorpusRuntime = { entryContract: () => runEntryContracts(entry, ${JSON.stringify(variant)}), presetContract: () => runPresetContracts(presets), corpus: (documents, profiles) => runCorpusCases(api, documents, profiles, undefined, Parser), matrix: (templates, profiles) => runMatrixCases(api, templates, profiles, undefined, Parser), syntax: profiles => collectSyntaxMatrix(api, profiles), fuzz: (profiles, options) => runFuzz(api, profiles, options, Parser) };
`
  return await bundleBrowserRuntime(source, directory)
}

/** 单个后台 Chromium 会话顺序执行全部冻结语料，资源始终由本入口收尾。 */
export async function runBrowserAcceptance(options: AcceptanceOptions = {}): Promise<AcceptanceReport> {
  const selected = acceptancePaths(options)
  const report: AcceptanceReport = { schemaVersion: 1, apiVariant: selected.apiVariant, startedAt: new Date().toISOString(), accepted: false, runtime: { kind: 'chromium', version: '', headless: true, platform: process.platform, arch: process.arch }, artifact: { entry: path.relative(repositoryRoot, selected.builtEntry).split(path.sep).join('/'), sha256: '' } }
  const temporary = await mkdtemp(path.join(os.tmpdir(), 'template-corpus-browser-'))
  try {
    report.artifact = await acceptanceArtifact(selected.builtEntry)
    report.presetsArtifact = await acceptanceArtifact(selected.presetsEntry)
    const manifestPath = path.join(selected.corpusDirectory, 'manifest.json')
    const manifestHash = sha256(await readFile(manifestPath))
    const { manifest, documents } = await readCorpusArchive(selected.corpusDirectory)
    const matrixTemplates = selected.suite === 'fuzz' ? [] : await readMatrixCases(selected.corpusDirectory, manifest, documents)
    report.frozen = { id: manifest.id, manifestSha256: manifestHash, contentSha256: manifest.contentSha256, documents: documents.length, profiles: manifest.profiles.map(profile => profile.id) }
    const baseline = await loadXmlBaseline()
    report.baseline = { name: 'htmlparser2', version: baseline.version, entrySha256: baseline.entrySha256 }
    const code = await bundleRuntime(selected.builtEntry, selected.presetsEntry, baseline.entry, temporary, selected.apiVariant)
    report.bundle = { bytes: Buffer.byteLength(code), sha256: sha256(code) }
    const browser = await chromium.launch({ headless: true, args: ['--enable-automation'] })
    try {
      report.runtime.version = browser.version()
      const session = await browser.newBrowserCDPSession()
      try {
        const commandLine = (await session.send('Browser.getBrowserCommandLine')).arguments
        if (!commandLine.some(argument => argument === '--headless' || argument.startsWith('--headless='))) {
          throw new Error('Chromium process did not confirm headless execution.')
        }
      }
      finally {
        await session.detach()
      }
      const context = await browser.newContext()
      try {
        const page = await context.newPage()
        await page.addScriptTag({ content: code })
        report.entryContract = await page.evaluate(() => (Reflect.get(globalThis, 'WxmlCorpusRuntime') as BrowserApi).entryContract())
        report.presetContract = await page.evaluate(() => (Reflect.get(globalThis, 'WxmlCorpusRuntime') as BrowserApi).presetContract())
        if (selected.suite !== 'fuzz') {
          for (let offset = 0; offset < documents.length; offset += 128) {
            const next = await page.evaluate(({ documents, profiles }) => (Reflect.get(globalThis, 'WxmlCorpusRuntime') as BrowserApi).corpus(documents, profiles), { documents: documents.slice(offset, offset + 128), profiles: manifest.profiles })
            report.corpus = mergeCorpus(report.corpus, next)
            await saveAcceptance(report, selected.outputDirectory)
          }
          report.matrix = await page.evaluate(({ templates, profiles }) => (Reflect.get(globalThis, 'WxmlCorpusRuntime') as BrowserApi).matrix(templates, profiles), { templates: matrixTemplates, profiles: manifest.profiles })
          report.syntax = await page.evaluate(profiles => (Reflect.get(globalThis, 'WxmlCorpusRuntime') as BrowserApi).syntax(profiles), manifest.profiles)
        }
        if (selected.suite !== 'corpus') {
          const fuzzOptions = options.fuzz && { seed: options.fuzz.seed, valid: options.fuzz.valid, invalid: options.fuzz.invalid, editSequences: options.fuzz.editSequences }
          report.fuzz = await page.evaluate(({ profiles, options }) => (Reflect.get(globalThis, 'WxmlCorpusRuntime') as BrowserApi).fuzz(profiles, options), { profiles: manifest.profiles, options: fuzzOptions })
        }
        await page.close()
      }
      finally {
        await context.close()
      }
    }
    finally {
      await browser.close()
    }
    await assertFrozenIdentity(manifestPath, manifestHash, selected.builtEntry, report.artifact.sha256, report.artifact.modules)
    await assertArtifactIdentity(selected.presetsEntry, report.presetsArtifact)
    if (sha256(await readFile(baseline.entry)) !== baseline.entrySha256) {
      throw new Error('Frozen htmlparser2 baseline changed during acceptance.')
    }
    report.accepted = report.entryContract?.accepted === true && report.presetContract?.accepted === true && (selected.suite === 'fuzz' || Boolean(report.corpus?.accepted && report.corpus.cases > 0)) && (report.matrix?.accepted ?? true) && (report.syntax?.accepted ?? true) && (report.fuzz?.accepted ?? true)
  }
  catch (error) {
    report.error = String(error instanceof Error ? error.stack : error).replaceAll(repositoryRoot, '<repository>/').replaceAll(temporary, '<browser-workspace>')
  }
  finally {
    report.finishedAt = new Date().toISOString()
    try {
      await saveAcceptance(report, selected.outputDirectory)
    }
    finally {
      await rm(temporary, { recursive: true, force: true })
    }
  }
  return report
}

if (isDirectExecution(import.meta.url)) {
  const report = await runBrowserAcceptance(commandLineOptions(process.argv.slice(2)))
  process.stdout.write(`Chromium template corpus: ${report.accepted ? 'passed' : 'failed'}\n`)
  process.exitCode = report.accepted ? 0 : 1
}
