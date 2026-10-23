import type { NativePublicationProfileIdentity, NativePublicationReceipt } from './files'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, expect, it } from 'vitest'
import { captureNativePublication } from '.'
import { createDevBuildCompletion } from '../devBuildCompletion'
import { NATIVE_PUBLICATION_PREFIX, nativePublicationGeneration, nativePublicationHash, readNativePublicationInputs } from './files'

const projects: string[] = []

afterEach(async () => {
  await Promise.all(projects.splice(0).map(project => rm(project, { recursive: true, force: true })))
})

function sourceEnd(identity: NativePublicationProfileIdentity, status = 'complete') {
  return `${JSON.stringify({
    schemaVersion: 1,
    pipeline: 'standard',
    sessionId: 'split-source-session',
    buildId: identity.buildId,
    batchId: identity.batchId,
    totalMs: 1,
    status,
    correlation: 'known',
    clock: { durations: 'performance.now', timestamp: 'UTC', timeOrigin: performance.timeOrigin },
    sourceEvents: identity.sourceEvents.map(event => ({ ...event, event: 'update', receivedAtMs: performance.now() })),
  })}\n`
}

async function fixture() {
  const project = await mkdtemp(path.join(tmpdir(), 'native-publication-split-'))
  projects.push(project)
  await mkdir(path.join(project, 'src'))
  await mkdir(path.join(project, 'dist'))
  const page = path.join(project, 'src/page.js')
  const css = path.join(project, 'src/page.css')
  const profilePath = path.join(project, 'profile.jsonl')
  const script = 'Page({ data: { marker: "FINAL" } })'
  const style = '.page { color: blue; }'
  await Promise.all([
    writeFile(page, script),
    writeFile(css, style),
    writeFile(path.join(project, 'dist/page.js'), script),
    writeFile(path.join(project, 'dist/page.wxss'), style),
    writeFile(profilePath, ''),
  ])
  let output = ''
  const dev = { getOutput: () => output, waitFor: async <T>(task: Promise<T>) => task }
  const inputs = await readNativePublicationInputs(project)
  const outputs = { 'page.js': nativePublicationHash(script), 'page.wxss': nativePublicationHash(style) }
  const cssIdentity = { buildId: 'split-source-session:4', batchId: 'css-batch', sourceEvents: [{ eventId: 'css-event', file: css }] }
  const pageIdentity = { buildId: 'split-source-session:5', batchId: 'page-batch', sourceEvents: [{ eventId: 'page-event', file: page }] }
  const receipt = (identity: NativePublicationProfileIdentity, previousProfile = '', first = false): NativePublicationReceipt => ({
    boundary: first ? 'native-byte-write' : 'native-noop',
    generation: nativePublicationGeneration(first ? { 'page.wxss': outputs['page.wxss'] } : outputs),
    inputs,
    outputs: first ? { 'page.wxss': outputs['page.wxss'] } : outputs,
    ...(first ? {} : { publicationEpoch: 1 }),
    profileCursor: { offset: previousProfile.length, prefixHash: nativePublicationHash(previousProfile), identity },
  })
  const append = (value: NativePublicationReceipt) => {
    output += `${NATIVE_PUBLICATION_PREFIX}${JSON.stringify(value)}\n`
  }
  return { project, page, css, profilePath, dev, inputs, outputs, cssIdentity, pageIdentity, receipt, append }
}

