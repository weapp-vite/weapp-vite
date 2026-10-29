import type { CompilerContext } from '../../context'
import type { FileWatchChange } from './fileWatcher'
import { setImmediate as nextTurn } from 'node:timers/promises'
import path from 'pathe'
import { beforeEach, expect, it, vi } from 'vitest'
import { watchAssetSources } from './assets'

const state = vi.hoisted(() => ({
  onChange: undefined as ((changes: FileWatchChange[]) => void) | undefined,
  scan: vi.fn<() => Promise<string[]>>(),
  close: vi.fn<() => Promise<void>>(),
}))

vi.mock('./fileWatcher', () => ({
  createFileWatcher: () => ({
    ready: Promise.resolve('ready'),
    onChange(listener: (changes: FileWatchChange[]) => void) {
      state.onChange = listener
      return () => {}
    },
    onError: () => () => {},
    close: state.close,
  }),
}))

vi.mock('../../plugins/asset/sources', () => ({
  createAssetSourcePlan: (config: CompilerContext['configService']) => ({
    roots: [config.absoluteSrcRoot],
    matchesPath: () => true,
    ignoresDirectory: () => false,
    scan: state.scan,
  }),
}))

beforeEach(() => {
  state.scan.mockReset().mockResolvedValue([])
  state.close.mockReset().mockResolvedValue()
})

it.each(['complete', 'fail'] as const)('drains a pending asset scan when backend close fails and the scan will %s', async (outcome) => {
  const root = path.resolve('asset-lifecycle-fixture')
  const src = path.join(root, 'src')
  const file = path.join(src, 'image.png')
  const closeFailure = new Error('backend unsubscribe failed')
  const scanFailure = new Error('asset scan failed')
  const scanStarted = Promise.withResolvers<void>()
  const scan = Promise.withResolvers<string[]>()
  const closeStarted = Promise.withResolvers<void>()
  const onChange = vi.fn()
  const onError = vi.fn()
  const watcher = watchAssetSources({
    cwd: root,
    absoluteSrcRoot: src,
    outDir: path.join(root, 'dist'),
    inlineConfig: {},
  } as CompilerContext['configService'], { onChange, onError })
  await watcher.ready
  state.scan.mockImplementationOnce(() => {
    scanStarted.resolve()
    return scan.promise
  })
  state.onChange!([{ event: 'update', file, kind: 'file' }])
  await scanStarted.promise
  state.close.mockImplementationOnce(async () => {
    closeStarted.resolve()
    throw closeFailure
  })
  const closing = watcher.close()
  let settled = false
  const result = closing.catch((error: unknown) => {
    settled = true
    return error
  })
  await closeStarted.promise
  await nextTurn()
  expect(settled).toBe(false)
  expect(watcher.close()).toBe(closing)
  if (outcome === 'fail') {
    scan.reject(scanFailure)
  }
  else {
    scan.resolve([file])
  }
  const failure = await result
  if (outcome === 'fail') {
    expect(failure).toBeInstanceOf(AggregateError)
    expect((failure as AggregateError).errors).toEqual(expect.arrayContaining([closeFailure, scanFailure]))
    expect((failure as AggregateError).errors).toHaveLength(2)
  }
  else {
    expect(failure).toBe(closeFailure)
  }
  expect(onChange).not.toHaveBeenCalled()
  expect(onError).not.toHaveBeenCalled()
  expect(state.close).toHaveBeenCalledOnce()
})
