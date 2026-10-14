import type { Compiler } from 'weapp-tailwindcss/core'
import { CompilerHmrResyncError } from '../compilerPlugin/hmr'

interface Owner {
  id: string
  active: boolean
}

/** 冻结输入保留内容版本，但入口删除会撤销其所有历史版本的编译所有权。 */
class TailwindPreparationScope {
  private readonly compilers = new WeakMap<Compiler, Compiler>()

  constructor(private readonly owners: readonly Owner[]) {}

  assertActive(changedFiles: readonly string[]) {
    if (this.owners.some(owner => !owner.active)) {
      throw new CompilerHmrResyncError([...changedFiles], 'Tailwind 编译入口已移除，需要完整重同步。')
    }
  }

  compiler(compiler: Compiler): Compiler {
    let facade = this.compilers.get(compiler)
    if (!facade) {
      const generate: Compiler['generate'] = (request) => {
        // shared prepare 含多个 await，必须在每个 root 实际进入 core 前重新核验。
        this.assertActive([])
        return compiler.generate(request)
      }
      facade = new Proxy(compiler, {
        get(target, property) {
          if (property === 'generate') {
            return generate
          }
          const value = Reflect.get(target, property, target)
          return typeof value === 'function' ? value.bind(target) : value
        },
      })
      this.compilers.set(compiler, facade)
    }
    return facade
  }
}

/** 同一活跃入口拓扑复用 compiler facade，保留 shared prepare 的 signature 缓存。 */
export class TailwindRootLifecycle {
  private readonly owners = new Map<number, Owner>()
  private scope: TailwindPreparationScope | undefined

  remember(index: number, id: string) {
    if (this.owners.get(index)?.id === id) {
      return
    }
    this.remove(index)
    this.owners.set(index, { id, active: true })
    this.scope = undefined
  }

  capture() {
    this.scope ??= new TailwindPreparationScope([...this.owners.values()])
    return this.scope
  }

  remove(index: number) {
    const owner = this.owners.get(index)
    if (owner) {
      owner.active = false
      this.owners.delete(index)
      this.scope = undefined
    }
  }

  clear() {
    for (const owner of this.owners.values()) {
      owner.active = false
    }
    this.owners.clear()
    this.scope = undefined
  }
}
