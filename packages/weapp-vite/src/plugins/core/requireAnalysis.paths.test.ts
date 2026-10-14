import type { CorePluginState } from './helpers'
import { Buffer } from 'node:buffer'
import { parseAst } from 'rollup/parseAst'
import { expect, it, vi } from 'vitest'
import { createRequireAnalysisPlugin } from './requireAnalysis'

it.each([
  ['preserve', 'weapp', 'const value = import("./feature.js")'],
  ['native', 'weapp', 'export const value = 1'],
  ['native', 'alipay', 'const value = import("./feature.js")'],
] as const)('skips package identity when %s / %s cannot rewrite a native import', async (dynamicImports, platform, code) => {
  const relativeAbsoluteSrcRoot = vi.fn(() => 'page.js')
  const state = {
    ctx: {
      configService: { platform, relativeAbsoluteSrcRoot, weappViteConfig: { chunks: { dynamicImports } } },
      scanService: { subPackageMap: new Map([['feature', {}]]), independentSubPackageMap: new Map() },
    },
    requireAsyncEmittedChunks: new Map(),
  } as unknown as CorePluginState
  const plugin = createRequireAnalysisPlugin(state)
  const transform = plugin.transform
  const handler = typeof transform === 'function' ? transform : transform!.handler
  const resolve = vi.fn()
  const result = await handler.call({ parse: parseAst, resolve } as any, code, '/project/src/page.js', {} as any)
  expect(result).toMatchObject({ code, meta: { requireAsyncDependencies: [] } })
  expect(relativeAbsoluteSrcRoot).not.toHaveBeenCalled()
  expect(resolve).not.toHaveBeenCalled()
})

it('still rewrites a native import across a declared WeChat subpackage boundary', async () => {
  const relativeAbsoluteSrcRoot = vi.fn((id: string) => id.replace('/project/src/', ''))
  const state = {
    ctx: {
      configService: {
        platform: 'weapp',
        relativeAbsoluteSrcRoot,
        relativeOutputPath: relativeAbsoluteSrcRoot,
        weappViteConfig: { chunks: { dynamicImports: 'native' } },
      },
      scanService: { subPackageMap: new Map([['feature', {}]]), independentSubPackageMap: new Map() },
    },
    requireAsyncEmittedChunks: new Map(),
  } as unknown as CorePluginState
  const transform = createRequireAnalysisPlugin(state).transform
  const handler = typeof transform === 'function' ? transform : transform!.handler
  const dependency = '/project/src/feature/index.js'
  const resolve = vi.fn(async () => ({ id: dependency }))
  const result = await handler.call({ parse: parseAst, resolve } as any, 'const value = import("./feature/index.js")', '/project/src/page.js', {} as any)
  const marker = `__weapp_vite_require_async_target__${Buffer.from('feature/index.js').toString('base64url')}`
  expect(result).toMatchObject({
    code: `const value = require.async(${JSON.stringify(marker)})`,
    meta: { requireAsyncDependencies: [{ id: dependency, fileName: 'feature/index.js' }] },
  })
  expect(relativeAbsoluteSrcRoot).toHaveBeenCalledWith('/project/src/page.js')
  expect(relativeAbsoluteSrcRoot).toHaveBeenCalledWith(dependency)
})
