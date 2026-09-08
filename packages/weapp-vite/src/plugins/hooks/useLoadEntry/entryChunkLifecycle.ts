export const ENTRY_GRAPH_CHANGE_REASON = 'entry-graph-changed'

/** 入口注册属于完整扫描；局部扫描只能复用已注册入口或请求重建入口图。 */
export class EntryChunkLifecycle {
  private scanning = true
  private readonly registered = new Set<string>()
  private readonly deferred = new Set<string>()

  constructor(private readonly requestFullBuild: (entryId: string) => void) {}

  beginBuild(): void {
    this.scanning = true
    this.registered.clear()
    this.deferred.clear()
  }

  endBuild(): void {
    this.scanning = false
  }

  prepare(entryId: string, emitsChunk: boolean, isGraphEntry: () => boolean = () => false): boolean {
    if (!this.scanning) {
      if (emitsChunk && !this.registered.has(entryId) && !isGraphEntry() && !this.deferred.has(entryId)) {
        this.deferred.add(entryId)
        this.requestFullBuild(entryId)
      }
      return false
    }
    if (!emitsChunk) {
      return true
    }
    if (this.registered.has(entryId)) {
      return false
    }
    // 在异步预加载前占用注册，避免嵌套组件和并发发现重复发出同一入口。
    this.registered.add(entryId)
    return true
  }

  rollback(entryId: string): void {
    this.registered.delete(entryId)
  }
}
