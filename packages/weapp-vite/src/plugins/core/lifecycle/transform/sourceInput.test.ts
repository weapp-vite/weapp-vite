import type { HmrProfileProvenance } from '../../../../utils/hmrProfile/provenance'
import type { CorePluginState } from '../../helpers'
import { mkdir, mkdtemp, realpath, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { pathToFileURL } from 'node:url'
import path from 'pathe'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { beginClassicSourcePublication } from '../../../../runtime/buildPlugin/sourcePublication'
import { HmrSourcePublicationOwner } from '../../../../runtime/hmrRuntimeSession/sourcePublication'
import { compilerSourceId } from '../../../compilerPlugin/hmr'
import {
  captureCompilerNativeScriptInputs,
  compilerNativeScriptVersion,
  observeCompilerInputs,
  readCompilerInput,
} from '../../../utils/sourceSnapshot'
import { createTransformHook } from './index'
import { observeBundlerSourceInput } from './sourceInput'

const roots: string[] = []
const releases: Array<() => void> = []

afterEach(async () => {
  releases.splice(0).forEach(release => release())
  await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true })))
})

async function fixture() {
  const root = await realpath(await mkdtemp(path.join(tmpdir(), 'bundler-source-input-')))
  roots.push(root)
  const absoluteSrcRoot = path.join(root, 'src')
  const state = {
    ctx: {
      configService: {
        absoluteSrcRoot,
        isDev: true,
        packageJson: { dependencies: {} },
        weappViteConfig: {},
        relativeAbsoluteSrcRoot: (id: string) => path.relative(absoluteSrcRoot, id),
      },
      scanService: { appEntry: { path: path.join(absoluteSrcRoot, 'app.ts') } },
    },
    loadedEntrySet: new Set<string>(),
    resolvedEntryMap: new Map<string, { id: string }>(),
    entriesMap: new Map<string, { path: string, type: 'page' | 'component' }>(),
    subPackageMeta: undefined as { entries: string[] } | undefined,
  }
  const coreState = state as unknown as CorePluginState
  const observer = vi.fn<(id: string, source: string) => void>()
  const releaseObserver = observeCompilerInputs(state.ctx.configService, observer)
  releases.push(releaseObserver)
  async function source(relative: string, code: string) {
    const file = path.join(root, relative)
    await mkdir(path.dirname(file), { recursive: true })
    await writeFile(file, code)
    return file
  }
  return { root, state, coreState, observer, releaseObserver, source }
}

