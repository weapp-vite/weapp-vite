import type { Compiler } from 'weapp-tailwindcss/core'
import { CompilerHmrResyncError } from '../compilerPlugin/hmr'

interface Owner {
  id: string
  active: boolean
  files: readonly string[]
}

/** 生成开始即登记导入式 root，失败不代表 core 已撤销其缓存与来源。 */
export class TailwindImportedRoots {
  private readonly owners = new Map<string, Owner>()

  get size() {
    return this.owners.size
  }

  has(key: string) {
    return this.owners.has(key)
  }

  begin(key: string, id: string, files: readonly string[] = [key.split('?')[0]!]) {
    const previous = this.owners.get(key)
    if (previous) {
      previous.active = false
    }
    const owner = { id, active: true, files }
    this.owners.set(key, owner)
    this.assertCurrent(key, owner)
    return owner
  }

  assertCurrent(key: string, owner: Owner) {
    if (!owner.active || this.owners.get(key) !== owner) {
      throw new CompilerHmrResyncError([key], 'Tailwind 导入式样式已撤销，需要完整重同步。')
    }
  }

  assertReady(ready: (key: string) => boolean, files: readonly string[]) {
    if (!this.isReady(ready)) {
      throw new CompilerHmrResyncError([...files], 'Tailwind 导入式样式尚未提供可固定的产物归属，需要完整重同步。')
    }
  }

  isReady(ready: (key: string) => boolean) {
    return [...this.owners].every(([key, owner]) => owner.active && ready(key))
  }

  keysForFile(file: string) {
    return [...this.owners].flatMap(([key, owner]) => owner.files.includes(file) ? [key] : [])
  }

  async remove(compiler: Compiler, key: string) {
    const owner = this.owners.get(key)
    if (!owner) {
      return false
    }
    owner.active = false
    await compiler.remove(owner.id)
    if (this.owners.get(key) === owner) {
      this.owners.delete(key)
      return true
    }
    return false
  }

  clear() {
    for (const owner of this.owners.values()) {
      owner.active = false
    }
    this.owners.clear()
  }
}
