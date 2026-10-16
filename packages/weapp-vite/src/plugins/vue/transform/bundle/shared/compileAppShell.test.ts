import type { CompilerContext } from '../../../../../context'
import type { ResolvedAppShell } from '../../appShell'
import type { CompilationCacheEntry } from './types'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createModuleGraphService } from '../../../../../moduleGraph'
import { createRuntimeState } from '../../../../../runtime/runtimeState'
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

const source = '<template><view>page</view></template>'

describe('bundle page cache app shell inputs', () => {
  let root: string
  let filename: string
  let shell: ResolvedAppShell

  beforeEach(() => {
    root = mkdtempSync(path.join(tmpdir(), 'weapp-shell-cache-'))
    filename = path.join(root, 'pages/index/index.vue')
    shell = {
      file: path.join(root, '__weapp_vite_app_shell'),
      importPath: '/__weapp_vite_app_shell',
      tagName: 'weapp-app-shell',
    }
    mocks.compile.mockClear()
    mocks.read.mockResolvedValue(source)
  })

  afterEach(() => rmSync(root, { recursive: true, force: true }))

  function refresh(cached: CompilationCacheEntry, appShell?: ResolvedAppShell) {
    return refreshCompiledVueEntryCacheInDev({
      filename,
      cached,
      appShell,
      ctx: {
        moduleGraphService: createModuleGraphService(),
        runtimeState: createRuntimeState(),
      } as CompilerContext,
      pluginCtx: { emitFile: vi.fn() },
      configService: {
        isDev: true,
        platform: 'weapp',
        relativeOutputPath: (value: string) => path.relative(root, value).split(path.sep).join('/'),
        weappViteConfig: {},
      } as NonNullable<CompilerContext['configService']>,
      compileOptionsState: {
        reExportResolutionCache: new Map(),
        classStyleRuntimeWarned: { value: false },
      },
    })
  }

  it.each(['added', 'removed'])('recompiles an unchanged page when its app shell is %s', async (change) => {
    const previous = change === 'added' ? undefined : shell
    const current = change === 'added' ? shell : undefined
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
