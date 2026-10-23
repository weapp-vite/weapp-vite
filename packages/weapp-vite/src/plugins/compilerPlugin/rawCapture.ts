import type { CompilerHmrHost } from './hmr'
import { statSync } from 'node:fs'
import { CompilerHmrResyncError } from './hmr'
import { readCompilerRawInput } from './rawInputs'

/** 所有文件字节捕获共用 raw owner；短暂缺失不能撤销仍存在的较新输入。 */
export function captureCompilerFileInput(host: CompilerHmrHost, id: string): void {
  let read: ReturnType<typeof readCompilerRawInput>
  try {
    read = readCompilerRawInput(id)
  }
  catch (error) {
    // Windows 读取目录可报 EPERM；只在失败后核验，不能吞掉普通文件的原错。
    try {
      if (statSync(id).isDirectory()) {
        return
      }
    }
    catch {
      // 核验失败仍保留最初的读取错误。
    }
    throw error
  }
  if (!read) {
    try {
      if (statSync(id).isDirectory()) {
        return
      }
    }
    catch (error) {
      if (!['ENOENT', 'ENOTDIR'].includes((error as NodeJS.ErrnoException).code ?? '')) {
        throw error
      }
      if (host.ownsRawSource(id)) {
        host.captureRaw(id, null, false)
      }
      else {
        host.capture(id, null)
      }
      return
    }
    throw new CompilerHmrResyncError([id], 'Compiler input reappeared during its read')
  }
  if (host.ownsRawSource(id)) {
    host.captureRaw(id, read.source, false, read)
  }
  else {
    // module loader 的既有归属保持不变，扫描器不能把它升级成 raw 输入。
    host.capture(id, read.source)
  }
}
