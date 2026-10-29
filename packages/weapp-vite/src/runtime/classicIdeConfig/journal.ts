import { randomUUID } from 'node:crypto'
import fsNative from 'node:fs/promises'
import process from 'node:process'
import { isDeepStrictEqual } from 'node:util'
import { fs } from '@weapp-core/shared/fs'
import path from 'pathe'
import { assertIdeAssetHandoff } from './assetLease'
import { formatIdeConfig, parseIdeConfig, readIdeConfig, restoreRequestedHotReload } from './document'
import { classicIdeConfigLeasePath } from './leases'

export interface ClassicLease {
  schemaVersion: 1
  pid: number
  owner: string
  original: string | null
  installed: string
}

export function classicIdeConfigBusy() {
  return Object.assign(new Error('[weapp-vite] IDE classic 项目配置已由另一个开发命令持有，请先关闭该命令后重试。'), { code: 'EEXIST' })
}

function unknownJournal(configPath: string, cause?: unknown) {
  const journal = path.relative(path.dirname(configPath), classicIdeConfigLeasePath(configPath))
  return Object.assign(new Error(`[weapp-vite] IDE classic 配置租约缺少可信进程身份或已损坏，无法自动恢复。请先确认没有其他开发命令运行，并备份 ${journal} 与 ${path.basename(configPath)}。当前配置与 installed 完全一致时可用 original 恢复；否则仅恢复 original 中的 compileHotReLoad 字段，保留其他用户改动。确认配置恢复后再移除该租约；无法读取 original 时请使用已有备份。`, { cause }), { code: 'EEXIST' })
}

function isConfig(source: string | null) {
  const value: unknown = parseIdeConfig(source)
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

/** 旧版及不完整 journal 不能证明 owner 已退出，只允许提供明确的人工恢复指引。 */
export async function readClassicLease(configPath: string, strict = true): Promise<ClassicLease | undefined> {
  const source = await readIdeConfig(classicIdeConfigLeasePath(configPath))
  if (source === null) {
    return undefined
  }
  try {
    const saved: unknown = JSON.parse(source)
    if (!saved || typeof saved !== 'object'
      || !('schemaVersion' in saved) || saved.schemaVersion !== 1
      || !('pid' in saved) || !Number.isSafeInteger(saved.pid) || Number(saved.pid) <= 0
      || !('owner' in saved) || typeof saved.owner !== 'string' || !saved.owner
      || !('original' in saved) || (saved.original !== null && typeof saved.original !== 'string')
      || !('installed' in saved) || typeof saved.installed !== 'string'
      || !isConfig(saved.original) || !isConfig(saved.installed)
      || parseIdeConfig(saved.installed).setting?.compileHotReLoad !== false) {
      throw unknownJournal(configPath)
    }
    return saved as ClassicLease
  }
  catch (error) {
    if (strict) {
      throw unknownJournal(configPath, error)
    }
    return undefined
  }
}

/** PID 被复用、权限不足或查询失败均保守视为仍在持有，不撤销其他进程的租约。 */
export function isClassicLeaseProcessAlive(pid: number) {
  try {
    process.kill(pid, 0)
    return true
  }
  catch (error) {
    return (error as NodeJS.ErrnoException).code !== 'ESRCH'
  }
}

export function requestedClassicIdeConfig(source: string, saved: Pick<ClassicLease, 'original' | 'installed'>): string | null {
  if (isDeepStrictEqual(parseIdeConfig(source), parseIdeConfig(saved.installed))) {
    return saved.original
  }
  const current = parseIdeConfig(source)
  const restored = restoreRequestedHotReload(current, parseIdeConfig(saved.original))
  return isDeepStrictEqual(restored, current) ? source : formatIdeConfig(restored, source)
}

async function writeAtomic(file: string, source: string, exclusive: boolean, preserveMode: boolean, onPublished?: () => void) {
  const previousMode = preserveMode
    ? await fs.stat(file).then(value => value.mode & 0o777).catch((error: NodeJS.ErrnoException) => {
        if (error.code !== 'ENOENT') {
          throw error
        }
        return undefined
      })
    : undefined
  const temporary = `${file}.${process.pid}.${randomUUID()}.tmp`
  try {
    await fs.writeFile(temporary, source, { flag: 'wx', mode: previousMode ?? (preserveMode ? 0o666 : 0o600) })
    if (previousMode !== undefined) {
      await fsNative.chmod(temporary, previousMode)
    }
    if (exclusive) {
      await fsNative.link(temporary, file)
    }
    else {
      await fsNative.rename(temporary, file)
    }
    onPublished?.()
  }
  catch (error) {
    try {
      await fs.remove(temporary)
    }
    catch (cleanupError) {
      throw new AggregateError([error, cleanupError], 'Classic IDE config atomic write and cleanup failed', { cause: error })
    }
    throw error
  }
  await fs.remove(temporary)
}

/** 完整临时文件先落盘；首次发布使用硬链接排他创建，更新原子替换，永不先删除原 journal。 */
export async function writeClassicLease(configPath: string, saved: ClassicLease, exclusive = false, onPublished?: () => void) {
  const journal = classicIdeConfigLeasePath(configPath)
  await fs.ensureDir(path.dirname(journal))
  try {
    await writeAtomic(journal, JSON.stringify(saved), exclusive, false, onPublished)
  }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'EEXIST') {
      throw classicIdeConfigBusy()
    }
    throw error
  }
}

/** 只原子替换 IDE 控制配置，保留现有权限；构建产物继续由 Vite/Rolldown 写出。 */
export async function writeClassicIdeConfig(configPath: string, source: string) {
  const existing = await fsNative.lstat(configPath).catch((error: NodeJS.ErrnoException) => {
    if (error.code !== 'ENOENT') {
      throw error
    }
    return undefined
  })
  const target = existing?.isSymbolicLink() ? await fsNative.realpath(configPath) : configPath
  await writeAtomic(target, source, false, true)
}

/** 仅撤销本租约的临时开关，保留用户字段、格式、明确修改的值和删除操作。 */
export async function restoreClassicIdeConfig(configPath: string, saved: ClassicLease) {
  const current = await readIdeConfig(configPath)
  if (current === null) {
    return
  }
  const restored = requestedClassicIdeConfig(current, saved)
  if (saved.original === null && !Object.keys(parseIdeConfig(restored)).length) {
    await fs.remove(configPath)
  }
  else if (restored !== null && restored !== current) {
    await writeClassicIdeConfig(configPath, restored)
  }
}

/** 调用者持有路径短锁；恢复成功后才删除旧 journal，中断后可安全重试。 */
export async function recoverClassicLease(configPath: string, assetOwner?: string) {
  const saved = await readClassicLease(configPath)
  if (!saved) {
    return
  }
  if (isClassicLeaseProcessAlive(saved.pid)) {
    throw classicIdeConfigBusy()
  }
  await assertIdeAssetHandoff(configPath, assetOwner)
  await restoreClassicIdeConfig(configPath, saved)
  const current = await readClassicLease(configPath)
  if (current?.owner !== saved.owner || current.pid !== saved.pid) {
    throw new Error('[weapp-vite] classic IDE 配置租约身份已改变，拒绝恢复其他 owner 的配置。')
  }
  await fs.remove(classicIdeConfigLeasePath(configPath))
}
