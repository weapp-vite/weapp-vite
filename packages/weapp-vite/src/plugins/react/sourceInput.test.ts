import type { CompilerContext } from '../../context'
import type { HmrProfileProvenance } from '../../utils/hmrProfile/provenance'
import type { CorePluginState } from '../core/helpers'
import { mkdtemp, realpath, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'pathe'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { beginClassicSourcePublication } from '../../runtime/buildPlugin/sourcePublication'
import { HmrSourcePublicationOwner } from '../../runtime/hmrRuntimeSession/sourcePublication'
import { compilerSourceId } from '../compilerPlugin/hmr'
import { createTransformHook } from '../core/lifecycle/transform'
import { compilerNativeScriptVersion, observeCompilerInputs, readCompilerInput } from '../utils/sourceSnapshot'
import { createReactPlugin } from './index'

const roots: string[] = []

afterEach(async () => {
  await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true })))
})

async function createFixture(renderMode: 'auto' | 'dynamic' | 'static') {
  const root = await realpath(await mkdtemp(path.join(tmpdir(), 'react-source-input-')))
  roots.push(root)
  const file = path.join(root, 'view.tsx')
  const loadedEntrySet = new Set<string>()
  const resolvedEntryMap = new Map<string, { id: string }>()
  const ctx = {
    configService: {
      absoluteSrcRoot: root,
      isDev: true,
      packageJson: { dependencies: {} },
      weappViteConfig: { react: { renderMode } },
      relativeAbsoluteSrcRoot: (id: string) => path.relative(root, id),
      relativeOutputPath: (id: string) => path.relative(root, id),
    },
    runtimeState: { build: { hmr: { loadedEntrySet, resolvedEntryMap } } },
    scanService: { appEntry: { path: path.join(root, 'app.ts') } },
  } as unknown as CompilerContext
  const state = { ctx, loadedEntrySet, resolvedEntryMap } as unknown as CorePluginState
  const react = createReactPlugin(ctx)[0]!
  const core = createTransformHook(state)
  const pluginContext = { warn: vi.fn() }
  return {
    root,
    file,
    ctx,
    loadedEntrySet,
    async transform(source: string) {
      const result = await (react.transform as any).call(pluginContext, source, file) as { code: string }
      expect(result.code).not.toBe(source)
      await core(result.code, file)
      return result
    },
  }
}

describe('React source input ownership', () => {
  it.each(['static', 'dynamic', 'auto'] as const)('proves each saved and restored raw TSX through the %s React and core transform chain', async (mode) => {
    const fixture = await createFixture(mode)
    const owner = new HmrSourcePublicationOwner()
    const outputRoot = path.join(fixture.root, 'dist')
    const generations = new Map<string, object>()
    const baseline = mode === 'auto'
      ? 'export function View({ items }) { return <view>{items.map(item => <text>{item}</text>)}</view> }'
      : 'export function View() { return <view>baseline</view> }'
    const updated = baseline.replace('<view>', '<view data-hmr-marker="saved">')
    try {
      for (const [index, source] of [baseline, updated, baseline].entries()) {
        await writeFile(fixture.file, source)
        const token = owner.observe({ root: outputRoot, file: compilerSourceId(fixture.file), version: compilerNativeScriptVersion(source), event: 'update', eventId: `save-${index}`, receivedAtMs: index })!
        const profile: HmrProfileProvenance = { sourceEvents: [token.event] }
        const publication = beginClassicSourcePublication({ inputOwner: fixture.ctx.configService, sourceOwner: owner, outputRoot, outputGenerations: generations, profile: () => profile, buildId: `build-${index}`, batchId: () => `batch-${index}` })
        try {
          await publication.run(async () => {
            await fixture.transform(source)
            expect(profile.sourceEvents).toEqual([token.event])
            generations.set(outputRoot, {})
          })
          publication.finish(true)
          expect(profile.sourceEvents).toEqual([token.event])
          expect(owner.capture(outputRoot)).toEqual([])
        }
        finally {
          publication.finish(false)
        }
      }
    }
    finally {
      owner.close()
    }
  })

  it('keeps the raw entry reader as owner when its loader injects code before React transforms', async () => {
    const fixture = await createFixture('static')
    const source = 'export function View() { return <view>entry</view> }'
    await writeFile(fixture.file, source)
    fixture.loadedEntrySet.add(fixture.file)
    const observer = vi.fn()
    const release = observeCompilerInputs(fixture.ctx.configService, observer)
    try {
      await readCompilerInput(fixture.ctx.configService, fixture.file)
      await fixture.transform(`import './entry.wxss';\n${source}`)
      expect(observer).toHaveBeenCalledExactlyOnceWith(compilerSourceId(fixture.file), source)
    }
    finally {
      release()
    }
  })
})
