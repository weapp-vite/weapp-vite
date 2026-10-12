import { expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({
  coreLoaded: vi.fn(),
  pluginLoaded: vi.fn(),
  transformed: vi.fn(),
  failure: undefined as Error | undefined,
}))

vi.mock('@weapp-vite/ast/babelCore', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@weapp-vite/ast/babelCore')>()
  state.coreLoaded()
  return {
    ...actual,
    async transformAsync(...args: Parameters<typeof actual.transformAsync>) {
      state.transformed(...args)
      if (state.failure) {
        const error = state.failure
        state.failure = undefined
        throw error
      }
      return actual.transformAsync(...args)
    },
  }
})

vi.mock('@babel/plugin-transform-modules-commonjs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@babel/plugin-transform-modules-commonjs')>()
  state.pluginLoaded()
  return actual
})

it('loads Babel at renderChunk, preserving CommonJS output, maps and failures', async () => {
  const { createStatefulHmrHostFormatPlugin } = await import('./hostFormat')
  const plugin = createStatefulHmrHostFormatPlugin()
  expect(state.coreLoaded).not.toHaveBeenCalled()
  expect(state.pluginLoaded).not.toHaveBeenCalled()

  const { handler } = plugin.renderChunk as {
    handler: (code: string, chunk: { fileName: string }, options: { sourcemap: boolean }) => Promise<{ code: string, map: string | null }>
  }
  const code = 'export const value = 42'
  const chunk = { fileName: 'app.js' }
  const failure = new Error('host format conversion failed')
  state.failure = failure
  await expect(handler(code, chunk, { sourcemap: false })).rejects.toBe(failure)

  const result = await handler(code, chunk, { sourcemap: true })
  expect(result.code).toContain('exports.value')
  expect(result.code).not.toContain('export const')
  expect(JSON.parse(result.map!)).toMatchObject({ sources: ['app.js'], sourcesContent: [code] })
  expect(state.coreLoaded).toHaveBeenCalledTimes(1)
  expect(state.pluginLoaded).toHaveBeenCalledTimes(1)
  const { default: commonjs } = await import('@babel/plugin-transform-modules-commonjs')
  expect(state.transformed).toHaveBeenLastCalledWith(code, expect.objectContaining({
    babelrc: false,
    configFile: false,
    filename: 'app.js',
    sourceMaps: true,
    plugins: [commonjs],
  }))
  expect((await handler(code, chunk, { sourcemap: false })).map).toBeNull()
})
