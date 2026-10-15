import type { CompilerContext } from '../../../../../context'
import type { ResolvedAppShell } from '../../appShell'
import type { CompilationCacheEntry } from './types'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createCompilerAppShellSignature } from '../../appShell'
import { refreshCompiledVueEntryCacheInDev } from './compile'

const mocks = vi.hoisted(() => ({
  compile: vi.fn(async (_source: string, _filename: string, _options: unknown) => ({ script: 'Page({})', template: '<view>refreshed</view>' })),
  read: vi.fn(),
}))

vi.mock('wevu/compiler', async importOriginal => ({
  ...await importOriginal<typeof import('wevu/compiler')>(),
  compileVueFile: mocks.compile,
}))

vi.mock('../../../../utils/sourceSnapshot', async importOriginal => ({
  ...await importOriginal<typeof import('../../../../utils/sourceSnapshot')>(),
  readCompilerInput: mocks.read,
}))
vi.mock('../../pageLayout', async importOriginal => ({
  ...await importOriginal<typeof import('../../pageLayout')>(),
  resolvePageLayoutPlan: async () => undefined,
}))
vi.mock('../../injectPageFeatures', () => ({
  injectWevuPageFeaturesInJsWithViteResolver: async () => ({ transformed: false }),
}))

const filename = '/project/src/pages/index/index.vue'
const source = '<template><view>page</view></template>'
const shell: ResolvedAppShell = {
  file: '/project/src/__weapp_vite_app_shell',
  importPath: '/__weapp_vite_app_shell',
  tagName: 'weapp-app-shell',
}

describe('bundle page cache app shell inputs', () => {
  beforeEach(() => {
    mocks.compile.mockClear()
    mocks.read.mockResolvedValue(source)
  })

  function refresh(cached: CompilationCacheEntry, appShell?: ResolvedAppShell) {
    return refreshCompiledVueEntryCacheInDev({
      filename,
      cached,
      appShell,
      ctx: {} as CompilerContext,
      pluginCtx: { emitFile: vi.fn() },
      configService: {
        isDev: true,
        platform: 'weapp',
        relativeOutputPath: (value: string) => value.replace('/project/src/', ''),
        weappViteConfig: {},
      } as NonNullable<CompilerContext['configService']>,
      compileOptionsState: {
        reExportResolutionCache: new Map(),
        classStyleRuntimeWarned: { value: false },
      },
    })
  }

  it.each([
    ['added', undefined, shell],
    ['removed', shell, undefined],
  ] as const)('recompiles an unchanged page when its app shell is %s', async (_label, previous, current) => {
    const cached = {
      result: { script: 'Page({})', template: '<view>cached</view>' },
      source,
      isPage: true,
      appShellSignature: createCompilerAppShellSignature(previous),
    }

    const result = await refresh(cached, current)

    expect(mocks.compile).toHaveBeenCalledTimes(1)
    expect(mocks.compile.mock.calls[0]?.[2]).toMatchObject({
      appShell: current && { importPath: current.importPath, tagName: current.tagName },
    })
    expect(result.template).toBe('<view>refreshed</view>')
    expect(cached.appShellSignature).toBe(createCompilerAppShellSignature(current))

    await refresh(cached, current)
    expect(mocks.compile).toHaveBeenCalledTimes(1)
  })
})