describe('bundler source input observation', () => {
  it('observes the delivered TypeScript before the no-transform-work return without rereading disk', async () => {
    const { coreState, observer, source } = await fixture()
    const file = await source('src/shared/store.ts', 'export const value = "disk"')
    const code = 'export const value: string = "delivered"'

    await expect(createTransformHook(coreState)(code, pathToFileURL(file).href)).resolves.toBeNull()

    expect(observer).toHaveBeenCalledExactlyOnceWith(compilerSourceId(file), code)
  })

  it('observes an imported module outside src before business transform filtering', async () => {
    const { coreState, observer, source } = await fixture()
    const code = 'export const sharedValue = "external"'
    const file = await source('shared/value.js', code)

    await expect(createTransformHook(coreState)(code, file)).resolves.toBeNull()

    expect(observer).toHaveBeenCalledExactlyOnceWith(compilerSourceId(file), code)
  })

  it('observes JSX source without rewriting the bundler input', async () => {
    const { coreState, observer, source } = await fixture()
    const code = 'export const render = () => <view />'
    const file = await source('src/shared/render.tsx', code)

    await expect(createTransformHook(coreState)(code, file)).resolves.toBeNull()

    expect(observer).toHaveBeenCalledExactlyOnceWith(compilerSourceId(file), code)
  })

  it.each(['app', 'loaded', 'resolved', 'page', 'component', 'subpackage'] as const)(
    'keeps the raw reader as the only input owner for a %s entry',
    async (kind) => {
      const { state, coreState, observer, source } = await fixture()
      const raw = 'Component({ data: { value: "raw" } })'
      const relative = kind === 'app' ? 'app' : `components/${kind}`
      const file = await source(`src/${relative}.ts`, raw)
      if (kind === 'app' || kind === 'resolved') {
        state.resolvedEntryMap.set(compilerSourceId(file), { id: file })
      }
      else {
        state.loadedEntrySet.add(file)
      }
      if (kind === 'page' || kind === 'component') {
        state.entriesMap.set(relative, { path: file, type: kind })
      }
      else if (kind === 'subpackage') {
        state.subPackageMeta = { entries: [relative] }
      }
      await readCompilerInput(state.ctx.configService, file)

      observeBundlerSourceInput(coreState, `${raw}\nexport default "wrapper"`, file)

      expect(observer).toHaveBeenCalledExactlyOnceWith(compilerSourceId(file), raw)
    },
  )

  it.each(['page', 'component', 'subpackage', 'app-basename'] as const)(
    'does not infer raw input ownership from a %s declaration or basename',
    async (kind) => {
      const { state, coreState, observer, source } = await fixture()
      const relative = kind === 'app-basename' ? 'app' : 'components/card'
      const code = 'export const value = "ordinary-module"'
      const file = await source(`src/${relative}.ts`, code)
      const declared = await source(`src/${relative}.vue`, '<template><view /></template>')
      if (kind === 'page' || kind === 'component') {
        state.entriesMap.set(relative, { path: declared, type: kind })
      }
      else if (kind === 'subpackage') {
        state.subPackageMeta = { entries: [relative] }
      }

      observeBundlerSourceInput(coreState, code, file)

      expect(observer).toHaveBeenCalledExactlyOnceWith(compilerSourceId(file), code)
    },
  )

  it.each(['loaded', 'resolved'] as const)('preserves the raw %s entry owner through a directory alias', async (kind) => {
    const { root, state, coreState, observer, source } = await fixture()
    const raw = 'Component({ data: { value: "raw" } })'
    const file = await source('src/components/canonical/entry.ts', raw)
    const alias = path.join(root, 'linked-component')
    await symlink(path.dirname(file), alias, 'junction')
    const request = path.join(alias, 'entry.ts')
    const physical = compilerSourceId(file)
    if (kind === 'loaded') {
      state.loadedEntrySet.add(physical)
    }
    else {
      state.resolvedEntryMap.set(physical, { id: file })
    }
    await readCompilerInput(state.ctx.configService, request)

    observeBundlerSourceInput(coreState, `${raw}\nexport default "wrapper"`, request)

    expect(observer).toHaveBeenCalledExactlyOnceWith(physical, raw)
  })

  it.each(['virtual', 'query', 'hash', 'vue', 'asset'] as const)('ignores %s modules', async (kind) => {
    const { coreState, observer, source } = await fixture()
    const file = await source('src/shared/value.ts', 'export const value = 1')
    const id = {
      virtual: `\0${file}`,
      query: `${file}?raw`,
      hash: `${file}#script`,
      vue: path.join(path.dirname(file), 'component.vue'),
      asset: path.join(path.dirname(file), 'style.css'),
    }[kind]

    observeBundlerSourceInput(coreState, 'export const value = "generated"', id)

    expect(observer).not.toHaveBeenCalled()
  })

  it('isolates owners and preserves replacement observers when an old subscription is released twice', async () => {
    const first = await fixture()
    const second = await fixture()
    const file = await first.source('src/shared/value.ts', 'export const value = 1')
    observeBundlerSourceInput(second.coreState, 'second-owner', file)
    expect(first.observer).not.toHaveBeenCalled()
    expect(second.observer).toHaveBeenCalledExactlyOnceWith(compilerSourceId(file), 'second-owner')
    first.releaseObserver()
    observeBundlerSourceInput(first.coreState, 'after-release', file)
    expect(first.observer).not.toHaveBeenCalled()
    const replacement = vi.fn()
    releases.push(observeCompilerInputs(first.state.ctx.configService, replacement))
    first.releaseObserver()

    observeBundlerSourceInput(first.coreState, 'replacement-owner', file)

    expect(replacement).toHaveBeenCalledExactlyOnceWith(compilerSourceId(file), 'replacement-owner')
    expect(first.observer).not.toHaveBeenCalled()
    expect(second.observer).toHaveBeenCalledTimes(1)
  })

  it('does not expand native entry classification when ordinary modules are observed', async () => {
    const { state, coreState, observer, source } = await fixture()
    const file = await source('src/shared/value.ts', 'export const value = 1')
    const raw = 'Page({})'
    const entry = await source('src/pages/home.ts', raw)
    const result = await captureCompilerNativeScriptInputs(state.ctx.configService, async () => {
      observeBundlerSourceInput(coreState, 'export const value = 2', file)
      await readCompilerInput(state.ctx.configService, entry)
    })

    expect(observer).toHaveBeenCalledWith(compilerSourceId(file), 'export const value = 2')
    expect([...result.versions]).toEqual([[compilerSourceId(entry), compilerNativeScriptVersion(raw)]])
  })

  it.each(['matching', 'changed'] as const)('publishes only a %s actually consumed source version', async (kind) => {
    const { root, state, coreState, source } = await fixture()
    const saved = 'export const value = "saved"'
    const file = await source('src/shared/value.ts', saved)
    const outputRoot = path.join(root, 'dist')
    const owner = new HmrSourcePublicationOwner()
    const token = owner.observe({
      root: outputRoot,
      file: compilerSourceId(file),
      version: compilerNativeScriptVersion(saved),
      event: 'update',
      eventId: 'saved-source',
      receivedAtMs: 1,
    })!
    const profile: HmrProfileProvenance = { sourceEvents: [token.event] }
    const outputGenerations = new Map<string, object>()
    const publication = beginClassicSourcePublication({
      inputOwner: state.ctx.configService,
      sourceOwner: owner,
      outputRoot,
      outputGenerations,
      profile: () => profile,
      buildId: 'build',
      batchId: () => 'batch',
    })
    try {
      await publication.run(async () => {
        observeBundlerSourceInput(coreState, kind === 'matching' ? saved : 'export const value = "transformed"', file)
        outputGenerations.set(outputRoot, {})
      })
      expect(owner.capture(outputRoot)).toEqual([token])
      expect(publication.canComplete).toBe(kind === 'matching')

      publication.finish(true)

      expect(profile.sourceEvents).toEqual(kind === 'matching' ? [token.event] : [])
      expect(owner.capture(outputRoot)).toEqual(kind === 'matching' ? [] : [token])
    }
    finally {
      publication.finish(false)
      owner.close()
    }
  })
})
