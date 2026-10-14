import type { Compiler } from 'weapp-tailwindcss/core'
import { CompilerHmrResyncError } from '../compilerPlugin/hmr'

interface Owner {
  id: string
  active: boolean
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

  begin(key: string, id: string) {
    const previous = this.owners.get(key)
    if (previous) {
      previous.active = false
    }
    const owner = { id, active: true }
    this.owners.set(key, owner)
    this.assertCurrent(key, owner)
    return owner
  }

  assertCurrent(key: string, owner: Owner) {
    if (!owner.active || this.owners.get(key) !== owner) {
      throw new CompilerHmrResyncError([key], 'Tailwind 导入式样式已撤销，需要完整重同步。')
    }
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
