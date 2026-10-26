import type { ResolvedConfig } from 'vite'
import type { CompilerContext } from '../../../context'
import { mkdtemp, realpath, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'pathe'
import { afterEach, expect, it, vi } from 'vitest'
import { getInitialBuildInputObservation, startInitialBuildInputObservation } from '../../../runtime/buildPlugin/initialBuildChanges'
import { compilerSourceId } from '../../compilerPlugin/hmr'
import { withCompilerSourceSnapshot } from '../../utils/sourceSnapshot'
import { assertStylePreprocessing, beginStylePreprocessing, getPreparedSharedStyle, getPreparedStyleSource, isPreparedStyleMissing, prepareStylePreprocessing } from './index'

const preprocess = vi.hoisted(() => vi.fn())
vi.mock('vite', () => ({ preprocessCSS: preprocess }))

const cleanup: Array<() => void | Promise<void>> = []
afterEach(async () => {
  preprocess.mockReset()
  for (const close of cleanup.splice(0).reverse()) {
    await close()
  }
})

async function fixture() {
  const root = await realpath(await mkdtemp(path.join(os.tmpdir(), 'weapp-style-input-')))
  cleanup.push(async () => await rm(root, { recursive: true, force: true }))
  const file = path.join(root, 'shared.scss')
  const source = '$brand: red; .page { color: $brand; }'
  await writeFile(file, source)
  const ctx = {
    configService: { cwd: root },
    runtimeState: { css: { transformedSidecarSource: new Map() } },
  } as unknown as CompilerContext
  const hook = { environment: {} }
  const config = {} as ResolvedConfig
  preprocess.mockImplementation(async (code: string) => ({ code, deps: [] }))
  return { ctx, hook, config, file, source }
}

it.each(['entry', 'dependency'] as const)('deduplicates delayed startup notifications only for the shared style input actually prepared: %s', async (input) => {
  const { ctx, hook, config, file, source } = await fixture()
  const dependency = path.join(path.dirname(file), 'theme.scss')
  await writeFile(dependency, '.theme { color: red; }')
  cleanup.push(startInitialBuildInputObservation(ctx.configService))
  const observation = getInitialBuildInputObservation(ctx.configService)!
  preprocess.mockImplementation(async (code: string) => ({ code, deps: new Set([dependency]) }))
  observation.begin()
  beginStylePreprocessing(ctx, hook)
  await prepareStylePreprocessing(ctx, hook, config, [file])
  assertStylePreprocessing(ctx, hook)
  expect(getPreparedSharedStyle(ctx, hook, file)?.source).toBe(source)
  observation.commit()
  const change = { file: input === 'entry' ? file : dependency, event: 'update', verifyInitialInput: true }
  // deps 只有路径，没有预处理器实际消费的字节，不能据此吞掉通知。
  expect(await observation.filter([change])).toEqual(input === 'entry' ? [] : [change])
  const entryChange = { ...change, file }
  await writeFile(file, source.replace('red', 'blue'))
  expect(await observation.filter([entryChange])).toEqual([entryChange])
  await writeFile(file, source)
  expect(await observation.filter([entryChange])).toEqual([entryChange])
})

it('prepares the pinned shared input rather than a newer disk version', async () => {
  const { ctx, hook, config, file, source } = await fixture()
  const pinned = source.replace('red', 'blue')
  await withCompilerSourceSnapshot(ctx.configService, new Map([[compilerSourceId(file), pinned]]), async () => {
    beginStylePreprocessing(ctx, hook)
    await prepareStylePreprocessing(ctx, hook, config, [file])
    assertStylePreprocessing(ctx, hook)
  })
  expect(preprocess).toHaveBeenCalledExactlyOnceWith(pinned, file, config)
  expect(getPreparedSharedStyle(ctx, hook, file)?.source).toBe(pinned)
})

it.each(['deleted', 'restored'] as const)('keeps a snapshot-deleted optional style absent when its disk entry is %s', async (disk) => {
  const { ctx, hook, config, file } = await fixture()
  const id = compilerSourceId(file)
  if (disk === 'deleted') {
    await rm(file)
  }
  await withCompilerSourceSnapshot(ctx.configService, new Map([[id, null]]), async () => {
    beginStylePreprocessing(ctx, hook)
    await prepareStylePreprocessing(ctx, hook, config, [file])
    assertStylePreprocessing(ctx, hook)
  })
  expect(isPreparedStyleMissing(ctx, hook, file)).toBe(true)
  expect(() => getPreparedStyleSource(ctx, hook, file)).toThrow('没有本轮图阶段的预处理结果')
  expect(preprocess).not.toHaveBeenCalled()
})
