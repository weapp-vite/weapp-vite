import type { EntryFixture } from './types'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { assertProfileArtifacts } from '../../templateCorpus/benchmark/prepare'
import { repositoryRoot } from '../freeze'
import { profileEntryChromium } from './browser'
import { profileEntryNode } from './node'
import { prepareEntryProfile } from './prepare'
import { entryProfileIntegrity, entryProfileSummary } from './report'

/** 独立研究冻结 main 根入口、当前根入口与当前 /core；不替代完整根入口和消费者门槛。 */
export async function profileCoreEntry(configuration: { baselineEntry: string, rootEntry: string, coreEntry: string, output: string, runtime: string, fixtures: EntryFixture[], rounds: number, warmup: number }, checkpoint: (report: unknown) => Promise<void> = async () => {}) {
  await mkdir(configuration.output)
  const report: Record<string, unknown> = { schemaVersion: 1, purpose: 'isolated-core-entry-profile', status: 'running', informational: true, arms: { baseline: 'frozen-main built root API', root: 'current built root compatibility API', core: 'current built /core with explicit compiled dialects' }, sampleBudget: { rounds: configuration.rounds, warmup: configuration.warmup }, startedAt: new Date().toISOString(), boundary: 'Frozen-main root, current root compatibility API and current /core have independent module, first-call, memory and bundle-size evidence. Only current /core has explicit compile/createParser initialization. Current root and bound core steady batches share frozen explicit dialect definitions. All metrics are informational; the full-metadata root and real-consumer regression gates remain independently mandatory.' }
  const save = async () => {
    await writeFile(path.join(configuration.output, 'report.json'), `${JSON.stringify(report, null, 2)}\n`)
    await checkpoint(report)
  }
  const errors: string[] = []
  try {
    const prepared = await prepareEntryProfile(configuration.baselineEntry, configuration.rootEntry, configuration.coreEntry, configuration.output)
    report.identity = { artifacts: prepared.artifacts, fixtures: configuration.fixtures.map(({ source: _source, ...fixture }) => fixture) }
    report.bundle = Object.fromEntries(Object.entries(prepared.modules).map(([arm, module]) => [arm, { bytes: module.browserBytes, gzipBytes: module.browserGzipBytes, sha256: module.browserSha256 }]))
    await save()
    if (configuration.runtime !== 'chromium') {
      const node = await profileEntryNode(prepared, configuration.fixtures, configuration.rounds, configuration.warmup, configuration.output, async (partial) => {
        report.node = partial
        await save()
      })
      const integrity = entryProfileIntegrity(node, configuration.fixtures, configuration.rounds, configuration.warmup)
      report.node = { ...node, integrity, summary: entryProfileSummary(node.samples, node.steady) }
      errors.push(...integrity)
      await save()
    }
    if (configuration.runtime !== 'node') {
      const browser = await profileEntryChromium(prepared, configuration.fixtures, configuration.rounds, configuration.warmup, async (partial) => {
        report.chromium = partial
        await save()
      })
      const integrity = entryProfileIntegrity(browser, configuration.fixtures, configuration.rounds, configuration.warmup)
      report.chromium = { ...browser, integrity, summary: entryProfileSummary(browser.samples, browser.steady) }
      errors.push(...integrity)
    }
    await assertProfileArtifacts(prepared.artifacts)
    report.status = errors.length ? 'incomplete' : 'profile-complete'
    report.integrity = errors
  }
  catch (error) {
    report.status = 'failed'
    report.error = String(error).replaceAll(repositoryRoot, '<repository>')
    throw error
  }
  finally {
    report.finishedAt = new Date().toISOString()
    await save()
  }
  return report
}
