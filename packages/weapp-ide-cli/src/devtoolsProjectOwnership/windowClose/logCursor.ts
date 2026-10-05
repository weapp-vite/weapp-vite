import type { FileHandle } from 'node:fs/promises'
import type { ManagedWechatWindowLogCursor } from '../types'
import { Buffer } from 'node:buffer'
import { createHash } from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'

const readLimit = 2 * 1024 * 1024
const scanChunkSize = 64 * 1024
const headerLimit = 4096
const emptyAnchor = createHash('sha256').digest('hex')

export const legacyLogInventoryFailure = 'Managed DevTools window-close log set changed; host generation or log rotation is unresolved.'

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

async function openLogFile(directory: string, name: string) {
  const filename = path.join(directory, name)
  const before = await fs.lstat(filename)
  if (!before.isFile()) {
    throw new Error('Managed DevTools window-close log must be a regular file without redirection.')
  }
  const file = await fs.open(filename, 'r')
  try {
    const after = await file.stat()
    if (!after.isFile() || identity(after) !== identity(before)) {
      throw new Error('Managed DevTools window-close log changed while opening its evidence stream.')
    }
    return file
  }
  catch (error) {
    await file.close()
    throw error
  }
}

/** 主进程日志汇聚多个来源，轮转后的首条记录可能来自 BACKEND；只识别固定偏移内的完整行。 */
async function hasMainRecord(file: FileHandle, size: number, productVersion: string) {
  // 只保留有限行首并等待换行，长日志消息不会累积到内存，也不能把未完成的尾行当作证据。
  const prefix = Buffer.alloc(headerLimit)
  let prefixSize = 0
  for (let offset = 0; offset < size;) {
    const bytes = await readBytes(file, offset, Math.min(size - offset, scanChunkSize))
    if (!bytes.length) {
      return false
    }
    offset += bytes.length
    for (let start = 0; start < bytes.length;) {
      const newline = bytes.indexOf(10, start)
      const end = newline < 0 ? bytes.length : newline
      prefixSize += bytes.copy(prefix, prefixSize, start, Math.min(end, start + headerLimit - prefixSize))
      if (newline < 0) {
        break
      }
      const line = prefix.toString('utf8', 0, prefixSize)
      if (/^\[[^\]\r\n]+\]\[[A-Z]+\]\[([^\]\r\n]+)\]\[MAIN\]/.exec(line)?.[1] === productVersion) {
        return true
      }
      prefixSize = 0
      start = newline + 1
    }
  }
  return false
}

function requireUniqueMain(cursors: ManagedWechatWindowLogCursor[]) {
  if (cursors.length !== 1) {
    throw new Error('Managed DevTools window-close evidence requires one unambiguous MAIN log for the selected product version.')
  }
  return cursors
}

/** 只接受已核验主进程持有的同一常规文件，不按名称或历史日志内容猜测。 */
export async function captureActiveLogCursor(directory: string, active: { name: string, identity: string }): Promise<ManagedWechatWindowLogCursor[]> {
  if (!/^[^/\\]+\.log$/.test(active.name)) {
    throw new Error('Managed DevTools active log must belong to the selected log directory.')
  }
  const file = await openLogFile(directory, active.name)
  try {
    const stat = await file.stat()
    if (identity(stat) !== active.identity) {
      throw new Error('Managed DevTools active log changed before its close cursor was captured.')
    }
    const last = stat.size ? await readBytes(file, stat.size - 1, 1) : undefined
    return [{ name: active.name, identity: identity(stat), offset: stat.size, anchor: await anchorAt(file, stat.size), skipPartialLine: last !== undefined && last[0] !== 10 }]
  }
  finally {
    await file.close()
  }
}

async function validateCursor(file: FileHandle, cursor: ManagedWechatWindowLogCursor) {
  const stat = await file.stat()
  if (!stat.isFile() || identity(stat) !== cursor.identity || stat.size < cursor.offset || await anchorAt(file, cursor.offset) !== cursor.anchor) {
    throw new Error('Managed DevTools window-close log was replaced, truncated, or rewritten; destruction evidence is unresolved.')
  }
  return stat
}

/** 关闭前固定唯一 MAIN 流；辅助日志和历史空日志不属于窗口销毁证据。 */
export async function captureLogCursors(directory: string, productVersion: string): Promise<ManagedWechatWindowLogCursor[]> {
  const cursors: ManagedWechatWindowLogCursor[] = []
  for (const name of await logFiles(directory)) {
    const file = await openLogFile(directory, name)
    try {
      const stat = await file.stat()
      if (!await hasMainRecord(file, stat.size, productVersion)) {
        continue
      }
      const last = stat.size ? await readBytes(file, stat.size - 1, 1) : undefined
      cursors.push({ name, identity: identity(stat), offset: stat.size, anchor: await anchorAt(file, stat.size), skipPartialLine: last !== undefined && last[0] !== 10 })
    }
    finally {
      await file.close()
    }
  }
  return requireUniqueMain(cursors)
}

/** 旧整目录门禁只能从原游标收窄；非空证据丢失或新文件均不能补充候选。 */
export async function recoverLogCursors(directory: string, cursors: ManagedWechatWindowLogCursor[], productVersion: string) {
  const main: ManagedWechatWindowLogCursor[] = []
  for (const cursor of cursors) {
    let file: FileHandle
    try {
      file = await openLogFile(directory, cursor.name)
    }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT' && cursor.offset === 0 && cursor.anchor === emptyAnchor && !cursor.skipPartialLine) {
        continue
      }
      throw error
    }
    try {
      await validateCursor(file, cursor)
      if (await hasMainRecord(file, cursor.offset, productVersion)) {
        main.push({ ...cursor })
      }
    }
    finally {
      await file.close()
    }
  }
  return requireUniqueMain(main)
}

/** 仅消费完整新增行；文件更换、截断或无法衔接的轮转均保持未解决状态。 */
export async function readFreshLogLines(directory: string, cursors: ManagedWechatWindowLogCursor[]) {
  const lines: { fileIdentity: string, line: string }[] = []
  for (const cursor of cursors) {
    const file = await openLogFile(directory, cursor.name)
    try {
      const stat = await validateCursor(file, cursor)
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
