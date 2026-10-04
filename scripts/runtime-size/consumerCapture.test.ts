import { createHash } from 'node:crypto'
import { mkdir, mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { captureConsumerAttribution, normalizeConsumerDiagnostic } from './consumerCapture'

describe('published consumer attribution capture', () => {
  it('normalizes encoded virtual-module paths and compiler-output references', () => {
    const root = path.join(os.tmpdir(), 'isolated-consumer')
    expect(normalizeConsumerDiagnostic(`owner=${encodeURIComponent(root)}%2Fsrc%2Fapp.vue; file=${root}/src/app.vue`, root)).toBe('owner=[consumer]%2Fsrc%2Fapp.vue; file=[consumer]/src/app.vue')
  })

  it('keeps the source graph separate from emitted bytes and rejects incomplete capture', async () => {
    const root = await realpath(await mkdtemp(path.join(os.tmpdir(), 'consumer-capture-')))
    try {
      await mkdir(path.join(root, 'dist'), { recursive: true })
      for (const name of ['weapp-vite', 'wevu']) {
        await mkdir(path.join(root, 'node_modules', name), { recursive: true })
        await writeFile(path.join(root, 'node_modules', name, 'package.json'), JSON.stringify({ name, version: '7.4.0' }))
      }
      await writeFile(path.join(root, 'package-lock.json'), '{}')
      await writeFile(path.join(root, 'dist', 'output.js'), 'retained output')
      const plugin = captureConsumerAttribution(root)
      Reflect.apply(plugin.configResolved as (...args: unknown[]) => unknown, {}, [{ build: { outDir: 'dist' } }])
      const id = path.join(root, 'node_modules/wevu/runtime.mjs')
      const entry = path.join(root, 'src/app.js')
      const barrel = path.join(root, 'node_modules/wevu/index.mjs')
      const unused = path.join(root, 'node_modules/wevu/unused.mjs')
      const lazy = path.join(root, 'src/lazy.js')
      const moduleInfo = new Map([
        [entry, { isEntry: true, isExternal: false, importedIds: [barrel, unused, 'external-runtime'], dynamicallyImportedIds: [lazy] }],
        [barrel, { isEntry: false, isExternal: false, importedIds: [id], dynamicallyImportedIds: [] }],
        [id, { isEntry: false, isExternal: false, importedIds: [], dynamicallyImportedIds: [] }],
        [unused, { isEntry: false, isExternal: false, importedIds: [], dynamicallyImportedIds: [] }],
        [lazy, { isEntry: false, isExternal: false, importedIds: [entry], dynamicallyImportedIds: [] }],
        ['external-runtime', { isEntry: false, isExternal: true, importedIds: [], dynamicallyImportedIds: [] }],
      ])
      const bundle = { 'output.js': { fileName: 'output.js', type: 'chunk', modules: { [id]: { renderedLength: 8 } } } }
      const context = {
        getModuleIds: vi.fn(() => [entry, barrel, id, unused, lazy].values()),
        getModuleInfo: vi.fn((moduleId: string) => moduleInfo.get(moduleId) ?? null),
      }
      const capture = () => Reflect.apply(plugin.writeBundle as (...args: unknown[]) => Promise<void>, context, [{}, bundle])
      await capture()
      const report = JSON.parse(await readFile(path.join(root, 'consumer-attribution.json'), 'utf8')) as {
        artifacts: { files: Array<{ bytes: number, sha256: string, unattributedBytes: number, modules: Array<{ category: string }> }> }
        graphKind: string
        graph: Array<{ source: string, isEntry: boolean, isExternal: boolean, imports: string[], dynamicImports: string[] }>
      }
      expect(report.artifacts.files[0]).toMatchObject({ bytes: 15, sha256: createHash('sha256').update('retained output').digest('hex'), unattributedBytes: 7, modules: [{ category: 'runtime' }] })
      expect(report.artifacts.files[0]!.modules).toHaveLength(1)
      expect(report.graphKind).toBe('source-imports')
      expect(report.graph).toEqual([
        { source: 'external-runtime', isEntry: false, isExternal: true, imports: [], dynamicImports: [] },
        { source: 'node_modules/wevu/index.mjs', isEntry: false, isExternal: false, imports: ['node_modules/wevu/runtime.mjs'], dynamicImports: [] },
        { source: 'node_modules/wevu/runtime.mjs', isEntry: false, isExternal: false, imports: [], dynamicImports: [] },
        { source: 'node_modules/wevu/unused.mjs', isEntry: false, isExternal: false, imports: [], dynamicImports: [] },
        { source: 'src/app.js', isEntry: true, isExternal: false, imports: ['external-runtime', 'node_modules/wevu/index.mjs', 'node_modules/wevu/unused.mjs'], dynamicImports: ['src/lazy.js'] },
        { source: 'src/lazy.js', isEntry: false, isExternal: false, imports: ['src/app.js'], dynamicImports: [] },
      ])
      const escapedBundle = { 'output.js': { ...bundle['output.js'], modules: { [path.join(path.dirname(root), 'unrelated-runtime.mjs')]: { renderedLength: 8 } } } }
      await expect(Reflect.apply(plugin.writeBundle as (...args: unknown[]) => Promise<void>, context, [{}, escapedBundle])).rejects.toThrow('escapes the installed consumer tree')
      context.getModuleIds.mockReturnValueOnce([path.join(path.dirname(root), 'unrelated-source.mjs')].values())
      await expect(capture()).rejects.toThrow('Source module escapes the installed consumer tree')
      context.getModuleInfo.mockReturnValueOnce(null)
      await expect(capture()).rejects.toThrow('module metadata is missing')
      await rm(path.join(root, 'dist/output.js'))
      await expect(capture()).rejects.toThrow('ENOENT')
    }
    finally {
      await rm(root, { recursive: true, force: true })
    }
  })
})
