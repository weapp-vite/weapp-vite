import type { captureNativePublication } from '.'
import type { startDevProcess } from '../dev-process'
import type { createDevBuildCompletion } from '../devBuildCompletion'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, expect, it, vi } from 'vitest'
import { createNativeHmrPublication } from '../nativeHmrPublication'
import { nativePublicationGeneration, nativePublicationHash } from './files'

type NativeObservation = Awaited<ReturnType<ReturnType<typeof captureNativePublication>['wait']>>

const capture = vi.hoisted(() => ({
  native: vi.fn<typeof captureNativePublication>(),
  completion: vi.fn<typeof createDevBuildCompletion>(),
}))
vi.mock('../nativePublication', () => ({ captureNativePublication: capture.native }))
vi.mock('../devBuildCompletion', () => ({ createDevBuildCompletion: capture.completion }))

const roots: string[] = []
const fallbackRecord = { from: 'stateful-experimental', to: 'classic', reason: 'stylesheet-output', message: 'compiled stylesheet changed', requested: 'stateful-experimental', actual: 'classic', phase: 'switching' }
const readyRecord = { reason: 'stylesheet-output', requested: 'stateful-experimental', actual: 'classic', phase: 'classic' }
const fallbackLog = (record: Record<string, unknown>) => `[weapp-vite] HMR fallback ${JSON.stringify(record)}\n`
const readyLog = (record: Record<string, unknown>) => `[weapp-vite] HMR classic ready ${JSON.stringify(record)}\n`
const fallback = fallbackLog(fallbackRecord)
const ready = readyLog(readyRecord)

afterEach(async () => {
  vi.resetAllMocks()
  await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true })))
})

async function fixture(initialOutput = 'initial native build complete\n', requested: 'auto' | 'classic' | 'stateful-experimental' = 'stateful-experimental') {
  const project = await mkdtemp(path.join(tmpdir(), 'native-hmr-publication-'))
  roots.push(project)
  await mkdir(path.join(project, 'dist'))
  await writeFile(path.join(project, 'dist/app.js'), 'App({})')
  let output = initialOutput
  const dev = { getOutput: () => output } as ReturnType<typeof startDevProcess>
  const native = Promise.withResolvers<NativeObservation>()
  const nativeWait = vi.fn(() => native.promise)
  capture.native.mockReturnValue({ wait: nativeWait })
  const publication = createNativeHmrPublication(project, dev, requested, ['stylesheet-output'], path.join(project, 'profile.jsonl'))
  const append = (text: string) => {
    output += text
  }
  const receipt = (): NativeObservation => {
    const outputs = { 'app.js': nativePublicationHash('App({})') }
    return {
      boundary: 'native-byte-write',
      generation: nativePublicationGeneration(outputs),
      inputs: { 'src/app.js': outputs['app.js'] },
      outputs,
      outputOffset: output.length,
      profileCursor: { offset: 0, prefixHash: nativePublicationHash('') },
    }
  }
  return { append, dev, native, nativeWait, project, publication, receipt }
}

it.each(['classic', 'after-fallback'] as const)('filters native receipt sources when the effective mode is %s', async (mode) => {
  const run = mode === 'classic'
    ? await fixture('initial native build complete\n', 'classic')
    : await fixture(fallback + ready)
  for (const sourceFiles of ['src/app.js', ['src/app.js', 'src/page.vue']] as const) {
    run.publication.capture(sourceFiles)
    expect(capture.native).toHaveBeenLastCalledWith(run.dev, run.project, {
      expectedSourceFiles: typeof sourceFiles === 'string' ? [sourceFiles] : sourceFiles,
    })
  }
  expect(capture.native).toHaveBeenCalledTimes(2)
})

it.each(['auto', 'stateful-experimental'] as const)('does not filter a %s native receipt before cold classic readiness', async (requested) => {
  const run = await fixture('initial native build complete\n', requested)
  run.publication.capture('src/app.js')
  expect(capture.native).toHaveBeenLastCalledWith(run.dev, run.project, {})
  run.append(fallbackLog({ ...fallbackRecord, requested }))
  run.publication.capture(['src/app.js', 'src/page.vue'])
  expect(capture.native).toHaveBeenLastCalledWith(run.dev, run.project, {})
  expect(capture.native).toHaveBeenCalledTimes(2)
})

it.each(['auto', 'stateful-experimental'] as const)('validates the configured %s request independently of the initial stateful delivery', async (requested) => {
  const run = await fixture('initial native build complete\n', requested)
  expect(run.publication.stateful).toBe(true)
  run.append(fallbackLog({ ...fallbackRecord, requested }))
  expect(run.publication.stateful).toBe(true)
  run.append(readyLog({ ...readyRecord, requested }))
  expect(run.publication.stateful).toBe(false)
  await expect(run.publication.assertClassicOutput()).resolves.toBeUndefined()
})

it('rejects internally consistent logs for a different configured request', async () => {
  const run = await fixture(fallback + ready, 'auto')
  expect(() => run.publication.stateful).toThrow()
})

it.each([
  ['fallback', 'requested', undefined],
  ['fallback', 'requested', 'auto'],
  ['fallback', 'actual', undefined],
  ['fallback', 'actual', 'stateful-experimental'],
  ['fallback', 'phase', undefined],
  ['fallback', 'phase', 'classic'],
  ['ready', 'requested', undefined],
  ['ready', 'requested', 'auto'],
  ['ready', 'actual', undefined],
  ['ready', 'actual', 'stateful-experimental'],
  ['ready', 'phase', undefined],
  ['ready', 'phase', 'switching'],
] as const)('rejects invalid %s %s evidence: %s', async (event, field, value) => {
  const output = event === 'fallback'
    ? fallbackLog({ ...fallbackRecord, [field]: value }) + ready
    : fallback + readyLog({ ...readyRecord, [field]: value })
  const run = await fixture(output)
  expect(() => run.publication.stateful).toThrow()
})

