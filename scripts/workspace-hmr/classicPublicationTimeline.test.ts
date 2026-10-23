import { createHash } from 'node:crypto'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { summarizeWorkspaceHmrTimeline, writeWorkspaceHmrTimelineEvidence } from './classicPublicationTimeline'

const roots: string[] = []
afterEach(async () => {
  await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true })))
})

describe('workspace HMR existing-run timeline evidence', () => {
  it('retains incomplete identities and malformed lines without inventing success timing', () => {
    const incomplete = { status: 'incomplete', buildId: 'build', batchId: 'batch', elapsedMs: 25, sourceEvents: [{ eventId: 'save' }] }
    const summary = summarizeWorkspaceHmrTimeline('', `${JSON.stringify(incomplete)}\ninvalid\n{"status":"complete","totalMs":1e999,"writeMs":3}\n`)
    expect(summary.profileAvailable).toBe(true)
    expect(summary.malformedProfileLines).toEqual([2])
    expect(summary.samples[0]).toMatchObject({ line: 1, buildId: 'build', batchId: 'batch', status: 'incomplete', metrics: { elapsedMs: 25 }, sourceEventCount: 1 })
    expect(summary.samples[0]!.metrics).not.toHaveProperty('totalMs')
    expect(summary.samples[1]!.metrics).toEqual({ writeMs: 3 })
  })

  it('summarizes large receipts with exact line fingerprints and preserves following lifecycle order', () => {
    const receipt = `[native-publication] ${JSON.stringify({ boundary: 'native-byte-write', generation: 'generation', inputs: { 'src/page.vue': 'hash' }, outputs: Object.fromEntries(Array.from({ length: 2_400 }, (_, index) => [`output/${index}.js`, 'hash'])), profileCursor: { identity: { buildId: 'build', batchId: 'batch', sourceEvents: [{ eventId: 'save' }] } } })}`
    const summary = summarizeWorkspaceHmrTimeline(`${receipt}\n[weapp-vite] HMR classic ready build\n`)
    expect(summary.boundaries).toEqual([
      expect.objectContaining({ line: 1, type: 'native-publication', inputCount: 1, outputCount: 2_400, buildId: 'build', batchId: 'batch', sha256: createHash('sha256').update(receipt).digest('hex') }),
      expect.objectContaining({ line: 2, type: 'dev-lifecycle', message: '[weapp-vite] HMR classic ready build' }),
    ])
    expect(JSON.stringify(summary).length).toBeLessThan(1_500)
  })

  it('freezes exact raw stdout and profile bytes alongside their content hashes', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'hmr-timeline-'))
    roots.push(root)
    const profilePath = path.join(root, 'source.jsonl')
    const profile = '{"status":"complete","totalMs":12}\r\n'
    const stdout = '中文构建输出\r\n[native-publication] {}\n'
    await writeFile(profilePath, profile)
    const directory = path.join(root, 'evidence')
    const evidence = await writeWorkspaceHmrTimelineEvidence(directory, stdout, profilePath)
    expect(await readFile(path.join(directory, evidence.stdout.file), 'utf8')).toBe(stdout)
    expect(await readFile(path.join(directory, 'hmr-profile.jsonl'), 'utf8')).toBe(profile)
    expect(evidence.profile).toMatchObject({ file: 'hmr-profile.jsonl', sha256: createHash('sha256').update(profile).digest('hex') })
    const missing = await writeWorkspaceHmrTimelineEvidence(path.join(root, 'missing-evidence'), '', path.join(root, 'missing.jsonl'))
    expect(missing.profile).toEqual({ missing: true })
    expect(missing.timeline.profileAvailable).toBe(false)
  })
})
