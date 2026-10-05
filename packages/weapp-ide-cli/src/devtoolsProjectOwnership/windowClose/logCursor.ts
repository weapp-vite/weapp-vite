import type { FileHandle } from 'node:fs/promises'
import type { ManagedWechatWindowLogCursor } from '../types'
import { Buffer } from 'node:buffer'
import { createHash } from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'

const readLimit = 2 * 1024 * 1024

export async function selectedLogDirectory(profileDir: string) {
  const selected = await fs.realpath(profileDir)
  const directory = path.join(selected, 'WeappLog', 'logs')
  if (await fs.realpath(directory) !== directory) {
    throw new Error('Managed DevTools window-close logs must belong to the selected profile without redirected log directories.')
  }
  return directory
}

async function logFiles(directory: string) {
  const entries = (await fs.readdir(directory, { withFileTypes: true })).filter(entry => entry.name.endsWith('.log'))
  if (!entries.length || entries.some(entry => !entry.isFile())) {
    throw new Error('Managed DevTools window-close evidence requires regular logs in the selected profile.')
  }
  return entries.map(entry => entry.name).sort()
}

function identity(stat: { dev: number, ino: number }) {
  return `${stat.dev}:${stat.ino}`
}

async function readBytes(file: FileHandle, offset: number, size: number) {
  const buffer = Buffer.alloc(size)
  const { bytesRead } = await file.read(buffer, 0, size, offset)
  return buffer.subarray(0, bytesRead)
}

async function anchorAt(file: FileHandle, offset: number) {
  const start = Math.max(0, offset - 256)
  return createHash('sha256').update(await readBytes(file, start, offset - start)).digest('hex')
}

/** 游标在关闭前捕获；旧日志和未完成的旧行不能成为本次关闭的证据。 */
export async function captureLogCursors(directory: string): Promise<ManagedWechatWindowLogCursor[]> {
  const cursors: ManagedWechatWindowLogCursor[] = []
  for (const name of await logFiles(directory)) {
    const file = await fs.open(path.join(directory, name), 'r')
    try {
      const stat = await file.stat()
      if (!stat.isFile()) {
        throw new Error('Managed DevTools window-close log is not a regular file.')
      }
      const last = stat.size ? await readBytes(file, stat.size - 1, 1) : undefined
      cursors.push({ name, identity: identity(stat), offset: stat.size, anchor: await anchorAt(file, stat.size), skipPartialLine: last !== undefined && last[0] !== 10 })
    }
    finally {
      await file.close()
    }
  }
  return cursors
}

/** 仅消费完整新增行；文件更换、截断或无法衔接的轮转均保持未解决状态。 */
export async function readFreshLogLines(directory: string, cursors: ManagedWechatWindowLogCursor[]) {
  const names = await logFiles(directory)
  if (names.length !== cursors.length || names.some((name, index) => name !== cursors[index]?.name)) {
    throw new Error('Managed DevTools window-close log set changed; host generation or log rotation is unresolved.')
  }
  const lines: { fileIdentity: string, line: string }[] = []
  for (const cursor of cursors) {
    const file = await fs.open(path.join(directory, cursor.name), 'r')
    try {
      const stat = await file.stat()
      if (!stat.isFile() || identity(stat) !== cursor.identity || stat.size < cursor.offset || await anchorAt(file, cursor.offset) !== cursor.anchor) {
        throw new Error('Managed DevTools window-close log was replaced, truncated, or rewritten; destruction evidence is unresolved.')
      }
      const bytes = await readBytes(file, cursor.offset, Math.min(stat.size - cursor.offset, readLimit))
      const end = bytes.lastIndexOf(10)
      if (end < 0) {
        if (bytes.length === readLimit) {
          throw new Error('Managed DevTools window-close log line exceeds the supported evidence limit.')
        }
        continue
      }
      const complete = bytes.subarray(0, end + 1).toString('utf8').split(/\r?\n/)
      complete.pop()
      if (cursor.skipPartialLine) {
        complete.shift()
        cursor.skipPartialLine = false
      }
      lines.push(...complete.map(line => ({ fileIdentity: cursor.identity, line })))
      cursor.offset += end + 1
      cursor.anchor = await anchorAt(file, cursor.offset)
    }
    finally {
      await file.close()
    }
  }
  return lines
}
