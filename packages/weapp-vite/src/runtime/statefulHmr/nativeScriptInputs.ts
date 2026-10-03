import { compilerSourceId } from '../../plugins/compilerPlugin/hmr'

type Source = string | null | undefined

/** 基线只接收完整原生产物实际使用的输入；补丁成功不会推进磁盘版本。 */
export class NativeScriptInputs {
  private readonly persisted = new Map<string, string>()

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
        this.persisted.set(file, source)
      }
    }
  }

  matches(file: string, sources: ReadonlyMap<string, Source>) {
    const id = compilerSourceId(file)
    const source = sources.get(id)
    return typeof source === 'string' && this.persisted.get(id) === source
  }

  clear() {
    this.persisted.clear()
  }
}
