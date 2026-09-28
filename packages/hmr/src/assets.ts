import { Buffer } from 'node:buffer'

export interface HmrAsset {
  fileName: string
  source: string | Uint8Array
}

export interface HmrAssetChanges<T extends HmrAsset> {
  changed: T[]
  removed: string[]
}

function copyAsset<T extends HmrAsset>(asset: T): T {
  return { ...asset, source: typeof asset.source === 'string' ? asset.source : Uint8Array.from(asset.source) }
}

/** 保存最后成功提交的字节与可能部分落盘的文件；不拥有任何文件系统写入者。 */
export class HmrAssetStore<T extends HmrAsset = HmrAsset> {
  private committed = new Map<string, T>()
  private attempted = new Set<string>()
  private reliable = true
  private committing = false

  values(): IterableIterator<T> {
    return Array.from(this.committed.values(), copyAsset).values()
  }

  ownedNames(): string[] {
    return [...new Set([...this.committed.keys(), ...this.attempted])]
  }

  track(assets: Iterable<T>): void {
    for (const asset of assets) {
      this.attempted.add(asset.fileName)
    }
  }

  invalidate(): void {
    this.reliable = false
  }

  adopt(assets: Iterable<T>): void {
    this.committed = new Map(Array.from(assets, asset => [asset.fileName, copyAsset(asset)]))
    this.attempted.clear()
    this.reliable = true
  }

  diff(assets: readonly T[], retainedFileNames: Iterable<string> = []): HmrAssetChanges<T> {
    const names = new Set<string>()
    const changed: T[] = []
    for (const asset of assets) {
      if (names.has(asset.fileName)) {
        throw new Error(`HMR asset has multiple owners: ${asset.fileName}`)
      }
      names.add(asset.fileName)
      const previous = this.committed.get(asset.fileName)
      if (!this.reliable || !previous || !(previous.source === asset.source || Buffer.from(previous.source).equals(Buffer.from(asset.source)))) {
        changed.push(asset)
      }
    }
    const retained = new Set(retainedFileNames)
    return { changed, removed: this.ownedNames().filter(name => !names.has(name) && !retained.has(name)) }
  }

  async commit(assets: readonly T[], write: (changes: HmrAssetChanges<T>) => Promise<void>, retainedFileNames: Iterable<string> = []): Promise<HmrAssetChanges<T>> {
    if (this.committing) {
      throw new Error('HMR asset commits must be serialized by the host')
    }
    // 在进入异步写出前复制输入，避免宿主随后修改生产者数组或二进制内容。
    const captured = assets.map(copyAsset)
    const changes = this.diff(captured, retainedFileNames)
    this.track(changes.changed)
    this.committing = true
    try {
      if (changes.changed.length || changes.removed.length) {
        await write(changes)
      }
    }
    catch (error) {
      this.invalidate()
      throw error
    }
    finally {
      this.committing = false
    }
    this.adopt(captured)
    return changes
  }
}
