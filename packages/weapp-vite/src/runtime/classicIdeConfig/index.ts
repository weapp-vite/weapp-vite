import type { ClassicLease } from './journal'
import { randomUUID } from 'node:crypto'
import process from 'node:process'
import { fs } from '@weapp-core/shared/fs'
import path from 'pathe'
import { assertIdeAssetHandoff, readIdeAssetWatchLease, releaseIdeAssetWatchLease, restoreOwnedIdeAssetWatch, restoreRequestedAssetWatch } from './assetLease'
import { formatIdeConfig, parseIdeConfig, readIdeConfig } from './document'
import { classicIdeConfigBusy, readClassicLease, recoverClassicLease, requestedClassicIdeConfig, restoreClassicIdeConfig, writeClassicIdeConfig, writeClassicLease } from './journal'
import { classicIdeConfigLeasePath } from './leases'
import { withClassicIdeConfigLock } from './lock'

export { resolveIdePrivateConfigPath } from './leases'

interface PendingAssetHandoff {
  assetOwner: string
  outDir: string
}

const owners = new Map<string, string>()

export interface ClassicIdeConfigPublication {
  source: string
  deferred?: boolean
  commit?: () => Promise<void>
}

/** 一次开发命令只接管 IDE 的局部脚本热重载开关，配置重启沿用同一个 owner。 */
export class ClassicIdeConfigOwner {
  private readonly identity = randomUUID()
  private readonly leases = new Map<string, ClassicLease>()
  private readonly assetHandoffs = new Map<string, PendingAssetHandoff>()
  private pending = Promise.resolve()
  private closing?: Promise<void>
  private closed = false
  private failure?: { error: unknown }

  private enqueue<T>(operation: () => Promise<T>, retainFailure = true): Promise<T> {
    if (this.closed) {
      return Promise.reject(new Error('[weapp-vite] classic IDE 配置 owner 已关闭。'))
    }
    const task = this.pending.then(async () => {
      if (this.failure) {
        throw this.failure.error
      }
      return await operation()
    })
    this.pending = task.then(() => {}, (error) => {
      if (retainFailure) {
        this.failure ??= { error }
      }
    })
    return task
  }

  readRequested(file: string, read = () => fs.readFile(file, 'utf8')): Promise<string> {
    return this.enqueue(async () => {
      const source = await read()
      const configPath = path.resolve(file)
      const saved = this.leases.get(configPath)
      if (!saved) {
        const handoff = this.assetHandoffs.get(configPath)
        if (handoff) {
          return restoreRequestedAssetWatch(source, await readIdeAssetWatchLease(configPath, handoff.assetOwner)) ?? '{}'
        }
        const disk = await readClassicLease(configPath, false)
        return disk ? requestedClassicIdeConfig(source, disk) ?? '{}' : source
      }
      await this.assertOwnership(configPath)
      return requestedClassicIdeConfig(source, saved) ?? '{}'
    }, false)
  }

  /** 请求视图已在配置解析阶段还原；开发启动在模式选择前统一回收死亡进程的租约。 */
  reconcileStale(file: string): Promise<void> {
    return this.enqueue(async () => {
      const configPath = path.resolve(file)
      await withClassicIdeConfigLock(configPath, async () => {
        if (this.leases.has(configPath)) {
          await this.assertOwnership(configPath)
        }
        else if (owners.has(configPath)) {
          throw classicIdeConfigBusy()
        }
        else {
          await recoverClassicLease(configPath, this.assetHandoffs.get(configPath)?.assetOwner)
        }
      })
    })
  }

  /** 资产 owner 可以直接交入撤销 ignore 后的请求文本，保证交接只写一次项目配置。 */
  activate(file: string, handoff?: { source: string | null, assetOwner?: string }): Promise<void> {
    return this.enqueue(async () => {
      await this.activateOwned(file, handoff)
    })
  }

