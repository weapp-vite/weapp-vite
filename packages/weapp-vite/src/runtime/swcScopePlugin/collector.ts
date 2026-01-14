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
  VariableDeclaration,
} from '@swc/types'
import type { BindingInfo, ScopeAnalysisResult } from './types'
import Visitor from '@swc/core/Visitor'
import { ScopeManager } from './scopeManager'

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

/**
 * 作用域收集器 - 扩展 SWC Visitor
 *
 * 与 Babel 的 traverse 类似，但需要手动管理作用域栈
 *
 * @deprecated SWC Visitor 已废弃，请改用 Wasm 插件
 */
// biome-ignore lint/complexity/noThisInStatic: 这是类实例
export class ScopeCollector extends Visitor {
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
    const kind = node.kind === 'const' ? 'const' : node.kind === 'let' ? 'let' : 'var'

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
