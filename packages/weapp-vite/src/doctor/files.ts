import type { DoctorFile } from './types'
import { createHash } from 'node:crypto'
import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'

const excluded = new Set(['node_modules', '.git', '.weapp-vite', '.codex-tmp', 'dist', 'coverage'])

/** 不跟随符号链接；快照只包含所选目录内的普通文件。 */
export async function readDoctorFiles(root: string, source = false): Promise<DoctorFile[]> {
  const result: DoctorFile[] = []
  async function visit(directory: string) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      if (entry.isSymbolicLink()) {
        throw new Error('扫描范围含符号链接，无法证明覆盖完整')
      }
      const absolute = path.join(directory, entry.name)
      if (entry.isDirectory()) {
        if (!source || !excluded.has(entry.name)) {
          await visit(absolute)
        }
      }
      else if (entry.isFile()) {
        const bytes = await readFile(absolute)
        result.push({
          path: path.relative(root, absolute).split(path.sep).join('/'),
          size: bytes.length,
          sha256: createHash('sha256').update(bytes).digest('hex'),
          text: /\.(?:json|[cm]?[jt]sx?|vue|wxml|axml|swan|ttml|jxml|wxss|acss|css|wxs|sjs)$/.test(entry.name) ? bytes.toString('utf8') : undefined,
        })
      }
    }
  }
  await visit(root)
  return result.sort((a, b) => a.path.localeCompare(b.path))
}

export function objectValue(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined
}

export function parseObject(text?: string): Record<string, unknown> {
  const value = text === undefined ? undefined : objectValue(JSON.parse(text))
  if (!value) {
    throw new Error('需要 JSON 对象')
  }
  return value
}