it('requires final source completion when a new classic ready precedes the final receipt', async () => {
  const run = await fixture()
  const completed = Promise.withResolvers<void>()
  const started = Promise.withResolvers<void>()
  const completionWait = vi.fn(() => {
    started.resolve()
    return completed.promise
  })
  capture.completion.mockReturnValue({ wait: completionWait })
  const publication = run.publication.capture('src/app.js')
  run.append(fallback + ready)
  let finished = false
  const waiting = publication.wait().then(() => {
    finished = true
  })
  expect(run.nativeWait).toHaveBeenCalledExactlyOnceWith(90_000)
  expect(finished).toBe(false)
  run.append('final source generation published\n')
  const receipt = run.receipt()
  run.native.resolve(receipt)
  await started.promise
  expect(finished).toBe(false)
  expect(completionWait).toHaveBeenCalledExactlyOnceWith(90_000, receipt.profileCursor)
  completed.resolve()
  await expect(waiting).resolves.toBeUndefined()
  expect(finished).toBe(true)
  expect(run.publication.stateful).toBe(false)
})

it.each([true, false])('accepts cold classic readiness after the final receipt with fallback logged before it: %s', async (fallbackBeforeReceipt) => {
  const run = await fixture()
  const publication = run.publication.capture()
  if (fallbackBeforeReceipt) {
    run.append(fallback)
  }
  run.append('final source generation published\n')
  run.native.resolve(run.receipt())
  run.append(fallbackBeforeReceipt ? ready : fallback + ready)
  await expect(publication.wait()).resolves.toBeUndefined()
  expect(run.publication.stateful).toBe(false)
  expect(capture.completion).not.toHaveBeenCalled()
})

it('preserves a final source post-write failure even when fallback is already ready', async () => {
  const run = await fixture()
  const completed = Promise.withResolvers<void>()
  const started = Promise.withResolvers<void>()
  const completionWait = vi.fn(() => {
    started.resolve()
    return completed.promise
  })
  capture.completion.mockReturnValue({ wait: completionWait })
  const publication = run.publication.capture('src/app.js')
  run.append(fallback + ready)
  run.append('final source generation published\n')
  const receipt = run.receipt()
  run.native.resolve(receipt)
  const error = new Error('original final source post-write failure')
  const rejected = expect(publication.wait()).rejects.toBe(error)
  await started.promise
  expect(completionWait).toHaveBeenCalledExactlyOnceWith(90_000, receipt.profileCursor)
  completed.reject(error)
  await rejected
})

it('requires source evidence when the final receipt follows the first fallback readiness', async () => {
  const run = await fixture()
  const publication = run.publication.capture()
  run.append(fallback + ready)
  run.append('final source generation published\n')
  run.native.resolve(run.receipt())
  await expect(publication.wait()).rejects.toThrow('Classic publication requires explicit source files, profile path and the native write profile cursor')
})

it('requires the final receipt profile cursor after the first fallback readiness', async () => {
  const run = await fixture()
  const completionWait = vi.fn(async () => {})
  capture.completion.mockReturnValue({ wait: completionWait })
  const publication = run.publication.capture('src/app.js')
  run.append(fallback + ready)
  run.append('final source generation published\n')
  const { profileCursor: _profileCursor, ...receipt } = run.receipt()
  run.native.resolve(receipt)
  await expect(publication.wait()).rejects.toThrow('Classic publication requires explicit source files, profile path and the native write profile cursor')
  expect(completionWait).not.toHaveBeenCalled()
})

it('does not reuse an old ready as completion for a later classic source publication', async () => {
  const run = await fixture(fallback + ready)
  const completed = Promise.withResolvers<void>()
  const started = Promise.withResolvers<void>()
  const completionWait = vi.fn(() => {
    started.resolve()
    return completed.promise
  })
  capture.completion.mockReturnValue({ wait: completionWait })
  const publication = run.publication.capture('src/app.js')
  let finished = false
  const waiting = publication.wait().then(() => {
    finished = true
  })
  const receipt = run.receipt()
  run.native.resolve(receipt)
  await started.promise
  expect(finished).toBe(false)
  expect(completionWait).toHaveBeenCalledExactlyOnceWith(90_000, receipt.profileCursor)
  completed.resolve()
  await expect(waiting).resolves.toBeUndefined()
})

it('requires source completion evidence when only an old ready is available', async () => {
  const run = await fixture(fallback + ready)
  const publication = run.publication.capture()
  run.native.resolve(run.receipt())
  await expect(publication.wait()).rejects.toThrow('Classic publication requires explicit source files, profile path and the native write profile cursor')
})

it('preserves the original native publication error without accepting fallback readiness', async () => {
  const run = await fixture()
  const publication = run.publication.capture()
  run.append(fallback + ready)
  const error = new Error('original native build failed')
  const rejected = expect(publication.wait()).rejects.toBe(error)
  run.native.reject(error)
  await rejected
})

it('continues to reject original dev build error output', async () => {
  const run = await fixture(fallback + ready)
  run.append('Build failed with 1 error: original transform failure\n')
  expect(() => run.publication.capture()).toThrow()
  expect(capture.native).not.toHaveBeenCalled()
})

it.each([
  { name: 'fallback', duplicate: fallback },
  { name: 'classic ready', duplicate: ready },
])('rejects a duplicate $name notification for the first fallback', async ({ duplicate }) => {
  const run = await fixture()
  const publication = run.publication.capture()
  run.append(fallback + ready + duplicate)
  run.native.resolve(run.receipt())
  await expect(publication.wait()).rejects.toThrow(/length of 2/)
})
