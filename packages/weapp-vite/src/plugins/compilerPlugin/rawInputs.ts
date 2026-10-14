import type { BigIntStats } from 'node:fs'
import { createHash } from 'node:crypto'
import { lstatSync, readFileSync, statSync } from 'node:fs'
import { CompilerHmrResyncError } from '@weapp-vite/hmr'
import path from 'pathe'
import { normalizeFsResolvedId } from '../../utils/resolvedId'

export interface CompilerRawRead {
  readonly source: string
  readonly digest: string
  readonly byteLength: number
  readonly version: string
}

export interface CompilerRawBinding {
  readonly target: string
  readonly links: ReadonlyMap<string, string>
}

export function compilerRawFileVersion(stat: BigIntStats): string {
  return `${stat.mtimeNs}:${stat.ctimeNs}:${stat.ino}:${stat.size}`
}

/** 同一次字节读取生成文本及不可变摘要，不长期持有二进制副本。 */
export function readCompilerRawInput(file: string): CompilerRawRead | null {
  try {
    const before = compilerRawFileVersion(statSync(file, { bigint: true }))
    const bytes = readFileSync(file)
    const version = compilerRawFileVersion(statSync(file, { bigint: true }))
    if (before !== version) {
      throw new CompilerHmrResyncError([file], 'Raw compiler input changed during its read')
    }
    return Object.freeze({ source: bytes.toString('utf8'), digest: createHash('sha256').update(bytes).digest('hex'), byteLength: bytes.byteLength, version })
  }
  catch (error) {
    if (['ENOENT', 'ENOTDIR'].includes((error as NodeJS.ErrnoException).code ?? '')) {
      return null
    }
    throw error
  }
}

/** 只记录实际观察的非同一路径 alias，普通 canonical 输入不增加路径探测。 */
export function captureCompilerRawBinding(file: string, target: string): CompilerRawBinding {
  const links = new Map<string, string>()
  let current = normalizeFsResolvedId(file)
  if (current !== target) {
    while (true) {
      try {
        const stat = lstatSync(current, { bigint: true })
        if (stat.isSymbolicLink()) {
          links.set(current, compilerRawFileVersion(stat))
        }
      }
      catch (error) {
        if (!['ENOENT', 'ENOTDIR'].includes((error as NodeJS.ErrnoException).code ?? '')) {
          throw error
        }
      }
      const parent = path.dirname(current)
      if (parent === current) {
        break
      }
      current = parent
    }
  }
  return Object.freeze({ target, links })
}
