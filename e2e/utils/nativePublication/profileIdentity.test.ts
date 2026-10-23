import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, expect, it } from 'vitest'
import { captureNativePublication } from '.'
import { NATIVE_PUBLICATION_PREFIX, nativePublicationGeneration, nativePublicationHash, readNativePublicationInputs } from './files'

const projects: string[] = []
const identity = {
  buildId: 'compiler-session:7',
  batchId: 'current-batch',
  sourceEvents: [{ eventId: 'current-event', file: 'src/app.js' }],
}

afterEach(async () => {
  for (const project of projects.splice(0)) {
    await rm(project, { recursive: true, force: true })
  }
})

async function receiptObservation(profileIdentity?: unknown) {
  const project = await mkdtemp(path.join(tmpdir(), 'native-publication-identity-'))
  projects.push(project)
  await mkdir(path.join(project, 'src'))
  await mkdir(path.join(project, 'dist'))
  await writeFile(path.join(project, 'src/app.js'), 'source')
  await writeFile(path.join(project, 'dist/app.js'), 'native output')
  let output = ''
  const observation = captureNativePublication({
    getOutput: () => output,
    waitFor: async <T>(task: Promise<T>) => task,
  }, project)
  const outputs = { 'app.js': nativePublicationHash('native output') }
  const profileCursor = {
    offset: 0,
    prefixHash: nativePublicationHash(''),
    ...(profileIdentity === undefined ? {} : { identity: profileIdentity }),
  }
  output = `${NATIVE_PUBLICATION_PREFIX}${JSON.stringify({
    boundary: 'native-byte-write',
    generation: nativePublicationGeneration(outputs),
    inputs: await readNativePublicationInputs(project),
    outputs,
    profileCursor,
  })}\n`
  return { observation, profileCursor }
}

it.each([undefined, identity])('preserves a valid profile cursor with optional identity %j', async (profileIdentity) => {
  const { observation, profileCursor } = await receiptObservation(profileIdentity)
  await expect(observation.wait(1_000)).resolves.toMatchObject({ profileCursor })
})

it.each([
  ['null identity', null],
  ['array identity', []],
  ['missing build', { batchId: identity.batchId, sourceEvents: identity.sourceEvents }],
  ['empty build', { ...identity, buildId: '' }],
  ['numeric build', { ...identity, buildId: 7 }],
  ['missing batch', { buildId: identity.buildId, sourceEvents: identity.sourceEvents }],
  ['empty batch', { ...identity, batchId: '' }],
  ['missing events', { buildId: identity.buildId, batchId: identity.batchId }],
  ['empty events', { ...identity, sourceEvents: [] }],
  ['non-array events', { ...identity, sourceEvents: {} }],
  ['null event', { ...identity, sourceEvents: [null] }],
  ['missing event id', { ...identity, sourceEvents: [{ file: 'src/app.js' }] }],
  ['empty event id', { ...identity, sourceEvents: [{ eventId: '', file: 'src/app.js' }] }],
  ['missing event file', { ...identity, sourceEvents: [{ eventId: 'current-event' }] }],
  ['empty event file', { ...identity, sourceEvents: [{ eventId: 'current-event', file: '' }] }],
] as const)('rejects a native receipt with %s', async (_label, profileIdentity) => {
  const { observation } = await receiptObservation(profileIdentity)
  await expect(observation.wait(1_000)).rejects.toThrow('Invalid native publication profile identity')
})
