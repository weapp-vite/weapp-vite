import { expect, it } from 'vitest'
import { runModuleLoadingProcess } from '../../test/utils/moduleLoadingProcess'

it('loads real Babel presets only on the first synchronous WXS transform', async () => {
  const moduleUrl = new URL('./index.ts', import.meta.url).href
  const result = await runModuleLoadingProcess<{ before: string[], after: string[], second: string[], code: string, synchronous: boolean }>(`
    const presets = () => loadedModules().filter(url => url.includes('/node_modules/@babel/preset-env/') || url.includes('/node_modules/@babel/preset-typescript/'))
    const { transformWxsCode, normalizeWxsFilename } = await import(${JSON.stringify(moduleUrl)})
    const before = presets()
    if (normalizeWxsFilename('./helper.wxs.ts', 'sjs') !== './helper.sjs') throw new Error('filename contract changed')
    const transformed = transformWxsCode('export const count: number = 2; export const imported = require("./helper.wxs")', { extension: 'sjs' })
    const after = presets()
    const secondResult = transformWxsCode('module.exports = { count: 3 }')
    process.stdout.write(JSON.stringify({ before, after, second: presets(), code: transformed.result.code, synchronous: !transformed.then && !secondResult.then }))
  `)
  expect(result.before).toEqual([])
  expect(result.after).toHaveLength(2)
  expect(result.after.some(url => url.includes('/node_modules/@babel/preset-env/'))).toBe(true)
  expect(result.after.some(url => url.includes('/node_modules/@babel/preset-typescript/'))).toBe(true)
  expect(result.second).toEqual(result.after)
  expect(result.synchronous).toBe(true)
  expect(result.code).toMatch(/export (?:var|const) count\s*=\s*2/)
  expect(result.code).toMatch(/require\(['"]\.\/helper\.sjs['"]\)/)
  expect(result.code).not.toContain(': number')
}, 20_000)
