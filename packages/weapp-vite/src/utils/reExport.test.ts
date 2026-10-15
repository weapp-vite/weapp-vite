import type { ReExportResolutionCache } from './reExport'
import { describe, expect, it, vi } from 'vitest'
import { resolveReExportedName } from './reExport'

describe('resolveReExportedName', () => {
  it('resolves direct re-export', async () => {
    const cache: ReExportResolutionCache = new Map()
    const readFile = vi.fn(async (file: string) => {
      if (file === '/a.ts') {
        return `export { default as Foo } from "./foo"\n`
      }
      throw new Error(`缺少：${file}`)
    })
    const resolveId = vi.fn(async (source: string, importer: string) => {
      expect(importer).toBe('/a.ts')
      if (source === './foo') {
        return '/foo.ts'
      }
      return undefined
    })

    await expect(resolveReExportedName('/a.ts', 'Foo', { cache, readFile, resolveId })).resolves.toBe('/foo.ts')
    await expect(resolveReExportedName('/a.ts', 'Foo', { cache, readFile, resolveId })).resolves.toBe('/foo.ts')
  })

  it('resolves via export * recursion', async () => {
    const cache: ReExportResolutionCache = new Map()
    const readFile = vi.fn(async (file: string) => {
      if (file === '/a.ts') {
        return `export * from "./b"\n`
      }
      if (file === '/b.ts') {
        return `export { default as Bar } from "./bar"\n`
      }
      throw new Error(`缺少：${file}`)
    })
    const resolveId = vi.fn(async (source: string, importer: string) => {
      if (importer === '/a.ts' && source === './b') {
        return '/b.ts'
      }
      if (importer === '/b.ts' && source === './bar') {
        return '/bar.ts'
      }
      return undefined
    })

    await expect(resolveReExportedName('/a.ts', 'Bar', { cache, readFile, resolveId })).resolves.toBe('/bar.ts')
  })

  it('supports oxc engine for direct re-export resolution', async () => {
    const cache: ReExportResolutionCache = new Map()
    const readFile = vi.fn(async (file: string) => {
      if (file === '/a.ts') {
        return `export { default as Foo } from "./foo"\n`
      }
      throw new Error(`缺少：${file}`)
    })
    const resolveId = vi.fn(async (source: string) => {
      if (source === './foo') {
        return '/foo.ts'
      }
      return undefined
    })

    await expect(resolveReExportedName('/a.ts', 'Foo', {
      astEngine: 'oxc',
      cache,
      readFile,
      resolveId,
    })).resolves.toBe('/foo.ts')
  })

  it('follows named forwarding through default barrels and terminates default cycles', async () => {
    const sources = new Map([
      ['/entry.ts', 'export { default as Child } from "/default.ts"'],
      ['/default.ts', 'export { default } from "/Leaf.vue"'],
    ])
    const options = {
      cache: new Map() as ReExportResolutionCache,
      readFile: async (file: string) => sources.get(file)!,
      resolveId: async (source: string) => source,
    }
    await expect(resolveReExportedName('/entry.ts', 'Child', options)).resolves.toBe('/Leaf.vue')
    sources.set('/default.ts', 'export { default } from "/cycle.ts"')
    sources.set('/cycle.ts', 'export { default } from "/default.ts"')
    await expect(resolveReExportedName('/entry.ts', 'Child', options)).resolves.toBeUndefined()
    sources.set('/default.ts', 'export { default } from "/Leaf.vue"')
    await expect(resolveReExportedName('/entry.ts', 'Child', options)).resolves.toBe('/Leaf.vue')
  })

  it('distinguishes named forwarding states within the same barrel from a cycle', async () => {
    const sources = new Map([
      ['/entry.ts', 'export { Inner as Child } from "/middle.ts"; export { default as Base } from "/Leaf.vue"'],
      ['/middle.ts', 'export { Base as Inner } from "/entry.ts"'],
    ])
    const options = {
      cache: new Map() as ReExportResolutionCache,
      readFile: async (file: string) => sources.get(file)!,
      resolveId: async (source: string) => source,
    }
    await expect(resolveReExportedName('/entry.ts', 'Child', options)).resolves.toBe('/Leaf.vue')
    sources.set('/middle.ts', 'export { Child as Inner } from "/entry.ts"')
    await expect(resolveReExportedName('/entry.ts', 'Child', options)).resolves.toBeUndefined()
    sources.set('/middle.ts', 'export { Missing as Inner } from "/entry.ts"')
    await expect(resolveReExportedName('/entry.ts', 'Child', options)).resolves.toBeUndefined()
  })

  it.each(['babel', 'oxc'] as const)('resolves a shorter named path after a depth-exhausted branch with %s', async (astEngine) => {
    const sources = new Map([
      ['/entry.ts', 'export * from "/long.ts"; export * from "/shared.ts"'],
      ['/long.ts', 'export * from "/hop.ts"'],
      ['/hop.ts', 'export * from "/shared.ts"'],
      ['/shared.ts', 'export { Inner as Child } from "/target.ts"'],
      ['/target.ts', 'export { default as Inner } from "/Leaf.vue"'],
    ])
    await expect(resolveReExportedName('/entry.ts', 'Child', {
      astEngine,
      cache: new Map(),
      readFile: async file => sources.get(file)!,
      resolveId: async source => source,
    })).resolves.toBe('/Leaf.vue')
  })
})
