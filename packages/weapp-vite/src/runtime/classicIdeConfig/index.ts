import type { ConfigService } from '../config/types'
import { randomUUID } from 'node:crypto'
import { isDeepStrictEqual } from 'node:util'
import { fs } from '@weapp-core/shared/fs'
import path from 'pathe'
import { formatIdeConfig, parseIdeConfig, readIdeConfig, restoreRequestedHotReload } from './document'
import { classicIdeConfigLeasePath, ideAssetWatchLeasePath } from './leases'

interface ClassicLease {
  owner: string
  original: string | null
  installed: string
}

const owners = new Map<string, string>()

export interface ClassicIdeConfigPublication {
  source: string
  commit?: () => Promise<void>
}

/** 一次开发命令只接管 IDE 的局部脚本热重载开关，配置重启沿用同一个 owner。 */
export class ClassicIdeConfigOwner {
  private readonly identity = randomUUID()
  private readonly leases = new Map<string, ClassicLease>()
  private pending = Promise.resolve()
  private closing?: Promise<void>
  private closed = false
  private failure?: { error: unknown }

  private enqueue<T>(operation: () => Promise<T>): Promise<T> {
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
      this.failure ??= { error }
    })
    return task
  }

  private requested(source: string, saved: ClassicLease): string | null {
    if (isDeepStrictEqual(parseIdeConfig(source), parseIdeConfig(saved.installed))) {
      return saved.original
    }
    const current = parseIdeConfig(source)
    const restored = restoreRequestedHotReload(current, parseIdeConfig(saved.original))
    return isDeepStrictEqual(restored, current) ? source : formatIdeConfig(restored, source)
  }

  async readRequested(file: string, read = () => fs.readFile(file, 'utf8')): Promise<string> {
    const source = await read()
    const configPath = path.resolve(file)
    const saved = this.leases.get(configPath)
    if (!saved) {
      return source
    }
    await this.assertOwnership(configPath)
    return this.requested(source, saved) ?? '{}'
  }

  /** 资产 owner 可以直接交入撤销 ignore 后的请求文本，保证交接只写一次项目配置。 */
  activate(file: string, handoff?: { source: string | null, assetOwner?: string }): Promise<void> {
    return this.enqueue(async () => {
      const configPath = path.resolve(file)
      await this.assertAssetHandoff(configPath, handoff?.assetOwner)
      const previous = this.leases.get(configPath)
      const current = await readIdeConfig(configPath)
      const original = handoff ? handoff.source : previous && current !== null ? this.requested(current, previous) : current
      const config = parseIdeConfig(original)
      config.setting = { ...config.setting, compileHotReLoad: false }
      const installed = formatIdeConfig(config, original)
      const saved: ClassicLease = { owner: this.identity, original, installed }
      const journal = classicIdeConfigLeasePath(configPath)
      if (previous) {
        await this.assertOwnership(configPath)
        await fs.writeJSON(journal, saved)
      }
      else {
        if (owners.has(configPath)) {
          throw new Error('[weapp-vite] IDE 项目配置已由另一个开发命令持有。')
        }
        await fs.ensureDir(path.dirname(journal))
        // 独占 journal 防止不同命令、不同进程相互接管；未知旧租约需要显式恢复。
        await fs.writeFile(journal, JSON.stringify(saved), { flag: 'wx' })
        owners.set(configPath, this.identity)
      }
      this.leases.set(configPath, saved)
      let writeStarted = false
      try {
        await this.assertAssetHandoff(configPath, handoff?.assetOwner)
        if (current !== installed) {
          writeStarted = true
          await fs.writeFile(configPath, installed)
        }
      }
      catch (error) {
        if (!previous && !writeStarted) {
          try {
            // 竞争失败且尚未修改配置，只撤销本次独占创建的 journal，不恢复对方配置。
            await this.assertOwnership(configPath)
            await fs.remove(journal)
            this.leases.delete(configPath)
            owners.delete(configPath)
          }
          catch (cleanupError) {
            throw new AggregateError([error, cleanupError], 'Classic IDE config acquisition and cleanup failed', { cause: error })
          }
        }
        throw error
      }
    })
  }

  /** 原生发布仍由构建器写出；成功后提交新的请求原文，退出时恢复最近一轮源配置。 */
  preparePublication(file: string, source: string): Promise<ClassicIdeConfigPublication> {
    return this.enqueue(async () => {
      const configPath = path.resolve(file)
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
        commit: () => committing ??= this.enqueue(async () => {
          await this.assertOwnership(configPath)
          const saved = { owner: this.identity, original: source, installed }
          await fs.writeJSON(classicIdeConfigLeasePath(configPath), saved)
          this.leases.set(configPath, saved)
        }),
      }
    })
  }

  private async assertAssetHandoff(configPath: string, owner?: string) {
    const journal = ideAssetWatchLeasePath(configPath)
    if (await fs.pathExists(journal)) {
      const saved = await fs.readJSON(journal) as { owner?: string }
      if (!owner || saved.owner !== owner) {
        throw new Error('[weapp-vite] IDE 资产配置已由其他 owner 持有，拒绝接管 classic 配置。')
      }
    }
  }

  private async assertOwnership(configPath: string) {
    const saved = await fs.readJSON(classicIdeConfigLeasePath(configPath)) as ClassicLease
    if (saved.owner !== this.identity || owners.get(configPath) !== this.identity) {
      throw new Error('[weapp-vite] classic IDE 配置租约身份已改变，拒绝释放其他 owner 的配置。')
    }
  }

  /** 仅在所有构建代次和 watcher 成功关闭后调用；失败保留租约及原始诊断。 */
  close(): Promise<void> {
    this.closed = true
    return this.closing ??= (async () => {
      await this.pending
      const errors: unknown[] = this.failure ? [this.failure.error] : []
      for (const [configPath, saved] of this.leases) {
        try {
          await this.assertOwnership(configPath)
          await this.assertAssetHandoff(configPath)
          const current = await readIdeConfig(configPath)
          if (current !== null) {
            const restored = this.requested(current, saved)
            if (saved.original === null && !Object.keys(parseIdeConfig(restored)).length) {
              await fs.remove(configPath)
            }
            else if (restored !== null && restored !== current) {
              await fs.writeFile(configPath, restored)
            }
          }
          await fs.remove(classicIdeConfigLeasePath(configPath))
          this.leases.delete(configPath)
          owners.delete(configPath)
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

/** 与 IDE 启动相同，分平台产物使用生成根，其余项目使用实际解析出的 private 配置。 */
export function resolveIdePrivateConfigPath(config: Pick<ConfigService, 'multiPlatform' | 'outDir' | 'projectPrivateConfigPath'>): string | undefined {
  return config.multiPlatform.enabled
    ? path.join(path.dirname(config.outDir), 'project.private.config.json')
    : config.projectPrivateConfigPath
}
