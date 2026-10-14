import { compilerSourceId } from '../../plugins/compilerPlugin/hmr'
import { compilerNativeScriptVersion } from '../../plugins/utils/sourceSnapshot'

type Source = string | null | undefined

/** 基线只接收完整原生产物实际使用的输入；补丁成功不会推进磁盘版本。 */
export class NativeScriptInputs {
  private readonly persisted = new Map<string, string>()
  private readonly assetInputs = new Map<string, string>()
  private readonly assetDrift = new Map<string, { version: string | null }>()

  capture(files: Iterable<string>, read: (file: string) => Source) {
    const sources = new Map<string, Source>()
    for (const file of files) {
      if (/\.[cm]?[jt]s$/.test(file)) {
        sources.set(compilerSourceId(file), read(file))
      }
    }
    return sources
  }

  commit(sources: ReadonlyMap<string, Source>) {
    this.persisted.clear()
    for (const [file, source] of sources) {
      if (typeof source === 'string') {
        const id = compilerSourceId(file)
        const version = compilerNativeScriptVersion(source)
        this.persisted.set(id, version)
        if (this.assetInputs.get(id) === version) {
          this.assetInputs.delete(id)
        }
      }
    }
  }

  matches(file: string, sources: ReadonlyMap<string, Source>) {
    const id = compilerSourceId(file)
    const source = sources.get(id)
    return typeof source === 'string' && this.persisted.get(id) === compilerNativeScriptVersion(source)
  }

  adoptAssets(versions?: ReadonlyMap<string, string>, drift?: ReadonlyMap<string, string | null>) {
    this.assetInputs.clear()
    for (const [file, version] of versions ?? []) {
      const id = compilerSourceId(file)
      this.assetInputs.set(id, version)
    }
    for (const [file, version] of drift ?? []) {
      const id = compilerSourceId(file)
      if (this.assetDrift.get(id)?.version !== version) {
        this.assetDrift.set(id, { version })
      }
    }
  }

  captureAssetDrift() {
    return new Map(this.assetDrift)
  }

  /** 只有完整资产及脚本事务成功才消费其启动时的债务；较新观察归后续代次。 */
  commitAssetDrift(drift: ReadonlyMap<string, { version: string | null }>) {
    for (const [file, observation] of drift) {
      if (this.assetDrift.get(file) === observation) {
        this.assetDrift.delete(file)
      }
    }
  }

  needsFullBuild(file: string) {
    const id = compilerSourceId(file)
    const version = this.assetInputs.get(id)
    return this.assetDrift.has(id) || (version !== undefined && version !== this.persisted.get(id))
  }

  invalidate() {
    this.persisted.clear()
  }

  clear() {
    this.persisted.clear()
    this.assetInputs.clear()
    this.assetDrift.clear()
  }
}
