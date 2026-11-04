import type { startDevProcess } from '../../e2e/utils/dev-process'
import type { createDevBuildCompletion } from '../../e2e/utils/devBuildCompletion'
import type { captureNativePublication } from '../../e2e/utils/nativePublication'
import type { NativePublicationProfileCursor } from '../../e2e/utils/nativePublication/files'
import type { DistFileSnapshot, waitForStableDistSnapshot } from './output'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, expect, it, vi } from 'vitest'
import { captureWorkspaceClassicPublication, inspectWorkspaceScenarioPublication, isWorkspaceClassicPublication } from './classicPublicationObservation'

const capture = vi.hoisted(() => ({
  native: vi.fn<typeof captureNativePublication>(),
  completion: vi.fn<typeof createDevBuildCompletion>(),
  stable: vi.fn<typeof waitForStableDistSnapshot>(),
}))
vi.mock('../../e2e/utils/nativePublication', () => ({ captureNativePublication: capture.native }))
vi.mock('../../e2e/utils/devBuildCompletion', () => ({ createDevBuildCompletion: capture.completion }))
vi.mock('./output', () => ({ waitForStableDistSnapshot: capture.stable }))

afterEach(() => {
  vi.resetAllMocks()
  vi.restoreAllMocks()
})

it.each(['classic', 'stateful-experimental'] as const)('selects the requested workspace source in %s mode', (mode) => {
  const root = path.join(tmpdir(), 'workspace-hmr-observation')
  const project = { root, sourceRoot: path.join(root, 'src'), distRoot: path.join(root, 'dist') }
  const sourceFile = path.join(project.sourceRoot, 'page.vue')
  let output = '[weapp-vite] HMR classic ready {"phase":"classic"}\n'
  const dev = { getOutput: () => output } as ReturnType<typeof startDevProcess>
  captureWorkspaceClassicPublication({ project, dev, sourceFile, profilePath: 'profile.jsonl', mode, stableMs: 10 })
  expect(capture.native).toHaveBeenCalledOnce()
  expect(capture.completion).toHaveBeenCalledWith(dev, { source: { files: [sourceFile], profilePath: 'profile.jsonl' } })
  const options = capture.native.mock.calls[0]![2]!
  expect(options).toMatchObject({ sourceRoot: 'src', outputRoot: project.distRoot, expectedSourceFiles: [sourceFile] })
  if (mode === 'classic') {
    expect(options.allowSourceFreePublication).toBeUndefined()
    return
  }
  const receiptEnd = output.length
  expect(options.allowSourceFreePublication?.(receiptEnd)).toBe(false)
  output += '[weapp-vite] HMR fallback {"phase":"switching"}\n'
  expect(options.allowSourceFreePublication?.(receiptEnd)).toBe(false)
  const coldReceiptEnd = output.length
  output += '[weapp-vite] HMR classic ready {"phase":"classic"}\n'
  expect(options.allowSourceFreePublication?.(coldReceiptEnd)).toBe(true)
  expect(options.allowSourceFreePublication?.(output.length)).toBe(false)
})

function scenarioPublication() {
  const root = path.join(tmpdir(), 'workspace-hmr-observation')
  const project = { root, sourceRoot: path.join(root, 'src'), distRoot: path.join(root, 'dist') }
  const outputPath = path.join(project.distRoot, 'pages/index.wxss')
  const sourceFile = path.join(project.sourceRoot, 'pages/index.scss')
  const native = Promise.withResolvers<Awaited<ReturnType<ReturnType<typeof captureNativePublication>['wait']>>>()
  const complete = Promise.withResolvers<void>()
  const stable = Promise.withResolvers<Map<string, DistFileSnapshot>>()
  const nativeWait = vi.fn(() => native.promise)
  const completionWait = vi.fn(() => complete.promise)
  capture.native.mockReturnValue({ wait: nativeWait })
  capture.completion.mockReturnValue({ wait: completionWait })
  capture.stable.mockImplementation(() => stable.promise)
  const dev = { getOutput: () => '', waitFor: <T>(task: Promise<T>) => task }
  const captured = captureWorkspaceClassicPublication({ project, dev, sourceFile, profilePath: 'profile.jsonl', mode: 'classic', stableMs: 10 })
  const snapshot = new Map([['app.json', { hash: 'a'.repeat(64), size: 12 }], ['pages/index.wxss', { hash: 'b'.repeat(64), size: 20 }]])
  const inspect = vi.fn(async () => ({ snapshot }))
  const budget = { deadline: Date.now() + 1_000 }
  const options = { project, outputPath, captured, inspect, budget, stableMs: 10 }
  const profileCursor: NativePublicationProfileCursor = { offset: 12, prefixHash: 'a'.repeat(64) }
  const receipt = { boundary: 'native-byte-write' as const, generation: 'b'.repeat(64), inputs: {}, outputs: {}, outputOffset: 20, profileCursor }
  return { native, complete, stable, nativeWait, completionWait, options, receipt, snapshot }
}

