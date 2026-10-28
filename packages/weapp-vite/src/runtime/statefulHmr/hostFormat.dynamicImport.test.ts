import type { OutputChunk } from 'rolldown'
import path from 'node:path'
import { runInNewContext } from 'node:vm'
import { rolldown } from 'rolldown'
import { expect, it } from 'vitest'
import { createStatefulHmrHostFormatPlugin } from './hostFormat'

interface EntryExports {
  state: { value: number }
  load: () => Promise<{ default: () => number }>
  loadBroken: () => Promise<unknown>
}

async function createSplitChunkHost() {
  const sources: Record<string, string> = {
    'virtual:entry': `
      import { state } from 'virtual:shared'
      export { state }
      export const load = () => import('virtual:lazy')
      export const loadBroken = () => import('virtual:broken')
    `,
    'virtual:shared': 'export const state = { value: 7 }',
    'virtual:lazy': `
      import { state } from 'virtual:shared'
      globalThis.events.push('lazy evaluated')
      export default () => state.value * 3
    `,
    'virtual:broken': `throw new Error('lazy evaluation failed'); export const value = 0`,
  }
  const build = await rolldown({
    input: ['virtual:entry', 'virtual:shared'],
    plugins: [{
      name: 'stateful-host-dynamic-import-fixture',
      resolveId(id) { return Object.hasOwn(sources, id) ? id : null },
      load(id) { return sources[id] ?? null },
    }, createStatefulHmrHostFormatPlugin()],
  })
  try {
    const { output } = await build.generate({
      format: 'esm',
      entryFileNames: '[name].js',
      chunkFileNames: 'chunks/[name].js',
      sourcemap: true,
    })
    const chunks = new Map(output.filter((item): item is OutputChunk => item.type === 'chunk').map(item => [item.fileName, item]))
    const cache = new Map<string, { exports: unknown }>()
    const events: string[] = []
    const evaluate = (name: string): unknown => {
      if (cache.has(name)) {
        return cache.get(name)!.exports
      }
      const chunk = chunks.get(name)
      if (!chunk) {
        throw new Error(`Unknown emitted module: ${name}`)
      }
      const module = { exports: {} }
      cache.set(name, module)
      runInNewContext(chunk.code, {
        module,
        exports: module.exports,
        events,
        // chunk 文件名是 bundler 逻辑路径，不是宿主文件系统路径。
        require: (id: string) => evaluate(path.posix.normalize(path.posix.join(path.posix.dirname(name), id))),
      })
      return module.exports
    }
    const entry = [...chunks.values()].find(chunk => chunk.facadeModuleId === 'virtual:entry')
    expect(entry).toBeDefined()
    return { entry: evaluate(entry!.fileName) as EntryExports, events, chunks }
  }
  finally {
    await build.close()
  }
}

it('executes split dynamic imports through host require while preserving lazy evaluation and shared state', async () => {
  const { entry, events, chunks } = await createSplitChunkHost()
  expect(entry.state.value).toBe(7)
  expect(events).toEqual([])
  const pending = entry.load()
  expect(events).toEqual([])
  const lazy = await pending
  expect(lazy.default()).toBe(21)
  expect(events).toEqual(['lazy evaluated'])
  entry.state.value = 8
  const again = await entry.load()
  expect(again.default()).toBe(24)
  expect(events).toEqual(['lazy evaluated'])
  expect(chunks.size).toBeGreaterThan(2)
  const lazyChunk = [...chunks.values()].find(chunk => chunk.facadeModuleId === 'virtual:lazy')
  expect(lazyChunk?.map?.sourcesContent).toEqual(expect.arrayContaining([expect.stringContaining('lazy evaluated')]))
})

it('rejects the returned promise when a dynamic chunk fails to evaluate', async () => {
  const { entry, events } = await createSplitChunkHost()
  let pending: Promise<unknown> | undefined
  expect(() => {
    pending = entry.loadBroken()
  }).not.toThrow()
  expect(pending).toBeDefined()
  await expect(pending).rejects.toThrow('lazy evaluation failed')
  expect(events).toEqual([])
})
