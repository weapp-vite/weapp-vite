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

  it('uses emitted bytes and package ownership, and rejects a missing artifact', async () => {
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
      const bundle = { 'output.js': { fileName: 'output.js', type: 'chunk', modules: { [id]: { renderedLength: 8 } } } }
      const context = { getModuleInfo: vi.fn(() => ({ importedIds: [], dynamicallyImportedIds: [], isEntry: true })) }
      const capture = () => Reflect.apply(plugin.writeBundle as (...args: unknown[]) => Promise<void>, context, [{}, bundle])
      await capture()
      const report = JSON.parse(await readFile(path.join(root, 'consumer-attribution.json'), 'utf8')) as { artifacts: { files: Array<{ bytes: number, sha256: string, unattributedBytes: number, modules: Array<{ category: string }> }> } }
      expect(report.artifacts.files[0]).toMatchObject({ bytes: 15, sha256: createHash('sha256').update('retained output').digest('hex'), unattributedBytes: 7, modules: [{ category: 'runtime' }] })
      const escapedBundle = { 'output.js': { ...bundle['output.js'], modules: { [path.join(path.dirname(root), 'unrelated-runtime.mjs')]: { renderedLength: 8 } } } }
      await expect(Reflect.apply(plugin.writeBundle as (...args: unknown[]) => Promise<void>, context, [{}, escapedBundle])).rejects.toThrow('escapes the installed consumer tree')
      await rm(path.join(root, 'dist/output.js'))
      await expect(capture()).rejects.toThrow('ENOENT')
    }
    finally {
      await rm(root, { recursive: true, force: true })
    }
  })
})
