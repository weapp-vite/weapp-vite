import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'pathe'
import { describe, expect, it, vi } from 'vitest'
import { createViteResolverAdapter } from './viteResolverAdapter'

describe('createViteResolverAdapter', () => {
  it('loads code for resolved ids and skips virtual/node ids', async () => {
    const adapter = createViteResolverAdapter(
      {
        resolve: async (source) => {
          if (source === 'a') {
            return { id: '/abs/a.ts?import' }
          }
          if (source === 'virtual') {
            return { id: '\0virtual:dep' }
          }
          return null
        },
      },
      {
        readFile: async (id) => {
          if (id === '/abs/a.ts') {
            return 'ok'
          }
          throw new Error('未预期的情况')
        },
      },
      { checkMtime: false },
    )

    await expect(adapter.resolveId('a')).resolves.toBe('/abs/a.ts?import')
    await expect(adapter.loadCode('/abs/a.ts?import')).resolves.toBe('ok')
    await expect(adapter.loadCode('\0virtual:dep')).resolves.toBeUndefined()
    await expect(adapter.loadCode('node:fs')).resolves.toBeUndefined()
  })

  it('resolves explicit relative files before delegating to Vite resolver', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'weapp-vite-resolver-'))
    try {
      const distDir = path.join(root, 'packages-runtime/wevu/dist')
      const importer = path.join(distDir, 'router.mjs')
      const chunk = path.join(distDir, 'base-D-o2Hv6z.mjs')
      await mkdir(distDir, { recursive: true })
      await writeFile(importer, 'import "./base-D-o2Hv6z.mjs"\n', 'utf8')
      await writeFile(chunk, 'export {}\n', 'utf8')

      const resolve = vi.fn(async () => {
        throw new Error('Tsconfig not found apps/hmr-lab/.weapp-vite/tsconfig.shared.json')
      })
      const adapter = createViteResolverAdapter(
        { resolve },
        {
          readFile: async (id) => {
            if (id === chunk) {
              return 'export {}\n'
            }
            throw new Error('未预期的情况')
          },
        },
      )

      await expect(adapter.resolveId('./base-D-o2Hv6z.mjs', importer)).resolves.toBe(chunk)
      await expect(adapter.loadCode(chunk)).resolves.toBe('export {}\n')
      expect(resolve).not.toHaveBeenCalled()
    }
    finally {
      await rm(root, { recursive: true, force: true })
    }
  })
})
