import type { CompilerContext } from '../../context'
import { readFileSync } from 'node:fs'
import { mkdir, mkdtemp, realpath, rm, symlink, unlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, expect, it, vi } from 'vitest'
import { compilerSourceId, getCompilerHmrHost, getCompilerRawSnapshot } from '../../plugins/compilerPlugin/hmr'
import { readCompilerInput } from '../../plugins/utils/sourceSnapshot'
import { createRuntimeState } from '../runtimeState'
import { createStatefulHmrHostPlugins } from './hostPlugins'

const roots: string[] = []

vi.mock('node:fs', async (importOriginal) => {
  const original = await importOriginal<typeof import('node:fs')>()
  return { ...original, readFileSync: vi.fn(original.readFileSync) }
})

afterEach(async () => {
  vi.mocked(readFileSync).mockClear()
  await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true })))
})

async function fixture(ownership: 'native-style' | 'captured-style' | 'compiler-dependency' = 'native-style') {
  const root = await realpath(await mkdtemp(path.join(tmpdir(), 'stateful-input-capture-')))
  roots.push(root)
  const srcRoot = path.join(root, 'src')
  const file = path.join(srcRoot, ownership === 'compiler-dependency' ? 'tokens.css' : 'app.wxss')
  await mkdir(srcRoot)
  const previous = '.probe { color: red; }'
  await writeFile(file, previous)
  const ctx = {
    runtimeState: createRuntimeState(),
    configService: { cwd: root, absoluteSrcRoot: srcRoot, outDir: path.join(root, 'dist') },
  } as CompilerContext
  const host = getCompilerHmrHost(ctx)
  host.onDependencyChange = vi.fn()
  if (ownership !== 'compiler-dependency') {
    await readCompilerInput(ctx.configService, file)
  }
  else {
    host.seed(file, previous)
  }
  host.setNativeSources(ownership === 'native-style' ? [file] : [])
  const controller = createStatefulHmrHostPlugins(ctx)
  const inputPlugin = controller.plugins.find(plugin => plugin.name === 'weapp-vite:hmr-input')!
  const hook = inputPlugin.watchChange!
  const watchChange = typeof hook === 'function' ? hook : hook.handler
  return { root, file, host, hook, previous, plugin: inputPlugin, watch: (id: string, event: 'create' | 'update' | 'delete') => watchChange.call({} as never, id, { event }) }
}

it.each(['native-style', 'captured-style', 'compiler-dependency'] as const)('captures registered %s bytes before the source-change consumer can freeze them', async (ownership) => {
  const { file, host, watch } = await fixture(ownership)
  const changed = '.probe { color: blue; }'
  await writeFile(file, changed)

  // pre hook 先完成，本轮通知随后才允许消费者封存；后续 load 不参与本次准入。
  await watch(file, 'update')
  const captured = host.freeze([])
  await writeFile(file, '.probe { color: green; }')

  expect(captured.sources.get(compilerSourceId(file))).toBe(changed)
  expect(host.readSource(file)).toBe(changed)
  expect(host.hasVisualChanges([file], captured)).toBe(true)
})

it('runs before default watch consumers and preserves registered tombstones through file recreation', async () => {
  const { file, host, hook, watch } = await fixture()
  expect(hook).toMatchObject({ order: 'pre' })
  await rm(file)
  await watch(file, 'delete')
  expect(host.readSource(file)).toBeNull()
  await writeFile(file, 'recreated source')
  await watch(file, 'create')
  expect(host.readSource(file)).toBe('recreated source')
})

it('keeps unknown valid deletions but leaves unknown create and update to the original watch owner', async () => {
  const { root, host, watch } = await fixture()
  const unknown = path.join(root, 'src/unknown.css')
  const capture = vi.spyOn(host, 'capture')
  vi.mocked(readFileSync).mockClear()
  await watch(unknown, 'create')
  await watch(unknown, 'update')
  expect(readFileSync).not.toHaveBeenCalled()
  expect(capture).not.toHaveBeenCalled()
  await watch(unknown, 'delete')
  expect(capture).toHaveBeenCalledExactlyOnceWith(unknown, null)
})

it('ignores virtual, queried and generated output ids for every watch event', async () => {
  const { root, file, host, watch } = await fixture()
  const output = path.join(root, 'dist/app.wxss')
  host.seed(output, 'generated')
  const capture = vi.spyOn(host, 'capture')
  vi.mocked(readFileSync).mockClear()
  for (const id of ['\0virtual-source', `${file}?style`, output]) {
    for (const event of ['create', 'update', 'delete'] as const) {
      await watch(id, event)
    }
  }
  expect(readFileSync).not.toHaveBeenCalled()
  expect(capture).not.toHaveBeenCalled()
  expect(host.readSource(output)).toBe('generated')
})

it.each(['ENOENT', 'ENOTDIR'] as const)('captures a vanished registered source as a tombstone after %s', async (code) => {
  const { file, host, watch } = await fixture()
  if (code === 'ENOENT') {
    await rm(file)
  }
  else {
    await rm(path.dirname(file), { recursive: true })
    await writeFile(path.dirname(file), 'parent became a file')
  }
  await watch(file, 'update')
  expect(host.readSource(file)).toBeNull()
})

