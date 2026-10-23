import type { startDevProcess } from '../../e2e/utils/dev-process'
import type { createDevBuildCompletion } from '../../e2e/utils/devBuildCompletion'
import type { captureNativePublication } from '../../e2e/utils/nativePublication'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, expect, it, vi } from 'vitest'
import { captureWorkspaceClassicPublication } from './classicPublicationObservation'

const capture = vi.hoisted(() => ({
  native: vi.fn<typeof captureNativePublication>(),
  completion: vi.fn<typeof createDevBuildCompletion>(),
}))
vi.mock('../../e2e/utils/nativePublication', () => ({ captureNativePublication: capture.native }))
vi.mock('../../e2e/utils/devBuildCompletion', () => ({ createDevBuildCompletion: capture.completion }))

afterEach(() => vi.resetAllMocks())

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