  private async activateOwned(file: string, handoff?: { source: string | null, assetOwner?: string }, pendingAssetOwner?: string, isActive?: () => boolean): Promise<boolean> {
    const configPath = path.resolve(file)
    return withClassicIdeConfigLock(configPath, () => this.activateLocked(configPath, handoff, pendingAssetOwner, isActive))
  }

  private async activateLocked(configPath: string, handoff?: { source: string | null, assetOwner?: string }, pendingAssetOwner?: string, isActive?: () => boolean): Promise<boolean> {
    const assetOwner = pendingAssetOwner ?? handoff?.assetOwner
    await assertIdeAssetHandoff(configPath, assetOwner)
    const asset = pendingAssetOwner ? await readIdeAssetWatchLease(configPath, pendingAssetOwner) : undefined
    const previous = this.leases.get(configPath)
    if (!previous) {
      if (owners.has(configPath)) {
        throw classicIdeConfigBusy()
      }
      await recoverClassicLease(configPath, assetOwner)
    }
    const current = await readIdeConfig(configPath)
    const original = asset
      ? restoreRequestedAssetWatch(current, asset)
      : handoff ? handoff.source : previous && current !== null ? requestedClassicIdeConfig(current, previous) : current
    const config = parseIdeConfig(original)
    config.setting = { ...config.setting, compileHotReLoad: false }
    const installed = formatIdeConfig(config, original)
    const saved: ClassicLease = { schemaVersion: 1, pid: process.pid, owner: this.identity, original, installed }
    const journal = classicIdeConfigLeasePath(configPath)
    if (isActive && !isActive()) {
      return false
    }
    if (previous) {
      await this.assertOwnership(configPath)
      await writeClassicLease(configPath, saved, false, () => this.leases.set(configPath, saved))
    }
    else {
      if (isActive && !isActive()) {
        return false
      }
      await writeClassicLease(configPath, saved, true, () => {
        owners.set(configPath, this.identity)
        this.leases.set(configPath, saved)
      })
    }
    this.leases.set(configPath, saved)
    const releaseUnwritten = async () => {
      if (!previous) {
        await this.assertOwnership(configPath)
        await fs.remove(journal)
        this.leases.delete(configPath)
        owners.delete(configPath)
      }
    }
    let writeStarted = false
    try {
      await assertIdeAssetHandoff(configPath, assetOwner)
      if (isActive && !isActive()) {
        await releaseUnwritten()
        return false
      }
      if (current !== installed) {
        writeStarted = true
        await writeClassicIdeConfig(configPath, installed)
      }
      return true
    }
    catch (error) {
      if (!previous && !writeStarted) {
        try {
          // 竞争失败且尚未修改配置，只撤销本次独占创建的 journal，不恢复对方配置。
          await releaseUnwritten()
        }
        catch (cleanupError) {
          throw new AggregateError([error, cleanupError], 'Classic IDE config acquisition and cleanup failed', { cause: error })
        }
      }
      throw error
    }
  }

  /** 关闭旧 stateful 后仅接管路径和 token，磁盘租约及项目配置保持原样。 */
  addPendingAssetHandoff(file: string, handoff: PendingAssetHandoff): Promise<void> {
    return this.enqueue(async () => {
      const configPath = path.resolve(file)
      await withClassicIdeConfigLock(configPath, async () => {
        const next = { assetOwner: handoff.assetOwner, outDir: path.resolve(handoff.outDir) }
        const previous = this.assetHandoffs.get(configPath)
        if (previous && (previous.assetOwner !== next.assetOwner || previous.outDir !== next.outDir)) {
          throw new Error('[weapp-vite] classic 交接已有其他资产 owner 或输出根，拒绝替换。')
        }
        await readIdeAssetWatchLease(configPath, next.assetOwner)
        if (this.leases.has(configPath) || owners.has(configPath)) {
          throw classicIdeConfigBusy()
        }
        await recoverClassicLease(configPath, next.assetOwner)
        this.assetHandoffs.set(configPath, next)
      })
    })
  }

  hasPendingAssetHandoff(file: string, outDir?: string): boolean {
    const pending = this.assetHandoffs.get(path.resolve(file))
    return pending !== undefined && (outDir === undefined || pending.outDir === path.resolve(outDir))
  }