it('inspects standard output without fallback or ready only after its receipt, END and stability', async () => {
  expect(isWorkspaceClassicPublication('standard')).toBe(true)
  expect(isWorkspaceClassicPublication('stateful')).toBe(false)
  expect(isWorkspaceClassicPublication('stateful', 'classic')).toBe(true)
  const run = scenarioPublication()
  const inspection = inspectWorkspaceScenarioPublication(run.options)
  expect(run.options.inspect).not.toHaveBeenCalled()
  expect(run.completionWait).not.toHaveBeenCalled()
  run.native.resolve(run.receipt)
  await vi.waitFor(() => expect(run.completionWait).toHaveBeenCalledOnce())
  expect(capture.stable).not.toHaveBeenCalled()
  expect(run.options.inspect).not.toHaveBeenCalled()
  run.complete.resolve()
  await vi.waitFor(() => expect(capture.stable).toHaveBeenCalledOnce())
  expect(run.options.inspect).not.toHaveBeenCalled()
  run.stable.resolve(new Map())
  await expect(inspection).resolves.toEqual({ snapshot: run.snapshot })
  expect(run.options.inspect).toHaveBeenCalledOnce()
  expect(run.completionWait).toHaveBeenCalledWith(expect.any(Number), run.receipt.profileCursor)
  expect(capture.native.mock.calls[0]![2]!.allowSourceFreePublication).toBeUndefined()
})

it('rejects an optional final stylesheet missing from the complete snapshot instead of accepting app closure alone', async () => {
  const run = scenarioPublication()
  run.options.inspect.mockResolvedValue({ snapshot: new Map([['app.json', { hash: 'a'.repeat(64), size: 12 }]]) })
  run.native.resolve(run.receipt)
  run.complete.resolve()
  run.stable.resolve(new Map())
  await expect(inspectWorkspaceScenarioPublication(run.options)).rejects.toThrow('missing scenario output: pages/index.wxss')
  expect(run.options.inspect).toHaveBeenCalledOnce()
})

it('checks the delivered classic entry when fallback remaps the stateful scenario output', async () => {
  const run = scenarioPublication()
  const snapshot = new Map([['pages/index.js', { hash: 'a'.repeat(64), size: 20 }]])
  run.options.inspect.mockResolvedValue({ snapshot })
  run.native.resolve(run.receipt)
  run.complete.resolve()
  run.stable.resolve(new Map())
  await expect(inspectWorkspaceScenarioPublication({ ...run.options, outputPath: path.join(run.options.project.distRoot, '__weapp_vite_hmr/update.js'), deliveredOutput: 'pages/index.js' })).resolves.toEqual({ snapshot })
  expect(run.options.inspect).toHaveBeenCalledOnce()
})

it('retains the shared remaining budget through the complete standard publication and rejects late inspection', async () => {
  let now = 100
  vi.spyOn(Date, 'now').mockImplementation(() => now)
  const run = scenarioPublication()
  const signal = new AbortController().signal
  const inspection = inspectWorkspaceScenarioPublication({ ...run.options, budget: { deadline: 200, signal } })
  const rejected = expect(inspection).rejects.toThrow(/deadline/i)
  expect(run.nativeWait).toHaveBeenCalledWith(100)
  now = 120
  run.native.resolve(run.receipt)
  await vi.waitFor(() => expect(run.completionWait).toHaveBeenCalledWith(80, run.receipt.profileCursor))
  now = 150
  run.complete.resolve()
  await vi.waitFor(() => expect(capture.stable).toHaveBeenCalledWith(run.options.project.distRoot, 10, 50, signal))
  run.options.inspect.mockImplementationOnce(async () => {
    now = 201
    return { snapshot: run.snapshot }
  })
  run.stable.resolve(new Map())
  await rejected
  expect(run.options.inspect).toHaveBeenCalledOnce()
})

it('rejects stability completing after the original deadline without starting a new inspection budget', async () => {
  let now = 100
  vi.spyOn(Date, 'now').mockImplementation(() => now)
  const run = scenarioPublication()
  run.native.resolve(run.receipt)
  run.complete.resolve()
  const inspection = inspectWorkspaceScenarioPublication({ ...run.options, budget: { deadline: 200 } })
  const rejected = expect(inspection).rejects.toThrow(/deadline/i)
  await vi.waitFor(() => expect(capture.stable).toHaveBeenCalledOnce())
  now = 201
  run.stable.resolve(new Map())
  await rejected
  expect(run.options.inspect).not.toHaveBeenCalled()
})

it('preserves a finalization error without attempting stability or inspection', async () => {
  const run = scenarioPublication()
  const failure = new Error('native style finalization failed')
  const inspection = inspectWorkspaceScenarioPublication(run.options)
  const rejected = expect(inspection).rejects.toBe(failure)
  run.native.resolve(run.receipt)
  await vi.waitFor(() => expect(run.completionWait).toHaveBeenCalledOnce())
  run.complete.reject(failure)
  await rejected
  expect(capture.stable).not.toHaveBeenCalled()
  expect(run.options.inspect).not.toHaveBeenCalled()
})

it('preserves cancellation before starting any publication observation', async () => {
  const run = scenarioPublication()
  const controller = new AbortController()
  const failure = new Error('scenario cancelled')
  controller.abort(failure)
  await expect(inspectWorkspaceScenarioPublication({ ...run.options, budget: { ...run.options.budget, signal: controller.signal } })).rejects.toBe(failure)
  expect(run.nativeWait).not.toHaveBeenCalled()
  expect(run.completionWait).not.toHaveBeenCalled()
  expect(run.options.inspect).not.toHaveBeenCalled()
})

it('checks unchanged restored bytes without inventing a new source publication', async () => {
  const run = scenarioPublication()
  const inspection = inspectWorkspaceScenarioPublication({ ...run.options, captured: undefined })
  expect(run.nativeWait).not.toHaveBeenCalled()
  expect(run.completionWait).not.toHaveBeenCalled()
  expect(run.options.inspect).not.toHaveBeenCalled()
  run.stable.resolve(new Map())
  await expect(inspection).resolves.toMatchObject({ snapshot: expect.any(Map) })
  expect(run.options.inspect).toHaveBeenCalledOnce()
})