it.each(['native', 'windows-EPERM'] as const)('leaves a deleted directory recreation to the topology owner after %s read failure', async (platform) => {
  const { file: directory, host, watch } = await fixture()
  await rm(directory)
  await watch(directory, 'delete')
  await mkdir(directory)
  if (platform === 'windows-EPERM') {
    vi.mocked(readFileSync).mockImplementationOnce(() => {
      throw Object.assign(new Error('cannot read directory'), { code: 'EPERM' })
    })
  }
  await watch(directory, 'create')
  expect(host.readSource(directory)).toBeNull()
})

it('keeps raw-owner input when a later module transform produces different loaded code', async () => {
  const { file, host, plugin, previous } = await fixture('captured-style')
  const hook = plugin.transform!
  const transform = typeof hook === 'function' ? hook : hook.handler
  await transform.call({} as never, 'export default "transformed style module"', file)
  expect(host.readSource(file)).toBe(previous)
  expect(host.ownsRawSource(file)).toBe(true)
  expect(host.isNativeSource(file)).toBe(false)
})

it('preserves the raw read error and old ledger for an inaccessible regular source', async () => {
  const { file, host, previous, watch } = await fixture()
  const failure = Object.assign(new Error('source permission denied'), { code: 'EPERM' })
  vi.mocked(readFileSync).mockImplementationOnce(() => {
    throw failure
  })
  expect(() => watch(file, 'update')).toThrow(failure)
  expect(host.readSource(file)).toBe(previous)
})

it.each([
  ['logo.svg', '<svg><path d="M0 0" /></svg>'],
  ['logo.png', new Uint8Array([137, 80, 78, 71, 0, 255])],
] as const)('leaves imported %s loader output with its module owner instead of replacing it with raw asset bytes', async (filename, bytes) => {
  const { root, host, plugin, watch } = await fixture()
  const asset = path.join(root, 'src', filename)
  const loaderOutput = `export default ${JSON.stringify(`/assets/${filename}`)}`
  await writeFile(asset, bytes)
  const transformHook = plugin.transform!
  const transform = typeof transformHook === 'function' ? transformHook : transformHook.handler
  await transform.call({} as never, loaderOutput, asset)
  expect(host.readSource(asset)).toBe(loaderOutput)
  vi.mocked(readFileSync).mockClear()
  await watch(asset, 'update')
  expect(readFileSync).not.toHaveBeenCalled()
  expect(host.readSource(asset)).toBe(loaderOutput)
})

it('keeps a generated script loader result when its file is also a generic compiler dependency', async () => {
  const { root, host, plugin, watch } = await fixture()
  const file = path.join(root, 'src/custom.js')
  const raw = 'export const marker = "raw dependency"'
  const loaded = 'export const marker = "generated loader result"'
  await writeFile(file, raw)
  host.seed(file, raw)
  const hook = plugin.transform!
  const transform = typeof hook === 'function' ? hook : hook.handler
  await transform.call({} as never, loaded, file)
  expect(host.readSource(file)).toBe(loaded)
  expect(host.isNativeSource(file)).toBe(true)
  vi.mocked(readFileSync).mockClear()
  await watch(file, 'update')
  expect(readFileSync).not.toHaveBeenCalled()
  expect(host.freeze([]).sources.get(compilerSourceId(file))).toBe(loaded)
})

it('retains asset loader provenance after native entry classification is rebuilt', async () => {
  const { root, host, plugin, watch } = await fixture()
  const file = path.join(root, 'src/logo.svg')
  const raw = '<svg><path d="M0 0" /></svg>'
  const loaded = 'export default "/assets/logo.svg"'
  await writeFile(file, raw)
  host.seed(file, raw)
  const hook = plugin.transform!
  const transform = typeof hook === 'function' ? hook : hook.handler
  await transform.call({} as never, loaded, file)
  host.setNativeSources([])
  expect(host.isNativeSource(file)).toBe(false)
  expect(host.ownsRawSource(file)).toBe(false)
  vi.mocked(readFileSync).mockClear()
  await watch(file, 'update')
  expect(readFileSync).not.toHaveBeenCalled()
  expect(host.freeze([]).sources.get(compilerSourceId(file))).toBe(loaded)
})

it('updates a known raw alias tombstone after its canonical target changes and later recovers it', async () => {
  const { root, host, watch } = await fixture()
  const physical = path.join(root, 'physical')
  const replacement = path.join(root, 'replacement')
  await mkdir(physical)
  await mkdir(replacement)
  const file = path.join(physical, 'logo.svg')
  await writeFile(file, 'old physical asset')
  const alias = path.join(root, 'alias')
  await symlink(physical, alias, 'junction')
  const aliasFile = path.join(alias, 'logo.svg')
  host.captureRaw(aliasFile, 'old physical asset', false)
  await unlink(alias)
  await symlink(replacement, alias, 'junction')
  await watch(aliasFile, 'delete')
  const input = host.freeze([])
  const target = compilerSourceId(aliasFile)
  expect(input.sources.get(target)).toBeNull()
  expect(input.sources.get(compilerSourceId(file))).toBe('old physical asset')
  expect(getCompilerRawSnapshot(input.sources)?.bindings.get(aliasFile)?.target).toBe(target)
  await writeFile(path.join(replacement, 'logo.svg'), 'recovered asset')
  await watch(aliasFile, 'create')
  expect(host.readSource(aliasFile)).toBe('recovered asset')
  expect(input.sources.get(target)).toBeNull()
})
