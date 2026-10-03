import type { HmrProfileJsonSample } from '../../analyze/hmr'
import type { StatefulHmrSnapshot } from './globalStyles'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { expect, it, vi } from 'vitest'
import { StatefulHmrProfile } from './profile'
import { StatefulHmrSnapshotHandoff } from './snapshotHandoff'

const snapshot: StatefulHmrSnapshot = { output: [], componentPageGlobalStyleRoutes: [], glassEaselAnalysisByOwner: new Map() }
const inputs = { scope: { roots: [], files: [], excluded: [] }, versions: new Map() }

it('hands off only once after input validation', async () => {
  const validate = vi.fn(async () => true)
  const handoff = new StatefulHmrSnapshotHandoff(snapshot, inputs, validate)
  await expect(handoff.take()).resolves.toEqual({ snapshot, profile: undefined })
  await expect(handoff.take()).resolves.toBeUndefined()
  expect(validate).toHaveBeenCalledOnce()
})

it.each(['changed', 'throw', 'close'] as const)('finishes the detached profile when validation is %s', async (mode) => {
  const samples: HmrProfileJsonSample[] = []
  const owner = new StatefulHmrProfile({ root: '/fixture', emit: sample => samples.push(sample) })
  owner.source('app.json')
  const profile = owner.transfer(owner.begin(['app.json'], 'delivery'))!
  const validated = Promise.withResolvers<boolean>()
  const handoff = new StatefulHmrSnapshotHandoff(snapshot, inputs, () => validated.promise, profile)
  const taking = handoff.take()
  const result = mode === 'throw' ? expect(taking).rejects.toThrow('validation failed') : expect(taking).resolves.toBeUndefined()
  await owner.close()
  expect(samples).toEqual([])
  if (mode === 'close') {
    await handoff.invalidate()
  }
  if (mode === 'throw') {
    validated.reject(new Error('validation failed'))
  }
  else {
    validated.resolve(mode === 'close')
  }
  await result
  await handoff.invalidate()
  expect(samples).toHaveLength(1)
  expect(samples[0]).toMatchObject({ status: mode === 'throw' ? 'failed' : 'incomplete' })
  expect(samples[0]!.totalMs).toBeUndefined()
})

it('does not revoke an in-flight take when another consumer asks for the same handoff', async () => {
  const validated = Promise.withResolvers<boolean>()
  const handoff = new StatefulHmrSnapshotHandoff(snapshot, inputs, () => validated.promise)
  const taking = handoff.take()
  await expect(handoff.take()).resolves.toBeUndefined()
  validated.resolve(true)
  await expect(taking).resolves.toEqual({ snapshot, profile: undefined })
})

it('discards changed, missing and invalidated candidates without publishing them', async () => {
  await expect(new StatefulHmrSnapshotHandoff(snapshot, inputs, async () => false).take()).resolves.toBeUndefined()
  await expect(new StatefulHmrSnapshotHandoff(snapshot).take()).resolves.toBeUndefined()
  const validated = Promise.withResolvers<boolean>()
  const handoff = new StatefulHmrSnapshotHandoff(snapshot, inputs, () => validated.promise)
  const taking = handoff.take()
  handoff.invalidate()
  handoff.invalidate()
  validated.resolve(true)
  await expect(taking).resolves.toBeUndefined()
  await expect(handoff.take()).resolves.toBeUndefined()
})

it('hands off the profile without an unvalidated snapshot so a fresh build can finish it', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'profile-fresh-build-'))
  const file = path.join(root, 'page.json')
  try {
    await writeFile(file, '{}')
    const oldSamples: HmrProfileJsonSample[] = []
    const newSamples: HmrProfileJsonSample[] = []
    const owner = new StatefulHmrProfile({ root, emit: sample => oldSamples.push(sample) })
    owner.source(file)
    const profile = owner.transfer(owner.begin([file], 'delivery'))!
    const validate = vi.fn(async () => true)
    const sources = new Map([[file, '{}'], ['\0compiler:virtual', 'generated']])
    const handoff = new StatefulHmrSnapshotHandoff(snapshot, undefined, validate, profile, sources)
    const next = await handoff.take()
    expect(next).toEqual({ snapshot: undefined, profile })
    expect(validate).not.toHaveBeenCalled()
    await expect(handoff.take()).resolves.toBeUndefined()
    await handoff.invalidate()
    await owner.close()
    expect(oldSamples).toEqual([])
    const replacement = new StatefulHmrProfile({ root, emit: sample => newSamples.push(sample), buildId: () => 'fresh-build' })
    await replacement.adopt(next!.profile!)!.finishPublished()
    await replacement.close()
    expect(newSamples).toHaveLength(1)
    expect(newSamples[0]).toMatchObject({ status: 'complete', buildId: 'fresh-build', profileMode: 'full', completionBoundary: 'output-published', file })
  }
  finally {
    await rm(root, { recursive: true, force: true })
  }
})