it.each(['complete', 'missing-second', 'failed-first', 'failed-second', 'wrong-build', 'wrong-batch', 'wrong-event', 'replaced-first-prefix'] as const)('retains each split source receipt and its own END cursor: %s', async (variant) => {
  const run = await fixture()
  const publication = captureNativePublication(run.dev, run.project, { expectedSourceFiles: [run.css, run.page] })
  const completion = createDevBuildCompletion(run.dev, { source: { files: [run.css, run.page], profilePath: run.profilePath } })
  const firstEnd = sourceEnd(run.cssIdentity, variant === 'failed-first' ? 'failed' : 'complete')
  const secondIdentity = {
    ...run.pageIdentity,
    ...(variant === 'wrong-build' ? { buildId: 'foreign-build' } : {}),
    ...(variant === 'wrong-batch' ? { batchId: 'foreign-batch' } : {}),
    ...(variant === 'wrong-event' ? { sourceEvents: [{ eventId: 'foreign-event', file: run.page }] } : {}),
  }
  const first = run.receipt(run.cssIdentity, '', true)
  if (variant === 'replaced-first-prefix') {
    first.profileCursor!.prefixHash = nativePublicationHash('replaced')
  }
  run.append(first)
  // 第一份 END 位于第二份收据游标之前；不能用最大游标删除早批次的完成证据。
  run.append(run.receipt(run.pageIdentity, firstEnd))
  await writeFile(run.profilePath, firstEnd + (variant === 'missing-second' ? '' : sourceEnd(secondIdentity, variant === 'failed-second' ? 'failed' : 'complete')))
  const receipt = await publication.wait(1_000)
  expect(receipt.sourcePublications?.map(value => value.cursor.identity)).toEqual([run.cssIdentity, run.pageIdentity])
  const waiting = completion.wait(100, receipt.sourcePublications)
  if (variant === 'complete') {
    await expect(waiting).resolves.toBeUndefined()
  }
  else if (variant.startsWith('failed')) {
    await expect(waiting).rejects.toThrow('preserve the original dev build error')
  }
  else if (variant === 'replaced-first-prefix') {
    await expect(waiting).rejects.toThrow('truncated or replaced')
  }
  else {
    await expect(waiting).rejects.toThrow('source profile publication')
  }
})

it.each(['different-inputs', 'foreign-disk', 'before-capture'] as const)('does not combine unrelated source receipts: %s', async (variant) => {
  const run = await fixture()
  const first = run.receipt(run.cssIdentity, '', true)
  if (variant === 'different-inputs') {
    first.inputs = { ...first.inputs, 'src/page.css': nativePublicationHash('previous source') }
  }
  if (variant === 'foreign-disk') {
    first.outputs = { 'page.wxss': nativePublicationHash('foreign disk bytes') }
    first.generation = nativePublicationGeneration(first.outputs)
  }
  if (variant === 'before-capture') {
    run.append(first)
  }
  const publication = captureNativePublication(run.dev, run.project, { expectedSourceFiles: [run.css, run.page] })
  if (variant !== 'before-capture') {
    run.append(first)
  }
  run.append(run.receipt(run.pageIdentity))
  await expect(publication.wait(100)).rejects.toThrow('final source generation')
})

it('requires every selected identity END when separate batches contain the same source', async () => {
  const run = await fixture()
  const publication = captureNativePublication(run.dev, run.project, { expectedSourceFiles: [run.page] })
  const completion = createDevBuildCompletion(run.dev, { source: { files: [run.page], profilePath: run.profilePath } })
  const earlierIdentity = { ...run.cssIdentity, sourceEvents: [{ eventId: 'earlier-page-event', file: run.page }] }
  run.append(run.receipt(earlierIdentity, '', true))
  run.append(run.receipt(run.pageIdentity))
  await writeFile(run.profilePath, sourceEnd(run.pageIdentity))
  const receipt = await publication.wait(1_000)
  expect(receipt.sourcePublications).toHaveLength(2)
  await expect(completion.wait(100, receipt.sourcePublications)).rejects.toThrow('source profile publication')
})

it('does not replace source evidence with a later unattributed receipt', async () => {
  const run = await fixture()
  const publication = captureNativePublication(run.dev, run.project, { expectedSourceFiles: [run.page] })
  run.append(run.receipt(run.pageIdentity))
  const { identity: _identity, ...cursor } = run.receipt(run.pageIdentity).profileCursor!
  run.append({ ...run.receipt(run.pageIdentity), profileCursor: cursor })
  const receipt = await publication.wait(1_000)
  expect(receipt.profileCursor?.identity).toEqual(run.pageIdentity)
})

it.each(['before-ready', 'after-ready'] as const)('uses an unattributed cold receipt only at the caller-proven cold boundary: %s', async (variant) => {
  const run = await fixture()
  let readyAt = -1
  const publication = captureNativePublication(run.dev, run.project, {
    expectedSourceFiles: [run.page],
    allowSourceFreePublication: offset => readyAt > offset,
  })
  if (variant === 'after-ready') {
    readyAt = 0
  }
  const { identity: _identity, ...cursor } = run.receipt(run.pageIdentity).profileCursor!
  run.append({ ...run.receipt(run.pageIdentity), profileCursor: cursor })
  if (variant === 'before-ready') {
    readyAt = run.dev.getOutput().length + 1
  }
  if (variant === 'before-ready') {
    await expect(publication.wait(1_000)).resolves.toMatchObject({ profileCursor: cursor })
  }
  else {
    await expect(publication.wait(100)).rejects.toThrow('final source generation')
  }
})
