import type { Evidence } from './contract'
import { createHash } from 'node:crypto'
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

export const sha256 = (value: string | Uint8Array) => createHash('sha256').update(value).digest('hex')
const textExtensions = /\.(?:js|mjs|cjs|json|map|wxml|wxss|wxs|css|html)$/i

/** 摘要必须可由实际文件清单重算，空对象与伪造摘要不构成产物证据。 */
export function isArtifactEvidence(value: unknown): value is Evidence {
  if (!value || typeof value !== 'object') {
    return false
  }
  const row = value as Partial<Evidence>
  if (!row.files || typeof row.files !== 'object' || Array.isArray(row.files) || !Number.isInteger(row.maps) || Number(row.maps) <= 0) {
    return false
  }
  const files = Object.entries(row.files)
  return files.length > 0 && Boolean(row.files['app.json']) && files.some(([file]) => file.endsWith('.js'))
    && files.filter(([file]) => file.endsWith('.map')).length === row.maps
    && files.every(([file, hash]) => file.length > 0 && !path.isAbsolute(file) && !file.includes('\\') && !file.split('/').includes('..') && /^[a-f\d]{64}$/.test(hash))
    && row.digest === sha256(JSON.stringify(Object.fromEntries(files.sort(([a], [b]) => a.localeCompare(b)))))
}

export function normalizeRoots(value: string, roots: string[]) {
  let result = value
  for (const root of [...roots].sort((a, b) => b.length - a.length)) {
    for (const variant of new Set([root, root.replaceAll('\\', '/'), root.replaceAll('\\', '\\\\')])) {
      result = result.replaceAll(variant, '<workspace>')
    }
  }
  return result
}

function canonical(value: unknown, roots: string[]): unknown {
  if (typeof value === 'string') {
    return normalizeRoots(value, roots)
  }
  if (Array.isArray(value)) {
    return value.map(child => canonical(child, roots))
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, child]) => [key, canonical(child, roots)]))
  }
  return value
}

/** 仅规范工作目录与 JSON 键序；不删除 helper、hash、映射位置或 HMR 协议字段。 */
export async function captureArtifacts(directory: string, roots: string[] = [], sourceMapsDirectory?: string): Promise<Evidence> {
  const files: Record<string, string> = {}
  let maps = 0
  const entries = await readdir(directory, { recursive: true, withFileTypes: true })
  for (const entry of entries) {
    if (!entry.isFile()) {
      continue
    }
    const file = path.join(entry.parentPath, entry.name)
    const relative = path.relative(directory, file).replaceAll('\\', '/')
    const bytes = await readFile(file)
    if (sourceMapsDirectory && relative.endsWith('.map')) {
      const retained = path.join(sourceMapsDirectory, relative)
      await mkdir(path.dirname(retained), { recursive: true })
      await writeFile(retained, bytes)
    }
    let content: string | Uint8Array = bytes
    if (textExtensions.test(relative)) {
      content = normalizeRoots(bytes.toString('utf8'), roots)
      if (/\.(?:json|map)$/.test(relative)) {
        content = JSON.stringify(canonical(JSON.parse(content) as unknown, roots))
      }
      if (relative.endsWith('.map')) {
        const map = JSON.parse(content) as Record<string, unknown>
        if (map.version !== 3 || !Array.isArray(map.sources) || typeof map.mappings !== 'string') {
          throw new Error(`Invalid emitted sourcemap: ${relative}`)
        }
        maps++
      }
    }
    files[relative] = sha256(content)
  }
  if (!files['app.json'] || !Object.keys(files).some(file => file.endsWith('.js'))) {
    throw new Error('Missing executable mini-program outputs')
  }
  const sorted = Object.fromEntries(Object.entries(files).sort(([a], [b]) => a.localeCompare(b)))
  return { files: sorted, digest: sha256(JSON.stringify(sorted)), maps }
}

/** 保存完整警告段落；只去除终端颜色及当前工作目录，不移除诊断内容。 */
export function warningEvidence(log: string, roots: string[] = []) {
  // eslint-disable-next-line no-control-regex -- 仅移除 CLI 输出中的 ANSI 控制序列。
  const lines = normalizeRoots(log.replaceAll(/\u001B\[[\d;]*m/g, ''), roots).split(/\r?\n/)
  const blocks: string[] = []
  let current: string[] | undefined
  for (const line of lines) {
    if (/warn(?:ing)?|deprecat|⚠/i.test(line)) {
      if (current) {
        blocks.push(current.join('\n'))
      }
      current = [line.trimEnd()]
    }
    else if (current && /^\s+\S/.test(line)) {
      current.push(line.trimEnd())
    }
    else if (current) {
      blocks.push(current.join('\n'))
      current = undefined
    }
  }
  if (current) {
    blocks.push(current.join('\n'))
  }
  return blocks.sort()
}
