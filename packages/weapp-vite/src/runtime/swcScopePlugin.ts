/**
 * SWC 自定义插件：作用域分析与递归向上寻址
 *
 * 这个模块提供了一个完整的 SWC 插件实现，展示如何在 SWC 中实现
 * 和 Babel 类似的作用域查找功能。
 *
 * 核心功能：递归向上寻址 (Recursive Scope Upward Lookup)
 * - 从当前作用域开始
 * - 逐层向上遍历父作用域
 * - 直到找到目标绑定或到达全局作用域
 *
 * ============================================================================
 * Babel vs SWC 对照
 * ============================================================================
 *
 * Babel:
 * ```ts
 * import traverse from '@babel/traverse'
 *
 * traverse(ast, {
 *   Identifier(path) {
 *     const binding = path.scope.getBinding(path.node.name)
 *     // binding.kind, binding.scope, etc.
 *   }
 * })
 * ```
 *
 * SWC:
 * ```ts
 * import Visitor from '@swc/core/Visitor'
 *
 * class MyVisitor extends Visitor {
 *   visitIdentifier(node: Identifier): Identifier {
 *     const binding = this.scopeManager.resolve(node.value)
 *     // ...
 *     return super.visitIdentifier(node)
 *   }
 * }
 * ```
 */

import type {
  ArrowFunctionExpression,
  BlockStatement,
  CatchClause,
  ClassDeclaration,
  Declaration,
  FunctionDeclaration,
  FunctionExpression,
  Identifier,
  ImportDeclaration,
  Param,
  Pattern,
  Program,
  VariableDeclaration,
} from '@swc/types'
import { parseSync } from '@swc/core'
import Visitor from '@swc/core/Visitor'

// ============================================================================
// 类型定义
// ============================================================================

/**
 * 绑定类型
 */
export type BindingKind = 'var' | 'let' | 'const' | 'param' | 'import' | 'function'

/**
 * 作用域类型
 */
export type ScopeType = 'module' | 'function' | 'block' | 'catch'

/**
 * 变量绑定信息
 */
export interface BindingInfo {
  /** 变量名 */
  name: string
  /** 绑定类型 */
  kind: BindingKind
  /** 作用域类型 */
  scopeType: ScopeType
  /** 作用域层级（0 = 全局/模块） */
  level: number
  /** 是否来自外部作用域 */
  isExternal: boolean
}

/**
 * 作用域分析结果
 */
export interface ScopeAnalysisResult {
  /** 所有外部引用 */
  externalRefs: Map<string, BindingInfo>
  /** 所有本地绑定 */
  localBindings: Map<string, BindingInfo>
  /** 所有导入 */
  imports: Map<string, string> // local -> source
}

// ============================================================================
// 作用域管理器（递归向上寻址的核心）
// ============================================================================

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

// ============================================================================
// 辅助函数
// ============================================================================

/**
 * 从 Pattern 中提取标识符名称
 */
function extractNamesFromPattern(pattern: Pattern): string[] {
  const names: string[] = []

  if (pattern.type === 'Identifier') {
    names.push(pattern.value)
  }
  else if (pattern.type === 'ObjectPattern') {
    for (const prop of pattern.properties) {
      if (prop.type === 'KeyValuePatternProperty') {
        // KeyValuePatternProperty 的 value 是 Pattern
        names.push(...extractNamesFromPattern(prop.value))
      }
      else if (prop.type === 'AssignmentPatternProperty') {
        // AssignmentPatternProperty 的 key 是 Identifier（简写属性）
        names.push(prop.key.value)
      }
      else if (prop.type === 'RestElement') {
        names.push(...extractNamesFromPattern(prop.argument))
      }
    }
  }
  else if (pattern.type === 'ArrayPattern') {
    for (const elem of pattern.elements) {
      if (elem) {
        names.push(...extractNamesFromPattern(elem))
      }
    }
  }
  else if (pattern.type === 'RestElement') {
    names.push(...extractNamesFromPattern(pattern.argument))
  }
  else if (pattern.type === 'AssignmentPattern') {
    names.push(...extractNamesFromPattern(pattern.left))
  }

  return names
}

/**
 * 从 Param 中提取标识符名称
 */
function extractNamesFromParam(param: Param): string[] {
  // Param 的 pat 属性是 Pattern
  return extractNamesFromPattern(param.pat)
}

/**
 * 从 Pattern 或 Param 中提取标识符名称
 */
