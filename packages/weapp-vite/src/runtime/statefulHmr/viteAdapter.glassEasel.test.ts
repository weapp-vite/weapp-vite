import type { ResolvedConfig, ViteDevServer } from 'vite'
import type { CompilerContext } from '../../context'
import type { StatefulHmrOutputSource } from './outputPublication'
import type { StatefulHmrOutputFile } from './outputWriter'
import { describe, expect, it } from 'vitest'
import { analyzeGlassEaselBundle, createGlassEaselAnalyzeResult } from '../../analyze/glassEasel'
import { refreshGlassEaselNativeScripts } from '../../analyze/glassEasel/nativeScripts'
import { createCompilerContextInstance } from '../../context/createCompilerContextInstance'
import { StatefulHmrViteAdapter } from './viteAdapter'

interface CurrentModule {
  code: string | null
}

function createFixture() {
  const modules = new Map<string, CurrentModule>()
  const engine = {
    ensureCurrentBuildFinish: async () => {},
    getBundleState: async () => ({ lastBuildErrored: false }),
    moduleGraph: {
      getModuleIds: () => [...modules.keys()],
      getModuleInfo: (id: string) => modules.get(id) ?? null,
    },
  }
  const bundledDev = {
    _devEngine: engine,
    getRolldownOptions: async () => ({}),
    listen: async () => {},
    storeOutputFiles: (_output: StatefulHmrOutputFile[], _source?: StatefulHmrOutputSource) => {},
  }
  // Only the Vite hooks used by this adapter are needed for the in-memory module graph.
  const config = { build: { rolldownOptions: {} }, root: '/project' } as unknown as ResolvedConfig
  const server = { environments: { client: { bundledDev } } } as unknown as ViteDevServer
  const adapter = new StatefulHmrViteAdapter(config, server, {
    onError: () => {},
    onOutput: () => {},
    onPatch: () => true,
    waitForInitialBundle: async () => {},
  })
  adapter.install()
  const ctx: CompilerContext = createCompilerContextInstance()
  ctx.runtimeState.glassEasel.silent = true
  analyzeGlassEaselBundle(ctx, {
    'app.json': {
      type: 'asset',
      fileName: 'app.json',
      source: '{"glassEaselWebview":true,"componentFramework":"glass-easel"}',
      names: [],
      originalFileNames: [],
    },
  }, { mode: 'full', outputScope: 'main' })
  return {
    adapter,
    bundledDev,
    engine,
    modules,
    diagnostics: () => createGlassEaselAnalyzeResult(ctx).diagnostics,
    refresh: async (ids: string[], patch = '') => {
      refreshGlassEaselNativeScripts(ctx, await adapter.collectGlassEaselScriptUpdates(patch, ids))
    },
  }
}

function chunk(fileName: string, moduleIds: string[]): StatefulHmrOutputFile {
  return {
    type: 'chunk',
    fileName,
    code: '',
    modules: Object.fromEntries(moduleIds.map(id => [id, {}])),
  }
}

function invalidSelector(name: string) {
  return `wx.createSelectorQuery().select("#1-${name}").exec()`
}

describe('stateful HMR GlassEasel module facts', () => {
  it('retains unchanged modules and chunks while discovering new payload modules beyond changedIds', async () => {
    const { bundledDev, diagnostics, modules, refresh } = createFixture()
    const first = '/project/src/first.ts'
    const sibling = '/project/src/sibling.ts'
    const other = '/project/src/other.ts'
    const introduced = '/project/src/new.ts'
    for (const id of [first, sibling, other]) {
      modules.set(id, { code: invalidSelector(id) })
    }
    bundledDev.storeOutputFiles([chunk('pages/first.js', [first, sibling])], 'full')
    bundledDev.storeOutputFiles([chunk('pages/other.js', [other])], 'additional')
    await refresh([first, other])
    modules.set(first, { code: 'export const fixed = true' })
    modules.set(introduced, { code: invalidSelector('introduced') })
    await refresh(['src/first.ts'], '__rolldown_runtime__.registerFactory("src/new.ts", () => {});')
    expect(diagnostics()).toEqual([
      expect.objectContaining({ file: introduced, message: expect.stringContaining('introduced') }),
      expect.objectContaining({ file: 'pages/first.js', message: expect.stringContaining(sibling) }),
      expect.objectContaining({ file: 'pages/other.js', message: expect.stringContaining(other) }),
    ])
  })

  it('retains last complete findings when module code is unavailable and clears a removed module', async () => {
    const { bundledDev, diagnostics, modules, refresh } = createFixture()
    const changed = '/project/src/changed.ts'
    const unavailable = '/project/src/unavailable.ts'
    modules.set(changed, { code: invalidSelector('changed') })
    modules.set(unavailable, { code: invalidSelector('unavailable') })
    bundledDev.storeOutputFiles([chunk('pages/index.js', [changed, unavailable])], 'full')
    await refresh([changed])
    const before = diagnostics()
    modules.set(changed, { code: 'export const fixed = true' })
    modules.set(unavailable, { code: null })
    await refresh([changed])
    expect(diagnostics()).toEqual(before)
    modules.delete(unavailable)
    await refresh([changed])
    expect(diagnostics()).toEqual([])
  })

  it('uses new full-output identities without losing additional chunks or unmapped sources', async () => {
    const { bundledDev, diagnostics, modules, refresh } = createFixture()
    const removed = '/project/src/removed.ts'
    const additional = '/project/src/additional.ts'
    const added = '/project/src/added.ts'
    for (const id of [removed, additional, added]) {
      modules.set(id, { code: invalidSelector(id) })
    }
    bundledDev.storeOutputFiles([chunk('pages/old.js', [removed])], 'full')
    bundledDev.storeOutputFiles([chunk('lazy/additional.js', [additional])], 'additional')
    bundledDev.storeOutputFiles([chunk('pages/new.js', [added])], 'full')
    await refresh([removed, additional, added])
    expect(diagnostics().map(item => item.file)).toEqual([removed, 'lazy/additional.js', 'pages/new.js'])
  })

  it('retires a previously unmapped source when it leaves the current module graph', async () => {
    const { diagnostics, modules, refresh } = createFixture()
    const source = '/project/src/new.ts'
    modules.set(source, { code: invalidSelector('new') })
    await refresh(['src/new.ts'])
    expect(diagnostics()).toEqual([expect.objectContaining({ file: source, code: 'GE005' })])
    modules.delete(source)
    await refresh([])
    expect(diagnostics()).toEqual([])
  })

  it('does not retract the last successful findings from an errored native graph', async () => {
    const { bundledDev, diagnostics, engine, modules, refresh } = createFixture()
    const source = '/project/src/index.ts'
    modules.set(source, { code: invalidSelector('index') })
    bundledDev.storeOutputFiles([chunk('pages/index.js', [source])], 'full')
    await refresh([source])
    const before = diagnostics()
    expect(before).toEqual([expect.objectContaining({ file: 'pages/index.js', code: 'GE005' })])
    modules.clear()
    engine.getBundleState = async () => ({ lastBuildErrored: true })
    await refresh([source])
    expect(diagnostics()).toEqual(before)
  })
})
