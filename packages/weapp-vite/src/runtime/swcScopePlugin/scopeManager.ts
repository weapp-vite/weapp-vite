import type { BindingInfo, BindingKind, ScopeType } from './types'

/**
 * 作用域条目
 */
interface ScopeEntry {
  name: string
  kind: BindingKind
}

/**
 * 作用域
 */
interface Scope {
  /** 父作用域 */
  parent: Scope | null
  /** 作用域层级 */
  level: number
  /** 作用域类型 */
  type: ScopeType
  /** 绑定表 */
  bindings: Map<string, ScopeEntry>
}

/**
 * 作用域栈管理器
 *
 * 核心功能：递归向上寻址
 *
 * Babel 对比：
 * - Babel: path.scope.getBinding(name) - 自动向上查找
 * - SWC: 需要手动实现 while 循环向上遍历
 */
export class ScopeManager {
  private rootScope: Scope
  private currentScope: Scope

  constructor() {
    this.rootScope = {
      parent: null,
      level: 0,
      type: 'module',
      bindings: new Map(),
    }
    this.currentScope = this.rootScope
  }

  /**
   * 进入新作用域
   */
  pushScope(type: ScopeType): void {
    const newScope: Scope = {
      parent: this.currentScope,
      level: this.currentScope.level + 1,
      type,
      bindings: new Map(),
    }
    this.currentScope = newScope
  }

  /**
   * 退出当前作用域
   */
  popScope(): void {
    if (this.currentScope.parent) {
      this.currentScope = this.currentScope.parent
    }
  }

  /**
   * 在当前作用域添加绑定
   */
  declare(name: string, kind: BindingKind): void {
    this.currentScope.bindings.set(name, { name, kind })
  }

  /**
   * 查找绑定（递归向上）
   *
   * 这是"递归作用域向上寻址"的核心实现：
   *
   * 算法流程：
   * 1. 从当前作用域开始查找
   * 2. 如果当前作用域有该绑定，返回
   * 3. 如果没有，移动到父作用域
   * 4. 重复步骤 1-3，直到找到或到达根作用域
   *
   * 对应 Babel 的 path.scope.getBinding(name)
   *
   * @param name - 变量名
   * @param fromLevel - 起始查找的层级（默认为当前作用域）
   * @returns 绑定信息，如果未找到返回 null
   */
  resolve(name: string, fromLevel?: number): BindingInfo | null {
    let scope: Scope | null = this.currentScope
    const searchLevel = fromLevel ?? this.currentScope.level

    // 递归向上遍历作用域链
    while (scope) {
      const entry = scope.bindings.get(name)
      if (entry) {
        return {
          name: entry.name,
          kind: entry.kind,
          scopeType: scope.type,
          level: scope.level,
          isExternal: scope.level < searchLevel,
        }
      }
      scope = scope.parent
    }

    return null
  }

  /**
   * 检查变量是否在当前作用域或父作用域中声明
   *
   * 对应 Babel 的 path.scope.hasBinding(name)
   */
  hasBinding(name: string): boolean {
    return this.resolve(name) !== null
  }

  /**
   * 获取当前作用域层级
   */
  get currentLevel(): number {
    return this.currentScope.level
  }

  /**
   * 获取当前作用域类型
   */
  get currentScopeType(): ScopeType {
    return this.currentScope.type
  }
}