function extractNames(patternOrParam: Pattern | Param): string[] {
  if ('pat' in patternOrParam) {
    return extractNamesFromPattern(patternOrParam.pat)
  }
  return extractNamesFromPattern(patternOrParam)
}

// ============================================================================
// SWC Visitor（用于遍历和分析）
// ============================================================================

/**
 * 作用域收集器 - 扩展 SWC Visitor
 *
 * 与 Babel 的 traverse 类似，但需要手动管理作用域栈
 *
 * @deprecated SWC Visitor is deprecated, use Wasm plugin instead
 */
// biome-ignore lint/complexity/noThisInStatic: This is a class instance
class ScopeCollector extends Visitor {
  scopeManager: ScopeManager
  externalRefs: Map<string, BindingInfo>
  localBindings: Map<string, BindingInfo>
  imports: Map<string, string>

  constructor() {
    super()
    this.scopeManager = new ScopeManager()
    this.externalRefs = new Map()
    this.localBindings = new Map()
    this.imports = new Map()
  }

  /**
   * 处理标识符 - 检查是否是外部引用
   */
  override visitIdentifier(node: Identifier): Identifier {
    const binding = this.scopeManager.resolve(node.value)
    if (binding) {
      if (binding.isExternal) {
        this.externalRefs.set(node.value, binding)
      }
      else {
        this.localBindings.set(node.value, binding)
      }
    }
    return super.visitIdentifier(node)
  }

  /**
   * 处理函数声明
   */
  override visitFunctionDeclaration(node: FunctionDeclaration): Declaration {
    // 声明函数名
    this.scopeManager.declare(node.identifier.value, 'function')

    // 进入函数作用域
    this.scopeManager.pushScope('function')

    // 声明参数
    for (const param of node.params) {
      const names = extractNamesFromParam(param)
      for (const name of names) {
        this.scopeManager.declare(name, 'param')
      }
    }

    // 访问函数体（不创建额外的块作用域）
    if (node.body) {
      this.visitBlockStatement(node.body, true)
    }

    // 退出函数作用域
    this.scopeManager.popScope()

    return node
  }

  /**
   * 处理函数表达式
   */
  override visitFunctionExpression(node: FunctionExpression): FunctionExpression {
    this.scopeManager.pushScope('function')

    // 声明参数
    for (const param of node.params) {
      const names = extractNamesFromParam(param)
      for (const name of names) {
        this.scopeManager.declare(name, 'param')
      }
    }

    // 访问函数体（不创建额外的块作用域）
    if (node.body) {
      this.visitBlockStatement(node.body, true)
    }
    this.scopeManager.popScope()

    return node
  }

  /**
   * 处理箭头函数
   * 注意：SWC Visitor 的 visitArrowFunctionExpression 返回 Expression
   * ArrowFunctionExpression.params 是 Pattern[] 而不是 Param[]
   */
  override visitArrowFunctionExpression(node: ArrowFunctionExpression) {
    this.scopeManager.pushScope('function')

    // 声明参数
    for (const param of node.params) {
      const names = extractNames(param)
      for (const name of names) {
        this.scopeManager.declare(name, 'param')
      }
    }

    // 访问函数体（箭头函数的 body 可能是 BlockStatement 或 Expression）
    if (node.body.type === 'BlockStatement') {
      this.visitBlockStatement(node.body, true)
    }
    else {
      // 表达式体 - 直接访问表达式
      this.visitExpression(node.body)
    }

    this.scopeManager.popScope()

    return node
  }

  /**
   * 处理类声明
   */
  override visitClassDeclaration(node: ClassDeclaration): Declaration {
    this.scopeManager.declare(node.identifier.value, 'var')
    return super.visitClassDeclaration(node)
  }

  /**
   * 处理变量声明
   */
  override visitVariableDeclaration(node: VariableDeclaration): VariableDeclaration {
    const kind: BindingKind = node.kind === 'const' ? 'const' : node.kind === 'let' ? 'let' : 'var'

    for (const decl of node.declarations) {
      if (decl.type === 'VariableDeclarator') {
        const names = extractNamesFromPattern(decl.id)
        for (const name of names) {
          this.scopeManager.declare(name, kind)
        }
      }
    }

    return super.visitVariableDeclaration(node)
  }

