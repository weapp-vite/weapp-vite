import type { Buffer } from 'node:buffer'
import fs from 'node:fs'
import path from 'node:path'
import ts from 'typescript'

export type InventorySourceReader = (file: string) => ts.SourceFile

export function parseInventorySource(content: string, file: string) {
  return ts.createSourceFile(file, content, ts.ScriptTarget.Latest, true)
}

/** 单次清单操作内复用 AST；每次仍读取原始字节，不依赖时间戳或全局缓存。 */
export function createInventorySourceReader(root: string, parse = parseInventorySource): InventorySourceReader {
  const sources = new Map<string, { bytes: Buffer, source: ts.SourceFile }>()
  return (file) => {
    const normalized = path.posix.normalize(file.replaceAll('\\', '/'))
    const bytes = fs.readFileSync(path.join(root, normalized))
    const previous = sources.get(normalized)
    if (previous?.bytes.equals(bytes)) {
      return previous.source
    }
    const source = parse(bytes.toString('utf8'), normalized)
    sources.set(normalized, { bytes, source })
    return source
  }
}
