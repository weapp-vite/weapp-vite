import type { Plugin } from 'vite'
import type { CompilerContext } from '../../context'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { CompilerHmrResyncError, compilerSourceId, getCompilerHmrHost } from '../../plugins/compilerPlugin/hmr'
import { createRuntimeState } from '../runtimeState'
import { buildStatefulHmrSnapshot } from './snapshotBuild'

const harness = vi.hoisted(() => ({
  context: undefined as unknown,
  build: vi.fn(async (_options: unknown) => ({ output: [] })),
}))

vi.mock('vite', async importOriginal => ({ ...await importOriginal<typeof import('vite')>(), build: harness.build }))
vi.mock('../../context/createCompilerContextInstance', () => ({ createCompilerContextInstance: () => harness.context }))
vi.mock('../sharedBuildConfig', () => ({ createSharedBuildConfig: () => ({ plugins: [], build: {} }) }))

let root: string

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'snapshot-input-'))
  fs.mkdirSync(path.join(root, 'src'))
})

afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true })
})

function createOwner() {
  return {
    runtimeState: createRuntimeState(),
    configService: { cwd: root, absoluteSrcRoot: path.join(root, 'src'), outDir: path.join(root, 'dist'), options: {} },
  } as CompilerContext
}

async function inputLoader(sources: ReadonlyMap<string, string | null>, owner: CompilerContext) {
  const runtimeState = createRuntimeState()
  harness.context = {
    runtimeState,
    currentBuildTarget: undefined,
    autoImportService: { runWithoutOutputWrites: (run: () => Promise<unknown>) => run() },
    configService: {
      ...owner.configService,
      options: {},
      load: async () => {},
      merge: (_defaults: unknown, base: unknown) => base,
      relativeAbsoluteSrcRoot: (file: string) => path.relative(owner.configService.absoluteSrcRoot, file),
      configFileDependencies: [],
    },
    scanService: { loadAppEntry: async () => {}, loadSubPackages: () => {}, independentSubPackageMap: new Map() },
    moduleGraphService: { resetSession: () => {} },
  }
  await buildStatefulHmrSnapshot({ cwd: root, isDev: true }, undefined, owner, sources)
  const options = harness.build.mock.calls.at(-1)![0] as { plugins: Plugin[] }
  const plugin = options.plugins.find(plugin => plugin.name === 'weapp-vite:snapshot-input')!
  const resolvedHook = plugin.configResolved
  const configResolved = typeof resolvedHook === 'function' ? resolvedHook : resolvedHook?.handler
  const assets = new Set(['logo.svg', 'logo.png', 'design.asset'].map(filename => path.join(root, 'src', filename)))
  await configResolved?.call({} as never, { assetsInclude: (id: string) => assets.has(id) } as never)
  const hook = plugin.load!
  const load = typeof hook === 'function' ? hook : hook.handler
  return (id: string) => load.call({} as never, id)
}

it.each([
  ['logo.svg', false],
  ['logo.png', false],
  ['logo.svg', true],
  ['design.asset', true],
] as const)('keeps imported %s in the resolved asset loader even when raw dependency ownership is %s', async (filename, dependency) => {
  const owner = createOwner()
  const asset = path.join(root, 'src', filename)
  const host = getCompilerHmrHost(owner)
  if (dependency) {
    fs.writeFileSync(asset, 'raw asset bytes')
    host.seed(asset, 'raw asset bytes')
  }
  else {
    host.captureNative(asset, `export default ${JSON.stringify(`/assets/${filename}`)}`)
  }
  const load = await inputLoader(host.freeze([]).sources, owner)
  expect(await load(asset)).toBeNull()
})

it.each([['utility.js', 'export const marker = "PINNED"'], ['utility.ts', ''], ['types.ts', 'export const marker: string = "PINNED"']] as const)('preserves frozen ordinary %s module input without raw ownership', async (filename, pinned) => {
  const owner = createOwner()
  const file = path.join(root, 'src', filename)
  const host = getCompilerHmrHost(owner)
  host.captureNative(file, pinned)
  const sources = host.freeze([]).sources
  host.captureNative(file, 'export const marker = "FUTURE"')
  const load = await inputLoader(sources, owner)
  expect(host.ownsRawSource(file)).toBe(false)
  expect(await load(file)).toEqual({ code: pinned })
})

it('keeps a compiler-declared raw input pinned to its fixed source map', async () => {
  const owner = createOwner()
  const file = path.join(root, 'src', 'tokens.css')
  const host = getCompilerHmrHost(owner)
  host.seed(file, '.probe { color: blue }')
  const input = host.freeze([])
  host.capture(file, '.probe { color: green }')
  const load = await inputLoader(input.sources, owner)
  expect(await load(file)).toEqual({ code: input.sources.get(compilerSourceId(file)) })
})

it.each(['raw', 'url'])('rejects drift in a known raw text input consumed by Vite ?%s', async (query) => {
  const owner = createOwner()
  const file = path.join(root, 'src', 'message.txt')
  fs.writeFileSync(file, 'FROZEN-TEXT')
  const host = getCompilerHmrHost(owner)
  host.seed(file, 'FROZEN-TEXT')
  const load = await inputLoader(host.freeze([]).sources, owner)
  fs.writeFileSync(file, 'FUTURE-TEXT')
  expect(() => load(`${file}?${query}`)).toThrow(CompilerHmrResyncError)
})

it.each(['raw', 'url'])('delegates unchanged known raw text ?%s to the Vite loader', async (query) => {
  const owner = createOwner()
  const file = path.join(root, 'src', 'message.txt')
  fs.writeFileSync(file, 'FROZEN-TEXT')
  const host = getCompilerHmrHost(owner)
  host.seed(file, 'FROZEN-TEXT')
  const load = await inputLoader(host.freeze([]).sources, owner)
  expect(await load(`${file}?${query}`)).toBeNull()
})

it('leaves other module and virtual queries to their existing loaders', async () => {
  const owner = createOwner()
  const file = path.join(root, 'src', 'message.txt')
  const host = getCompilerHmrHost(owner)
  host.seed(file, 'FROZEN-TEXT')
  const load = await inputLoader(host.freeze([]).sources, owner)
  for (const id of [`${file}?custom`, `${file}?rawish`, `${file}?urlish`, `\0${file}?raw`]) {
    expect(await load(id)).toBeNull()
  }
})
