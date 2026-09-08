import type { CompilerContext } from '../../../context'
import { mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'pathe'
import { dev } from 'rolldown/experimental'
import { describe, expect, it, vi } from 'vitest'
import { createChunkEmitter } from './chunkEmitter'
import { EntryChunkLifecycle } from './entryChunkLifecycle'

describe('entry chunks in the real DevEngine partial scanner', () => {
  it('reuses an independent component entry when an importer is loaded after the full scan', async () => {
    const root = await realpath(await mkdtemp(path.join(tmpdir(), 'entry-chunk-scan-')))
    const main = path.join(root, 'main.js')
    const lazy = path.join(root, 'lazy.js')
    const child = path.join(root, 'child.js')
    await Promise.all([
      writeFile(main, 'export const open = () => import("./lazy.js")'),
      writeFile(lazy, 'export const label = "lazy-owner"'),
      writeFile(child, 'export const label = "independent-child"'),
    ])
    const lifecycle = new EntryChunkLifecycle(() => {
      throw new Error('Existing entries must not request a full rebuild')
    })
    const emitter = createChunkEmitter({
      relativeOutputPath: (id: string) => path.relative(root, id),
    } as CompilerContext['configService'], new Set(), undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, lifecycle)
    const errors: Error[] = []
    const engine = await dev({
      input: main,
      experimental: { devMode: { lazy: true } },
      plugins: [{
        name: 'entry-chunk-scan-fixture',
        buildStart: () => lifecycle.beginBuild(),
        buildEnd: () => lifecycle.endBuild(),
        async load(id) {
          if (id === main || id === lazy) {
            await Promise.all(emitter.call(this, [{ id: child, external: false }]))
            return await readFile(id, 'utf8')
          }
        },
      }],
    }, { entryFileNames: 'main.js' }, {
      watch: { enabled: false, skipWrite: true },
      onOutput: (result) => {
        if (result instanceof Error) {
          errors.push(result)
        }
      },
    })
    try {
      await engine.run()
      await engine.ensureCurrentBuildFinish()
      expect(errors).toEqual([])
      await engine.registerClient('entry-chunk-test')
      // 元数据扫描可能没有重放已缓存入口；注册权威仍是原生引擎的现存入口图。
      lifecycle.beginBuild()
      lifecycle.endBuild()
      const output = await engine.compileEntry(`${lazy}?rolldown-lazy=1`, 'entry-chunk-test')
      expect(output.code).toContain('lazy-owner')
    }
    finally {
      await engine.close()
      await rm(root, { recursive: true, force: true })
    }
  })

  it('defers a new component to a full scan, removes its output on the next full scan, and resumes partial loads', async () => {
    const root = await realpath(await mkdtemp(path.join(tmpdir(), 'entry-chunk-topology-')))
    const main = path.join(root, 'main.js')
    const lazy = path.join(root, 'lazy.js')
    const nextLazy = path.join(root, 'next.js')
    const child = path.join(root, 'child.js')
    await Promise.all([
      writeFile(main, 'export const open = () => [import("./lazy.js"), import("./next.js")]'),
      writeFile(lazy, 'export const label = "first-owner"'),
      writeFile(nextLazy, 'export const label = "next-owner"'),
      writeFile(child, 'export const label = "added-child"'),
    ])
    const requestFullBuild = vi.fn()
    const lifecycle = new EntryChunkLifecycle(requestFullBuild)
    const emitter = createChunkEmitter({
      relativeOutputPath: (id: string) => path.relative(root, id),
    } as CompilerContext['configService'], new Set(), undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, lifecycle)
    let components: string[] = []
    const outputs: string[][] = []
    const errors: Error[] = []
    const engine = await dev({
      input: main,
      experimental: { devMode: { lazy: true } },
      plugins: [{
        name: 'entry-chunk-topology-fixture',
        buildStart: () => lifecycle.beginBuild(),
        buildEnd: () => lifecycle.endBuild(),
        async load(id) {
          if ([main, lazy, nextLazy].includes(id)) {
            await Promise.all(emitter.call(this, components.map(id => ({ id, external: false }))))
            return await readFile(id, 'utf8')
          }
        },
      }],
    }, { entryFileNames: 'main.js' }, {
      watch: { enabled: false, skipWrite: true },
      onOutput: (result) => {
        if (result instanceof Error) {
          errors.push(result)
        }
        else {
          outputs.push(result.output.map(item => item.fileName))
        }
      },
    })
    const rebuild = async () => {
      engine.triggerFullBuild()
      await engine.ensureLatestBuildOutput()
      expect(errors).toEqual([])
    }
    try {
      await engine.run()
      await engine.ensureCurrentBuildFinish()
      await engine.registerClient('topology-test')
      expect(outputs.at(-1)).not.toContain('child.js')
      components = [child]
      await expect(engine.compileEntry(`${lazy}?rolldown-lazy=1`, 'topology-test')).resolves.toMatchObject({ code: expect.stringContaining('first-owner') })
      expect(requestFullBuild).toHaveBeenCalledExactlyOnceWith(child)
      await rebuild()
      expect(outputs.at(-1)).toContain('child.js')
      components = []
      await rebuild()
      expect(outputs.at(-1)).not.toContain('child.js')
      components = [child]
      await rebuild()
      expect(outputs.at(-1)).toContain('child.js')
      await expect(engine.compileEntry(`${nextLazy}?rolldown-lazy=1`, 'topology-test')).resolves.toMatchObject({ code: expect.stringContaining('next-owner') })
      expect(requestFullBuild).toHaveBeenCalledTimes(1)
    }
    finally {
      await engine.close()
      await rm(root, { recursive: true, force: true })
    }
  })
})
