import type { OutputBundle } from 'rolldown'
import type { CompilerContext } from '../../context'
import type { HmrProfileDurationKey } from '../../utils/hmrProfile'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createTailwindGenerateResult } from '../../../test/helpers/tailwindCompiler'
import { createTailwindcssPlugin } from '../tailwindcss'
import { createManagedTailwindcssEntryMarker } from '../tailwindcssMarker'

const mocks = vi.hoisted(() => ({
  clock: 0,
  createCompiler: vi.fn(),
  resolveSource: vi.fn(),
}))

vi.mock('weapp-tailwindcss/core', () => ({ createCompiler: mocks.createCompiler }))
vi.mock('weapp-tailwindcss/generator', () => ({ resolveTailwindV4Source: mocks.resolveSource }))
vi.mock('../css/shared/preprocessor', () => ({ processCssWithCache: async (source: string) => source }))

type Profile = Partial<Record<HmrProfileDurationKey, number | undefined>>

function getHookHandler<T extends (...args: any[]) => any>(hook: T | { handler: T } | undefined) {
  return typeof hook === 'function' ? hook : hook?.handler
}

describe('Tailwind HMR profile', () => {
  let root: string

  beforeEach(async () => {
    root = await fs.mkdtemp(path.join(os.tmpdir(), 'weapp-vite-tailwind-profile-'))
    mocks.clock = 0
    mocks.createCompiler.mockReset()
    mocks.resolveSource.mockReset()
  })

  afterEach(async () => {
    vi.restoreAllMocks()
    await fs.rm(root, { recursive: true, force: true })
  })

  function createFixture(options: { isDev?: boolean, profile?: Profile, generator?: false, onCss?: () => void } = {}) {
    const entry = path.join(root, 'src/app.css')
    const snapshot = {
      classSet: new Set<string>(),
      dependencies: [entry],
      roots: [{ id: 'profile-root', revision: 1 }],
      sources: [],
      target: 'weapp' as const,
    }
    const compiler = {
      createSnapshot: vi.fn(() => snapshot),
      mergeSnapshots: vi.fn(() => {
        mocks.clock += 5
        return snapshot
      }),
      generate: vi.fn(async () => {
        mocks.clock += 7
        return createTailwindGenerateResult('.generated { color: red; }', snapshot)
      }),
      transformCss: vi.fn(async (source: string) => {
        mocks.clock += 11
        options.onCss?.()
        return { css: source }
      }),
      transformTemplate: vi.fn(async (source: string) => {
        mocks.clock += 13
        return source
      }),
      transformJavaScript: vi.fn(async (code: string) => {
        mocks.clock += 17
        return { code }
      }),
      dispose: vi.fn(async () => {}),
    }
    mocks.createCompiler.mockReturnValue(compiler)
    mocks.resolveSource.mockImplementation(async () => {
      mocks.clock += 3
      return { projectRoot: root, base: root, css: '', dependencies: [entry] }
    })
    const ctx = {
      configService: {
        absoluteSrcRoot: path.join(root, 'src'),
        cwd: root,
        isDev: options.isDev ?? true,
        outputExtensions: { wxml: 'wxml', wxss: 'wxss' },
        platform: 'weapp',
        weappViteConfig: {
          tailwindcss: {
            cssEntries: [entry],
            compiler: { maxRoots: 32 },
            generator: options.generator,
            onLoad() { mocks.clock += 2 },
          },
        },
      },
      runtimeState: { build: { hmr: { profile: options.profile } } },
      moduleGraphService: {
        replaceTransformDependencies: vi.fn(() => { mocks.clock += 19 }),
      },
    } as unknown as CompilerContext
    const output = createTailwindcssPlugin(ctx)[1]!
    const bundle = {
      'app.wxss': { type: 'asset', fileName: 'app.wxss', source: createManagedTailwindcssEntryMarker(0) },
      'first.wxml': { type: 'asset', fileName: 'first.wxml', source: '<view />' },
      'first.js': { type: 'chunk', fileName: 'first.js', code: 'Page({})', map: null },
      'second.wxml': { type: 'asset', fileName: 'second.wxml', source: '<view />' },
      'second.js': { type: 'chunk', fileName: 'second.js', code: 'Page({})', map: null },
    } as unknown as OutputBundle
    return {
      ctx,
      compiler,
      run: () => getHookHandler(output.generateBundle)!.call({ addWatchFile: vi.fn() } as any, {} as any, bundle, false),
    }
  }

  it('records consecutive phases and nested generation timings on the original event', async () => {
    const profile: Profile = {}
    const replacement: Profile = {}
    const fixture = createFixture({
      profile,
      onCss() { fixture.ctx.runtimeState.build.hmr.profile = replacement },
    })
    vi.spyOn(performance, 'now').mockImplementation(() => mocks.clock)

    await fixture.run()

    expect(profile).toEqual({
      tailwindPrepareMs: 2,
      tailwindGenerateMs: 15,
      tailwindSourceResolveMs: 3,
      tailwindDiskGenerateMs: 7,
      tailwindCssMs: 11,
      tailwindTemplateMs: 26,
      tailwindJavaScriptMs: 34,
      tailwindFinalizeMs: 19,
    })
    expect(replacement).toEqual({})
    expect([
      profile.tailwindPrepareMs,
      profile.tailwindGenerateMs,
      profile.tailwindCssMs,
      profile.tailwindTemplateMs,
      profile.tailwindJavaScriptMs,
      profile.tailwindFinalizeMs,
    ].reduce<number>((total, value) => total + (value ?? 0), 0)).toBe(mocks.clock)
  })

  it.each(['production', 'missing-profile'] as const)('does not read the clock for %s', async (mode) => {
    const profile: Profile = {}
    const fixture = createFixture({
      isDev: mode !== 'production',
      profile: mode === 'production' ? profile : undefined,
      generator: false,
    })
    const now = vi.spyOn(performance, 'now').mockImplementation(() => mocks.clock)

    await fixture.run()

    expect(now).not.toHaveBeenCalled()
    expect(profile).toEqual({})
    expect(fixture.compiler.transformCss).toHaveBeenCalledOnce()
    expect(fixture.compiler.transformTemplate).toHaveBeenCalledTimes(2)
    expect(fixture.compiler.transformJavaScript).toHaveBeenCalledTimes(2)
  })
})
