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

function sourceEnd(identity: NativePublicationProfileIdentity) {
  return `${JSON.stringify({
    schemaVersion: 1,
    pipeline: 'standard',
    sessionId: 'retirement-session',
    ...identity,
    totalMs: 1,
    status: 'complete',
    correlation: 'known',
    clock: { durations: 'performance.now', timestamp: 'UTC', timeOrigin: performance.timeOrigin },
    sourceEvents: identity.sourceEvents.map(event => ({ ...event, event: 'update', receivedAtMs: performance.now() })),
  })}\n`
}

it.each([
  'complete',
  'missing-scope',
  'missing-epoch',
  'invalid-scope',
  'deleted-file-remains',
  'retained-file-stale',
  'retained-file-missing',
  'missing-first-end',
  'foreign-inputs',
  'partial-restores-file',
  'partial-does-not-cancel-deletion',
] as const)('verifies committed root retirement without losing split-source END evidence: %s', async (variant) => {
  const project = await mkdtemp(path.join(tmpdir(), 'native-publication-retirement-'))
  projects.push(project)
  await mkdir(path.join(project, 'src'))
  await mkdir(path.join(project, 'dist'))
  const template = path.join(project, 'src/page.wxml')
  const config = path.join(project, 'src/app.json')
  const profilePath = path.join(project, 'profile.jsonl')
  await Promise.all([
    writeFile(template, '<view>restored</view>'),
    writeFile(config, '{"pages":["page"]}'),
    writeFile(path.join(project, 'dist/app.js'), 'App({})'),
  ])
  let output = ''
  const dev = { getOutput: () => output, waitFor: async <T>(task: Promise<T>) => task }
  const publication = captureNativePublication(dev, project, { expectedSourceFiles: [template, config] })
  const completion = createDevBuildCompletion(dev, { source: { files: [template, config], profilePath } })
  const inputs = await readNativePublicationInputs(project)
  const firstIdentity = { buildId: 'retirement-session:7', batchId: 'template-batch', sourceEvents: [{ eventId: 'template-event', file: template }] }
  const lastIdentity = { buildId: 'retirement-session:8', batchId: 'config-batch', sourceEvents: [{ eventId: 'config-event', file: config }] }
  const firstEnd = sourceEnd(firstIdentity)
  const append = (receipt: NativePublicationReceipt | (Omit<NativePublicationReceipt, 'outputScope'> & { outputScope?: string })) => {
    output += `${NATIVE_PUBLICATION_PREFIX}${JSON.stringify(receipt)}\n`
  }
  const initialOutputs = { 'optional.wxss': nativePublicationHash('.optional { color: red; }') }
  append({
    boundary: 'native-byte-write',
    inputs,
    outputs: initialOutputs,
    generation: nativePublicationGeneration(initialOutputs),
    profileCursor: { offset: 0, prefixHash: nativePublicationHash(''), identity: firstIdentity },
  })
  const finalOutputs = { 'app.js': nativePublicationHash('App({})') }
  const final = {
    boundary: 'native-byte-write' as const,
    inputs: variant === 'foreign-inputs' ? { ...inputs, 'src/app.json': nativePublicationHash('foreign config') } : inputs,
    outputs: finalOutputs,
    generation: nativePublicationGeneration(finalOutputs),
    ...(variant === 'missing-scope' ? {} : { outputScope: variant === 'invalid-scope' ? 'unknown' : 'committed' }),
    ...(variant === 'missing-epoch' ? {} : { publicationEpoch: 8 }),
    profileCursor: { offset: variant === 'missing-first-end' ? 0 : firstEnd.length, prefixHash: nativePublicationHash(variant === 'missing-first-end' ? '' : firstEnd), identity: lastIdentity },
  }
  append(final)
  if (variant === 'partial-restores-file' || variant === 'partial-does-not-cancel-deletion') {
    const outputs = variant === 'partial-restores-file' ? initialOutputs : finalOutputs
    append({ ...final, outputs, generation: nativePublicationGeneration(outputs), outputScope: undefined, publicationEpoch: undefined })
  }
  if (variant === 'deleted-file-remains' || variant === 'partial-restores-file' || variant === 'partial-does-not-cancel-deletion') {
    await writeFile(path.join(project, 'dist/optional.wxss'), '.optional { color: red; }')
  }
  if (variant === 'retained-file-stale') {
    await writeFile(path.join(project, 'dist/app.js'), 'stale bytes')
  }
  if (variant === 'retained-file-missing') {
    await rm(path.join(project, 'dist/app.js'))
  }
  await writeFile(profilePath, (variant === 'missing-first-end' ? '' : firstEnd) + sourceEnd(lastIdentity))
  if (variant === 'missing-epoch' || variant === 'invalid-scope') {
    await expect(publication.wait(100)).rejects.toThrow(variant === 'missing-epoch' ? 'Invalid committed native publication epoch' : 'Invalid native publication output scope')
  }
  else if (variant === 'complete' || variant === 'partial-restores-file' || variant === 'missing-first-end') {
    const receipt = await publication.wait(1_000)
    expect(receipt.sourcePublications?.map(value => value.cursor.identity)).toContainEqual(firstIdentity)
    expect(receipt.sourcePublications?.map(value => value.cursor.identity)).toContainEqual(lastIdentity)
    if (variant === 'missing-first-end') {
      await expect(completion.wait(100, receipt.sourcePublications)).rejects.toThrow('source profile publication')
    }
    else {
      await expect(completion.wait(100, receipt.sourcePublications)).resolves.toBeUndefined()
    }
  }
  else {
    await expect(publication.wait(100)).rejects.toThrow('final source generation')
  }
})
