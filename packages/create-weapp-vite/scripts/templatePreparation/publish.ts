import fs from 'node:fs/promises'
import path from 'node:path'
import { createOwner, ownerExited, readOwner } from './owner'

async function exists(file: string) {
  try {
    await fs.lstat(file)
    return true
  }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return false
    }
    throw error
  }
}

async function recoverInterruptedPublish(parent: string, destination: string, prefix: string) {
  for (const entry of await fs.readdir(parent, { withFileTypes: true })) {
    if (!entry.isDirectory() || !entry.name.startsWith(prefix)) {
      continue
    }
    const transaction = path.join(parent, entry.name)
    const owner = await readOwner(path.join(transaction, 'owner.json'), destination)
    if (!owner || !ownerExited(owner)) {
      continue
    }
    const previous = path.join(transaction, 'previous')
    if (await exists(previous) && !await exists(destination)) {
      await fs.rename(previous, destination)
    }
    await fs.rm(transaction, { recursive: true })
  }
}

/** 在准备锁内调用：先复制到同卷临时目录，再替换；异常恢复旧副本，中断备份可在下一次恢复。 */
export async function publishPreparedTemplates(staging: string, target: string): Promise<void> {
  const parent = await fs.realpath(path.dirname(path.resolve(target)))
  const destination = path.join(parent, path.basename(target))
  const prefix = `.${path.basename(destination)}.publish-`
  await recoverInterruptedPublish(parent, destination, prefix)
  const transaction = await fs.mkdtemp(path.join(parent, prefix))
  const next = path.join(transaction, 'next')
  const previous = path.join(transaction, 'previous')
  let preserveBackup = false
  let backedUp = false
  try {
    await fs.writeFile(path.join(transaction, 'owner.json'), JSON.stringify(createOwner(destination)))
    await fs.cp(staging, next, { recursive: true, errorOnExist: true, force: false })
    if (await exists(destination)) {
      await fs.rename(destination, previous)
      backedUp = true
    }
    try {
      await fs.rename(next, destination)
    }
    catch (cause) {
      if (backedUp) {
        try {
          await fs.rename(previous, destination)
        }
        catch (rollbackError) {
          preserveBackup = true
          throw new AggregateError([cause, rollbackError], `派生模板发布及回滚失败，旧完整副本保留在 ${previous}`)
        }
      }
      throw cause
    }
  }
  finally {
    if (!preserveBackup) {
      await fs.rm(transaction, { recursive: true })
    }
  }
}
