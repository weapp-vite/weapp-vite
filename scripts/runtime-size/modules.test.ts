import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { build } from 'esbuild'
import { describe, expect, it } from 'vitest'
import { createRuntimeSizeRetainedModules, resolveRuntimeImportChain } from './modules'

describe('runtime source import graph', () => {
  it.each([
    ['star re-export', 'export * from \'./leaf.js\''],
    ['import then export', 'import { retained } from \'./leaf.js\'; export { retained }'],
  ])('resolves %s through modules absent from the output', async (_, reexport) => {
    const root = await mkdtemp(path.join(tmpdir(), 'runtime-import-chain-'))
    try {
      const sources = {
        'package.json': JSON.stringify({ type: 'module', sideEffects: false }),
        'entry.js': 'export { retained } from \'./barrel.js\'',
        'barrel.js': 'export * from \'./reexport.js\'; export * from \'./unused.js\'; export { external } from \'external-runtime\'',
        'reexport.js': reexport,
        'leaf.js': 'export const retained = { value: 42 }',
        'unused.js': 'export const unused = { value: 99 }',
      }
      await Promise.all(Object.entries(sources).map(([name, source]) => writeFile(path.join(root, name), source)))
      const result = await build({
        absWorkingDir: root,
        entryPoints: ['entry.js'],
        external: ['external-runtime'],
        bundle: true,
        metafile: true,
        write: false,
        format: 'esm',
        minify: true,
      })
      const output = Object.values(result.metafile.outputs)[0]!
      expect(output.inputs).not.toHaveProperty('barrel.js')
      expect(output.inputs).not.toHaveProperty('reexport.js')
      expect(output.inputs).not.toHaveProperty('unused.js')

      const retained = createRuntimeSizeRetainedModules(root, result.metafile)
      expect(retained.modules.map(module => module.path)).toEqual(['entry.js', 'leaf.js'])
      expect(retained.modules.find(module => module.path === 'leaf.js')!.bytesInOutput).toBeGreaterThan(0)
      expect(resolveRuntimeImportChain(retained, 'leaf.js')).toEqual([
        'entry.js',
        'barrel.js',
        'reexport.js',
        'leaf.js',
      ])
      expect(retained.importGraph).toEqual([
        { path: 'barrel.js', imports: ['reexport.js', 'unused.js'] },
        { path: 'entry.js', imports: ['barrel.js'] },
        { path: 'leaf.js', imports: [] },
        { path: 'reexport.js', imports: ['leaf.js'] },
        { path: 'unused.js', imports: [] },
      ])
    }
    finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('keeps missing paths explicit in historical reports without a source graph', () => {
    expect(resolveRuntimeImportChain({
      entry: 'entry.js',
      modules: [
        { path: 'entry.js', bytesInOutput: 0, imports: [] },
        { path: 'leaf.js', bytesInOutput: 17, imports: [] },
      ],
    }, 'leaf.js')).toEqual(['entry.js', '[no live import path]', 'leaf.js'])
  })
})
