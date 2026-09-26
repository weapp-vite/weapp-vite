import type { CompilerContext } from '../../context'
import type { WeappCompilerHmrPreparation, WeappCompilerHmrRequest, WeappCompilerPluginController } from '../../types/compilerPlugin'
import { realpathSync } from 'node:fs'
import path from 'node:path'
import { resolveVueSfcHmrSignatures } from 'wevu/compiler'
import { normalizeFsResolvedId } from '../../utils/resolvedId'

interface Provider {
  prepare?: WeappCompilerPluginController['prepareHmr']
}

export class CompilerHmrResyncError extends Error {
  constructor(readonly files: readonly string[], message: string) {
    super(message)
    this.name = 'CompilerHmrResyncError'
  }
}

const hosts = new WeakMap<CompilerContext, CompilerHmrHost>()
const hostsByConfig = new WeakMap<object, CompilerHmrHost>()

/** 统一扫描器与模块图中的符号链接身份，删除事件沿用父目录的真实路径。 */
export function compilerSourceId(id: string): string {
  if (!path.isAbsolute(id) && path.win32.isAbsolute(id)) {
    return normalizeFsResolvedId(id)
  }
  try {
    return normalizeFsResolvedId(realpathSync.native(id))
  }
  catch {
    try {
      return normalizeFsResolvedId(path.join(realpathSync.native(path.dirname(id)), path.basename(id)))
    }
    catch {
      return normalizeFsResolvedId(id)
    }
  }
}

/** 按实际转换输入封存内容，provider 不得在批次准备阶段改读后续磁盘版本。 */
export class CompilerHmrHost {
  onDependencyChange?: (file: string) => void
  private nativeSources = new Set<string>()
  private revision = 0
  private readonly previousSources = new Map<string, string | null>()
  private readonly previousByBatch = new WeakMap<WeappCompilerHmrRequest, ReadonlyMap<string, string | null>>()
  private readonly dependencies = new Set<string>()
  private readonly sources = new Map<string, string | null>()
  private readonly providers = new Map<string, Provider>()

  get supported(): boolean {
    return [...this.providers.values()].every(provider => provider.prepare)
  }

  get enabled(): boolean {
    return this.providers.size > 0
  }

  ownsDependency(id: string): boolean {
    return this.dependencies.has(compilerSourceId(id))
  }

  readSource(id: string): string | null | undefined {
    return this.sources.get(compilerSourceId(id))
  }

  isNativeSource(id: string): boolean {
    return this.nativeSources.has(compilerSourceId(id))
  }

  setNativeSources(ids: Iterable<string>): void {
    this.nativeSources = new Set(Array.from(ids, compilerSourceId))
    this.previousSources.clear()
    for (const [id, source] of this.sources) {
      this.previousSources.set(id, source)
    }
  }

  captureNative(id: string, code: string): void {
    if (!id.includes('?') && !id.startsWith('\0')) {
      this.nativeSources.add(compilerSourceId(id))
      this.capture(id, code)
    }
  }

  seed(id: string, code: string | null): void {
    this.dependencies.add(compilerSourceId(id))
    if (!this.sources.has(compilerSourceId(id))) {
      this.capture(id, code)
    }
  }

  capture(id: string, code: string | null): void {
    if (id.includes('?') || id.startsWith('\0')) {
      return
    }
    id = compilerSourceId(id)
    if (this.sources.get(id) !== code) {
      this.sources.set(id, code)
      this.revision += 1
    }
  }

  hasVisualChanges(files: readonly string[], input?: WeappCompilerHmrRequest): boolean {
    return files.some((file) => {
      if (!file.endsWith('.vue')) {
        return /\.(?:jsx|tsx|wxml|wxss|css)$/.test(file)
      }
      const id = compilerSourceId(file)
      const previous = (input ? this.previousByBatch.get(input) : this.previousSources)?.get(id)
      const current = (input?.sources ?? this.sources).get(id)
      if (typeof previous !== 'string' || typeof current !== 'string') {
        return true
      }
      const before = resolveVueSfcHmrSignatures(previous, id).blockSignatures
      const after = resolveVueSfcHmrSignatures(current, id).blockSignatures
      return !before || !after || before.template !== after.template || before.style !== after.style || before.config !== after.config
    })
  }

  register(name: string, prepare?: Provider['prepare']): void {
    this.providers.set(name, { prepare })
  }

  freeze(changedFiles: readonly string[]): WeappCompilerHmrRequest {
    const input = Object.freeze({
      revision: this.revision,
      changedFiles: Object.freeze([...changedFiles]),
      sources: new Map(this.sources),
    })
    const previous = new Map<string, string | null>()
    for (const file of changedFiles) {
      const id = compilerSourceId(file)
      const source = this.previousSources.get(id)
      if (source !== undefined) {
        previous.set(id, source)
      }
      const current = this.sources.get(id)
      if (current !== undefined) {
        this.previousSources.set(id, current)
      }
    }
    this.previousByBatch.set(input, previous)
    return input
  }

  async prepare(request: WeappCompilerHmrRequest): Promise<WeappCompilerHmrPreparation[]> {
    // 在同一同步入口启动所有 provider，使它们同时封存自己的编译状态。
    const pending = [...this.providers].map(([name, provider]) => {
      try {
        if (!provider.prepare) {
          throw new Error(`Compiler provider ${name} does not support versioned HMR preparation`)
        }
        return Promise.resolve(provider.prepare(request))
      }
      catch (error) {
        return Promise.reject(error)
      }
    })
    const settled = await Promise.allSettled(pending)
    const results = settled.flatMap(result => result.status === 'fulfilled' ? [result.value] : [])
    const failure = settled.find(result => result.status === 'rejected')
    if (failure?.status === 'rejected') {
      await Promise.allSettled(results.map(result => result.dispose?.()))
      throw failure.reason
    }
    const assets = new Set<string>()
    for (const result of results) {
      for (const asset of result.assets ?? []) {
        const file = asset.fileName.replaceAll('\\', '/')
        if (assets.has(file)) {
          await Promise.allSettled(results.map(result => result.dispose?.()))
          throw new CompilerHmrResyncError(request.changedFiles, `Compiler HMR asset has multiple providers: ${file}`)
        }
        assets.add(file)
      }
    }
    return results
  }
}

export function getCompilerHmrHost(ctx: CompilerContext): CompilerHmrHost {
  let host = hosts.get(ctx)
  if (!host) {
    host = new CompilerHmrHost()
    hosts.set(ctx, host)
    if (ctx.configService) {
      hostsByConfig.set(ctx.configService, host)
    }
  }
  return host
}

export function getCompilerHmrHostByConfig(config: object): CompilerHmrHost | undefined {
  return hostsByConfig.get(config)
}