  /**
   * 处理导入声明
   */
  override visitImportDeclaration(node: ImportDeclaration): ImportDeclaration {
    const source = node.source.value

    for (const spec of node.specifiers) {
      let localName = ''
      if (spec.type === 'ImportDefaultSpecifier') {
        localName = spec.local.value
      }
      else if (spec.type === 'ImportNamespaceSpecifier') {
        localName = spec.local.value
      }
      else if (spec.type === 'ImportSpecifier') {
        localName = spec.local.value
      }

      if (localName) {
        this.scopeManager.declare(localName, 'import')
        this.imports.set(localName, source)
      }
    }

    return super.visitImportDeclaration(node)
  }

  /**
   * 处理块语句
   * @param skipScope - 如果为 true，则不创建新的块作用域（用于函数体）
   */
  override visitBlockStatement(node: BlockStatement, skipScope = false): BlockStatement {
    if (!skipScope) {
      this.scopeManager.pushScope('block')
    }

    // 手动遍历语句
    for (const stmt of node.stmts) {
      this.visitStatement(stmt)
    }

    if (!skipScope) {
      this.scopeManager.popScope()
    }
    return node
  }

  /**
   * 处理 catch 子句
   * 注意：SWC Visitor 的 visitCatchClause 返回 CatchClause | undefined
   */
  override visitCatchClause(node: CatchClause) {
    this.scopeManager.pushScope('catch')

    if (node.param) {
      const names = extractNames(node.param)
      for (const name of names) {
        this.scopeManager.declare(name, 'var')
      }
    }

    const result = super.visitCatchClause(node)
    this.scopeManager.popScope()

    return result
  }

  /**
   * 获取分析结果
   */
  getResults(): ScopeAnalysisResult {
    return {
      externalRefs: this.externalRefs,
      localBindings: this.localBindings,
      imports: this.imports,
    }
  }

  /**
   * 处理 TypeScript 类型 - 空实现，避免遍历时报错
   */
  override visitTsType(): any {
    // 不需要处理类型注解
    return undefined
  }
}

// ============================================================================
// 分析器（纯函数，不转换代码）
// ============================================================================

/**
 * 分析代码的作用域
 *
 * @param code - 源代码
 * @returns 作用域分析结果
 *
 * @example
 * ```ts
 * const result = analyzeScope(`
 *   import { foo } from 'bar'
 *   function example() {
 *     return foo  // foo 是外部引用
 *   }
 * `)
 *
 * console.log(result.externalRefs.get('foo'))
 * // { name: 'foo', kind: 'import', isExternal: true, ... }
 * ```
 */
export function analyzeScope(code: string): ScopeAnalysisResult {
  const collector = new ScopeCollector()

  const ast = parseSync(code, {
    syntax: 'typescript',
    target: 'es2020',
  })

  if (!ast) {
    return {
      externalRefs: new Map(),
      localBindings: new Map(),
      imports: new Map(),
    }
  }

  // 执行遍历 - SWC 需要调用 visitProgram
  const program = ast as unknown as Program
  collector.visitProgram(program)

  return collector.getResults()
}

// ============================================================================
// 导出工具
// ============================================================================

export { parseSync, Visitor }

/**
 * 查找变量定义来源
 *
 * 这个函数展示了如何在 SWC 中实现和 Babel 的 path.scope.getBinding()
 * 相同的功能。
 */
export function resolveBinding(
  code: string,
  identifierName: string,
): BindingInfo | null {
  const result = analyzeScope(code)

  // 先查本地绑定
  if (result.localBindings.has(identifierName)) {
    return result.localBindings.get(identifierName)!
  }

  // 再查外部引用
  if (result.externalRefs.has(identifierName)) {
    return result.externalRefs.get(identifierName)!
  }

  return null
}

// ============================================================================
// Babel vs SWC 对照总结
// ============================================================================

/**
 * 递归向上寻址对照表：
 *
 * | 功能 | Babel | SWC |
 * |------|-------|-----|
 * | 获取绑定 | path.scope.getBinding(name) | scopeManager.resolve(name) |
 * | 检查绑定存在 | path.scope.hasBinding(name) | scopeManager.hasBinding(name) |
 * | 获取父作用域 | path.scope.parent | scope.parent (手动管理) |
 * | 当前作用域类型 | path.scope.type | scopeManager.currentScopeType |
 * | 绑定类型 | binding.kind | binding.kind |
 * | 绑定路径 | binding.path | 需手动记录 |
 *
 * SWC 的优势：
 * - 性能更好（Rust 实现）
 * - 更小的包体积
 *
 * SWC 的劣势：
 * - 需要手动管理作用域栈
 * - API 较为底层
 * - JavaScript API 已废弃（推荐使用 Wasm 插件）
 */
