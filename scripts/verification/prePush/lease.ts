import { randomUUID } from 'node:crypto'
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'

/** 同一工作树的 pre-push 验证串行；不推测或删除其他进程的遗留所有权。 */
export async function withPushLease<T>(root: string, work: () => Promise<T>): Promise<T> {
  const parent = path.join(root, '.tmp/verification/pre-push')
  const directory = path.join(parent, 'active')
  await mkdir(parent, { recursive: true })
  try {
    await mkdir(directory)
  }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'EEXIST') {
      throw new Error('已有 pre-push 验证或未完成的所有权记录；请确认 .tmp/verification/pre-push/active 的原任务状态')
    }
    throw error
  }
  const owner = JSON.stringify({ id: randomUUID(), pid: process.pid })
  const file = path.join(directory, 'owner.json')
  await writeFile(file, owner, { flag: 'wx' })
  const failures: unknown[] = []
  let result!: T
  try {
    result = await work()
  }
  catch (error) {
    failures.push(error)
  }
  try {
    if (await readFile(file, 'utf8') !== owner) {
      throw new Error('pre-push 所有权已变化，拒绝释放其他任务的记录')
    }
    await rm(directory, { recursive: true })
  }
  catch (error) {
    failures.push(error)
  }
  if (failures.length > 1) {
    throw new AggregateError(failures, 'pre-push 失败且串行所有权未完成释放')
  }
  if (failures.length) {
    throw failures[0]
  }
  return result
}
