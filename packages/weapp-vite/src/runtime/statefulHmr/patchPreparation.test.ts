import { runInNewContext } from 'node:vm'
import { originalPositionFor, TraceMap } from '@jridgewell/trace-mapping'
import MagicString from 'magic-string'
import { afterEach, expect, it, vi } from 'vitest'
import { bundleHmrCode, prepareHmrPatch, readMappedHmrCode } from './patchPreparation'
import { renderBatch } from './transport'

afterEach(() => vi.restoreAllMocks())

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

it.each([
  { label: 'without imports', prefix: '', expectedImports: [] },
  { label: 'with external side effects', prefix: 'import "setup";\n', expectedImports: ['./setup.js'] },
])('does not allocate or read disabled maps $label while preserving patch execution', async ({ prefix, expectedImports }) => {
  const generateMap = vi.spyOn(MagicString.prototype, 'generateMap')
  const prepared = await prepareHmrPatch({
    type: 'Patch',
    code: `${prefix}globalThis.value = 3;\n//# sourceMappingURL=old.js.map`,
    filename: 'update.js',
    get sourcemap(): string { throw new Error('Disabled payload map must not be read') },
  }, [{
    transformJavaScript({ code, sourcemap }) {
      expect(sourcemap).toBe(false)
      return {
        code: code.replace('value = 3', 'value = 4'),
        get map(): never { throw new Error('Disabled provider map must not be read') },
      }
    },
  }], { filename: 'update.js', resolveImport: () => './setup.js' }, false)
  const imports: string[] = []
  const runtime = { value: 0, require: (id: string) => imports.push(id) }
  const code = bundleHmrCode([prepared])
  runInNewContext(code, runtime)

  expect(runtime.value).toBe(4)
  expect(imports).toEqual(expectedImports)
  expect(prepared.map).toBeNull()
  expect(code).not.toContain('sourceMappingURL')
  expect(generateMap).not.toHaveBeenCalled()
})

it('maps rewritten external imports back to their original payload position', async () => {
  const code = 'import "setup";\nglobalThis.value = 3;'
  const prepared = await prepareHmrPatch({ type: 'Patch', code, filename: 'update.js' }, [], {
    filename: 'update.js',
    resolveImport: () => './setup.js',
  }, true)
  const mapped = readMappedHmrCode(bundleHmrCode([prepared]), 'transport.js')
  const lines = mapped.code.split('\n')
  const line = lines.findIndex(line => line.includes('globalThis.value'))
  expect(originalPositionFor(new TraceMap(mapped.map as any), {
    line: line + 1,
    column: lines[line]!.indexOf('globalThis.value'),
  })).toMatchObject({ source: 'update.js', line: 2, column: 0 })
  const imports: string[] = []
  const runtime = { value: 0, require: (id: string) => imports.push(id) }
  runInNewContext(mapped.code, runtime)
  expect(runtime.value).toBe(3)
  expect(imports).toEqual(['./setup.js'])
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
