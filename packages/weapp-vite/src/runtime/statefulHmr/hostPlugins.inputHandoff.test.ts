import type { CompilerContext } from '../../context'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { mkdir, mkdtemp, realpath, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'pathe'
import { afterEach, expect, it, vi } from 'vitest'
import { createSidecarSourceSpecifier } from '../../moduleGraph/protocol'
import { createModuleGraphService } from '../../moduleGraph/service'
import { compilerSourceId, getCompilerHmrHost } from '../../plugins/compilerPlugin/hmr'
import { readCompilerInput } from '../../plugins/utils/sourceSnapshot'
import { createRuntimeState } from '../runtimeState'
import { createStatefulHmrHostPlugins } from './hostPlugins'

const roots: string[] = []

vi.mock('node:fs', async (importOriginal) => {
  const original = await importOriginal<typeof import('node:fs')>()
  return { ...original, readFileSync: vi.fn(original.readFileSync) }
})

afterEach(async () => {
  vi.mocked(readFileSync).mockReset()
  await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true })))
})

async function fixture(ownership: 'raw' | 'module-only' | 'unknown' = 'raw') {
  const root = await realpath(await mkdtemp(path.join(tmpdir(), 'stateful-sidecar-handoff-')))
  roots.push(root)
  const srcRoot = path.join(root, 'src')
  const owner = path.join(srcRoot, 'app.vue')
  const file = path.join(srcRoot, 'next-sitemap.json')
  await mkdir(srcRoot)
  const before = JSON.stringify({ desc: 'relocated', rules: [] })
  const after = JSON.stringify({ desc: 'relocated-updated', rules: [] })
  await writeFile(file, before)
  const ctx = {
    runtimeState: createRuntimeState(),
    configService: { cwd: root, absoluteSrcRoot: srcRoot, outDir: path.join(root, 'dist') },
    moduleGraphService: createModuleGraphService(),
  } as CompilerContext
  const host = getCompilerHmrHost(ctx)
  host.onDependencyChange = vi.fn()
  // 入口读取资产后公开本轮依赖；原生侧车模块尚未首次加载。
  const metadataAsset = ownership === 'raw' ? await readCompilerInput(ctx.configService, file) : before
  const loaderOutput = 'export default "generated module"'
  if (ownership === 'module-only') {
    host.seed(file, before)
    host.captureNative(file, loaderOutput)
  }
  ctx.moduleGraphService.replaceEntryDependencies(owner, 'json', [file])
  const controller = createStatefulHmrHostPlugins(ctx)
  const plugin = controller.plugins.find(plugin => plugin.name === 'weapp-vite:stateful-hmr-sidecar')!
  const hook = plugin.load!
  const load = typeof hook === 'function' ? hook : hook.handler
  const addWatchFile = vi.fn()
  const id = createSidecarSourceSpecifier(owner, file, 'json')
  return { ctx, host, controller, file, owner, before, after, metadataAsset, loaderOutput, addWatchFile, load: () => load.call({ addWatchFile } as never, id) }
}

it('captures a newly published JSON dependency saved before its first native sidecar load', async () => {
  const { ctx, host, controller, file, owner, before, after, metadataAsset, addWatchFile, load } = await fixture()
  const resync = vi.fn()
  controller.bindSidecarInputDrift(resync)
  expect(ctx.moduleGraphService.getEntryDependencies(owner)).toContainEqual({ kind: 'json', sourceId: file })
  await writeFile(file, after)
  const token = await load()
  expect(token).toEqual({
    code: `export default ${JSON.stringify(createHash('sha256').update(after).digest('hex'))};\n`,
    moduleSideEffects: 'no-treeshake',
  })
  expect(addWatchFile).toHaveBeenCalledExactlyOnceWith(file)
  expect(metadataAsset).toBe(before)
  expect(host.freeze([]).sources.get(compilerSourceId(file))).toBe(after)
  expect(resync).toHaveBeenCalledExactlyOnceWith(file)
})

