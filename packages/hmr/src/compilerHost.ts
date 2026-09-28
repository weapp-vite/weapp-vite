import type { HmrCompilerPreparation, HmrCompilerProvider, HmrCompilerRequest } from './types'
import { CompilerHmrResyncError } from './errors'

interface Provider { prepare?: HmrCompilerProvider['prepareHmr'] }

export interface HmrCompilerHostOptions {
  sourceId?: (id: string) => string
  hasVisualChange?: (id: string, previous: string | null | undefined, current: string | null | undefined) => boolean
}

/** 只保存宿主实际提供的输入；模块身份和框架语义由适配器决定。 */
export class HmrCompilerHost {
  onDependencyChange?: (file: string) => void
  private nativeSources = new Set<string>()
  private revision = 0
  private readonly previousSources = new Map<string, string | null>()
  private readonly previousByBatch = new WeakMap<HmrCompilerRequest, ReadonlyMap<string, string | null>>()
  private readonly dependencies = new Set<string>()
  private readonly sources = new Map<string, string | null>()
  private readonly providers = new Map<string, Provider>()

  constructor(private readonly options: HmrCompilerHostOptions = {}) {}

  private sourceId(id: string): string {
    return this.options.sourceId?.(id) ?? id.replaceAll('\\', '/')
  }

  get supported(): boolean {
    return [...this.providers.values()].every(provider => provider.prepare)
  }

  get enabled(): boolean {
    return this.providers.size > 0
  }

  ownsDependency(id: string): boolean {
    return this.dependencies.has(this.sourceId(id))
  }

  readSource(id: string): string | null | undefined {
    return this.sources.get(this.sourceId(id))
  }

  isNativeSource(id: string): boolean {
    return this.nativeSources.has(this.sourceId(id))
  }

  setNativeSources(ids: Iterable<string>): void {
    this.nativeSources = new Set(Array.from(ids, id => this.sourceId(id)))
    this.previousSources.clear()
    for (const [id, source] of this.sources) {
      this.previousSources.set(id, source)
    }
  }

  captureNative(id: string, code: string): void {
    if (!id.includes('?') && !id.startsWith('\0')) {
      this.nativeSources.add(this.sourceId(id))
      this.capture(id, code)
    }
  }

  seed(id: string, code: string | null): void {
    this.dependencies.add(this.sourceId(id))
    if (!this.sources.has(this.sourceId(id))) {
      this.capture(id, code)
    }
  }

  capture(id: string, code: string | null): void {
    if (id.includes('?') || id.startsWith('\0')) {
      return
    }
    id = this.sourceId(id)
    if (this.sources.get(id) !== code) {
      this.sources.set(id, code)
      this.revision += 1
    }
  }

  hasVisualChanges(files: readonly string[], input?: HmrCompilerRequest): boolean {
    return files.some((file) => {
      const id = this.sourceId(file)
      const previous = (input ? this.previousByBatch.get(input) : this.previousSources)?.get(id)
      const current = (input?.sources ?? this.sources).get(id)
      return this.options.hasVisualChange?.(id, previous, current) ?? previous !== current
    })
  }

  register(name: string, prepare?: Provider['prepare']): void {
    this.providers.set(name, { prepare })
  }

  freeze(changedFiles: readonly string[]): HmrCompilerRequest {
    const input = Object.freeze({
      revision: this.revision,
      changedFiles: Object.freeze([...changedFiles]),
      sources: new Map(this.sources),
    })
    const previous = new Map<string, string | null>()
    for (const file of changedFiles) {
      const id = this.sourceId(file)
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

  async prepare(request: HmrCompilerRequest): Promise<HmrCompilerPreparation[]> {
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
