import type { VerificationTask } from './types.ts'
import { Buffer } from 'node:buffer'

/** 为跨平台启动器保留转义余量，静态检查分批时不丢失任何文件。 */
export function createFileCheckTasks(kind: 'lint' | 'stylelint', files: string[]): VerificationTask[] {
  const prefix = kind === 'lint' ? ['exec', 'eslint', '--no-warn-ignored'] : ['exec', 'stylelint']
  const cost = (argument: string) => Buffer.byteLength(JSON.stringify(argument)) + 1
  const limit = 4_096
  const overhead = prefix.reduce((sum, argument) => sum + cost(argument), cost('pnpm'))
  const batches: string[][] = []
  let batch: string[] = []
  let size = overhead
  for (const file of files) {
    const length = cost(file)
    if (overhead + length > limit) {
      throw new Error(`静态检查文件路径超出单次参数预算: ${file}`)
    }
    if (size + length > limit) {
      batches.push(batch)
      batch = []
      size = overhead
    }
    batch.push(file)
    size += length
  }
  if (batch.length) {
    batches.push(batch)
  }
  return batches.map((files, index) => ({
    id: index === 0 ? kind : `${kind}:batch:${index + 1}`,
    kind,
    command: 'pnpm',
    args: [...prefix, ...files],
    directory: '.',
    dependencies: [],
    reason: kind === 'lint' ? '分批检查实际变更且仍存在的文件' : '分批检查独立样式及 Vue style block',
  }))
}