it.each(['update', 'delete'] as const)('does not request a second build after native %s captured the same existing bytes', async (event) => {
  const { host, controller, file, after, load } = await fixture()
  const resync = vi.fn()
  controller.bindSidecarInputDrift(resync)
  await writeFile(file, after)
  const input = controller.plugins.find(plugin => plugin.name === 'weapp-vite:hmr-input')!
  const hook = input.watchChange!
  const watch = typeof hook === 'function' ? hook : hook.handler
  await watch.call({} as never, file, { event })
  const native = host.isNativeSource(file)
  await load()
  await load()
  expect(host.readSource(file)).toBe(after)
  expect(host.isNativeSource(file)).toBe(native)
  expect(resync).not.toHaveBeenCalled()
})

it('captures raw provenance without promoting an asset to native module ownership', async () => {
  const { host, controller, file, after, load } = await fixture()
  host.setNativeSources([])
  controller.bindSidecarInputDrift(vi.fn())
  await writeFile(file, after)
  await load()
  expect(host.isNativeSource(file)).toBe(false)
  expect(host.ownsRawSource(file)).toBe(true)
})

it.each(['module-only', 'unknown'] as const)('preserves %s input ownership when loading a sidecar', async (ownership) => {
  const { host, controller, file, after, loaderOutput, load } = await fixture(ownership)
  const resync = vi.fn()
  controller.bindSidecarInputDrift(resync)
  await writeFile(file, after)
  await load()
  expect(host.readSource(file)).toBe(ownership === 'module-only' ? loaderOutput : undefined)
  expect(host.ownsRawSource(file)).toBe(false)
  expect(resync).not.toHaveBeenCalled()
})

it('keeps the retired input ledger unchanged after its session binding is released', async () => {
  const { host, controller, file, before, after, load } = await fixture()
  const resync = vi.fn()
  const release = controller.bindSidecarInputDrift(resync)
  release()
  release()
  await writeFile(file, after)
  await load()
  expect(host.readSource(file)).toBe(before)
  expect(resync).not.toHaveBeenCalled()
})

it('does not let an old release remove a replacement binding with the same callback', async () => {
  const { host, controller, file, after, load } = await fixture()
  const resync = vi.fn()
  const releaseOld = controller.bindSidecarInputDrift(resync)
  const releaseReplacement = controller.bindSidecarInputDrift(resync)
  releaseOld()
  await writeFile(file, after)
  await load()
  expect(host.readSource(file)).toBe(after)
  expect(resync).toHaveBeenCalledExactlyOnceWith(file)
  releaseReplacement()
})

it('captures a missing raw sidecar once and requests a rebuild after its recreation', async () => {
  const { host, controller, file, after, load } = await fixture()
  const resync = vi.fn()
  controller.bindSidecarInputDrift(resync)
  await rm(file)
  await expect(load()).resolves.toEqual({ code: 'export default undefined;\n', moduleSideEffects: 'no-treeshake' })
  await load()
  expect(host.readSource(file)).toBeNull()
  expect(resync).toHaveBeenCalledExactlyOnceWith(file)
  await writeFile(file, after)
  await load()
  expect(host.readSource(file)).toBe(after)
  expect(resync).toHaveBeenCalledTimes(2)
})

it('preserves a raw read failure and its previous input instead of requesting recovery from unknown bytes', async () => {
  const { host, controller, file, before, load } = await fixture()
  const resync = vi.fn()
  controller.bindSidecarInputDrift(resync)
  const failure = Object.assign(new Error('source read denied'), { code: 'EPERM' })
  vi.mocked(readFileSync).mockImplementationOnce(() => {
    throw failure
  })
  await expect(load()).rejects.toBe(failure)
  expect(host.readSource(file)).toBe(before)
  expect(resync).not.toHaveBeenCalled()
})