it.each([undefined, new Map(), new Map([['unrelated.json', '{}']])])('cancels profiling without source evidence when the snapshot cannot be reused', async (sources) => {
  const samples: HmrProfileJsonSample[] = []
  const owner = new StatefulHmrProfile({ root: '/fixture', emit: sample => samples.push(sample) })
  owner.source('page.json')
  const profile = owner.transfer(owner.begin(['page.json'], 'delivery'))!
  const handoff = new StatefulHmrSnapshotHandoff(snapshot, undefined, undefined, profile, sources)
  await expect(handoff.take()).resolves.toBeUndefined()
  expect(samples).toHaveLength(1)
  expect(samples[0]).toMatchObject({ status: 'incomplete' })
})

it('revalidates sources changed during a fresh build after handoff', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'profile-fresh-source-gap-'))
  const file = path.join(root, 'page.json')
  try {
    await writeFile(file, '{}')
    const samples: HmrProfileJsonSample[] = []
    const owner = new StatefulHmrProfile({ root, emit: sample => samples.push(sample) })
    owner.source(file)
    const profile = owner.transfer(owner.begin([file], 'delivery'))!
    const handoff = new StatefulHmrSnapshotHandoff(snapshot, undefined, undefined, profile, new Map([[file, '{}']]))
    const next = await handoff.take()
    const freshBuild = Promise.withResolvers<void>()
    const publication = (async () => {
      await freshBuild.promise
      const replacement = new StatefulHmrProfile({ root, emit: sample => samples.push(sample), buildId: () => 'fresh-build' })
      await replacement.adopt(next!.profile!)!.finishPublished()
      await replacement.close()
    })()
    await owner.close()
    await writeFile(file, '{"newer":true}')
    expect(samples).toEqual([])
    freshBuild.resolve()
    await publication
    expect(samples).toHaveLength(1)
    expect(samples[0]).toMatchObject({ status: 'incomplete', buildId: 'fresh-build', file })
    expect(samples[0]!.totalMs).toBeUndefined()
  }
  finally {
    await rm(root, { recursive: true, force: true })
  }
})

it.each(['unchanged', 'changed', 'deleted'] as const)('checks immutable profile sources after the old watcher stops: %s', async (mode) => {
  const root = await mkdtemp(path.join(tmpdir(), 'profile-handoff-sources-'))
  const file = path.join(root, 'page.json')
  try {
    await writeFile(file, '{}')
    const samples: HmrProfileJsonSample[] = []
    const owner = new StatefulHmrProfile({ root, emit: sample => samples.push(sample) })
    owner.source(file)
    const profile = owner.transfer(owner.begin([file], 'delivery'))!
    const handoff = new StatefulHmrSnapshotHandoff(snapshot, undefined, undefined, profile, new Map([[file, '{}']]))
    await owner.close()
    if (mode === 'changed') {
      await writeFile(file, '{"newer":true}')
    }
    else if (mode === 'deleted') {
      await rm(file)
    }
    const next = await handoff.take()
    if (mode === 'unchanged') {
      expect(next).toEqual({ snapshot: undefined, profile })
      expect(samples).toEqual([])
      await next!.profile!.cancel()
    }
    else {
      expect(next).toBeUndefined()
    }
    expect(samples).toHaveLength(1)
    expect(samples[0]).toMatchObject({ status: 'incomplete' })
    expect(samples[0]!.totalMs).toBeUndefined()
  }
  finally {
    await rm(root, { recursive: true, force: true })
  }
})
