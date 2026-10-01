import { Buffer } from 'node:buffer'
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'

export type OutputSnapshot = Record<string, string>

function resolveOutput(outDir: string, file: string) {
  if (!file || path.isAbsolute(file) || file.includes('\\') || file.split('/').some(part => !part || part === '.' || part === '..') || /^[a-z]:/i.test(file)) {
    throw new Error(`Cache paths must be relative emitted files: ${file}`)
  }
  return path.join(outDir, file)
}

/** 外部缓存集成示例：仅撤销已登记且字节仍属于本集成的文件，绝不清空输出目录。 */
export async function retireOwnedOutputs(outDir: string, previous: OutputSnapshot, next: OutputSnapshot) {
  for (const [file, bytes] of Object.entries(previous)) {
    if (Object.hasOwn(next, file)) {
      continue
    }
    const target = resolveOutput(outDir, file)
    const current = await readFile(target).catch((error: NodeJS.ErrnoException) => {
      if (error.code === 'ENOENT') {
        return undefined
      }
      throw error
    })
    if (current && current.toString('base64') !== bytes) {
      throw new Error(`Output ownership changed before cleanup: ${file}`)
    }
    await rm(target, { force: true })
  }
}

/** 恢复内容来自先前原生 build 的快照；此函数属于缓存集成层，不参与构建器 emit/write。 */
export async function restoreOwnedOutputs(outDir: string, previous: OutputSnapshot, cached: OutputSnapshot) {
  // 先验证整个恢复集合，防止覆盖本集成没有登记的同名用户文件。
  for (const file of Object.keys(cached)) {
    const current = await readFile(resolveOutput(outDir, file)).catch((error: NodeJS.ErrnoException) => {
      if (error.code === 'ENOENT') {
        return undefined
      }
      throw error
    })
    if (current && current.toString('base64') !== previous[file]) {
      throw new Error(`Cache restore would overwrite unowned content: ${file}`)
    }
  }
  await retireOwnedOutputs(outDir, previous, cached)
  for (const [file, bytes] of Object.entries(cached)) {
    const target = resolveOutput(outDir, file)
    await mkdir(path.dirname(target), { recursive: true })
    await writeFile(target, Buffer.from(bytes, 'base64'))
  }
}
