import { originalPositionFor, TraceMap } from '@jridgewell/trace-mapping'
import MagicString from 'magic-string'
import { expect, it } from 'vitest'
import { bundleHmrCode, prepareHmrPatch, readMappedHmrCode } from './patchPreparation'
import { renderBatch } from './transport'

it('maps the final transport file through compiler, import, target and wrapper transforms', async () => {
  const code = 'const utility = "py-5.5";\nglobalThis.utility = utility;'
  const prepared = await prepareHmrPatch({
    type: 'Patch',
    code,
    filename: 'update.js',
    sourcemap: new MagicString(code).generateMap({ source: 'page.ts', includeContent: true, hires: true }).toString(),
  }, [{
    transformJavaScript({ code, fileName }) {
      const source = new MagicString(code)
      source.replace('py-5.5', 'py-5_d5')
      return { code: source.toString(), map: source.generateMap({ source: fileName, hires: true, includeContent: true }) }
    },
  }], { filename: 'update.js', resolveImport: value => value }, true)
  const published = renderBatch({
    buildId: 'build',
    fromVersion: 0,
    targetVersion: 1,
    deltas: [{ code: bundleHmrCode([prepared]), changedIds: ['page.ts'] }],
  }, 'nonce')
  const mapped = readMappedHmrCode(published, 'transport.js')
  expect(mapped.code).toContain('py-5_d5')
  const lines = mapped.code.split('\n')
  const line = lines.findIndex(line => line.includes('globalThis.utility ='))
  const position = originalPositionFor(new TraceMap(mapped.map as any), {
    line: line + 1,
    column: lines[line]!.indexOf('globalThis.utility'),
  })
  expect(position).toMatchObject({ source: 'page.ts', line: 2, column: 0 })
  expect(published.match(/sourceMappingURL=/g)).toHaveLength(1)
})

it('removes obsolete source map references when maps are disabled', async () => {
  const prepared = await prepareHmrPatch({
    type: 'Patch',
    code: 'globalThis.utility = 1;\n//# sourceMappingURL=old.js.map',
    filename: 'update.js',
  }, [], { filename: 'update.js', resolveImport: value => value }, false)
  expect(prepared.code).not.toContain('sourceMappingURL')
  expect(prepared.map).toBeNull()
})

it('retains a useful raw-payload map when DevEngine supplies an empty original map', async () => {
  const code = 'globalThis.count += 2;'
  const prepared = await prepareHmrPatch({
    type: 'Patch',
    filename: 'patch.js',
    code,
    sourcemap: JSON.stringify({ version: 3, names: [], sources: ['page.vue'], mappings: '' }),
  }, [], { filename: 'patch.js', resolveImport: value => value }, true)
  const result = readMappedHmrCode(bundleHmrCode([prepared]), 'transport.js')
  expect(result.map?.sources).toEqual(['patch.js'])
  expect(result.map?.sourcesContent).toEqual([code])
  expect(result.map?.mappings).not.toBe('')
})
