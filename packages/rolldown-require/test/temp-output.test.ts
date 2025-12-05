import fs from 'node:fs'
import fsp from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { loadFromBundledFile } from '@/index'

const tmpRoot = () => fsp.mkdtemp(path.join(os.tmpdir(), 'rolldown-require-temp-'))

const cleanupPaths: string[] = []

afterEach(async () => {
  // best-effort cleanup
  await Promise.allSettled(
    cleanupPaths.splice(0).map(target => fsp.rm(target, { recursive: true, force: true })),
  )
})

describe('temporary output handling (esm)', () => {
  it('prefers project node_modules/.rolldown-require and cleans up when not preserved', async () => {
    const projectRoot = await tmpRoot()
    cleanupPaths.push(projectRoot)
    const nodeModules = path.join(projectRoot, 'node_modules')
    await fsp.mkdir(nodeModules, { recursive: true })
    const sourceFile = path.join(projectRoot, 'entry.ts')

    const touched: string[] = []
    const { marker } = await loadFromBundledFile(
      sourceFile,
      'export const marker = "nm";',
      {
        isESM: true,
        format: 'esm',
        getOutputFile: (p) => {
          touched.push(p)
          return p
        },
      } as any,
    )

    expect(marker).toBe('nm')
    expect(touched[0]).toContain('.rolldown-require')
    expect(fs.existsSync(touched[0])).toBe(false) // cleaned up
  })

  it('falls back to os tmp when no node_modules and preserves file when requested', async () => {
    const root = await tmpRoot()
    cleanupPaths.push(root)
    const sourceFile = path.join(root, 'entry.ts')

    let outfile = ''
    const { marker } = await loadFromBundledFile(
      sourceFile,
      'export const marker = "tmp";',
      {
        isESM: true,
        format: 'esm',
        preserveTemporaryFile: true,
        getOutputFile: (p) => {
          outfile = p
          return p
        },
      } as any,
    )

    expect(marker).toBe('tmp')
    expect(outfile.startsWith(path.join(os.tmpdir(), 'rolldown-require'))).toBe(true)
    expect(fs.existsSync(outfile)).toBe(true)
    cleanupPaths.push(outfile)
  })

  it('falls back to data URL when writing temp files fails', async () => {
    const root = await tmpRoot()
    cleanupPaths.push(root)
    const sourceFile = path.join(root, 'entry.ts')

    const mkdirSpy = vi.spyOn(fsp, 'mkdir').mockResolvedValue(undefined as any)
    const writeSpy = vi.spyOn(fsp, 'writeFile').mockRejectedValue(new Error('deny'))

    try {
      const { marker } = await loadFromBundledFile(
        sourceFile,
        'export const marker = "data-url";',
        {
          isESM: true,
          format: 'esm',
        } as any,
      )
      expect(marker).toBe('data-url')
      expect(writeSpy).toHaveBeenCalled()
    }
    finally {
      mkdirSpy.mockRestore()
      writeSpy.mockRestore()
    }
  })
})
