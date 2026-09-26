import { statSync } from 'node:fs'
import path from 'pathe'
import { normalizeFsResolvedId } from '../../utils/resolvedId'

interface DirectoryIdentity {
  dev: bigint
  ino: bigint
}

/** 目录身份属于构建基线；重复回调不能消费掉原子保存产生的元数据分类。 */
export class StatefulHmrDirectoryUpdates {
  private readonly directories = new Map<string, DirectoryIdentity>()
  private readonly structuralChanges = new Set<string>()

  constructor(private readonly root: string) {}

  seedSources(files: Iterable<string>): void {
    for (const file of files) {
      let directory = path.dirname(this.normalize(file))
      for (;;) {
        const identity = this.identity(directory)
        if (identity) {
          this.directories.set(directory, identity)
        }
        const parent = path.dirname(directory)
        const relative = path.relative(this.root, directory)
        if (parent === directory || directory === this.root || (relative === '..' || relative.startsWith('../')) || path.isAbsolute(relative)) {
          break
        }
        directory = parent
      }
    }
    this.structuralChanges.clear()
  }

  observe(file: string, event?: string): boolean {
    const normalized = this.normalize(file)
    const current = this.identity(normalized)
    const previous = this.directories.get(normalized)
    if (event === 'create' || event === 'delete' || (previous && !this.same(previous, current))) {
      if (previous || current) {
        this.structuralChanges.add(normalized)
      }
      if (current) {
        this.directories.set(normalized, current)
      }
      else {
        this.directories.delete(normalized)
      }
      return false
    }
    if (this.structuralChanges.has(normalized)) {
      return false
    }
    if (current && (event === 'update' || previous)) {
      this.directories.set(normalized, current)
      return true
    }
    return false
  }

  consume(files: string[]): string[] {
    return files.filter((file) => {
      const normalized = this.normalize(file)
      if (this.structuralChanges.delete(normalized)) {
        return true
      }
      const previous = this.directories.get(normalized)
      return !previous || !this.same(previous, this.identity(normalized))
    })
  }

  private same(previous: DirectoryIdentity, current?: DirectoryIdentity): boolean {
    return current !== undefined && previous.ino === current.ino && previous.dev === current.dev
  }

  private identity(file: string): DirectoryIdentity | undefined {
    try {
      const stat = statSync(file, { throwIfNoEntry: false, bigint: true })
      return stat?.isDirectory() ? { ino: stat.ino, dev: stat.dev } : undefined
    }
    catch {
      return undefined
    }
  }

  private normalize(file: string) {
    return normalizeFsResolvedId(path.resolve(this.root, file))
  }
}
