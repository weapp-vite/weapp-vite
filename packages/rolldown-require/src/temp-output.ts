import type { InternalOptions } from './types'
import { Buffer } from 'node:buffer'
import fsp from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { pathToFileURL } from 'node:url'
import { defaultGetOutputFile } from './config'
import { findNearestNodeModules } from './packages'

export interface TempOutput {
  outfile: string
  cleanup: () => Promise<void>
  cacheMeta?: {
    format: 'cjs' | 'esm'
    codePath: string
    files: { path: string, mtimeMs: number, size: number }[]
  }
}

export function sanitizeFilename(name: string): string {
  return name.replace(/[^\w.-]/g, '_')
}

export async function resolveTempOutputFile(
  sourceFile: string,
  code: string,
  options: InternalOptions,
): Promise<TempOutput> {
  const getOutputFile = options.getOutputFile || defaultGetOutputFile
  const filenameHint = sanitizeFilename(path.basename(sourceFile))
  const hash = `timestamp-${Date.now()}-${Math.random().toString(16).slice(2)}`
  const extension = options.format === 'cjs' ? 'cjs' : 'mjs'
  const fileName = `${filenameHint}.${hash}.${extension}`
  const candidates: string[] = []

  if (typeof process.versions.deno !== 'string') {
    const nearest = findNearestNodeModules(path.dirname(sourceFile))
    if (nearest) {
      candidates.push(path.resolve(nearest, '.rolldown-require'))
    }
  }
  candidates.push(path.join(os.tmpdir(), 'rolldown-require'))

  for (const base of candidates) {
    const target = getOutputFile(path.join(base, fileName), options.format)
    try {
      await fsp.mkdir(path.dirname(target), { recursive: true })
      await fsp.writeFile(target, code)
      const cleanup = async () => {
        if (options.preserveTemporaryFile) {
          return
        }
        try {
          await fsp.unlink(target)
        }
        catch {
          // best-effort cleanup
        }
      }
      return {
        outfile: options.format === 'esm' ? pathToFileURL(target).href : target,
        cleanup,
      }
    }
    catch {
      // try next candidate
    }
  }

  if (options.format === 'esm') {
    const dataUrl = `data:text/javascript;base64,${Buffer.from(code).toString('base64')}`
    return {
      outfile: dataUrl,
      cleanup: async () => {},
    }
  }

  throw new Error('Failed to create temporary output file for bundled code')
}
