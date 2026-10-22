export interface CompilerSourceSnapshotView {
  sources: ReadonlyMap<string, string | null>
  resolutions?: ReadonlyMap<string, string | undefined>
  readSource: (id: string) => string | undefined
}

const snapshots = new WeakMap<object, CompilerSourceSnapshotView>()

export function getCompilerSourceSnapshotView(owner: object): CompilerSourceSnapshotView | undefined {
  return snapshots.get(owner)
}

export function replaceCompilerSourceSnapshotView(owner: object, snapshot: CompilerSourceSnapshotView | undefined): void {
  if (snapshot) {
    snapshots.set(owner, snapshot)
  }
  else {
    snapshots.delete(owner)
  }
}

export function getCompilerSourceSnapshot(owner: object): ReadonlyMap<string, string | null> | undefined {
  return snapshots.get(owner)?.sources
}

export function getCompilerSourceResolutions(owner: object): ReadonlyMap<string, string | undefined> | undefined {
  return snapshots.get(owner)?.resolutions
}

/** 轻量消费者只读取已登记的代际；源码身份由登记方沿用原编译器规则解析。 */
export function readCompilerSourceSnapshotInput(owner: object, id: string): string | undefined {
  return snapshots.get(owner)?.readSource(id)
}
