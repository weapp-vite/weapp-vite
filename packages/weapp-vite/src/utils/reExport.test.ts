import { describe, expect, it, vi } from 'vitest'
import { resolveReExportedName } from './reExport'

describe('resolveReExportedName', () => {
  it('resolves direct re-export', async () => {
    const cache = new Map<string, Map<string, string | undefined>>()
    const readFile = vi.fn(async (file: string) => {
      if (file === '/a.ts') {
        return `export { default as Foo } from "./foo"\n`
      }
      throw new Error(`missing: ${file}`)
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
    expect(readFile).toHaveBeenCalledTimes(1)
  })

  it('resolves via export * recursion', async () => {
    const cache = new Map<string, Map<string, string | undefined>>()
    const readFile = vi.fn(async (file: string) => {
      if (file === '/a.ts') {
        return `export * from "./b"\n`
      }
      if (file === '/b.ts') {
        return `export { default as Bar } from "./bar"\n`
      }
      throw new Error(`missing: ${file}`)
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
})
