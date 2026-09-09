import { statSync } from 'node:fs'
import path from 'pathe'
import { normalizeFsResolvedId } from '../../utils/resolvedId'

/** 原子保存会额外改变父目录元数据；仅文件事件负责发布补丁，目录增删仍保留拓扑语义。 */
export class StatefulHmrDirectoryUpdates {
  private readonly metadataUpdates = new Set<string>()

  constructor(private readonly root: string) {}

  observe(file: string, event?: string): boolean {
    const normalized = this.normalize(file)
    this.metadataUpdates.delete(normalized)
    if (event !== 'update' || !statSync(normalized, { throwIfNoEntry: false })?.isDirectory()) {
      return false
    }
    this.metadataUpdates.add(normalized)
    return true
  }

  consume(files: string[]): string[] {
    return files.filter(file => !this.metadataUpdates.delete(this.normalize(file)))
  }

  private normalize(file: string): string {
    return normalizeFsResolvedId(path.resolve(this.root, file))
  }
}
