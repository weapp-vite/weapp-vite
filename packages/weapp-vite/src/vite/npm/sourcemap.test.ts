import { Buffer } from 'node:buffer'
import path from 'pathe'
import { expect, it } from 'vitest'
import { relocateNpmSourcemap } from './sourcemap'

it('keeps external and inline maps pointing at the same source after a manual mirror', () => {
  const from = path.resolve('project/dist/miniprogram_npm/package/index.js')
  const to = path.resolve('project/secondary/deeper/miniprogram_npm/package/index.js')
  const originalSource = path.resolve('project/node_modules/package/index.js')
  const map = JSON.stringify({ version: 3, sources: [path.relative(path.dirname(from), originalSource)], mappings: '' })
  const external = JSON.parse(String(relocateNpmSourcemap(map, `${from}.map`, `${to}.map`))) as { sources: string[] }
  expect(path.resolve(path.dirname(to), external.sources[0]!)).toBe(originalSource)
  const inline = `module.exports = 1;\n//# sourceMappingURL=data:application/json;charset=utf-8;base64,${Buffer.from(map).toString('base64')}`
  const relocated = String(relocateNpmSourcemap(inline, from, to))
  const decoded = JSON.parse(Buffer.from(relocated.split('base64,')[1]!, 'base64').toString('utf8')) as { sources: string[] }
  expect(path.resolve(path.dirname(to), decoded.sources[0]!)).toBe(originalSource)
})

it('preserves URL source roots and unrelated map assets', () => {
  const map = JSON.stringify({ version: 3, sourceRoot: 'https://sources.example/', sources: ['index.ts'], mappings: '' })
  expect(relocateNpmSourcemap(map, 'from/index.js.map', 'to/index.js.map')).toBe(map)
  expect(relocateNpmSourcemap('opaque', 'from/data.map', 'to/data.map')).toBe('opaque')
})