  preservesPendingOutput(outDir: string): boolean {
    const root = path.resolve(outDir)
    return [...this.assetHandoffs.values()].some(handoff => handoff.outDir === root)
  }

  /** 完整原生写出前重读用户配置，在同一 owner 内一次交接 ignore 与重载开关。 */
  activatePendingAssetHandoff(file: string, outDir: string, isActive?: () => boolean): Promise<boolean> {
    return this.enqueue(async () => {
      if (this.closed || (isActive && !isActive())) {
        return false
      }
      const configPath = path.resolve(file)
      const handoff = this.assetHandoffs.get(configPath)
      if (!handoff) {
        return false
      }
      if (handoff.outDir !== path.resolve(outDir)) {
        throw new Error('[weapp-vite] classic 原生发布输出根与资产交接不匹配。')
      }
      if (!await this.activateOwned(configPath, undefined, handoff.assetOwner, () => !this.closed && (!isActive || isActive()))) {
        return false
      }
      await releaseIdeAssetWatchLease(configPath, handoff.assetOwner)
      this.assetHandoffs.delete(configPath)
      return true
    })
  }

  /** 原生发布仍由构建器写出；成功后提交新的请求原文，退出时恢复最近一轮源配置。 */
  preparePublication(file: string, source: string): Promise<ClassicIdeConfigPublication> {
    return this.enqueue(async () => {
      const configPath = path.resolve(file)
      if (this.assetHandoffs.has(configPath)) {
        return { source, deferred: true }
      }
      if (!this.leases.has(configPath)) {
        return { source }
      }
      await this.assertOwnership(configPath)
      const config = parseIdeConfig(source)
      config.setting = { ...config.setting, compileHotReLoad: false }
      const installed = formatIdeConfig(config, source)
      let committing: Promise<void> | undefined
      return {
        source: installed,
        commit: () => committing ??= this.enqueue(() => withClassicIdeConfigLock(configPath, async () => {
          await this.assertOwnership(configPath)
          const saved: ClassicLease = { schemaVersion: 1, pid: process.pid, owner: this.identity, original: source, installed }
          await writeClassicLease(configPath, saved, false, () => this.leases.set(configPath, saved))
        })),
      }
    })
  }

  private async assertOwnership(configPath: string) {
    const saved = await readClassicLease(configPath)
    if (saved?.owner !== this.identity || saved.pid !== process.pid || owners.get(configPath) !== this.identity) {
      throw new Error('[weapp-vite] classic IDE 配置租约身份已改变，拒绝释放其他 owner 的配置。')
    }
  }

  /** 仅在所有构建代次和 watcher 成功关闭后调用；失败保留租约及原始诊断。 */
  close(): Promise<void> {
    this.closed = true
    return this.closing ??= (async () => {
      await this.pending
      const errors: unknown[] = this.failure ? [this.failure.error] : []
      for (const [configPath, handoff] of this.assetHandoffs) {
        try {
          await restoreOwnedIdeAssetWatch(configPath, handoff.assetOwner)
          this.assetHandoffs.delete(configPath)
        }
        catch (error) {
          if (!errors.includes(error)) {
            errors.push(error)
          }
        }
      }
      for (const [configPath, saved] of this.leases) {
        try {
          await withClassicIdeConfigLock(configPath, async () => {
            await this.assertOwnership(configPath)
            await assertIdeAssetHandoff(configPath)
            await restoreClassicIdeConfig(configPath, saved)
            await fs.remove(classicIdeConfigLeasePath(configPath))
            this.leases.delete(configPath)
            owners.delete(configPath)
          })
        }
        catch (error) {
          if (!errors.includes(error)) {
            errors.push(error)
          }
        }
      }
      if (errors.length) {
        throw errors.length === 1 ? errors[0] : new AggregateError(errors, 'Classic IDE config cleanup failed', { cause: errors[0] })
      }
    })()
  }
}
