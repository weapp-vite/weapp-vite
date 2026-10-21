import type { CorePluginState } from './helpers'
import { Buffer } from 'node:buffer'
import os from 'node:os'
import path from 'pathe'
import { parseAst } from 'rolldown/parseAst'
import { describe, expect, it, vi } from 'vitest'
import { createRequireAnalysisPlugin } from './requireAnalysis'

function createAnalysis() {
  const root = path.join(os.tmpdir(), 'weapp-vite-require-analysis', 'src')
  const relativePath = (id: string) => path.relative(root, id)
  const state = {
    ctx: {
      configService: {
        platform: 'weapp',
        relativeAbsoluteSrcRoot: relativePath,
        relativeOutputPath: relativePath,
        weappViteConfig: { chunks: { dynamicImports: 'native' } },
      },
      scanService: {
        subPackageMap: new Map([['feature', {}]]),
        independentSubPackageMap: new Map(),
      },
    },
    requireAsyncEmittedChunks: new Set(),
  } as unknown as CorePluginState
  const transform = createRequireAnalysisPlugin(state).transform!
  const handler = typeof transform === 'function' ? transform : transform.handler
  const parse = vi.fn(parseAst)
  const resolve = vi.fn(async (id: string) => ({ id }))
  return { root, handler, parse, resolve }
}

describe('require analysis before native TypeScript transforms', () => {
  it.each(['ts', undefined] as const)('parses raw TypeScript with module type %s', async (moduleType) => {
    const { root, handler, parse, resolve } = createAnalysis()
    const code = `
interface NavigationTrace { events: string[] }
const trace = { events: [] } as NavigationTrace
const increment = (delta: number) => delta + trace.events.length
export { increment }
`
    const result = await handler.call(
      { parse, resolve } as any,
      code,
      path.join(root, 'page.ts'),
      moduleType ? { moduleType } as any : undefined,
    )

    expect(parse).toHaveBeenCalledWith(code, { lang: 'ts' })
    expect(result).toMatchObject({ code, ast: parse.mock.results[0]!.value, meta: { requireAsyncDependencies: [] } })
    expect(resolve).not.toHaveBeenCalled()
  })

  it('preserves async require, callback require and native import rewrites in raw TypeScript', async () => {
    const { root, handler, parse, resolve } = createAnalysis()
    const code = `
interface NavigationTrace { events: string[] }
const onLoaded = (value: NavigationTrace) => value.events.length
const promise: Promise<NavigationTrace> = require.async('./feature/async.ts')
require('./feature/callback.ts', onLoaded, console.error)
const nativeModule = import('./feature/native.ts')
`
    const result = await handler.call(
      { parse, resolve } as any,
      code,
      path.join(root, 'page.ts'),
      { moduleType: 'ts' } as any,
    )
    const marker = (file: string) => `__weapp_vite_require_async_target__${Buffer.from(file).toString('base64url')}`

    expect(parse).toHaveBeenCalledWith(code, { lang: 'ts' })
    expect(result).toMatchObject({
      code: expect.stringContaining(`const promise: Promise<NavigationTrace> = require.async(${JSON.stringify(marker('feature/async.js'))})`),
      meta: {
        requireAsyncDependencies: [
          { id: path.join(root, 'feature/async.ts'), fileName: 'feature/async.js' },
          { id: path.join(root, 'feature/callback.ts'), fileName: 'feature/callback.js' },
          { id: path.join(root, 'feature/native.ts'), fileName: 'feature/native.js' },
        ],
      },
    })
    expect(result).toMatchObject({ code: expect.stringContaining(`void require.async(${JSON.stringify(marker('feature/callback.js'))}).then(onLoaded, console.error)`) })
    expect(result).toMatchObject({ code: expect.stringContaining(`const nativeModule = require.async(${JSON.stringify(marker('feature/native.js'))})`) })
    expect(result).not.toHaveProperty('ast')
  })

  it('uses the transformed module language even when its filename still ends in .ts', async () => {
    const { root, handler, parse, resolve } = createAnalysis()
    const code = 'export const value = 42'
    const result = await handler.call(
      { parse, resolve } as any,
      code,
      path.join(root, 'page.ts'),
      { moduleType: 'js' } as any,
    )

    expect(parse).toHaveBeenCalledWith(code, { lang: 'js' })
    expect(result).toMatchObject({ code, ast: parse.mock.results[0]!.value })
  })
})
