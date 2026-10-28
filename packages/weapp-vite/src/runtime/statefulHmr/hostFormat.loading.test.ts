import { expect, it } from 'vitest'
import { runModuleLoadingProcess } from '../../../test/utils/moduleLoadingProcess'

interface HostFormatLoadingResult {
  initial: string[]
  created: string[]
  loaded: string[]
  failureCode: string
  withMap: { code: string, map: string }
  withoutMap: { code: string, map: null }
}

it('loads real Babel dependencies at renderChunk and preserves output options after a rejected transform', async () => {
  const moduleUrl = new URL('./hostFormat.ts', import.meta.url).href
  const result = await runModuleLoadingProcess<HostFormatLoadingResult>(`
    const compilers = () => loadedModules().filter(url => url.includes('/node_modules/@babel/core/')
      || url.includes('/node_modules/@babel/plugin-transform-dynamic-import/')
      || url.includes('/node_modules/@babel/plugin-transform-modules-commonjs/'))
    const { createStatefulHmrHostFormatPlugin } = await import(${JSON.stringify(moduleUrl)})
    const initial = compilers()
    const plugin = createStatefulHmrHostFormatPlugin()
    const created = compilers()
    const handler = plugin.renderChunk.handler
    let failureCode
    try { await handler('export const =', { fileName: 'invalid.js' }, { sourcemap: false }) }
    catch (error) { failureCode = error.code }
    const withMap = await handler('export const value = 42', { fileName: 'app.js' }, { sourcemap: true })
    const withoutMap = await handler('export const next = 43', { fileName: 'next.js' }, { sourcemap: false })
    process.stdout.write(JSON.stringify({ initial, created, loaded: compilers(), failureCode, withMap, withoutMap }))
  `)

  expect(result.initial).toEqual([])
  expect(result.created).toEqual([])
  expect(result.loaded.some(url => url.includes('/node_modules/@babel/core/'))).toBe(true)
  expect(result.loaded.some(url => url.includes('/node_modules/@babel/plugin-transform-dynamic-import/'))).toBe(true)
  expect(result.loaded.some(url => url.includes('/node_modules/@babel/plugin-transform-modules-commonjs/'))).toBe(true)
  expect(result.failureCode).toBe('BABEL_PARSE_ERROR')
  expect(result.withMap.code).toContain('exports.value')
  expect(result.withMap.code).not.toContain('export const')
  expect(JSON.parse(result.withMap.map)).toMatchObject({
    sources: ['app.js'],
    sourcesContent: ['export const value = 42'],
  })
  expect(result.withoutMap.code).toContain('exports.next')
  expect(result.withoutMap.map).toBeNull()
}, 20_000)
