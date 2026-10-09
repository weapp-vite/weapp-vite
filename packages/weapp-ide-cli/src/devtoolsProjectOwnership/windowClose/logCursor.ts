import type { FileHandle } from 'node:fs/promises'
import type { ManagedWechatWindowLogCursor } from '../types'
import { Buffer } from 'node:buffer'
import { createHash } from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'

const readLimit = 2 * 1024 * 1024
const scanLimit = 32 * 1024 * 1024
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

function identity(stat: { dev: bigint, ino: bigint }) {
  return `${stat.dev}:${stat.ino}`
}

/** 文件身份保留完整整数；只有已核验范围的字节位置才能交给 Node 读取 API。 */
function logSize(stat: { size: bigint }) {
  if (stat.size < 0n || stat.size > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new Error('Managed DevTools window-close log size exceeds the supported safe integer range.')
  }
  return Number(stat.size)
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

async function anchorAfterBytes(file: FileHandle, offset: number, bytes: Buffer) {
  const before = Math.min(offset, Math.max(0, 256 - bytes.length))
  const prefix = before ? await readBytes(file, offset - before, before) : Buffer.alloc(0)
  return createHash('sha256').update(prefix).update(bytes.subarray(Math.max(0, bytes.length - 256))).digest('hex')
}

async function openLogFile(directory: string, name: string) {
  const filename = path.join(directory, name)
  const before = await fs.lstat(filename, { bigint: true })
  if (!before.isFile()) {
    throw new Error('Managed DevTools window-close log must be a regular file without redirection.')
  }
  const file = await fs.open(filename, 'r')
  try {
    const after = await file.stat({ bigint: true })
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
    const stat = await file.stat({ bigint: true })
    if (identity(stat) !== active.identity) {
      throw new Error('Managed DevTools active log changed before its close cursor was captured.')
    }
    const size = logSize(stat)
    const last = size ? await readBytes(file, size - 1, 1) : undefined
    return [{ name: active.name, identity: identity(stat), offset: size, anchor: await anchorAt(file, size), skipPartialLine: last !== undefined && last[0] !== 10 }]
  }
  finally {
    await file.close()
  }
}

async function validateCursor(file: FileHandle, cursor: ManagedWechatWindowLogCursor) {
  if (!Number.isSafeInteger(cursor.offset) || cursor.offset < 0) {
    throw new Error('Managed DevTools window-close log cursor offset exceeds the supported safe integer range.')
  }
  const stat = await file.stat({ bigint: true })
  const size = logSize(stat)
  if (!stat.isFile() || identity(stat) !== cursor.identity || size < cursor.offset || await anchorAt(file, cursor.offset) !== cursor.anchor) {
    throw new Error('Managed DevTools window-close log was replaced, truncated, or rewritten; destruction evidence is unresolved.')
  }
  return size
}

/** 关闭前固定唯一 MAIN 流；辅助日志和历史空日志不属于窗口销毁证据。 */
export async function captureLogCursors(directory: string, productVersion: string): Promise<ManagedWechatWindowLogCursor[]> {
  const cursors: ManagedWechatWindowLogCursor[] = []
  for (const name of await logFiles(directory)) {
    const file = await openLogFile(directory, name)
    try {
      const stat = await file.stat({ bigint: true })
      const size = logSize(stat)
      if (!await hasMainRecord(file, size, productVersion)) {
        continue
      }
      const last = size ? await readBytes(file, size - 1, 1) : undefined
      cursors.push({ name, identity: identity(stat), offset: size, anchor: await anchorAt(file, size), skipPartialLine: last !== undefined && last[0] !== 10 })
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

/** 固定本轮所有流的终点并逐块消费；未完成的新增尾行、文件替换或截断均不能提前证明关闭成功。 */
export async function consumeFreshLogLines(directory: string, cursors: ManagedWechatWindowLogCursor[], consume: (input: { fileIdentity: string, line: string }) => void) {
  const streams: { file: FileHandle, cursor: ManagedWechatWindowLogCursor, original: ManagedWechatWindowLogCursor, end: number }[] = []
  let pending = 0
  let drained = true
  try {
    for (const cursor of cursors) {
      const file = await openLogFile(directory, cursor.name)
      const stream = { file, cursor, original: { ...cursor }, end: cursor.offset }
      streams.push(stream)
      stream.end = await validateCursor(file, cursor)
      pending += stream.end - cursor.offset
      if (pending > scanLimit) {
        throw new Error('Managed DevTools window-close log backlog exceeds the supported evidence limit.')
      }
    }
    for (const { file, cursor, end } of streams) {
      while (cursor.offset < end) {
        const size = Math.min(end - cursor.offset, readLimit)
        const bytes = await readBytes(file, cursor.offset, size)
        if (bytes.length !== size) {
          throw new Error('Managed DevTools window-close log became shorter during its evidence read.')
        }
        const newline = bytes.lastIndexOf(10)
        if (newline < 0) {
          if (bytes.length === readLimit) {
            throw new Error('Managed DevTools window-close log line exceeds the supported evidence limit.')
          }
          drained = false
          break
        }
        const anchor = await anchorAfterBytes(file, cursor.offset, bytes.subarray(0, newline + 1))
        for (let start = 0; start <= newline;) {
          const lineEnd = bytes.indexOf(10, start)
          if (cursor.skipPartialLine) {
            cursor.skipPartialLine = false
          }
          else {
            const textEnd = bytes[lineEnd - 1] === 13 ? lineEnd - 1 : lineEnd
            consume({ fileIdentity: cursor.identity, line: bytes.toString('utf8', start, textEnd) })
          }
          start = lineEnd + 1
        }
        cursor.offset += newline + 1
        cursor.anchor = anchor
      }
    }
    for (const { file, cursor, original, end } of streams) {
      await validateCursor(file, original)
      await validateCursor(file, cursor)
      const stat = await fs.lstat(path.join(directory, cursor.name), { bigint: true })
      if (!stat.isFile() || identity(stat) !== cursor.identity || logSize(stat) < end) {
        throw new Error('Managed DevTools window-close log changed while reading its evidence stream.')
      }
    }
    return drained
  }
  finally {
    await Promise.all(streams.map(({ file }) => file.close()))
  }
}
